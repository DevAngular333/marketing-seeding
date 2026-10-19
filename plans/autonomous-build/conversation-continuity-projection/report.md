# Conversation Continuity Projection

**Status:** COMPLETE_LOCAL_VERIFIED

This lane adds a read-only continuity view that groups existing interactions and replies by post plus stable external identifier, orders turns, bounds output, fingerprints identifiers, and marks UNKNOWN publication histories as quarantined. It reuses `projectEngagementContext` and leaves approval, authority, persistence, browser, and execution semantics unchanged.

Evidence is local/synthetic only.
