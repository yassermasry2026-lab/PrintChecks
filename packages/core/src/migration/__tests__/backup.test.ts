import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageAdapter } from '../../storage/StorageAdapter';
import { createBackup, listBackups, pruneOldBackups, type BackupPayload } from '../backup';

/**
 * In-memory StorageAdapter test double.
 */
class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const val = this.store.get(key);
    return val !== undefined ? (val as T) : null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async getMany<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const map = new Map<string, T | null>();
    for (const k of keys) {
      map.set(k, await this.get<T>(k));
    }
    return map;
  }

  async setMany(entries: Map<string, unknown>): Promise<void> {
    for (const [k, v] of entries.entries()) {
      await this.set(k, v);
    }
  }
}

describe('Migration Backup Module', () => {
  let storage: InMemoryStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
  });

  // 1. createBackup writes a key with the expected prefix + timestamp
  it('1. createBackup writes a key with the expected prefix + timestamp', async () => {
    const fixedNow = 1700000000000;
    const backup = await createBackup(storage, ['checkList'], 0, {
      now: () => fixedNow,
    });

    expect(backup.storageKey).toBe(`_backup_${fixedNow}`);
    expect(backup.timestamp).toBe(String(fixedNow));
    const hasKey = await storage.has(`_backup_${fixedNow}`);
    expect(hasKey).toBe(true);
  });

  // 2. The backup payload contains the requested keys
  it('2. The backup payload contains the requested keys and their values', async () => {
    await storage.set('checkList', [{ id: 'chk_1', amount: 100 }]);
    await storage.set('vendors', [{ id: 'ven_1', name: 'Acme' }]);

    const backup = await createBackup(storage, ['checkList', 'vendors'], 0);
    const stored = await storage.get<BackupPayload>(backup.storageKey);

    expect(stored).not.toBeNull();
    expect(stored?.metadata.storageKey).toBe(backup.storageKey);
    expect(stored?.data['checkList']).toEqual([{ id: 'chk_1', amount: 100 }]);
    expect(stored?.data['vendors']).toEqual([{ id: 'ven_1', name: 'Acme' }]);
  });

  // 3. Missing keys are recorded as null
  it('3. Missing keys are recorded as null', async () => {
    await storage.set('checkList', [{ id: 'chk_1' }]);
    // 'printchecks_receipts' is NOT set in storage

    const backup = await createBackup(storage, ['checkList', 'printchecks_receipts'], 0);
    const stored = await storage.get<BackupPayload>(backup.storageKey);

    expect(stored?.data['checkList']).toEqual([{ id: 'chk_1' }]);
    expect(stored?.data['printchecks_receipts']).toBeNull();
  });

  // 4. listBackups returns newest first
  it('4. listBackups returns newest first', async () => {
    await createBackup(storage, ['k1'], 0, { now: () => 1000 });
    await createBackup(storage, ['k1'], 0, { now: () => 3000 });
    await createBackup(storage, ['k1'], 0, { now: () => 2000 });

    const backups = await listBackups(storage);
    expect(backups.length).toBe(3);
    expect(backups[0].timestamp).toBe('3000');
    expect(backups[1].timestamp).toBe('2000');
    expect(backups[2].timestamp).toBe('1000');
  });

  // 5. listBackups ignores keys without the prefix
  it('5. listBackups ignores keys without the prefix', async () => {
    await storage.set('checkList', [1, 2, 3]);
    await storage.set('not_a_backup_123', { test: true });
    await createBackup(storage, ['checkList'], 0, { now: () => 5000 });

    const backups = await listBackups(storage);
    expect(backups.length).toBe(1);
    expect(backups[0].timestamp).toBe('5000');
  });

  // 6. pruneOldBackups removes backups older than maxAgeMs
  it('6. pruneOldBackups removes backups older than maxAgeMs', async () => {
    const now = 100_000_000;
    const maxAge = 10_000;

    // Older than 10_000 ms relative to now
    await createBackup(storage, ['k1'], 0, { now: () => now - 20_000 });
    // Within 10_000 ms relative to now
    await createBackup(storage, ['k1'], 0, { now: () => now - 5_000 });

    await pruneOldBackups(storage, maxAge, { now: () => now });

    const remaining = await listBackups(storage);
    expect(remaining.length).toBe(1);
    expect(remaining[0].timestamp).toBe(String(now - 5_000));
  });

  // 7. pruneOldBackups keeps backups within maxAgeMs
  it('7. pruneOldBackups keeps backups within maxAgeMs', async () => {
    const now = 200_000_000;
    const maxAge = 50_000;

    await createBackup(storage, ['k1'], 0, { now: () => now - 10_000 });
    await createBackup(storage, ['k1'], 0, { now: () => now - 20_000 });

    const removed = await pruneOldBackups(storage, maxAge, { now: () => now });
    expect(removed).toBe(0);

    const remaining = await listBackups(storage);
    expect(remaining.length).toBe(2);
  });

  // 8. pruneOldBackups returns the count removed
  it('8. pruneOldBackups returns the count removed', async () => {
    const now = 500_000_000;
    const maxAge = 1_000;

    await createBackup(storage, ['k1'], 0, { now: () => now - 10_000 });
    await createBackup(storage, ['k1'], 0, { now: () => now - 5_000 });
    await createBackup(storage, ['k1'], 0, { now: () => now - 500 }); // keeps this one

    const removed = await pruneOldBackups(storage, maxAge, { now: () => now });
    expect(removed).toBe(2);
  });

  // 9. backup metadata has correct fromVersion
  it('9. backup metadata has correct fromVersion', async () => {
    const backup0 = await createBackup(storage, ['checkList'], 0);
    expect(backup0.fromVersion).toBe(0);

    const backup1 = await createBackup(storage, ['checks'], 1);
    expect(backup1.fromVersion).toBe(1);
  });

  // 10. backup metadata keys array matches the requested keys
  it('10. backup metadata keys array matches the requested keys', async () => {
    const requestedKeys = ['checkList', 'vendors', 'custom_key'];
    const backup = await createBackup(storage, requestedKeys, 0);

    expect(backup.keys).toEqual(requestedKeys);
  });

  // 11. Multiple backups do not overwrite each other
  it('11. Multiple backups do not overwrite each other', async () => {
    const b1 = await createBackup(storage, ['k1'], 0, { now: () => 1000 });
    const b2 = await createBackup(storage, ['k2'], 0, { now: () => 2000 });

    expect(b1.storageKey).not.toBe(b2.storageKey);
    const stored1 = await storage.get<BackupPayload>(b1.storageKey);
    const stored2 = await storage.get<BackupPayload>(b2.storageKey);

    expect(stored1).not.toBeNull();
    expect(stored2).not.toBeNull();
    expect(stored1?.metadata.timestamp).toBe('1000');
    expect(stored2?.metadata.timestamp).toBe('2000');
  });

  // 12. options.keyPrefix changes the prefix in all operations
  it('12. options.keyPrefix changes the prefix in all operations', async () => {
    const customPrefix = 'custom_bak_';
    const b = await createBackup(storage, ['checkList'], 0, {
      keyPrefix: customPrefix,
      now: () => 9999,
    });

    expect(b.storageKey).toBe('custom_bak_9999');
    expect(await storage.has('custom_bak_9999')).toBe(true);

    // listBackups with custom prefix
    const customList = await listBackups(storage, { keyPrefix: customPrefix });
    expect(customList.length).toBe(1);
    expect(customList[0].storageKey).toBe('custom_bak_9999');

    // default listBackups won't see it
    const defaultList = await listBackups(storage);
    expect(defaultList.length).toBe(0);

    // pruneOldBackups with custom prefix
    const removed = await pruneOldBackups(storage, 10, {
      keyPrefix: customPrefix,
      now: () => 9999 + 100,
    });
    expect(removed).toBe(1);
    expect(await storage.has('custom_bak_9999')).toBe(false);
  });
});
