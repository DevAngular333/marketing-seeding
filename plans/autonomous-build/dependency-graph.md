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
  ├─> product intelligence / discovery / artifact graph
  │     ├─> Product Intelligence (bounded repository inspection + explicit claims + claim graph + versioned handoff persisted on campaign)
  │     ├─> Discovery (caller observations + deterministic normalization/dedup/classification/score + advisory audience/channel/locale fit persisted on campaign)
  │     └─> Product Factory (safe local classification/commands + bounded candidate discovery + artifact hash + bounded persistent run lineage)
  │
  ├─> deterministic advisory strategy (reads product readiness, discovery, queue policy, UNKNOWN state and current learning context)
  │     ├─> deterministic evidence-grounded content candidates (draft-only)
  │     ├─> outcome summary + advisory learning feedback
  │     └─> opt-in control cycle and public discovery polling (read-only)
  │
  └─> metrics/interaction/reply/conversion collections and dashboard projections
        ├─> learning-aware advisory context (current outcome-summary linkage and bounded reason evidence)
        └─> read-only account runtime projection (profile fingerprint, health/readiness, blocker, bound-target count)

SYSTEM_AGENTIC_AI Core (frozen, read-only)
  └─> downstream DRY_RUN distribution-handoff validator/persistence seam (local only; upstream producer not wired)
```

## Dependency status

- **Implemented/local verified:** authority, queue governance, standing delegation, kill switch epoch fencing, exact dispatch, readiness, LinkedIn transport/adapter/verifier contracts, bounded repository inspection and product intelligence handoff persistence/projection, downstream DRY_RUN distribution-handoff validation/persistence, deterministic discovery persistence/projection, bounded caller-supplied audience/channel/locale fit metadata, safe product factory execution with bounded candidate discovery and persistent run lineage.
- **Partial:** dashboard, artifact/story/draft state, metrics collectors, restart/lease recovery, account/profile session reuse, project-specific product factory orchestration and artifact lifecycle.
- **Implemented/local verified:** read-only account runtime projection reusing existing account/profile/readiness state; no login, credential broker, account selector or failover.
- **Implemented/local verified:** deterministic advisory strategy decisions, evidence-grounded draft candidates, outcome summaries, advisory learning feedback, learning-aware strategy context, opt-in control-cycle scheduling, and bounded public HTTP discovery polling with campaign error isolation; all are non-authoritative.
- **Design-only/not implemented:** upstream live System-Agentic handoff producer/consumer, autonomous audience search, platform search/community-rule crawler, outcome-attributed adaptive authority/NBA, production LLM content, contextual engagement, multi-account registry/recovery. Current learning context is explanatory only; caller-supplied fit is implemented as advisory evidence.
- **Live blocked:** real LinkedIn final submit and independent publication discovery require fresh exact authorization and a permitted live lane.
