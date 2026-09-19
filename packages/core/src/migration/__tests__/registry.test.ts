import { describe, expect, it } from 'vitest'
import {
  SCHEMA_REGISTRY,
  getCurrentSchemaVersion,
  getPendingVersions,
  getSchema,
} from '../registry'
import { SchemaVersions, type VersionedRecord } from '../types'

describe('Schema Registry', () => {
  it('1. SCHEMA_REGISTRY is not empty', () => {
    expect(SCHEMA_REGISTRY.length).toBeGreaterThan(0)
  })

  it('2. SCHEMA_REGISTRY versions are strictly increasing', () => {
    for (let i = 1; i < SCHEMA_REGISTRY.length; i++) {
      expect(SCHEMA_REGISTRY[i].version).toBeGreaterThan(SCHEMA_REGISTRY[i - 1].version)
    }
  })

  it('3. SCHEMA_REGISTRY versions start at 0', () => {
    expect(SCHEMA_REGISTRY[0].version).toBe(0)
  })

  it('4. Every descriptor has non-empty label, description, keys', () => {
    for (const descriptor of SCHEMA_REGISTRY) {
      expect(descriptor.label.trim().length).toBeGreaterThan(0)
      expect(descriptor.description.trim().length).toBeGreaterThan(0)
      expect(descriptor.keys.length).toBeGreaterThan(0)
      for (const key of descriptor.keys) {
        expect(key.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('5. No duplicate keys within a single descriptor', () => {
    for (const descriptor of SCHEMA_REGISTRY) {
      const keySet = new Set(descriptor.keys)
      expect(keySet.size).toBe(descriptor.keys.length)
    }
  })

  it('6. getSchema(0) returns the legacy descriptor', () => {
    const legacy = getSchema(0)
    expect(legacy).toBeDefined()
    expect(legacy?.version).toBe(0)
    expect(legacy?.label).toBe('legacy-app')
    expect(legacy?.keys).toEqual([
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
    ])
  })

  it('7. getSchema(1) returns the core-v1 descriptor', () => {
    const coreV1 = getSchema(1)
    expect(coreV1).toBeDefined()
    expect(coreV1?.version).toBe(1)
    expect(coreV1?.label).toBe('core-v1')
    expect(coreV1?.keys).toEqual([
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
    ])
  })

  it('8. getSchema(999) returns undefined', () => {
    expect(getSchema(999)).toBeUndefined()
    expect(getSchema(-1)).toBeUndefined()
  })

  it('9. getCurrentSchemaVersion() equals the last registry entry', () => {
    const lastVersion = SCHEMA_REGISTRY[SCHEMA_REGISTRY.length - 1].version
    expect(getCurrentSchemaVersion()).toBe(lastVersion)
    expect(getCurrentSchemaVersion()).toBe(1)
  })

  it('10. getPendingVersions(-1) returns all versions', () => {
    const allVersions = SCHEMA_REGISTRY.map((s) => s.version)
    expect(getPendingVersions(-1)).toEqual(allVersions)
  })

  it('11. getPendingVersions(current) returns []', () => {
    const current = getCurrentSchemaVersion()
    expect(getPendingVersions(current)).toEqual([])
    expect(getPendingVersions(999)).toEqual([])
  })

  it('12. getPendingVersions(0) returns [1]', () => {
    expect(getPendingVersions(0)).toEqual([1])
  })

  it('13. SchemaVersions.LEGACY_APP === 0', () => {
    expect(SchemaVersions.LEGACY_APP).toBe(0)
  })

  it('14. SchemaVersions.CORE_V1 === 1', () => {
    expect(SchemaVersions.CORE_V1).toBe(1)
  })

  it('15. VersionedRecord type is structurally compatible with { _schemaVersion: number }', () => {
    // Type-level compile check via helper function
    function acceptVersionedRecord(record: VersionedRecord): number {
      return record._schemaVersion
    }

    const testObject = { _schemaVersion: 1 }
    expect(acceptVersionedRecord(testObject)).toBe(1)

    const legacyObject: VersionedRecord = { _schemaVersion: SchemaVersions.LEGACY_APP }
    expect(acceptVersionedRecord(legacyObject)).toBe(0)
  })
})
