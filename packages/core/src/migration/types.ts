/**
 * A schema version identifier.
 * Convention: monotonically increasing integer starting at 0.
 * v0 = legacy app shape (pre-Phase-1)
 * v1 = core canonical shape (Phase 1+)
 */
export type SchemaVersion = number;

/**
 * Canonical schema version constants.
 */
export const SchemaVersions = {
  /** Legacy app shape: keys like `checkList`, no versioning. */
  LEGACY_APP: 0,
  /** Core canonical shape: `checks`, `bankAccounts`, etc. */
  CORE_V1: 1,
} as const;

/**
 * Any stored object that participates in schema versioning
 * must carry this marker at its root.
 */
export interface VersionedRecord {
  _schemaVersion: SchemaVersion;
}

/**
 * Result of a migration step, for reporting purposes.
 */
export interface MigrationStepResult {
  from: SchemaVersion;
  to: SchemaVersion;
  /** Number of records touched. */
  count: number;
  /** Records that could not be migrated, with reason. */
  skipped: Array<{ key: string; reason: string }>;
  /** Human-readable summary of what this step did. */
  summary: string;
}

/**
 * Full migration report returned by the migrator.
 */
export interface MigrationReport {
  /** Version at start of migration. */
  startedAt: SchemaVersion;
  /** Version after migration completes. */
  endedAt: SchemaVersion;
  /** Ordered list of steps executed. */
  steps: MigrationStepResult[];
  /** Total duration in milliseconds. */
  durationMs: number;
  /** Overall success flag (all steps completed without fatal error). */
  success: boolean;
}
