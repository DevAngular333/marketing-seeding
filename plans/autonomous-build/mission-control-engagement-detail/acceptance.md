# Mission Control engagement detail — acceptance

## Acceptance requirements

- **A1.** Mission Control renders a bounded read-only detail view for at most five existing conversation rows and at most five existing engagement candidates.
- **A2.** Conversation details show only existing projection fields: bounded author/text, channel, status, reason codes, reply count, latest activity, and continuity counts/status when available.
- **A3.** Candidate details show only existing projection fields: fingerprinted references, channel, status and reason codes; no action control is added.
- **A4.** Unknown/quarantined state remains visible and is never presented as an executable approval or send action.
- **A5.** The change uses the existing dashboard payload and introduces no route, store, authority, browser, provider, reply transition, or account-selection behavior.

## Constraints

- **C1.** Do not mutate canonical runtime, browser state, credentials, or historical UNKNOWN records.
- **C2.** Do not add a dashboard approval step or any external side effect.
- **C3.** Redact credential-like text before rendering and keep all displayed text bounded.

## Verification criteria

- **V1.** Existing Node test suite passes with zero new failures.
- **V2.** UI TypeScript check and production build pass.
- **V3.** Static dashboard regression asserts the new read-only detail labels and bounded rendering path.
- **V4.** `git diff --check` and source/journal validation pass; canonical state and UNKNOWN records remain unchanged.
