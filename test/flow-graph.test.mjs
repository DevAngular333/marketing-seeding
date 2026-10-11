import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketingFlowGraph } from "../src/flow-graph.mjs";

test("canonical marketing graph keeps evidence, confidence and unresolved counters", () => {
  const graph = buildMarketingFlowGraph({
    campaigns: [{ id: "c1", name: "Campaign", productRepo: "D:\\product" }],
    artifacts: [{ id: "a1", campaignId: "c1", sha256: "abc", evidence: "decoded" }],
    stories: [{ id: "s1", campaignId: "c1", artifactId: "a1", title: "Story", groundingSources: [{ relativePath: "README.md", sha256: "def" }] }],
    targets: [{ id: "t1", name: "Target", status: "active", rulesStatus: "reviewed" }],
    posts: [{ id: "p1", campaignId: "c1", targetId: "t1", storyId: "s1", status: "published", publicationUrl: "https://example.test/post/1", evidence: "capture" }],
    metricSnapshots: [{ id: "m1", postId: "p1", capturedAt: "2026-10-07T00:00:00.000Z", source: "official:threads" }],
    interactions: [{ id: "i1", postId: "p1", text: "Question", externalId: "comment-1" }],
    replies: [{ id: "r1", interactionId: "i1", text: "Answer", groundingSources: [{ relativePath: "README.md" }] }],
    schedules: [{ id: "q1", campaignId: "c1", name: "Daily", status: "active" }]
  });

  assert.equal(graph.counters.unresolvedReferences, 0);
  assert.equal(graph.counters.nodesByKind.publication_evidence, 1);
  assert.equal(graph.nodes.find((entry) => entry.id === "post:p1").confidence, "high");
  assert.ok(graph.edges.some((edge) => edge.kind === "grounds"));
  assert.ok(graph.edges.some((edge) => edge.kind === "answered_by"));
});

test("canonical graph reports references it cannot resolve instead of silently dropping them", () => {
  const graph = buildMarketingFlowGraph({ campaigns: [], targets: [], posts: [{ id: "p1", campaignId: "missing", targetId: "missing", status: "draft" }] });
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.counters.unresolvedReferences, 2);
  assert.equal(graph.nodes[0].confidence, "low");
});

test("canonical graph accounts for every persisted collection", () => {
  const base = {
    campaigns: [{ id: "c", productRepo: "D:\\product" }], targets: [], posts: [], artifacts: [], stories: [], schedules: [], scheduleRuns: [],
    metricSnapshots: [], keywordSnapshots: [{ id: "k", campaignId: "c", keyword: "flow", capturedAt: "now" }],
    interactions: [], replies: [], conversions: [{ id: "v", campaignId: "c", name: "signup" }],
    collectorRuns: [{ id: "r", postId: "missing", channel: "threads", status: "failed" }],
    auditLog: [{ id: "a", event: "created", at: "now" }]
  };
  const graph = buildMarketingFlowGraph(base);
  assert.deepEqual(Object.values(graph.counters.unemittedByCollection), Array(Object.keys(graph.counters.unemittedByCollection).length).fill(0));
  assert.equal(graph.counters.nodesByKind.keyword_snapshot, 1);
  assert.equal(graph.counters.nodesByKind.conversion, 1);
  assert.equal(graph.counters.nodesByKind.collector_run, 1);
  assert.equal(graph.counters.nodesByKind.audit_event, 1);
  assert.equal(graph.counters.unresolvedByRelation.collected_by, 1);
});
