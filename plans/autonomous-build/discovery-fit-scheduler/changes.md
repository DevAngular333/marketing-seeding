# Changes

- Added `normalizeDiscoveryFit()` with bounded audience terms, channel and
  locale fields plus credential/session-material rejection.
- Added optional campaign create/update persistence and explicit clear behavior.
- Forwarded persisted fit through the existing opt-in discovery scheduler.
- Kept no-fit campaigns backward compatible and kept fit outside
  `campaignScopeFingerprint()`.
- Added focused regression coverage without introducing a new store, router,
  state machine, provider, browser path, or authority contract.
