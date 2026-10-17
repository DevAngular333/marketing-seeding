# Product Factory Project Evidence Probe

## Outcome

The Product Factory now derives a fail-closed evidence probe from the existing
`package.json` manifest and runs eligible probes only in a temporary staging
copy. Manifest commands are never treated as general build scripts. The only
eligible form is `node --check <relative .js|.mjs>` under the existing
`build`, `test`, `render`, or `validate` keys. Unsafe, missing, traversal,
absolute, package-manager, interpreter, shell, and arbitrary script commands
remain `NOT_EXECUTED_UNSAFE`.

The existing bounded Product Factory lineage and artifact hash collector are
reused. No campaign authority, browser, LinkedIn/JEV/ORCA, publication,
UNKNOWN, or canonical runtime semantics were changed.

## Evidence class

`LOCAL_REAL` filesystem behavior with synthetic temporary fixtures. No real
customer repository, network, credentials, browser, or social platform was
used. This does not prove project-specific build/render/media capture or live
publication.

## Safety boundary

Staging is isolation for the registered repository, not a general sandbox for
arbitrary code. Therefore arbitrary manifest scripts are rejected rather than
executed. True project build/render execution requires a separately designed
and audited sandbox milestone.

## Verification

- Focused Product Factory/runtime/service gate: **45 passed, 0 failed, 0 skipped**.
- Full Node suite: **379 total, 377 passed, 0 failed, 2 skipped**.
- `node --check src/product-factory.mjs src/service.mjs test/product-factory.test.mjs`: passed.
- `git diff --check`: passed.
- Independent read-only review: **PASS (bounded)** at `plans/autonomous-build/reports/verify-20261018-product-factory-project-evidence.md`.
- Canonical schema 8 revision 194 and protected UNKNOWN records remained unchanged.

