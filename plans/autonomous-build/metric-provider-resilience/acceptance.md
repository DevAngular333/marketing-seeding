# Metric Provider Resilience Acceptance

## Requirements

- **A1** Retryable metric provider failures (`429`, `5xx`, and transient transport errors) keep bounded retry behavior without changing metric persistence or authority semantics.
- **A2** A valid `Retry-After` response hint is honored for the next retry, while the delay is capped by a bounded safety limit.
- **A3** Invalid, negative, or oversized `Retry-After` values fail closed to the existing exponential fallback and never create an unbounded wait.
- **A4** Non-retryable provider responses remain fail-fast and are not retried.
- **A5** Existing provider normalization, collector idempotency, per-post isolation, and secret redaction behavior remain unchanged.

## Constraints

- **C1** Use isolated fixture fetches only; do not call live providers, inspect credentials, access ORCA/browser sessions, or mutate canonical state.
- **C2** Do not add a provider router, metric store, scheduler, authority path, or platform adapter.
- **C3** Preserve historical UNKNOWN executions and uncertainty records; no social or external side effect.
- **C4** Keep retry delay bounded and injectable only for deterministic tests; production defaults remain internal.

## Verification

- **V1** Integration tests cover valid `Retry-After`, malformed/oversized hints, retryable status, transport errors, and non-retryable status.
- **V2** Focused integration/service tests pass with zero failures.
- **V3** Full Node suite, source syntax checks, and `git diff --check` pass.
- **V4** Independent read-only review inspects the final diff after the last change.
- **V5** Canonical runtime revision/hash and protected UNKNOWN records remain unchanged.

## Non-goals

- No live metric credentials or provider requests.
- No exact-time checkpoint scheduler, adaptive learning, platform publishing, or dashboard redesign.
