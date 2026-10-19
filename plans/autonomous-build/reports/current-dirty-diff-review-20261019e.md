# Independent current dirty diff review — 2026-10-19e

Repository/worktree: `/Users/nam/Documents/marketing-seeding-integration`
Branch: `integration/autonomous-build`
Review scope: uncommitted source/tests/UI changes; canonical state and browser were not modified.

## Verdict

**REWORK** for an irreversible live-submit release. The standing authority and safety contracts are materially stronger and the local regression suite passes, but the LinkedIn adapter does not actually enforce certified transport selection at its submit boundary.

## Findings

### P0 — certified transport registry/selection is not wired into the live LinkedIn path

`LinkedInAdapter` constructs `new OrcaAccessibilityTransport(browser)` by default (`src/linkedin-adapter.mjs:440-447`) and only calls `assertValidatedTransport`. There is no call from the adapter/worker path to `selectCertifiedTransport`, and no certification record/policy is passed into the adapter. Therefore a transport can be marked with the structural validation contract and still be used without a persisted/reviewed certification record or exact platform/runtime certification. The deterministic selector exists in `src/browser-interaction-transport.mjs:170-185`, but is currently test-only/unreferenced by production code.

Impact: the stated invariant “future irreversible submit uses one transport certified for this runtime/platform” is not enforced. The local 10/10 reversible fixture calibration cannot by itself authorize the live path.

Required disposition: wire the existing selector/certification input into the execution seam (or fail closed when no certified selection is supplied), preserve the selected transport identity in the execution request/intent, and test the worker-to-adapter path.

### P1 — transport switch guard is invoked with `intentPersisted: false`

`LinkedInAdapter.submit` calls `assertTransportCannotChangeAfterIntent` at `src/linkedin-adapter.mjs:742` with `intentPersisted: false`, immediately after durable intent is persisted (`:731-732`). This makes the post-intent branch of the guard unreachable. The current adapter instance normally retains one transport object, but the explicit invariant is not enforced at the point where it matters and a mutable/injected transport selection could change without a rejection.

Required disposition: compare the persisted transport identity against the current transport after intent and invoke the guard with the persisted-intent state (or equivalent immutable selection token). Add a regression test that mutates/changes the requested transport after `beforeSubmitIntent` and proves no second/fallback transport input occurs.

### P1 — structural validation contract is weaker than certification

`assertValidatedTransport` accepts any duck-typed object exposing `click`, `transportContractVersion === 1`, `requiresPreClickValidation === true`, and `assertPreClickValidation` (`src/browser-interaction-transport.mjs:199-205`). `BrowserInteractionTransport` itself satisfies this contract while its default `assertReadyForFinalSubmit()` only returns identity and performs no runtime/version/certification check. This is useful as a transport abstraction but is insufficient as the live irreversible-submit gate unless it is paired with the certified selection check above.

Required disposition: keep this as a lower-level interface check, but require the selected transport to carry a matching certified record and exact runtime identity before `beforeSubmitIntent`; fail closed on custom/unregistered transports.

## Positive evidence

- Standing autonomous authorization validation is bounded: campaign/authorization binding, target/account/profile, readiness, schedule/rate limits, one-time window, execution grant, lease and idempotency are checked in the existing service/delegation code.
- `UNKNOWN` and `SUBMIT_RESULT_UNKNOWN` are treated as terminal quarantine paths; dispatch code refuses unresolved submissions and historical records are not rewritten by the reviewed changes.
- The adapter captures pre-submit control ownership/content/visibility/geometry and performs a final control revalidation before provider input.
- `COMMAND_COMPLETED`, activation, acceptance, and independent publication verification remain represented as separate evidence layers.
- Account-pool projection is read-only and does not rebind execution authority; UI Mission Control controls observed in `ui/src/App.tsx` are read-only/advisory (no publish/approval action was found).
- ORCA executable/connected runtime version pinning is implemented in `OrcaCliClient.assertRuntimeVersion` and covered by tests.

## Verification run

Command (focused, read-only):

```text
npm test -- --test-name-pattern='transport|standing autonomous delegation|account candidate|historical UNKNOWN|duplicate'
```

Result: all matching tests passed (including standing delegation, transport calibration/selection, ORCA version probes, account candidate/pool, duplicate and UNKNOWN protections). The command output was truncated by the harness, but no failing test was reported.

No live LinkedIn action, browser input, canonical state mutation, credential/session access, or external side effect was performed.

## Review conclusion

**REWORK** before claiming a certified irreversible-submit lane. Do not weaken UNKNOWN quarantine or add a second browser abstraction; wire the already-present certification selector into the existing LinkedIn execution seam and close the post-intent transport immutability gap, then rerun the full suite and live acceptance gate only with fresh external authorization.
