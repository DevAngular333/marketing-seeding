# Autonomous Product Distribution & Growth OS — Acceptance

## Requirements

- **A1** Preserve the existing marketing-seeding execution and safety contracts: atomic persistent state, schema/revision/audit history, writer lease, campaign authorization, bounded quotas/cadence/concurrency, exact account/profile/target/content/visibility binding, one-time execution windows, execution-scoped grants, durable submit intent, exact dispatch, UNKNOWN quarantine, publication verification, and no per-post dashboard approval step.
- **A2** Implement standing campaign authorization with autonomous bounded execution delegation by reusing existing authorization, window, grant, lease and queue contracts; do not create a second campaign store, router, state machine, browser abstraction, LinkedIn publisher, or System-Agentic Core architecture.
- **A3** Add machine-readable product intelligence for what the product is, the problem it solves, why it is better, audience, supported/unsupported claims, and an evidence/claim relationship without inventing evidence.
- **A4** Add a repository/product classifier and bounded local product factory pipeline that can inspect, build/run/render where safe, and persist useful artifact evidence without external mutation.
- **A5** Preserve the exact distinction `COMMAND_COMPLETED != CONTROL_ACTIVATED != SUBMISSION_ACCEPTED != PUBLICATION_VERIFIED`; any uncertain post-submit state remains quarantined and is never blindly retried.
- **A6** Keep SYSTEM_AGENTIC_AI Core frozen; define and implement only the marketing-seeding domain boundary and any versioned handoff needed by this repository.
- **A7** Maintain an evidence-first project journal and blocker ledger so another session can resume from repository/runtime facts.
- **A8** Run focused regression and the complete existing Node test suite after integration, with zero new failures; label SYNTHETIC, LOCAL_REAL, LIVE_REAL_WEBSITE, OFFICIAL_API, and MANUAL_EXTERNAL evidence accurately.
- **A9** Do not perform external publish, comment, message, like, follow, connect, login, logout, credential change, or other social mutation. A real LinkedIn publish remains an isolated lane requiring fresh exact authorization and is not claimed by local tests.
- **A10** Keep the canonical runtime state and all historical UNKNOWN executions immutable; workers use isolated fixtures/state and never the production browser profile.

## Constraints

- **C1** Preserve unrelated dirty hardening work already present in the marketing-seeding worktree; never reset, overwrite, or discard it.
- **C2** Never print or persist passwords, API secrets, cookies, auth/session tokens, or browser storage material; redact as `credential/session material exists` if discovered.
- **C3** No worker may mutate `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`, production port `127.0.0.1:4318`, or the authenticated ORCA profile.
- **C4** No architecture change or feature implementation in `/Users/nam/Documents/System-Agentic_AI` Core; reference files are read-only unless a shared-core defect is independently demonstrated.
- **C5** No live external side effect is allowed in this wave. Any live blocker must be isolated and recorded as an external hard blocker while local/synthetic work continues.
- **C6** Worker ownership is disjoint. A worker changing a shared/frozen contract must return `CONTRACT_CHANGE_REQUIRED` rather than silently editing it.
- **C7** A builder cannot be the final verifier. Every accepted worker change receives an independent read-only review and a post-integration gate.
- **C8** Keep reports concise, evidence-linked, and explicit about unverified behavior; plans and worker claims are not proof.

## Verification criteria

- **V1** Git HEAD, dirty paths, runtime PID/listener, canonical state schema/revision/hash/counts, and historical UNKNOWN IDs are pinned before worker dispatch.
- **V2** Standing authorization/delegation focused tests prove bounded derivation, exact binding, revocation/kill switch, quota/cadence/concurrency, one-time execution, grant consumption, idempotency and UNKNOWN immutability.
- **V3** Product intelligence tests prove evidence-linked outputs, unsupported claim rejection, deterministic normalization, and restart-safe persistence.
- **V4** Product factory tests prove safe repository classification, isolated build/run/artifact evidence, failure recording, and no external mutation.
- **V5** Independent read-only review confirms worker diffs stay within ownership, reuse existing seams, do not weaken safety, and contain no secrets or side effects.
- **V6** Full `node --test test/*.test.mjs` completes after integration with zero failures; any skips are reported.
- **V7** A live LinkedIn publish is not claimed unless a fresh exact campaign authorization, one-time window, execution-scoped grant, exact account/profile/session readiness, autonomous submit, activation, acceptance, independent publication discovery, and normalized VERIFIED receipt all exist. With current runtime, classify this lane as `LIVE_PROOF_BLOCKED`.
- **V8** Project journal files and milestone reports identify what is implemented, locally verified, live verified, partial, design-only, not implemented, and blocked.
