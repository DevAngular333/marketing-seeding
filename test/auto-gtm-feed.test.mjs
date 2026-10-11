import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readAutoGtmFeed } from "../src/auto-gtm-feed.mjs";

test("missing feed returns an explicit unavailable state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtm-feed-"));
  try {
    const result = await readAutoGtmFeed(path.join(directory, "missing.json"));
    assert.equal(result.status, "unavailable");
    assert.equal(result.reason, "feed_not_generated");
    assert.equal(result.leadCount, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("feed allowlists exported fields and public evidence only", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtm-feed-"));
  const file = path.join(directory, "feed.json");
  try {
    await writeFile(file, JSON.stringify({
      schemaVersion: 1, status: "ready", generatedAt: new Date().toISOString(),
      campaignId: "campaign_r19_gt_course_validation", portfolioProduct: "course.example",
      secrets: "must not escape", leads: [{ leadId: "lead-1", personId: "private-id",
        segment: "educators", fit: 0.8, email: "private@example.com", evidence: [
          { signalId: "s1", source: "github", kind: "issue_pain", occurredAt: "2026-10-10T12:00:00Z",
            url: "https://github.com/org/repo/issues/1", snippet: "Public need", token: "secret" },
          { signalId: "s2", url: "https://example.com/private", snippet: "private" },
        ] }],
    }), "utf8");
    const result = await readAutoGtmFeed(file);
    assert.equal(result.status, "ready");
    assert.equal(result.leadCount, 1);
    assert.equal(result.signalCount, 1);
    assert.equal(result.leads[0].evidence[0].url, "https://github.com/org/repo/issues/1");
    assert.equal("personId" in result.leads[0], false);
    assert.equal("email" in result.leads[0], false);
    assert.equal("secrets" in result, false);
    assert.equal("token" in result.leads[0].evidence[0], false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid JSON fails closed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtm-feed-"));
  const file = path.join(directory, "feed.json");
  try {
    await writeFile(file, "{", "utf8");
    const result = await readAutoGtmFeed(file);
    assert.equal(result.status, "invalid");
    assert.equal(result.reason, "invalid_json");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
