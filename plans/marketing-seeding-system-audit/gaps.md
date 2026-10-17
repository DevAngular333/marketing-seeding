# Current gaps and technical debt

Evidence date: 2026-10-18 at integration HEAD `745ce65`. Severity reflects the effect on the requested humanless distribution objective.

## P0

### P0-1 — No live proof of irreversible LinkedIn publication

- Classification: LIVE_PROOF_BLOCKER / external authorization gap.
- Canonical runtime has zero active exact LIVE campaign authorizations, one-time windows, live grants and leases.
- No new execution ID, durable submit intent, autonomous final click, platform acceptance, permalink or real `PUBLISHED` receipt can be created safely.
- Existing UNKNOWN executions are immutable and cannot be retried.

### P0-2 — ORCA irreversible-submit transport is not certified by real activation evidence

- The provider-neutral transport boundary and local fixture harness exist.
- Ten local reversible fixture trials passed at 100% activation under the documented policy.
- Historical safe ORCA calibration observed command completion but did not provide repeatable positive activation for every safe control.
- ORCA is therefore not certified for an irreversible final submit on real LinkedIn.

## P1

- Product understanding now has a bounded repository inspection path, but the resulting claims remain explicit/caller supplied; it does not autonomously research or generate claims with a model.
- Product factory persists bounded run lineage and hashes, but remains a fail-closed staged syntax/check runner. It does not execute arbitrary project builds, capture screenshots/GIF/video, or verify generated media.
- Discovery accepts caller-supplied observations. There is no continuous public crawler, audience matcher, channel searcher or community-rule crawler.
- Strategy and next-best-action selection are not implemented. Schedules and deterministic drafts do not form a feedback-driven strategy engine.
- Content is seeded/template/caller supplied. There is no production LLM provider, platform-context model routing, content-fatigue loop or claim-safe generation service.
- Only LinkedIn has a production adapter/readiness provider in the server composition root. Facebook, Threads, Reddit, Product Hunt and Indie Hackers are not publishing adapters.
- Account/session runtime supports exact account/profile binding and existing session reuse, but not a secure multi-account pool, credential broker or automated recovery.
- Metrics collectors and browser observation contracts exist, but the canonical runtime has zero metric snapshots, interactions, replies and conversions.
- Learning/adaptation is not implemented.
- Restart, browser crash, network outage and long-duration 24/7 recovery have local foundations but no production soak proof.

## P2

- The integration branch product intelligence, discovery and product factory routes are not deployed to the inspected canonical server.
- Dashboard exposes state and evidence projections but not a complete strategy/NBA/learning timeline.
- Most domain operations remain HTTP/service methods; the CLI has only `init`, `bootstrap-r19`, `status` and `export`.
- Observability has audit events, execution IDs and receipts but lacks broad traces, a durable cross-phase timeline and live publication evidence in the canonical runtime.
- The transport certification record is not persisted as a runtime certification registry; selection is deterministic when records are supplied.

## P3

- README/runbook still describes manual final platform submit and manual permalink recording, while the current source contains a guarded autonomous JEV path. The documentation should be synchronized after the live contract is proven.
- The service module is large and owns many domain concerns; future extraction should preserve the existing store and contracts.
- Hardcoded LinkedIn DOM expressions and R19 seeded copy are intentionally bounded but require maintenance when platform UI or product scope changes.
- Product factory command allowlist is deliberately narrow and currently only demonstrates syntax checks for Node/Python/static repositories.
- `BrowserInteractionTransport` has an explicit validation contract, but transport conformance is still partly duck-typed and certification metadata is caller supplied.

## Technical debt map

| Debt | Evidence | Risk |
|---|---|---|
| Hardcoded platform DOM selectors/expressions | `src/linkedin-readiness.mjs`, `src/linkedin-adapter.mjs` | UI drift can stop or misclassify execution; fail-closed behavior limits unsafe action |
| Monolithic service | `src/service.mjs` contains campaign, content, metrics, dashboard and runtime methods | Coupling and slower change review |
| Legacy/manual documentation | `README.md`, `docs/OPERATOR-RUNBOOK.md` versus JEV source | Operator misunderstanding of verified capability |
| Caller-driven intelligence/discovery | `src/product-intelligence.mjs`, `src/discovery.mjs` | No autonomous research or ranking quality proof |
| Factory runtime is bounded | `runProductFactory()` persists only a capped run history | No generic build/render/media artifact workflow |
| Registry versus metrics split | adapter registry only registers LinkedIn; `integrations.mjs` has read-only metric collectors | Platform readiness can be confused with metric availability |
| No model/provider boundary in domain runtime | no LLM provider module in `src/` | Content and strategy cannot autonomously adapt |
| Canonical runtime/source skew | `/health` reports source commit `b4fa42b…`; integration branch is later | New local capability is not live until a controlled release |

## What should not be built again

Freeze and reuse:

- `JsonStore`, schema migration, atomic write, writer lease and audit log.
- Existing campaign authorization, quotas, cadence, concurrency and exact binding contracts.
- One-time execution windows, live grants, execution leases and kill epoch fencing.
- `JevExecutionWorker`, platform registries and the LinkedIn adapter/verifier seam.
- Browser transport boundary and separate transport/activation/acceptance/publication evidence.
- UNKNOWN quarantine and read-only reconciliation semantics.
- Artifact/story/draft graph and current dashboard/flow graph foundations.
- Local product intelligence, versioned handoff, discovery normalization and factory safety seams.

Do not add another campaign store, provider router, browser abstraction, LinkedIn publisher or generic state machine unless an independent defect proves the existing contract cannot satisfy the next acceptance gate.
