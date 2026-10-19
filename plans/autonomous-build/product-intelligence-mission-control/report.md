# Product Intelligence Mission Control Projection

Implemented a read-only per-campaign projection for persisted product intelligence. It validates the versioned handoff and document hash, reports readiness and required-field coverage, counts evidence/supported/unsupported claims, reports inspection record/hash metadata, and fingerprints the source path. Raw document content and source paths are excluded. The projection is advisory and has no authority or external side effects.
