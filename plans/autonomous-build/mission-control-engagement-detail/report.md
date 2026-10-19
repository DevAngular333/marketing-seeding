# Mission Control conversation and engagement detail

## Outcome

Mission Control now renders bounded, read-only detail from the existing
`engagementContext` and `conversationContinuity` dashboard projections. The
panel shows up to five conversations and five engagement candidates with
channel, bounded author/text or fingerprinted references, status, reason codes,
reply/turn counts and continuity state. It adds no approval, reply, retry,
account-selection, browser or provider path.

## Safety

- Existing `QUARANTINED` and `UNKNOWN` evidence remains visible and is never
  promoted to an executable action.
- Display text is normalized, length-bounded and redacts assignment-style
  credentials, standalone bearer values, and `Authorization: Bearer ...`
  headers before rendering.
- No store, server route, authority, execution, browser session, credential,
  canonical state or historical UNKNOWN record was changed.

## Evidence

- `node --test test/dashboard-ui.test.mjs`: 2 passed, 0 failed, 0 skipped.
- `cd ui && npx tsc --noEmit`: PASS.
- `cd ui && npm run build`: PASS; existing Vite config-loader warnings only.
- `npm test`: 527 total, 525 passed, 0 failed, 2 skipped.
- `git diff --check`: PASS.
- Independent reviewer: ACCEPT after verifying bounded rows, no controls and
  complete credential redaction.

Evidence class: LOCAL / SYNTHETIC read-only dashboard behavior. This does not
prove live LinkedIn publication or unblock the live authority lane.
