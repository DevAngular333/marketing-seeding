# Execution Evidence Read Model

## Requirements

- **A1** Reuse existing state and execution contracts; add no store, schema
  migration, state machine, provider router, worker or adapter.
- **A2** Project deterministic bounded dry-run/live/state/phase/submit and
  UNKNOWN evidence counts.
- **A3** Hash execution/post references, omit raw payload/account/profile data,
  cap rows and expose a permalink only for structurally independent VERIFIED
  evidence.
- **A4** Preserve UNKNOWN quarantine as immutable read-only evidence; GET paths
  never reconcile or retry.
- **A5** Include the projection in existing dashboard and health responses
  without changing mutation or authorization semantics.
- **A6** Keep `DRY_RUN_COMPLETE` and transport/acceptance states distinct from
  publication verification.

## Constraints

- **C1** No ORCA, browser, network, credential or social action.
- **C2** Do not mutate canonical state or protected UNKNOWN records.
- **C3** Keep `SYSTEM_AGENTIC_AI` Core frozen.
- **C4** Do not expose raw execution IDs, post IDs, content, profiles, tokens,
  state paths or receipt payloads in the projection.

## Verification

- **V1** Pure projection tests cover separation, strict verification,
  redaction, bounds and deterministic ordering.
- **V2** Local rehearsal evidence shows `DRY_RUN_COMPLETE` and
  `NOT_STARTED` with no permalink.
- **V3** Health and dashboard expose the same projection and GETs do not write.
- **V4** Focused tests, syntax/diff checks, UI typecheck/build and full Node
  suite pass with zero new failures.
- **V5** Canonical state hash/revision and protected UNKNOWN identities are
  unchanged.
