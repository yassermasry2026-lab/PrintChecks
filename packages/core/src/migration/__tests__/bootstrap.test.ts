import { describe, expect, it } from 'vitest'
import type { StorageAdapter } from '../../storage/StorageAdapter'
import { bootstrapMigration } from '../bootstrap'

function memory(initial: Record<string, unknown> = {}, failSet = false): StorageAdapter {
  const map = new Map(Object.entries(initial))
  return {
    get: async key => map.has(key) ? map.get(key)! : null,
    set: async (key, value) => { if (failSet) throw new Error('write failed'); map.set(key, value) },
    remove: async key => { map.delete(key) }, clear: async () => { map.clear() },
    keys: async () => [...map.keys()], has: async key => map.has(key),
    getMany: async keys => new Map(keys.map(key => [key, map.has(key) ? map.get(key)! : null])),
    setMany: async entries => { if (failSet) throw new Error('write failed'); for (const [key, value] of entries) map.set(key, value) },
  }
}

const clock = () => 1_700_000_000_000

describe('migration bootstrap', () => {
  it('treats empty storage as current', async () => { const r = await bootstrapMigration(memory()); expect(r.migrated).toBe(false); expect(r.fromVersion).toBe(1) })
  it('migrates legacy checkList', async () => { const r = await bootstrapMigration(memory({ checkList: [{ id: 1 }] }), { now: clock }); expect(r.migrated).toBe(true) })
  it('migrates explicit version zero', async () => { const r = await bootstrapMigration(memory({ _schemaVersion: 0, checkList: [] }), { now: clock }); expect(r.migrated).toBe(true) })
  it('does not migrate version one', async () => expect((await bootstrapMigration(memory({ _schemaVersion: 1, checks: [] }))).migrated).toBe(false))
  it('writes canonical versioned records', async () => { const s = memory({ checkList: [{ id: 1 }] }); await bootstrapMigration(s, { now: clock }); expect(await s.get<any[]>('checks')).toEqual([{ id: 1, _schemaVersion: 1 }]) })
  it('preserves legacy keys', async () => { const s = memory({ checkList: [{ id: 1 }] }); await bootstrapMigration(s, { now: clock }); expect(await s.get('checkList')).toEqual([{ id: 1 }]) })
  it('writes the schema marker', async () => { const s = memory({ checkList: [] }); await bootstrapMigration(s, { now: clock }); expect(await s.get('_schemaVersion')).toBe(1) })
  it('creates a backup', async () => { const s = memory({ checkList: [] }); const r = await bootstrapMigration(s, { now: clock }); expect(r.backup?.storageKey).toBe('_backup_1700000000000') })
  it('backs up source data', async () => { const s = memory({ checkList: [{ id: 2 }] }); await bootstrapMigration(s, { now: clock }); expect((await s.get<any>('_backup_1700000000000')).data.checkList).toEqual([{ id: 2 }]) })
  it('is idempotent', async () => { const s = memory({ checkList: [] }); await bootstrapMigration(s, { now: clock }); const r = await bootstrapMigration(s, { now: clock }); expect(r.migrated).toBe(false); expect((await s.keys()).filter(k => k.startsWith('_backup_'))).toHaveLength(1) })
  it('returns a complete report', async () => { const r = await bootstrapMigration(memory({ checkList: [] }), { now: clock }); expect(r.report).toMatchObject({ startedAt: 0, endedAt: 1, success: true }); expect(r.report.durationMs).toBeGreaterThanOrEqual(0) })
  it('reports executed steps', async () => expect((await bootstrapMigration(memory({ checkList: [] }), { now: clock })).report.steps).toHaveLength(1))
  it('has no fatal error on success', async () => expect((await bootstrapMigration(memory({ checkList: [] }), { now: clock })).fatalError).toBeNull())
  it('captures malformed canonical input', async () => { const r = await bootstrapMigration(memory({ checks: 'bad' })); expect(r.fatalError).toContain('not an array'); expect(r.report.success).toBe(false) })
  it('supports skipPrune', async () => { const s = memory({ checkList: [], _backup_old: { createdAt: new Date(0).toISOString(), fromVersion: 0, keys: [] } }); const r = await bootstrapMigration(s, { skipPrune: true, now: clock }); expect(r.fatalError).toBeNull(); expect(await s.has('_backup_old')).toBe(true) })
  it('prunes old backups by default', async () => { const s = memory({ checkList: [], _backup_old: { timestamp: '0', storageKey: '_backup_old', createdAt: new Date(0).toISOString(), fromVersion: 0, keys: [], data: {} } }); await bootstrapMigration(s, { now: clock }); expect(await s.has('_backup_old')).toBe(false) })
  it('reports the original version', async () => expect((await bootstrapMigration(memory({ _schemaVersion: 0, checkList: [] }), { now: clock })).fromVersion).toBe(0))
  it('reports current target version', async () => expect((await bootstrapMigration(memory({ checkList: [] }), { now: clock })).toVersion).toBe(1))
  it('does not create a backup for a fresh install', async () => { const s = memory(); await bootstrapMigration(s); expect((await s.keys()).filter(k => k.startsWith('_backup_'))).toHaveLength(0) })
  it('captures top-level storage failures', async () => { const r = await bootstrapMigration(memory({ checkList: [] }, true)); expect(r.fatalError).toBe('write failed') })
})
