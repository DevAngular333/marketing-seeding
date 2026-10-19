# Channel capability/readiness projection

- **A1** Project every configured channel using existing policies, targets and readiness evidence.
- **A2** Distinguish missing target, inactive target, rules review, stale/missing readiness and fresh READY target.
- **A3** Keep the projection advisory and read-only; it must never select accounts or derive authority.
- **V1** Focused tests cover deterministic output and fail-closed statuses.
- **V2** Service dashboard exposes the projection alongside the existing channel counts.
