# Mission Control read model — Acceptance

## Requirements

- **A1** Project the existing persisted outcome, learning, strategy and control-cycle state into the existing dashboard UI as read-only operator context.
- **A2** Preserve explicit UNKNOWN, missing and advisory states; the UI must not turn absent metrics or advisory decisions into success or execution authority.
- **A3** Reuse the existing `/api/dashboard` response and current dashboard shell; do not add a second store, route, writer, approval step or execution control.
- **A4** Show enough bounded context for OBSERVE / UNDERSTAND / STEER: latest control-cycle status, latest strategy action/reason, latest learning action/reason and outcome publication/metric coverage.
- **A5** Keep all browser, LinkedIn, authorization, grant, lease, submit-intent, publication-verification and UNKNOWN semantics unchanged.

## Constraints

- **C1** UI and read-only projection only; no social mutation, publish, login, credential/session access or canonical runtime writes.
- **C2** No dashboard redesign; add one compact Mission Control panel to the existing overview composition.
- **C3** Treat missing fields as `UNKNOWN`/`Chưa có dữ liệu`; never fabricate counts, permalinks or publication evidence.
- **C4** Keep `SYSTEM_AGENTIC_AI` Core frozen and do not add a duplicate domain store or state machine.

## Verification

- **V1** UI type/build check passes with zero errors.
- **V2** Existing full Node suite remains `0` failures; dashboard/server tests remain green.
- **V3** Read-only render helpers/tests or direct source inspection prove advisory and UNKNOWN labels are preserved.
- **V4** Canonical runtime state, protected UNKNOWN executions and browser/session state remain unchanged.
- **V5** Independent review inspects the final UI diff and confirms no mutation path or safety semantic drift.
