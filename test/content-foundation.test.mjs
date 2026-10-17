import test from "node:test";
import assert from "node:assert/strict";
import { deriveContentCandidates } from "../src/content-foundation.mjs";

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
