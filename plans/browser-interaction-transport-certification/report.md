# Browser interaction transport certification

## Result

`CERTIFIED_FOR_CONTROL_ACTIVATION` for the existing ORCA transports on a
controlled, resettable local browser fixture. This is **not** certification for
an irreversible LinkedIn submit and does not authorize a LinkedIn Post click.

## Policy

- Minimum attempts: 10
- Minimum semantic activation rate: 95%
- Maximum wrong-target activations: 0
- Maximum silent fallbacks: 0

## Direct browser evidence

ORCA runtime `1.4.229` was exercised through the existing
`OrcaCliClient` and `src/browser-interaction-transport.mjs` seam against a
localhost fixture containing a reversible toggle. Every trial reset the
fixture, re-observed the target, ran preflight, performed exactly one normal
browser interaction, and independently observed the state transition.

| Transport | Attempts | COMMAND_COMPLETED | Positive semantic activations | No transition | Wrong target | Rate | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| ORCA accessibility | 10 | 10 | 10 | 0 | 0 | 100% | CERTIFIED_FOR_CONTROL_ACTIVATION |
| ORCA pointer | 10 | 10 | 10 | 0 | 0 | 100% | CERTIFIED_FOR_CONTROL_ACTIVATION |

The positive transition was `data-state=closed` plus
`aria-expanded=false` to `data-state=open` plus `aria-expanded=true`.
No wrong-target activation, no no-transition trial, no silent fallback and no
observation/transport failure occurred.

## Scope boundary

This evidence certifies reversible local browser control activation only. It
does not prove LinkedIn's Post control, platform acceptance, publication,
permalink discovery, author/content/time matching or canonical `PUBLISHED`.
The existing final-submit path remains fail-closed until a fresh authorized
LinkedIn session and a separate real-platform acceptance run exist. Transport
selection remains deterministic and cannot change after durable submit intent.

## Safety

- LinkedIn Post clicks: 0
- Social mutations: 0
- Historical UNKNOWN executions mutated: 0
- Canonical runtime mutated: 0
- Credentials, cookies, tokens and session material persisted: 0

See `live-evidence.json` for machine-readable evidence and the exact protected
execution IDs.

The focused transport/LinkedIn/JEV gate is 106/106. The current full Node suite
is 527 total, 525 passed, 0 failed and 2 skipped. The configured ORCA executable
and connected daemon both match the pinned version 1.4.229 in read-only probes. An earlier direct ORCA probe
remains historical failure evidence (`chrome-error://chromewebdata/` followed
by `browser_stale_ref`); the later clean localhost run used a fresh tab and
fixture server and independently observed all 20 reversible transitions.

## 2026-10-19 audit reconciliation

Read-only runtime audit confirmed ORCA `1.4.229` and reran the focused
transport/LinkedIn/JEV tests (`106/106` passed). The current full Node suite is `527 total,
525 passed, 0 failed, 2 skipped`; the machine-readable evidence was corrected
from older milestone checkpoints. This remains local reversible-fixture
certification only. No LinkedIn or other social control was clicked, and no
canonical state or historical UNKNOWN execution was changed.
