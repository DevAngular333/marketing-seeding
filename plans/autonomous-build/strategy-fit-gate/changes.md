# Strategy Fit Gate — Changes

- Filtered explicit discovery fit records with `fit.eligible !== true` before
  strategy candidate ordering.
- Preserved compatibility for legacy discovery records without `fit`.
- Added regression cases for mismatched/unknown exclusion and matched
  selection; retained existing tests for legacy records, UNKNOWN quarantine,
  stable ordering and no execution requests.
- Added bounded independent-review and milestone evidence.
