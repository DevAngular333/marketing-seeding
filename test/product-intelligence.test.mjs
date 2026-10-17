import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProductIntelligence,
  normalizeEvidenceRecords,
  serializeProductIntelligence,
} from "../src/product-intelligence.mjs";

const evidence = [
  { id: "readme", sourceType: "README", locator: "README.md", content: "A deterministic distribution runtime." },
  { id: "tests", sourceType: "test", locator: "test/service.test.mjs", content: "Publication requires a permalink and verification evidence." },
  { id: "readme-copy", sourceType: "README", locator: "README.md", content: "A deterministic distribution runtime." },
];

test("normalizes duplicate evidence and produces stable hashes", () => {
  const first = normalizeEvidenceRecords(evidence);
  const second = normalizeEvidenceRecords([...evidence].reverse());
  assert.equal(first.records.length, 2);
  assert.deepEqual(first.records, second.records);
  assert.match(first.records[0].hash, /^[a-f0-9]{64}$/);
});

test("builds grounded product fields and explicit claim references", () => {
  const doc = buildProductIntelligence({
    productId: "fixture-product",
    evidence,
    claims: [
      { id: "what", field: "WHAT_IS_IT", text: "A distribution runtime.", evidenceRefs: ["readme"] },
      { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It records safe publication evidence.", evidenceRefs: ["tests"] },
      { id: "better", field: "WHY_IS_IT_BETTER", text: "It keeps transport and verification distinct.", evidenceRefs: ["tests"] },
      { id: "who", field: "WHO_NEEDS_IT", text: "Teams distributing products.", evidenceRefs: ["readme"] },
    ],
  });
  assert.equal(doc.WHAT_IS_IT.id, "what");
  assert.equal(doc.CLAIMS_WE_CAN_PROVE.length, 4);
  assert.deepEqual(doc.CLAIMS_WE_CANNOT_MAKE, []);
  assert.match(doc.documentHash, /^[a-f0-9]{64}$/);
  assert.equal(serializeProductIntelligence(doc), serializeProductIntelligence({ ...doc }));
});

test("unsupported or malformed claim references are quarantined", () => {
  const doc = buildProductIntelligence({
    evidence,
    claims: [
      { id: "unsupported", field: "WHY_IS_IT_BETTER", text: "Unsupported superiority.", evidenceRefs: ["missing"] },
      { id: "empty", field: "WHO_NEEDS_IT", text: "", evidenceRefs: ["readme"] },
    ],
  });
  assert.equal(doc.CLAIMS_WE_CAN_PROVE.length, 1);
  assert.equal(doc.CLAIMS_WE_CAN_PROVE[0].derivation, "deterministic_local_evidence");
  assert.equal(doc.CLAIMS_WE_CANNOT_MAKE.length, 3);
  assert.equal(doc.WHY_IS_IT_BETTER, null);
});

test("derives bounded fields deterministically and preserves explicit precedence", () => {
  const input = { productId: "derived", evidence, claims: [
    { id: "explicit", field: "WHAT_IS_IT", text: "The approved runtime.", evidenceRefs: ["readme"] },
  ] };
  const first = buildProductIntelligence(input);
  const second = buildProductIntelligence(input);
  assert.equal(serializeProductIntelligence(first), serializeProductIntelligence(second));
  assert.equal(first.WHAT_IS_IT.id, "explicit");
  assert.equal(first.WHAT_PROBLEM_DOES_IT_SOLVE, null);
  assert.equal(first.WHY_IS_IT_BETTER.text, "A deterministic distribution runtime.");
  assert.deepEqual(first.WHY_IS_IT_BETTER.evidenceRefs, [first.evidence[0].hash]);
  assert.ok(first.CLAIMS_WE_CANNOT_MAKE.some((item) => item.reason === "no_safe_evidence"));
});

test("ranks field-specific evidence instead of reusing the first generic sentence", () => {
  const doc = buildProductIntelligence({
    productId: "ranked",
    evidence: [
      { id: "package", sourceType: "package", locator: "package.json", content: '{"description":"A deterministic distribution runtime."}' },
      { id: "readme", sourceType: "README", locator: "README.md", content: "A deterministic distribution runtime. It helps teams manage evidence without blind retries. It is safe, verified and bounded. For operators and developers." },
    ],
  });
  assert.equal(doc.WHAT_IS_IT.text, "A deterministic distribution runtime.");
  assert.equal(doc.WHAT_PROBLEM_DOES_IT_SOLVE.text, "It helps teams manage evidence without blind retries.");
  assert.equal(doc.WHY_IS_IT_BETTER.text, "It is safe, verified and bounded.");
  assert.equal(doc.WHO_NEEDS_IT.text, "For operators and developers.");
});

test("redacts secret-like fields and values from serialized output", () => {
  const doc = buildProductIntelligence({
    evidence: [{ id: "secret", sourceType: "fixture", locator: "token.txt", content: "Bearer abcdefghijklmnop" }],
    claims: [{ id: "safe", field: "WHAT_IS_IT", text: "A tool.", evidenceRefs: ["secret"] }],
    credentials: "should never be copied",
  });
  const serialized = serializeProductIntelligence(doc);
  assert.doesNotMatch(serialized, /Bearer abcdef/);
  assert.doesNotMatch(serialized, /should never be copied/);
  assert.match(serialized, /credential\/session material exists/);
});

