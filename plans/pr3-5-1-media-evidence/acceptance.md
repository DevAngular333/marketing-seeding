# PR3.5.1 Acceptance

## Requirements

A1. Preserve strict pre-submit artifact integrity: execution media must bind to the canonical artifact ID/SHA/type, local bytes must hash to the approved SHA, and attachment plus preview must be confirmed before submit.
A2. Represent post-submit media observation independently from pre-submit artifact integrity, with explicit `MATCHED`, `NOT_VERIFIABLE`, or `MISMATCHED` status; video presence alone must never imply hash match.
A3. Apply a platform capability policy: LinkedIn may verify a media publication with post-submit hash unavailable only when A1 is proven and stable post ID/activity ID, permalink, author, exact content, submit-time consistency, and expected media presence/type are proven. Platforms that expose media hashes retain the hash-match requirement.
A4. Reject media type mismatches and actual verifiable SHA mismatches.
A5. Use the same verification contract for immediate publication checking and UNKNOWN reconciliation, persisting and reusing the original pre-submit integrity evidence.
A6. Leave existing UNKNOWN execution `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628` unchanged; do not submit, deploy, or interact with LinkedIn.
A7. Do not change authorization, grant/window, submit-boundary, idempotency, worker dispatch, Post-click, cancellation, or UNKNOWN-quarantine semantics.

## Constraints

C1. Preserve platform-policy defaults and Windows/macOS behavior.
C2. Keep `mediaHashMatched=false` and `mediaHash=null` when post-submit hash is unavailable.
C3. A NOT_VERIFIABLE result never upgrades to VERIFIED without strong identity evidence and exact pre-submit proof.
C4. No canonical runtime or LinkedIn side effects.

## Verification

V1. Focused tests prove strict pre-submit hash rejection and acceptance, LinkedIn NOT_VERIFIABLE confirmation only with strong proof, weak/old/mismatched candidates rejected, verifiable-platform hash match still required, and media mismatch rejected.
V2. Reconciliation reuses stored pre-submit evidence and same verifier contract without submission actions.
V3. Full `corepack pnpm test` passes with zero failures and no failure-hiding skips.
V4. Commit only the verification change as `fix(verification): separate upload integrity from publication media evidence`.
