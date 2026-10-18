# Standing authorization binding guard

**Status:** LOCAL_VERIFIED
**Evidence class:** synthetic/local only; no canonical runtime or external side effect

## Finding

The direct standing delegation entry points (`ensureStandingExecutionWindow` and `ensureStandingExecutionGrant`) previously checked active/live mode but could derive artifacts before validating the current campaign scope fingerprint, authorization fingerprint, and post authorization binding. The downstream execution control plan would later reject drift, but stale windows or grants could still be created or reused.

## Change

Both entry points now fail closed unless the campaign is active and all of these exact bindings hold:

- authorization campaign ID equals the post campaign;
- authorization binding equals its canonical fingerprint;
- authorization campaign binding equals the current campaign scope fingerprint;
- post campaign-authorization binding equals the authorization binding.

No selector, rebind, credential, browser or external path was added.

## Verification

`node --test test/standing-autonomous-delegation-proof.test.mjs test/standing-campaign-delegation.test.mjs` — **6 passed, 0 failed, 0 skipped**.

The regression tampers the authorization binding and asserts both direct derivation methods reject before changing window/grant counts.
