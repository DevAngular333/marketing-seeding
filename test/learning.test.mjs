import test from "node:test";
import assert from "node:assert/strict";
import { deriveLearningFeedback, normalizePostAttributionContext } from "../src/learning.mjs";

test("unknown dominates learning with do nothing",()=>{const s={campaigns:[{id:"c",outcomeSummary:{summaryId:"o",publication:{unknown:1,unknownExecutionIds:["e"]},metrics:{snapshots:1,totals:{},coverage:{}},evidence:{}}}]}; const f=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T00:00:00Z")}); assert.equal(f.action,"do_nothing"); assert.equal(f.advisory,true);});
test("measured outcomes produce explainable engagement feedback",()=>{const s={campaigns:[{id:"c",outcomeSummary:{summaryId:"o",publication:{unknown:0},metrics:{snapshots:1,totals:{clicks:2,leads:0},coverage:{clicks:{measured:1}}},evidence:{metricSnapshotIds:["m"]}}}]}; const f=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T00:00:00Z")}); assert.equal(f.action,"engage"); assert.deepEqual(f.evidence,["m"]);});
test("learning identity stable within hour bucket",()=>{const s={campaigns:[{id:"c",outcomeSummary:{summaryId:"o",publication:{unknown:0},metrics:{snapshots:0},evidence:{}}}]}; const a=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T01:01:00Z")}); const b=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T01:59:00Z")}); assert.equal(a.feedbackId,b.feedbackId);});

test("observation keeps verified publication and missing metrics explicit",()=>{const s={campaigns:[{id:"c",outcomeSummary:{summaryId:"o",publication:{verified:1,accepted:1,unknown:0,unverified:1},metrics:{snapshots:1,totals:{},coverage:{impressions:{measured:0,unknown:1,unsupported:0}}},evidence:{}}}]}; const f=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T00:00:00Z")}); assert.deepEqual(f.observation.publication,{verified:1,accepted:1,unknown:0,unverified:1}); assert.deepEqual(f.observation.metrics.coverage.impressions,{measured:0,unknown:1,unsupported:0});});
test("unsupported and unknown metric coverage remain distinct",()=>{const s={campaigns:[{id:"c",outcomeSummary:{summaryId:"o",publication:{unknown:0},metrics:{snapshots:1,totals:{},coverage:{clicks:{measured:0,unknown:2,unsupported:3}}},evidence:{}}}]}; const f=deriveLearningFeedback(s,"c",{now:new Date("2026-01-01T00:00:00Z")}); assert.equal(f.observation.metrics.coverage.clicks.unknown,2); assert.equal(f.observation.metrics.coverage.clicks.unsupported,3); assert.equal(f.action,"wait");});

test("post attribution context preserves cross-post isolation and UNKNOWN dominance", () => {
  const context = normalizePostAttributionContext({ postAttributions: [
    { postId: "p1", status: "VERIFIED", target: { targetId: "t1", channel: "threads", accountId: "a1", profileId: "pr1" } },
    { postId: "p1", status: "UNKNOWN", target: { targetId: "t1", channel: "threads", accountId: "a1", profileId: "pr1" } },
    { postId: "p2", status: "PARTIAL", target: { targetId: "t2", channel: "linkedin", accountId: "a2", profileId: "pr2" } },
    { postId: "p3", status: "UNSUPPORTED", target: { targetId: "t3" } },
    { postId: "p4", status: "PARTIAL", evidence: { receiptIds: ["secret-token-id", "receipt-4"] } }
  ] });
  assert.deepEqual(context.postAttributions.map((item) => [item.postId, item.status]), [["p1", "UNKNOWN"], ["p2", "PARTIAL"], ["p4", "PARTIAL"]]);
  assert.deepEqual(context.counts, { UNKNOWN: 1, VERIFIED: 0, PARTIAL: 2, UNOBSERVED: 0 });
  assert.equal(context.postAttributions[2].evidence.receiptIds.includes("secret-token-id"), false);
  assert.equal("accountId" in context.postAttributions[0].target, false);
  assert.equal("profileId" in context.postAttributions[0].target, false);
  assert.match(context.postAttributions[0].target.accountFingerprint, /^[a-f0-9]{16}$/);
});

test("learning exposes bounded deterministic post attribution context without authority effects", () => {
  const postAttributions = Array.from({ length: 40 }, (_, index) => ({
    postId: `p-${String(index).padStart(2, "0")}`,
    status: index === 0 ? "UNKNOWN" : "PARTIAL",
    target: { targetId: `t-${index}`, channel: "threads", accountId: "acct", profileId: "profile" },
    metrics: { snapshotId: `metric-${index}`, capturedAt: "2026-01-01T00:00:00Z", values: { clicks: index }, coverage: { clicks: "measured" } },
    evidence: { receiptIds: [`receipt-${index}`] }
  }));
  const state = { campaigns: [{ id: "c", outcomeSummary: {
    summaryId: "outcome-111111111111111111111111",
    publication: { unknown: 0 }, metrics: { snapshots: 1, totals: {}, coverage: {} }, evidence: {}, postAttributions
  } }] };
  const first = deriveLearningFeedback(state, "c", { now: new Date("2026-01-01T00:00:00Z") });
  const second = deriveLearningFeedback(state, "c", { now: new Date("2026-01-01T00:00:00Z") });
  assert.deepEqual(first.postAttributionContext, second.postAttributionContext);
  assert.equal(first.postAttributionContext.total, 40);
  assert.equal(first.postAttributionContext.postAttributions[0].postId, "p-00");
  assert.equal(first.postAttributionContext.postAttributions[0].status, "UNKNOWN");
  assert.equal(first.authoritySideEffects, false);
  assert.equal(first.feedbackId, second.feedbackId);
});

test("bounded context retains a late UNKNOWN and reports global counts", () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ postId: `p-${String(index).padStart(2, "0")}`, status: "PARTIAL" }));
  rows.push({ postId: "z-unknown", status: "UNKNOWN" });
  const context = normalizePostAttributionContext({ postAttributions: rows });
  assert.equal(context.total, 31);
  assert.equal(context.truncated, true);
  assert.equal(context.counts.UNKNOWN, 1);
  assert.equal(context.postAttributions.some((item) => item.postId === "z-unknown"), true);
  assert.equal(context.postAttributions.length, 24);
});

test("post metrics advisory classifies bounded response and measurement states", () => {
  const context = normalizePostAttributionContext({ postAttributions: [
    { postId: "response", status: "VERIFIED", metrics: { snapshotId: "m1", values: { clicks: 2 }, coverage: { clicks: "measured" } } },
    { postId: "reach", status: "VERIFIED", metrics: { snapshotId: "m2", values: { impressions: 12, clicks: 0 }, coverage: { impressions: "measured", clicks: "measured" } } },
    { postId: "measured-zero", status: "VERIFIED", metrics: { snapshotId: "m3", values: { clicks: 0 }, coverage: { clicks: "measured" } } },
    { postId: "partial", status: "PARTIAL", metrics: { snapshotId: "m4", values: { impressions: 4 }, coverage: { impressions: "measured", clicks: "unknown" } } },
    { postId: "unknown", status: "VERIFIED", metrics: { snapshotId: "m5", values: {}, coverage: { clicks: "unsupported" } } },
    { postId: "none", status: "UNOBSERVED" }
  ] });
  assert.deepEqual(context.metricAdvisory.counts, {
    RESPONSE_OBSERVED: 1,
    REACH_WITHOUT_RESPONSE: 1,
    MEASURED_NO_RESPONSE: 1,
    PARTIAL_MEASUREMENTS: 1,
    UNKNOWN_OR_UNSUPPORTED: 1,
    UNOBSERVED: 1
  });
  assert.equal(context.metricAdvisory.total, 6);
  assert.deepEqual(context.metricAdvisory.posts.map((item) => item.classification), [
    "RESPONSE_OBSERVED", "REACH_WITHOUT_RESPONSE", "MEASURED_NO_RESPONSE", "PARTIAL_MEASUREMENTS", "UNKNOWN_OR_UNSUPPORTED", "UNOBSERVED"
  ]);
  assert.deepEqual(context.metricAdvisory.posts[0].evidenceRefs, ["m1"]);
});
