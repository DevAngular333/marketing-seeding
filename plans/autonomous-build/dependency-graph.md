# Dependency Graph (current implementation)

```text
JsonStore / schema / audit / writer lease
  ├─> campaign authorization + target/account binding
  │     ├─> queue eligibility (rules, quotas, cadence, concurrency, kill epoch)
  │     └─> standing autonomous delegation
  │           └─> one-time window + single-use grant + execution lease
  │                 └─> JEV exact dispatch
  │                       ├─> LinkedIn readiness (ORCA profile/session/composer)
  │                       └─> LinkedIn adapter
  │                             └─> BrowserInteractionTransport
  │                                   ├─> ORCA accessibility element click
  │                                   └─> ORCA pointer sequence
  │                             └─> activation → acceptance → independent publication verifier
  │                                   └─> normalized receipt → canonical CONFIRMED/PUBLISHED
  │
  ├─> artifact/story/channel draft graph
  │     ├─> Product Intelligence (caller evidence + claim graph)
  │     └─> Product Factory (safe local classification/commands/artifact hash)
  │
  └─> metrics/interaction/reply/conversion collections and dashboard projections

SYSTEM_AGENTIC_AI Core (frozen, read-only)
  └─> future versioned handoff boundary (not implemented in this wave)
```

## Dependency status

- **Implemented/local verified:** authority, queue governance, standing delegation, kill switch epoch fencing, exact dispatch, readiness, LinkedIn transport/adapter/verifier contracts, product intelligence module, safe product factory module.
- **Partial:** dashboard, artifact/story/draft state, metrics collectors, restart/lease recovery, account/profile session reuse.
- **Design-only/not implemented:** continuous discovery, audience relevance scoring, strategy/NBA, production LLM content, contextual engagement, learning loop, multi-account registry/recovery, versioned System-Agentic handoff.
- **Live blocked:** real LinkedIn final submit and independent publication discovery require fresh exact authorization and a permitted live lane.
