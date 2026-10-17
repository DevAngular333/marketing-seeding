# Full System Audit — Autonomous Marketing Seeding / Distribution OS

**Audit date:** 2026-10-18
**Repository:** `marketing-seeding`  
**Audit worktree:** `/Users/nam/Documents/marketing-seeding-integration`  
**Branch:** `integration/autonomous-build`  
**Evidence rule:** source, tests, configuration and read-only runtime evidence outrank README/plan claims. Synthetic and local evidence are never treated as live platform proof.

**Release snapshot:** integration HEAD `745ce65` (`feat: gate strategy by discovery fit`) includes canonical dry-run handoff validation, read-only Mission Control projections, fail-closed Product Factory project evidence and the strategy fit gate. The canonical service remains an older deployed source revision; no deployment was performed.

## 1. What is this system?

This repository is a local marketing distribution runtime that keeps campaign, product, content, target, publication and outcome state in an auditable JSON store. A user supplies a product repository, campaign objective, target/account configuration and policy scope; the service can inspect bounded repository evidence, create grounded artifacts, stories and channel drafts, evaluate campaign authorization, and project state in a local dashboard. Its strongest implemented path is bounded execution governance: exact account/profile/target/content/visibility binding, quotas, cadence, concurrency, readiness, leases, one-time windows, single-use grants, durable submit intent, and UNKNOWN quarantine. The LinkedIn path connects JEV to a LinkedIn adapter, ORCA browser commands, semantic post-action evidence and a read-only publication verifier. Product intelligence and discovery foundations exist on the integration branch, but discovery accepts caller-supplied observations and claims remain explicit rather than autonomously researched or generated. Product factory runs are persisted as bounded campaign lineage, while the factory remains a local syntax/check runner rather than a general build/render/media system. The dashboard is a Mission Control projection, while normal operations still depend on configured policy, existing browser sessions and human handling of mandatory security challenges. This is more than a generic browser bot because campaign governance, persistence, content/artifact graph and verification contracts are first-class; it is not yet a proven unattended multi-channel Distribution OS.

**CURRENT_SYSTEM_CLASSIFICATION:** `MARKETING_AUTOMATION_TOOL`, `BROWSER_AUTOMATION_SYSTEM`, `CAMPAIGN_ORCHESTRATOR`, `AUTONOMOUS_DISTRIBUTION_RUNTIME` (bounded/local), `MARKETING_AGENT` (partial).  
**Not classified as:** `AUTONOMOUS_DISTRIBUTION_OS` in the production/live sense, because live publish and the observe → learn loop are unproven or absent.

## 2. North Star status

| Stage | Status | Evidence |
|---|---|---|
| Product/repo input | PARTIAL | Campaigns require a real `productRepo`; no upstream ProductRun contract is wired. |
| Product understanding | IMPLEMENTED, LOCAL VERIFIED | `src/product-repository-inspection.mjs` supplies bounded repository evidence to `src/product-intelligence.mjs`, which emits WHAT/PROBLEM/BETTER/AUDIENCE with evidence links. Claims remain explicit. |
| Evidence/claim verification | IMPLEMENTED, LOCAL VERIFIED | Stable hashes and unsupported claim quarantine. |
| Audience discovery | NOT_IMPLEMENTED | No autonomous audience search or matching. |
| Channel discovery | PARTIAL, LOCAL VERIFIED | `src/discovery.mjs` normalizes caller observations, deduplicates and scores by explicit keywords/policy. |
| Community rules | PARTIAL | Configured target rules/membership gates exist; no rule crawler. |
| Campaign planning | PARTIAL | Campaigns, schedules, targets, quotas and authorization exist; no outcome-driven strategy planner. |
| Channel-specific content | PARTIAL | Seeded variants, grounded stories and length/visibility guards; no production LLM/provider. |
| Asset preparation | PARTIAL, LOCAL VERIFIED | Artifact SHA-256 registration, bounded factory evidence and persistent capped run lineage; no generic media capture. |
| Existing session/auth | PARTIAL | Exact ORCA profile/session readiness and identity checks. |
| Autonomous credential login | NOT_IMPLEMENTED | Credentials are host-managed; MFA/CAPTCHA/security challenges fail closed. |
| Browser execution | PARTIAL, LOCAL VERIFIED | JEV → LinkedIn → ORCA code and synthetic execution tests. |
| Final submit | LIVE UNVERIFIED | No fresh exact live authority in canonical runtime; no live click in this audit. |
| Semantic activation | IMPLEMENTED, LOCAL VERIFIED | Separate control transition evidence; command completion is not activation. |
| Platform acceptance | IMPLEMENTED, LOCAL VERIFIED | Separate acceptance evidence and candidate checks. |
| Publication verification | IMPLEMENTED, LOCAL VERIFIED | LinkedIn feed/recent activity verifier checks permalink, author, content and time; no real candidate. |
| Campaign state | IMPLEMENTED, PARTIAL | Schema 8 state, audit, writer lease, execution receipts and dashboard. |
| Retry/resume | PARTIAL | Pre-submit bounded retry and read-only reconciliation; long-running recovery unproven. |
| Analytics/reporting | PARTIAL | Metric, interaction, reply and conversion collections/API; canonical runtime has no snapshots. |
| Learning/repeat | NOT_IMPLEMENTED | No adaptive strategy or next-best-action loop. |

## 3. Current architecture

See [architecture.md](./architecture.md) for the implementation topology and external execution sequence. The source of truth is `JsonStore` state. The Node server is the single writer. `SeedingService` owns domain mutations and projections. JEV owns exact execution dispatch and receipt reconciliation. LinkedIn owns platform semantics and verification. ORCA is an execution substrate, not the campaign state owner. System-Agentic Core was not modified.

## 4. Repository structure

```text
marketing-seeding/
├── src/
│   ├── service.mjs, store.mjs, server.mjs, cli.mjs
│   ├── campaign-authorization.mjs, guards.mjs, standing-campaign-delegation.mjs
│   ├── one-time-execution-window.mjs, live-execution-grant.mjs, submission-uncertainty.mjs
│   ├── jev-execution-worker.mjs, browser-interaction-transport.mjs, transport-certification.mjs
│   ├── orca-browser-client.mjs, linkedin-adapter.mjs, linkedin-readiness.mjs, linkedin-media.mjs
│   ├── execution-contracts.mjs, platform-registries.mjs, platform-policies.mjs
│   ├── product-intelligence.mjs, product-intelligence-runtime.mjs, product-factory.mjs, discovery.mjs
│   ├── integrations.mjs, flow-graph.mjs, readiness.mjs, service-lifecycle.mjs
│   └── fixture-worker-bridge.mjs, auto-gtm-feed.mjs
├── test/                 # 36 Node test files, isolated fixtures
├── public/               # packaged dashboard and platform assets
├── ui/src/               # dashboard source
├── docs/                 # authorization, JEV, grants, quarantine, runbook
├── campaigns/            # campaign draft material
├── scripts/              # soak and local support scripts
└── plans/                # milestone, audit and release evidence
```

Runtime state is outside Git under `/Users/nam/build-agentic-AI/.agentic/marketing-seeding` in this environment. No secret values were printed.

## 5. Campaign lifecycle

The post state machine is real and enforced by `src/constants.mjs` and `src/guards.mjs`:

```text
draft → needs_review → approved → queued → publishing → processing → published
  │          │           │          │          └→ failed / submit_result_unknown
  └──────────┴───────────┴──────────┴→ paused / blocked / rejected
submit_result_unknown → published (only verified receipt) or failed
published → paused / removed → needs_review
```

Campaign authorization adds a separate bounded control lifecycle: inactive/draft campaign → operator authorization → active scope → eligibility → readiness → execution request → one-time window + grant + lease → submit intent → receipt. Authorization pause/revoke/supersede blocks future queueing. The global kill switch increments an epoch and fences queued work.

Persistence is JSON with atomic temp-file replace, schema migration to v8, revisions, audit log and a writer lease. Execution requests, receipts, attempts, uncertainties and leases survive restart. Pre-submit failures may be bounded/retried under a new execution identity; after durable intent, `SUBMIT_SENT`, `UNKNOWN` and `CONFIRMED` are non-redispatchable. Duplicate protection uses campaign/content/platform/account/target identity and normalized-copy checks. Read-only reconciliation is allowed; blind resubmit is not.

## 6. JEV/browser architecture and safety

The implemented path is:

```text
SeedingService → JevExecutionWorker → PlatformAdapterRegistry
→ LinkedInAdapter → BrowserInteractionTransport
→ OrcaCliClient → ORCA CLI → existing ORCA profile/session → LinkedIn
```

The server composition root registers only LinkedIn readiness and adapter providers. ORCA commands are JSON subprocess calls with bounded timeout and no shell interpolation for normal commands. The LinkedIn adapter resolves one expected profile tab, verifies LinkedIn identity/feed/target/composer, binds the editor payload and PUBLIC visibility, captures a unique visible enabled submit control, checks geometry/hit target/staleness/coverage, and revalidates immediately before provider input. Before the only final click, the service commits durable `SUBMIT_SENT_INTENT`; after it, the adapter records transport, activation and acceptance evidence separately. The verifier uses a fresh read-only observation path across confirmation, feed, recent activity and videos and requires stable identity/permalink, author, content and time evidence. Browser timeout/crash after intent becomes UNKNOWN.

The transport boundary exists in `src/browser-interaction-transport.mjs`. ORCA accessibility is the current implementation; ORCA pointer sequence is an alternative implementation tested locally. `src/transport-certification.mjs` requires at least 10 resettable trials, ≥95% positive activation, zero wrong-target activations and zero silent fallbacks. The fixture achieved 10/10. Real ORCA irreversible-submit certification is not proven.

There is no clipboard/manual-copy requirement in the autonomous LinkedIn path. Existing README/runbook text still describes an older manual-submit workflow and is a documentation mismatch.

## 7. Login, auth and session

| Flow | Status | Evidence |
|---|---|---|
| Manual/authenticated existing session | MANUAL_AUTH + SESSION_REUSE | ORCA profile is selected by exact profile ID; readiness verifies session and identity. |
| Autonomous credential login | NOT_SUPPORTED | No credential broker or autonomous login implementation; raw credentials are not passed to normal LLM context. |
| MFA/CAPTCHA/device approval | HUMAN_REQUIRED | Readiness classifies challenges and fails closed; no bypass. |
| Account switching | PARTIAL | Exact platform/account/profile binding and profile collision checks; no pool selector. |
| Session expiry | PARTIAL | Readiness refresh and bounded retry; no full re-auth recovery. |
| Session isolation | PARTIAL | Profile/account binding and host-managed ORCA profiles; no secure multi-account broker. |

No password, cookie, API secret, auth token or session token is included in this audit.

## 8. Platform inventory

| Channel | Research | Content | Auth | Browser execution | Publish | Verify | Resume | Status |
|---|---|---|---|---|---|---|---|---|
| LinkedIn | caller/campaign inputs | seeded/grounded drafts | existing ORCA session | adapter + JEV code | code path, live blocked | synthetic/local verifier | local UNKNOWN reconciliation | BLOCKED |
| Threads | configured target + read-only metrics | seeded variants | not configured for publish | no adapter | no | metric API only | no publish resume | DRAFT_ONLY |
| Reddit | target/rules foundation + read-only metrics | seeded variants | no publish provider | no adapter | no | metric API only | no publish resume | DRAFT_ONLY |
| Facebook Groups | target/rules foundation + read-only metrics | seeded variants | no publish provider | no adapter | no | metric API only | no publish resume | DRAFT_ONLY |
| Product Hunt | target + read-only metrics | seeded variants | no publish provider | no adapter | no | metric API only | no publish resume | DRAFT_ONLY |
| Indie Hackers | manual target/evidence | seeded variants | manual only | no adapter | no | manual evidence contract | no publish resume | AUTH_REQUIRED / DRAFT_ONLY |
| Email opt-in | consent metadata | seeded template | manual/consent | no sender | no | evidence fields | no sender resume | AUTH_REQUIRED |

Opening a URL or having a metrics collector does not constitute platform support. Only LinkedIn has a registered production execution adapter in the current server composition root.

## 9. Content, audience and strategy

Content is mixed: hardcoded seeded R19 copy and deterministic templates exist; caller/AI-drafter can create grounded stories and channel variants; model/provider routing is absent in `src/`. Evidence grounding is real for supplied repository files and claim references. CTA, audience, language and channel length/visibility guards are stored/validated. Duplicate-content protection exists. There is no production LLM content generation, fatigue model, anti-spam classifier or adaptive content loop.

Discovery currently means known target/policy registry plus bounded observations. The integration branch adds a public HTTP observer and opt-in 15-minute campaign polling with SSRF/redirect/byte/text/time bounds, but it still does not search platform APIs, infer audience fit, match language/geography, crawl rules or discover new channels. Strategy and learning now have deterministic advisory projections and an opt-in control cycle; they do not create authority or execute actions.

## 10. Publication verification and observability

The code explicitly separates:

```text
COMMAND_COMPLETED ≠ CONTROL_ACTIVATED ≠ SUBMISSION_ACCEPTED ≠ PUBLICATION_VERIFIED
```

Execution receipts hold transport and semantic evidence, acceptance candidate data, publication references and verifier evidence. `CONFIRMED` requires matching account, target, content, media policy and stable permalink/post ID with a valid time window. Only then does the service transition the post to `published` and the request to `CONFIRMED/VERIFIED`.

The dashboard exposes health, campaign/post states, flow graph, artifacts, product intelligence/discoveries on the integration branch, metrics, interactions, replies and audit events. The canonical runtime currently has zero published posts, zero metric snapshots, zero interactions, zero replies and zero conversions. That is observed state, not missing logging.

## 11. System-Agentic AI relation

**Classification:** `D — autonomous domain subsystem with a runtime boundary intended to be orchestrated by SYSTEM_AGENTIC_AI`; currently the upstream handoff is not live, so the deployed relationship is closer to `E — hybrid/local boundary`.

| Concern | Core | Marketing/distribution | Current location |
|---|---|---|---|
| Goal ownership | provider-neutral goal composition | campaign objective and distribution policy | marketing `campaigns` |
| Orchestration | shared capability composition | campaign queue/JEV worker | marketing `src/server.mjs`, `src/jev-execution-worker.mjs` |
| Persistence | shared contract/version boundary | campaign/execution/outcome state | marketing `src/store.mjs` |
| Provider routing | generic provider-neutral contract | channel adapter registry | marketing `src/platform-registries.mjs` |
| Browser execution | external capability interface | LinkedIn adapter and ORCA binding | marketing `src/linkedin-adapter.mjs`, ORCA client |
| Login/session | generic capability references | platform account/profile/session health | marketing `src/readiness.mjs`, `src/linkedin-readiness.mjs` |
| Campaign model | upstream intent/handoff | campaign, target, post, schedule | marketing `src/service.mjs` |
| Channel adapters | generic capability contract | LinkedIn implementation | marketing `src/platform-registries.mjs`, adapter |
| Product intelligence | upstream product facts may be supplied | claim/evidence document and handoff | marketing `src/product-intelligence*.mjs` |
| Research/discovery | generic observation capability | discovery normalization/policy/score | marketing `src/discovery.mjs` |
| Publishing/verification | provider-neutral result contract | LinkedIn semantics/verifier | marketing `src/linkedin-adapter.mjs` |
| Analytics/learning | shared event/metric capability | campaign metrics and strategy loop | metrics in marketing; learning absent |

Recommendation: keep SYSTEM_AGENTIC_AI Core frozen; version the handoff and reuse domain contracts in marketing-seeding. Do not move marketing-specific policy/state into core.

## 12. Autonomy levels

| Subsystem | Level | Evidence |
|---|---|---|
| Product research | L1–L2 | Caller supplies repository/evidence; deterministic normalization helps. |
| Campaign planning | L2–L3 | Service stores objectives/schedules and bounded authority; human activates scope. |
| Channel discovery | L1 | Caller supplies observations; no autonomous crawler. |
| Content | L1–L2 | Seeded/templates and grounded drafts; no production model loop. |
| Authentication | L0–L1 | Existing session reuse; mandatory challenges are human. |
| Browser navigation/readiness | L3 local | JEV/ORCA can navigate/check a bound session in code; real run unverified. |
| Publishing | L3 local / L0 live proof | Guarded autonomous code path exists; no live acceptance evidence. |
| Verification | L3–L4 local | Independent verifier contracts and synthetic candidates; no real permalink. |
| Retry | L3 local | Bounded pre-submit retries; post-intent no retry. |
| Resume | L2–L3 | Durable state and read-only reconciliation; no 24/7 proof. |
| Reporting | L2–L3 | Dashboard and audit projections; no learning loop. |

No single autonomy score represents the whole system.

## 13. Live evidence

### LIVE REAL WEBSITE

No new live real website execution was performed in this audit. No final Post click, comment, Like, Follow, Connect, message, login/logout, credential change, publication or external campaign mutation occurred.

The canonical health endpoint was read-only and reported PID 64620, source commit `b4fa42b…`, schema 8, revision 194. Canonical SHA-256 at inspection was `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.

### SYNTHETIC / LOCAL

- 381 Node tests: 379 pass, 0 fail, 2 skip.
- Focused discovery/service/server gate: 50 pass, 0 fail, 0 skip.
- 242 focused transport/governance/JEV/LinkedIn/intelligence/factory/discovery/service tests: 242 pass, 0 fail, 0 skip.
- Local browser fixture: 10/10 reversible control activation trials, 100% rate under policy (minimum 10, ≥95%, zero wrong-target, zero silent fallback).
- Local tests cover command completion without activation, activation without acceptance, acceptance without verifiable publication, verified publication contracts, stale/moving/covered/wrong-composer controls, wrong account/profile, timeout after intent, duplicate dispatch, UNKNOWN immutability and no second final click.
- Product factory local Node fixture executed an allowlisted syntax check in temporary staging with `externalSideEffects: false`; unsafe manifest scripts remain `NOT_EXECUTED_UNSAFE`, and the run and bounded history survive a new store instance.
- Product intelligence and discovery persistence/projection tests run on temporary state only.
- Strategy fit gate focused: 36 pass, 0 fail, 0 skip; explicit mismatched/unknown fit is excluded and matched/legacy records remain compatible.

Synthetic evidence does not prove a LinkedIn post.

## 14. Failure history and controls

| Failure/incident | Root cause or observed behavior | Fixed/control now | Regression evidence |
|---|---|---|---|
| ORCA command acknowledged but no semantic activation | Transport receipt was not sufficient evidence | Separate activation observation and UNKNOWN path | Transport/LinkedIn tests |
| Stale/moving/covered submit control | UI drift and hit-target change | Immediate preflight, identity fingerprint, geometry and hit testing | LinkedIn preflight tests |
| Wrong composer/account/profile | Ambiguous DOM/session state | Exact structural ownership, profile binding and readiness identity checks | LinkedIn/readiness tests |
| Timeout/crash after submit intent | Side effect may already have happened | Durable intent, UNKNOWN quarantine, no blind retry | JEV/recovery tests |
| Duplicate dispatch | Concurrent workers or repeated identity | Lease, idempotency key, single-use grant/window | Authorization/grant/lease tests |
| Historical UNKNOWN mutation risk | Retrying uncertain execution could duplicate | Immutable quarantine and read-only reconciliation | Independent audit test + canonical state inspection |
| Manual README flow differs from autonomous source | Documentation predates JEV autonomous path | Reported as documentation debt; do not treat README as evidence | Source/runtime inspection |

## 15. Security and privacy

Runtime uses loopback HTTP, separate operator/automation/control token roles, writer lease and runtime state outside Git. New intelligence/discovery/factory paths redact credential-like material and reject unsafe URLs/paths/commands. Browser profiles and sessions remain host-managed; no raw credential broker exists. No secrets were printed in this audit. The product factory invokes only an explicit binary allowlist with `shell:false`, path containment, time/output bounds and redaction.

## 16. Production readiness and gaps

See [readiness.json](./readiness.json) and [gaps.md](./gaps.md). The material blockers are:

1. No fresh exact live authority means no safe real LinkedIn acceptance gate can run.
2. Real ORCA transport activation and irreversible submit reliability are not certified.
3. Autonomous product research, platform audience/community discovery, production content, multi-account runtime, outcome-driven learning and multi-platform publishing remain partial or absent.

## 17. Final verdict

```text
CURRENT_PRODUCT = Bounded local marketing distribution runtime with auditable campaign governance, a LinkedIn/JEV/ORCA execution contract, evidence-grounded draft foundations and a Mission Control dashboard.
CURRENT_AUTONOMY_LEVEL = L3 local bounded execution; L1–L2 for intelligence/discovery/content; L0 live publication proof.
CURRENT_PRODUCTION_READINESS = PARTIAL; blocked for irreversible live publishing certification.
CURRENT_STRONGEST_CAPABILITY = Exact campaign-to-browser safety boundary with durable submit intent, one-time grants/windows, leases, semantic evidence separation and UNKNOWN quarantine.
CURRENT_BIGGEST_BLOCKER = No fresh exact authorized LinkedIn live lane; therefore no real submit/acceptance/permalink receipt.

SYSTEM_AGENTIC_AI_RELATION = Domain subsystem intended to be orchestrated by frozen provider-neutral SYSTEM_AGENTIC_AI Core; current upstream handoff is not live.
CORE_SHOULD_BE_FROZEN = YES

AUTONOMOUS_DISTRIBUTION_OS_STATUS = FOUNDATION_ONLY
NEXT_RECOMMENDED_MILESTONE = Obtain a fresh explicitly authorized harmless LinkedIn live lane, prove one autonomous publish plus independent verification, and freeze the verified execution seam.
```

### ONE-SENTENCE SUMMARY

`marketing-seeding` is a locally verified, safety-focused campaign distribution runtime with a guarded LinkedIn/JEV/ORCA execution path and dashboard, but it remains a foundation rather than a live-proven unattended Autonomous Distribution OS.
