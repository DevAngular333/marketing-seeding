# Authorized account/session candidate projection

**Status:** COMPLETE_LOCAL_VERIFIED
**Evidence class:** LOCAL / SYNTHETIC, read-only projection

## Outcome

The existing dashboard now exposes a deterministic `authorizedAccountCandidates`
projection. It evaluates each exact authorization destination against the
campaign scope and validity, exact target URL/platform/account/profile binding,
enabled healthy account and fresh bound readiness. Any mismatch yields explicit
reason codes and `eligibleForAutonomousExecution: false`.

The projection is advisory pre-dispatch data. The existing queue, execution
request, one-time window, live grant, lease, JEV, LinkedIn adapter and UNKNOWN
quarantine remain the final authority. The projection does not select a
replacement account or change any persisted execution binding.

## Safety boundary

- No canonical runtime or historical UNKNOWN record was read for mutation.
- No browser, ORCA, LinkedIn, network, credential or social action occurred.
- No request, window, grant, lease, post, publication attempt or receipt is
  created by dashboard reads.
- Profile IDs, identity URLs, raw readiness evidence and secret-like fields are
  excluded; only a SHA-256 profile fingerprint is exposed.

## Limitations

This does not implement account failover, login/session recovery, OAuth refresh,
MFA/CAPTCHA recovery, target rebinding or multi-account live execution. Those
operations require an explicit versioned policy and exact authority derivation.
