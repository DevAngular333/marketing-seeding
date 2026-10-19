# Current post-patch dirty diff review — 2026-10-19f

Worktree: `/Users/nam/Documents/marketing-seeding-integration`
Scope: certified transport wiring, durable submit intent bindings, UNKNOWN/no-second-click semantics. Read-only review; no source/state/browser changes.

## Verdict

**REWORK** before live irreversible-submit certification.

## Findings

### P1 — post-intent transport immutability compares only transport name

`LinkedInAdapter.submit` persists the full `selectedTransportIdentity`, but then extracts only `.transport` from the callback result (`src/linkedin-adapter.mjs:763`) and invokes `assertTransportCannotChangeAfterIntent` using that short name. A transport with the same name but changed provider/providerVersion can pass after intent. The durable request stores `{transport, provider, providerVersion}` (`src/service.mjs:80-91, 4377`), so the guard should compare the complete immutable identity (and ideally certification scope/fingerprint), not only the name. Add a regression where providerVersion changes under the same transport ID and prove zero browser input.

### P1 — certification selection checks version but not provider identity

`selectCertifiedTransport` checks platform, certification scope, and exact runtime/record/transport versions, but does not require `record.provider === identity.provider === runtime.provider` (`src/browser-interaction-transport.mjs:170-191`). A forged/misconfigured certification record with an ORCA version but a different provider can therefore authorize the transport. Exact provider identity is part of the transport runtime identity and should be required for an irreversible path.

### P2 — durable submit intent evidence validation is presence-based at service boundary

`beginExecutionSubmitIntent` requires a `controlIdentity`, `actionable`, and `composerMatched`, but normalized evidence does not validate a SHA-256 control identity or require `connected`, `visible`, `enabled`, and `hitTargetMatched` (`src/service.mjs:4253-4258`). The adapter's own `assertClickPreflight` supplies these checks, so this is defense-in-depth rather than an observed bypass, but the durable intent contract should reject malformed evidence if a different adapter/worker calls the service.

## Positive findings

- Production server now passes both ORCA accessibility and pointer candidates plus external certification records and sets `requireCertifiedTransport: true`; absence of an explicit irreversible LinkedIn certification fails closed.
- Adapter invokes certification selection before `beforeSubmitIntent`, performs runtime pin checks, persists full transport/control evidence via worker callback, and rechecks transport immutability after intent.
- Historical UNKNOWN and unresolved-submission checks remain blocking; no automatic second click path was introduced.
- Worker persists intent atomically before provider input and forwards certification/evidence fields. UI remains read-only.

## Tests

Focused command:

```text
npm test -- --test-name-pattern='transport|submit intent|unknown|duplicate|certified|no second|historical'
```

Result: all matching tests passed; no failures reported (output was harness-truncated). This includes certification fail-closed, same-ID mutation test (transport name), standing delegation, idempotency, UNKNOWN quarantine and no-second-click regressions.

No live LinkedIn action, browser input, credential/session access, canonical state mutation, or external side effect was performed.

## Required fixes before ACCEPT

1. Compare the complete persisted/current transport identity after intent (at least transport, provider and providerVersion; preferably certification fingerprint/scope).
2. Require exact provider match in certified transport selection for irreversible submits.
3. Strengthen service-side durable pre-submit evidence validation or document an explicit invariant that only the adapter can call it, with a regression covering malformed evidence.
