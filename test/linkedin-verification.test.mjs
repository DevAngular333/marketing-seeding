import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { LinkedInAdapter, LinkedInPublicationVerifier, LINKEDIN_VERIFICATION_EXPRESSION } from "../src/linkedin-adapter.mjs";
import { validateExecutionReceiptV1 } from "../src/execution-contracts.mjs";

const content = "Cedar Lantern 7Q4K distinctive validation post";
const submittedAt = "2026-10-14T13:00:00.000Z";
const expectedIdentityUrl = "https://www.linkedin.com/in/owner";
const media = [{ artifactId: "artifact-1", reference: "/tmp/validation.mp4", sha256: "a".repeat(64), type: "video/mp4" }];

function request({ withMedia = true } = {}) {
  return {
    executionId: "execution-1", jobId: "job-1", campaignId: "campaign-1", platform: "linkedin",
    accountId: "linkedin_primary", profileId: "profile-1",
    target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" }, audience: "public",
    content: { contentId: "content-1", payload: content, sha256: createHash("sha256").update(content).digest("hex") },
    media: withMedia ? media : []
  };
}

function candidate(overrides = {}) {
  return {
    found: true, contentMatched: true, authorMatched: true, authorPath: "/in/owner",
    activityUrn: "urn:li:activity:987654321", activityId: "987654321",
    publicationUrl: "https://www.linkedin.com/feed/update/urn:li:activity:987654321/",
    candidateTimestamp: "2026-10-14T13:02:00.000Z", mediaPresent: true, mediaType: "video", ...overrides
  };
}

function browserFor(surfaceResults = {}, { onWait, confirmationSignals = [] } = {}) {
  let url = "https://www.linkedin.com/feed/";
  const calls = [];
  const browser = {
    calls,
    async navigate(_page, nextUrl) { url = nextUrl; calls.push(["navigate", nextUrl]); },
    async waitForUrl(_page, nextUrl, timeout) { calls.push(["wait-url", nextUrl, timeout]); },
    async waitForExpression(_page, expression, timeout) { calls.push(["wait-expression", expression, timeout]); await onWait?.(url, calls); },
    async evaluate(_page, expression) {
      calls.push(["evaluate", url, expression]);
      if (expression.includes("role=\"alert\"")) return confirmationSignals;
      return typeof surfaceResults[url] === "function" ? surfaceResults[url](calls) : surfaceResults[url] || [];
    }
  };
  return browser;
}

test("immediate feed candidate confirms only with stable author, content, permalink and submit-time evidence", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ mediaPresent: false, mediaType: null })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request({ withMedia: false }), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "CONFIRMED");
  assert.equal(result.publicationEvidence.verificationDetails.candidate.postId, "987654321");
  assert.equal(result.publicationUrl, candidate().publicationUrl);
  assert.equal(result.publicationEvidence.verificationDetails.candidate.timestampMatched, true);
  assert.equal(browser.calls[0][0], "evaluate", "inspect the immediate post-submit surface before navigating away");
});

test("bounded semantic polling observes a candidate that appears after the first feed read", async () => {
  let available = false;
  const browser = browserFor({ "https://www.linkedin.com/feed/": () => available ? [candidate({ mediaPresent: false, mediaType: null })] : [] }, { onWait: async () => { available = true; } });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request({ withMedia: false }), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "CONFIRMED");
  assert.ok(browser.calls.some(([type]) => type === "wait-expression"));
});

test("candidate on Recent Activity is found when the feed has no result", async () => {
  const recentUrl = "https://www.linkedin.com/in/owner/recent-activity/all/";
  const browser = browserFor({ [recentUrl]: [candidate({ mediaPresent: false, mediaType: null })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request({ withMedia: false }), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "CONFIRMED");
  assert.equal(result.publicationEvidence.verificationDetails.candidate.surface, "recent_activity");
  assert.ok(browser.calls.some(([type, url]) => type === "navigate" && url === recentUrl));
});

test("correct content from the wrong author is rejected", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ authorMatched: false, authorPath: "/in/other" })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request({ withMedia: false }), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.publicationEvidence.accountMatched, false);
});

test("correct author without exact content is rejected", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ contentMatched: false })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.reasonCode, "publication_candidate_evidence_incomplete");
});

test("older matching post is rejected by submit-time proximity", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ candidateTimestamp: "2026-10-13T13:02:00.000Z" })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request({ withMedia: false }), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.publicationEvidence.verificationDetails.candidate.timestampMatched, false);
});

test("DOM video presence records NOT_VERIFIABLE and never claims the artifact hash matched", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate()] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN", "canonical receipts currently require positive media identity evidence");
  assert.equal(result.reasonCode, "publication_media_identity_not_verifiable");
  assert.equal(result.publicationEvidence.mediaHashMatched, false);
  assert.equal(result.publicationEvidence.mediaHash, null);
  assert.deepEqual(result.publicationEvidence.verificationDetails.media, { present: true, type: "video", hashStatus: "NOT_VERIFIABLE" });
});

test("receipt contract preserves read-only UNKNOWN candidate evidence", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate()] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  const receipt = validateExecutionReceiptV1({
    schemaVersion: 1, executionId: "execution-1", jobId: "job-1", attempt: 1,
    startedAt: submittedAt, finishedAt: new Date(Math.max(Date.now(), Date.parse(submittedAt) + 1_000)).toISOString(),
    readinessResult: { state: "READY", checkedAt: submittedAt }, submitState: "UNKNOWN", dryRun: false,
    publicationUrl: result.publicationUrl, publicationReference: result.publicationReference,
    publicationEvidence: result.publicationEvidence, telemetry: {}
  });
  assert.equal(receipt.publicationEvidence.verificationDetails.executionId, "execution-1");
  assert.equal(receipt.publicationEvidence.verificationDetails.media.hashStatus, "NOT_VERIFIABLE");
  assert.equal(receipt.publicationEvidence.mediaHashMatched, false);
});

test("observed media type mismatch is recorded as MISMATCHED", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ mediaType: "image" })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.reasonCode, "publication_media_type_mismatch");
  assert.equal(result.publicationEvidence.verificationDetails.media.hashStatus, "MISMATCHED");
});

test("composer close without post evidence does not imply success and verifier never clicks Post", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [] }, { confirmationSignals: ["Your post was shared"] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.deepEqual(result.publicationEvidence.verificationDetails.confirmationSignals, ["Your post was shared"]);
  assert.equal(browser.calls.some(([type]) => type === "click"), false);
});

test("immediate UNKNOWN keeps collected evidence in its receipt result and does not retry the single Post click", async () => {
  let postClicks = 0;
  const browser = {
    async snapshot() { return '- button "Post" [ref=post]'; },
    async click(_page, ref) { assert.equal(ref, "post"); postClicks += 1; },
    browserCommandCount() { return postClicks; }
  };
  const adapter = new LinkedInAdapter(browser, { verifier: {} });
  adapter.prepareExecution = async (requestValue) => ({ request: requestValue, pageId: "page-1", expectedIdentityUrl });
  adapter.navigate = async (context) => context;
  adapter.verifyTarget = async (context) => ({ ...context, targetVerified: true });
  adapter.openComposer = async (context) => context;
  adapter.fillContent = async (context) => context;
  adapter.attachMedia = async (context) => ({ ...context, media: { mediaHashMatched: true, mediaPreviewConfirmed: true, audienceMatch: true } });
  adapter.verifyPreSubmit = async (context) => ({ ...context, gates: { passed: true } });
  adapter.verifyPublished = async () => ({
    state: "UNKNOWN", submitState: "UNKNOWN", publicationReference: "urn:li:activity:987654321",
    publicationEvidence: { marker: "read-only-candidate" }, verificationEvidence: { marker: "read-only-candidate" }, reasonCode: "publication_media_identity_not_verifiable"
  });
  const result = await adapter.execute(request(), {
    dryRun: false, liveEnabled: true,
    async beforeSubmitIntent() {}, async onSubmitSent() {}
  });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.reasonCode, "publication_media_identity_not_verifiable");
  assert.equal(result.publicationEvidence.marker, "read-only-candidate");
  assert.equal(postClicks, 1);
});

test("verification expression extracts activity URN, stable ID, permalink, author, time and media type", () => {
  const expression = LINKEDIN_VERIFICATION_EXPRESSION(content, expectedIdentityUrl);
  for (const signal of ["data-urn", "activityId", "feed\\/update", "authorPath", "datetime", "querySelector('video')", "mediaType"]) assert.ok(expression.includes(signal), signal);
});

test("reconciliation delegates to the same verifier with the original submit timestamp and cannot click Post", async () => {
  const calls = [];
  const browser = {
    async listTabs() { return [{ id: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab() { return { pageId: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate() {}, async waitForFeed() {},
    async evaluate(_page, expression) {
      if (expression.includes("const expected = new URL")) return { domain: true, targetMatched: true };
      if (expression.includes("expectedPath")) return { sessionAuthenticated: true, identityVerified: true, loginRequired: false, securityChallenge: false };
      return {};
    },
    async click() { assert.fail("reconciliation must be read-only"); }
  };
  const verifier = { async verify(...args) { calls.push(args); return { state: "UNKNOWN", reasonCode: "publication_not_observed" }; } };
  const adapter = new LinkedInAdapter(browser, { verifier });
  const result = await adapter.reconcile(request(), { account: { identityReference: expectedIdentityUrl }, submittedAt });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].submittedAt, submittedAt);
  assert.equal(calls[0][2].executionId, "execution-1");
});
