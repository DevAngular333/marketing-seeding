# Live authorization audit — 2026-10-18

Evidence class: READ_ONLY LOCAL RUNTIME AUDIT.

## Canonical runtime

- State path: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: 8
- Revision: 194
- Current audit time: 2026-10-18T19:04:24Z
- Registered LinkedIn account: one enabled/healthy account (`linkedin_primary`); profile material redacted.
- Active execution leases: 0
- Active one-time windows: 0
- Active live grants: 0

## Authorization result

No currently usable LinkedIn standing authorization or harmless live test scope exists.
All LinkedIn campaign authorizations in the canonical state are expired,
paused, or superseded. The only authorization with an `active` status would
also need an in-window validity check; none exists. Existing windows are
CONSUMED and existing grants are CONSUMED or REVOKED. Historical execution and
UNKNOWN records remain untouched.

The local disabled validation task describes a prior scheduled run and is not
current authority. Backups are historical snapshots and cannot be promoted to
live authority. Runtime environment contains credential/session configuration;
values were not read or emitted.

## Blocker classification

`EXTERNAL_HARD_BLOCKER` for the live lane: a fresh exact campaign-level
authorization explicitly permitting one harmless LinkedIn test publication is
not present in canonical runtime. Software cannot derive this missing human
authorization from expired, paused, superseded, consumed, or revoked records.

Required input to resume live proof:

1. fresh active standing authorization bound to the existing LinkedIn account,
   ORCA profile, exact target, exact harmless content/media and visibility;
2. a valid one-time execution window and execution-scoped live grant derived
   from that authorization; and
3. a fresh readiness result at dispatch time.

No source, runtime state, browser session, credential, grant, window, lease,
post, or external platform was modified.
