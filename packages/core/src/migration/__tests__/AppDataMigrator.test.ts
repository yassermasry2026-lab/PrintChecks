import { describe, expect, it } from 'vitest'
import { AppDataMigrator, type MigratorInput } from '../AppDataMigrator'
import { MigrationError, UnknownSchemaVersionError } from '../errors'
import { getCurrentSchemaVersion, getSchema } from '../registry'

const migrator = new AppDataMigrator()

function canonicalData(): Record<string, unknown[]> {
  return Object.fromEntries(getSchema(1)!.keys.map(key => [key, []]))
}

describe('AppDataMigrator', () => {
  it('migrates empty v0 input to a complete v1 shape', () => {
    const result = migrator.migrate({ from: 0, source: {} })
    expect(result.data).toEqual(canonicalData())
    expect(result.report.success).toBe(true)
  })

  it('returns already-current data unchanged with no steps', () => {
    const source = { ...canonicalData(), checks: [{ id: 1, _schemaVersion: 1 }] }
    const result = migrator.migrate({ from: 1, source })
    expect(result.data).toEqual(source)
    expect(result.data.checks).toBe(source.checks)
    expect(result.data.checks[0]).toBe(source.checks[0])
    expect(result.report).toMatchObject({ startedAt: 1, endedAt: 1, success: true, steps: [] })
  })

  it('migrates populated v0 input in exactly one step', () => {
    const result = migrator.migrate({ from: 0, source: { checkList: [{ id: 1 }] } })
    expect(result.data.checks).toEqual([{ id: 1, _schemaVersion: 1 }])
    expect(result.report.steps).toHaveLength(1)
  })

  it.each([-1, 999, 0.5, NaN, Infinity, -Infinity])('rejects unknown version %s', from => {
    expect(() => migrator.migrate({ from, source: {} })).toThrow(UnknownSchemaVersionError)
  })

  it('reports the supplied starting version', () => {
    expect(migrator.migrate({ from: 0, source: {} }).report.startedAt).toBe(0)
    expect(migrator.migrate({ from: 1, source: {} }).report.startedAt).toBe(1)
  })

  it('reports the current ending version', () => {
    expect(migrator.migrate({ from: 0, source: {} }).report.endedAt).toBe(getCurrentSchemaVersion())
  })

  it('measures finite, nonnegative duration on migration and no-op paths', () => {
    for (const from of [0, 1]) {
      const { durationMs } = migrator.migrate({ from, source: {} }).report
      expect(Number.isFinite(durationMs)).toBe(true)
      expect(durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('reports success on a normal migration', () => {
    expect(migrator.migrate({ from: 0, source: { vendors: [{}] } }).report.success).toBe(true)
  })

  it('is idempotent across repeated v1 calls', () => {
    const first = migrator.migrate({ from: 1, source: { checks: [{ id: 1, _schemaVersion: 1 }] } })
    const second = migrator.migrate({ from: 1, source: first.data })
    expect(second.data).toEqual(first.data)
    // Timing is measured independently; all semantic report fields agree.
    expect({ ...second.report, durationMs: 0 }).toEqual({ ...first.report, durationMs: 0 })
  })

  it('targets the registry current version', () => {
    expect(migrator.getTargetVersion()).toBe(getCurrentSchemaVersion())
  })

  it('does not mutate source data', () => {
    const record = Object.freeze({ id: 1 })
    const source = Object.freeze({ checkList: Object.freeze([record]) })
    migrator.migrate({ from: 0, source })
    expect(source).toEqual({ checkList: [{ id: 1 }] })
    expect(record).not.toHaveProperty('_schemaVersion')
  })

  it('includes the complete step structure', () => {
    const result = migrator.migrate({ from: 0, source: { checkList: [{ id: 1 }] } })
    expect(result.report.steps[0]).toEqual({
      from: 0, to: 1, count: 1, skipped: [], summary: expect.stringMatching(/\S/),
    })
  })

  it('can be reused safely without retaining data or reports', () => {
    const first = migrator.migrate({ from: 0, source: { checkList: [{ id: 1 }] } })
    const second = migrator.migrate({ from: 0, source: {} })
    expect(first.data.checks).toHaveLength(1)
    expect(second.data.checks).toEqual([])
    expect(second.report.steps[0].count).toBe(0)
    expect(second.report.steps).not.toBe(first.report.steps)
  })

  it('chains v0 output into a v1 no-op without adding or losing records', () => {
    const first = migrator.migrate({ from: 0, source: { checkList: [{ id: 1 }], vendors: [{}] } })
    const second = migrator.migrate({ from: first.report.endedAt, source: first.data })
    expect(second.data).toEqual(first.data)
    expect(second.report.steps).toEqual([])
  })

  it('normalizes missing current-version arrays without changing the input', () => {
    const source = Object.freeze({ checks: Object.freeze([{ id: 1, _schemaVersion: 1 }]) })
    const result = migrator.migrate({ from: 1, source })
    expect(Object.keys(result.data).sort()).toEqual(getSchema(1)!.keys.slice().sort())
    expect(result.data.receipts).toEqual([])
    expect(source).not.toHaveProperty('receipts')
  })

  it('propagates record failures and collisions into the step report without fatal failure', () => {
    const result = migrator.migrate({ from: 0, source: { checks: [], checkList: [null, {}] } })
    expect(result.report.success).toBe(true)
    expect(result.report.steps[0].count).toBe(1)
    expect(result.report.steps[0].skipped).toEqual([
      { key: 'checks', reason: 'v1 key already present' },
      { key: 'checkList[0]', reason: 'not an object record' },
    ])
  })

  it.each([null, undefined, [], 'bad'])('rejects invalid source structure %j', source => {
    expect(() => migrator.migrate({ from: 0, source } as unknown as MigratorInput))
      .toThrow(MigrationError)
  })

  it.each([0, 1])('rejects malformed canonical collections from version %s', from => {
    const source = { checks: null }
    expect(() => migrator.migrate({ from, source })).toThrow(MigrationError)
    expect(source).toEqual({ checks: null })
  })

  it('validates shared canonical keys on the already-current path', () => {
    expect(() => migrator.migrate({ from: 1, source: { vendors: null } })).toThrow(MigrationError)
  })

  it('preserves unknown data on the already-current path', () => {
    const source = { ...canonicalData(), extra: [{ id: 1 }] }
    expect(migrator.migrate({ from: 1, source }).data).toEqual(source)
  })

  it('rejects a missing input with a structural error', () => {
    expect(() => migrator.migrate(undefined as unknown as MigratorInput)).toThrow(MigrationError)
  })

  it('retains error metadata and inheritance', () => {
    const cause = new Error('failure')
    const structural = new MigrationError('bad shape', 'v0-to-v1', cause)
    expect(structural).toBeInstanceOf(Error)
    expect(structural).toMatchObject({ name: 'MigrationError', step: 'v0-to-v1', cause })
    const version = new UnknownSchemaVersionError(999)
    expect(version).toBeInstanceOf(MigrationError)
    expect(version).toMatchObject({
      name: 'UnknownSchemaVersionError', version: 999, message: 'Unknown schema version: 999',
    })
  })
})
