# Platform-neutral execution core

PR3.1 defines the internal boundary used by JEV execution. LinkedIn remains the only production adapter registered by the server.

## Registries

- `PlatformAdapterRegistry` maps a platform id to an adapter implementing contract version 1, `execute`, `reconcile`, and a complete boolean capability declaration.
- `ReadinessProviderRegistry` maps a platform id to a provider implementing `checkReadiness(context)`. An absent provider returns a structured blocked result with `readiness_provider_not_registered`.
- `PlatformPolicyRegistry` owns target host allowlists, optional URL validation, account identity URL normalization, and platform default targets. Service code uses the registry without branching on a platform id.

The server composition root registers `linkedin` with `LinkedInAdapter` and `LinkedInReadinessProvider`. Other platforms have no adapter/provider registration and cannot fall back to LinkedIn.

## Adapter contract version 1

Every adapter declares the eight `PLATFORM_CAPABILITIES` boolean values. It implements:

- `execute(request, context)` for its bounded platform workflow;
- `reconcile(request, context)` for verification after an uncertain submit.

Adapters may expose the lifecycle operations `prepareExecution`, `navigate`, `verifyTarget`, `openComposer`, `fillContent`, `attachMedia`, `verifyPreSubmit`, `submit`, `verifyPublished`, `cleanup`, and `recover`. Each platform can implement only the operations that match its capabilities; orchestration details remain in the adapter rather than the generic worker. Readiness is kept in the separate provider contract.

Publication verifiers return `CONFIRMED`, `UNKNOWN`, or `FAILED`, plus optional publication reference/URL, verification evidence, and verification time. JEV maps that platform-neutral result into `ExecutionReceiptV1`; it does not inspect how an adapter found a post.

## Execution and reconciliation

The worker resolves `request.platform` through `PlatformAdapterRegistry`. Missing registrations return `PLATFORM_UNSUPPORTED` before acquiring a lease or invoking a provider. Leases, durable submit intent, idempotency, and receipt reconciliation remain shared control-plane operations.

The reconciliation query returns pending executions from every platform. The worker resolves each platform's adapter independently. Missing verifier registrations return an explicit `PLATFORM_UNSUPPORTED` result and do not cause another submission.

## Scope and verification

The fake `test_social` adapter exists only in tests. The server does not register it. PR3.1 does not add Facebook, Threads, or any other production publisher and does not publish content.
