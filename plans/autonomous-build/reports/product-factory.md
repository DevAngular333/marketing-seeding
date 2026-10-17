# Product Factory — Local Capability Report

- **Status:** PARTIAL, LOCAL_VERIFIED.
- **Implementation:** `src/product-factory.mjs` classifies Node/Python/static/unknown repositories; creates deterministic plans; executes only allowed argv binaries with `shell:false`, repository containment, bounded timeout/output and secret-like output redaction; hashes selected files into artifact evidence.
- **Verification:** `node --test test/product-factory.test.mjs` is included in full suite; worker focused tests passed 5/5. Full integration suite: 299 tests, 297 pass, 0 fail, 2 skip.
- **Evidence class:** local synthetic. This is not a general repo build system: it does not install dependencies, execute arbitrary project builds, render product media/screenshots/video, persist artifact lifecycle in canonical state, or verify external product behavior. `externalSideEffects:false` reflects the local tool’s constrained command intent, not a sandbox against a malicious allowed binary/project behavior.
