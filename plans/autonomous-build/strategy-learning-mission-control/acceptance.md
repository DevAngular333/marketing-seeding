# Strategy and learning Mission Control — acceptance

- A1: Use only existing `data.strategy` and `data.learning` dashboard
  projections.
- A2: Render no more than five recent strategy decisions and five learning
  feedback records, deterministically ordered by their persisted timestamps.
- A3: Show action, timestamp, bounded reasons, bounded evidence/reference IDs,
  and learning publication/metric assessment labels.
- A4: Preserve UNKNOWN, PARTIAL, and metric uncertainty; do not infer success
  from advisory data.
- A5: Add no button, link, approval, authority, account, browser, provider, or
  state mutation.
- V1: `cd ui && npm exec tsc -- --noEmit` passes.
- V2: `cd ui && npm run build` passes.
- V3: Focused dashboard/workflow tests pass.
