# Zero Touch Authority Bootstrap — Acceptance

## Requirements

- **A1** — A high-level product ID/name resolves to one existing local
  repository without manual low-level repository input.
- **A2** — Repository lookup is exact, bounded, deterministic and fails closed
  on zero or multiple matches.
- **A3** — The resolved repository continues through existing product
  intelligence, content, standing authorization, window, grant and lease
  contracts.
- **A4** — Existing account/profile/readiness/transport safety gates remain
  authoritative.

## Constraints

- **C1** — Reuse `SeedingService`, `JsonStore` and existing execution contracts.
- **C2** — Do not add a campaign store, state machine, provider router,
  browser abstraction or LinkedIn publisher.
- **C3** — No browser, social, credential, canonical runtime or historical
  UNKNOWN mutation during local verification.

## Verification

- **V1** — Product-only fixture bootstrap passes and is idempotent.
- **V2** — Ambiguous repository matches fail before campaign persistence.
- **V3** — Full Node suite, syntax and diff checks pass.
- **V4** — No live publication is claimed without a fresh independently
  verified permalink/post ID.
