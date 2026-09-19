# ADR-005: Migration & Schema Versioning

- **Status**: Accepted
- **Date**: 2026-09-19
- **Phase**: Gating Phase 1

## Context

- The app stores data under `checkList`, `printchecks_receipts`, and similar
  keys.
- Core expects `checks`, `bankAccounts`, and similar keys.
- No `schemaVersion` exists in either shape.
- `ImportExportView` replaces data wholesale with no automatic backup, which
  creates a data-loss risk.

## Decision

Schema versioning is mandatory, together with a unified migrator and an
automatic backup before any bulk write.

1. Every stored object carries `_schemaVersion` at the root.
2. A Schema Version Registry lives in
   `packages/core/src/migration/registry.ts`:
   - `v0` = legacy app shape (`checkList`)
   - `v1` = core canonical shape (`checks`, `bankAccounts`, ...)
3. `AppDataMigrator` converts `v0` → `v1` on first run.
4. Migration must be idempotent, reversible where possible, and report-rich.
5. Before any bulk write (import, migrate, reset), an automatic backup is taken
   under `_backup_<timestamp>`.
6. Old data is not deleted for 30 days after migration, or until the user
   requests it.

## Consequences

**Positive**: no user loses data in the transition; every future schema change
has a defined path; rollback is possible.

**Negative**: Phase 1 grows by roughly three days for the migrator and its
tests; backups consume localStorage quota (browsers typically allow ~5MB), so
size must be verified.

**Obligations**: any PR that changes a stored shape must bump `_schemaVersion`
and add a migration step. The migrator carries 30+ tests (round-trip, partial
failure, corruption handling).

## Alternatives Considered

- **No migration, fresh start** — rejected: loses user data.
- **Manual migration with an external tool** — rejected: error-prone.
- **Optional versioning** — rejected: ignored in practice.
