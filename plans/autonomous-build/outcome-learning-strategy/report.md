# Outcome and learning aware advisory strategy

**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`  
**Result:** `COMPLETE_LOCAL_VERIFIED`

## Unverified first

- No browser, ORCA, credential, canonical runtime, network or external platform was accessed.
- This milestone does not prove adaptive publishing, account selection, publication verification or live LinkedIn behavior.
- The persisted outcome signal is campaign aggregate data. It is not attributed to a post, target, channel or account and is therefore used only as bounded explanatory context.

## Outcome

The existing advisory strategy now reads the campaign's latest learning feedback when that record is structurally valid, side-effect-free, tied to the same campaign and linked to the current outcome summary. The decision records bounded feedback and outcome identifiers and a controlled set of reason codes.

Action precedence is unchanged:

1. product intelligence readiness;
2. authoritative UNKNOWN quarantine;
3. an existing publishable post passing dry-run queue checks;
4. an existing eligible discovery with a grounded reply or research need;
5. dynamic wait;
6. `do_nothing`.

Learning cannot create a candidate, change a post, grant authority, dispatch an execution or override UNKNOWN quarantine. Missing, stale, malformed, cross-campaign or unsupported feedback is ignored deterministically.

## Evidence

- Focused strategy/control-cycle/learning/outcome/service/server gate: **49 passed, 0 failed, 0 skipped**.
- Full Node suite: **384 total, 382 passed, 0 failed, 2 skipped**.
- `node --check src/strategy.mjs`: passed.
- `git diff --check`: passed.
- Independent read-only review: **ACCEPT (bounded)**; no authority, browser, provider, publication or UNKNOWN semantic drift found.

## Scope of changes

- `src/strategy.mjs`: validated current learning context is included in the advisory decision and evidence references.
- `test/strategy.test.mjs`: publish precedence, current context, stale and malformed feedback, and UNKNOWN dominance regressions.
- `plans/autonomous-build/outcome-learning-strategy/`: acceptance, changes, test results and remaining gaps.

## Safety checks

The focused tests assert that deriving the learning-aware decision leaves execution requests and live grants empty. The implementation does not import or call authority, browser, provider or publication modules. The authoritative `unknownForCampaign` branch executes before learning context is read.

## Limitations and next seam

This is a learning-aware advisory projection, not a true outcome-driven next-best-action engine. Stronger adaptation requires a versioned attribution contract for post, target, channel, account and content variant outcomes. The next safe milestone is to define that contract from observed metric and publication evidence before allowing any strategy rerouting.
