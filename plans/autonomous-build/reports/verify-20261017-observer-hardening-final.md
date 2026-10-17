# Independent verification: final observer hardening

## Unverified first

- No live external endpoint was contacted; tests use injected DNS/fetch fixtures.
- Production `pinnedFetch` TLS/network behavior was reviewed statically; no external TLS handshake was attempted.
- Canonical runtime was not mutated or scheduler-triggered during this check.

## Verdict

**PASS (bounded)**

The final diff preserves the observer contract while replacing the production fetch path with DNS-pinned HTTP(S) requests. URL validation remains backward compatible, while production requests use the validated address for the connection and retain the original hostname for HTTP/TLS semantics.

## Evidence

- Focused command `node --test test/discovery-observer.test.mjs test/discovery-scheduler.test.mjs test/discovery.test.mjs`: **17 passed, 0 failed**.
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
- `validatePublicUrl()` still returns the public `URL` object; internal `resolvePublicUrl()` additionally returns the first validated address. Redirects re-resolve every destination, so a redirect to a private/reserved address fails before request.
- `pinnedFetch()` uses Node `http`/`https` request, `agent:false`, no cookies/bearer/session headers, explicit GET, bounded request timeout, AbortSignal, original hostname/SNI and a custom lookup callback pinned to the validated address. Redirect handling remains manual and bounded.
- Response body is converted to a Web stream; `readChunk()` races each read against the abort signal, cancels the reader on abort, and records UNKNOWN. Redirect, non-2xx and unsupported-content paths cancel bodies; per-hop timers clear in `finally`.
- IPv4/IPv6 special-range parser is fail-closed and the focused tests cover reserved/documentation ranges, DNS timeout, body timeout, redirect bounds and redaction.
- No changed source path touches social/provider/browser/authorization/grant/window/lease/execution state. UNKNOWN observations remain excluded from positive persistence.
- `.env.example` documents `SEEDING_DISCOVERY_POLL_MINUTES=0` and the 15-minute minimum. Existing JSON journals parse; no product or canonical state edits were made by this review.

## Status

PASS (bounded; local/static verification only)
