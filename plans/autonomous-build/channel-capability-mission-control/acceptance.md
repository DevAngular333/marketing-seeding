# Channel capability Mission Control — acceptance

- A1: Platforms page consumes only the existing bounded `channelCapabilities`
  dashboard projection.
- A2: Each rendered row shows channel, explicit status, bounded reason, target
  count, fresh-ready target count, and policy flags.
- A3: Missing projection renders an explicit empty state; no capability is
  inferred from URLs or legacy target readiness.
- A4: The page remains read-only and adds no approval, account selection,
  retry, browser, authority, or publication control.
- A5: Existing platform statistics and community directory remain present.
- V1: UI TypeScript check passes.
- V2: UI production build passes.
- V3: No source outside `ui/src/Pages.tsx` and this milestone journal is
  changed; no runtime/browser/canonical state is touched.
