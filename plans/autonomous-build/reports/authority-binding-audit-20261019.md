# Authority Binding Audit — Design OS Studio LinkedIn (2026-10-19)

## Scope and safety

Read-only audit. No canonical runtime, browser session, credentials, ORCA transport, external platform, post, draft, comment, or historical UNKNOWN record was mutated. Credential/session material was not inspected or printed.

## Decision

`LIVE_PROOF_BLOCKED`: the supplied campaign-level authority cannot yet be converted into an exact safe execution control. The natural-language scope names a campaign/product and says “exact LinkedIn profile/account,” but it does not carry the immutable identifiers required by the repository contracts. Existing canonical identifiers must not be guessed or silently reused as the new campaign binding.

## Canonical runtime evidence

Canonical state inspected at `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json` (schema 8, revision 194).

- Campaigns: 7; none is `Design OS Studio launch` and none is bound to `design-os-studio`.
- Targets: exactly one LinkedIn target:
  - target ID: `f38f2074-7d87-4cb6-8313-8e1b73e2c3fd`
  - target URL: `https://www.linkedin.com/feed/`
  - account ID: `linkedin_primary`
  - ORCA profile UUID: `b27a3bcc-b139-4353-a15b-10e10824291e`
  - name: `LinkedIn Primary Mac Validation`
- Execution account: exactly one LinkedIn account record, `linkedin:linkedin_primary`, with the same account/profile binding and an identity reference URL. This record belongs to prior validation runtime; the new authority does not explicitly identify it.
- Active authorizations/windows/grants/leases: `0/0/0/0`.
- Existing authorizations are terminal (`expired`, `paused`, `superseded`, or consumed/revoked grants) and are for unrelated validation or Blender campaigns.
- Existing readiness is expired (`expiresAt` 2026-10-17T06:06:46.590Z); it is not fresh proof for this campaign.
- Historical `SUBMIT_RESULT_UNKNOWN` executions are present and immutable. They cannot be reused or retried.

## Standing delegation contract

`src/campaign-authorization.mjs` and `src/service.mjs` implement the intended standing path:

1. `authorizeCampaign(... executionMode: "standing_autonomous", standingAuthorizationReference, allowLiveExecution: true)` requires exact destinations, account/profile/target bindings, approved copy hashes or an exact source-bound template/claim set, audiences, visibility, schedule, quotas and concurrency.
2. Creating an exact authorized post derives a one-time execution window, execution request and single-use live grant bound to that post/execution.
3. `src/standing-campaign-delegation.mjs` derives a bounded control plan; JEV/submit-boundary checks retain exact account/profile/target/content/visibility/readiness and UNKNOWN quarantine semantics.
4. Tests in `test/campaign-authorization.test.mjs` prove standing authorization can derive a bounded window/grant without per-post approval. This is local synthetic evidence, not live proof.

The implementation therefore has a safe mechanism for fresh authority, but the supplied authority is missing exact values needed to invoke it without guessing.

## Supplied authority versus required binding

| Requirement | Supplied | Evidence/result |
|---|---|---|
| campaign | `Design OS Studio launch` | New campaign ID is absent from canonical state; no exact campaign record exists. |
| product | `design-os-studio` | Local reference repo exists at `/Users/nam/Documents/System-Agentic_AI/references/design-os-studio`; not attached to canonical campaign state. |
| platform | LinkedIn | Supported by the existing adapter/readiness path. |
| target | “Exact LinkedIn profile/account for this campaign only” | Missing immutable target ID and target URL. Existing feed target is a prior validation target and cannot be assumed. |
| account | “Exact LinkedIn profile/account” | Missing account ID. `linkedin_primary` is the only canonical record but reuse would be an unverified inference. |
| ORCA profile | not supplied | Missing immutable ORCA profile UUID. Existing UUID cannot be assumed. |
| content | approved LinkedIn launch post content, no new claims | No LinkedIn-specific approved copy file/hash found in the canonical runtime or Design OS Studio reference repository. |
| content hash | not supplied | `approved_copy_set` requires one or more SHA-256 hashes; template mode requires exact source-bound claims/templates. |
| media | not specified | Need explicit no-media declaration or each approved artifact ID + SHA-256 if media is part of the post. |
| visibility | `Public` | Can normalize to `PUBLIC` once exact post is created. |
| audience | six named audience groups | Can be stored as one exact allowed audience value or explicit bounded values after campaign creation; current input does not define its canonical serialization. |
| validity | now through 24h | Can derive exact UTC `validFrom`/`validUntil`; must be committed as a new authorization. |
| quota/cadence/concurrency | 1 / single post / 1 | Compatible with `maxJobsPerAccountPerDay: 1`, `maxJobsPerCampaignPerDay: 1`, `maxConcurrency: 1`, and a zero minimum interval, subject to service validation. |
| authorization reference | `design-os-studio-linkedin-launch-2026-10-19` | Suitable non-secret reference, but not a substitute for exact bindings/content hash. |

## Approved-content evidence audit

The local Design OS Studio reference contains strong product evidence and channel drafts, but no file explicitly marked as the approved LinkedIn launch post. Relevant evidence:

- `/Users/nam/Documents/System-Agentic_AI/plans/design-os-studio-launch/content/product-hunt.md` contains an approved Product Hunt description (385 characters), not LinkedIn copy. The exact description bytes hash to `c5f9d8d4e03d356f7cd8b441d8216e2a0dbd3b97e3d8173cf05b008e1a4fc62b`.
- `/Users/nam/Documents/System-Agentic_AI/plans/design-os-studio-launch/content/show-hn.md` contains a Show HN draft, not LinkedIn copy.
- `/Users/nam/Documents/System-Agentic_AI/plans/design-os-studio-launch/content/figma-forum.md` contains a Figma Forum discussion, not LinkedIn copy.
- `claims.md` defines supported and unverified claims, and `product-facts.md`/the reference README provide grounding, but these are evidence/claim sources, not an approved final LinkedIn payload.
- No canonical campaign/post in the marketing-seeding state contains `Design OS Studio` or `design-os-studio` with an approved LinkedIn content hash.

The Product Hunt description could only be used if the authority explicitly identifies that exact byte sequence as the approved LinkedIn copy. It must not be inferred from “approved LinkedIn launch post content.”

## Exact inputs still required

To safely create a new campaign authorization and derive one fresh execution, provide or persist through the project’s authorized campaign-intake contract:

1. exact target ID and target URL (or an explicit instruction to create a new target record with its immutable identity); 
2. exact LinkedIn account ID;
3. exact ORCA profile UUID;
4. exact approved LinkedIn post bytes, or an approved SHA-256 content hash that already resolves to those bytes;
5. explicit media declaration: no media, or exact approved artifact ID and SHA-256 for every attachment;
6. exact campaign/product repository binding (`/Users/nam/Documents/System-Agentic_AI/references/design-os-studio` or another authorized product path) so `campaignScopeFingerprint` is deterministic;
7. canonical serialization for the six audience groups (one approved audience string or an explicit set).

The target/account/profile may be the existing sole canonical binding only if the authority explicitly supplies those immutable values; the current wording does not.

## Resulting blocker classification

- `LIVE-LINKEDIN-AUTH-001`: OPEN, classification `EXTERNAL_HARD_BLOCKER` for the live lane until exact identity/content bindings are supplied through authorization intake. Existing expired controls cannot be revived.
- `ORCA-TRANSPORT-LIVE-CERT-001`: remains open for irreversible LinkedIn activation/acceptance/publication proof, but no live transport attempt is permitted until the authority blocker is resolved.

## Safe next action

Keep all runtime and historical records unchanged. Once exact bindings and approved copy hash are available, create one new `standing_autonomous` campaign authorization with the supplied reference, derive exactly one window/grant/lease for one fresh execution, refresh readiness, and run the existing autonomous JEV → LinkedIn → ORCA path. Any uncertainty after durable submit intent remains `SUBMIT_RESULT_UNKNOWN` with no retry.
