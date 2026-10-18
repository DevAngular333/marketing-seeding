# Product intelligence document hash integrity

**Status:** LOCAL_VERIFIED
**Evidence class:** synthetic/local only; no canonical runtime or external side effect

## Finding

`attachProductIntelligence` persisted a caller supplied `documentHash` without checking it against the canonical serialized document. The versioned handoff hash remained valid because it deliberately excludes `documentHash`, so a forged self-hash could create inconsistent product-intelligence state for downstream consumers.

## Change

When `documentHash` is supplied, attachment now requires a lowercase 64 character SHA-256 matching the canonical document with the self-hash removed. Mismatch fails before store mutation. Documents that omit the field remain supported; generated documents continue to carry their valid hash.

## Verification

- `node --test test/service.test.mjs --test-name-pattern='product intelligence attachment rejects|product intelligence derives one grounded draft|product intelligence story derivation remains draft'` — **81 passed, 0 failed, 0 skipped** (Node pattern currently runs the full service file).
- `node --check src/service.mjs` — passed.
- `git diff --check` — passed.

The regression verifies a forged hash leaves the campaign snapshot byte-equivalent before and after the rejected attachment.
