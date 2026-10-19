# Verification

- `node --test test/authorized-account-candidate-projection.test.mjs`: 9 passed, 0 failed, 0 skipped.
- Changed-area transport/LinkedIn/JEV + standing delegation gate: 104 passed, 0 failed, 0 skipped.
- `npm test`: 527 total, 525 passed, 0 failed, 2 skipped.
- `node --check src/*.mjs`: PASS.
- `git diff --check`: PASS.
- `cd ui && npx tsc --noEmit`: PASS.
- `cd ui && npm run build`: PASS (existing Vite config warnings only).

Evidence class: LOCAL / SYNTHETIC read-only projection. No browser, canonical, credential, external or social mutation occurred.
