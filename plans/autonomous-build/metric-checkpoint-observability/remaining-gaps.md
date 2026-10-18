# Remaining gaps

- The projection does not schedule collection or guarantee that a provider was
  queried at the exact due time.
- Provider responses and permissions remain synthetic/local evidence; no live
  metrics provider was exercised.
- LinkedIn remains manual-only for metrics in the current integration metadata.
- `failed` collector runs intentionally project as `unknown`; the original run
  status and reason remain available through the collector-run reference.
- Outcome/learning remains advisory and does not use checkpoints to create
  authority or reroute execution.
