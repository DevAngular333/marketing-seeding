# Dispatch — official metrics collection

- Controller: `/root`
- Worker: `/root/official_metrics_builder`
- Role: BUILD; bounded local implementation
- Branch/worktree: `feat/official-metrics-collection` at `/Users/nam/Documents/marketing-seeding-official-metrics`
- Independent verifier: `/root` after worker completion
- Acceptance: `plans/autonomous-build/official-metrics-collection/acceptance.md` A1-A7, C1-C5, V1-V5
- Owned paths: `src/service.mjs`, focused service/server tests, milestone artifacts
- Forbidden: canonical runtime writes, browser/ORCA, credentials, network/social effects, LinkedIn metrics, new architecture
- Pin: `ae5ee39`; integration branch remains clean and live lane remains unused
