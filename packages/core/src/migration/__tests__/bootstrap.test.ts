import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageAdapter } from '../../storage/StorageAdapter';
import { bootstrapMigration, SCHEMA_VERSION_KEY } from '../bootstrap';
import { listBackups, type BackupPayload } from '../backup';

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

describe('Migration Bootstrap Module', () => {
  let storage: InMemoryStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
  });

  // 1. Empty storage → migrated: false, treated as v1
  it('1. Empty storage → migrated: false, treated as v1', async () => {
    const res = await bootstrapMigration(storage);

    expect(res.migrated).toBe(false);
    expect(res.fromVersion).toBe(1);
    expect(res.toVersion).toBe(1);
    expect(res.backup).toBeNull();
    expect(res.fatalError).toBeNull();
    expect(await storage.get(SCHEMA_VERSION_KEY)).toBe(1);
  });

  // 2. Legacy `checkList` present, no `_schemaVersion` → v0, migrates
  it('2. Legacy checkList present, no _schemaVersion → v0, migrates', async () => {
    await storage.set('checkList', [{ id: 'chk_1', checkNumber: '101' }]);

    const res = await bootstrapMigration(storage);

    expect(res.migrated).toBe(true);
    expect(res.fromVersion).toBe(0);
    expect(res.toVersion).toBe(1);
    expect(res.fatalError).toBeNull();
    expect(res.report.steps.length).toBeGreaterThan(0);
  });

  // 3. `_schemaVersion: 0` → migrates
  it('3. _schemaVersion: 0 → migrates', async () => {
    await storage.set(SCHEMA_VERSION_KEY, 0);
    await storage.set('checkList', [{ id: 'chk_1', checkNumber: '101' }]);

    const res = await bootstrapMigration(storage);

    expect(res.migrated).toBe(true);
    expect(res.fromVersion).toBe(0);
    expect(res.toVersion).toBe(1);
    expect(res.fatalError).toBeNull();
  });

  // 4. `_schemaVersion: 1` → no-op
  it('4. _schemaVersion: 1 → no-op', async () => {
    await storage.set(SCHEMA_VERSION_KEY, 1);
    await storage.set('checks', [{ id: 'chk_1', _schemaVersion: 1 }]);

    const res = await bootstrapMigration(storage);

    expect(res.migrated).toBe(false);
    expect(res.fromVersion).toBe(1);
    expect(res.toVersion).toBe(1);
    expect(res.backup).toBeNull();
    expect(res.report.steps.length).toBe(0);
    expect(res.fatalError).toBeNull();
  });

  // 5. After migration: v1 keys exist with `_schemaVersion: 1` per record
  it('5. After migration: v1 keys exist with _schemaVersion: 1 per record', async () => {
    await storage.set('checkList', [{ id: 'chk_1', checkNumber: '100' }]);
    await storage.set('printchecks_receipts', [{ id: 'rec_1' }]);

    const res = await bootstrapMigration(storage);
    expect(res.migrated).toBe(true);

    const checks = (await storage.get<Array<{ id: string; _schemaVersion: number }>>('checks'))!;
    expect(Array.isArray(checks)).toBe(true);
    expect(checks[0]._schemaVersion).toBe(1);
    expect(checks[0].id).toBe('chk_1');

    const receipts = (await storage.get<Array<{ id: string; _schemaVersion: number }>>('receipts'))!;
    expect(Array.isArray(receipts)).toBe(true);
    expect(receipts[0]._schemaVersion).toBe(1);
  });

  // 6. After migration: original v0 keys still exist (non-destructive)
  it('6. After migration: original v0 keys still exist (non-destructive)', async () => {
    const originalLegacy = [{ id: 'chk_legacy', checkNumber: '999' }];
    await storage.set('checkList', originalLegacy);

    await bootstrapMigration(storage);

    // v0 key still untouched
    const legacyAfter = await storage.get('checkList');
    expect(legacyAfter).toEqual(originalLegacy);
  });

  // 7. After migration: `_schemaVersion` marker set to 1
  it('7. After migration: _schemaVersion marker set to 1', async () => {
    await storage.set('checkList', [{ id: 'chk_1' }]);

    await bootstrapMigration(storage);

    const versionMarker = await storage.get(SCHEMA_VERSION_KEY);
    expect(versionMarker).toBe(1);
  });

  // 8. Backup created before migration: backup key exists
  it('8. Backup created before migration: backup key exists', async () => {
    await storage.set('checkList', [{ id: 'chk_1' }]);

    const res = await bootstrapMigration(storage, { now: () => 1234567 });

    expect(res.backup).not.toBeNull();
    expect(res.backup?.storageKey).toBe('_backup_1234567');
    expect(await storage.has('_backup_1234567')).toBe(true);
  });

  // 9. Backup content equals the source v0 data
  it('9. Backup content equals the source v0 data', async () => {
    const rawCheckList = [{ id: 'chk_1', memo: 'legacy memo' }];
    const rawVendors = [{ id: 'ven_1', name: 'Vendor 1' }];
    await storage.set('checkList', rawCheckList);
    await storage.set('vendors', rawVendors);

    const res = await bootstrapMigration(storage, { now: () => 55555 });
    const backupKey = res.backup!.storageKey;

    const backupPayload = (await storage.get<BackupPayload>(backupKey))!;
    expect(backupPayload.data['checkList']).toEqual(rawCheckList);
    expect(backupPayload.data['vendors']).toEqual(rawVendors);
  });

  // 10. Idempotency: second call → migrated: false, no new backup
  it('10. Idempotency: second call → migrated: false, no new backup', async () => {
    await storage.set('checkList', [{ id: 'chk_1' }]);

    // First call migrates
    const firstRun = await bootstrapMigration(storage, { now: () => 1000 });
    expect(firstRun.migrated).toBe(true);

    const backupsAfterFirst = await listBackups(storage);
    expect(backupsAfterFirst.length).toBe(1);

    // Second call is no-op
    const secondRun = await bootstrapMigration(storage, { now: () => 2000 });
    expect(secondRun.migrated).toBe(false);
    expect(secondRun.backup).toBeNull();
    expect(secondRun.fromVersion).toBe(1);
    expect(secondRun.toVersion).toBe(1);

    const backupsAfterSecond = await listBackups(storage);
    expect(backupsAfterSecond.length).toBe(1);
  });

  // 11. Report has startedAt, endedAt, durationMs, success
  it('11. Report has startedAt, endedAt, durationMs, success', async () => {
    await storage.set('checkList', [{ id: 'chk_1' }]);

    const res = await bootstrapMigration(storage);

    expect(res.report.startedAt).toBe(0);
    expect(res.report.endedAt).toBe(1);
    expect(typeof res.report.durationMs).toBe('number');
    expect(res.report.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.report.success).toBe(true);
  });

  // 12. report.steps reflects the executed steps
  it('12. report.steps reflects the executed steps', async () => {
    await storage.set('checkList', [
      { id: 'c1' },
      { id: 'c2' },
      'invalid-item', // will be skipped
    ]);

    const res = await bootstrapMigration(storage);

    expect(res.report.steps.length).toBe(1);
    const step = res.report.steps[0];
    expect(step.from).toBe(0);
    expect(step.to).toBe(1);
    expect(step.count).toBe(2);
    expect(step.skipped.length).toBe(1);
    expect(step.skipped[0].key).toBe('checkList[2]');
  });

  // 13. fatalError is null on happy path
  it('13. fatalError is null on happy path', async () => {
    await storage.set('checkList', [{ id: 'c1' }]);

    const res = await bootstrapMigration(storage);
    expect(res.fatalError).toBeNull();
  });

  // 14. fatalError captures a top-level failure (e.g. malformed canonical) without throwing
  it('14. fatalError captures a top-level failure without throwing', async () => {
    // A malformed canonical key that is not an array causes AppDataMigrator to throw
    await storage.set('checkList', [{ id: 'c1' }]);
    await storage.set('checks', 'not an array'); // causes MigrationError: Canonical key "checks" is not an array

    let res: unknown;
    expect(async () => {
      res = await bootstrapMigration(storage);
    }).not.toThrow();

    res = await bootstrapMigration(storage);
    const result = res as import('../bootstrap').BootstrapResult;
    expect(result.migrated).toBe(false);
    expect(result.fatalError).not.toBeNull();
    expect(result.fatalError).toContain('Canonical key "checks" is not an array');
    expect(result.report.success).toBe(false);
  });

  // 15. skipPrune option prevents pruning
  it('15. skipPrune option prevents pruning', async () => {
    const fixedNow = 100_000_000;
    const oldTime = fixedNow - 40 * 24 * 60 * 60 * 1000; // 40 days old

    // Seed an old backup directly
    await storage.set(`_backup_${oldTime}`, {
      metadata: {
        timestamp: String(oldTime),
        storageKey: `_backup_${oldTime}`,
        createdAt: new Date(oldTime).toISOString(),
        fromVersion: 0,
        keys: [],
      },
      data: {},
    });

    await storage.set('checkList', [{ id: 'c1' }]);

    await bootstrapMigration(storage, {
      now: () => fixedNow,
      skipPrune: true,
    });

    const backups = await listBackups(storage);
    const hasOld = backups.some((b) => b.timestamp === String(oldTime));
    expect(hasOld).toBe(true);
  });

  // 16. Pruning runs after migration by default
  it('16. Pruning runs after migration by default', async () => {
    const fixedNow = 100_000_000;
    const oldTime = fixedNow - 40 * 24 * 60 * 60 * 1000; // 40 days old

    await storage.set(`_backup_${oldTime}`, {
      metadata: {
        timestamp: String(oldTime),
        storageKey: `_backup_${oldTime}`,
        createdAt: new Date(oldTime).toISOString(),
        fromVersion: 0,
        keys: [],
      },
      data: {},
    });

    await storage.set('checkList', [{ id: 'c1' }]);

    await bootstrapMigration(storage, {
      now: () => fixedNow,
      skipPrune: false, // default behavior
    });

    const backups = await listBackups(storage);
    const hasOld = backups.some((b) => b.timestamp === String(oldTime));
    expect(hasOld).toBe(false);
  });

  // 17. `fromVersion` reported correctly
  it('17. fromVersion reported correctly', async () => {
    await storage.set('checkList', [{ id: 'c1' }]);

    const res = await bootstrapMigration(storage);
    expect(res.fromVersion).toBe(0);
  });

  // 18. `toVersion` equals current schema version
  it('18. toVersion equals current schema version', async () => {
    await storage.set('checkList', [{ id: 'c1' }]);

    const res = await bootstrapMigration(storage);
    expect(res.toVersion).toBe(1);
  });
});
