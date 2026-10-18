# Changes

- Reused the existing `requestJson()` metric-provider seam; no new provider
  router, store, scheduler, authority path or adapter was introduced.
- Retryable `429` and `5xx` responses now honor bounded numeric or HTTP-date
  `Retry-After` hints.
- Signed, malformed, oversized and otherwise unusable hints fall back to the
  existing bounded exponential delay. The production cap is 10 seconds.
- Non-retryable responses remain fail-fast. Injected clock and sleep hooks are
  test-only seams for deterministic fixture coverage.
- Added regression fixtures for valid hints, malformed/negative/oversized
  hints, retryable responses and non-retryable responses.

No canonical runtime, browser, ORCA, credential, LinkedIn or social state was
modified.
