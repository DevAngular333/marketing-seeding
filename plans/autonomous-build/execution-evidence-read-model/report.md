# Execution Evidence Read Model

## Outcome

The existing Mission Control read paths now expose a bounded, deterministic
`executionRuntime` projection built from existing execution requests,
receipts, campaign rehearsal markers and submission uncertainties. It is
read-only and adds no store, schema, worker, adapter, router, authority path or
mutation route.

The projection keeps `DRY_RUN`, `LIVE` and unknown mode evidence separate,
reports state/phase/submit-state counts, shows recent hashed execution/post
references, caps blocker and recent-row output, and marks UNKNOWN records as
immutable quarantine observations. A permalink is exposed only when a receipt
contains independent VERIFIED evidence: confirmed submit, verification
timestamp/method, account/target/content matches, author/content matches,
stable post identity, timestamp match and matching permalink.

`COMMAND_COMPLETED`, `SUBMIT_SENT`, `CONFIRMED` without independent evidence,
and `DRY_RUN_COMPLETE` never become publication proof.

## Changed paths

- `src/service.mjs` — pure `projectExecutionRuntime(state)` projector and the
  existing dashboard read model field.
- `src/server.mjs` — the existing `/health` read response exposes the same
  projection.
- `test/service.test.mjs` — dry-run/live/UNKNOWN separation, verification
  strictness, redaction, bounds, deterministic order and legacy UNKNOWN rows.
- `test/server.test.mjs` — health/dashboard equality and byte-for-byte
  read-only GET proof.

## Verification evidence

- Focused service/server gate: **72 passed, 0 failed, 0 skipped**.
- Full Node suite: **456 total, 454 passed, 0 failed, 2 skipped**.
- UI typecheck: `cd ui && npx tsc --noEmit` passed.
- UI build: `cd ui && npm run build` passed; only existing Vite config warnings.
- Source syntax and `git diff --check` passed.
- Canonical read-only inspection: schema `8`, revision `194`, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Canonical projection observed 8 requests, 1 dry-run completion, 4 UNKNOWN
  rows, 0 independently verified publications and no exposed permalink.
- Protected UNKNOWN executions and uncertainty remained unchanged.

## Safety result

The projection performs no store mutation. It hashes execution/post references,
omits raw IDs, content, account/profile/session material and receipt payloads,
and caps output. It does not reconcile, retry, dispatch, click, open a browser,
contact a provider or publish. Existing UNKNOWN quarantine remains authoritative
and immutable in this read model.

## Limitations

This milestone is local evidence/read-model work. It does not certify ORCA,
prove a real LinkedIn submit, activate a platform control, verify a live post,
implement account recovery or add a dashboard control. Live LinkedIn proof
remains blocked by unavailable ORCA and absent fresh exact live
authorization/window/grant/session input.
