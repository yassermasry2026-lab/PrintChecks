import { describe, expect, it } from 'vitest'
import type { StorageAdapter } from '../../storage/StorageAdapter'
import { createBackup, listBackups, pruneOldBackups } from '../backup'

function memory(initial: Record<string, unknown> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial))
  return {
    get: async key => map.has(key) ? map.get(key)! : null,
    set: async (key, value) => { map.set(key, value) },
    remove: async key => { map.delete(key) }, clear: async () => { map.clear() },
    keys: async () => [...map.keys()], has: async key => map.has(key),
    getMany: async keys => new Map(keys.map(key => [key, map.has(key) ? map.get(key)! : null])),
    setMany: async entries => { for (const [key, value] of entries) map.set(key, value) },
  }
}

const now = 1_700_000_000_000

describe('migration backups', () => {
  it('writes the expected timestamp key', async () => expect((await createBackup(memory({ a: 1 }), ['a'], 0, { now: () => now })).storageKey).toBe(`_backup_${now}`))
  it('contains requested values', async () => { const s = memory({ a: { x: 1 } }); await createBackup(s, ['a'], 0, { now: () => now }); expect((await s.get<any>(`_backup_${now}`)).data.a).toEqual({ x: 1 }) })
  it('records missing values as null', async () => { const s = memory(); await createBackup(s, ['missing'], 0, { now: () => now }); expect((await s.get<any>(`_backup_${now}`)).data.missing).toBeNull() })
  it('lists newest first', async () => { const s = memory(); await createBackup(s, [], 0, { now: () => now }); await createBackup(s, [], 0, { now: () => now + 2 }); expect((await listBackups(s))[0].timestamp).toBe(String(now + 2)) })
  it('ignores unrelated keys', async () => expect(await listBackups(memory({ other: {} }))).toEqual([]))
  it('removes old backups', async () => { const s = memory(); await createBackup(s, [], 0, { now: () => now - 100 }); expect(await pruneOldBackups(s, 50, { now: () => now })).toBe(1) })
  it('keeps recent backups', async () => { const s = memory(); await createBackup(s, [], 0, { now: () => now - 10 }); expect(await pruneOldBackups(s, 50, { now: () => now })).toBe(0) })
  it('returns removal count', async () => { const s = memory(); await createBackup(s, [], 0, { now: () => now - 100 }); await createBackup(s, [], 0, { now: () => now - 200 }); expect(await pruneOldBackups(s, 50, { now: () => now })).toBe(2) })
  it('reports fromVersion', async () => expect((await createBackup(memory(), [], 7, { now: () => now })).fromVersion).toBe(7))
  it('copies the requested keys metadata', async () => expect((await createBackup(memory(), ['a', 'b'], 0, { now: () => now })).keys).toEqual(['a', 'b']))
  it('does not overwrite same-clock backups', async () => { const s = memory(); const a = await createBackup(s, [], 0, { now: () => now }); const b = await createBackup(s, [], 0, { now: () => now }); expect(b.storageKey).not.toBe(a.storageKey) })
  it('supports custom prefixes', async () => { const s = memory(); await createBackup(s, [], 0, { now: () => now, keyPrefix: 'custom_' }); expect((await listBackups(s, { keyPrefix: 'custom_' })).length).toBe(1); expect((await listBackups(s)).length).toBe(0) })
  it('stores ISO creation time', async () => expect((await createBackup(memory(), [], 0, { now: () => now })).createdAt).toBe(new Date(now).toISOString()))
})
