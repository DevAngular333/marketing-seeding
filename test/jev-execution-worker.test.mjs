import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { JevExecutionWorker } from "../src/jev-execution-worker.mjs";
import { LinkedInAdapter } from "../src/linkedin-adapter.mjs";
import { linkedInReadinessExpressions } from "../src/linkedin-readiness.mjs";

function executionFixture(overrides = {}) {
  const now = new Date().toISOString();
  const request = {
    schemaVersion: 1, executionId: "exec-1", jobId: "job-1", campaignId: "campaign-1",
    platform: "linkedin", accountId: "account-1", profileId: "profile-1",
    target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" }, audience: "public", testJob: true,
    content: { contentId: "content-1", sha256: "a".repeat(64), payload: "approved draft" }, media: [],
    authorization: { authorizationId: "auth-1", binding: "binding-1" }, idempotencyKey: "idem-1",
    readiness: { state: "READY", checkedAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString(), binding: "ready-binding" }, createdAt: now
  };
  const requestRow = { executionId: "exec-1", jobId: "job-1", attempt: 1, state: "REQUEST_READY", submitState: "NOT_STARTED", request };
  const context = {
    requestRow, request, post: { id: "job-1", status: "queued" }, target: { profileId: "profile-1" },
    account: { status: "enabled", health: "healthy", profileId: "profile-1", expectedIdentityUrl: "https://www.linkedin.com/in/owner" },
    authorization: { allowLiveExecution: false }
  };
  const calls = [];
  const service = {
    async executionContext() { return context; },
    async acquireExecutionLease(_id, _worker, options) { calls.push(["lease", options]); return { acquired: true, lease: { id: "lease-1", token: "secret-test-only" } }; },
    async releaseExecutionLease() { calls.push(["release"]); },
    async refreshCampaignJobReadiness() { calls.push(["readiness"]); return { status: "queued", readinessState: "READY" }; },
    async prepareExecutionRequest() { calls.push(["prepare"]); return requestRow; },
    async markExecutionStarted() { calls.push(["started"]); },
    async markExecutionReconciliationAttempt() { calls.push(["reconcile-attempt"]); },
    async readyExecutionRequests() { return [requestRow]; },
    async pendingExecutionReconciliations() { return []; },
    async beginExecutionSubmitIntent(_id, _lease, options) { calls.push(["intent", options]); return true; },
    async markExecutionSubmitSent() { calls.push(["sent"]); },
    async recordExecutionReceipt(_id, receipt) { calls.push(["receipt", receipt]); return receipt; },
    ...overrides.service
  };
  return { request, requestRow, context, service, calls };
}

test("JEV worker runs a dry-run to the pre-submit boundary and records a non-terminal receipt", async () => {
  const fixture = executionFixture();
  let submitCalls = 0;
  const adapter = {
    async execute(_request, options) {
      assert.equal(options.dryRun, true);
      assert.equal(options.liveEnabled, false);
      assert.equal(options.expectedIdentityUrl, fixture.context.account.expectedIdentityUrl);
      submitCalls += 0;
      return {
        submitState: "NOT_STARTED", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        durationMs: 10, browserCommands: 12, computerUseCalls: 0, retries: 0
      };
    }
  };
  const worker = new JevExecutionWorker({ service: fixture.service, adapters: { linkedin: adapter }, workerId: "worker-a", env: {} });
  const result = await worker.run("exec-1");
  assert.equal(result.status, "DRY_RUN_COMPLETE");
  assert.equal(result.receipt.dryRun, true);
  assert.equal(result.receipt.submitState, "NOT_STARTED");
  assert.equal(result.receipt.telemetry.browserCommands, 12);
  assert.equal(submitCalls, 0);
  assert.deepEqual(fixture.calls.map(([name]) => name), ["lease", "readiness", "prepare", "started", "receipt", "release"]);
});

test("JEV worker refuses live execution unless exact one-job opt-in is present", async () => {
  const fixture = executionFixture();
  let adapterCalls = 0;
  const worker = new JevExecutionWorker({
    service: fixture.service,
    adapters: { linkedin: { async execute() { adapterCalls += 1; } } },
    workerId: "worker-a", env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_LIVE_EXECUTION_ID: "other-exec" }
  });
  const result = await worker.run("exec-1", { dryRun: false });
  assert.equal(result.status, "LIVE_NOT_AUTHORIZED");
  assert.equal(adapterCalls, 0);
  assert.ok(fixture.calls.some(([name]) => name === "release"));
});

test("campaign-authorized autonomous live mode applies to non-test jobs only with explicit global opt-in", async () => {
  const fixture = executionFixture();
  fixture.request.testJob = false;
  fixture.context.authorization.allowLiveExecution = true;
  let clickCount = 0;
  const adapter = {
    async execute(_request, options) {
      assert.equal(options.dryRun, false);
      assert.equal(options.liveEnabled, true);
      await options.beforeSubmitIntent({
        authorizationValid: true, readinessFresh: true, accountMatch: true, profileMatch: true, targetMatch: true,
        contentHashMatch: true, mediaHashMatch: true, audienceMatch: true, composerConfirmed: true,
        mediaPreviewConfirmed: true, noDuplicateReceipt: true, noExistingConfirmedPublication: true
      });
      clickCount += 1;
      await options.onSubmitSent();
      return {
        submitState: "UNKNOWN", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN", durationMs: 1
      };
    }
  };
  const worker = new JevExecutionWorker({
    service: fixture.service, adapters: { linkedin: adapter },
    env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_AUTONOMOUS_LIVE_ENABLED: "true" }
  });
  const result = await worker.run("exec-1", { dryRun: false });
  assert.equal(result.status, "UNKNOWN");
  assert.equal(clickCount, 1);
  assert.ok(fixture.calls.some(([name]) => name === "intent"));
  assert.ok(fixture.calls.some(([name]) => name === "sent"));
});

test("worker lease collision stops before readiness or adapter calls", async () => {
  const fixture = executionFixture({ service: { async acquireExecutionLease() { return { acquired: false, reason: "execution_lease_held" }; } } });
  let adapterCalls = 0;
  const worker = new JevExecutionWorker({ service: fixture.service, adapters: { linkedin: { async execute() { adapterCalls += 1; } } } });
  const result = await worker.run("exec-1");
  assert.equal(result.status, "LEASE_BUSY");
  assert.equal(adapterCalls, 0);
  assert.equal(fixture.calls.some(([name]) => name === "readiness"), false);
});

test("uncertain submit is reconciled without invoking the publishing method again", async () => {
  const fixture = executionFixture();
  fixture.requestRow.state = "SUBMIT_RESULT_UNKNOWN";
  fixture.requestRow.submitState = "UNKNOWN";
  let executeCalls = 0;
  let reconcileCalls = 0;
  const adapter = {
    async execute() { executeCalls += 1; throw new Error("must not redispatch"); },
    async reconcile() {
      reconcileCalls += 1;
      return {
        submitState: "UNKNOWN", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        durationMs: 5, browserCommands: 2, computerUseCalls: 0, retries: 0,
        errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN"
      };
    }
  };
  const worker = new JevExecutionWorker({ service: fixture.service, adapters: { linkedin: adapter } });
  const result = await worker.reconcile("exec-1");
  assert.equal(result.status, "UNKNOWN");
  assert.equal(reconcileCalls, 1);
  assert.equal(executeCalls, 0);
  assert.deepEqual(fixture.calls.map(([name]) => name), ["lease", "reconcile-attempt", "release"]);
});

test("LinkedIn adapter dry-run fills and verifies a draft, then closes without clicking Post", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pr3-linkedin-dry-run-"));
  const mediaPath = path.join(directory, "approved.mp4");
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(16)]);
  await writeFile(mediaPath, bytes);
  const mediaHash = createHash("sha256").update(bytes).digest("hex");
  let phase = "feed";
  let postClickCount = 0;
  const calls = [];
  const request = {
    executionId: "exec-dry", jobId: "job-dry", campaignId: "campaign-dry", platform: "linkedin",
    accountId: "account-1", profileId: "profile-1", target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" },
    audience: "public", content: { contentId: "content-1", sha256: createHash("sha256").update("approved draft").digest("hex"), payload: "approved draft" },
    media: [{ artifactId: "artifact-1", reference: mediaPath, sha256: mediaHash, type: "video/mp4" }]
  };
  const browser = {
    async listTabs() { return [{ id: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab() { return { pageId: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate(_id, url) { calls.push(["navigate", url]); },
    async waitForUrl() {},
    async waitForFeed() {},
    async snapshot() {
      if (phase === "feed") return '- button "Start a post" [ref=trigger]';
      if (phase === "file") return '- input file [ref=file]';
      return '- textbox "Post editor" [ref=editor]\n- button "Add video" [ref=media]\n- button "Post" [ref=post]';
    },
    async evaluate(_id, expression) {
      if (expression.includes("const expectedPath")) return { linkedinDomain: true, loginRequired: false, securityChallenge: false, sessionAuthenticated: true, identityVerified: true, feedReachable: phase === "feed" };
      if (expression === linkedInReadinessExpressions().composer) return { linkedinDomain: true, route: true, dialogCount: phase === "feed" ? 0 : 1, editorCount: phase === "feed" ? 0 : 1, audience: true, postButton: true, mediaControl: true, advertisingControls: 0 };
      if (expression.includes("const expected = \"public\"")) return { dialogCount: 1, audienceMatch: true };
      if (expression.includes("contenteditable") && expression.includes("editorCount")) return { dialogCount: 1, editorCount: 1, text: "approved draft" };
      if (expression.includes("input[type=") && expression.includes("fileCount")) return { dialogCount: 1, fileCount: phase === "uploaded" ? 1 : 0, filename: phase === "uploaded" ? "approved.mp4" : "", videoCount: phase === "uploaded" ? 1 : 0, imageCount: 0, uploadError: false };
      if (expression.includes("const expected = new URL")) return { domain: true, targetMatched: true };
      return {};
    },
    async click(_id, ref) {
      calls.push(["click", ref]);
      if (ref === "trigger") phase = "composer";
      else if (ref === "media") phase = "file";
      else if (ref === "post") { postClickCount += 1; phase = "submitted"; }
    },
    async fill(_id, ref, value) { calls.push(["fill", ref, value]); },
    async upload(_id, ref, file) { calls.push(["upload", ref, file]); phase = "uploaded"; },
    async keypress(_id, key) { calls.push(["keypress", key]); phase = "feed"; }
  };
  try {
    const adapter = new LinkedInAdapter(browser);
    const result = await adapter.execute(request, { dryRun: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner" });
    assert.equal(result.submitState, "NOT_STARTED");
    assert.equal(result.gates.mediaPreviewConfirmed, true, JSON.stringify(result));
    assert.deepEqual(calls.filter(([name, ref]) => name === "click" && ref === "post"), []);
    assert.ok(calls.some(([name]) => name === "upload"));
    assert.equal(phase, "feed");
    assert.equal(result.computerUseCalls, 0);

    const postClicksBefore = calls.filter(([name, ref]) => name === "click" && ref === "post").length;
    const blockedLive = await adapter.execute(request, {
      dryRun: false, liveEnabled: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner",
      async beforeSubmitIntent() { throw new Error("durable write failed"); },
      async onSubmitSent() { throw new Error("must not be called"); }
    });
    assert.equal(blockedLive.submitState, "FAILED");
    assert.equal(calls.filter(([name, ref]) => name === "click" && ref === "post").length, postClicksBefore);
    assert.equal(phase, "feed");

    const liveAdapter = new LinkedInAdapter(browser, { verifier: { async verify() {
      return {
        state: "CONFIRMED", publicationUrl: "https://www.linkedin.com/feed/update/urn:li:activity:123/",
        publicationEvidence: { verifiedAt: new Date().toISOString() }
      };
    } } });
    let intentCalls = 0;
    let sentCalls = 0;
    const liveResult = await liveAdapter.execute(request, {
      dryRun: false, liveEnabled: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner",
      async beforeSubmitIntent() { intentCalls += 1; },
      async onSubmitSent() { sentCalls += 1; }
    });
    assert.equal(liveResult.submitState, "CONFIRMED");
    assert.equal(postClickCount, 1);
    assert.equal(intentCalls, 1);
    assert.equal(sentCalls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
