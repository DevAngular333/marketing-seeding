# Changes

- Added safe campaign-queue failure reason normalization in `src/service.mjs`.
- Wrapped candidate materialization and each campaign queue evaluation in
  bounded per-campaign failure handling.
- Preserved successful result shape and appended failed campaign results only
  when needed.
- Updated server queue runtime summary to count failed campaigns and expose
  bounded reason codes.
- Added a regression proving a failing campaign does not starve the next
  healthy campaign and that raw error text is not returned.
