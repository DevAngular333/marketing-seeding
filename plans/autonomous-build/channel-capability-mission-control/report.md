# Channel capability Mission Control — report

## Outcome

Added a read-only capability table to `ui/src/Pages.tsx` `PlatformsPage`.
It renders the existing bounded `data.channelCapabilities` projection,
including explicit status/reason, target counts, fresh-ready counts, and
policy flags. Missing data remains an explicit empty state.

The table has no links or mutation controls and does not infer external
platform support or publication readiness.

## Evidence

- UI TypeScript check: PASS.
- UI production build: PASS (existing Vite config-loader warnings only).
- No browser, ORCA, canonical state, credentials, or external platform action.

## Limitations

This improves Mission Control observability only. It does not add channel
discovery, adapters, authorization, account selection, publishing, or live
verification. Existing live blockers remain unchanged.
