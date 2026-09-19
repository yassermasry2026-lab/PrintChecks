import { MigrationError } from './errors';
import { SchemaVersions, type VersionedRecord } from './types';

const KEY_MAPPING = [
  ['checkList', 'checks'],
  ['printchecks_receipts', 'receipts'],
  ['printchecks_payments', 'payments'],
  ['vendors', 'vendors'],
  ['bankAccounts', 'bankAccounts'],
  ['printchecks_templates', 'templates'],
  ['printchecks_receipt_templates', 'receiptTemplates'],
  ['printchecks_customization', 'customization'],
  ['printchecks_presets', 'presets'],
  ['printchecks_settings', 'settings'],
] as const;

export interface V0ToV1Result {
  /** Canonical shape, including empty arrays for absent keys. */
  data: Record<string, unknown[]>;
  count: number;
  skipped: Array<{ key: string; reason: string }>;
  summary: string;
}

/** Migrates legacy records without mutating the source or accessing storage. */
export function migrateV0ToV1(input: Record<string, unknown>): V0ToV1Result {
  const step = 'v0-to-v1';
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new MigrationError('Source must be a keyed object', step);
  }

  const data: Record<string, unknown[]> = {};
  const skipped: V0ToV1Result['skipped'] = [];
  let count = 0;

  for (const [legacyKey, canonicalKey] of KEY_MAPPING) {
    const records: unknown[] = [];
    data[canonicalKey] = records;

    // Shared names represent a single legacy collection, not a collision.
    if (legacyKey !== canonicalKey && Object.prototype.hasOwnProperty.call(input, canonicalKey)) {
      const existing = input[canonicalKey];
      if (!Array.isArray(existing)) {
        throw new MigrationError(`Canonical key "${canonicalKey}" is not an array`, step);
      }
      for (const record of existing) records.push(record);
      skipped.push({ key: canonicalKey, reason: 'v1 key already present' });
    }

    if (!Object.prototype.hasOwnProperty.call(input, legacyKey)) continue;
    const legacy = input[legacyKey];
    if (!Array.isArray(legacy)) {
      skipped.push({ key: legacyKey, reason: 'not an array' });
      continue;
    }

    // Index iteration also reports holes in sparse arrays as invalid records.
    for (let index = 0; index < legacy.length; index++) {
      const record: unknown = legacy[index];
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        skipped.push({ key: `${legacyKey}[${index}]`, reason: 'not an object record' });
        continue;
      }
      const migrated: VersionedRecord = { ...record, _schemaVersion: SchemaVersions.CORE_V1 };
      records.push(migrated);
      count++;
    }
  }

  return {
    data,
    count,
    skipped,
    summary: `Migrated ${count} records from v0 to v1; reported ${skipped.length} anomalies.`,
  };
}
