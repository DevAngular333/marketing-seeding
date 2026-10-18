# Test results

## Focused gate

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs test/server.test.mjs
94 passed, 0 failed, 0 skipped
```

The three new preflight regressions cover unavailable backend detection,
detected-but-unaudited backend status, deterministic output, and fail-closed
eligibility. Existing Product Factory tests continue to cover unsafe manifest
rejection, staging isolation, bounded timeout/output, redaction and artifact
containment.

## Host probe

```text
probeFactorySandboxCapability()
backend=sandbox-exec
backendInvocation=PASS
profileIntegrity=UNSUPPORTED
networkDenied=UNSUPPORTED
filesystemScope=UNSUPPORTED
childProcessPolicy=UNSUPPORTED
timeoutCleanup=UNSUPPORTED
resourceLimits=UNSUPPORTED
status=UNSUPPORTED
executionEligible=false
unsafeCommandDisposition=NOT_EXECUTED_UNSAFE
```

`/usr/bin/sandbox-exec -n no-network /usr/bin/true` returned exit code 0 on
Darwin 24.6.0 arm64. This proves only a harmless wrapper invocation, not an
audited sandbox profile or resource limits.

## Full gate

```text
npm test
464 total, 462 passed, 0 failed, 2 skipped
```

## Static checks

```text
node --check src/*.mjs
git diff --check
```

Both passed. No browser, ORCA, network, credential, canonical runtime,
LinkedIn or other social action occurred.
