# Next Dependency-Independent Product Definition of Done Lane

**Date:** 2026-10-19
**Branch inspected:** `integration/autonomous-build`
**HEAD inspected:** `4115a73`
**Evidence class:** read-only source, test, and journal inspection. No source edit, browser/ORCA action, network write, canonical runtime mutation, credential access, or social action.

## Unverified first

- No live LinkedIn publication, reply/comment execution, platform acceptance, or independent external verification is proven.
- No autonomous conversation crawler or platform-specific engagement adapter exists.
- No account/session failover or selector has been exercised against a real browser profile.
- No live metric or outcome signal exists in the canonical runtime.

## Recommended lane

### Deterministic conversation-context and engagement-candidate projection (read-only)

Add a bounded read model over the existing `interactions` and `replies` collections that groups each interaction with its post, campaign, target/channel, prior replies, and current status, then emits a deterministic engagement candidate with explicit fail-closed reasons. This should prepare Mission Control and a future platform adapter without sending a reply or changing campaign authority.

This is the safest next lane after authorized-account candidate projection: it advances the Product Definition of Done requirement to track conversations and choose contextual engagement while the live publish/verification lane remains externally blocked. It uses existing persistence and strategy contracts instead of creating a second conversation store or execution state machine.

## What already exists (FACT)

- `src/store.mjs` persists `interactions` and `replies` in schema 8 collections.
- `SeedingService.addInteraction` in `src/service.mjs` deduplicates stable `externalId` values per post and preserves no-ID observations as separate rows.
- `SeedingService.draftReply` reads and hashes grounding files inside the campaign repository; it rejects missing or outside-repository sources.
- `SeedingService.approveReply` and `markReplySent` enforce the current reply state transitions and require send evidence. `src/guards.mjs:140` (`assertReplyCanSend`) keeps reply sending approval-gated by channel policy.
- `src/strategy.mjs` can select an advisory `engage` action only when a relevant discovery and a grounded draft/approved reply exist. It does not dispatch a reply.
- `src/server.mjs` exposes interaction, reply-draft, approve, and sent mutation routes; there is no read-only grouped conversation endpoint.
- `src/service.mjs:5142-5185` exposes only aggregate open/pending counts and flat bounded `recentInteractions`/`recentReplies` dashboard arrays.
- `src/flow-graph.mjs` links `post -> interaction -> reply`, but does not calculate thread continuity, candidate eligibility, or platform/action safety reasons.
- Existing tests cover grounding, stable-ID idempotence, strategy engagement selection, dashboard arrays, and state transitions (`test/service.test.mjs`, `test/strategy.test.mjs`, `test/flow-graph.test.mjs`).

## What is missing (FACT)

- No deterministic conversation/thread projection keyed by post plus external conversation identity.
- No bounded history/continuation context that distinguishes open, replied, duplicate, stale, or already-sent interactions.
- No explicit candidate reason codes for missing external identity, unsupported channel, stale readiness, reply already sent, missing grounding, or unknown publication state.
- No read-only dashboard projection that lets an observer understand why a conversation is or is not an engagement candidate.
- No platform adapter, transport call, reply publication verifier, or independent reply permalink evidence. Enabling autonomous sends now would cross an unproven external execution seam.

## Proposed scope and ownership

**Primary paths:**

- New pure projection module, preferably `src/engagement-context.mjs`, or a narrowly scoped helper in the existing service read model if that is the established convention.
- `src/service.mjs` dashboard/read-only projection integration.
- Focused tests in `test/engagement-context.test.mjs` and/or existing service/strategy tests.
- `plans/autonomous-build/conversation-context-projection/` journal artifacts.

**Reuse:** `JsonStore`, schema 8 `interactions`/`replies`, existing target/channel policy registry, publication/UNKNOWN checks, product-repository grounding hashes, and existing bounded dashboard projection.

**Do not change:** LinkedIn/JEV/ORCA transport, campaign authorization, grants/windows/leases, post target binding, `markReplySent` semantics, `UNKNOWN` quarantine, `SYSTEM_AGENTIC_AI` Core, or external adapters.

## Acceptance criteria

- **A1** For a campaign, produce a deterministic bounded list of conversation rows by joining interactions to their post, target, channel, and replies; ordering is stable under restart and equivalent input state.
- **A2** Preserve stable-ID deduplication and no-ID observation semantics. Never merge interactions across posts, campaigns, targets, accounts, or profiles.
- **A3** Derive explicit status/candidate reason codes, at minimum: `OPEN_GROUNDED_REPLY`, `ALREADY_REPLIED`, `MISSING_EXTERNAL_ID`, `MISSING_GROUNDING`, `UNKNOWN_POST_QUARANTINED`, `UNSUPPORTED_CHANNEL`, and `STALE_OR_MISSING_READINESS` where applicable.
- **A4** Candidate eligibility is advisory only. It cannot create or alter posts, execution requests, authorization, windows, grants, leases, receipts, publication evidence, account selection, or reply state.
- **A5** A conversation linked to any `UNKNOWN` publication remains non-actionable and is visibly quarantined; no retry or second external action is introduced.
- **A6** Projection output is bounded, redacted, and secret-safe: no credentials, cookies, tokens, raw browser profile material, or unrestricted external text/evidence dumps.
- **A7** Expose the projection through the existing read-only dashboard/read model (or an equivalent GET-only route) with no new approval or send control.
- **A8** Tests cover duplicate external IDs, no-ID observations, multiple replies, already-sent replies, missing grounding, cross-post isolation, UNKNOWN quarantine, deterministic ordering, restart equality, and zero authority/execution side effects.
- **A9** Existing focused browser/JEV/LinkedIn/authorization tests and the full Node suite continue to pass with no new failures; canonical runtime revision/hash and historical UNKNOWN rows remain unchanged.

## Safety and dependency impact

This lane is **LOCAL_REAL / SYNTHETIC read-model work**. It does not unblock the external live authorization blocker or ORCA irreversible-submit certification by itself. It is intentionally upstream of any future engagement adapter: a later platform-specific send milestone must separately prove exact account/profile/target/content authority, durable intent, semantic activation, acceptance, independent reply discovery, and idempotent UNKNOWN handling.

It is dependency-independent from Product Factory sandbox execution and live metrics. It also provides the evidence shape needed for future contextual engagement and learning without allowing advisory strategy to mutate authority.

## Status classification

- Existing interaction/reply persistence and grounded drafting: **IMPLEMENTED, LOCAL-VERIFIED**.
- Existing advisory `engage` strategy decision: **IMPLEMENTED, LOCAL-VERIFIED**.
- Grouped conversation continuity and read-only candidate projection: **NOT_IMPLEMENTED** (recommended next implementation).
- Autonomous contextual reply execution and independent reply verification: **DESIGN_ONLY / BLOCKED** pending certified platform/account execution seams.

**Status: DONE**

**Classification:** FACT = source/tests/journals inspected above. UNVERIFIED = all live platform, browser, account, publication, reply execution, and metric claims listed in the first section.
