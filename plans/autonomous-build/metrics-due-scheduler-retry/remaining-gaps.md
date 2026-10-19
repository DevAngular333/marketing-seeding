# Remaining gaps

- Live provider recovery, credentials, rate limits, response authenticity, and exact production cadence remain unverified.
- The local scheduler still uses its existing bounded timer and provider request retry policy; this change does not add backoff, persistence of retry counts, or a new scheduler.
- `unknown` remains the visible checkpoint status for failed/unknown evidence; retry eligibility is represented only in the due-only plan.
