# Product Understanding Auto-Derivation — Acceptance

## Requirements

- **A1** Derive bounded candidate answers for `WHAT_IS_IT`,
  `WHAT_PROBLEM_DOES_IT_SOLVE`, `WHY_IS_IT_BETTER` and `WHO_NEEDS_IT` from
  already inspected local repository evidence and safe package metadata when
  explicit caller claims are absent or incomplete.
- **A2** Attach every derived answer to exact evidence record references and
  preserve unsupported fields as `null` plus `CLAIMS_WE_CANNOT_MAKE` entries.
- **A3** Keep the existing product-intelligence document, hash, handoff,
  readiness and campaign persistence contracts compatible and deterministic.
- **A4** Make the result available through the existing inspection/service and
  dashboard projection without adding a store, route, provider router, model
  dependency or execution authority.

## Constraints

- **C1** Local deterministic inference only; no network, LLM/provider, browser,
  login, credential/session access or external side effect.
- **C2** Evidence outranks documentation claims; never invent superiority,
  customer, benchmark or market facts. Heuristics may emit only bounded
  descriptive candidates supported by text/metadata evidence.
- **C3** Existing explicit caller claims remain authoritative when valid and
  evidence-grounded. Auto-derived candidates must not overwrite valid explicit
  claims.
- **C4** Reuse `JsonStore`, `SeedingService`, repository inspector and existing
  product-intelligence handoff. Keep `SYSTEM_AGENTIC_AI` Core frozen.
- **C5** Preserve credential redaction, size bounds, hash stability and all
  LinkedIn/authorization/UNKNOWN semantics.

## Verification

- **V1** Focused product-intelligence, repository-inspection and service tests
  pass with zero failures, including deterministic repeated derivation.
- **V2** Tests cover missing evidence, explicit-claim precedence,
  evidence-reference integrity and unsupported-field quarantine.
- **V3** Full Node suite remains zero failures; syntax and diff checks pass.
- **V4** Independent read-only review confirms no authority/browser/provider or
  external mutation path and no secret material in persisted output.
- **V5** Canonical runtime state and protected historical UNKNOWN executions are
  unchanged.
