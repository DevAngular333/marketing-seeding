# Independent verification: discovery scheduler (0e024b9 + 81c2027)

## Unverified first

- No live external URL was contacted; observer tests used injected fetch and DNS fixtures.
- Scheduler wall-clock execution and canonical runtime revision/hash were not exercised.

## Verdict

**PASS (bounded)**

The accepted changes satisfy A1-A5 and C1-C5 within the tested local boundary. No product files were edited by this verification.

## Evidence

- Prior scheduler focused command: 43 passed, 0 failed.
- Post-hardening observer subset: 17 passed, 0 failed.
- Post-hardening full suite: 361 total, 359 passed, 0 failed, 2 skipped.
- `node --check src/*.mjs`: passed.
- `git diff --check`: passed.
- `pollConfiguredDiscoveries` snapshots campaigns, skips campaigns without configured sources, limits each source list to the persisted max-20 boundary, isolates per-campaign failures, and invokes only `service.observeDiscoveries`.
- Discovery and control schedulers use separate timers/runtime flags and shutdown waits for both; discovery errors reschedule without stopping other loops.
- Observer validates HTTP(S), credentials, DNS/IP private or reserved destinations, bounded redirects/timeouts/bytes/text/content types, and redacts credential-like text. Fetch failures are explicit `UNKNOWN` results and are excluded from positive discovery persistence.
- Changed files contain no LinkedIn/JEV/ORCA/provider/browser/authorization/grant/window/lease/execution changes.

## Bounded concerns

- `SEEDING_DISCOVERY_POLL_MINUTES` is validated, defaults to disabled in code, and is documented in the repository `.env.example`.
- Unknown observations are returned by the observer but intentionally filtered from campaign discovery persistence; the scheduler runtime summary exposes campaign failure counts, not per-source UNKNOWN counts.

These concerns do not invalidate the bounded, read-only scheduler acceptance; they should be addressed if configuration discoverability or durable UNKNOWN audit records are required.
