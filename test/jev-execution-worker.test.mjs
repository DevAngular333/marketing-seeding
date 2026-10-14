import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { JevExecutionWorker } from "../src/jev-execution-worker.mjs";
import { LinkedInAdapter } from "../src/linkedin-adapter.mjs";
import { linkedInReadinessExpressions } from "../src/linkedin-readiness.mjs";
import { PLATFORM_CAPABILITIES, PlatformAdapterRegistry } from "../src/platform-registries.mjs";

function adapterRegistry(entries) {
  const registry = new PlatformAdapterRegistry();
  for (const [platform, adapter] of Object.entries(entries)) {
    registry.register(platform, {
      contractVersion: 1,
      capabilities: Object.fromEntries(PLATFORM_CAPABILITIES.map((capability) => [capability, false])),
      async execute() { throw new Error("Test adapter execute() was not configured"); },
      async reconcile() { return { submitState: "UNKNOWN", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }; },
      ...adapter
    });
  }
  return registry;
}

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
    account: { status: "enabled", health: "healthy", accountId: "account-1", profileId: "profile-1", expectedIdentityUrl: "https://www.linkedin.com/in/owner" },
    authorization: { allowLiveExecution: false }, state: { executionReceipts: [] }
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

function attachFixtureGrant(fixture) {
  const request = fixture.request;
  request.liveGrant = { grantId: "grant-1" };
  fixture.context.authorization.id = request.authorization.authorizationId;
  fixture.context.authorization.binding = request.authorization.binding;
  fixture.context.liveGrant = {
    schemaVersion: 1, grantId: "grant-1", campaignAuthorizationId: request.authorization.authorizationId,
    campaignAuthorizationBinding: request.authorization.binding, campaignId: request.campaignId,
    jobId: request.jobId, boundExecutionId: request.executionId, platform: request.platform,
    accountId: request.accountId, profileId: request.profileId, targetId: request.target.targetId,
    content: { contentId: request.content.contentId, canonicalSha256: "b".repeat(64), rawSha256: request.content.sha256 },
    media: [], audience: request.audience, idempotencyKey: request.idempotencyKey,
    validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(),
    maxExecutions: 1, createdAt: new Date().toISOString(), createdBy: "operator", operatorAuthorizationReference: "fixture-approval", status: "ACTIVE"
  };
}

test("JEV worker runs a dry-run to the pre-submit boundary and records a non-terminal receipt", async () => {
  const fixture = executionFixture();
  let submitCalls = 0;
  const adapter = {
    async execute(_request, options) {
      assert.equal(options.dryRun, true);
      assert.equal(options.liveEnabled, false);
      assert.equal(options.account.expectedIdentityUrl, fixture.context.account.expectedIdentityUrl);
      submitCalls += 0;
      return {
        submitState: "NOT_STARTED", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        errorClassification: "NONE", gates: { passed: true },
        durationMs: 10, browserCommands: 12, computerUseCalls: 0, retries: 0
      };
    }
  };
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: adapter }), workerId: "worker-a", env: {} });
  const result = await worker.run("exec-1");
  assert.equal(result.status, "DRY_RUN_COMPLETE");
  assert.equal(result.receipt.dryRun, true);
  assert.equal(result.receipt.submitState, "NOT_STARTED");
  assert.equal(result.receipt.telemetry.browserCommands, 12);
  assert.equal(submitCalls, 0);
  assert.deepEqual(fixture.calls.map(([name]) => name), ["lease", "readiness", "prepare", "started", "receipt", "release"]);
});

test("JEV worker reports a failed no-submit dry-run truthfully", async () => {
  const fixture = executionFixture();
  const adapter = {
    async execute() {
      return {
        submitState: "NOT_STARTED", errorClassification: "TIMEOUT", recoveryClassification: "RECOVERABLE",
        reasonCode: "page_load_timeout", gates: { passed: false },
        startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 1
      };
    }
  };
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: adapter }), workerId: "worker-timeout", env: {} });
  const result = await worker.run("exec-1", { dryRun: true });
  assert.equal(result.status, "DRY_RUN_FAILED");
  assert.equal(result.receipt.submitState, "NOT_STARTED");
  assert.equal(result.receipt.errorClassification, "TIMEOUT");
  assert.equal(result.receipt.verificationGates.passed, false);
});

test("worker receipt retains a bounded LinkedIn upload subreason and evidence", async () => {
  const fixture = executionFixture();
  const uploadFailure = {
    subreason: "FILE_INPUT_NOT_MOUNTED", dialogCount: 2, fileInputCount: 0,
    selectedSurface: "media_editor_dialog", waitDurationMs: 8000,
    attachAttempted: false, previewObserved: false
  };
  const adapter = { async execute() {
    return { submitState: "NOT_STARTED", errorClassification: "UPLOAD_ERROR", reasonCode: "upload_error", recoveryClassification: "RECOVERABLE",
      uploadFailure, gates: { passed: false }, startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(), durationMs: 8, browserCommands: 4, computerUseCalls: 0 };
  } };
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: adapter }), workerId: "worker-upload", env: {} });
  const result = await worker.run("exec-1", { dryRun: true });
  assert.equal(result.status, "DRY_RUN_FAILED");
  assert.deepEqual(result.receipt.uploadFailure, uploadFailure);
  assert.equal(fixture.calls.find(([name]) => name === "receipt")[1].uploadFailure.subreason, "FILE_INPUT_NOT_MOUNTED");
  assert.equal(result.receipt.submitState, "NOT_STARTED");
});

test("JEV worker refuses live execution unless exact one-job opt-in is present", async () => {
  const fixture = executionFixture();
  let adapterCalls = 0;
  const worker = new JevExecutionWorker({
    service: fixture.service,
    adapterRegistry: adapterRegistry({ linkedin: { async execute() { adapterCalls += 1; } } }),
    workerId: "worker-a", env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_LIVE_EXECUTION_ID: "other-exec" }
  });
  const result = await worker.run("exec-1", { dryRun: false });
  assert.equal(result.status, "LIVE_NOT_AUTHORIZED");
  assert.equal(adapterCalls, 0);
  assert.ok(fixture.calls.some(([name]) => name === "release"));
});

test("campaign live authorization and global worker opt-in cannot run an adapter without a job grant", async () => {
  const fixture = executionFixture();
  fixture.context.authorization.allowLiveExecution = true;
  let adapterCalls = 0;
  const worker = new JevExecutionWorker({ service: fixture.service,
    adapterRegistry: adapterRegistry({ linkedin: { async execute() { adapterCalls += 1; } } }),
    env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_AUTONOMOUS_LIVE_ENABLED: "true" } });
  const result = await worker.run("exec-1", { dryRun: false });
  assert.equal(result.status, "LIVE_NOT_AUTHORIZED");
  assert.equal(adapterCalls, 0);
  assert.equal(fixture.calls.some(([name]) => name === "intent"), false);
});

test("campaign-authorized autonomous live mode also requires a bound one-job grant", async () => {
  const fixture = executionFixture();
  fixture.request.testJob = false;
  fixture.context.authorization.allowLiveExecution = true;
  attachFixtureGrant(fixture);
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
    service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: adapter }),
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
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: { async execute() { adapterCalls += 1; } } }) });
  const result = await worker.run("exec-1");
  assert.equal(result.status, "LEASE_BUSY");
  assert.equal(adapterCalls, 0);
  assert.equal(fixture.calls.some(([name]) => name === "readiness"), false);
});

test("uncertain submit is reconciled without invoking the publishing method again", async () => {
  const fixture = executionFixture();
  fixture.requestRow.state = "SUBMIT_RESULT_UNKNOWN";
  fixture.requestRow.submitState = "UNKNOWN";
  const preSubmitMediaIntegrity = { artifactId: "artifact-1", expectedSha256: "a".repeat(64), localFileSha256: "a".repeat(64), mediaType: "video/mp4", attached: true, previewReady: true };
  fixture.context.state.executionReceipts.push({
    executionId: "exec-1", attempt: 1, receivedAt: new Date().toISOString(),
    receipt: { publicationEvidence: { preSubmitMediaIntegrity } }
  });
  let executeCalls = 0;
  let reconcileCalls = 0;
  const adapter = {
    async execute() { executeCalls += 1; throw new Error("must not redispatch"); },
    async reconcile(_request, options) {
      reconcileCalls += 1;
      assert.deepEqual(options.preSubmitMediaIntegrity, preSubmitMediaIntegrity);
      return {
        submitState: "UNKNOWN", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
        durationMs: 5, browserCommands: 2, computerUseCalls: 0, retries: 0,
        errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN"
      };
    }
  };
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: adapterRegistry({ linkedin: adapter }) });
  const result = await worker.reconcile("exec-1");
  assert.equal(result.status, "UNKNOWN");
  assert.equal(reconcileCalls, 1);
  assert.equal(executeCalls, 0);
  assert.deepEqual(fixture.calls.map(([name]) => name), ["lease", "reconcile-attempt", "release"]);
});

test("worker executes a non-LinkedIn adapter without reading LinkedIn identity fields and never redispatches after submit", async () => {
  const fixture = executionFixture();
  fixture.request.platform = "test_social";
  fixture.request.target.url = "https://social.example/feed";
  Object.defineProperty(fixture.context.account, "expectedIdentityUrl", { get() { throw new Error("worker must not inspect platform-specific identity fields"); } });
  fixture.context.authorization.allowLiveExecution = true;
  attachFixtureGrant(fixture);
  let executeCalls = 0;
  const adapter = {
    async execute(_request, context) {
      executeCalls += 1;
      assert.equal(context.account, fixture.context.account);
      assert.equal(context.liveEnabled, true);
      await context.beforeSubmitIntent({ all: true });
      await context.onSubmitSent();
      return { submitState: "SUBMIT_SENT", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 1 };
    }
  };
  const originalMarkSent = fixture.service.markExecutionSubmitSent;
  fixture.service.markExecutionSubmitSent = async (...args) => {
    await originalMarkSent(...args);
    fixture.requestRow.state = "SUBMIT_SENT";
    fixture.requestRow.submitState = "SUBMIT_SENT";
  };
  const worker = new JevExecutionWorker({
    service: fixture.service, adapterRegistry: adapterRegistry({ test_social: adapter }),
    env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_LIVE_EXECUTION_ID: "exec-1" }
  });
  const first = await worker.run("exec-1", { dryRun: false });
  const second = await worker.run("exec-1", { dryRun: false });
  assert.equal(first.status, "SUBMIT_SENT");
  assert.equal(second.status, "NOT_DISPATCHABLE");
  assert.equal(executeCalls, 1);
  assert.equal(fixture.calls.filter(([name]) => name === "lease").length, 1);
  assert.equal(fixture.calls.filter(([name]) => name === "release").length, 1);
  assert.equal(fixture.calls.filter(([name]) => name === "intent").length, 1);
  assert.equal(fixture.calls.filter(([name]) => name === "sent").length, 1);
});

test("worker returns an explicit unsupported-platform result without acquiring a lease", async () => {
  const fixture = executionFixture();
  fixture.request.platform = "test_social";
  const worker = new JevExecutionWorker({ service: fixture.service, adapterRegistry: new PlatformAdapterRegistry() });
  const result = await worker.run("exec-1");
  assert.equal(result.status, "PLATFORM_UNSUPPORTED");
  assert.equal(result.reasonCode, "adapter_not_registered");
  assert.equal(fixture.calls.some(([name]) => name === "lease"), false);
});

test("generic reconciliation invokes a non-LinkedIn verifier and records confirmation without submit", async () => {
  const fixture = executionFixture();
  fixture.request.platform = "test_social";
  fixture.request.target.url = "https://social.example/feed";
  fixture.requestRow.state = "SUBMIT_RESULT_UNKNOWN";
  fixture.requestRow.submitState = "UNKNOWN";
  fixture.service.pendingExecutionReconciliations = async () => [fixture.requestRow];
  let executeCalls = 0;
  let verifyCalls = 0;
  const worker = new JevExecutionWorker({
    service: fixture.service,
    adapterRegistry: adapterRegistry({ test_social: {
      async execute() { executeCalls += 1; throw new Error("reconciliation must not resubmit"); },
      async reconcile() {
        verifyCalls += 1;
        if (verifyCalls === 1) return {
          startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
          publicationVerification: { state: "UNKNOWN", reasonCode: "not_visible_yet" }
        };
        const verifiedAt = new Date().toISOString();
        return {
          startedAt: verifiedAt, finishedAt: verifiedAt,
          publicationVerification: {
            state: "CONFIRMED", publicationUrl: "https://social.example/posts/1", verifiedAt,
            verificationEvidence: {
              verifiedAt, accountMatched: true, targetMatched: true, contentHashMatched: true, mediaHashMatched: true,
              accountId: "account-1", profileId: "profile-1", targetId: "target-1", contentHash: "a".repeat(64),
              mediaHash: null, verificationMethod: "test_social_fake", evidenceReference: "test-social:1"
            }
          }
        };
      }
    } })
  });
  const first = await worker.reconcilePendingOnce();
  const second = await worker.reconcilePendingOnce();
  assert.equal(first[0].status, "UNKNOWN");
  assert.equal(second[0].status, "CONFIRMED");
  assert.equal(verifyCalls, 2);
  assert.equal(executeCalls, 0);
  const receipt = fixture.calls.find(([name]) => name === "receipt")?.[1];
  assert.equal(receipt.publicationUrl, "https://social.example/posts/1");
  assert.equal(receipt.publicationEvidence.verificationMethod, "test_social_fake");
});

test("LinkedIn adapter dry-run fills and verifies a draft, then closes without clicking Post", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pr3-linkedin-dry-run-"));
  const mediaPath = path.join(directory, "approved.mp4");
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(16)]);
  await writeFile(mediaPath, bytes);
  const mediaHash = createHash("sha256").update(bytes).digest("hex");
  let phase = "feed";
  let postClickCount = 0;
  let mountMediaInput = true;
  let previewReady = true;
  let uploadButtonClicked = false;
  const calls = [];
  const request = {
    executionId: "exec-dry", jobId: "job-dry", campaignId: "campaign-dry", platform: "linkedin",
    accountId: "account-1", profileId: "profile-1", target: { targetId: "target-1", url: "https://www.linkedin.com/feed/?shareActive=true" },
    audience: "public", content: { contentId: "content-1", sha256: createHash("sha256").update("approved draft").digest("hex"), payload: "approved draft" },
    media: [{ artifactId: "artifact-1", reference: mediaPath, sha256: mediaHash, type: "video/mp4" }]
  };
  const browser = {
    async listTabs() { return [{ id: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab() { return { pageId: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate(_id, url) { calls.push(["navigate", url]); },
    async waitForUrl(_id, url) { calls.push(["wait-url", url]); },
    async waitForFeed() {},
    async snapshot() {
      if (phase === "feed") return '- button "Start a post" [ref=trigger]';
      return '- textbox "Post editor" [ref=editor]\n- button "Phương tiện truyền thông" [expanded=false, ref=media]\n- button "Post" [ref=post]';
    },
    async evaluate(_id, expression) {
      if (expression.includes("LINKEDIN_MEDIA_SURFACE_STATE")) return { dialogCount: phase === "media" || phase === "uploaded" || phase === "media-next" ? 2 : 1, composerCount: 1, mediaDialogCount: phase === "media" || phase === "uploaded" || phase === "media-next" ? 1 : 0, fileInputCount: 2 };
      if (expression.includes("LINKEDIN_MEDIA_OPEN")) { phase = "media"; return { clicked: true }; }
      if (expression.includes("LINKEDIN_MEDIA_BASELINE")) return { fileInputCount: 2, selectedCount: 0 };
      if (expression.includes("LINKEDIN_MEDIA_UPLOAD_BUTTON")) { uploadButtonClicked = true; return { clicked: true }; }
      if (expression.includes("LINKEDIN_MEDIA_INPUT_")) return { fileInputCount: mountMediaInput && uploadButtonClicked ? 3 : 2, newInputCount: mountMediaInput && uploadButtonClicked ? 1 : 0, eligibleCount: mountMediaInput && uploadButtonClicked ? 1 : 0, selectorCount: expression.includes("LINKEDIN_MEDIA_INPUT_SELECT") ? 1 : 0, portalMounted: true };
      if (expression.includes("LINKEDIN_MEDIA_PREVIEW_STATE")) return { composerCount: 1, mediaDialogCount: 1, selectedInputCount: 1, fileCount: phase === "uploaded" ? 1 : 0, filename: phase === "uploaded" ? "approved.mp4" : "", mediaType: "video/mp4", videoCount: phase === "uploaded" && previewReady ? 1 : 0, videoWidth: phase === "uploaded" && previewReady ? 1280 : 0, videoHeight: phase === "uploaded" && previewReady ? 720 : 0, uploadError: false };
      if (expression.includes("LINKEDIN_MEDIA_FINISH_STATE")) return { composerCount: 1, mediaDialogCount: phase === "uploaded" || phase === "media-next" ? 1 : 0, nextEnabled: phase === "uploaded", doneEnabled: phase === "media-next" };
      if (expression.includes("LINKEDIN_MEDIA_FINISH_CLICK")) { phase = expression.includes("const pattern = /^(next") ? "media-next" : "composer-final"; return { clicked: true }; }
      if (expression.includes("LINKEDIN_MEDIA_CLEANUP_STATE")) return { path: phase === "feed" ? "/feed/" : "/sharing/compose", composerCount: phase === "feed" ? 0 : 1, mediaDialogCount: phase === "media" || phase === "uploaded" || phase === "media-next" ? 1 : 0, selectedFileCount: 0 };
      if (expression.includes("LINKEDIN_MEDIA_CANCEL_EDITOR")) { phase = "composer"; return { clicked: true }; }
      if (expression.includes("LINKEDIN_MEDIA_CLEAR_COMPOSER")) return { cleared: true };
      if (expression.includes("LINKEDIN_MEDIA_CANCEL_COMPOSER")) { phase = "feed"; return { clicked: true }; }
      if (expression.includes("const expectedPath")) return { linkedinDomain: true, loginRequired: false, securityChallenge: false, sessionAuthenticated: true, identityVerified: true, feedReachable: phase === "feed" };
      if (expression.includes("candidates[0].click()")) { phase = "composer"; return { clicked: true }; }
      if (expression === linkedInReadinessExpressions().composer) return { linkedinDomain: true, route: true, dialogCount: phase === "feed" ? 0 : 1, editorCount: phase === "feed" ? 0 : 1, audience: true, postButton: true, mediaControl: true, advertisingControls: 0 };
      if (expression.includes("const expected = \"public\"")) return { dialogCount: 1, audienceMatch: true };
      if (expression.includes("contenteditable") && expression.includes("editorCount")) return { dialogCount: 1, editorCount: 1, text: "approved draft" };
      if (expression.includes("newestMatchesSelector")) return { inputCount: phase === "media" || phase === "uploaded" ? (mountMediaInput ? 3 : 2) : 2, newestMatchesSelector: mountMediaInput, accept: "video/*", multiple: false, disabled: false, visible: false, selectedCount: phase === "uploaded" ? 1 : 0, mediaEditorVisible: phase === "media" || phase === "uploaded", dialogCount: 1 };
      if (expression.includes("length > 2") && expression.includes("input[type=")) return mountMediaInput && (phase === "media" || phase === "uploaded");
      if (expression.includes("videoWidth") && expression.includes("fileCount")) return { dialogCount: 1, fileCount: phase === "uploaded" ? 1 : 0, filename: phase === "uploaded" ? "approved.mp4" : "", mediaType: phase === "uploaded" ? "video/mp4" : "", videoCount: phase === "uploaded" && previewReady ? 1 : 0, videoWidth: phase === "uploaded" && previewReady ? 1280 : 0, videoHeight: phase === "uploaded" && previewReady ? 720 : 0, imageCount: 0, uploadError: false };
      if (expression.includes("const expected = new URL")) return { domain: true, targetMatched: true };
      return {};
    },
    async waitForExpression(_id, expression, timeoutMs) { calls.push(["wait-expression", expression, timeoutMs]); if (!expression.includes("input[type=") || phase !== "media" || !mountMediaInput) throw new Error("bounded mount wait failed"); },
    async click(_id, ref) {
      calls.push(["click", ref]);
      if (ref === "trigger") phase = "composer";
      else if (ref === "media") phase = "media";
      else if (ref === "post") { postClickCount += 1; phase = "submitted"; }
    },
    async fill(_id, ref, value) { calls.push(["fill", ref, value]); },
    async uploadSelector(_id, selector, file) { calls.push(["upload-selector", selector, file]); phase = "uploaded"; },
    async keypress(_id, key) { calls.push(["keypress", key]); phase = "feed"; }
  };
  try {
    const adapter = new LinkedInAdapter(browser);
    let integrityAtPreSubmit;
    const verifyPreSubmit = adapter.verifyPreSubmit.bind(adapter);
    adapter.verifyPreSubmit = async (context) => {
      integrityAtPreSubmit = context.media.preSubmitMediaIntegrity;
      return verifyPreSubmit(context);
    };
    const result = await adapter.execute(request, { dryRun: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner" });
    assert.equal(result.submitState, "NOT_STARTED");
    assert.equal(result.gates.mediaPreviewConfirmed, true, JSON.stringify(result));
    assert.deepEqual(integrityAtPreSubmit, {
      artifactId: "artifact-1", expectedSha256: mediaHash, localFileSha256: mediaHash,
      mediaType: "video/mp4", attached: true, previewReady: true
    });
    assert.deepEqual(calls.filter(([name]) => name === "navigate" || name === "wait-url"), [
      ["navigate", "https://www.linkedin.com/feed/"], ["wait-url", "https://www.linkedin.com/feed/"],
      ["navigate", "https://www.linkedin.com/feed/"]
    ]);
    assert.deepEqual(calls.filter(([name, ref]) => name === "click" && ref === "post"), []);
    assert.ok(calls.some(([name, selector]) => name === "upload-selector" && /^input\[data-orca-media-target=m[a-f0-9]{32}\]$/.test(selector)));
    assert.equal(uploadButtonClicked, true);
    assert.equal(phase, "feed");
    assert.equal(result.computerUseCalls, 0);
    assert.equal(postClickCount, 0, "dry-run must stop before Post");

    const uploadCountBeforeMismatch = calls.filter(([name]) => name === "upload-selector").length;
    const hashMismatch = await adapter.execute({ ...request, media: [{ ...request.media[0], sha256: "0".repeat(64) }] }, { dryRun: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner" });
    assert.equal(hashMismatch.errorClassification, "MEDIA_MISMATCH");
    assert.equal(calls.filter(([name]) => name === "upload-selector").length, uploadCountBeforeMismatch, "hash mismatch must block attachment");

    mountMediaInput = false;
    const missingInput = await new LinkedInAdapter(browser, { mediaTimeoutMs: 5 }).execute(request, { dryRun: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner" });
    assert.equal(missingInput.errorClassification, "UPLOAD_ERROR");
    assert.equal(calls.filter(([name]) => name === "upload-selector").length, uploadCountBeforeMismatch, "missing input must not attempt upload");

    mountMediaInput = true;
    previewReady = false;
    const missingPreview = await new LinkedInAdapter(browser, { mediaTimeoutMs: 5 }).execute(request, { dryRun: true, expectedIdentityUrl: "https://www.linkedin.com/in/owner" });
    assert.equal(missingPreview.errorClassification, "UPLOAD_ERROR", "upload command alone must not count as attachment success");
    assert.equal(postClickCount, 0);
    previewReady = true;

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

test("LinkedIn adapter waits for the authenticated shell after navigation instead of misclassifying hydration as auth failure", async () => {
  let phase = "feed";
  let hydrated = false;
  let identityChecks = 0;
  let hydrationWaits = 0;
  const request = {
    executionId: "exec-hydration", jobId: "job-hydration", campaignId: "campaign-hydration", platform: "linkedin",
    accountId: "account-1", profileId: "profile-1", target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" },
    audience: "public", content: { contentId: "content-1", sha256: createHash("sha256").update("draft").digest("hex"), payload: "draft" }, media: []
  };
  const browser = {
    async listTabs() { return [{ id: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab() { return { pageId: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate() { hydrated = false; },
    async waitForUrl() {},
    async waitForFeed() {},
    async waitForExpression(_id, expression, timeoutMs) {
      assert.match(expression, /sessionAuthenticated/);
      assert.equal(timeoutMs, 10_000);
      hydrationWaits += 1;
      hydrated = true;
    },
    async snapshot() {
      if (phase === "feed") return '- button "Start a post" [ref=trigger]';
      return '- textbox "Post editor" [ref=editor]\\n- button "Post" [ref=post]';
    },
    async evaluate(_id, expression) {
      if (expression.includes("LINKEDIN_MEDIA_CLEANUP_STATE")) return { path: phase === "feed" ? "/feed/" : "/sharing/compose", composerCount: phase === "feed" ? 0 : 1, mediaDialogCount: 0, selectedFileCount: 0 };
      if (expression.includes("LINKEDIN_MEDIA_CLEAR_COMPOSER")) return { cleared: true };
      if (expression.includes("LINKEDIN_MEDIA_CANCEL_COMPOSER")) { phase = "feed"; return { clicked: true }; }
      if (expression.includes("const expectedPath")) {
        identityChecks += 1;
        return { linkedinDomain: true, loginRequired: false, securityChallenge: false, sessionAuthenticated: hydrated, identityVerified: hydrated, feedReachable: hydrated };
      }
      if (expression.includes("candidates[0].click()")) { phase = "composer"; return { clicked: true }; }
      if (expression === linkedInReadinessExpressions().composer) return { linkedinDomain: true, route: true, routeCompatible: true, dialogCount: phase === "feed" ? 0 : 1, editorCount: phase === "feed" ? 0 : 1, audience: true, postButton: true, mediaControl: true, advertisingControls: 0, confirmed: phase !== "feed" };
      if (expression.includes('const expected = "public"')) return { dialogCount: 1, audienceMatch: true };
      if (expression.includes("contenteditable") && expression.includes("editorCount")) return { dialogCount: 1, editorCount: 1, text: "draft" };
      if (expression.includes("const expected = new URL")) return { domain: true, targetMatched: true };
      return {};
    },
    async click(_id, ref) { if (ref === "trigger") phase = "composer"; },
    async fill() {},
    async keypress() { phase = "feed"; }
  };

  const result = await new LinkedInAdapter(browser).execute(request, {
    dryRun: true,
    expectedIdentityUrl: "https://www.linkedin.com/in/owner"
  });

  assert.equal(result.submitState, "NOT_STARTED");
  assert.equal(result.gates.passed, undefined);
  assert.equal(result.gates.composerConfirmed, true);
  assert.equal(result.gates.mediaPreviewConfirmed, true);
  assert.equal(hydrationWaits, 1);
  assert.ok(identityChecks >= 2);
  assert.equal(phase, "feed");
});

test("LinkedIn composer trigger uses one strictly guarded direct DOM activation when ORCA click dispatch is unavailable", async () => {
  let phase = "feed";
  let directActivations = 0;
  let postClicks = 0;
  const request = {
    executionId: "exec-click-fallback", jobId: "job-click-fallback", campaignId: "campaign-click-fallback", platform: "linkedin",
    accountId: "account-1", profileId: "profile-1", target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" },
    audience: "public", content: { contentId: "content-1", sha256: createHash("sha256").update("draft").digest("hex"), payload: "draft" }, media: []
  };
  const browser = {
    async listTabs() { return [{ id: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab() { return { pageId: "page-1", profileId: "profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate() {}, async waitForUrl() {}, async waitForFeed() {},
    async snapshot() { return phase === "feed" ? '- button "Start a post" [ref=trigger]' : '- textbox "Post editor" [ref=editor]\\n- button "Post" [ref=post]'; },
    async evaluate(_id, expression) {
      if (expression.includes("LINKEDIN_MEDIA_CLEANUP_STATE")) return { path: phase === "feed" ? "/feed/" : "/sharing/compose", composerCount: phase === "feed" ? 0 : 1, mediaDialogCount: 0, selectedFileCount: 0 };
      if (expression.includes("LINKEDIN_MEDIA_CLEAR_COMPOSER")) return { cleared: true };
      if (expression.includes("LINKEDIN_MEDIA_CANCEL_COMPOSER")) { phase = "feed"; return { clicked: true }; }
      if (expression.includes("const expectedPath")) return { linkedinDomain: true, loginRequired: false, securityChallenge: false, sessionAuthenticated: true, identityVerified: true, feedReachable: true };
      if (expression.includes("candidates[0].click()")) { directActivations += 1; phase = "composer"; return { clicked: true }; }
      if (expression === linkedInReadinessExpressions().composer) return { linkedinDomain: true, route: phase === "composer", routeCompatible: phase === "composer", dialogCount: phase === "composer" ? 1 : 0, editorCount: phase === "composer" ? 1 : 0, audience: phase === "composer", postButton: phase === "composer", mediaControl: phase === "composer", advertisingControls: 0, confirmed: phase === "composer" };
      if (expression.includes('const expected = "public"')) return { dialogCount: 1, audienceMatch: true };
      if (expression.includes("contenteditable") && expression.includes("editorCount")) return { dialogCount: 1, editorCount: 1, text: "draft" };
      if (expression.includes("const expected = new URL")) return { domain: true, targetMatched: true };
      return {};
    },
    async click(_id, ref) { assert.fail(`unexpected semantic click: ${ref}`); },
    async fill() {},
    async keypress(_id, key) { if (key === "Escape") phase = "feed"; else if (key === "Enter") postClicks += 1; }
  };
  const result = await new LinkedInAdapter(browser).execute(request, {
    dryRun: true,
    expectedIdentityUrl: "https://www.linkedin.com/in/owner"
  });
  assert.equal(result.submitState, "NOT_STARTED");
  assert.equal(result.gates.composerConfirmed, true);
  assert.equal(result.telemetry.domClickFallbacks, 1);
  assert.equal(directActivations, 1);
  assert.equal(postClicks, 0);
  assert.equal(phase, "feed");
});
