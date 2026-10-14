# Unknown submission quarantine

Schema v7 adds `submissionUncertainties[]`. Migration from v6 is additive and does not infer an outcome or quarantine any legacy job.

The canonical post state is `submit_result_unknown`; modern execution requests keep their existing `SUBMIT_RESULT_UNKNOWN` state. Both point to the same durable uncertainty record. Legacy records retain the real `publicationAttemptId` and use `executionId: null`.

An UNKNOWN record preserves publication identity keys, campaign/platform/account/target binding, content and media hashes, detection time, reason, and evidence references. It is an idempotency hold: queue eligibility, execution request creation, submit intent, and live grant creation reject a matching unresolved identity. A live grant cannot override that hold.

Campaign concurrency counts `publishing` and `processing`, plus an UNKNOWN post only while an active worker or unexpired lease still exists. UNKNOWN remains included in daily and cadence accounting while unresolved.

Operator actions:

- `POST /api/posts/:jobId/quarantine-unknown` requires an expired `prepared` legacy attempt with no execution id, no related active execution/lease, explicit operator confirmation that no worker is running, and evidence references.
- `GET /api/submission-uncertainties/:id` reads the durable record.
- `POST /api/submission-uncertainties/:id/reconcile` accepts `CONFIRMED` only with matching target/account/profile/content/media/permalink evidence, or `PROVEN_FAILED` only with explicit `PRE_SUBMIT_ABORT_TRACE` or `PLATFORM_REJECTION_BEFORE_ACCEPTANCE` proof that submit never occurred. A modern execution confirmation continues through the in-process JEV receipt verifier.

Unresolved records cannot be transitioned through generic post status APIs. Migration and tests use isolated fixtures; this change does not reconcile or alter any production job.
