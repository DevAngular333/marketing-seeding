# ORCA live-lane audit — 2026-10-19

## Scope and safety

Read-only inspection of `/Users/nam/Documents/marketing-seeding-integration`, its transport/certification code, lockfile/dependencies, canonical runtime summary, executable metadata and host process metadata. No browser command, tab navigation, snapshot, evaluation, click, input, profile/session mutation, network write, LinkedIn action, canonical state write, credential access, or historical `UNKNOWN` retry was performed. Process command lines were redacted for token/path material.

## Evidence-ranked findings

### 1. The only implemented production browser transport is ORCA

**Evidence:** `src/orca-browser-client.mjs` implements the ORCA CLI process client (`tab`, `goto`, `snapshot`, `eval`, `click`, mouse and wait commands). `src/browser-interaction-transport.mjs` implements the provider-neutral boundary plus `OrcaAccessibilityTransport` and `OrcaPointerTransport`. `src/linkedin-adapter.mjs` constructs the existing ORCA accessibility transport by default and enforces final-submit validation, runtime readiness and transport immutability after durable intent.

The transport abstraction is not a second campaign/browser stack: it is the existing seam. Selection requires an exact non-empty runtime/certification/transport version match and cannot switch after durable submit intent.

### 2. ORCA executable is locally available, but it is not on the shell PATH

**Evidence:** `command -v orca` returned no executable. The configured application executable exists at `/Applications/Orca 2.app/Contents/Resources/bin/orca`; its read-only `--version` output is `1.4.229`. `/Applications/Orca 2.app/Contents/Resources/orca-local-build.json` identifies build `1.4.229-37c314bcc96063c42c468e564df2c34bac8ef8a1-arm64`.

This is a configuration/runtime-lane fact, not a transport certification result. The project can use an explicit executable path, while an unqualified `orca` command would fail closed as unavailable.

### 3. Host has multiple ORCA generations, so process/runtime identity is not globally uniform

**Evidence:** read-only `ps` inspection found a current application/daemon generation at `1.4.229`, older resident daemon/process generations at `1.4.227`, and a translocated daemon generation at `1.4.224`. The older processes are historical host state; their tokens and sensitive path material were not recorded.

The new `OrcaCliClient.probeRuntimeVersion()` and `assertRuntimeVersion()` protect the configured executable before final input. They do not prove that every already-running daemon process belongs to the same generation. A live lane must therefore bind the explicit executable/worktree/profile to a controlled runtime and treat any daemon-version ambiguity as fail-closed.

### 4. Existing certification policy is intentionally narrow and currently passes only reversible control activation

**Evidence:** `src/transport-certification.mjs` policy requires at least 10 resettable trials, activation rate >= 0.95, zero wrong-target activations and zero silent fallbacks. `plans/browser-interaction-transport-certification/live-evidence.json` records ORCA accessibility and pointer at 10/10 on a resettable local fixture and 10/10 on LinkedIn's reversible composer Cancel control. It records zero Post clicks, zero social mutations and no irreversible submit.

This proves `CERTIFIED_FOR_CONTROL_ACTIVATION` within the recorded reversible scope. It does not prove Post control activation, platform acceptance, independent publication discovery, permalink/post ID, author/content/time match or `PUBLISHED`/`CONFIRMED`.

### 5. No valid in-scope alternative transport is implemented or certifiable in this checkout

**Evidence:** `package.json` and `pnpm-lock.yaml` declare optional `playwright-core` and `cloakbrowser`, but `node_modules/playwright-core` and `node_modules/cloakbrowser` are absent. No source adapter creates a Playwright/CloakBrowser transport. The only CloakBrowser reference is the fixture bridge; `test/fixtures/marketing-seeding-fixture/src/automation.mjs` explicitly throws `CloakBrowser is unavailable in the local fixture adapter`. Tests mention a hypothetical `playwright-pointer` identity only as selection behavior, not as an implementation. No Playwright/CloakBrowser live session, profile mapping, readiness path, publication verifier integration or certification record exists.

Installing optional dependencies or creating a new adapter would be implementation work and would not itself provide an authorized real LinkedIn session or safe publication proof. It was not performed in this read-only audit.

## What can be fixed locally

1. Keep the explicit ORCA executable path and exact `1.4.229` pin in the live runtime configuration; do not rely on PATH resolution.
2. Ensure the live lane uses one controlled ORCA generation/worktree/profile and rejects ambiguous daemon/process identity before durable submit intent. The existing executable version probe is a useful pre-submit guard but is not a daemon inventory check.
3. Complete the remaining ORCA milestone artifacts and keep local/reversible certification clearly separated from irreversible LinkedIn certification.
4. If product scope later authorizes an alternative, implement it behind the existing `BrowserInteractionTransport` contract and certify it with the same resettable, semantic-observation policy before any irreversible use. No such alternative is currently available.

## True blockers / external dependencies

- **`LIVE-LINKEDIN-AUTH-001`:** canonical runtime has no fresh exact live campaign authorization, one-time window, execution-scoped grant or lease. Existing records are terminal. This cannot be invented or derived from terminal historical authority.
- **`ORCA-TRANSPORT-LIVE-CERT-001`:** no fresh irreversible LinkedIn execution has proven semantic activation, acceptance and independent publication. Local reversible results are insufficient. A controlled authorized LinkedIn session and fresh exact harmless live execution scope are required.
- The runtime's multiple ORCA generations make process identity an additional live-lane readiness requirement; a read-only executable probe alone cannot certify all resident daemon processes.

## Alternative transport decision

`Alternative transport audited? YES` — Playwright/CloakBrowser were searched in source, lockfile and installed modules; only optional declarations and an intentionally unavailable fixture hook exist.

`Alternative transport implemented? NO` — no production adapter or live browser integration exists.

`Alternative transport certifiable now? NO` — there is no in-scope implementation, session/profile binding, independent verifier path or certification evidence. ORCA pointer is an existing alternative within the ORCA provider, but its evidence is reversible control activation only and it is not certified for irreversible LinkedIn submission.

## Conclusion

The transport seam and fail-closed version pinning are locally repairable and regression-tested. The remaining live lane is not blocked by a missing browser abstraction. It is blocked by fresh exact external campaign authority/session and by the need to run one controlled, version-consistent ORCA lane for irreversible LinkedIn proof. No safe read-only action can manufacture either requirement. Until those inputs exist, the correct result remains **NOT_CERTIFIED_FOR_IRREVERSIBLE_SUBMIT** and no final Post action is permitted.
