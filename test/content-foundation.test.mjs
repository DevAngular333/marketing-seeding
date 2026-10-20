import test from "node:test";
import assert from "node:assert/strict";
import { deriveContentCandidates, deriveProductIntelligenceStory } from "../src/content-foundation.mjs";

const evidence = [{ id: "readme", hash: "a".repeat(64), locator: "README.md" }];
const pi = { handoff: { readinessStatus: "READY" }, document: { evidence, CLAIMS_WE_CAN_PROVE: [{ id: "what", text: "A bounded product runtime.", evidenceRefs: ["a".repeat(64)] }] } };
const story = { id: "s1", title: "Evidence first", callToAction: "Learn more", claimIds: ["what"] };
const target = { id: "t1", channel: "linkedin" };
test("content candidates are deterministic and draft-only", () => {
  const a = deriveContentCandidates({ productIntelligence: pi, story, targets: [target] });
  const b = deriveContentCandidates({ productIntelligence: pi, story, targets: [target] });
  assert.deepEqual(a, b); assert.equal(a[0].status, "draft"); assert.match(a[0].contentIdentity, /^[a-f0-9]{64}$/);
  assert.deepEqual(a[0].claimIds, ["what"]); assert.deepEqual(a[0].evidenceRefs, ["a".repeat(64)]);
});
test("content candidates do not duplicate the story title claim", () => {
  const candidate = deriveContentCandidates({
    productIntelligence: {
      handoff: { readinessStatus: "READY" },
      document: {
        evidence,
        CLAIMS_WE_CAN_PROVE: [
          { id: "what", text: "A bounded product runtime.", evidenceRefs: ["a".repeat(64)] },
          { id: "why", text: "It keeps evidence local.", evidenceRefs: ["a".repeat(64)] }
        ]
      }
    },
    story: { id: "s-title", title: "A bounded product runtime.", callToAction: "Inspect the evidence.", claimIds: ["what", "why"] },
    targets: [target]
  })[0];
  assert.equal(candidate.content, "A bounded product runtime. — It keeps evidence local. Inspect the evidence.");
  assert.equal(candidate.content.includes("A bounded product runtime. — A bounded product runtime."), false);
});
test("missing readiness or evidence fails closed", () => {
  assert.throws(() => deriveContentCandidates({ productIntelligence: { ...pi, handoff: { readinessStatus: "INCOMPLETE" } }, story, targets: [target] }), /READY/);
  assert.throws(() => deriveContentCandidates({ productIntelligence: { handoff: { readinessStatus: "READY" }, document: { evidence, CLAIMS_WE_CAN_PROVE: [{ id: "x", text: "x", evidenceRefs: ["b".repeat(64)] }] } }, story: { ...story, claimIds: ["x"] }, targets: [target] }), /supported claims/);
});
test("unsupported channel and policy length fail closed", () => {
  assert.throws(() => deriveContentCandidates({ productIntelligence: pi, story, targets: [{ id: "t", channel: "unknown" }] }), /Unsupported/);
  assert.throws(() => deriveContentCandidates({ productIntelligence: pi, story: { ...story, callToAction: "x".repeat(600) }, targets: [{ id: "t", channel: "threads" }] }), /bounded input length/);
});
test("credential-like content fails closed", () => {
  assert.throws(() => deriveContentCandidates({ productIntelligence: pi, story: { ...story, title: "token: abc123" }, targets: [target] }), /credential\/session/);
  const unsafe = { ...pi, document: { ...pi.document, CLAIMS_WE_CAN_PROVE: [{ id: "x", text: "password: abc", evidenceRefs: ["a".repeat(64)] }] } };
  assert.throws(() => deriveContentCandidates({ productIntelligence: unsafe, story: { ...story, claimIds: ["x"] }, targets: [target] }), /credential\/session/);
  assert.throws(() => deriveContentCandidates({ productIntelligence: pi, story: { ...story, title: "Bearer abc123456" }, targets: [target] }), /credential\/session/);
});
test("oversized or missing identifiers fail closed without truncation", () => {
  assert.throws(() => deriveContentCandidates({ productIntelligence: { ...pi, document: { ...pi.document, CLAIMS_WE_CAN_PROVE: [{ id: "x".repeat(161), text: "claim", evidenceRefs: ["a".repeat(64)] }] } }, story, targets: [target] }), /claim id/);
  assert.throws(() => deriveContentCandidates({ productIntelligence: { ...pi, document: { ...pi.document, CLAIMS_WE_CAN_PROVE: [{ id: "x", text: "claim".repeat(250), evidenceRefs: ["a".repeat(64)] }] } }, story, targets: [target] }), /claim text/);
  assert.throws(() => deriveContentCandidates({ productIntelligence: pi, story, targets: [{ channel: "linkedin" }] }), /target id/);
});

test("product intelligence story derivation is deterministic and draft-only", () => {
  const evidenceHash = "c".repeat(64);
  const claims = [
    ["WHAT_IS_IT", "what", "A bounded runtime."],
    ["WHAT_PROBLEM_DOES_IT_SOLVE", "problem", "It reduces blind retries."],
    ["WHY_IS_IT_BETTER", "better", "It is deterministic and verified."],
    ["WHO_NEEDS_IT", "who", "Operators and developers."],
  ];
  const document = {
    productId: "product-1",
    WHAT_IS_IT: { id: "what", field: "WHAT_IS_IT", text: "A bounded runtime.", evidenceRefs: [evidenceHash] },
    WHAT_PROBLEM_DOES_IT_SOLVE: { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It reduces blind retries.", evidenceRefs: [evidenceHash] },
    WHY_IS_IT_BETTER: { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and verified.", evidenceRefs: [evidenceHash] },
    WHO_NEEDS_IT: { id: "who", field: "WHO_NEEDS_IT", text: "Operators and developers.", evidenceRefs: [evidenceHash] },
    CLAIMS_WE_CAN_PROVE: claims.map(([field, id, text]) => ({ id, field, text, evidenceRefs: [evidenceHash] })),
    CLAIMS_WE_CANNOT_MAKE: [],
  };
  const input = {
    campaignId: "campaign-1",
    productIntelligence: { handoff: { readinessStatus: "READY", evidenceClaimDocumentHash: "d".repeat(64) }, document },
    callToAction: "Read the evidence",
    disclosure: "Evidence-grounded draft.",
    groundingSources: [{ relativePath: "README.md", sha256: "a".repeat(64), evidenceHash }],
  };
  const first = deriveProductIntelligenceStory(input);
  const second = deriveProductIntelligenceStory(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "draft");
  assert.equal(first.title, "A bounded runtime.");
  assert.equal(first.audience, "Operators and developers.");
  assert.deepEqual(first.claimIds, ["what", "problem", "better", "who"]);
  assert.match(first.storyIdentity, /^[a-f0-9]{64}$/);
  assert.equal(first.groundingSources[0].relativePath, "README.md");
  assert.equal(first.disclosure, "Evidence-grounded draft.");
});

test("product intelligence story derivation fails closed for incomplete or unbound inputs", () => {
  const evidenceHash = "c".repeat(64);
  const base = {
    productIntelligence: {
      handoff: { readinessStatus: "READY", evidenceClaimDocumentHash: "d".repeat(64) },
      document: {
        productId: "product-1",
        WHAT_IS_IT: { id: "what", field: "WHAT_IS_IT", text: "A runtime.", evidenceRefs: [evidenceHash] },
        CLAIMS_WE_CAN_PROVE: [{ id: "what", field: "WHAT_IS_IT", text: "A runtime.", evidenceRefs: [evidenceHash] }],
        CLAIMS_WE_CANNOT_MAKE: [],
      }
    },
    campaignId: "campaign-1",
    callToAction: "Read the evidence",
    groundingSources: [{ relativePath: "README.md", sha256: "a".repeat(64), evidenceHash }],
  };
  assert.throws(() => deriveProductIntelligenceStory(base), /requires READY|field WHAT_PROBLEM/);
  const unsafe = { ...base, callToAction: "token: abc123" };
  assert.throws(() => deriveProductIntelligenceStory(unsafe), /field WHAT_PROBLEM|credential\/session/);
  assert.throws(() => deriveProductIntelligenceStory({ ...base, disclosure: "token: abc123" }), /field WHAT_PROBLEM|credential\/session/);
});
