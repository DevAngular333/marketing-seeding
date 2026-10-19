# Test results

- Read-only executable probe: `1.4.229`.
- Read-only connected runtime probe: `ready`, `connected`, `1.4.229`.
- Configuration path existence: PASS; private file mode: `0600`.
- Canonical state SHA-256 before/after remediation: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Full Node suite after the surrounding integration changes: **527 total, 525 passed, 0 failed, 2 skipped** (latest release reconciliation; the older 523/521 count is historical).
- `node --check src/*.mjs`: PASS.
- `git diff --check`: PASS.
- UI typecheck and production build: PASS (existing Vite config warnings only).
