import type { StorageAdapter } from '../storage/StorageAdapter'

export interface MigrationBackup {
  timestamp: string
  storageKey: string
  createdAt: string
  fromVersion: number
  keys: string[]
}

export interface BackupOptions {
  now?: () => number
  keyPrefix?: string
}

interface BackupPayload extends MigrationBackup {
  data: Record<string, unknown>
}

const defaultPrefix = '_backup_'
const defaultMaxAge = 30 * 24 * 60 * 60 * 1000

export async function createBackup(
  storage: StorageAdapter,
  keys: string[],
  fromVersion: number,
  options: BackupOptions = {},
): Promise<MigrationBackup> {
  const now = options.now ?? Date.now
  const prefix = options.keyPrefix ?? defaultPrefix
  const values = await storage.getMany(keys)
  const data: Record<string, unknown> = {}
  for (const key of keys) data[key] = values.get(key) ?? null

  let timestamp = String(now())
  let storageKey = `${prefix}${timestamp}`
  // A clock with millisecond resolution can still be reused by callers.
  while (await storage.has(storageKey)) {
    timestamp = String(Number(timestamp) + 1)
    storageKey = `${prefix}${timestamp}`
  }
  const metadata: MigrationBackup = {
    timestamp,
    storageKey,
    createdAt: new Date(Number(timestamp)).toISOString(),
    fromVersion,
    keys: [...keys],
  }
  await storage.set(storageKey, { ...metadata, data })
  return metadata
}

export async function listBackups(
  storage: StorageAdapter,
  options: BackupOptions = {},
): Promise<MigrationBackup[]> {
  const prefix = options.keyPrefix ?? defaultPrefix
  const keys = (await storage.keys()).filter(key => key.startsWith(prefix))
  const backups: MigrationBackup[] = []
  for (const storageKey of keys) {
    const value = await storage.get<Partial<BackupPayload>>(storageKey)
    if (!value || typeof value !== 'object' || typeof value.createdAt !== 'string') continue
    if (typeof value.fromVersion !== 'number' || !Array.isArray(value.keys)) continue
    backups.push({
      timestamp: typeof value.timestamp === 'string' ? value.timestamp : storageKey.slice(prefix.length),
      storageKey,
      createdAt: value.createdAt,
      fromVersion: value.fromVersion,
      keys: value.keys,
    })
  }
  return backups.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function pruneOldBackups(
  storage: StorageAdapter,
  maxAgeMs = defaultMaxAge,
  options: BackupOptions = {},
): Promise<number> {
  const now = (options.now ?? Date.now)()
  const old = (await listBackups(storage, options)).filter(backup => now - Date.parse(backup.createdAt) > maxAgeMs)
  for (const backup of old) await storage.remove(backup.storageKey)
  return old.length
}
