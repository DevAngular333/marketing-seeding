# Test results

## Focused transport and LinkedIn/JEV gate

```text
node --test test/browser-interaction-transport.test.mjs \
  test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs \
  test/jev-execution-worker.test.mjs

103 passed, 0 failed, 0 skipped
```

The gate covers exact version matching, executable/connected runtime probes,
pre-intent failure, transport immutability, command-versus-activation evidence,
stale/moving/covered controls, acceptance versus publication verification,
timeout/UNKNOWN quarantine, duplicate dispatch prevention and no second final
click.

## Standing authorization proof

```text
node --test test/standing-autonomous-delegation-proof.test.mjs

4 passed, 0 failed, 0 skipped
```

The isolated proof derives one exact request, one one-time window, one live
grant and one lease from standing campaign authority without per-post approval
and remains free of publication artifacts.

## Full and static gates

```text
npm test                         527 total, 525 passed, 0 failed, 2 skipped
node --check src/*.mjs          PASS
git diff --check                PASS
cd ui && npx tsc --noEmit       PASS
cd ui && npm run build          PASS (existing Vite config warnings only)
```

The two skipped tests are the existing environment-dependent ACL/evidence
permission checks.
