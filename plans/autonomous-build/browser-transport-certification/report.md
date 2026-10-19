# Browser transport certification follow-up

## Current result

`CERTIFIED_FOR_CONTROL_ACTIVATION` for ORCA accessibility and pointer
transports on both the resettable local fixture and the current LinkedIn
reversible composer control. `NOT_CERTIFIED_FOR_IRREVERSIBLE_SUBMIT` remains
the correct result for final LinkedIn Post because no fresh exact live
campaign authority exists and no real submit/acceptance/publication proof was
performed.

## Evidence

- Local resettable fixture: accessibility 10/10 and pointer 10/10 semantic
  activation under the existing threshold (minimum 10 trials, >=95% positive,
  zero wrong-target and zero silent fallback).
- LinkedIn reversible control: accessibility 10/10 and pointer 10/10. Each
  trial opened an empty composer, activated only `Hủy bỏ`/`Cancel`, and
  observed return to `/feed/` with composer absent.
- Focused transport/LinkedIn/JEV gate: 106/106.
- Latest full Node suite: 527 total, 525 passed, 0 failed, 2 skipped.
- `node --check src/*.mjs`, `git diff --check`, UI typecheck and UI build pass.

Detailed real-site evidence: `plans/autonomous-build/reports/linkedin-reversible-transport-calibration-20261019.md`.
Machine-readable evidence: `plans/browser-interaction-transport-certification/live-evidence.json`.

## Safety boundary

No Post/Publish control was clicked, no content was entered, no social
mutation occurred, no canonical runtime was changed, and historical UNKNOWN
executions remain immutable. The live final-submit transport remains selected
only at dispatch from a certified record and cannot change after durable submit
intent.

## Remaining blocker

Fresh exact bounded campaign authorization, harmless approved content scope,
current readiness, one-time window, execution-scoped grant and lease are not
present in canonical runtime. Existing terminal authority cannot be revived.
A future fresh run must execute exactly once and require semantic activation,
platform acceptance, independent permalink discovery and normalized VERIFIED
receipt; uncertainty remains quarantined with no retry.
