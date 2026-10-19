# Transport boundary final strict-evidence review — 2026-10-19h

Worktree: `/Users/nam/Documents/marketing-seeding-integration`
Scope: service-side durable submit evidence validation after the prior REWORK. Read-only review; no browser/social/canonical state mutation.

## Verdict

**ACCEPT** for this boundary (live publication remains separately unproven until fresh external authorization and real acceptance evidence exist).

## Evidence

`src/service.mjs:130-164` now defines strict `hasSubmitControlEvidence` validation. In strict certified mode, `beginExecutionSubmitIntent` (`src/service.mjs:4279-4285`) rejects before state mutation unless evidence contains:

- a SHA-256 control fingerprint;
- connected, visible, enabled, actionable, hit-target and non-busy control state;
- `composerState === "OPEN"` and `composerMatched === true`;
- positive finite geometry;
- single composer/editor/owned-control counts;
- explicit control-to-composer ownership;
- payload and visibility match;
- SHA-256 editor/expected payload hashes and structural evidence version >= 1.

The rejection occurs before `execution_submit_intent_persisted`, so malformed input cannot consume the grant or move the post to `SUBMIT_SENT_INTENT`.

Regression coverage exists in `test/live-execution-grant.test.mjs` (`certified durable submit intent rejects malformed or non-actionable control evidence at the service boundary`) for invalid fingerprint, disconnected/hidden/disabled/covered/non-actionable/wrong-composer evidence, and asserts request remains `REQUEST_READY`, grant remains `ACTIVE`, and no publication attempt is created.

## Focused and full checks

```text
npm test -- --test-name-pattern='submit-control evidence|bad identity|irreversible submit|transport identity mutation'
```

Passed; no failures reported.

```text
npm test > /tmp/mse-full-test.log 2>&1
```

Result: **527 tests, 525 passed, 0 failed, 2 skipped** (30.064s).

```text
git diff --check
node --check src/browser-interaction-transport.mjs
node --check src/linkedin-adapter.mjs
node --check src/service.mjs
```

All passed.

## Safety assessment

The previous durable-evidence gap is closed. Strict validation is defense-in-depth around the adapter's pre-submit checks and preserves fail-closed behavior, exact-once grant consumption, and UNKNOWN quarantine. No second-click or historical UNKNOWN mutation path was introduced or observed.

Remaining limitation: this certifies the local transport/governance boundary only; it does not constitute LIVE_REAL_WEBSITE LinkedIn publication proof.
