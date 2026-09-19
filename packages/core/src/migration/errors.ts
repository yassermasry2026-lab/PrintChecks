/**
 * Thrown for unrecoverable structural errors. Individual record failures
 * are captured in the migration report instead.
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly step?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/** Thrown when the source schema version has no supported migration path. */
export class UnknownSchemaVersionError extends MigrationError {
  constructor(public readonly version: number) {
    super(`Unknown schema version: ${version}`);
    this.name = 'UnknownSchemaVersionError';
  }
}
