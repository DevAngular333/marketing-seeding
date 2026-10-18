# Changes

- Added the `campaignQueueRuntime` bounded projection in `src/server.mjs`.
- Recorded queue cycle start/completion timestamps, running state, next run,
  campaign/decision counts and bounded failure reason.
- Exposed the projection at `/health.campaignQueue` and
  `/api/dashboard.automation.campaignQueue`.
- Added lifecycle and HTTP dashboard regression assertions for safe fields and
  redaction of state/error fields.
- Preserved the existing scheduler, service, authority and shutdown seams.
