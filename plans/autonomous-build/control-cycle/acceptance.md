# Bounded campaign control cycle

## Acceptance

- A1: one service method composes persisted outcome, learning, then strategy projections.
- A2: repeated invocation at the same timestamp is deterministic and idempotent.
- A3: UNKNOWN publication evidence yields advisory `do_nothing` feedback.
- A4: no grants, windows, leases, execution requests, browser calls, or provider/social actions are created.
- A5: automation may invoke the additive read/write endpoint; existing authority controls remain unchanged.

## Verification

- V1: `node --test test/control-cycle.test.mjs`
- V2: `node --check src/service.mjs src/server.mjs`
- V3: inspect state collections before/after focused tests.
