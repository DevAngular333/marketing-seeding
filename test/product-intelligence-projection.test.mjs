import test from "node:test";
import assert from "node:assert/strict";
import { projectProductIntelligence } from "../src/product-intelligence-projection.mjs";
import { buildProductIntelligence } from "../src/product-intelligence.mjs";
import { createProductIntelligenceHandoff } from "../src/product-intelligence-runtime.mjs";

function fixture() {
  const document = buildProductIntelligence({ productId: "campaign-1", generatedAt: "2026-10-19T00:00:00Z", evidence: [
    { id: "readme", sourceType: "README", locator: "README.md", content: "A bounded runtime helps operators avoid blind retries. It is deterministic for teams." }
  ], claims: [] });
  const handoff = createProductIntelligenceHandoff({ document, sourceRepository: "/private/product-repo", readinessStatus: "READY" });
  return { campaigns: [{ id: "campaign-1", status: "active", productIntelligence: { document, handoff, repositoryInspection: { inspectionHash: "a".repeat(64), repository: "/private/product-repo", records: [{ id: "repo:README.md", locator: "README.md", sha256: "b".repeat(64), bytes: 10 }] } } }] };
}

test("product intelligence projection is deterministic, redacted and readiness-aware", () => {
  const first = projectProductIntelligence(fixture());
  const second = projectProductIntelligence(fixture());
  assert.deepEqual(first, second);
  assert.equal(first[0].status, "READY");
  assert.equal(first[0].evidenceCount, 1);
  assert.ok(first[0].supportedClaimCount >= 1);
  assert.equal(first[0].inspection.sourceFingerprint.length, 64);
  assert.equal(first[0].inspection.sourceFingerprint.includes("private"), false);
  assert.equal(first[0].externalSideEffects, false);
  assert.equal(first[0].authoritySideEffects, false);
});

test("invalid handoff or missing inspection is blocked/incomplete without leaking document content", () => {
  const state = fixture();
  state.campaigns[0].productIntelligence.handoff.evidenceClaimDocumentHash = "0".repeat(64);
  const blocked = projectProductIntelligence(state)[0];
  assert.equal(blocked.status, "BLOCKED");
  assert.deepEqual(blocked.validationErrors.length > 0, true);
  const incompleteState = fixture();
  delete incompleteState.campaigns[0].productIntelligence.repositoryInspection;
  const incomplete = projectProductIntelligence(incompleteState)[0];
  assert.equal(incomplete.status, "INCOMPLETE");
  assert.equal("document" in incomplete, false);
});
