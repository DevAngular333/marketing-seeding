# SUPERSEDED — historical checkpoint audit (2026-10-19)

> This dated audit predates the current release reconciliation. Its 515/513
> figures are historical evidence only. The current release gate is 527/525/0/2.

## Scope

Read-only audit of release-facing snapshots and JSON ledgers in the dirty
`integration/autonomous-build` worktree. Latest verified release gate is:

- `npm test`: **515 total, 513 passed, 0 failed, 2 skipped** (`515/513/0/2`)
- focused transport/LinkedIn/JEV gate: **98/98**
- ORCA: **1.4.229**, accessibility and pointer reversible control activation
  each **10/10**; irreversible LinkedIn final-submit certification remains
  unproven.

No source, runtime, browser, ORCA, credential, canonical state, social state,
or historical UNKNOWN record was modified.

## Findings

### Current release snapshots — consistent

The following current release snapshots already report `515/513/0/2` and the
correct live-proof boundary:

- `plans/autonomous-build/current-state.md`
- `plans/autonomous-build/master-plan.md`
- `plans/autonomous-build/final-report.md`
- `plans/autonomous-build/product-readiness.md`
- `plans/autonomous-build/blocker-ledger.json`
- `plans/autonomous-build/integration-ledger.json` latest/current-release gate
  entries
- `plans/browser-interaction-transport-certification/live-evidence.json`
- `plans/browser-interaction-transport-certification/report.md`
- `plans/browser-interaction-transport-certification/regression-results.md`
- current milestone snapshots under `plans/autonomous-build/`

The ledgers preserve historical milestone counts in evidence strings while
marking them as historical; this is correct and should not be rewritten.

### Stale or potentially misleading records

1. `plans/autonomous-build/reports/final-release-audit-rerun-20261019.md`
   describes `509/507/0/2` as the current non-historical release snapshot and
   states integration-ledger/live-evidence values were reconciled to 509. This
   report is itself a dated audit record, but its wording is inconsistent with
   the later verified `515/513/0/2` release and can mislead a reader treating it
   as current. Treat as superseded historical evidence or append an explicit
   superseded banner; do not use its 509 values as release truth.

2. `plans/autonomous-build/reports/final-dirty-diff-review-20261019c.md`
   records the earlier reconciliation problem (`509/507/0/2` versus 515) and
   requests rework. It is accurately an earlier review artifact, not a current
   gate. Keep as historical evidence; do not copy its stale count into current
   snapshots.

3. `plans/autonomous-build/reports/final-release-audit-20261019.md` and
   `plans/autonomous-build/reports/journal-release-gate-20261019.md` contain
   earlier 509/507, 500/498, 488/486, or older counts. Their dated scope and
   historical wording make them audit history, but readers must not interpret
   those values as latest release status.

4. `plans/autonomous-build/integration-ledger.json` has
   `checkpointCommit: "working-tree:execution-timeline-mission-control+latest-500-test-reconciliation"`.
   This is a checkpoint label, not a test result, and the ledger's latest gate
   entries correctly report 515/513/0/2. It is stale naming only and should not
   be treated as current test evidence.

### ORCA status consistency

No current snapshot claims irreversible certification. The correct boundary is:

- ORCA 1.4.229 executable is available.
- Accessibility and pointer transports are locally certified for reversible
  semantic activation (10/10 each; zero wrong-target/no-transition cases).
- Real LinkedIn Post activation, platform acceptance, independent publication
  discovery, permalink/post ID, and VERIFIED receipt remain **NOT_PROVEN**.
- No Post/Publish click, social mutation, canonical runtime mutation, or
  historical UNKNOWN mutation occurred.

## Recommended disposition

- Use the current reconciled `527/525/0/2` release gate; retain 515/513 only
  as historical evidence.
- Keep older counts only in dated milestone/audit evidence, explicitly
  historical or superseded.
- Preserve the open external authorization and irreversible-submit blockers;
  standing delegation and local ORCA calibration do not resolve them.
- No source or runtime change is required by this audit.

## Audit result

`PASS (bounded)`: current release snapshots and machine-readable ledgers are
consistent with the latest 515/513/0/2 gate. Remaining stale values are in
older dated audit/checkpoint records and are historical context, not current
release claims.
