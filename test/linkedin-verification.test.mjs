import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { LinkedInAdapter, LinkedInPublicationVerifier, LINKEDIN_VERIFICATION_EXPRESSION } from "../src/linkedin-adapter.mjs";
import { validateExecutionReceiptV1 } from "../src/execution-contracts.mjs";

const content = "Cedar Lantern 7Q4K distinctive validation post";
const submittedAt = "2026-10-14T13:00:00.000Z";
const expectedIdentityUrl = "https://www.linkedin.com/in/owner";
const media = [{ artifactId: "artifact-1", reference: "/tmp/validation.mp4", sha256: "a".repeat(64), type: "video/mp4" }];
const preSubmitMediaIntegrity = {
  artifactId: media[0].artifactId, expectedSha256: media[0].sha256, localFileSha256: media[0].sha256,
  mediaType: media[0].type, attached: true, previewReady: true
};

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

async function runPostClickAdapter({ ui, candidates = [], verification = { state: "UNKNOWN", reasonCode: "publication_not_observed" }, onWait } = {}) {
  const calls = [];
  let postClicks = 0;
  let clickEmittedAt = null;
  const browser = {
    calls,
    async snapshot() { return '- button "Post" [ref=post]'; },
    async click(_page, ref) { assert.equal(ref, "post"); postClicks += 1; clickEmittedAt = new Date().toISOString(); calls.push("click"); return { ok: true }; },
    async evaluate(_page, expression) {
      calls.push(expression.includes("const postButtons") ? "ui" : "candidate");
      if (expression.includes("const postButtons")) return ui || { url: "https://www.linkedin.com/feed/", composerState: "OPEN", postButtonState: "ENABLED", confirmationState: "NONE", successMessages: [], errorMessages: [] };
      return typeof candidates === "function" ? candidates(clickEmittedAt) : candidates;
    },
    async waitForExpression(_page, _expression, timeoutMs) { calls.push(["wait", timeoutMs]); await onWait?.(); }
  };
  const adapter = new LinkedInAdapter(browser, { verifier: {}, postClickEvidenceTimeoutMs: 100 });
  adapter.prepareExecution = async (requestValue) => ({ request: requestValue, pageId: "page-1", expectedIdentityUrl });
  adapter.navigate = async (context) => context;
  adapter.verifyTarget = async (context) => ({ ...context, targetVerified: true });
  adapter.openComposer = async (context) => context;
  adapter.fillContent = async (context) => context;
  adapter.attachMedia = async (context) => ({ ...context, media: { mediaHashMatched: true, mediaPreviewConfirmed: true, audienceMatch: true } });
  adapter.verifyPreSubmit = async (context) => ({ ...context, gates: { passed: true } });
  adapter.verifyPublished = async (context) => typeof verification === "function" ? verification(context) : verification;
  const result = await adapter.execute(request(), {
    dryRun: false, liveEnabled: true,
    async beforeSubmitIntent() { calls.push("intent"); },
    async onSubmitSent(evidence) { calls.push(["sent", evidence]); }
  });
  return { result, calls, postClicks };
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

test("video presence without proven pre-submit integrity remains UNKNOWN", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate()] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.reasonCode, "pre_submit_media_integrity_missing");
  assert.equal(result.publicationEvidence.mediaHashMatched, false);
  assert.equal(result.publicationEvidence.mediaHash, null);
  assert.deepEqual(result.publicationEvidence.verificationDetails.media, { present: true, type: "video", hashStatus: "NOT_VERIFIABLE" });
});

test("LinkedIn video with strong publication identity and exact pre-submit artifact integrity confirms without claiming post-submit hash", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate()] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt, preSubmitMediaIntegrity });
  assert.equal(result.state, "CONFIRMED");
  assert.equal(result.publicationEvidence.mediaHashMatched, false);
  assert.equal(result.publicationEvidence.mediaHash, null);
  assert.deepEqual(result.publicationEvidence.preSubmitMediaIntegrity, preSubmitMediaIntegrity);
  assert.equal(result.publicationEvidence.verificationDetails.media.hashStatus, "NOT_VERIFIABLE");
  assert.equal(result.publicationEvidence.verificationDetails.candidate.postId, "987654321");
  assert.equal(result.publicationEvidence.verificationDetails.candidate.permalink, result.publicationUrl);
  const receipt = validateExecutionReceiptV1({
    schemaVersion: 1, executionId: "execution-1", jobId: "job-1", attempt: 1,
    startedAt: submittedAt, finishedAt: result.verifiedAt,
    readinessResult: { state: "READY", checkedAt: submittedAt }, submitState: "CONFIRMED", dryRun: false,
    publicationUrl: result.publicationUrl, publicationReference: result.publicationReference,
    publicationEvidence: result.publicationEvidence, telemetry: {}
  });
  assert.equal(receipt.publicationEvidence.mediaHashMatched, false);
});

test("content and author without stable post ID and permalink cannot confirm", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate({ activityId: null, activityUrn: null, publicationUrl: null })] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", { expectedIdentityUrl, submittedAt, preSubmitMediaIntegrity });
  assert.equal(result.state, "UNKNOWN");
});

test("wrong pre-submit artifact digest cannot authorize NOT_VERIFIABLE LinkedIn media", async () => {
  const browser = browserFor({ "https://www.linkedin.com/feed/": [candidate()] });
  const result = await new LinkedInPublicationVerifier(browser, { timeoutMs: 30 }).verify(request(), "page-1", {
    expectedIdentityUrl, submittedAt, preSubmitMediaIntegrity: { ...preSubmitMediaIntegrity, localFileSha256: "0".repeat(64) }
  });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.publicationEvidence.mediaHashMatched, false);
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

test("ORCA click success is recorded as CLICK_EMITTED, not platform acceptance, with intent persisted first", async () => {
  const { result, calls, postClicks } = await runPostClickAdapter();
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.reasonCode, "publication_not_observed");
  assert.equal(result.submitAcceptanceEvidence.clickStatus, "CLICK_EMITTED");
  assert.equal(result.submitAcceptanceEvidence.platformAcceptance, "UNKNOWN");
  assert.equal(calls[0], "intent");
  assert.equal(calls[1], "click");
  assert.equal(calls[2][0], "sent");
  assert.equal(calls[2][1].clickStatus, "CLICK_EMITTED");
  assert.equal(calls.filter((call) => call === "click").length, 1);
  assert.equal(postClicks, 1);
});

test("success confirmation records platform acceptance without claiming publication verification", async () => {
  const { result, postClicks } = await runPostClickAdapter({ ui: {
    url: "https://www.linkedin.com/feed/", composerState: "CLOSED", postButtonState: "DISAPPEARED",
    confirmationState: "SUCCESS", successMessages: ["Your post was shared"], errorMessages: []
  } });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.submitAcceptanceEvidence.platformAcceptance, "ACCEPTED");
  assert.equal(result.submitAcceptanceEvidence.acceptanceSource, "SUCCESS_CONFIRMATION");
  assert.equal(result.submitAcceptanceEvidence.confirmationText, "Your post was shared");
  assert.equal(postClicks, 1);
});

test("stable activity identity and permalink record strong acceptance evidence", async () => {
  const permalink = "https://www.linkedin.com/feed/update/urn:li:activity:987654321/";
  const result = await runPostClickAdapter({
    candidates: (clickAt) => [candidate({ candidateTimestamp: new Date(Date.parse(clickAt) + 1).toISOString() })],
    verification: (context) => {
      const observedAt = new Date(Date.parse(context.clickEmittedAt) + 2_000).toISOString();
      return { state: "CONFIRMED", publicationUrl: permalink, publicationEvidence: {
        verifiedAt: observedAt, accountMatched: true, targetMatched: true, contentHashMatched: true,
        mediaHashMatched: false, accountId: "linkedin_primary", profileId: "profile-1", targetId: "target-1",
        contentHash: request().content.sha256, mediaHash: null, verificationMethod: "test", evidenceReference: permalink,
        preSubmitMediaIntegrity, verificationDetails: { executionId: "execution-1", submittedAt: context.clickEmittedAt, observedAt,
          candidate: { postId: "987654321", activityUrn: "urn:li:activity:987654321", permalink, timestamp: new Date(Date.parse(context.clickEmittedAt) + 1).toISOString(), timestampMatched: true, surface: "feed" },
          authorIdentity: { matched: true }, contentMatch: { matched: true }, media: { present: true, type: "video", hashStatus: "NOT_VERIFIABLE" } }
      } };
    }
  });
  assert.equal(result.result.submitState, "CONFIRMED");
  assert.equal(result.result.submitAcceptanceEvidence.platformAcceptance, "ACCEPTED");
  assert.equal(result.result.submitAcceptanceEvidence.acceptanceSource, "STABLE_PUBLICATION_IDENTITY");
  assert.equal(result.result.submitAcceptanceEvidence.candidate.postId, "987654321");
  assert.equal(result.result.submitAcceptanceEvidence.candidate.permalink, permalink);
  assert.equal(result.postClicks, 1);
});

test("composer closure alone does not verify publication", async () => {
  const { result, postClicks } = await runPostClickAdapter({ ui: {
    url: "https://www.linkedin.com/feed/", composerState: "CLOSED", postButtonState: "DISAPPEARED",
    confirmationState: "NONE", successMessages: [], errorMessages: []
  } });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.submitAcceptanceEvidence.platformAcceptance, "UNKNOWN");
  assert.equal(postClicks, 1);
});

test("visible post-click media error is preserved as rejection evidence without retry", async () => {
  const { result, postClicks } = await runPostClickAdapter({ ui: {
    url: "https://www.linkedin.com/feed/", composerState: "OPEN", postButtonState: "ENABLED",
    confirmationState: "ERROR", successMessages: [], errorMessages: ["Unable to publish this video because media processing failed"]
  } });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.reasonCode, "linkedin_media_processing_error");
  assert.equal(result.submitAcceptanceEvidence.platformAcceptance, "REJECTED");
  assert.equal(result.submitAcceptanceEvidence.errorText, "Unable to publish this video because media processing failed");
  const receipt = validateExecutionReceiptV1({
    schemaVersion: 1, executionId: "execution-1", jobId: "job-1", attempt: 1,
    startedAt: result.startedAt, finishedAt: result.finishedAt,
    readinessResult: { state: "READY", checkedAt: submittedAt }, submitState: "UNKNOWN", dryRun: false,
    reasonCode: result.reasonCode, errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN",
    submitAcceptanceEvidence: result.submitAcceptanceEvidence, telemetry: {}
  });
  assert.equal(receipt.reasonCode, "linkedin_media_processing_error");
  assert.equal(receipt.submitAcceptanceEvidence.errorText, "Unable to publish this video because media processing failed");
  assert.equal(postClicks, 1);
});

test("acceptance wait timeout is quarantined and never emits another click", async () => {
  const { result, postClicks, calls } = await runPostClickAdapter({ onWait: async () => { throw new Error("semantic wait deadline"); } });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(result.submitAcceptanceEvidence.platformAcceptance, "UNKNOWN");
  assert.equal(calls.filter((call) => call === "click").length, 1);
  assert.equal(postClicks, 1);
});

test("LinkedIn adapter preserves a pre-submit reason and failed gate without clicking Post", async () => {
  let postClicks = 0;
  const browser = {
    async snapshot() { return '- button "Post" [ref=post]'; },
    async click() { postClicks += 1; },
    browserCommandCount() { return postClicks; }
  };
  const adapter = new LinkedInAdapter(browser, { verifier: {} });
  adapter.prepareExecution = async (requestValue) => ({ request: requestValue, pageId: "page-1", expectedIdentityUrl });
  adapter.navigate = async (context) => context;
  adapter.verifyTarget = async (context) => ({ ...context, targetVerified: true });
  adapter.openComposer = async (context) => context;
  adapter.fillContent = async (context) => context;
  adapter.attachMedia = async (context) => ({ ...context, media: { mediaHashMatched: true, mediaPreviewConfirmed: true, audienceMatch: true } });
  adapter.verifyPreSubmit = async (context) => ({ ...context, gates: { readinessFresh: true, mediaPreviewConfirmed: true } });
  const failure = Object.assign(new Error("readiness expired"), {
    code: "READINESS_EXPIRED",
    preSubmitFailure: { reasonCode: "READINESS_EXPIRED", stage: "submit_boundary", gate: "readinessFresh", gateStatus: false },
    verificationGates: { readinessFresh: false, mediaPreviewConfirmed: true }
  });
  const result = await adapter.execute(request(), {
    dryRun: false, liveEnabled: true,
    async beforeSubmitIntent() { throw failure; }, async onSubmitSent() {}
  });
  assert.equal(result.submitState, "FAILED");
  assert.equal(result.reasonCode, "readiness_expired");
  assert.deepEqual(result.preSubmitFailure, failure.preSubmitFailure);
  assert.deepEqual(result.gates, failure.verificationGates);
  assert.equal(postClicks, 0);
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
  const result = await adapter.reconcile(request(), { account: { identityReference: expectedIdentityUrl }, submittedAt, preSubmitMediaIntegrity });
  assert.equal(result.submitState, "UNKNOWN");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].submittedAt, submittedAt);
  assert.equal(calls[0][2].executionId, "execution-1");
  assert.deepEqual(calls[0][2].preSubmitMediaIntegrity, preSubmitMediaIntegrity);
});
