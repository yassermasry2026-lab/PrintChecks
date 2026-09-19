import type { StorageAdapter } from '../storage/StorageAdapter';

/**
 * Snapshot of source data taken before migration.
 */
export interface MigrationBackup {
  /** Timestamp key suffix (ms since epoch, as string). */
  timestamp: string;
  /** Storage key under which the backup is stored. */
  storageKey: string;
  /** When the backup was taken (ISO 8601). */
  createdAt: string;
  /** Original schema version of the data. */
  fromVersion: number;
  /** List of storage keys that were backed up. */
  keys: string[];
}

export interface BackupPayload {
  metadata: MigrationBackup;
  data: Record<string, unknown>;
}

export interface BackupOptions {
  /** Override current time (for testing). */
  now?: () => number;
  /** Override the storage key prefix. Default: '_backup_'. */
  keyPrefix?: string;
}

const DEFAULT_KEY_PREFIX = '_backup_';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reads the given keys from storage, packages them as a JSON blob,
 * and writes the backup to storage under `<prefix><timestamp>`.
 *
 * - Missing keys are recorded as null in the snapshot.
 * - Values are stored verbatim (using the adapter's contract).
 * - Returns metadata about the backup.
 */
export async function createBackup(
  storage: StorageAdapter,
  keys: string[],
  fromVersion: number,
  options?: BackupOptions,
): Promise<MigrationBackup> {
  const prefix = options?.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const nowMs = options?.now ? options.now() : Date.now();
  const timestamp = String(nowMs);
  const storageKey = `${prefix}${timestamp}`;
  const createdAt = new Date(nowMs).toISOString();

  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const val = await storage.get(key);
    data[key] = val;
  }

  const metadata: MigrationBackup = {
    timestamp,
    storageKey,
    createdAt,
    fromVersion,
    keys: [...keys],
  };

  const payload: BackupPayload = {
    metadata,
    data,
  };

  await storage.set(storageKey, payload);

  return metadata;
}

/**
 * Lists existing backups, newest first.
 * Only keys matching the prefix are returned.
 */
export async function listBackups(
  storage: StorageAdapter,
  options?: BackupOptions,
): Promise<MigrationBackup[]> {
  const prefix = options?.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const allKeys = await storage.keys();
  const backupKeys = allKeys.filter((k) => k.startsWith(prefix));

  const backups: MigrationBackup[] = [];

  for (const key of backupKeys) {
    const content = await storage.get<BackupPayload | MigrationBackup>(key);
    if (!content || typeof content !== 'object') {
      continue;
    }

    if ('metadata' in content && content.metadata && typeof content.metadata === 'object') {
      backups.push(content.metadata as MigrationBackup);
    } else if ('storageKey' in content && 'timestamp' in content) {
      // In case the backup stored metadata directly
      backups.push(content as MigrationBackup);
    }
  }

  // Sort newest first by timestamp (numeric descending, fallback to createdAt)
  backups.sort((a, b) => {
    const tsA = Number(a.timestamp);
    const tsB = Number(b.timestamp);
    if (!Number.isNaN(tsA) && !Number.isNaN(tsB)) {
      return tsB - tsA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return backups;
}

/**
 * Removes backups older than `maxAgeMs` (default: 30 days per ADR-005).
 * Returns the number removed.
 */
export async function pruneOldBackups(
  storage: StorageAdapter,
  maxAgeMs: number = THIRTY_DAYS_MS,
  options?: BackupOptions,
): Promise<number> {
  const nowMs = options?.now ? options.now() : Date.now();
  const backups = await listBackups(storage, options);

  let removedCount = 0;
  for (const backup of backups) {
    const backupTime = backup.timestamp ? Number(backup.timestamp) : new Date(backup.createdAt).getTime();
    const age = nowMs - backupTime;
    if (age > maxAgeMs) {
      await storage.remove(backup.storageKey);
      removedCount++;
    }
  }

  return removedCount;
}
