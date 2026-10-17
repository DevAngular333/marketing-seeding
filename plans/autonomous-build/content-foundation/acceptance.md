# Content foundation acceptance

## Requirements
- A1 derive deterministic channel drafts from persisted READY product intelligence and an existing story/targets.
- A2 include bounded content, target, claim/evidence refs, deterministic content identity, draft status.
- A3 no authority/grant/window/lease/execution/browser/provider side effects.
- A4 reuse SeedingService and existing channel draft persistence.
- A5 bound outputs and redact secrets.
- A6 regression tests cover determinism, fail closed, policy limits, persistence and side effects.
- A7 preserve LinkedIn/JEV/ORCA/UNKNOWN semantics and frozen core.

## Constraints
- C1 fixture/local only; no network or social mutation.
- C2 no schema migration or new store/router/state machine.
- C3 owned paths limited to content module, additive service/server route, tests and plan artifacts.

## Verification
- V1 focused content tests pass.
- V2 syntax and diff checks pass.
- V3 full suite has no new failures.
