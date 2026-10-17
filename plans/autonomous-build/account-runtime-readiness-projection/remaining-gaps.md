# Remaining Gaps

- The projection does not perform login, OAuth/token refresh, MFA/CAPTCHA/device recovery, account switching, account selection, or failover.
- `SESSION_REUSE` and `MANUAL_AUTH` describe the existing host-managed boundary; they do not certify live session health.
- No live multi-account execution proof exists. Future selection/failover requires a separate authority-reviewed milestone and must not be inferred from this read model.
