# Task — BUILD · deterministic audience and channel fit

## Identity

Run: autonomous-build-20261017 · Role: BUILD · Controller: `/root`  
Independent verifier: `/root` in a fresh read-only pass after the worker stops  
Workspace: `/Users/nam/Documents/marketing-seeding-integration` · Branch:
`integration/autonomous-build`  
Work dir: `plans/autonomous-build/audience-channel-intelligence/`  
Report path: `plans/autonomous-build/reports/audience-channel-intelligence-worker.md`

## Acceptance IDs

A1–A6 · C1–C5 · V1–V5 from `acceptance.md`.

## Read first

1. `acceptance.md`
2. `src/discovery.mjs`
3. `src/service.mjs` discovery methods and dashboard projection
4. `test/discovery.test.mjs`, `test/discovery-scheduler.test.mjs`, and the
   discovery section of `test/service.test.mjs`
5. `plans/autonomous-build/dependency-graph.md`

## Allowed to change

- `src/discovery.mjs`
- `src/service.mjs` only where it passes optional fit inputs into the existing
  discovery normalization/persistence path
- `test/discovery.test.mjs`
- `test/service.test.mjs` only for focused discovery regressions
- `plans/autonomous-build/audience-channel-intelligence/`
- `plans/autonomous-build/reports/audience-channel-intelligence-worker.md`

Everything else is read-only. Do not commit or modify the canonical runtime.

## Objective

Add a bounded deterministic fit evaluation over caller-supplied discovery
observations. It may compare normalized title/text against explicit audience
keywords and compare the observed host/channel against an explicit target
channel and optional locale hints. Missing evidence must produce `UNKNOWN`.
Do not infer audience identity from a URL alone. Preserve existing discovery
IDs, policy classification and score behavior when fit options are absent.
Persist only advisory fit metadata under each existing discovery observation.

Use a small stable result shape, for example:

```text
fit: {
  audience: { status: MATCHED|MISMATCHED|UNKNOWN, matchedTerms: [], reason: ... },
  channel: { status: MATCHED|MISMATCHED|UNKNOWN, reason: ... },
  locale: { status: MATCHED|MISMATCHED|UNKNOWN, reason: ... },
  eligible: false,
  explanation: ...
}
```

The exact shape may differ if the existing contracts suggest a better one, but
it must be bounded, deterministic, explicit, and advisory. Never let fit
metadata create or alter campaign authorizations, windows, grants, leases,
execution requests, posts, publication receipts or UNKNOWN submission state.

## Forbidden

- No network, browser, ORCA/JEV, credentials, cookies or session material.
- No LinkedIn/JEV/ORCA, transport, authorization, grant, window, lease, submit
  intent, verifier or UNKNOWN execution changes.
- No new store, state machine, provider router or dashboard redesign.
- No model/provider calls or audience claims beyond explicit supplied hints.
- No external side effect.

## Verification

Run focused discovery/service tests, full Node suite if time permits, all
`node --check src/*.mjs`, `git diff --check`, and write the report with
unverified items first. Include a FACT/INFERENCE/UNKNOWN ledger and end with
the exact required status line:

`Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`

## Worker preamble

Keep an evidence ledger; diagnose independently; stay within scope; state
PREDICT before consequential actions; attack edge inputs; report what could not
be verified first. Success test: A1–A6, C1–C5, V1–V5. Reversibility: two-way;
no destructive or external actions are authorized.
