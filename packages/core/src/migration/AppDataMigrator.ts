import { MigrationError, UnknownSchemaVersionError } from './errors';
import { getCurrentSchemaVersion, getPendingVersions, getSchema } from './registry';
import { SchemaVersions, type MigrationReport, type SchemaVersion } from './types';
import { migrateV0ToV1, type V0ToV1Result } from './v0-to-v1';

export interface MigratorInput {
  /** Current schema version detected in the source data. */
  from: SchemaVersion;
  /** Raw source data keyed by whatever keys exist (v0 or v1). */
  source: Record<string, unknown>;
}

export interface MigratorOutput {
  /** Migrated data in v1 shape (all v1 keys present). */
  data: Record<string, unknown[]>;
  /** Full report. */
  report: MigrationReport;
}

export class AppDataMigrator {
  /**
   * Migrates to the current version without reading or writing storage.
   * Already-current data is unchanged except for missing canonical arrays;
   * success with no steps denotes "already current".
   */
  migrate(input: MigratorInput): MigratorOutput {
    const started = performance.now();
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new MigrationError('Migration input must be an object');
    }
    const { from, source } = input;
    const target = this.getTargetVersion();
    if (!Number.isInteger(from) || from < 0 || from > target || !getSchema(from)) {
      throw new UnknownSchemaVersionError(from);
    }
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
      throw new MigrationError('Source must be a keyed object');
    }

    const report: MigrationReport = {
      startedAt: from,
      endedAt: from,
      steps: [],
      durationMs: 0,
      success: true,
    };
    let data: Record<string, unknown> = source;
    for (const to of getPendingVersions(from)) {
      if (report.endedAt !== SchemaVersions.LEGACY_APP || to !== SchemaVersions.CORE_V1) {
        throw new UnknownSchemaVersionError(report.endedAt);
      }
      const result: V0ToV1Result = migrateV0ToV1(data);
      report.steps.push({
        from: report.endedAt,
        to,
        count: result.count,
        skipped: result.skipped,
        summary: result.summary,
      });
      data = result.data;
      report.endedAt = to;
    }

    // Validate rather than silently discard malformed canonical collections.
    // Preserve existing values/references on the no-op path.
    const normalized = { ...data };
    for (const key of getSchema(target)!.keys) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        normalized[key] = [];
      } else if (!Array.isArray(data[key])) {
        throw new MigrationError(`Canonical key "${key}" is not an array`);
      }
    }
    report.durationMs = Math.max(0, performance.now() - started);
    return { data: normalized as Record<string, unknown[]>, report };
  }

  /** Returns the version this migrator targets. */
  getTargetVersion(): SchemaVersion {
    return getCurrentSchemaVersion();
  }
}
