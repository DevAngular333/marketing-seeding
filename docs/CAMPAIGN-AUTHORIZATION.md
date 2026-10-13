# Campaign authorization

## Purpose and boundary

Campaign authorization is the canonical pre-authorization for future child distribution jobs. It removes routine per-post approval only inside an explicit, expiring campaign scope. It does not create a platform publisher or bypass runtime readiness, account authentication, platform rules, rate limits, or duplicate protection.

## Canonical state

`state.json` is schema version 3. `campaignAuthorizations[]` is the source of truth; the campaign record and dashboard are projections. State v1/v2 migration adds an empty authorization collection and preserves existing records. Migration does not infer or grant campaign permission.

An authorization records:

- `campaignId`, `id`, `status`, `approvedAt`, `approvedBy`, `activatedAt`;
- `platforms` and exact `destinations[]` (`platform`, `accountId`, `targetId`, optional profile reference, captured target URL);
- exact approved assets (`artifactId`, SHA-256);
- content boundary (`approved_copy_set` hashes of exact approved variants, or `approved_template_set` fixed templates filled only with source-bound approved claim text and required disclosures);
- allowed audience labels;
- timezone, weekdays, local time window, `validFrom`, `validUntil`;
- daily campaign/account limits, minimum interval and maximum in-flight concurrency;
- a scope fingerprint. Campaign scope changes invalidate the binding and pause the authorization.

An operator uses `POST /api/campaigns/{campaignId}/authorization` with the operator bearer token to create and activate this scope. Authorization, pause, resume, and revoke are operator-only. The automation token cannot expand authorization; it can request readiness reevaluation through `POST /api/campaigns/{campaignId}/queue-ready-jobs`. Authorization is explicit and does not silently activate existing standing approvals. Compute exact copy hashes with `campaignContentHash(content)` exported by `src/campaign-authorization.mjs`; it hashes the JSON string representation with SHA-256.

For generated variants, use `approved_template_set`: approved template text may contain only literal text, `{{claim:<claim-id>}}`, and `{{disclosure}}` placeholders. Each claim must have a stable ID and repository source references. A child job must provide the matching `templateId`, the exact rendered content, its referenced `claimIds`, and all source references. The guard renders the approved template and compares the entire content byte-for-byte, so extra generated wording blocks.

## Eligibility and child jobs

An active authorization attaches to matching child jobs. Eligible jobs inherit `campaignAuthorizationId` and the immutable binding, then pass through `CREATED → AUTHORIZED → READY → QUEUED`. A failed check stores `BLOCKED` and its reasons on only that job. The queue-ready API re-evaluates blocked/draft authorized jobs after readiness changes; it does not touch publishing jobs. When a target readiness update arrives, affected blocked jobs are re-evaluated in that same state mutation. The local server checks due scheduled jobs and expires elapsed authorizations every 30 seconds; scheduled reevaluation is limited to jobs previously blocked as `schedule_not_due`.

Authorization requires exact destination identity; campaign activity; valid authorization dates and binding; approved media identity/hash; approved copy hash or exact rendered approved template and source references; allowed audience; valid schedule; rate/concurrency limits; target active/ready; reviewed destination rules; consent evidence where required; and no duplicate. Campaign jobs also require explicit readiness checks for session validity, composer capability, and platform availability with a `checkedAt` no more than five minutes old (and no more than 30 seconds in the future). Missing or stale checks fail closed.

Artifact identity, campaign, registered path, and SHA-256 are checked during eligibility; artifact and claim-source bytes are re-hashed when the campaign is authorized, and artifact source bytes are re-hashed before transition to publishing. This code manages governance and queue state; the repository still has no live social publisher/worker, autonomous platform readiness collector, or publication verifier, so `QUEUED` is not proof of publication.

## Idempotency and fan-out

The publication key is SHA-256 over the tuple `campaignId + contentId + platform + accountId + targetId`. Repeated job creation for the same identity returns the existing job. For legacy rows without a stored key, duplicate checks derive candidate keys from the stored content ID, story ID, or content hash without rewriting the historical row. Campaign-authorized jobs also block the same normalized copy on the same platform/account by default, even if a caller supplies a different content ID; normalization lowercases, removes URLs, and ignores punctuation. The campaign must explicitly set `contentBoundary.allowRepeatSameContent: true` to authorize that exception. Different authorized platforms/accounts/targets receive independent jobs. A successful LinkedIn job therefore does not block a Facebook or Threads child job. A duplicate for the same identity is blocked; retries must reconcile the existing job rather than create another post.

Platform and account cadence limits still apply. Campaign daily quotas, minimum interval, concurrency, and idempotency are counted across every job in the campaign, including jobs created under superseded authorization versions, so renewal cannot reset limits or make in-flight work invisible. Campaign concurrency counts only in-flight `publishing`/`processing` jobs. Per-target community membership/rules remain hard gates. A failure on one target does not stop unrelated targets.

Jobs blocked because their scheduled instant falls outside an authorized local weekday/time window remain blocked; this version does not calculate or move them to the next allowed slot automatically.

## Human-only blockers

Stop and block the affected job/account for MFA/passkey/security challenge, account lock, ambiguous account or destination identity, policy/scope expansion, or an unknown destructive action. Never bypass a platform challenge or restriction. Routine session, target, composer, asset, duplicate and platform-availability checks are machine eligibility checks; missing/failed evidence is `BLOCKED`, not a request for per-post approval. Readiness is currently consumed from the target record; this build does not autonomously probe social platforms, so an automated readiness collector is still required for hands-off refresh.

## Legacy migration

1. Upgrade v1/v2 state additively; retain existing approvals, jobs, audit, and publication attempts.
2. Keep campaigns without an authorization on the legacy per-job rule. They gain no new authority during migration.
3. When an operator explicitly authorizes a campaign, existing draft/review/approved/queued jobs are evaluated against the exact new scope. Matching jobs inherit the authorization and auto-queue only if all readiness and policy checks pass. Non-matching jobs become `BLOCKED`. Published jobs and unresolved submissions are unchanged.
4. New generation creates one child per approved destination and binds idempotency identity at creation. Scope or policy changes require new explicit campaign authorization; old scopes pause.
5. The dispatcher/adapter, automatic platform readiness collector, durable retry policy, and publication verifier remain separate implementation work. Do not describe queue readiness as end-to-end autonomous publication until those runtime components exist and are verified.
