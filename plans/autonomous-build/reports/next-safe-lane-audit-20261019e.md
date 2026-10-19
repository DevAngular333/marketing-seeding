# Next safe lane audit — 2026-10-19

## Scope

Read-only audit at integration HEAD `c2e084a` after Mission Control
engagement detail. No source, canonical state, browser, credentials, ORCA
runtime, or external platform was touched.

## Recommended lane

### Expose channel capability readiness in the existing Platforms page

The backend already produces a bounded, deterministic, read-only
`channelCapabilities` projection in `src/channel-capability-projection.mjs`
(`projectChannelCapabilities`) and includes it in `SeedingService.dashboard()`
(`src/service.mjs`, around the dashboard projection assembly). It reports:

- channel and label;
- `READY`, `NEEDS_TARGET`, `RULES_REVIEW_REQUIRED`, `AUTH_REQUIRED`, or
  `BLOCKED` status;
- bounded reason;
- target counts and fresh-ready target count;
- policy flags and post count;
- `advisory`, `authoritySideEffects: false`, and
  `externalSideEffects: false` markers.

`ui/src/App.tsx` currently shows only aggregate channel readiness in Mission
Control. `ui/src/Pages.tsx` `PlatformsPage` still derives its table from
`channelStats(data)` and per-target readiness; it does not show the channel
capability reason or fresh-ready target count. An observer can therefore see a
platform row but not why it is `AUTH_REQUIRED`, needs rules review, or has no
target.

## Exact implementation boundary

Primary file: `ui/src/Pages.tsx`, `PlatformsPage` around lines 1842–1948.

Reuse `data.channelCapabilities` already returned by the API. Add a bounded
read-only capability summary/table or status detail alongside the existing
platform statistics. Do not replace existing platform/post metrics.

Allowed fields:

- `channel`, `label`, `status`, `reason`;
- `targetCount`, `activeTargetCount`, `freshReadyTargetCount`, `postCount`;
- `requiresRulesReview`, `requiresHumanApproval`.

No raw URLs, profile IDs, account IDs, credentials, selectors, or browser
material should be rendered from this projection.

## Acceptance criteria

- Render at most 64 channel capability rows (matching backend cap), sorted by
  existing deterministic channel order.
- Show status and bounded reason for every configured channel, including
  `NEEDS_TARGET`, `RULES_REVIEW_REQUIRED`, `AUTH_REQUIRED`, and `BLOCKED`.
- Show target count and fresh-ready target count separately; do not infer
  publication support from a URL or platform label.
- Keep the page read-only: no connect, approval, account selection, retry,
  browser, or publish action is added.
- If the projection is absent, show `UNKNOWN`/empty state rather than deriving
  capability from target URLs or old readiness fields.
- Preserve existing platform statistics, links, and community directory.
- `cd ui && npm exec tsc -- --noEmit` and `cd ui && npm run build` pass; full
  Node suite remains unchanged and passing.

## Safety and value

**SAFE TO IMPLEMENT.** This is a UI-only read-model projection over already
persisted/derived data. It advances the Product Definition of Done's
OBSERVE/UNDERSTAND requirement for channel readiness and explains blockers
without creating authority or altering execution. It does not unblock live
LinkedIn publication, which still requires fresh exact external authority and
irreversible transport/publication proof.

## Risk

Low. Main risk is accidentally conflating capability status with platform
support or target readiness. Keep the capability status/reason text explicit,
retain the advisory label, and avoid action controls or inferred support.

## Explicitly out of scope

- platform search/crawler or community-rule discovery;
- new channel adapters or publication execution;
- account/session selection or failover;
- changes to authority, grants/windows/leases, transport, UNKNOWN quarantine,
  metrics collection, or canonical state.
