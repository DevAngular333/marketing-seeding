# Remaining gaps

- Official provider collection remains fixture/integration-injected in tests;
  provider responses are `SYNTHETIC`, while persistence/idempotence behavior is
  `LOCAL_REAL`; no live credentials or external network were used.
- LinkedIn remains `manual_only` per policy and has no official metric
  collector in this milestone.
- Provider authenticity, production permissions, rate-limit handling and
  long-running scheduler behavior still require a separately authorized live
  lane.
- The return value is now an explicit envelope containing
  `metricSnapshot`, `collectorRun` and `metricsChanged`; no in-repository
  caller still expects the former raw snapshot value.
