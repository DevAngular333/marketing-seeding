# Risk Register

| ID | Risk | Severity | Control | State |
|---|---|---:|---|---|
| R1 | Standing delegation broadens authority | P0 | Derive narrower exact controls; fingerprint and bind campaign/account/profile/target/content/visibility; one execution only | OPEN |
| R2 | Browser command receipt mistaken for publish | P0 | Preserve transport/activation/acceptance/verification layers and UNKNOWN quarantine | CONTROLLED |
| R3 | Duplicate or blind retry after timeout | P0 | Durable submit intent, execution lease, idempotency, immutable UNKNOWN | CONTROLLED |
| R4 | Product claims exceed evidence | P1 | Evidence/claim graph rejects unsupported claims | PLANNED |
| R5 | Product factory executes unsafe repo code | P1 | Classifier and bounded local runner with explicit allowlist/isolation; no external mutation | PLANNED |
| R6 | Workers share canonical runtime | P0 | Separate worktrees and fixture state/ports; live lane exclusive | CONTROLLED |
| R7 | Core/domain duplication | P1 | Keep System-Agentic Core read-only; marketing owns domain state/policy | CONTROLLED |
| R8 | Current live proof unavailable | P0 | Isolate as external hard blocker; continue local engineering | OPEN |
