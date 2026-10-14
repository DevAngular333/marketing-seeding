# Campaign authorization

## Purpose and boundary

Campaign authorization is the canonical pre-authorization for future child distribution jobs. It removes routine per-post approval only inside an explicit, expiring campaign scope. It does not create a platform publisher or bypass runtime readiness, account authentication, platform rules, rate limits, or duplicate protection.

## Canonical state

`state.json` is schema version 8. `campaignAuthorizations[]` is the source of truth; the campaign record and dashboard are projections. Earlier state migrations add authorization, execution, grant, uncertainty, and one-time-window collections while preserving existing records. Migration does not infer or grant campaign permission.

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

An active authorization attaches to matching child jobs. Eligible jobs inherit `campaignAuthorizationId` and the immutable binding, then pass through `CREATED → AUTHORIZED → READINESS_CHECKING → READY → QUEUED → EXECUTION_REQUEST_READY`. Readiness is platform-neutral and injected by platform: missing/stale evidence invokes the configured provider, persists a bound result, then reevaluates the queue. Freshness defaults to five minutes and can be configured with `SEEDING_READINESS_TTL_MS` (1 second to 1 hour). A stale request that has not started is refreshed under the same `executionId`; a submitted or uncertain request is never refreshed or dispatched as a new attempt. The local server evaluates due/retryable jobs and expires authorizations every 30 seconds.

Authorization requires exact destination identity and a registered enabled account-to-profile binding; campaign activity; valid authorization dates and binding; approved media identity/hash; approved copy hash or exact rendered approved template and source references; allowed audience; valid schedule; rate/concurrency limits; target active/ready; reviewed destination rules; consent evidence where required; and no duplicate. A dispatchable request requires fresh readiness bound to platform, account, profile, and target, including verified session, feed availability, and composer capability. If identity is uncertain, the job becomes `HUMAN_REQUIRED`; MFA, passkey, security challenge, locked account, and ambiguous account identity are never bypassed.

Artifact identity, campaign, registered path, and SHA-256 are checked during eligibility; artifact and claim-source bytes are re-hashed when the campaign is authorized, and artifact source bytes are re-hashed before transition to publishing. The LinkedIn readiness provider uses the dedicated ORCA browser profile, verifies account/feed/composer structure, and safely closes the composer without entering content or submitting. PR3 adds a JEV worker and LinkedIn adapter on top of the versioned execution contracts. The worker is disabled unless explicitly enabled and bound to one named execution ID. It uses the registered ORCA profile and does not use external Chrome. Other platforms remain unsupported by the JEV worker.

## Idempotency and fan-out

The publication key is SHA-256 over the tuple `campaignId + contentId + platform + accountId + targetId`. Repeated job creation for the same identity returns the existing job. For legacy rows without a stored key, duplicate checks derive candidate keys from the stored content ID, story ID, or content hash without rewriting the historical row. Campaign-authorized jobs also block the same normalized copy on the same platform/account by default, even if a caller supplies a different content ID; normalization lowercases, removes URLs, and ignores punctuation. The campaign must explicitly set `contentBoundary.allowRepeatSameContent: true` to authorize that exception. Different authorized platforms/accounts/targets receive independent jobs. A successful LinkedIn job therefore does not block a Facebook or Threads child job. A duplicate for the same identity is blocked; retries must reconcile the existing job rather than create another post.

Platform and account cadence limits still apply. Campaign daily quotas, minimum interval, concurrency, and idempotency are counted across every job in the campaign, including jobs created under superseded authorization versions, so renewal cannot reset limits or make in-flight work invisible. Campaign concurrency counts only in-flight `publishing`/`processing` jobs. Per-target community membership/rules remain hard gates. A failure on one target does not stop unrelated targets.

Jobs blocked because their scheduled instant falls outside an authorized local weekday/time window remain blocked; this version does not calculate or move them to the next allowed slot automatically.

An operator may create a `OneTimeExecutionWindowV1` for one existing job when an exceptional one-time schedule is required. It can satisfy only that job's recurring weekday/time gate; it does not edit recurring schedule rows or bypass any other authorization, readiness, target, quota, cadence, concurrency, duplicate, uncertainty, or submit gate. The window reserves one `executionId` with its live `ExecutionRequestV1` and is consumed when that worker begins. It does not grant submit authority; a matching `LiveExecutionGrantV1` remains mandatory. See [One-Time Execution Windows](./ONE-TIME-EXECUTION-WINDOWS.md).

## Human-only blockers

Stop and block only the affected job/account for MFA/passkey/security challenge, account lock, ambiguous account or destination identity, policy/scope expansion, or an unknown destructive action. Never bypass a platform challenge or restriction. Routine session, target, composer, asset, duplicate and platform-availability checks are machine eligibility checks; recoverable failures use bounded exponential retry, non-retryable failures stop polling, and human-required states do not retry. The server wires an ORCA-backed LinkedIn provider; readiness for any other platform remains unavailable until that platform has a provider.

## Execution boundary and recovery

`executionAccounts[]` maps one `(platform, accountId)` to one isolated `profileId`, health and last readiness timestamp. An enabled profile cannot be shared by two enabled accounts on the same platform. `ExecutionRequestV1` contains job/campaign/target identity, account/profile, audience, exact content hash and payload, verified media descriptors, authorization binding, readiness binding and idempotency key; secrets are rejected. `ExecutionReceiptV1` records attempt timestamps, readiness result, submit state, safe publication reference, classifications and telemetry.

`SUBMIT_SENT_INTENT`, `SUBMIT_SENT`, `SUBMIT_RESULT_UNKNOWN`, and `CONFIRMED` are non-redispatchable states. Before the only Post click, PR3 durably records `SUBMIT_SENT_INTENT`; failure to persist it stops before clicking. An uncertain result must be reconciled without resubmitting. Only a validated confirmed receipt with matching publication evidence transitions the post to `PUBLISHED` and `VERIFIED`. Dry-run receipts are separately marked and do not consume the live request.

The LinkedIn worker defaults to no-submit behavior and remains disabled unless explicitly enabled. See [JEV LinkedIn execution](./JEV-LINKEDIN-EXECUTION.md) for per-execution dry-run/live flags, identity requirements, and evidence limits. PR3 has no Facebook/Threads executor.

## Legacy migration

1. Upgrade older state additively through schema v5; retain existing approvals, jobs, audit, and publication attempts. New execution collections and leases begin empty; old approvals do not create account/profile bindings.
2. Keep campaigns without an authorization on the legacy per-job rule. They gain no new authority during migration.
3. When an operator explicitly authorizes a campaign, existing draft/review/approved/queued jobs are evaluated against the exact new scope. Matching jobs inherit the authorization and auto-queue only if all readiness and policy checks pass. Non-matching jobs become `BLOCKED`. Published jobs and unresolved submissions are unchanged.
4. New generation creates one child per approved destination and binds idempotency identity at creation. Scope or policy changes require new explicit campaign authorization; old scopes pause.
5. Register the intended account/profile and configure a readiness provider before expecting an execution request. PR3 provides the LinkedIn JEV worker and publication verifier. Do not describe a queued request as published, and do not enable live mode without a one-job authorization and fresh readiness.
