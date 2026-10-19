# Transport/runtime audit — 2026-10-19f

**Status: DONE**

## Scope

Fresh read-only audit of current tree `integration/autonomous-build` at HEAD
`5519b80`, after the latest test/reconciliation work. Inspected source policy,
certification evidence, optional transport availability, explicit ORCA executable,
and connected runtime status. No browser tab or session was opened/inspected, no
credentials or cookies were read, no Post/Publish control was clicked, and no
canonical state, UNKNOWN record, or external system was mutated.

## ORCA runtime pin

- Explicit executable: `/Applications/Orca 2.app/Contents/Resources/bin/orca`
- Executable version: `1.4.229`
- `orca status --json`: running, ready, reachable, connected
- Connected runtime version: `1.4.229`
- Exact executable/connected runtime version match: **YES**

Read-only process inventory still contains older ORCA generations (`1.4.224`
AppTranslocation and `1.4.227` installed daemon) alongside the active `1.4.229`
runtime. This does not change the selected CLI status result, but it remains a
live-lane process identity concern. A future irreversible execution must use one
controlled executable/daemon/profile identity and fail closed if the selected
runtime cannot be unambiguously bound.

## Certification records

`plans/browser-interaction-transport-certification/live-evidence.json` records:

- local fixture: accessibility 10/10 and pointer 10/10 semantic activations;
- LinkedIn reversible Cancel control: accessibility 10/10 and pointer 10/10;
- zero no-transition, wrong-target, or silent-fallback trials;
- ORCA version `1.4.229` and version pin match;
- zero Post clicks and zero social mutations;
- result `CERTIFIED_FOR_CONTROL_ACTIVATION` only;
- no selected transport for future irreversible submit;
- at least one irreversible LinkedIn-certified transport: `false`.

The evidence explicitly excludes irreversible Post/Publish activation,
platform acceptance, independent publication discovery, permalink/post ID,
author/content/time matching, and a VERIFIED receipt.

## Irreversible selection semantics

`src/browser-interaction-transport.mjs` requires exact non-empty provider and
runtime-version identity. With `requireIrreversibleSubmit: true`, a record must
also carry `irreversibleSubmit: true` and
`certificationScope: "IRREVERSIBLE_LINKEDIN_SUBMIT"`. The LinkedIn adapter invokes
this strict selection and rejects uncertified transports before final input.
Transport identity cannot change after durable submit intent. These guards are
present in the current tree and preserve command/activation/acceptance/
publication separation.

## Alternative transport availability

No safe alternative production transport is available in this checkout:

- `playwright-core`, `cloakbrowser`, and `puppeteer-core` are absent from
  `node_modules`;
- Playwright/CloakBrowser exist only as optional package/lockfile declarations;
- no production adapter, authorized profile/session mapping, readiness path,
  publication verifier integration, or irreversible certification record exists;
- ORCA pointer is implemented and audited only for reversible controls.

Installing dependencies or adding a transport adapter would be new implementation
and live-session work, not a read-only calibration repair. It would not itself
prove irreversible LinkedIn publication.

## Exact status

- ORCA executable/runtime pin: **PASS (read-only identity match)**.
- Local and reversible semantic transport policy: **PASS** (10/10 each).
- Safe code-level calibration defect: **NONE IDENTIFIED**.
- Valid alternative transport for irreversible submit: **NO**.
- Irreversible LinkedIn transport certification: **NOT_CERTIFIED_FOR_IRREVERSIBLE_SUBMIT**.
- Remaining live blocker: fresh exact campaign authority/window/grant/lease plus
  one controlled live execution producing semantic activation, acceptance,
  independent publication verification, stable permalink/post ID, author/content/
  time match, and VERIFIED receipt.

No read-only action can manufacture that evidence. Historical UNKNOWN executions
remain immutable and cannot be retried for certification.
