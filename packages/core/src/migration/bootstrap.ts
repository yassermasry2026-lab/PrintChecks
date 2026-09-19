import type { StorageAdapter } from '../storage/StorageAdapter'
import { AppDataMigrator } from './AppDataMigrator'
import { createBackup, pruneOldBackups, type MigrationBackup } from './backup'
import { getSchema } from './registry'
import { SchemaVersions, type MigrationReport } from './types'

export interface BootstrapResult {
  migrated: boolean
  fromVersion: number
  toVersion: number
  report: MigrationReport
  backup: MigrationBackup | null
  fatalError: string | null
}

export interface BootstrapOptions {
  now?: () => number
  skipPrune?: boolean
}

const versionKey = '_schemaVersion'
const v0Keys = getSchema(SchemaVersions.LEGACY_APP)!.keys
const v1Keys = getSchema(SchemaVersions.CORE_V1)!.keys

function emptyReport(version: number): MigrationReport {
  return { startedAt: version, endedAt: version, steps: [], durationMs: 0, success: true }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function bootstrapMigration(
  storage: StorageAdapter,
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  let fromVersion: number = SchemaVersions.CORE_V1
  let report = emptyReport(fromVersion)
  let backup: MigrationBackup | null = null
  try {
    const marker = await storage.get<unknown>(versionKey)
    const keys = await storage.keys()
    const hasLegacy = v0Keys.some(key => keys.includes(key))
    const hasV1 = v1Keys.some(key => keys.includes(key))
    if (typeof marker === 'number' && Number.isInteger(marker)) fromVersion = marker
    else if (hasLegacy) fromVersion = SchemaVersions.LEGACY_APP
    else if (hasV1) fromVersion = SchemaVersions.CORE_V1
    else {
      // Fresh installs are current, but persist the explicit marker for future boots.
      await storage.set(versionKey, SchemaVersions.CORE_V1)
      if (!options.skipPrune) await pruneOldBackups(storage, undefined, { now: options.now })
      return { migrated: false, fromVersion, toVersion: SchemaVersions.CORE_V1, report, backup, fatalError: null }
    }

    const source: Record<string, unknown> = {}
    for (const key of keys) {
      if (!key.startsWith('_backup_') && key !== versionKey) source[key] = await storage.get(key)
    }
    const migrator = new AppDataMigrator()
    const target = migrator.getTargetVersion()
    if (fromVersion === target) {
      const result = migrator.migrate({ from: fromVersion, source })
      report = result.report
      await storage.set(versionKey, target)
      if (!options.skipPrune) await pruneOldBackups(storage, undefined, { now: options.now })
      return { migrated: false, fromVersion, toVersion: target, report, backup, fatalError: null }
    }

    const sourceKeys = keys.filter(key => key !== versionKey && !key.startsWith('_backup_'))
    // This is deliberately the first write in the migration path.
    backup = await createBackup(storage, sourceKeys, fromVersion, { now: options.now })
    const result = migrator.migrate({ from: fromVersion, source })
    report = result.report
    const entries = new Map<string, unknown>(Object.entries(result.data))
    await storage.setMany(entries)
    await storage.set(versionKey, target)
    if (!options.skipPrune) await pruneOldBackups(storage, undefined, { now: options.now })
    return { migrated: true, fromVersion, toVersion: target, report, backup, fatalError: null }
  } catch (error) {
    return {
      migrated: false,
      fromVersion,
      toVersion: SchemaVersions.CORE_V1,
      report: { ...report, success: false },
      backup,
      fatalError: errorMessage(error),
    }
  }
}
