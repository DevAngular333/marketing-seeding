# Mission Control detail

## Outcome

Added bounded, read-only Mission Control detail using existing service projections. The dashboard now shows up to five discovery opportunities with score, channel, recommended action, fit statuses, reasons, and evidence references; and up to four product-intelligence handoffs with readiness plus claim-to-evidence hash/locator lineage.

## Scope and safety

- UI-only changes in `ui/src/App.tsx` and `ui/src/index.css`.
- No new endpoint, state mutation, authority derivation, browser action, authentication, or external side effect.
- Existing projections (`discoveryOpportunities`, `productIntelligence`) remain the sole data source.
- Bounds are explicit (5 opportunities, 4 intelligence records; 3 evidence refs per claim).

## Verification

- `npm run build` (UI): PASS
- `npx tsc --noEmit` (UI): PASS

## Limitations

This is an observational projection. Empty or malformed fields remain `UNKNOWN`; it does not infer claims beyond persisted lineage or make execution decisions.
