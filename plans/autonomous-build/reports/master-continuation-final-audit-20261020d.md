# Master continuation audit — 2026-10-20d

## Scope

Fresh release-owner continuation after authorized account selector hardening.
This audit inspected the integration branch, tests, canonical state, existing
Design OS Studio campaign evidence, and the host-managed ORCA browser session.
The browser checks were read-only: no composer was opened, no content was
entered, no control was clicked, and no state or session material was stored.

## Release evidence

- Branch: `integration/autonomous-build`, HEAD `330b985`, pushed to
  `origin/integration/autonomous-build`.
- Commits `f28de78` and `7c9f813` add a pure fail-closed account selector over
  the existing authorized account pool. It accepts only a unique or
  policy-selected eligible row with exact account identity and a 64-character
  profile fingerprint. It does not create authority, rebind posts, mutate
  state, or dispatch browser work.
- Full `npm test`: **538 total, 536 passed, 0 failed, 2 skipped**.
- Broader transport/JEV/LinkedIn/authority/recovery gate: **154/154**.
- Selector/authority/readiness/LinkedIn gate: **75/75**.
- `node --check src/*.mjs`, `git diff --check`, journal JSON parsing and
  `npm --prefix ui run build` pass. UI build emits only existing Vite config
  warnings.

## Canonical state and safety

Canonical state remains schema 8, revision 194, SHA-256
`5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
Active authorizations/windows/grants/leases are `0/0/0/0`. Four historical
`SUBMIT_RESULT_UNKNOWN` executions remain immutable. Published posts, final
Post clicks and social mutations remain `0`. No fresh execution, durable
submit intent, grant, lease, browser action, credential/session mutation or
canonical runtime write occurred in this continuation.

## Read-only ORCA/session observation

- ORCA executable and connected runtime report version `1.4.229`, state
  `ready`, connection `connected`.
- The host exposes an isolated LinkedIn profile labelled
  `marketing-linkedin-mac-primary` and one active LinkedIn feed tab. The exact
  profile identifier is already present in the existing account binding; it
  was not copied into new runtime state.
- The page identity link observed read-only is the existing account's
  `linkedin.com/in/...` URL. This confirms an authenticated identity is
  visible in the host session, but it does not refresh the persisted readiness
  record or authorize a new campaign.
- The accessibility snapshot showed the LinkedIn feed only. No composer,
  editor, media input, Post control, message, Like, Follow, Connect or other
  mutation control was activated.

## Standing authority and live proof

The standing campaign path is implemented and locally proven:

`standing campaign authorization -> one-time window -> execution-scoped grant
-> exact request -> lease -> JEV/LinkedIn adapter`.

The supplied Design OS Studio scope is still insufficient to invoke it safely.
Missing exact authority inputs are:

- fresh runtime campaign ID and exact `productRepo` binding;
- exact LinkedIn target ID and URL;
- explicit account ID and ORCA profile UUID in the authority scope;
- exact approved LinkedIn content bytes/contentId/SHA-256;
- explicit `no media` declaration or approved media artifact ID/SHA-256 list;
- canonical audience serialization;
- explicit UTC `validFrom` and `validUntil` plus required schedule fields;
- fresh bound readiness for this campaign.

The reference campaign artifacts contain Product Hunt, Reddit, HN, Figma
Forum and other drafts, but no file marked as the approved LinkedIn launch
payload. Existing canonical target/account/content hashes belong to terminal
historical validation campaigns and cannot be rebound. No fresh window, grant,
lease or live dispatch was created.

## Transport result

ORCA accessibility and pointer transports each retain 10/10 semantic
activation on the resettable local fixture and 10/10 on the reversible LinkedIn
composer Cancel control under the existing certification policy. This proves
reversible control activation. It does not certify an irreversible LinkedIn
Post click, platform acceptance, independent permalink/post discovery, or a
verified receipt. Transport selection remains deterministic and cannot change
after durable submit intent.

## Decision

`FOUNDATION_ONLY_WITH_EXTERNAL_BLOCKERS` remains the correct result. No safe
narrow source change remains that can manufacture the missing authority,
approved payload, fresh readiness or audited product-build sandbox without
weakening frozen safety contracts. The next permitted live action is exactly
one fresh standing-authorized execution after the missing exact inputs are
provided; any post-intent uncertainty remains quarantined with no retry.
