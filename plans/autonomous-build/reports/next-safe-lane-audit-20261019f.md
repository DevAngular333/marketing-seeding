# Next safe lane audit — 2026-10-19

## Scope

Read-only audit at integration HEAD after commits `89621bd`, `0f6d815`, and
`a3052ee`. No source, canonical state, browser, credentials, ORCA runtime, or
external platform was touched.

## Recommended lane

### Mission Control strategy and learning history (read-only UI)

The backend already persists and projects bounded advisory strategy/learning
history:

- `SeedingService.dashboard()` in `src/service.mjs` returns `strategy[]` and
  `learning[]` rows with `latest`, `recent`, `updatedAt`.
- `src/strategy.mjs` emits deterministic actions (`publish`, `engage`,
  `research`, `wait`, `do_nothing`) with bounded reasons, evidence refs,
  decision IDs and optional learning context.
- `src/learning.mjs` emits bounded feedback with observation, evidence,
  outcome summary reference, post attribution/metric assessment context, and
  fail-closed UNKNOWN handling.

`MissionControlPanel` in `ui/src/App.tsx` currently displays only the latest
strategy action/reasons and latest learning action/reasons (around lines
1085–1210). It does not show recent decisions, evidence references, outcome
links, or when the advisory recommendation changed. This prevents the required
dashboard role from answering “what did AI do recently?” and “what changed in
strategy?”

## Exact implementation boundary

Primary file: `ui/src/App.tsx`, `MissionControlPanel`.

Render only existing read-only fields from `data.strategy` and `data.learning`:

- campaign reference (already in row);
- latest and recent action;
- decision/feedback timestamp;
- bounded reason codes;
- bounded evidence references;
- outcome summary reference and bounded observation/metric assessment labels.

Use a maximum of five recent rows per campaign/type. Fingerprinted refs may be
shown as refs; do not render raw account/profile IDs, URLs, credentials, post
content, or unrestricted evidence text.

## Acceptance criteria

- Show at most five recent strategy decisions and five recent learning records
  in Mission Control, deterministically ordered by timestamp.
- Display action, timestamp, bounded reasons, and evidence/reference IDs; show
  `UNKNOWN` when no record exists.
- Display learning outcome/metric assessment labels only when present; preserve
  `UNKNOWN`, `PARTIAL`, and quarantine signals without inferring success.
- Keep the section explicitly read-only/advisory. Add no buttons, links,
  approval controls, authority derivation, account selection, browser calls,
  provider calls, or state mutations.
- Do not alter existing latest-action cards or execution safety messaging.
- UI TypeScript check and production build pass; full Node suite remains
  unchanged and passing.

## Safety and value

**SAFE TO IMPLEMENT** as a UI-only projection. It reuses persisted advisory
records and advances the Product Definition of Done requirements to expose
recent AI decisions, reasoning, evidence, and strategy changes. It does not
change authority, execution, UNKNOWN immutability, metrics collection, or
external side effects.

## Risk

Low. The main risk is displaying unbounded or sensitive evidence. Enforce
row/text/reference caps and allowlist fields; never render raw evidence body,
account/profile identity, credentials, or browser data.

## Explicitly out of scope

- adaptive strategy execution or outcome-driven authority changes;
- model/provider integration;
- live metrics or publication proof;
- account failover, crawler, reply adapter, or transport changes.
