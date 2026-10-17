import test from "node:test";
import assert from "node:assert/strict";
import { buildProductIntelligence } from "../src/product-intelligence.mjs";
import {
  createProductIntelligenceHandoff,
  normalizeProductIntelligenceHandoff,
  validateProductIntelligenceHandoff,
} from "../src/product-intelligence-runtime.mjs";

function documentFixture() {
  return buildProductIntelligence({
    productId: "demo-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded distribution runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A distribution runtime.", evidenceRefs: ["readme"] }],
  });
}

test("creates and validates a versioned restart-safe handoff", () => {
  const document = documentFixture();
  const handoff = createProductIntelligenceHandoff({ document, sourceRepository: "/repo/demo", readinessStatus: "ready" });
  assert.equal(handoff.handoffVersion, 1);
  assert.equal(handoff.productId, "demo-product");
  assert.match(handoff.evidenceClaimDocumentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateProductIntelligenceHandoff(JSON.parse(JSON.stringify(handoff)), document), { ok: true, errors: [] });
  assert.deepEqual(normalizeProductIntelligenceHandoff(handoff, document), handoff);
});

test("defaults readiness to incomplete when unsupported claims exist", () => {
  const document = buildProductIntelligence({
    productId: "demo-product",
    evidence: [],
    claims: [{ id: "unsupported", field: "WHY_IS_IT_BETTER", text: "Best ever.", evidenceRefs: ["missing"] }],
  });
  const handoff = createProductIntelligenceHandoff({ document, sourceRepository: "repo" });
  assert.equal(handoff.readinessStatus, "INCOMPLETE");
  assert.equal(handoff.unsupportedClaims[0].id, "unsupported");
});

test("rejects tampered document hash and invalid readiness", () => {
  const document = documentFixture();
  const handoff = createProductIntelligenceHandoff({ document, sourceRepository: "repo" });
  const tampered = { ...handoff, evidenceClaimDocumentHash: "0".repeat(64) };
  assert.equal(validateProductIntelligenceHandoff(tampered, document).ok, false);
  assert.throws(() => createProductIntelligenceHandoff({ document, sourceRepository: "repo", readinessStatus: "publish" }), /unsupported readiness/);
});

test("does not copy arbitrary secret fields into the handoff", () => {
  const document = { ...documentFixture(), token: "secret-token-value" };
  const handoff = createProductIntelligenceHandoff({ document, sourceRepository: "repo" });
  assert.equal("token" in handoff, false);
  assert.equal(Object.values(handoff).some((value) => String(value).includes("secret-token")), false);
});

