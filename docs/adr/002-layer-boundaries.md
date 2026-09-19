# ADR-002: Layer Boundary Enforcement

- **Status**: Accepted
- **Date**: 2026-09-19
- **Phase**: Gating Phase 1

## Context

The Phase 0 audit found that views and components import
`services/secureStorage` directly (6 files under `views/**` and `components/**`)
and that `ImportExportView.vue` reaches raw `localStorage` directly as well.
Without mechanical enforcement, the rebuild will repeat these mistakes.

## Decision

Architectural boundaries are enforced mechanically via ESLint, not by
documentation alone.

1. `printchecks/src/views/**` and `printchecks/src/components/**` must not
   import `localStorage` / `sessionStorage` directly, and must not import
   `services/secureStorage` directly.
2. Storage is reachable only from `application/`, `infrastructure/`, and
   `stores/` (as façades).
3. The domain (`packages/core`) must not import Vue anywhere.
4. `application/` imports `domain/` only; the reverse is not allowed.

### Implementation

- Add `eslint-plugin-boundaries`, or custom `no-restricted-imports` rules in
  `eslint.config.mjs`.
- Add a CI job that fails on any violation.
- Add dependency-cruiser for graph checks.

## Consequences

**Positive**: boundaries are enforced automatically; reviews focus on logic
instead of policing imports; the rebuild is guarded against architectural
regression.

**Negative**: initial setup costs roughly half a day; some legacy files need
refactoring to silence ESLint (planned for Phase 1).

**Obligations**: no exceptions without a counter-ADR; failing PRs are rejected.

## Alternatives Considered

- **Human policy only** — rejected: erodes over time.
- **Restructure without enforcement** — rejected: no regression prevention.
- **Split into separate repositories** — rejected early: loses monorepo benefits.
