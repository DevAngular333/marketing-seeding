# Marketing Seeding v2 — Code2Flow architecture mapping

## Ranh giới hệ thống

```text
D:\build-agentic-AI                  control plane, policy, launcher, runtime state
  └─ .agentic\marketing-seeding      token, state, logs, receipts

D:\project-all\marketing-seeding    product source, tests, dashboard, runbook
D:\design-os-code2flow               architecture/reference source (read-only)
```

## Canonical campaign graph

```text
Campaign -> Artifact -> Story -> Channel draft -> Target
                                      |
                                      v
                            Publication evidence
                                      |
                                      v
                         Metric -> Interaction -> Reply

Campaign -> Draft-only schedule -> Schedule run receipt
```

`src/flow-graph.mjs` áp dụng các nguyên tắc của Code2Flow:

- schema canonical tách khỏi adapter/API;
- node có confidence và evidence;
- edge chỉ tạo khi hai đầu tồn tại;
- reference thiếu được đếm bằng `unresolvedReferences`, không âm thầm loại bỏ;
- dashboard dùng các lane giống Product Map/Feature/Story để inspect toàn bộ flow.

## State v3

State thêm collections theo kiểu additive:

- `artifacts`: file trong productRepo, realpath, SHA-256, bytes và verification evidence;
- `stories`: angle/audience/CTA và grounding sources đã hash;
- `schedules`: lịch daily draft-only theo campaign và channel;
- `scheduleRuns`: receipt thành công/thất bại/blocked, luôn `externalSideEffects=false`.
- `campaignAuthorizations`: bounded campaign-level authority and child-job scope binding.

`src/store.mjs` chấp nhận state v1/v2 và UTF-8 BOM, migrate nguyên dữ liệu sang v3 bằng atomic write. Migration không suy ra campaign authorization từ `approvedAt` cũ.

## Adapter/channel policy

- `src/campaign-authorization.mjs`: authorization scope, binding, eligibility, schedule/rate checks và publication identity.
- `src/constants.mjs`: cadence, limits, lifecycle transitions và consent policy.
- `src/integrations.mjs`: metric adapter chính thức; LinkedIn/email hiện `manual_only` thay vì giả có API.
- Campaign authorization is stored in `campaignAuthorizations[]`. Existing campaigns remain on the legacy per-post gate until an operator explicitly activates a bounded campaign authorization. Authorized jobs queue automatically when scope, policy and current readiness gates pass. The repository still has no live social publisher/dispatcher; a queued job is not a published post. See `docs/CAMPAIGN-AUTHORIZATION.md`.
- `public/workflow.js`: allowlist composer; email không mở luồng gửi hàng loạt.
- `src/guards.mjs`: campaign authorization/readiness freshness (with legacy per-post approval for unmigrated campaigns), rules review, rate limit, duplicate content và consent metadata.

## Single-writer và auth

Node server là writer duy nhất khi đang chạy. Tất cả HTTP mutation cần bearer token nằm dưới `.agentic`; GET health/dashboard/flow graph chỉ nghe loopback. CLI mutation chỉ chạy khi server dừng.
