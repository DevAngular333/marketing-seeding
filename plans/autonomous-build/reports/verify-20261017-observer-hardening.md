# Independent verification: observer hardening

## Unverified first

- No live external URL or network endpoint was contacted; DNS and fetch behavior used injected fixtures.
- Canonical runtime was inspected read-only; no scheduler wall-clock run was triggered.

## Verdict

**PASS (bounded)**

The current observer hardening is fail-closed for newly covered reserved destinations and hanging DNS/body reads. It preserves discovery-only behavior and does not mutate social, canonical, authority, or UNKNOWN state.

## Evidence

- Focused command `node --test test/discovery-observer.test.mjs test/discovery-scheduler.test.mjs test/discovery.test.mjs`: **17 passed, 0 failed**. Covers reserved IPv4/IPv6 ranges, DNS timeout, body timeout, redirects, bounds, redaction, UNKNOWN classification, persistence and scheduler isolation.
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
- Observer now rejects carrier-grade NAT, documentation, benchmark, multicast, unique-local, link-local and reserved IPv6 ranges before fetch; DNS lookup has a bounded timeout.
- Per-response timeout signal now covers both fetch and body `reader.read()`; abort cancels the reader and records an UNKNOWN result. Timers are cleared in `finally`, including redirect and content failures.
- No changed source file touches social/provider/browser/authorization/grant/window/lease/execution paths. Observer still filters UNKNOWN before `recordDiscoveries`; scheduler calls only `observeDiscoveries`.
- `.env.example` now documents `SEEDING_DISCOVERY_POLL_MINUTES=0` and the 15-minute minimum.
- JSON journal/audit files parse successfully. Canonical state read-only check reports schema 8, revision 194, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`, zero active leases/grants/windows, and four UNKNOWN records.

## Journal consistency

- Discovery scheduler report's prior concern about missing `.env.example` documentation is stale: the current uncommitted diff adds the setting and comment.
- The full suite was rerun after this review: 361 total, 359 passed, 0 failed, 2 skipped. The focused observer subset remains 17/17.

## Status

PASS (bounded; local verification only)
