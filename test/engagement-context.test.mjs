import test from "node:test";
import assert from "node:assert/strict";
import { projectEngagementContext, ENGAGEMENT_CONTEXT_REASONS as R } from "../src/engagement-context.mjs";

function state(overrides = {}) {
  return {
    posts: [{ id: "p1", campaignId: "c1", targetId: "t1", status: "published", content: "hello" }, { id: "p2", campaignId: "c1", targetId: "t2", status: "submit_result_unknown", content: "unknown" }],
    targets: [
      { id: "t1", channel: "linkedin", accountId: "a1", profileId: "p1", readiness: { state: "ready", expiresAt: "2099-01-01T00:00:00.000Z" } },
      { id: "t2", channel: "linkedin", accountId: "a2", profileId: "p2", readiness: { state: "ready", expiresAt: "2099-01-01T00:00:00.000Z" } }
    ],
    interactions: [
      { id: "i2", postId: "p2", externalId: "comment:unknown", authorLabel: "x", text: "uncertain", capturedAt: "2026-01-02T00:00:00.000Z" },
      { id: "i1", postId: "p1", externalId: "comment:stable", authorLabel: "learner", text: "How?", capturedAt: "2026-01-01T00:00:00.000Z" },
      { id: "i-no-id", postId: "p1", authorLabel: "anon", text: "No ID", capturedAt: "2026-01-03T00:00:00.000Z" }
    ],
    replies: [
      { id: "r1", interactionId: "i1", status: "approved", text: "Answer", groundingSources: [{ relativePath: "README.md" }], groundingSummary: "Grounded", createdAt: "2026-01-01T01:00:00.000Z" }
    ],
    submissionUncertainties: [],
    ...overrides
  };
}

test("projects grounded conversations deterministically and fingerprints identifiers", () => {
  const result = projectEngagementContext(state(), { now: new Date("2026-01-04T00:00:00.000Z") });
  assert.equal(result.authoritySideEffects, false);
  assert.equal(result.externalSideEffects, false);
  assert.equal(result.total, 3);
  assert.equal(result.conversations[0].externalIdPresent, false);
  assert.ok(result.conversations[0].conversationRef);
  assert.ok(!("externalId" in result.conversations[0]));
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].channel, "linkedin");
});

test("keeps no-ID, already-sent and UNKNOWN interactions non-actionable", () => {
  const fixture = state({
    replies: [
      { id: "r1", interactionId: "i1", status: "sent", text: "Answer", groundingSources: [{ relativePath: "README.md" }], groundingSummary: "Grounded", createdAt: "2026-01-01T01:00:00.000Z" }
    ]
  });
  fixture.submissionUncertainties.push({ id: "u1", status: "UNKNOWN", jobId: "p2", idempotencyKeys: [] });
  const result = projectEngagementContext(fixture, { now: new Date("2026-01-04T00:00:00.000Z") });
  const noId = result.conversations.find((row) => row.interactionRef !== result.conversations.find((x) => x.externalIdPresent)?.interactionRef);
  assert.ok(result.conversations.some((row) => row.reasonCodes.includes(R.MISSING_EXTERNAL_ID)));
  assert.ok(result.conversations.some((row) => row.reasonCodes.includes(R.ALREADY_REPLIED)));
  const unknown = result.conversations.find((row) => row.channel === "linkedin" && row.status === "QUARANTINED");
  assert.ok(unknown.reasonCodes.includes(R.UNKNOWN_POST_QUARANTINED));
  assert.equal(result.candidates.length, 0);
  assert.equal(noId?.status, "OBSERVED");
});

test("fails closed for stale readiness and unsupported channels", () => {
  const fixture = state({ targets: [
    { id: "t1", channel: "unknown_channel", readiness: { state: "ready" } },
    { id: "t2", channel: "linkedin", readiness: { state: "blocked" } }
  ], posts: [
    { id: "p1", campaignId: "c1", targetId: "t1", status: "published" },
    { id: "p2", campaignId: "c1", targetId: "t2", status: "published" }
  ], interactions: [
    { id: "i1", postId: "p1", externalId: "x", text: "x", capturedAt: "2026-01-01T00:00:00.000Z" },
    { id: "i2", postId: "p2", externalId: "y", text: "y", capturedAt: "2026-01-01T00:00:00.000Z" }
  ] });
  const result = projectEngagementContext(fixture, { now: new Date("2026-01-04T00:00:00.000Z") });
  assert.ok(result.conversations[0].reasonCodes.includes(R.UNSUPPORTED_CHANNEL));
  assert.ok(result.conversations[1].reasonCodes.includes(R.STALE_OR_MISSING_READINESS));
  assert.equal(result.candidates.length, 0);
});

test("restart-equivalent input yields stable bounded projection", () => {
  const a = projectEngagementContext(state(), { now: new Date("2026-01-04T00:00:00.000Z") });
  const b = projectEngagementContext(structuredClone(state()), { now: new Date("2026-01-04T00:00:00.000Z") });
  assert.deepEqual(a, b);
});
