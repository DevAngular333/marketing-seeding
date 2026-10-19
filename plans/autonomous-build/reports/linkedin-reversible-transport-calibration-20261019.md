# LinkedIn reversible transport calibration — 2026-10-19

## Result

`PASS_REVERSIBLE_CONTROL_ACTIVATION`; this does not certify irreversible
LinkedIn submission.

## Scope

The existing host-managed ORCA profile `marketing-linkedin-mac-primary` was
already authenticated on LinkedIn feed. For each trial the system opened an
empty composer, resolved a fresh visible `Hủy bỏ`/`Cancel` control, activated
that control using exactly one normal transport, then independently observed
that the composer returned to `/feed/` and no composer remained.

No content was entered. The `Đăng bài`/Post control was never clicked or
activated. No campaign state, execution request, grant, lease, publication
attempt, or UNKNOWN record was written.

## Evidence

| Transport | Attempts | Command/input completed | Positive semantic transitions | No transition | Wrong target | Rate |
|---|---:|---:|---:|---:|---:|---:|
| ORCA accessibility element click | 10 | 10 | 10 | 0 | 0 | 100% |
| ORCA pointer move/down/up | 10 | 10/10/10 | 10 | 0 | 0 | 100% |

Observed transition for every trial:

```text
https://www.linkedin.com/sharing/compose
  -> Hủy bỏ/Cancel control activation
  -> https://www.linkedin.com/feed/
  -> composer absent
```

Post control count after every trial: `0`.

## Boundary

This is real LinkedIn reversible-control evidence. It proves that both
transport paths can activate this harmless composer control in the current
profile/session. It does not prove that the Post control activates, that
LinkedIn accepts a submission, or that a publication can be independently
verified. Future irreversible execution remains blocked until fresh exact
campaign authority and content scope exist; the selected transport must be
frozen before durable submit intent and cannot change afterward.

## Safety

- Social mutations: 0
- Final Post clicks: 0
- Content entered: 0
- Historical UNKNOWN records mutated: 0
- Canonical runtime mutated: 0
- Credentials/cookies/tokens/session material persisted: 0

Raw trial logs were kept outside the repository under `/tmp` and contain only
safe control names, URLs, geometry, and ORCA command receipts.
