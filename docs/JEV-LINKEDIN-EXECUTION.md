# JEV LinkedIn execution boundary

PR3 adds the first JEV worker and LinkedIn execution adapter on top of PR2's `ExecutionRequestV1`, `ExecutionReceiptV1`, account registry, readiness provider, campaign authorization, and idempotency rules. It does not add another publisher or support another social platform.

## Worker wiring and default behavior

The local server owns the canonical state writer and wires one `JevExecutionWorker` to the LinkedIn readiness provider and `LinkedInAdapter`. The worker is disabled unless `SEEDING_JEV_WORKER_ENABLED=true`.

The normal safe test mode is restricted to one explicitly named request per process run:

- Dry-run: set `SEEDING_JEV_WORKER_ENABLED=true` and `SEEDING_JEV_DRY_RUN_EXECUTION_ID=<executionId>`.
- Operator-only pre-submit dry-run: `POST /api/posts/:id/execution-request/dry-run`, then `POST /api/execution-requests/:id/run-dry-run`. This explicitly marked request traverses the same in-process worker, adapter registry, and LinkedIn adapter. It does not enter the live queue.
- Controlled one-job live test: set `SEEDING_JEV_WORKER_ENABLED=true`, `SEEDING_JEV_LIVE_ENABLED=true`, and `SEEDING_JEV_LIVE_EXECUTION_ID=<executionId>`. The request must also be marked `testJob`.
- Campaign-autonomous live mode: set `SEEDING_JEV_WORKER_ENABLED=true`, `SEEDING_JEV_LIVE_ENABLED=true`, and `SEEDING_JEV_AUTONOMOUS_LIVE_ENABLED=true`. Only non-test jobs inside an active campaign authorization with `allowLiveExecution=true` are eligible.

Both live modes require an active campaign authorization with `allowLiveExecution=true`, an in-scope account/profile/target and audience, freshly checked readiness, verified content/media, and all atomic pre-submit checks. The controlled test path is limited to its exact test execution ID. Autonomous mode is explicit global operator configuration in addition to campaign scope. Without all required flags, the worker cannot click LinkedIn's Post control. Do not put credentials or browser/session data in these settings.

Before using either mode, register the exact LinkedIn account and its dedicated ORCA profile with `expectedIdentityUrl`. The URL is only an identity selector; the provider verifies the authenticated session and matching LinkedIn profile link without persisting account page content. If identity, profile, session, composer, or destination is ambiguous, the job stops.

The operator-only pre-submit dry-run ignores only publish-time gates: local schedule slot, publication cadence/daily/concurrency limits, `allowLiveExecution`, and target activation status. It still requires a current campaign authorization within its validity window, exact platform/account/profile/target/content/media/audience scope, registered healthy account binding, fresh bound `READY` readiness, valid artifact hash/type, and duplicate-publication protection. A dry-run does not change post queue/lifecycle state, submit state, or live eligibility. It holds the ordinary execution/profile lease and returns `DRY_RUN_COMPLETE` only when all pre-submit verification gates pass; an unsuccessful dry-run returns `DRY_RUN_FAILED` and can only be retried as a new operator-requested no-submit attempt.

## Execution sequence

1. Acquire a durable lease for execution, job, and platform/profile.
2. Refresh/check readiness through the registered platform provider and verify the account/profile binding.
3. Refresh the existing request under its current `executionId` and record `EXECUTING` for live mode.
4. The adapter uses only the expected ORCA profile, navigates directly, waits for LinkedIn's authenticated shell to hydrate after navigation, verifies account identity and target, classifies the composer structurally, checks audience and content hash, validates the media file SHA-256, attaches it using the browser file input, and confirms the preview.
5. Dry-run stops and closes the composer. Its `dryRun: true`, `NOT_STARTED` receipt is auditable but does not consume the live request or alter its submission state.
6. In live mode, the control plane rechecks authorization, readiness, content, asset, audience, profile, idempotency, and duplicate state while holding the lease. It persists `SUBMIT_SENT_INTENT` before the adapter performs one Post click.
7. The adapter marks `SUBMIT_SENT`, waits for the feed, and verifies the resulting content, media presence, author identity, and LinkedIn reference. A failure after intent is `UNKNOWN`; it is never redispatched.
8. A verifier-only reconciliation can confirm an unknown result later. The server retries read-only reconciliation at most once per minute and at most 10 times automatically. It does not open the composer or invoke submit. Later operator reconciliation remains read-only. Only a validated confirmed receipt produced by the in-process JEV verifier, with matching account/profile/target/content/media evidence, transitions the job to `PUBLISHED` and `VERIFIED`. HTTP operator/automation receipt submissions cannot assert `CONFIRMED`.
9. Release the lease in `finally`, including adapter errors and uncertain outcomes.

Recoverable `FAILED` results before submit intent are retried by the existing campaign scheduler under a new execution ID, capped at three total attempts. `HUMAN_REQUIRED`, non-retryable failures, and every state after durable submit intent are not dispatched again.

## Durable state and idempotency

Schema v5 adds `executionLeases[]`. Expired leases are discarded during acquisition. A lease is scoped to the execution ID, job ID, account and platform/profile; one active worker can own a profile at a time.

`SUBMIT_SENT_INTENT` is persisted before the only submit click. It is a non-redispatchable state along with `SUBMIT_SENT`, `SUBMIT_RESULT_UNKNOWN`, and `CONFIRMED`. If the process stops after writing intent, reconciliation is required even if it is unknown whether the click occurred. This intentionally favors avoiding duplicates over automatic resubmission.

Dry-run receipts are marked `dryRun: true` and are excluded from live outcome conflict resolution. They cannot claim publication. The existing idempotency identity remains campaign + content + platform + account + target.

## Verification limits

This reference adapter currently accepts the authenticated member feed target only; company/page targets fail closed. The LinkedIn verifier requires a matching content string in a feed article, an author profile link matching the expected account identity, a LinkedIn post reference/permalink, and the expected media type present in that article. The source file SHA-256 and in-composer filename/preview are checked before submit. LinkedIn may transcode uploaded media, so the public feed cannot independently reproduce the source-file SHA-256; the receipt records a verified chain from the approved local artifact through the adapter preview to public media presence. If the author, permalink, or media evidence is absent, the result remains `UNKNOWN`.

## Computer-use

The current fast path uses ORCA Browser commands only. `computerUseCalls` remains zero. No external Chrome profile is selected. The adapter does not invoke desktop automation implicitly; any future fallback must be explicit, bounded, and separately instrumented.

## Safe validation

Tests use temporary state and mock browser boundaries. No real account readiness, media upload, or public post is performed by the automated suite. A real profile dry-run requires an explicitly configured account identity URL and a specific prepared execution request. Live execution requires the separate one-job flags and all governance gates; do not use live flags for benchmarks.
