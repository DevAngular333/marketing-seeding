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
  │     ├─> Product Intelligence (bounded repository inspection + deterministic local field derivation + explicit claims + claim graph + versioned handoff persisted on campaign)
  │     │     └─> deterministic evidence-grounded draft story (READY handoff, source revalidation, draft-only)
  │     │           └─> queue-owned story derivation (explicit bounded storyPolicy + current authority/campaign bindings)
  │     ├─> Discovery (caller observations + deterministic normalization/dedup/classification/score + advisory audience/channel/locale fit persisted on campaign)
  │     └─> Product Factory (safe local classification/commands + bounded candidate discovery + artifact hash + bounded persistent run lineage)
  │
  ├─> deterministic advisory strategy (reads product readiness, discovery, queue policy, UNKNOWN state and current learning context)
  │     ├─> deterministic evidence-grounded content candidates
  │     │     └─> queue scheduler: exact approved-copy or versioned approved-template materialization only for active campaign + exact active standing authorization
  │     │           └─> existing queue/readiness/window/grant/request path; legacy/malformed template candidates remain draft-only
  │     ├─> outcome summary + advisory learning feedback
  │     └─> opt-in control cycle and public discovery polling (read-only)
  │
  └─> metrics/interaction/reply/conversion collections and dashboard projections
        ├─> bounded explicit-link-only post outcome attribution (canonical evidence/metrics/conversions)
        └─> learning-aware advisory context (current outcome-summary linkage, bounded reason evidence and campaign-aware post attribution)
        └─> deterministic metric observability projections (closed coverage vocabulary, stable latest-snapshot selection)
        └─> read-only account runtime projection (profile fingerprint, health/readiness, blocker, bound-target count)

SYSTEM_AGENTIC_AI Core (frozen, read-only)
  └─> downstream DRY_RUN distribution-handoff validator/persistence seam (local only; upstream producer not wired)
```

## Dependency status

- **Implemented/local verified:** authority, queue governance, standing delegation, kill switch epoch fencing, exact dispatch, readiness, LinkedIn transport/adapter/verifier contracts, bounded repository inspection and deterministic local product-intelligence field derivation with handoff persistence/projection, downstream DRY_RUN distribution-handoff validation/persistence, deterministic discovery persistence/projection, bounded caller-supplied audience/channel/locale fit metadata, safe product factory execution with bounded candidate discovery and persistent run lineage, and queue-driven exact content-candidate materialization/approved-copy plus versioned approved-template standing binding.
- **Partial:** dashboard, artifact/story/draft state, metrics collectors, restart/lease recovery, account/profile session reuse, project-specific product factory orchestration and artifact lifecycle. Metric projection is deterministic locally, and story derivation is draft-only, but live metric evidence and LinkedIn collection remain absent.
- **Implemented/local verified:** read-only account runtime projection reusing existing account/profile/readiness state; no login, credential broker, account selector or failover.
- **Implemented/local verified:** deterministic advisory strategy decisions, evidence-grounded draft candidates, outcome summaries with bounded explicit-link-only post attribution, campaign-aware post attribution context in advisory learning/strategy, opt-in control-cycle scheduling, and bounded public HTTP discovery polling with campaign error isolation; all are non-authoritative.
- **Design-only/not implemented:** upstream live System-Agentic handoff producer/consumer, autonomous audience search, platform search/community-rule crawler, outcome-driven adaptive authority/NBA, production LLM content, contextual engagement, multi-account registry/recovery. Post attribution and learning context are advisory evidence only; caller-supplied fit is implemented as advisory evidence.
- **Live blocked:** real LinkedIn final submit and independent publication discovery require fresh exact authorization and a permitted live lane.
- **Story draft boundary:** deterministic story derivation is available through `SeedingService`; the queue may invoke it only through an explicit bounded `storyPolicy` under one current standing template authorization. It remains draft-only and does not infer CTA or broaden authority.

## Latest queue derivation seam

```text
explicit storyPolicy + READY product-intelligence handoff + exact current standing approved_template_set authority
  -> deterministic draft story
  -> deterministic template candidate derivation
  -> immutable candidate identity / source and claim binding
  -> existing content materializer
  -> existing readiness + queue eligibility
  -> execution request + one-time window + live grant + lease
  -> existing JEV/LinkedIn/browser path
```

The first five nodes are locally verified. The browser path and real publication
verification remain externally blocked; no queue derivation creates authority or
bypasses the existing controls.
