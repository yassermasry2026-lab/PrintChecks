import { describe, expect, it } from 'vitest'
import { MigrationError } from '../errors'
import { migrateV0ToV1 } from '../v0-to-v1'

const mapping = [
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
] as const
const canonicalKeys = mapping.map(([, key]) => key)

describe('migrateV0ToV1', () => {
  it('returns all ten empty canonical arrays for empty input', () => {
    const result = migrateV0ToV1({})
    expect(Object.keys(result.data)).toEqual(canonicalKeys)
    expect(Object.values(result.data)).toEqual(canonicalKeys.map(() => []))
    expect(result.count).toBe(0)
    expect(result.skipped).toEqual([])
  })

  it('migrates two checks', () => {
    const result = migrateV0ToV1({ checkList: [{ id: 1 }, { id: 2 }] })
    expect(result.data.checks).toEqual([
      { id: 1, _schemaVersion: 1 }, { id: 2, _schemaVersion: 1 },
    ])
    expect(result.count).toBe(2)
  })

  it('populates all ten canonical keys and stamps every migrated record', () => {
    const input = Object.fromEntries(mapping.map(([key]) => [key, [{ id: key }]]))
    const result = migrateV0ToV1(input)
    for (const [legacy, canonical] of mapping) {
      expect(result.data[canonical]).toEqual([{ id: legacy, _schemaVersion: 1 }])
    }
    expect(result.count).toBe(10)
    expect(result.skipped).toEqual([])
  })

  it('replaces an old root version marker', () => {
    expect(migrateV0ToV1({ checkList: [{ _schemaVersion: 0 }] }).data.checks)
      .toEqual([{ _schemaVersion: 1 }])
  })

  it.each([
    ['number', 42], ['null', null], ['undefined', undefined],
    ['string', 'checks'], ['object', { id: 1 }], ['boolean', false],
  ])('reports a non-array %s legacy value', (_label, value) => {
    const result = migrateV0ToV1({ checkList: value })
    expect(result.data.checks).toEqual([])
    expect(result.skipped).toEqual([{ key: 'checkList', reason: 'not an array' }])
    expect(result.count).toBe(0)
  })

  it('appends legacy records after existing canonical records and reports the collision', () => {
    const existing = { id: 'existing', _schemaVersion: 1 }
    const result = migrateV0ToV1({ checks: [existing], checkList: [{ id: 'legacy' }] })
    expect(result.data.checks).toEqual([existing, { id: 'legacy', _schemaVersion: 1 }])
    expect(result.count).toBe(1)
    expect(result.skipped).toEqual([{ key: 'checks', reason: 'v1 key already present' }])
  })

  it('preserves and reports canonical-only collections', () => {
    const checks = [{ id: 1, _schemaVersion: 1 }]
    const result = migrateV0ToV1({ checks })
    expect(result.data.checks).toEqual(checks)
    expect(result.data.checks).not.toBe(checks)
    expect(result.count).toBe(0)
    expect(result.skipped).toEqual([{ key: 'checks', reason: 'v1 key already present' }])
  })

  it('ignores unknown keys silently', () => {
    expect(migrateV0ToV1({ unknown: [1] })).toEqual(migrateV0ToV1({}))
  })

  it('handles a mix of present and missing keys', () => {
    const result = migrateV0ToV1({ checkList: [{ id: 1 }], printchecks_payments: [{ id: 2 }] })
    expect(result.data.checks).toHaveLength(1)
    expect(result.data.payments).toHaveLength(1)
    expect(result.data.receipts).toEqual([])
    expect(result.skipped).toEqual([])
  })

  it('does not mutate frozen source data or nested fields', () => {
    const nested = Object.freeze({ payeeName: 'Vendor', _schemaVersion: 0 })
    const record = Object.freeze({ id: 1, nested })
    const source = Object.freeze({ checkList: Object.freeze([record]) })
    const result = migrateV0ToV1(source)
    expect(source).toEqual({ checkList: [{ id: 1, nested: { payeeName: 'Vendor', _schemaVersion: 0 } }] })
    expect(result.data.checks).toEqual([{ id: 1, nested, _schemaVersion: 1 }])
    expect(result.data.checks[0]).not.toBe(record)
  })

  it('creates new arrays for every collection, including collisions and shared keys', () => {
    const source = Object.fromEntries(mapping.map(([key]) => [key, [{ id: key }]]))
    const checks = [{ id: 'existing', _schemaVersion: 1 }]
    const result = migrateV0ToV1({ ...source, checks })
    for (const [legacy, canonical] of mapping) {
      expect(result.data[canonical]).not.toBe(source[legacy])
    }
    expect(result.data.checks).not.toBe(checks)
    expect(checks).toHaveLength(1)
  })

  it('counts only successfully migrated legacy records', () => {
    const result = migrateV0ToV1({
      checkList: [{ id: 1 }, null, { id: 2 }],
      printchecks_receipts: [{ id: 3 }], checks: [{ id: 4, _schemaVersion: 1 }],
    })
    expect(result.count).toBe(3)
  })

  it('reports every anomaly in mixed input', () => {
    const result = migrateV0ToV1({
      checks: [], checkList: [null], printchecks_payments: 'bad', printchecks_receipts: undefined,
    })
    expect(result.skipped).toEqual([
      { key: 'checks', reason: 'v1 key already present' },
      { key: 'checkList[0]', reason: 'not an object record' },
      { key: 'printchecks_receipts', reason: 'not an array' },
      { key: 'printchecks_payments', reason: 'not an array' },
    ])
  })

  it('provides a non-empty summary including counts', () => {
    expect(migrateV0ToV1({ checkList: [{}] }).summary)
      .toBe('Migrated 1 records from v0 to v1; reported 0 anomalies.')
  })

  it('keeps all absent canonical arrays present and distinct', () => {
    const { data } = migrateV0ToV1({ checkList: [{}] })
    for (const key of canonicalKeys.filter(key => key !== 'checks')) expect(data[key]).toEqual([])
    expect(new Set(Object.values(data)).size).toBe(10)
  })

  it('migrates 1000 records without error', () => {
    const records = Array.from({ length: 1000 }, (_, id) => ({ id }))
    const result = migrateV0ToV1({ checkList: records })
    expect(result.count).toBe(1000)
    expect(result.data.checks).toEqual(records.map(record => ({ ...record, _schemaVersion: 1 })))
  })

  it.each(['vendors', 'bankAccounts'])('migrates shared key %s only once without a collision', key => {
    const result = migrateV0ToV1({ [key]: [{ id: 1 }] })
    expect(result.data[key]).toEqual([{ id: 1, _schemaVersion: 1 }])
    expect(result.count).toBe(1)
    expect(result.skipped).toEqual([])
  })

  it('skips each invalid array item without altering the source', () => {
    const items = [null, undefined, 'bad', 7, false, [], { id: 1 }]
    const result = migrateV0ToV1({ checkList: items })
    expect(result.data.checks).toEqual([{ id: 1, _schemaVersion: 1 }])
    expect(result.skipped).toEqual(items.slice(0, 6).map((_, index) => ({
      key: `checkList[${index}]`, reason: 'not an object record',
    })))
    expect(items).toEqual([null, undefined, 'bad', 7, false, [], { id: 1 }])
  })

  it('reports sparse array holes', () => {
    const result = migrateV0ToV1({ checkList: Array(1) })
    expect(result.skipped).toEqual([{ key: 'checkList[0]', reason: 'not an object record' }])
    expect(result.count).toBe(0)
  })

  it.each([null, undefined, 'bad', 3, {}])('rejects malformed canonical collection %j', value => {
    expect(() => migrateV0ToV1({ checks: value, checkList: [{}] }))
      .toThrow(MigrationError)
  })

  it.each([null, undefined, [], 'bad'])('rejects structurally invalid source %j', value => {
    expect(() => migrateV0ToV1(value as unknown as Record<string, unknown>))
      .toThrow(MigrationError)
  })

  it('attaches the step to structural errors', () => {
    try {
      migrateV0ToV1({ checks: null })
      expect.unreachable('Expected a structural error')
    } catch (error) {
      expect(error).toMatchObject({ name: 'MigrationError', step: 'v0-to-v1' })
    }
  })

  it('does not treat inherited keys as source collections', () => {
    const source = Object.create({ checkList: [{}], checks: [{}] })
    expect(migrateV0ToV1(source)).toEqual(migrateV0ToV1({}))
  })
})
