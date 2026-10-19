# Read-only audit: fresh standing authorization inputs

Date: 2026-10-19
Repository: `/Users/nam/Documents/marketing-seeding-integration`
Status: DONE

## Conclusion

The current user instruction establishes the product direction and permits
ordinary engineering work, but it does not provide a concrete fresh campaign
authorization payload that can safely be activated for a live LinkedIn
execution. Existing runtime records identify a LinkedIn account/profile and
several historical campaigns, but all corresponding authorizations are
terminal and the associated posts are either `submit_result_unknown` (immutable
and non-retryable) or blocked. No fresh execution may inherit or revive those
records.

## FACT: existing exact reusable infrastructure

- `SeedingService.authorizeCampaign(campaignId, input, actor)` is the only
  campaign-level activation path. It normalizes and validates the complete
  bounded authorization, verifies target/account/profile identity, verifies
  approved assets and claim source hashes, supersedes prior active authority,
  binds posts, and invokes the autonomous queue.
- `normalizeCampaignAuthorization` requires: `validFrom`, `validUntil`
  (increasing, <=90 days), explicit unique `destinations` (platform,
  accountId, targetId, profileId), bounded `contentBoundary`, explicit
  `audienceRules.allowedAudiences`, schedule timezone/weekdays/local times,
  positive quota/cadence/concurrency limits, `executionMode`, and (for
  `standing_autonomous`) nonempty `standingAuthorizationReference`.
  `allowLiveExecution` must be explicitly true for live delegation.
- `authorizeCampaign` performs exact target URL/profile checks against the
  registered account. It does not consume credentials or session material.
- After activation, the existing queue autonomously derives the request,
  bounded one-time window, execution-scoped grant, and lease. No per-post
  operator call is needed. This is covered by the focused standing proof
  (`node --test test/standing-autonomous-delegation-proof.test.mjs`, 4/4
  passed).

## FACT: canonical runtime inputs currently present

Read-only state inspection found:

- one enabled healthy registered LinkedIn account `linkedin_primary` and one
  exact profile/target (`f38f2074-7d87-4cb6-8313-8e1b73e2c3fd`, profile
  `b27a3bcc-b139-4353-a15b-10e10824291e`);
- target URL is `https://www.linkedin.com/feed/`;
- target readiness evidence is historical and expired (checked
  `2026-10-17T06:01:46.590Z`, five-minute expiry);
- campaigns contain objectives/audiences and historical copy/artifact hashes,
  but no current active authorization;
- campaign authorizations are `expired`, `paused`, or `superseded`; active
  authorization/window/grant/lease counts are `0/0/0/0`;
- historical posts include four `submit_result_unknown` executions and two
  blocked posts. Unknown executions and their uncertainty records are protected
  from retry or mutation.

## UNKNOWN / missing exact fields

To activate a new standing autonomous authorization without inventing scope,
the control plane must supply or explicitly select all of the following:

1. **Campaign**: exact campaign ID/product scope to authorize. Existing campaign
   objectives alone do not grant live authority.
2. **Action and destination**: explicit LinkedIn target ID (and exact account +
   profile identity), and confirmation that the action is one harmless new
   public post. Existing target/account records are usable as selectors, not as
   proof of fresh authority.
3. **Fresh content identity**: exact new post text or approved template/claim
   set, its content hash, audience, and publication visibility. Reusing any
   historical unknown post content/idempotency identity is prohibited. If
   media is used, a verified artifact ID plus SHA-256 and current source match
   are required.
4. **Authority bounds**: `allowLiveExecution: true`,
   `executionMode: "standing_autonomous"`, non-secret
   `standingAuthorizationReference`, valid-from/until window, timezone and
   weekday/time schedule, max jobs per account/campaign/day, minimum interval,
   and concurrency.
5. **Content/evidence policy**: approved copy set hash or an approved template
   set with source-bound claims; explicit allowed audience(s), visibility, and
   forbidden/required disclosure rules where applicable.
6. **Fresh readiness/session**: a new readiness observation for the exact
   LinkedIn account/profile/target within the configured TTL. This is runtime
   evidence, not a value that can be inferred from the expired state record.
7. **Activation identity**: the human/control-plane actor and authorization
   reference that activate the bounded authority. A scheduler may derive
   execution controls only after this record is active; it may not fabricate
   the parent authority.

## Safe derivation path once inputs exist

1. Control plane calls `authorizeCampaign` with the exact fields above on a
   fresh campaign/content identity (never an UNKNOWN post).
2. Authorization activation persists a fingerprint-bound active record and
   queues only posts within its scope.
3. Queue/readiness tick verifies fresh session and exact account/profile/target,
   then `prepareExecutionRequest` → `ensureStandingExecutionWindow` →
   `ensureStandingExecutionGrant`.
4. Worker acquires the unique lease and proceeds through existing transport,
   activation, acceptance, and independent publication verification gates.
5. Any post-submit uncertainty remains quarantined as `SUBMIT_RESULT_UNKNOWN`;
   no blind retry or authority revival occurs.

## INFERENCE

The requested autonomous behavior is technically available after a genuine
campaign-level authority activation. The current instruction does not identify
an exact new campaign/content/visibility/window payload, and historical records
cannot be treated as standing consent. Therefore a fresh live authorization
cannot be legitimately derived from current state alone.

## Minimal code-gap assessment

None identified. Adding defaults for destination, content, visibility, validity,
or `allowLiveExecution`, or auto-reviving terminal records would weaken exact
scope and safety semantics. The blocker is missing control-plane inputs plus
fresh readiness, not a demonstrated service defect.

## Verification

- Focused proof: `node --test test/standing-autonomous-delegation-proof.test.mjs`
  → 4 passed, 0 failed.
- Canonical state read-only inspection; no state write, browser action, ORCA
  command, external side effect, credential/session access, or UNKNOWN retry.
