# Transport boundary re-review — 2026-10-19g

Worktree: `/Users/nam/Documents/marketing-seeding-integration`
Scope: post-patch certified transport selection, identity immutability, and durable submit evidence. Read-only.

## Verdict

**REWORK** before accepting the irreversible-submit boundary.

## Verified fixes

- `selectCertifiedTransport` now requires exact provider and providerVersion equality across runtime, certification, and transport, and rejects non-`IRREVERSIBLE_LINKEDIN_SUBMIT` records when strict mode is enabled (`src/browser-interaction-transport.mjs`).
- Adapter production path selects from the configured candidate set before the durable intent callback; server supplies ORCA accessibility/pointer candidates and external certification records with strict mode enabled.
- Full `{transport, provider, providerVersion}` identity is sent to the worker/service and compared after durable intent; a same-ID provider-version mutation test proves zero click.
- Worker calls `beginExecutionSubmitIntent` before browser input and stores transport/control evidence; UNKNOWN/no-second-click and historical quarantine paths remain intact.

## Remaining finding

### P1 — service-side submit-control fingerprint/evidence is still not fail-closed

`normalizeSubmitIntentEvidence` (`src/service.mjs`) accepts any non-empty `controlIdentity` up to 128 characters and accepts null/invalid geometry fields. `beginExecutionSubmitIntent` only requires `controlIdentity`, `actionable === true`, and `composerMatched === true`. It does not require:

- a SHA-256 control fingerprint;
- `connected`, `visible`, `enabled`, and `hitTargetMatched` all true;
- a non-null positive bounding box;
- a positive ownership proof (`composerCount === 1`, `ownedControlCount === 1`, `controlBelongsToComposer === true`);
- payload/visibility matching evidence in the persisted object.

The adapter currently supplies valid evidence, so this is not an observed bypass in the tested adapter path. It is nevertheless a public service contract that claims durable pre-submit evidence and can be called by another worker/adapter. A malformed evidence object could be committed as submit intent while satisfying `requireTransportCertification`.

Required: validate the fingerprint format and required geometry/ownership booleans at the service boundary, or make the service method private/internal and prove only the adapter can invoke it. Add a regression asserting malformed evidence is rejected before `SUBMIT_SENT_INTENT` persistence.

## Checks run

```text
npm test -- --test-name-pattern='transport identity mutation|certified transport selection|irreversible submit|submit intent'
```

All matching tests passed (output harness-truncated, no failures reported), including exact provider selection, strict irreversible scope, same-ID version mutation, no click after post-intent mismatch, idempotency and UNKNOWN behavior.

```text
git diff --check
node --check src/browser-interaction-transport.mjs
node --check src/linkedin-adapter.mjs
node --check src/service.mjs
```

All passed. No browser/social/canonical-state mutation or credentials accessed.
