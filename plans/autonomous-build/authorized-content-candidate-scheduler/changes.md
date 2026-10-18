# Changes

- Added `SeedingService.materializeAuthorizedContentCandidates`.
- Invoked candidate materialization from `queueDueCampaignJobs` before normal
  post queue evaluation.
- Added strict standing-authority enforcement to the existing
  `materializeContentCandidate` seam.
- Added idempotent repeated-tick and restart coverage.
- Added draft-only regressions for missing/inactive/template-set authority.
- Preserved advisory `runCampaignControlCycle` authority-free behavior.
