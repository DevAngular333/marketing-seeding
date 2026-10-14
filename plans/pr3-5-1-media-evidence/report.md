# PR3.5.1 — media evidence report

## Outcome

Separated proof of the uploaded local artifact from media signals visible on a published post. LinkedIn publication verification can now accept `NOT_VERIFIABLE` post-publication file hash only when exact pre-submit artifact integrity and strong, time-bounded publication identity evidence are present. The receipt keeps `mediaHashMatched: false` and a null post-publication hash.

## Architecture and files

- `src/linkedin-adapter.mjs`: records artifact ID, expected/local SHA-256, media type, successful attachment, and ready preview before submit; supplies that proof to immediate verification and read-only reconciliation. Missing/wrong observed media is `MISMATCHED`; a visible expected type is `NOT_VERIFIABLE`, never a hash match.
- `src/execution-contracts.mjs`: validates and persists the separate pre-submit integrity proof and strong candidate evidence. NOT_VERIFIABLE cannot claim a matched hash.
- `src/platform-policies.mjs`: explicit `postPublishMediaHash` policy; LinkedIn is `NOT_AVAILABLE`, other platforms default to `REQUIRED`.
- `src/service.mjs`: binds request media to the canonical artifact and enforces hash-capability policy, local upload hash, attachment/preview, media type/presence, registered author, permalink/stable ID, and candidate time interval before VERIFIED.
- `src/jev-execution-worker.mjs`: reuses the original attempt's persisted pre-submit proof during reconciliation; it does not invoke execute/submit.
- Focused tests in the corresponding LinkedIn, worker, platform-policy, and service test files.

The separate legacy operator reconciliation route still requires exact `mediaSha256` equality. It handles records without a modern execution receipt and lacks the verifier's pre-submit attachment/preview proof, so this change leaves that stricter path intact. Modern execution reconciliation uses the capability-aware verifier path.

## Verification evidence

- Targeted: `corepack pnpm exec node --test test/linkedin-verification.test.mjs test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs test/platform-registries.test.mjs` — 81 passed, 0 failed, 0 skipped.
- Full: `corepack pnpm test` — 206 total, 204 passed, 0 failed, 2 existing environment/security skips.
- `git diff --check` — clean.
- Existing canonical runtime was only read: schema v8, revision 72; execution `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628` remained `SUBMIT_RESULT_UNKNOWN`; associated grant/window remained CONSUMED and active leases were 0.
- No canonical service was started, no browser/LinkedIn action was performed, and no canonical live execution controls or publications were created. Tests used isolated temporary fixtures only.

## Limitations and next step

This commit changes source only. It has not been deployed to the canonical runtime. A later, explicitly authorized deployment and a new validation execution are still required; the existing UNKNOWN remains quarantined and is not upgraded by this change.
