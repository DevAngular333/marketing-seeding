# SUPERSEDED — historical journal/runtime reconciliation (2026-10-19)

> This dated reconciliation predates the current release gate. Its 520/518
> figures are historical evidence only; the current gate is 527/525/0/2.

## Scope

Read-only reconciliation at integration HEAD `5519b80`. No source, canonical
runtime, browser/session, credentials, social state, or UNKNOWN records were
modified.

Fresh full gate:

- `npm test`: **520 total, 518 passed, 0 failed, 2 skipped** (`520/518/0/2`)
- focused transport/LinkedIn/JEV gate after version pinning: **103/103**
- ORCA executable and connected daemon: **1.4.229**, ready/connected
- irreversible LinkedIn submit/publication: **unproven; no Post click**

## Historical findings (superseded by the current 527/525/0/2 gate)

1. `plans/autonomous-build/master-plan.md:9` still says latest full suite
   `515/513/0/2`; update to `520/518/0/2`.
2. `plans/autonomous-build/master-plan.md:92` still says latest full suite
   `515/513/0/2` and transport/LinkedIn/JEV `98/98`; update to
   `520/518/0/2` and `103/103`.
3. `plans/autonomous-build/final-report.md:134` says candidate projection used
   full `515/513/0/2`; this is a historical sub-milestone statement if retained,
   but should be explicitly labelled historical or updated to current release
   wording. `final-report.md:139` similarly says current full suite
   `515/513/0/2`; update to `520/518/0/2`.
4. `plans/autonomous-build/milestone-ledger.json:57` records the browser
   transport focused gate as `98/98`; this is the earlier transport milestone.
   Retain only if clearly historical; the current ORCA runtime-pinning gate is
   recorded at `103/103` in the latest artifacts.
5. `plans/autonomous-build/milestone-ledger.json:257` and `:267` retain
   `current release gate 515/513/0/2` in prior milestone evidence. These are
   historical milestone snapshots and should not be changed unless the journal
   policy requires explicit `historical` labels.
6. `plans/autonomous-build/integration-ledger.json:1315-1323` has an older
   `browser_transport_full_node_suite_latest` entry at `515/513/0/2`, while
   `:1371-1379` has another `full_node_suite_latest` entry at the same stale
   count. The latest current-release entry is `:1456-1464` at `520/518/0/2`.
   Duplicate entries should either be marked historical or reconciled so
   consumers do not select the older duplicate by name.
7. `plans/autonomous-build/integration-ledger.json:1351-1368` contains the
   ORCA fixture record with `focusedTransportTests: 103` but a string
   `fullNodeSuite: "520/518/0/2"`; this is internally consistent with the new
   gate. The adjacent older `browser_transport_full_node_suite_latest` entry
   remains the stale duplicate described above.
8. `plans/autonomous-build/integration-ledger.json` latest `orca_runtime_version_pinning_latest`
   entry (`:1470-1491`) is the authoritative current ORCA record: focused
   `103/103`, full `520/518/0/2`, exact executable/connected version `1.4.229`,
   no irreversible submit or mutation.

## Already consistent current snapshots

These current-facing records report `520/518/0/2` and `103/103` correctly:

- `plans/autonomous-build/current-state.md`
- `plans/autonomous-build/product-readiness.md`
- `plans/autonomous-build/browser-transport-certification/report.md`
- `plans/autonomous-build/browser-transport-certification/regression-results.md`
- `plans/browser-interaction-transport-certification/live-evidence.json`
- `plans/autonomous-build/orca-runtime-version-pinning/test-results.md`
- `plans/autonomous-build/reports/latest-gate-reconciliation-20261019.md`

## Runtime and safety boundary

The fresh run completed **520/518/0/2**. Existing UNKNOWN quarantine and
exact-once protections remain intact. ORCA runtime pinning is locally verified
for the configured executable and connected daemon, but this does not certify
irreversible LinkedIn submit, platform acceptance, independent discovery,
permalink/post ID, or VERIFIED publication. No external mutation occurred.

## Result

`PASS (bounded)`: stale current-looking references are identified above. The
authoritative latest release artifacts are consistent at `520/518/0/2` and
`103/103`; stale references are limited to older duplicate or milestone journal
entries, with the master-plan and final-report current summaries requiring
reconciliation.
