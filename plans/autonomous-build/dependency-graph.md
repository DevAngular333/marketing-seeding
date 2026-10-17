# Dependency Graph

```text
Existing JsonStore/schema/audit + authority/window/grant/lease contracts
  ├─> Standing campaign authorization / bounded delegation
  │     └─> future autonomous LinkedIn publish + independent verify (LIVE lane)
  ├─> Product intelligence contracts + evidence/claim graph
  │     └─> strategy/content safety
  └─> Product classifier/factory + artifact evidence
        └─> product intelligence grounding

SYSTEM_AGENTIC_AI Core (frozen, read-only)
  └─> future versioned handoff boundary

Later, after the first wave:
  discovery → audience/channel intelligence → strategy/NBA → content
  account/session runtime → execution adapters → verification → metrics/learning
```

## Safe parallelism

- Worker A: authority/delegation, owns only new delegation module and its tests.
- Worker B: product intelligence/evidence, owns only new product intelligence module and tests.
- Worker C: product factory/classifier, owns only new factory module and tests.
- Master: journal, integration, cross-module contract decisions, review, full gates.

Workers read existing seams but do not edit shared service/store/adapter files in this wave. If a shared seam is required, report `CONTRACT_CHANGE_REQUIRED`.
