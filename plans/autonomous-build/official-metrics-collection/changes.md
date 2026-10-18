# Changes

- Reused `SeedingService.collectMetrics` and existing metric snapshot/collector run collections.
- Official readings now deduplicate by post and official source, while every attempt records a collector run with `metricsChanged`.
- Changed readings append one immutable snapshot; unchanged readings return `metricSnapshot: null`.
- Failure results are bounded and per-post; `collectAllMetrics` continues subsequent posts.
- Manual-only/unconfigured providers remain snapshot-free explicit outcomes.
