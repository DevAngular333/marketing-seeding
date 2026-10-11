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

## State v2

State thêm bốn collection theo kiểu additive:

- `artifacts`: file trong productRepo, realpath, SHA-256, bytes và verification evidence;
- `stories`: angle/audience/CTA và grounding sources đã hash;
- `schedules`: lịch daily draft-only theo campaign và channel;
- `scheduleRuns`: receipt thành công/thất bại/blocked, luôn `externalSideEffects=false`.

`src/store.mjs` chấp nhận state v1 và UTF-8 BOM, migrate nguyên dữ liệu sang v2 bằng atomic write.

## Adapter/channel policy

- `src/constants.mjs`: cadence, limits, human approval và consent policy.
- `src/integrations.mjs`: metric adapter chính thức; LinkedIn/email hiện `manual_only` thay vì giả có API.
- `public/workflow.js`: allowlist composer; email không mở luồng gửi hàng loạt.
- `src/guards.mjs`: phê duyệt, rules review, rate limit, duplicate content và consent metadata.

## Single-writer và auth

Node server là writer duy nhất khi đang chạy. Tất cả HTTP mutation cần bearer token nằm dưới `.agentic`; GET health/dashboard/flow graph chỉ nghe loopback. CLI mutation chỉ chạy khi server dừng.
