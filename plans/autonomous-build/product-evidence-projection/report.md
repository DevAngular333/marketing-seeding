# Product evidence projection

## Outcome

Added a read-only Mission Control panel that exposes existing persisted Product Factory evidence and product-intelligence handoff lineage. The panel reports bounded run count/status, evidenced artifact count, readiness, and latest classification without executing commands, promoting artifacts, creating authority, or touching browser/canonical runtime state.

## Scope and safety

- Reuses the existing `productFactoryEvidence` and `productIntelligence` dashboard projections.
- Does not change Product Factory execution eligibility; unsafe build/render commands remain `NOT_EXECUTED_UNSAFE`.
- Does not expose command output, secrets, cookies, tokens, or session material.
- Does not add a dashboard approval or external side-effect path.

## Verification

- `npm run build` in `ui/`: passed (Vite emitted existing config-loader warnings only).
- No browser, ORCA, LinkedIn, network, credentials, or canonical runtime state was touched.

## Remaining gaps

- Host sandbox remains unsupported for arbitrary project build/run/render/media execution.
- Project-specific artifact generation and live product evidence remain unverified.
- Artifact promotion remains a separate guarded operator path.
