# Independent verification: standing autonomous campaign authority

Date: 2026-10-19
Repository: `/Users/nam/Documents/marketing-seeding-integration`
HEAD: `5519b80` (`integration/autonomous-build`), dirty worktree preserved
Status: DONE

## Scope and safety

Read-only inspection only. No source or canonical runtime state was edited. No
browser/ORCA command, external write, LinkedIn action, credential/session access,
or historical UNKNOWN retry was performed.

## Findings

### FACT — implementation and local proof

- `src/campaign-authorization.mjs` supports bounded `executionMode:
  "standing_autonomous"`; it requires a nonempty
  `standingAuthorizationReference`, explicit destinations, account/profile
  bindings, approved content boundary, audience, visibility, schedule, limits,
  and finite validity (maximum 90 days). Credentials/session material is not
  part of the authorization object. (`normalizeCampaignAuthorization`, lines
  78–237.)
- `src/service.mjs` activates an authorization once at the campaign boundary
  (`authorizeCampaign`, around lines 2671–2771), binds posts to the exact
  authorization fingerprint, and invokes the queue without a per-post approval.
- The autonomous queue (`queueAuthorizedCampaignJobs` /
  `queueDueCampaignJobs`, around lines 3551–3650) materializes/queues eligible
  posts, prepares one execution request, derives a one-time window, and derives
  an execution-scoped live grant for a standing authorization. Scheduler actors
  are explicitly allowlisted; operator-only grant creation remains separate.
- `ensureStandingExecutionWindow` derives a bounded window (current time to at
  most 15 minutes, clipped by authorization validity), persists it atomically,
  and rejects stale/mismatched bindings, kill/uncertainty conditions, and
  non-exactly-once windows.
- `ensureStandingExecutionGrant` requires the exact current authorization,
  queued request, active bounded window, healthy enabled account/profile, fresh
  readiness, and exact request/content/media/visibility bindings; it atomically
  binds and persists the grant. Existing active grants are revalidated rather
  than duplicated.
- `src/standing-campaign-delegation.mjs` derives a provider-neutral control plan
  only from already-issued records. It is intentionally pure and never creates
  authorization, window, grant, lease, or request records. It fails closed on
  binding drift, stale readiness, quota/cadence/concurrency, kill switch,
  duplicate/uncertain submissions, or account/profile mismatch.
- `test/standing-autonomous-delegation-proof.test.mjs` passes: **4 tests, 4
  passed, 0 failed**. The isolated proof creates one standing authorization and
  one exact LinkedIn fixture, then locally proves one request, one bounded
  one-time window, one exact live grant, and one unique lease without per-post
  approval. It also proves scheduler idempotency and interleaved binding-drift
  rejection.
- The acceptance and proof artifacts explicitly classify this as
  `LOCAL_REAL_ISOLATED_STORE`, not live platform evidence:
  `plans/autonomous-build/standing-autonomous-delegation-proof/{acceptance.md,report.md,test-results.md}`.

### INFERENCE — what is legitimately autonomous

Within an already activated, bounded standing campaign authorization, the
implemented scheduler can autonomously derive fresh exact execution controls
(window, request, grant) and the execution worker can acquire the unique lease
without a per-post human approval. This is the intended delegation boundary;
the first campaign-level authorization/activation remains a human-authorized
control-plane operation.

The implementation preserves exactly-once and UNKNOWN safety: an existing
terminal/uncertain execution, active submission uncertainty, stale binding,
expired window/grant, or changed scope blocks derivation and does not create a
second dispatch path.

### FACT — canonical runtime live state

Read-only snapshot of `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`:

- schema 8, revision 194 (as recorded by current journal); active
  campaign-authorizations/windows/grants/leases: **0 / 0 / 0 / 0**;
- all visible authorizations are terminal (`expired`, `paused`, or
  `superseded`), and their historical windows/grants are consumed or revoked;
- the only registered LinkedIn account/profile is enabled, but no fresh exact
  live campaign authorization currently covers a new execution;
- historical `SUBMIT_RESULT_UNKNOWN` executions and uncertainty records remain
  present and immutable; no published post is recorded.

### UNKNOWN / exact live input missing

A real live proof cannot be derived from the current canonical state. The
missing input is a **genuine active campaign-level standing authorization** for
one harmless fresh LinkedIn test/campaign post, with:

1. explicit authorized campaign/product and allowed LinkedIn target;
2. exact authorized account and profile identity (already registered account may
   be reused only if its readiness/session is currently fresh and healthy);
3. bounded approved content/claim or approved template and visibility;
4. active validity window, schedule, quota/cadence/concurrency, and
   `allowLiveExecution: true`;
5. campaign authorization reference/activation (human control-plane approval),
   plus a fresh readiness/session observation for the exact target/profile.

The system must not synthesize, resurrect, or revive this authority from
terminal historical records. Once that genuine authority and fresh readiness
exist, the standing queue is designed to derive the one-time window, request,
grant, and lease automatically; no per-post operator click or grant call is
required.

## Acceptance mapping

- A1–A6: **PASS locally** in the isolated proof.
- V1: **PASS** (`node --test test/standing-autonomous-delegation-proof.test.mjs`).
- V2: **PASS** exact fingerprints/scope checks exercised.
- V3: **PASS** unique lease bound to fresh execution and released.
- V4: **PASS** repeated scheduler evaluation preserves artifact counts.
- V5: **PASS** evidence is labelled `LOCAL_REAL_ISOLATED_STORE`.
- Live authorization/session and real LinkedIn publication: **NOT PROVEN**;
  blocked by absent genuine active authority/readiness, not by a demonstrated
  standing-delegation code defect.

## Minimal safe code-gap assessment

No minimal safe code change is indicated by this read-only review. Adding a
fallback that fabricates or revives live authority would violate the existing
campaign-governance and UNKNOWN immutability contracts. The next action is
operational/control-plane provisioning of genuine bounded authority plus fresh
session/readiness, followed by the already implemented queue path.
