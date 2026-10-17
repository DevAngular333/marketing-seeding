import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicationVisibility, publicationVisibilityMatchesLabels } from "../src/publication-visibility.mjs";
import { validateExecutionRequestV1, contentSha256 } from "../src/execution-contracts.mjs";

test("content audience segments stay independent from LinkedIn public visibility", () => {
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", ["Mọi người"]), true);
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", ["Mọi người", "builders"]), true);
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", ["Mọi người", "designers"]), true);
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", ["builders"]), false);
});

test("unsupported and ambiguous visibility fail closed", () => {
  assert.throws(() => normalizePublicationVisibility("FOLLOWERS"), /Unsupported publication visibility/);
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", []), false);
  assert.equal(publicationVisibilityMatchesLabels("PUBLIC", ["Connections"]), false);
});

test("execution request carries explicit normalized visibility", () => {
  const payload = "verified product evidence";
  const request = validateExecutionRequestV1({
    schemaVersion: 1, executionId: "e", jobId: "j", campaignId: "c", platform: "linkedin", accountId: "a", profileId: "p",
    target: { targetId: "t", url: "https://www.linkedin.com/feed/" }, audience: "builders", publicationVisibility: "PUBLIC",
    dryRun: true, content: { contentId: "cv", sha256: contentSha256(payload), payload }, media: [],
    authorization: { authorizationId: "auth", binding: "binding" }, idempotencyKey: "id",
    readiness: { state: "READY", checkedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-01T00:05:00.000Z", binding: "rb" }, createdAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(request.audience, "builders");
  assert.equal(request.publicationVisibility, "PUBLIC");
});
