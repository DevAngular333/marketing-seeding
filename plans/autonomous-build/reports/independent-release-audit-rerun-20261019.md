# Independent Release Audit Rerun — 2026-10-19

## Scope

Read-only audit of `/Users/nam/Documents/marketing-seeding-integration`, branch
`integration/autonomous-build`, HEAD `5519b80c8e12a71427ef93b937885b89262bf08b`.
No source, canonical state, browser, credential, external, social, or UNKNOWN
mutation occurred.

## Verification

- Fresh `npm test`: **527 total, 525 passed, 0 failed, 2 skipped**, exit 0.
- Fresh focused subset (`browser-interaction-transport`, `click-transport`,
  `linkedin-verification`, `jev-execution-worker`): **106 total, 106 passed,
  0 failed, 0 skipped**, exit 0. The authoritative current focused safety /
  transport / authority / continuity gate is **151/151**; the 106 run is a
  passing subset, not a contradictory result.
- `node --check src/*.mjs`: PASS (exit 0).
- `git diff --check`: PASS (exit 0).
- UI production build (`cd ui && npm run build`): PASS (Vite build).
- UI typecheck: PASS via the repository's direct compiler command:
  `cd ui && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`.

Current-facing release snapshots now report the current full suite
**527/525/0/2**. Superseded overlays retain older counts with explicit
historical banners. The 106 focused run is a passing subset of the current
151/151 authoritative gate, so no release-count drift remains.

## Canonical runtime

Read-only state path: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`.

- SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`
- `schemaVersion`: 8; `revision`: 194
- campaigns 7; campaign authorizations 10; live grants 7; one-time windows 7
- execution leases 0; posts 7; published posts 0; UNKNOWN submissions 4

The runtime revision/hash remains consistent with prior release evidence.

## UNKNOWN immutability

The four UNKNOWN execution IDs remain unchanged and quarantined:

- `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`
- `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`
- `c2265ddf-4384-4339-a26b-4949b6a12af9`
- `ce9cfc41-528b-425f-9dee-ab2563b50ed3`

No retry, reconciliation, or state write was performed.

## Blocker status

From `plans/autonomous-build/blocker-ledger.json`:

- `ORCA-RUNTIME-CONFIG-001`: RESOLVED
- `LIVE-LINKEDIN-AUTH-001`: EXTERNAL_HARD_BLOCKER
- `ORCA-TRANSPORT-LIVE-CERT-001`: OPEN
- `METRICS-CHECKPOINT-LIVE-001`: QUARANTINED
- `PRODUCT-FACTORY-SANDBOX-001`: OPEN
- `RELEASE-JOURNAL-DRIFT-001`: RESOLVED; current snapshots and latest
  machine-readable entries have been reconciled, and older audit reports are
  explicitly superseded.

## Verdict

**Runtime and safety: PASS (bounded). Release journal: RECONCILED.** Tests and
build pass with zero failures; canonical hash/revision and UNKNOWN quarantine are
stable. Live publication, metrics, and audited sandbox blockers remain
correctly open.
