import { SchemaVersion } from './types';

/**
 * Metadata describing one schema version.
 */
export interface SchemaDescriptor {
  version: SchemaVersion;
  /** Short stable label (used in reports). */
  label: string;
  /** Human-readable description of the shape. */
  description: string;
  /**
   * Storage keys used by this schema version.
   * Used by the migrator to locate data.
   */
  keys: readonly string[];
}

/**
 * All known schema versions, ordered from oldest to newest.
 * Adding a new version means: append here + add a migration
 * step in Task 1.5b's migrator implementation.
 */
export const SCHEMA_REGISTRY: readonly SchemaDescriptor[] = [
  {
    version: 0,
    label: 'legacy-app',
    description:
      'Legacy app shape. Keys include checkList, ' +
      'printchecks_receipts, printchecks_payments, vendors, ' +
      'bankAccounts, printchecks_templates, ' +
      'printchecks_receipt_templates, printchecks_customization, ' +
      'printchecks_presets, printchecks_settings.',
    keys: [
      'checkList',
      'printchecks_receipts',
      'printchecks_payments',
      'vendors',
      'bankAccounts',
      'printchecks_templates',
      'printchecks_receipt_templates',
      'printchecks_customization',
      'printchecks_presets',
      'printchecks_settings',
    ],
  },
  {
    version: 1,
    label: 'core-v1',
    description:
      'Core canonical shape. Keys: checks, receipts, payments, ' +
      'vendors, bankAccounts, templates, receiptTemplates, ' +
      'customization, presets, settings. All objects carry ' +
      '_schemaVersion: 1.',
    keys: [
      'checks',
      'receipts',
      'payments',
      'vendors',
      'bankAccounts',
      'templates',
      'receiptTemplates',
      'customization',
      'presets',
      'settings',
    ],
  },
] as const;

/**
 * Returns the descriptor for a given version, or undefined.
 */
export function getSchema(version: SchemaVersion):
  SchemaDescriptor | undefined {
  return SCHEMA_REGISTRY.find((s) => s.version === version);
}

/**
 * Returns the current (latest) schema version.
 */
export function getCurrentSchemaVersion(): SchemaVersion {
  return SCHEMA_REGISTRY[SCHEMA_REGISTRY.length - 1].version;
}

/**
 * Returns the list of versions that need migration from
 * `from` to the current version. Empty if already current.
 */
export function getPendingVersions(from: SchemaVersion):
  SchemaVersion[] {
  return SCHEMA_REGISTRY
    .map((s) => s.version)
    .filter((v) => v > from);
}
