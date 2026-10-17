# Risk Register (verified 2026-10-17)

| ID | Risk | Severity | Control | State |
|---|---|---:|---|---|
| R1 | Standing delegation could broaden authority | P0 | Exact campaign/account/profile/target/content/visibility binding; active authorization; one-time window; single-use grant; lease; quotas/cadence/concurrency; kill epoch; provider-send fence; regression tests | CONTROLLED locally; live lane unproven |
| R2 | Browser command receipt mistaken for publish | P0 | Separate transport, semantic activation, platform acceptance and independent publication verification; `UNKNOWN` quarantine | CONTROLLED in code/tests; real website unverified |
| R3 | Timeout may cause duplicate submit | P0 | Durable submit intent, lease, idempotency, no blind redispatch, read-only reconciliation | CONTROLLED in code/tests; no live proof |
| R4 | Product claims exceed evidence | P1 | Evidence hashes and claim references; unsupported claims quarantined | CONTROLLED for caller-supplied local evidence; automated discovery absent |
| R5 | Product factory could execute unsafe repo code | P1 | Fail-closed manifest parser, relative `node --check` only, no arbitrary scripts/package managers, temporary staging, path/symlink containment, bounded output/time, redaction | CONTROLLED in local tests; real sandbox and build/render pipeline absent |
| R6 | Workers share canonical runtime | P0 | Isolated worktrees/fixtures; canonical runtime read-only in this wave; live lane exclusive | CONTROLLED |
| R7 | Core/domain duplication | P1 | System-Agentic Core read-only; domain state/policy remains marketing-seeding | CONTROLLED |
| R8 | Live proof unavailable | P0 | Blocked lane recorded; do not invent grants or mutate UNKNOWN history | OPEN — external hard blocker |
| R9 | Transport certification is duck-typed | P1 | LinkedIn submit boundary rejects unmarked transport; ORCA implementations enforce validator | ACCEPTED RESIDUAL; no bypass found |
| R10 | Metrics/learning and multi-platform adapters incomplete | P1 | Explicit readiness classification; only LinkedIn adapter registered for execution | OPEN, downstream roadmap |
| R11 | Aggregate learning could steer an unrelated post or channel | P1 | Current learning is accepted only as validated explanatory context; post attribution now requires explicit links and canonical evidence, with no action rerouting or authority side effect | CONTROLLED locally; outcome-driven adaptive authority remains open |
