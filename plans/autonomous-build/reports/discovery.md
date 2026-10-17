# Discovery foundation report

- **Status:** LOCAL_VERIFIED, caller-supplied observations only.
- **Implementation:** `src/discovery.mjs` normalizes HTTP(S) observations, redacts credential-like material, deduplicates by stable SHA-256 identity, applies explicit host policy, classifies relevance/blocked terms, and emits bounded explainable scores.
- **Runtime seam:** `SeedingService.recordDiscoveries` persists the normalized records under the existing campaign state and `/api/dashboard` projects them read-only. The endpoint never creates a post, authorization, grant, browser action or publish permission.
- **Verification:** discovery focused tests plus service persistence/projection tests pass. No network crawler or external platform call was made.
- **Limit:** continuous public observation, audience matching and community rule discovery remain unimplemented.
