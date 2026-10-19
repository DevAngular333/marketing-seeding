# One-Time Exact-Authority Bootstrap Transport Design Review — 2026-10-19

## Scope

Read-only design review of the first real LinkedIn proof path on
`integration/autonomous-build` HEAD `5519b80`. No source code, canonical
runtime state, browser profile, ORCA action, credential, external platform,
social record, or UNKNOWN record was changed.

## Question

Can the already reversible-certified ORCA accessibility/pointer transport be
used for one first real LinkedIn proof under a one-time exact campaign
authority without weakening exactly-once, UNKNOWN quarantine, or LinkedIn
submit safety?

## Current facts

- Local fixture and reversible LinkedIn Cancel calibrations pass the existing
  policy (10/10 semantic activations for both accessibility and pointer) on
  pinned ORCA `1.4.229`.
- The transport selector deliberately rejects those records for irreversible
  submit. `selectCertifiedTransport({ requireIrreversibleSubmit: true })`
  requires an explicit record with
  `irreversibleSubmit: true` and
  `certificationScope === "IRREVERSIBLE_LINKEDIN_SUBMIT"`.
- LinkedIn submit performs immediate control revalidation, selects one
  deterministic transport, pins its provider/runtime identity, persists durable
  submit intent before input, and rejects transport changes after intent.
- Standing authorization already derives one exact request, one-time window,
  execution-scoped grant and unique lease without per-post approval. It binds
  campaign, account/profile, target, content/media, visibility, quota/cadence,
  readiness, idempotency, kill switch and UNKNOWN quarantine.
- A command receipt is not activation, acceptance, or publication. Ambiguous
  post-intent outcomes remain `SUBMIT_RESULT_UNKNOWN` and cannot be retried.
- Canonical runtime currently has no fresh exact authorization/readiness or
  active window/grant/lease, so no bootstrap execution can legally start.

## Recommendation

**A narrowly scoped bootstrap path can be safe in principle, but it must be a
new, explicit certification scope and execution mode. Do not treat the local
reversible record as irreversible certification, and do not add a generic
fallback or bypass.**

Recommended contract:

1. Require a fresh exact standing campaign authorization for a harmless,
   explicitly approved LinkedIn test post. The authority must bind exact
   account, ORCA profile, target URL, content hash, visibility, media hashes
   where relevant, validity, quota/cadence/concurrency, and standing reference.
2. Derive the existing exact one-time window, execution-scoped grant and lease.
   The bootstrap must use one fresh execution ID and consume at most one
   execution slot. It must not revive or rebind any terminal/UNKNOWN row.
3. Before durable intent, require fresh LinkedIn readiness, exact composer and
   Post-control ownership, enabled/geometry/coverage/focus checks, exact payload
   and visibility match, pinned ORCA executable/connected runtime
   `1.4.229`, and the local reversible transport certification record.
4. Select exactly one transport before intent. No transport fallback or change is
   permitted after intent. The bootstrap record should be explicit, e.g.
   `certificationScope: "BOOTSTRAP_LIVE_LINKEDIN_SUBMIT"`,
   `bootstrap: true`, exact provider/version, exact profile/runtime, one
   execution ID, expiry, and authority fingerprint. It must not satisfy the
   normal `IRREVERSIBLE_LINKEDIN_SUBMIT` selector globally.
5. Execute exactly one autonomous final action. Persist pre-submit evidence and
   durable intent first. After input, record transport, semantic activation,
   platform acceptance, and independent publication discovery as separate
   evidence layers.
6. Require stable permalink/post ID plus author/content/time (and media where
   applicable) before producing a VERIFIED receipt and PUBLISHED state.
7. If activation, acceptance or publication is ambiguous, record
   `SUBMIT_RESULT_UNKNOWN`, quarantine, and perform read-only reconciliation
   only. Never retry the bootstrap click or promote the transport.
8. Promote the exact transport to
   `IRREVERSIBLE_LINKEDIN_SUBMIT` only after the one live execution has
   independently verified publication and all zero-duplicate/UNKNOWN checks
   pass. A failed or UNKNOWN bootstrap produces no certification promotion.

## Why a direct exception is unsafe

Allowing the existing local/reversible record to pass
`requireIrreversibleSubmit` would erase the distinction the current policy
protects: reversible control activation does not prove behavior of LinkedIn's
irreversible Post control, platform acceptance, or publication discovery.
A generic `allowFirstSubmit` flag, transport fallback, or environment toggle
would also permit accidental live input without a durable exact authority
binding and would make certification provenance ambiguous.

## Architecture impact

This is not a safe read-only patch. It requires a versioned shared contract
change in transport certification and likely adapter/runtime configuration:
bootstrap scope, exact authority/execution binding, expiry, and post-proof
promotion semantics. The Master must review and freeze that contract before
implementation. Existing submit, lease, grant, UNKNOWN and verifier seams
should be reused unchanged.

## Current blocker

The bootstrap design cannot be executed now. Canonical state has active
authorizations/windows/grants/leases `0/0/0/0`, no fresh LinkedIn readiness,
zero published posts, and four immutable historical UNKNOWN submissions.
Fresh exact operator-authorized campaign scope/content plus current profile
readiness are unavailable. This remains `LIVE-LINKEDIN-AUTH-001`
(`EXTERNAL_HARD_BLOCKER`); transport live certification remains open until
one controlled real-platform proof exists.

## Verdict

**DESIGN-ONLY / CONTRACT-CHANGE-REQUIRED.** A constrained bootstrap can be
safe only as a separate one-shot, exact-authority proof scope with no retry or
fallback and promotion after independent VERIFIED publication. The current
reversible certification must not be reused as irreversible certification, and
no implementation or live action should occur until fresh authority and
readiness exist.
