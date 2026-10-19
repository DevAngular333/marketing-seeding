# Transport live-certification gap audit — 2026-10-19

**Status: DONE**

## Scope and safety

Fresh read-only audit of the current transport certification boundary at HEAD
`5519b80`. I inspected the transport abstraction, ORCA client, LinkedIn adapter,
certification harness, tests, package declarations, and existing certification
artifacts. I did not open or inspect a browser tab/session, read credentials or
session material, click LinkedIn Post/Publish, mutate canonical state, retry or
reconcile UNKNOWN executions, or perform any external action.

## Current certification boundary

The existing policy in `src/transport-certification.mjs` requires at least 10
resettable trials, activation success of at least 95%, zero wrong-target
activations, and zero silent fallbacks. `src/browser-interaction-transport.mjs`
keeps transport completion separate from semantic activation and enforces a
pre-click validation contract. `selectCertifiedTransport()` additionally
requires exact provider and runtime-version identity. For irreversible LinkedIn
submit it requires both:

- `irreversibleSubmit: true`; and
- `certificationScope: "IRREVERSIBLE_LINKEDIN_SUBMIT"`.

Transport identity is frozen after durable submit intent. The LinkedIn adapter
rejects an uncertified or unvalidated transport before final input.

## ORCA evidence and remediation assessment

Recorded evidence in `plans/browser-interaction-transport-certification/live-evidence.json`
and `plans/autonomous-build/reports/linkedin-reversible-transport-calibration-20261019.md`
shows:

- ORCA executable and connected runtime: `1.4.229`, exact version pin match;
- accessibility transport: 10/10 reversible LinkedIn Cancel activations;
- pointer transport: 10/10 reversible LinkedIn Cancel activations;
- local fixture: 10/10 for each transport;
- zero no-transition trials, wrong-target activations, or silent fallbacks;
- zero Post/Publish clicks and zero social mutations.

This is valid `CERTIFIED_FOR_CONTROL_ACTIVATION` evidence only. It does not
certify irreversible Post activation, LinkedIn platform acceptance, independent
publication discovery, stable permalink/post ID, author/content/time matching,
or a normalized VERIFIED receipt.

The ORCA runtime boundary has no remaining code-level calibration defect
identified by this audit. The explicit executable reports `1.4.229`; the
existing pre-submit version guard and exact runtime identity checks are present.
Older resident ORCA generations were previously observed on the host, so a
future live lane still needs one controlled executable/daemon/profile identity
and must fail closed on ambiguity. That is an operational live-lane condition,
not a safe read-only transport repair.

## Alternative transport assessment

No valid alternative production transport is available in this checkout.
`playwright-core` and `cloakbrowser` are optional lockfile declarations only;
modules are not installed, no production adapter exists, no authorized profile
mapping exists, no readiness/verifier integration exists, and no certification
record exists. The fixture CloakBrowser hook intentionally reports unavailable.
The ORCA pointer path is an implemented alternative within ORCA, but its proof
is reversible-control-only and therefore cannot authorize irreversible submit.
Installing dependencies or adding a new adapter would be new implementation
work and still would not produce live certification or an authorized LinkedIn
execution.

## Exact remaining blocker

`ORCA-TRANSPORT-LIVE-CERT-001` remains open: no fresh authorized irreversible
LinkedIn execution has produced all required evidence layers:

1. transport receipt;
2. semantic Post-control activation;
3. platform acceptance;
4. independent publication discovery;
5. stable permalink/post ID;
6. author/content/time match;
7. normalized VERIFIED receipt and canonical `PUBLISHED` state.

This cannot be established by another local fixture or reversible Cancel trial.
It requires a fresh exact campaign authority/window/grant/lease and one
controlled live execution. Existing historical UNKNOWN records must remain
immutable and cannot be used for proof.

## Decision

- Safe in-scope transport meeting irreversible-submit policy now: **NO**.
- ORCA runtime remediation defect that can be fixed safely read-only: **NO**.
- Existing local/reversible transport certification: **PASS**.
- Irreversible LinkedIn transport certification: **NOT_CERTIFIED_FOR_IRREVERSIBLE_SUBMIT**.
- No source, canonical state, browser/session, credential, UNKNOWN, or social
  mutation occurred.

## Evidence references

- `src/browser-interaction-transport.mjs`
- `src/transport-certification.mjs`
- `src/orca-browser-client.mjs`
- `src/linkedin-adapter.mjs`
- `plans/browser-interaction-transport-certification/live-evidence.json`
- `plans/autonomous-build/reports/linkedin-reversible-transport-calibration-20261019.md`
- `plans/autonomous-build/reports/orca-live-lane-audit-20261019.md`
- `plans/autonomous-build/reports/verify-orca-runtime-review-20261019.md`
- `plans/autonomous-build/reports/verify-orca-runtime-version-pinning-20261019.md`
