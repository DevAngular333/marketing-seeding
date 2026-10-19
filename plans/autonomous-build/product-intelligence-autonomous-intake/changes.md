# Changes

- Added queue-owned bounded inspection for absent product intelligence under an
  exact standing template authorization and explicit story policy.
- Validated each approved source path against the current repository bytes and
  exact authorization SHA-256 before persisting the handoff.
- Allowed the existing campaign authorization grounding seam to defer only this
  exact standing-template inspection; all other authorization modes still
  require existing verified grounding.
- Added restart/idempotency coverage for complete intake.
- Added fail-closed coverage for incomplete evidence and source drift before
  handoff persistence.

No new store, provider router, state machine, browser abstraction, publisher,
authority model, Core change, or external side effect was added.
