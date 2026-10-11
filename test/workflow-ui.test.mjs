import test from "node:test";
import assert from "node:assert/strict";
import { buildComposerUrl, canPreparePublication, parseMetricInput } from "../public/workflow.js";

test("composer URLs stay on the allowlisted platform and Reddit opens a subreddit submit page", () => {
  assert.equal(buildComposerUrl({ channel: "facebook_group", url: "https://www.facebook.com/groups/77005549170" }), "https://www.facebook.com/groups/77005549170");
  assert.equal(buildComposerUrl({ channel: "reddit", url: "https://www.reddit.com/r/blender/" }), "https://www.reddit.com/r/blender/submit?type=TEXT");
  assert.equal(buildComposerUrl({ channel: "linkedin", url: "https://www.linkedin.com/feed/?shareActive=true" }), "https://www.linkedin.com/feed/?shareActive=true");
  assert.throws(() => buildComposerUrl({ channel: "email", url: "https://mail.google.com/" }), /opt-in/);
  assert.throws(() => buildComposerUrl({ channel: "reddit", url: "https://example.com/r/blender" }), /không thuộc miền/);
  assert.throws(() => buildComposerUrl({ channel: "reddit", url: "javascript:alert(1)" }), /không thuộc miền/);
});

test("browser publication preparation requires approval, active target and reviewed rules", () => {
  const target = { channel: "reddit", url: "https://www.reddit.com/r/blender/", status: "active", rulesStatus: "reviewed" };
  assert.equal(canPreparePublication({ status: "draft" }, target).allowed, false);
  assert.equal(canPreparePublication({ status: "approved" }, { ...target, rulesStatus: "pending" }).allowed, false);
  assert.equal(canPreparePublication({ status: "approved" }, {
    ...target,
    readiness: { state: "blocked", summary: "Chưa đủ quyền đăng" }
  }).reason, "Chưa đủ quyền đăng");
  const ready = canPreparePublication({ status: "approved" }, target);
  assert.equal(ready.allowed, true);
  assert.equal(ready.composerUrl, "https://www.reddit.com/r/blender/submit?type=TEXT");
  assert.equal(canPreparePublication(
    { status: "approved", content: "x".repeat(501) },
    { channel: "threads", url: "https://www.threads.net/", status: "active", rulesStatus: "not_required" }
  ).allowed, false);
});

test("dashboard metric inputs accept only finite nonnegative integers", () => {
  assert.equal(parseMetricInput("12", "Lượt xem"), 12);
  assert.throws(() => parseMetricInput("-1", "Lượt xem"), /số nguyên không âm/);
  assert.throws(() => parseMetricInput("1.5", "Lượt xem"), /số nguyên không âm/);
  assert.throws(() => parseMetricInput("Infinity", "Lượt xem"), /số nguyên không âm/);
});
