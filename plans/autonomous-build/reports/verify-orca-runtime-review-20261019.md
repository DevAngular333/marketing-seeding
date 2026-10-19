# ORCA runtime review — 2026-10-19

## Status

**DONE — read-only runtime review.** No browser tab was opened, navigated, inspected, clicked, or mutated. No campaign state, grant, lease, authorization, session, credential, or social record was changed. No historical UNKNOWN execution was retried.

## Scope and method

Read-only observations covered:

- the configured ORCA CLI executable and its version;
- connected ORCA status (`status --json`);
- resident ORCA daemon PID records and process command lines;
- canonical runtime configuration key names and executable-path existence (values redacted);
- project ORCA client and transport certification code;
- existing certification policy and evidence artifacts.

Credential/session values are intentionally not recorded. The canonical `runtime.env` file exists with restrictive mode `0600`; its value contents are not reproduced here.

## Executable and connected runtime

| Observation | Result |
|---|---|
| Explicit installed executable | `/Applications/Orca 2.app/Contents/Resources/bin/orca` |
| Executable `--version` | `1.4.229` |
| Executable build metadata | version `1.4.229`, commit `37c314bcc96063c42c468e564df2c34bac8ef8a1`, architecture `arm64` |
| Connected status | `running=true`, `runtime.state=ready`, `reachable=true`, `connectionState=connected` |
| Connected runtime version | `1.4.229` |
| Connected runtime ID | observed but intentionally omitted from report; it is an operational identifier, not needed for certification evidence |
| Project shell PATH lookup | no unqualified `orca` executable found |

The explicit executable and the connected runtime agree at `1.4.229`. The project client (`src/orca-browser-client.mjs`) performs both read-only probes and requires exact equality with the configured certification pin before final-submit transport input.

## Configuration inconsistency

The canonical local configuration at `.../.agentic/marketing-seeding/local-config/runtime.env` contains an `ORCA_CLI` value pointing to an AppTranslocation path from an older ORCA installation. That exact executable no longer exists (`old_exists=no`). The installed explicit `1.4.229` executable does exist (`new_exists=yes`).

The canonical start script sources this runtime file before starting `src/server.mjs`. Therefore, a server started through the canonical script can fail closed with `ORCA_RUNTIME_UNAVAILABLE` even while the currently connected ORCA 1.4.229 daemon is healthy. This is a **configuration/runtime-lane blocker**, not evidence that the transport itself activated a LinkedIn Post.

No config value was changed in this review because the canonical runtime is outside the repository worktree and changing it would alter the live lane. A controlled owner must update the pin to the installed explicit executable, then re-run the read-only executable and connected-runtime probes before any live execution.

## Resident daemon inventory

Read-only PID records show multiple ORCA generations resident on the host:

- daemon record `v43`: app version `1.4.224`, AppTranslocation executable;
- daemon record `v47`: app version `1.4.227`, installed ORCA executable;
- daemon record `v48`: app version `1.4.229`, installed ORCA 2 runtime/terminal-host path.

The active CLI status command connects to the ready `1.4.229` runtime. The older resident daemons remain a process-identity hazard: executable version alone does not prove that every resident daemon is the recipient of browser commands. The project’s connected-runtime probe is the correct fail-closed guard for the selected CLI lane, but the live acceptance lane still needs one controlled profile/tab/runtime identity and must reject ambiguity before durable submit intent.

## Project implementation evidence

- `src/orca-browser-client.mjs` implements bounded `--version` and `status --json` probes and exact version matching.
- `src/browser-interaction-transport.mjs` contains the existing ORCA accessibility and pointer transports behind one transport boundary; no second browser abstraction was introduced.
- `src/transport-certification.mjs` enforces the repeatable policy: at least 10 attempts, activation rate at least 0.95, zero wrong-target activations, and zero silent fallbacks.
- Existing evidence records both ORCA transports at 10/10 reversible control activation on fixture/LinkedIn Cancel trials. This is `CERTIFIED_FOR_CONTROL_ACTIVATION`, not irreversible-submit certification.
- Existing final-submit safeguards preserve separate transport, semantic activation, platform acceptance, and publication-verification evidence.

## Safe calibration assessment

A local/reversible calibration improvement is not required by this review: the existing accessibility and pointer transports already meet the current 10-trial reversible policy with zero wrong-target/no-transition/silent-fallback cases. Re-running calibration would only produce more reversible evidence and cannot establish LinkedIn Post acceptance or independent publication.

No in-scope alternative normal browser transport is implemented beyond ORCA’s existing pointer transport. It is audited for reversible control activation only and is not certified for irreversible LinkedIn submission.

## Exact blocker

`ORCA-TRANSPORT-LIVE-CERT-001` remains open: no fresh real LinkedIn irreversible execution has proven semantic activation, platform acceptance, independent publication discovery, stable permalink/post ID, author/content/time matching, and a VERIFIED receipt.

The runtime lane additionally has `ORCA-RUNTIME-CONFIG-001`: canonical `ORCA_CLI` points to a missing translocated executable while the connected installed runtime is `1.4.229`. Until the canonical lane is corrected and one exact runtime/profile/tab identity is controlled, no live submit may proceed.

The separate external blocker `LIVE-LINKEDIN-AUTH-001` also remains: no fresh exact live campaign authorization/window/grant/lease is present in canonical state. This review did not create or revive one.

## Safety counts

- LinkedIn Post/Publish clicks: `0`.
- Social mutations: `0`.
- Historical UNKNOWN records mutated: `0`.
- Credentials, cookies, tokens, or session material persisted: `0`.

## Recommended owner action (not performed here)

1. Correct the canonical runtime configuration to the explicit installed ORCA 1.4.229 executable through the controlled runtime owner.
2. Restart/reconcile the canonical server only under its normal operational procedure, then verify executable and connected runtime exact-match probes.
3. Keep the live lane blocked until fresh exact campaign authority and a controlled authorized harmless LinkedIn execution are available.
4. After both are true, run one new execution only; preserve UNKNOWN quarantine and independent publication verification requirements.

## Final recheck (read-only)

A final read-only probe on 2026-10-19 confirmed the explicit ORCA executable exists and reports `1.4.229`; `status --json` reports the connected runtime as running, ready, reachable, connected, and `1.4.229`. The private canonical runtime configuration file exists with mode `0600`; its configured executable path now resolves to an executable (value intentionally not recorded). No configuration was edited by this review.

Resident process inspection still shows older daemon generations (`1.4.224` and `1.4.227`) alongside `1.4.229`. This remains a live-lane identity/control concern, even though the selected CLI status probe is healthy and exact-version matched.

Local remediation remaining without live submit: **none required for executable-path availability**. The remaining work is operational/live-only: establish one controlled ORCA daemon/profile/tab identity, then obtain fresh exact LinkedIn campaign authority and run the one permitted irreversible acceptance execution with independent publication verification. No read-only calibration can prove that live result.
