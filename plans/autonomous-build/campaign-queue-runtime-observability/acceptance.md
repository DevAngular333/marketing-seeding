# Campaign Queue Runtime Observability

## Goal

Expose the existing autonomous campaign queue timer as a bounded read-only
runtime projection so operators can observe scheduling health from `/health`
and the existing dashboard without gaining execution controls.

## Requirements

- A1. Report queue enabled state, fixed interval, running state, last start,
  last completion, next run and a bounded last summary.
- A2. Expose the same allowlisted projection through `/health` and the existing
  dashboard `automation` object.
- A3. Record successful queue-cycle counts and a redacted bounded error reason
  when a cycle fails; never expose credentials, state paths or raw errors.
- A4. Preserve queue scheduling, standing-authority, readiness, grant, lease,
  idempotency and UNKNOWN semantics.
- A5. Keep the projection read-only; no dashboard control or new authority path.

## Constraints

- C1. Reuse the existing `scheduleCampaignQueueEvaluation` timer and
  `queueDueCampaignJobs` service seam.
- C2. Do not modify `SYSTEM_AGENTIC_AI` Core, canonical runtime state or any
  external browser/platform state.
- C3. Do not add another scheduler, store, state machine or provider router.

## Verification

- V1. Node syntax and diff checks pass.
- V2. Server lifecycle fixture exposes the queue projection with safe fields.
- V3. Full Node suite passes with zero failures.
- V4. Independent diff review confirms the projection has no mutation or
  authority effect.

