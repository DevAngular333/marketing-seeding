# Changes

- Added a read-only Account / session readiness section to the existing Mission Control panel.
- Reused `data.accountRuntime`, falling back to `data.executionAccounts` for compatibility.
- Displayed only bounded account id, platform, session mode, auth mode, eligibility, current blocker and ineligibility reasons.
- Added responsive styling; no backend, route, store, authority or execution code changed.
