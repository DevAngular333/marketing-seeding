# Campaign Queue Failure Isolation

## Goal

Keep one malformed or failing campaign from starving unrelated campaign queue
work, while preserving all existing execution safety contracts.

## Requirements

- A1. Isolate candidate-materialization and per-campaign queue failures and
  continue evaluating other due campaign IDs.
- A2. Return bounded campaign-level failure summaries without exposing raw error
  text, credentials or state paths.
- A3. Project failure counts/reason codes through the existing read-only queue
  runtime summary.
- A4. Preserve campaign authorization, readiness, request, one-time-window,
  grant, lease, idempotency and UNKNOWN behavior.
- A5. Do not add browser/provider/external side effects or a new scheduler,
  store, state machine, router or authority path.

## Constraints

- C1. Reuse `queueDueCampaignJobs` and the existing server timer.
- C2. Keep successful result shape compatible with existing callers.
- C3. Keep the canonical runtime, authenticated browser profile and
  historical UNKNOWN records untouched.

## Verification

- V1. Focused service/server/lifecycle tests pass with zero failures.
- V2. A fixture with one failing and one healthy campaign proves the healthy
  campaign is still evaluated.
- V3. Syntax and diff checks pass.
- V4. Full Node suite passes with zero failures.
- V5. Independent review confirms no authority or retry semantic weakening.
