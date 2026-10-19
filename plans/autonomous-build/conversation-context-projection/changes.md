# Changes

- Tightened `src/engagement-context.mjs` so a grounded draft reply subject to the channel's `replyRequiresApproval` policy is never emitted as an actionable candidate.
- Added a regression test proving the projection remains `OBSERVED`, carries `REPLY_PENDING_APPROVAL`, and emits zero candidates.

This is advisory read-model behavior only. Reply approval, execution authority, browser transport, and `UNKNOWN` handling are unchanged.
