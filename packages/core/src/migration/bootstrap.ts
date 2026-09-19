import type { StorageAdapter } from '../storage/StorageAdapter';
import type { MigrationBackup } from './backup';
import { createBackup, pruneOldBackups } from './backup';
import { AppDataMigrator } from './AppDataMigrator';
import { getSchema, getCurrentSchemaVersion } from './registry';
import { SchemaVersions, type MigrationReport, type SchemaVersion } from './types';

export interface BootstrapResult {
  /** True if migration ran; false if data was already current. */
  migrated: boolean;
  /** Version before migration (or the detected version). */
  fromVersion: number;
  /** Version after migration (= current). */
  toVersion: number;
  /** The full migration report (empty steps if no-op). */
  report: MigrationReport;
  /** The backup created before migration, if any. */
  backup: MigrationBackup | null;
  /** Any errors that occurred at the top level (not per-record). */
  fatalError: string | null;
}

export interface BootstrapOptions {
  /** Override current time. */
  now?: () => number;
  /** Skip automatic pruning of old backups. */
  skipPrune?: boolean;
}

export const SCHEMA_VERSION_KEY = '_schemaVersion';

/**
 * Detect the current schema version from storage:
 * - Primary source: `_schemaVersion` key in storage.
 * - Fallback: if `checkList` or any v0 key exists → treat as v0.
 * - Fallback: if any v1-only key exists (e.g. `checks`) without `_schemaVersion` → treat as v1.
 * - If nothing exists → treat as v1 (fresh install, no migration needed; writes `_schemaVersion`).
 */
async function detectSchemaVersion(
  storage: StorageAdapter,
): Promise<{ version: SchemaVersion; isFreshInstall: boolean }> {
  const storedVersion = await storage.get<unknown>(SCHEMA_VERSION_KEY);
  if (typeof storedVersion === 'number' && Number.isInteger(storedVersion)) {
    return { version: storedVersion, isFreshInstall: false };
  }

  const allKeys = await storage.keys();
  if (allKeys.length === 0) {
    return { version: SchemaVersions.CORE_V1, isFreshInstall: true };
  }

  // Check for presence of legacy v0 keys
  const v0Schema = getSchema(SchemaVersions.LEGACY_APP);
  const v0Keys = v0Schema ? v0Schema.keys : ['checkList'];
  const hasV0Key = v0Keys.some((k) => allKeys.includes(k));
  if (hasV0Key) {
    return { version: SchemaVersions.LEGACY_APP, isFreshInstall: false };
  }

  // Check for presence of canonical v1 keys
  const v1Schema = getSchema(SchemaVersions.CORE_V1);
  const v1Keys = v1Schema ? v1Schema.keys : ['checks'];
  const hasV1Key = v1Keys.some((k) => allKeys.includes(k));
  if (hasV1Key) {
    return { version: SchemaVersions.CORE_V1, isFreshInstall: false };
  }

  // If no known schema keys exist (e.g. storage has other unrelated keys or is virtually empty)
  return { version: SchemaVersions.CORE_V1, isFreshInstall: true };
}

/**
 * Runs migration on app startup.
 *
 * Algorithm:
 *   1. Detect current version in storage:
 *      - Read `_schemaVersion` if present.
 *      - Absent → infer from keys present.
 *   2. If current → return { migrated: false, ... }.
 *   3. If older → create backup, run migrator, write new data
 *      under v1 keys, keep old keys intact (do NOT delete),
 *      write `_schemaVersion` marker, prune old backups.
 *   4. Return BootstrapResult.
 *
 * Non-destructive: original v0 keys are NOT removed in this
 * task. Deletion is a separate, later decision (Phase 5).
 *
 * Never throws: top-level errors are captured in
 * BootstrapResult.fatalError.
 */
export async function bootstrapMigration(
  storage: StorageAdapter,
  options?: BootstrapOptions,
): Promise<BootstrapResult> {
  const currentTargetVersion = getCurrentSchemaVersion();

  let detectedVersion: SchemaVersion;
  let isFresh: boolean;

  try {
    const detection = await detectSchemaVersion(storage);
    detectedVersion = detection.version;
    isFresh = detection.isFreshInstall;
  } catch (err) {
    return {
      migrated: false,
      fromVersion: SchemaVersions.LEGACY_APP,
      toVersion: currentTargetVersion,
      report: {
        startedAt: SchemaVersions.LEGACY_APP,
        endedAt: SchemaVersions.LEGACY_APP,
        steps: [],
        durationMs: 0,
        success: false,
      },
      backup: null,
      fatalError: err instanceof Error ? err.message : String(err),
    };
  }

  // Fresh install: mark schema version as current and return no-op
  if (isFresh) {
    try {
      await storage.set(SCHEMA_VERSION_KEY, currentTargetVersion);
    } catch (err) {
      return {
        migrated: false,
        fromVersion: detectedVersion,
        toVersion: currentTargetVersion,
        report: {
          startedAt: detectedVersion,
          endedAt: detectedVersion,
          steps: [],
          durationMs: 0,
          success: false,
        },
        backup: null,
        fatalError: err instanceof Error ? err.message : String(err),
      };
    }

    return {
      migrated: false,
      fromVersion: detectedVersion,
      toVersion: currentTargetVersion,
      report: {
        startedAt: detectedVersion,
        endedAt: currentTargetVersion,
        steps: [],
        durationMs: 0,
        success: true,
      },
      backup: null,
      fatalError: null,
    };
  }

  // Already at current version: no migration needed
  if (detectedVersion >= currentTargetVersion) {
    return {
      migrated: false,
      fromVersion: detectedVersion,
      toVersion: currentTargetVersion,
      report: {
        startedAt: detectedVersion,
        endedAt: detectedVersion,
        steps: [],
        durationMs: 0,
        success: true,
      },
      backup: null,
      fatalError: null,
    };
  }

  // Need migration (detectedVersion < currentTargetVersion)
  let backup: MigrationBackup | null = null;
  const migrator = new AppDataMigrator();

  try {
    // 1. Gather all keys from the detected source schema version
    const sourceSchema = getSchema(detectedVersion);
    const sourceKeys = sourceSchema ? [...sourceSchema.keys] : [];

    // Also include any storage keys that currently exist in storage
    const allExistingKeys = await storage.keys();
    for (const k of allExistingKeys) {
      if (!sourceKeys.includes(k) && k !== SCHEMA_VERSION_KEY && !k.startsWith('_backup_')) {
        sourceKeys.push(k);
      }
    }

    // 2. Create backup BEFORE any write of migrated data
    backup = await createBackup(storage, sourceKeys, detectedVersion, {
      now: options?.now,
    });

    // 3. Read source data
    const sourceData: Record<string, unknown> = {};
    for (const key of sourceKeys) {
      const val = await storage.get(key);
      if (val !== null && val !== undefined) {
        sourceData[key] = val;
      }
    }

    // 4. Run migration in memory
    const { data: migratedData, report } = migrator.migrate({
      from: detectedVersion,
      source: sourceData,
    });

    // 5. Write migrated canonical data under v1 keys (without deleting old keys)
    for (const [v1Key, records] of Object.entries(migratedData)) {
      await storage.set(v1Key, records);
    }

    // 6. Write _schemaVersion marker
    await storage.set(SCHEMA_VERSION_KEY, currentTargetVersion);

    // 7. Prune old backups (unless skipPrune is set)
    if (!options?.skipPrune) {
      await pruneOldBackups(storage, undefined, { now: options?.now });
    }

    return {
      migrated: true,
      fromVersion: detectedVersion,
      toVersion: currentTargetVersion,
      report,
      backup,
      fatalError: null,
    };
  } catch (err) {
    return {
      migrated: false,
      fromVersion: detectedVersion,
      toVersion: currentTargetVersion,
      report: {
        startedAt: detectedVersion,
        endedAt: detectedVersion,
        steps: [],
        durationMs: 0,
        success: false,
      },
      backup,
      fatalError: err instanceof Error ? err.message : String(err),
    };
  }
}
