# Changes

- `SeedingService.materializeAuthorizedContentCandidates` now derives exact
  versioned template candidates from persisted campaign stories during the
  queue pass.
- Queue derivation is gated by active campaign state, one exact active
  `standing_autonomous` authorization, live execution permission and
  `approved_template_set` scope.
- Derivation uses deterministic story/template ordering and rereads state before
  materialization.
- Existing candidate identities are never overwritten during autonomous
  derivation, preserving immutable lineage and fail-closed tamper handling.
- `queueDueCampaignJobs` invokes the template source path even when no draft
  candidate row exists, while preserving per-campaign failure isolation.
- Regressions cover autonomous derivation, repeated ticks, restart, paused and
  ambiguous authority, inactive campaign, tampering and execution-control
  idempotency.
