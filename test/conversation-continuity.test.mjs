import test from "node:test";
import assert from "node:assert/strict";
import { projectConversationContinuity } from "../src/conversation-continuity.mjs";

const base = () => ({
  posts: [{ id: "p1", campaignId: "c1", targetId: "t1", status: "published" }, { id: "p-unknown", campaignId: "c1", targetId: "t1", status: "submit_result_unknown" }],
  targets: [{ id: "t1", channel: "linkedin", readiness: { state: "ready", expiresAt: "2099-01-01T00:00:00Z" } }],
  interactions: [
    { id: "i1", postId: "p1", externalId: "comment:1", authorLabel: "reader", text: "Question", capturedAt: "2026-01-01T00:00:00Z" },
    { id: "i2", postId: "p1", externalId: "comment:1", authorLabel: "reader", text: "Follow up", capturedAt: "2026-01-02T00:00:00Z" },
    { id: "ix", postId: "p-unknown", externalId: "comment:1", text: "uncertain", capturedAt: "2026-01-03T00:00:00Z" }
  ],
  replies: [{ id: "r1", interactionId: "i1", status: "draft", text: "Grounded answer", createdAt: "2026-01-01T01:00:00Z" }],
  submissionUncertainties: []
});

test("projects bounded chronological continuity scoped by post", () => {
  const result = projectConversationContinuity(base(), { now: new Date("2026-01-04T00:00:00Z") });
  assert.equal(result.authoritySideEffects, false);
  assert.equal(result.externalSideEffects, false);
  assert.equal(result.total, 2);
  const observed = result.conversations.find((row) => row.status === "OBSERVED");
  assert.equal(observed.turns.length, 3);
  assert.equal(observed.turns[0].kind, "interaction");
  assert.ok(result.conversations.every((row) => !row.conversationRef.includes("comment:1")));
});

test("UNKNOWN publication quarantines continuity without creating actionability", () => {
  const result = projectConversationContinuity(base(), { now: new Date("2026-01-04T00:00:00Z") });
  const unknown = result.conversations.find((row) => row.postRef);
  assert.ok(result.conversations.some((row) => row.status === "QUARANTINED"));
  assert.equal(unknown?.status, "QUARANTINED");
});

test("projection is deterministic and bounded", () => {
  const input = base();
  const options = { now: new Date("2026-01-04T00:00:00Z"), maxTurns: 1, maxConversations: 1 };
  const a = projectConversationContinuity(input, options);
  const b = projectConversationContinuity(structuredClone(input), options);
  assert.deepEqual(a, b);
  assert.equal(a.conversations.length, 1);
  assert.equal(a.conversations[0].turns.length, 1);
  assert.equal(a.truncated, true);
});

test("clamps untrusted limits and redacts secret-like conversation text", () => {
  const input = base();
  input.interactions[0].text = "Question token=should-not-escape";
  const result = projectConversationContinuity(input, {
    now: new Date("2026-01-04T00:00:00Z"),
    maxConversations: 100_000,
    maxTurns: -1
  });
  assert.ok(result.conversations.length <= 48);
  assert.ok(result.conversations.every((row) => row.turns.length === 0));
  assert.ok(!JSON.stringify(result).includes("should-not-escape"));
});

test("accepts an ISO timestamp for read-only continuity generation", () => {
  const result = projectConversationContinuity(base(), { now: "2026-01-04T00:00:00Z" });
  assert.equal(result.generatedAt, "2026-01-04T00:00:00.000Z");
});

test("rejects an invalid continuity timestamp", () => {
  assert.throws(() => projectConversationContinuity(base(), { now: "not-a-date" }), /now must be a valid date/);
});
