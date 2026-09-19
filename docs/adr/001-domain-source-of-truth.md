# ADR-001: Domain Source of Truth

- **Status**: Accepted
- **Date**: 2026-09-19
- **Deciders**: Yasser (owner), ChatGPT (architect)
- **Phase**: Gating Phase 1

## Context

The repository contains two parallel implementations of the same domain:

- `printchecks/src/types/*.ts` — legacy models that duplicate business rules.
- `packages/core/src/models/*.ts` — clean, tested domain models (core carries a
  large test suite, ~660 tests).

The application does not import `@printchecks/core` at all (0 imports in
`printchecks/src` at the time of writing). The duplication is not limited to
models: it also exists in encryption, storage, and validation.

## Decision

`@printchecks/core` becomes the single source of truth for models and business
rules.

- All business logic moves into core or depends on it.
- `printchecks/src/types/*` becomes adapter types only, or is removed.
- No duplicated model remains in the app after Phase 1.
- The app becomes a presentation shell over core.

## Consequences

**Positive**: duplication is eliminated; core's test suite now applies to the
app; there is a single reference point for reviews.

**Negative**: Phase 1 requires a migrator (`checkList` → `checks`); some app
models are wider than their core counterparts (e.g. `CustomizationSettings`);
the team must adopt a stricter boundary than it has used so far.

**Obligations**: the ESLint boundary rules (see ADR-002) block forbidden
imports; new models are added to core first, never in the app.

## Alternatives Considered

- **Keep two parallel implementations** — rejected: doubles maintenance.
- **Delete core, use the app implementation** — rejected: core is cleaner and
  better tested.
- **Merge the app into core** — rejected: mixes presentation with domain logic.
