# Opportunity Projection Acceptance

A1. Project only already-normalized, relevant, policy-eligible discoveries.
A2. Reject explicit fit mismatches/unknowns and malformed identifiers.
A3. Return deterministic score ordering, bounded output, and explainable reasons.
A4. Mark output advisory with no authority or external side effects.

V1. `node --test test/opportunity-projection.test.mjs` passes.
V2. Ineligible, blocked, malformed, duplicate, and unknown-fit rows are omitted.
