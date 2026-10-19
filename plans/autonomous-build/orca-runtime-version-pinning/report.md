# ORCA runtime version pinning

## Result

`PASS_BOUNDED` — the existing ORCA transport seam now fails closed when the
configured executable or connected ORCA runtime is not exactly the certified
version. This is a runtime safety prerequisite; it is not irreversible LinkedIn
publication certification.

## Implementation

- `OrcaCliClient.probeRuntimeVersion()` performs a bounded read-only
  `--version` probe and keeps the observation separate from the configured pin.
- `OrcaCliClient.probeConnectedRuntimeVersion()` performs a bounded read-only
  `status --json` probe and reads the daemon/runtime app version.
- `assertRuntimeVersion()` requires a non-empty expected version and exact
  equality across expected, executable and connected runtime versions.
- Both existing ORCA accessibility and pointer transports call this guard at
  the LinkedIn final-submit boundary before durable submit intent.
- Certified transport selection requires exact non-empty runtime,
  certification-record and transport-identity version equality.

No second browser abstraction, provider router, publisher, store, retry path or
transport fallback was introduced. `COMMAND_COMPLETED`, semantic activation,
platform acceptance and independent publication remain separate evidence
layers.

## Host observation

The configured executable and connected daemon both reported `1.4.229`, with
runtime state `ready` and connection state `connected`. The command was
read-only and did not inspect or mutate page content, credentials, canonical
state or social state.

## Classification

- Runtime version guard: **IMPLEMENTED / LOCAL_VERIFIED**.
- ORCA reversible control activation: **CERTIFIED_FOR_CONTROL_ACTIVATION**
  under the existing 10-trial policy.
- ORCA irreversible LinkedIn submit: **NOT_CERTIFIED**.
- Real LinkedIn platform acceptance/publication verification: **UNPROVEN**.

## Safety

- LinkedIn Post/Publish clicks: 0.
- Social mutations: 0.
- Historical UNKNOWN executions mutated: 0.
- Credentials, cookies, tokens and session material persisted: 0.
