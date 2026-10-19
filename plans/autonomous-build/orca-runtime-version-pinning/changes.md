# Changes

- Extended the existing `OrcaCliClient` with executable and connected-runtime
  version probes.
- Added a fail-closed final-submit runtime guard before durable submit intent.
- Tightened certified transport selection to exact non-empty version matches.
- Added regression coverage for unpinned executable, executable mismatch and
  connected-daemon mismatch.
- No LinkedIn Post click, social mutation, canonical-state write, credential
  access or UNKNOWN retry occurred.
