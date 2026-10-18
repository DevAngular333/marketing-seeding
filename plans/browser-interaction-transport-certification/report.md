# Browser interaction transport certification

## Result

`ORCA live irreversible-submit certification = NOT_CERTIFIED_FOR_IRREVERSIBLE_SUBMIT`

The provider-neutral boundary and two ORCA transport implementations are
present. Both implementations pass the resettable local reversible fixture,
but the ORCA 1.4.229 CLI did not produce repeatable live activation evidence in
the current browser runtime. No LinkedIn Post control was clicked and no social
mutation occurred.

## Boundary and implementations

- Boundary: `src/browser-interaction-transport.mjs`
- Certification harness: `src/transport-certification.mjs`
- ORCA accessibility implementation: `OrcaAccessibilityTransport`
- ORCA normal pointer implementation: `OrcaPointerTransport`
- LinkedIn integration: `src/linkedin-adapter.mjs`
- ORCA process client: `src/orca-browser-client.mjs`
- Reversible fixture: `test/fixtures/browser-interaction-fixture.mjs`

`COMMAND_COMPLETED` remains separate from semantic activation, platform
acceptance and independent publication verification. The selected transport is
fixed before durable submit intent and cannot change afterward. LinkedIn still
rejects a transport that does not implement the immediate pre-input validation
contract.

## Local deterministic evidence

The fixture reset before every trial. The policy is at least 10 attempts, at
least 95% semantic activation, zero wrong-target activations and zero silent
fallbacks.

| Transport | Attempts | Command completed | Positive activation | No transition | Wrong target | Activation rate | Policy result |
|---|---:|---:|---:|---:|---:|---:|---|
| ORCA accessibility | 10 | 10 | 10 | 0 | 0 | 100% | CERTIFIED_LOCAL_FIXTURE |
| ORCA pointer | 10 | 10 | 10 | 0 | 0 | 100% | CERTIFIED_LOCAL_FIXTURE |

The focused transport/LinkedIn/JEV gate is 98/98. The full Node suite is 468
total, 466 passed, 0 failed and 2 skipped.

## Direct ORCA calibration

The installed executable was `/Applications/Orca 2.app/Contents/Resources/bin/orca`,
version `1.4.229`. One controlled localhost fixture trial was attempted with
`--json` and a per-command timeout. The first snapshot returned an empty
`chrome-error://chromewebdata/` page; the following click returned
`browser_stale_ref`, so the trial produced no valid target or semantic evidence.
A later read-only evaluation returned an empty object. The tab and fixture
server were cleaned up. This is a transport/runtime observation failure, not a
successful activation, and is recorded as such in `live-evidence.json`.

## Safety result

- LinkedIn Post clicks: 0
- Social mutations: 0
- Protected UNKNOWN executions mutated: 0
- Protected uncertainty records mutated: 0
- Canonical runtime mutated: 0
- Historical UNKNOWN records were not retried or reconciled.

No transport is selected for a future irreversible submit until a transport has
both a matching runtime certification and repeatable positive activation
evidence in the permitted browser lane. The deterministic selector remains
available for that future record; it does not turn local fixture evidence into
live certification.

## Exact blocker

There is no fresh exact LIVE campaign authorization/window/grant/lease, and no
repeatable ORCA activation evidence for an irreversible LinkedIn control.
Therefore the system remains blocked before any live final-submit action.
