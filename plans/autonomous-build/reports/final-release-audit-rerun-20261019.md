# SUPERSEDED — historical final release audit rerun (2026-10-19)

> This dated audit predates the current release reconciliation. Its 509/507
> figures are historical evidence only; the current release gate is 527/525/0/2.

## Status

`PASS (bounded)`

Read-only verification after journal reconciliation on branch
`integration/autonomous-build`, HEAD `168c912cb546270dbcb6aaeb29dc125ba8c77e8f`.
No source, journal, canonical runtime, browser, ORCA, network, credential, or
social state was modified.

## Acceptance and evidence (historical)

### Current snapshot test count

Current (non-historical) release snapshots now consistently report **509 total,
507 passed, 0 failed, 2 skipped** (`509/507/0/2`), including
`current-state.md`, `final-report.md`, `product-readiness.md`, `master-plan.md`,
`blocker-ledger.json`, transport reports, and the latest gate reconciliation.
Older counts such as 500/498, 488/486, and 428/426 remain in milestone or
historical evidence rows; they are not presented as the current release gate.

### Integration ledger and transport evidence

`integration-ledger.json` current entries are semantically consistent:

- `full_node_suite_latest` and `full_node_suite_current_release`: 509/507/0/2
  at the time of this historical audit, exit code 0;
- `browser_transport_full_node_suite_latest`: 509/507/0/2;
- focused transport/LinkedIn/JEV gate: 98/98;
- ORCA 1.4.229 reversible fixture activation: 10/10 accessibility and 10/10
  pointer, with no irreversible submit.

`plans/browser-interaction-transport-certification/live-evidence.json` records
`fullNodeSuite` 509/507/0/2, zero social mutations, zero final Post clicks,
`historicalUnknownMutated: false`, `canonicalRuntimeMutated: false`, and the
correct boundary that reversible composer control activation is proven while
irreversible final-submit certification is not.

### Blockers and readiness

`blocker-ledger.json` retains the four accurate blockers:

- `LIVE-LINKEDIN-AUTH-001`: external hard blocker;
- `ORCA-TRANSPORT-LIVE-CERT-001`: open irreversible transport/publication
  blocker;
- `METRICS-CHECKPOINT-LIVE-001`: quarantined live observability gap;
- `PRODUCT-FACTORY-SANDBOX-001`: open audited-sandbox gap.

`product-readiness.md` correctly remains `Full production readiness: BLOCKED`
and `Autonomous irreversible publication: BLOCKED`; local transport, factory,
metrics, and advisory projections are not upgraded to live proof. One older
Product Factory row still includes `full 498/496/0/2` as a milestone-specific
focused-history value; it does not claim to be the latest full release gate.

### Canonical runtime and UNKNOWN immutability

Read-only `/health` reports schema 8, revision 194. The canonical state SHA-256
is `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
There are zero active campaign authorizations, one-time windows, live grants,
or execution leases (authorization statuses: 5 expired, 3 paused, 2
superseded; windows: 7 consumed; grants: 4 consumed and 3 revoked).

Four UNKNOWN submission records remain, with unchanged protected execution IDs:

`ce9cfc41-528b-425f-9dee-ab2563b50ed3`,
`0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`,
`c2265ddf-4384-4339-a26b-4949b6a12af9`, and
`8e058f6e-5f67-4078-99bf-6cf86e1b62d7`.

No retry or mutation was performed.

### Static checks

- `node --check src/*.mjs`: PASS.
- `git diff --check`: PASS.

## Limitations

This rerun did not execute `npm test`, browser/ORCA actions, live provider
calls, or any mutation. It verifies recorded current gates and read-only
runtime metadata. Live LinkedIn submit, acceptance, permalink verification,
live metrics, and an audited Product Factory sandbox remain unproven.

## Final verdict

`PASS (bounded)`: current release snapshots, integration latest gates, transport
boundary, blocker/readiness status, canonical hash/revision, and UNKNOWN
immutability are consistent after reconciliation. Release remains blocked for
live external distribution pending fresh exact authorization and real
irreversible platform proof.
