# Conversation Context Projection

**Status:** COMPLETE_LOCAL_VERIFIED

Added `src/engagement-context.mjs`, a bounded read-only projection joining existing interactions and replies to campaign/post/target context. It fingerprints identifiers, redacts raw IDs, classifies conversations with deterministic reason codes, and exposes advisory candidates only for grounded unsent replies on supported ready targets.

`SeedingService.dashboard()` now exposes `engagementContext`. No route or send control was added. Reply approval and `markReplySent` semantics remain unchanged. UNKNOWN publication rows are quarantined and cannot produce candidates.

Evidence is local/synthetic only. No browser, ORCA, provider, credential, canonical runtime or social action was used.
