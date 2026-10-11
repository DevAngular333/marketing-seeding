import test from "node:test";
import assert from "node:assert/strict";
import { approvalFingerprint, assertTransition, evaluateQueue, normalizeContent } from "../src/guards.mjs";

test("normalizes links and punctuation for duplicate detection", () => {
  assert.equal(normalizeContent("Hello! https://example.com A-I"), "hello a i");
});

test("rejects an invalid state transition", () => {
  assert.throws(() => assertTransition("draft", "published"), /Invalid post transition/);
});

test("a published post can be marked removed but must return through review", () => {
  assert.doesNotThrow(() => assertTransition("published", "removed"));
  assert.doesNotThrow(() => assertTransition("removed", "needs_review"));
  assert.throws(() => assertTransition("removed", "queued"), /Invalid post transition/);
});

test("blocks queueing before rules review and approval", () => {
  const post = { id: "p1", targetId: "t1", content: "Useful Blender workflow", approvedAt: null, status: "draft" };
  const state = {
    targets: [{ id: "t1", channel: "facebook_group", accountId: "a1", status: "active", rulesStatus: "pending" }],
    posts: [post]
  };
  const decision = evaluateQueue(post, state, new Date("2026-10-06T12:00:00Z"));
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.reasons.sort(), ["human_approval_required", "target_rules_not_reviewed"]);
});

test("allows a reviewed and approved first post", () => {
  const post = { id: "p1", targetId: "t1", content: "Useful Blender workflow", approvedAt: "2026-10-06T10:00:00Z", status: "approved" };
  const state = {
    targets: [{ id: "t1", channel: "facebook_group", accountId: "a1", status: "active", rulesStatus: "reviewed" }],
    posts: [post]
  };
  post.approvalBinding = approvalFingerprint(post, state.targets[0]);
  assert.equal(evaluateQueue(post, state, new Date("2026-10-06T12:00:00Z")).allowed, true);
});

test("blocks queueing while channel eligibility is blocked", () => {
  const target = {
    id: "t1", channel: "linkedin", accountId: "a1", status: "active", rulesStatus: "reviewed",
    readiness: { state: "blocked", reasonCode: "membership_required", summary: "Chưa là thành viên nhóm" }
  };
  const post = { id: "p1", targetId: "t1", content: "Useful workflow", approvedAt: "2026-10-06T10:00:00Z", status: "approved" };
  post.approvalBinding = approvalFingerprint(post, target);
  const decision = evaluateQueue(post, { targets: [target], posts: [post] });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("target_not_ready"));
});

test("blocks content that exceeds a channel-specific length limit", () => {
  const post = {
    id: "p1", targetId: "t1", content: "x".repeat(501),
    approvedAt: "2026-10-06T10:00:00Z", status: "approved"
  };
  const state = {
    targets: [{ id: "t1", channel: "threads", accountId: "a1", status: "active", rulesStatus: "not_required" }],
    posts: [post]
  };
  post.approvalBinding = approvalFingerprint(post, state.targets[0]);
  const decision = evaluateQueue(post, state, new Date("2026-10-06T12:00:00Z"));
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("content_too_long"));
});

test("email cannot queue without explicit consent and unsubscribe metadata", () => {
  const post = { id: "p1", targetId: "t1", content: "Opt-in update", approvedAt: "2026-10-06T10:00:00Z", status: "approved" };
  const state = {
    targets: [{ id: "t1", channel: "email", accountId: "mail", status: "active", rulesStatus: "reviewed" }],
    posts: [post]
  };
  assert.ok(evaluateQueue(post, state, new Date("2026-10-06T12:00:00Z")).reasons.includes("consent_metadata_required"));
  state.targets[0] = {
    ...state.targets[0], consentBasis: "explicit opt-in", audienceSource: "product waitlist", unsubscribeMechanism: "one-click unsubscribe"
  };
  post.approvalBinding = approvalFingerprint(post, state.targets[0]);
  assert.equal(evaluateQueue(post, state, new Date("2026-10-06T12:00:00Z")).allowed, true);
});

test("approval binding becomes stale when target or content changes", () => {
  const target = { id: "t1", channel: "threads", url: "https://www.threads.net/@fixture", accountId: "a1", status: "active", rulesStatus: "not_required" };
  const post = { id: "p1", targetId: "t1", content: "Original", approvedAt: "2026-10-06T10:00:00Z", status: "approved" };
  post.approvalBinding = approvalFingerprint(post, target);
  assert.equal(evaluateQueue(post, { targets: [target], posts: [post] }).allowed, true);
  post.content = "Changed";
  assert.ok(evaluateQueue(post, { targets: [target], posts: [post] }).reasons.includes("approval_binding_stale"));
});
