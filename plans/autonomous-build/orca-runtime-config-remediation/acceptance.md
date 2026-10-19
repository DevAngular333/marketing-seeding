# ORCA runtime configuration remediation — Acceptance

## Requirements

- A1. The private canonical runtime configuration points to an existing executable that is explicitly observed at the pinned ORCA version.
- A2. The configuration remains private and keeps its restrictive file mode; no credential/session value is copied into repository artifacts.
- A3. The connected ORCA daemon reports the same pinned version and a ready/connected state through a read-only probe.
- A4. No browser tab, profile, canonical state, authorization, grant, lease, post, publication attempt, or UNKNOWN record is changed.

## Constraints

- C1. Do not restart ORCA or the marketing-seeding service.
- C2. Do not click, navigate, fill, upload, submit, publish, or reconcile.
- C3. Do not revive or create campaign authority.
- C4. Keep existing transport and LinkedIn safety contracts unchanged.

## Verification

- V1. The configured executable exists and is executable.
- V2. `--version` and `status --json` both report `1.4.229` and `ready/connected`.
- V3. Canonical state SHA-256 and revision remain unchanged.
- V4. Existing full local test/static/UI gates remain passing after the remediation.
