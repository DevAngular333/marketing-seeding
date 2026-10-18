# Mission Control Execution Evidence UI

## Outcome

Added a read-only execution evidence panel to the existing dashboard overview. It consumes the existing `executionRuntime` projection from `/api/dashboard` and does not create routes, controls, mutation paths, or new runtime abstractions.

## Evidence shown

- latest execution phase and action;
- DRY_RUN, LIVE and UNKNOWN counts;
- independently verified publication count;
- immutable UNKNOWN quarantine count;
- verified permalink only when supplied by the backend projection;
- bounded blocker codes.

Raw execution IDs, payloads, content, profile data and secrets are not rendered.

## Verification

- `npx tsc --noEmit` from `ui/`: passed.
- `npm run build` from `ui/`: passed (existing Vite config warnings only).
- `git diff --check`: passed.
- Commit: `4348d2c`.

## Limitations

The panel is observational. It does not provide approval, dispatch, retry, reconciliation, or browser controls. Publication remains UNKNOWN unless the backend emits independent VERIFIED evidence.
