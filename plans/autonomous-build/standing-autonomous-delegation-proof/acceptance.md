# Standing autonomous delegation proof

## Requirements

- A1. In an isolated temporary `JsonStore`, create one active campaign with one exact LinkedIn target, account and profile binding.
- A2. Activate one `standing_autonomous` campaign authorization with bounded content, visibility, schedule, quota and cadence, without storing credentials or session material.
- A3. Materialize one approved post through the producer/queue path without a per-post approval, operator-created window or operator-created grant.
- A4. Persist exactly one request, one bounded one-time execution window, one execution-scoped live grant and one unique execution lease with exact campaign/account/profile/target/content/visibility bindings.
- A5. Re-read the isolated state and derive an allowed provider-neutral control plan; no browser command, ORCA command, external network write or social mutation is allowed.
- A6. Prove idempotent queue re-evaluation does not create a second window, grant, request or lease, and release the lease without changing the terminal history.

## Constraints

- C1. Never modify canonical runtime state or historical `UNKNOWN` executions.
- C2. Never invoke a browser, ORCA, LinkedIn, external API or social action.
- C3. Do not add a second campaign store, state machine, provider router or browser abstraction.
- C4. Do not persist credentials, cookies, tokens, raw browser profile data or session material in artifacts.

## Verification

- V1. The focused proof test passes with zero failures.
- V2. All derived controls have exact fingerprints and no scope escalation.
- V3. The lease is unique and bound to the fresh execution; after release, no active lease remains.
- V4. Re-running the scheduler is idempotent and preserves counts.
- V5. The proof is labeled `LOCAL_REAL_ISOLATED_STORE`, not live platform proof.
