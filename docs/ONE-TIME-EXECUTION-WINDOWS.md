# One-Time Execution Windows

Schema v8 adds `oneTimeExecutionWindows[]`. Migration from v7 adds this collection as empty and does not change existing jobs, authorizations, grants, or recurring schedule rows.

## Purpose and boundaries

A `OneTimeExecutionWindowV1` grants one existing job schedule eligibility during one explicit absolute time interval. It is platform-neutral and references one exact campaign authorization. It does not authorize live submission. Live submission still requires active campaign authorization with `allowLiveExecution=true`, fresh readiness, target and policy eligibility, a job/execution-scoped `LiveExecutionGrantV1`, and all existing exactly-once gates.

The window is an alternative to the recurring authorization weekday/time gate for its exact job only. It does not alter recurring schedules or bypass authorization validity, daily/account quotas, cadence, concurrency, target status, readiness, duplicate protection, unknown-submission quarantine, or submission guards. `scheduledAt` remains ordinary job metadata.

## Contract and lifecycle

The stored v1 record includes:

- `windowId`, `schemaVersion`, `campaignId`, `campaignAuthorizationId`, and `jobId`;
- `authorizationFingerprint` plus an immutable `binding` fingerprint;
- absolute ISO `validFrom` and `validUntil`, and display `timezone`;
- `status`, optional `reservedExecutionId`, optional `consumedExecutionId`, and `maxExecutions: 1`;
- `createdAt`, `createdBy`, and operator-supplied `reason`.

Lifecycle:

```text
ACTIVE -> RESERVED(executionId) -> CONSUMED
   |             |
   +-> REVOKED   +-> REVOKED before worker start
   +-> EXPIRED   +-> EXPIRED
```

Reservation occurs atomically with creation/binding of the live `ExecutionRequestV1`. The request stores only the `windowId`. Once the worker starts the live execution, a durable state mutation consumes the window for that same execution. A failed pre-submit run does not reopen it. An operator may create a separate new window later after reviewing the job state.

The authorization fingerprint is rechecked during schedule evaluation, request reservation, worker start, and pre-submit. A revoked, expired, stale, mismatched, or differently reserved window is not eligible. A consumed window applies only to its recorded execution and only before `validUntil`.

## Operator API

- `POST /api/one-time-execution-windows`: operator-only creation. Required identity fields are `campaignId`, `campaignAuthorizationId`, and `jobId`; also provide `validFrom`, `validUntil`, `timezone`, and `reason`.
- `GET /api/one-time-execution-windows/:windowId`: operator-only read, including effective expiry status.
- `POST /api/one-time-execution-windows/:windowId/revoke`: operator-only revoke. A consumed or expired window cannot be reopened.

Automation credentials cannot create, read, or revoke windows. There is no API to rebind a reserved execution.

## Failure modes

| Condition | Result |
| --- | --- |
| Job, campaign, or authorization binding differs | Creation/evaluation rejects the window. |
| Authorization fingerprint changes | The window is stale; normal schedule rules apply and authorization gates remain blocking. |
| Window is future, expired, or revoked | It does not satisfy schedule eligibility. |
| Another execution reserved or consumed the window | The second execution is rejected. |
| Daily, cadence, concurrency, readiness, target, or live authorization gate fails | The job remains blocked. |
| Unknown submission hold or existing publication exists | Duplicate and uncertainty guards still block execution. |
| Window exists without a live grant | The job may pass schedule eligibility but cannot cross `SUBMIT_SENT_INTENT`. |

## Evidence status

The PR3.4 unit and integration tests exercise schema v7-to-v8 migration, schedule evaluation, job isolation, authorization binding, reservation/consumption, operator API permissions, existing governance gates, dry-run behavior, and a non-LinkedIn platform. This is code/test evidence only. No real window was created and the v8 runtime has not been deployed by this change.
