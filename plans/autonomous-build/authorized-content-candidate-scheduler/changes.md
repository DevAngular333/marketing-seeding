# Changes

- Added `SeedingService.materializeAuthorizedContentCandidates`.
- Invoked candidate materialization from `queueDueCampaignJobs` before normal
  post queue evaluation.
- Added strict standing-authority enforcement to the existing
  `materializeContentCandidate` seam.
- Added idempotent repeated-tick and restart coverage.
- Added draft-only regressions for missing/inactive authority and legacy or
  incomplete template candidates. The later template-candidate-binding
  milestone adds the versioned exact template path.
- Preserved advisory `runCampaignControlCycle` authority-free behavior.
