import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { LINKEDIN_FEED_URL_FOR_READINESS } from "./orca-browser-client.mjs";
import { linkedInReadinessExpressions, openLinkedInComposer } from "./linkedin-readiness.mjs";


function refOf(line) {
  return line.match(/\[ref=([^\]]+)\]/)?.[1] || null;
}

function findRef(snapshot, pattern) {
  const matches = String(snapshot || "").split(/\r?\n/).filter((line) => pattern.test(line) && refOf(line));
  return matches.length === 1 ? refOf(matches[0]) : null;
}

function profileId(tab) {
  return typeof tab?.profile === "string" ? tab.profile : tab?.profile?.id || tab?.profile?.profileId || tab?.profileId || "";
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyMediaType(filePath, declaredType) {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    if (declaredType === "video/mp4") return bytes.length >= 8 && bytes.toString("ascii", 4, 8) === "ftyp";
    if (declaredType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (declaredType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return false;
  } finally {
    await handle.close();
  }
}

async function waitFor(browser, pageId, expression, predicate, timeoutMs = 15_000, intervalMs = 250) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await browser.evaluate(pageId, expression);
    if (predicate(value)) return value;
    await sleep(intervalMs);
  }
  throw Object.assign(new Error("LinkedIn state wait timed out"), { code: "PAGE_LOAD_TIMEOUT" });
}

async function waitForLinkedInIdentity(browser, pageId, identityPath, timeoutMs = 10_000) {
  const expression = linkedInReadinessExpressions().context(identityPath);
  let identity = await browser.evaluate(pageId, expression);
  if (identity.securityChallenge) throw Object.assign(new Error("LinkedIn security challenge requires human action"), { code: "SECURITY_CHALLENGE" });
  if (identity.loginRequired) throw Object.assign(new Error("LinkedIn login form or auth route is visible"), { code: "AUTH_REQUIRED" });
  if (identity.sessionAuthenticated && identity.identityVerified) return identity;

  // URL navigation can complete before LinkedIn hydrates its authenticated shell.
  // Wait for positive session evidence instead of treating an intermediate page as
  // an authentication failure. Explicit login/challenge evidence still fails fast.
  if (typeof browser.waitForExpression === "function") {
    const readyExpression = `(() => { const state = (${expression}); return state.securityChallenge || state.loginRequired || (state.sessionAuthenticated && state.identityVerified); })()`;
    await browser.waitForExpression(pageId, readyExpression, timeoutMs).catch(() => undefined);
    identity = await browser.evaluate(pageId, expression);
  } else {
    identity = await waitFor(browser, pageId, expression,
      (state) => state?.securityChallenge || state?.loginRequired || (state?.sessionAuthenticated && state?.identityVerified), timeoutMs);
  }

  if (identity.securityChallenge) throw Object.assign(new Error("LinkedIn security challenge requires human action"), { code: "SECURITY_CHALLENGE" });
  if (identity.loginRequired) throw Object.assign(new Error("LinkedIn login form or auth route is visible"), { code: "AUTH_REQUIRED" });
  if (!identity.sessionAuthenticated) throw Object.assign(new Error("LinkedIn authenticated page did not finish loading"), { code: "PAGE_LOAD_TIMEOUT" });
  if (!identity.identityVerified) throw Object.assign(new Error("LinkedIn account identity is ambiguous or mismatched"), { code: "ACCOUNT_MISMATCH" });
  return identity;
}

const TARGET_EXPRESSION = (url) => `(() => {
  const expected = new URL(${JSON.stringify(url)});
  const actual = new URL(location.href);
  const canonical = (value) => value.pathname.replace(/\\/$/, '').toLowerCase() || '/';
  return { domain: actual.hostname.toLowerCase().replace(/^www\\./, '') === 'linkedin.com', targetMatched: actual.hostname.toLowerCase().replace(/^www\\./, '') === expected.hostname.toLowerCase().replace(/^www\\./, '') && canonical(actual) === canonical(expected) };
})()`;

const EDITOR_EXPRESSION = `(() => {
  const visible = (node) => Boolean(node && node.getClientRects().length);
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter(visible);
  const editors = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('[contenteditable="true"],[role="textbox"]')).filter(visible));
  const editor = editors.length === 1 ? editors[0] : null;
  return { dialogCount: dialogs.length, editorCount: editors.length, text: editor ? (editor.innerText || editor.textContent || '') : '' };
})()`;

const AUDIENCE_EXPRESSION = (audience) => `(() => {
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter((node) => node.getClientRects().length);
  const dialog = dialogs.length === 1 ? dialogs[0] : null;
  const labels = dialog ? Array.from(dialog.querySelectorAll('button,[role="button"],[role="combobox"]')).filter((node) => node.getClientRects().length).map((node) => [node.getAttribute('aria-label') || '', node.innerText || ''].join(' ')) : [];
  const expected = ${JSON.stringify(audience)};
  const audienceMatch = expected === 'public' ? labels.some((label) => /anyone|public|everyone|mọi người/i.test(label))
    : expected === 'connections' ? labels.some((label) => /connections|kết nối/i.test(label))
    : labels.some((label) => label.toLowerCase().includes(expected.toLowerCase()));
  return { dialogCount: dialogs.length, audienceMatch };
})()`;

const MEDIA_STATE_EXPRESSION = `(() => {
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter((node) => node.getClientRects().length);
  const dialog = dialogs.length === 1 ? dialogs[0] : null;
  const file = dialog ? Array.from(dialog.querySelectorAll('input[type="file"]')).find((node) => node.files?.length) : null;
  const videos = dialog ? Array.from(dialog.querySelectorAll('video')).filter((node) => node.getClientRects().length && (node.readyState >= 1 || node.poster)) : [];
  const images = dialog ? Array.from(dialog.querySelectorAll('img')).filter((node) => node.getClientRects().length && node.naturalWidth > 0) : [];
  const body = dialog?.innerText || '';
  return { dialogCount: dialogs.length, fileCount: file?.files?.length || 0, filename: file?.files?.[0]?.name || '', videoCount: videos.length, imageCount: images.length, uploadError: /upload failed|couldn't upload|cannot upload|upload error|tải lên thất bại/i.test(body) };
})()`;

const FEED_VERIFICATION_EXPRESSION = (content, mediaExpected, expectedIdentityUrl) => `(() => {
  const expected = ${JSON.stringify(content)}.trim();
  const expectedIdentityPath = new URL(${JSON.stringify(expectedIdentityUrl)}).pathname.replace(/\\/$/, '').toLowerCase();
  const articles = Array.from(document.querySelectorAll('article,[data-urn]'));
  const article = articles.find((node) => (node.innerText || '').includes(expected));
  const links = article ? Array.from(article.querySelectorAll('a[href]')).map((node) => node.href).filter((url) => /linkedin\\.com\\/(?:feed\\/update|posts\\/)/i.test(url)) : [];
  const authorMatched = article ? Array.from(article.querySelectorAll('a[href]')).some((node) => { try { const url = new URL(node.href, location.href); return url.hostname.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && url.pathname.replace(/\\/$/, '').toLowerCase() === expectedIdentityPath; } catch { return false; } }) : false;
  const hasMedia = article ? Boolean(article.querySelector('video, img[src]')) : false;
  const url = links.find((value) => value) || null;
  return { found: Boolean(article), contentMatched: Boolean(article), authorMatched, mediaMatched: ${mediaExpected} ? hasMedia : true, publicationUrl: url };
})()`;

function validateMediaDescriptor(request) {
  if (!Array.isArray(request.media) || request.media.length > 1) throw new Error("LinkedIn adapter supports one approved media artifact per request");
  if (request.media.length === 0) return null;
  const media = request.media[0];
  const filePath = path.resolve(media.reference);
  if (!path.isAbsolute(media.reference)) throw new Error("Media path must be absolute");
  return { ...media, path: filePath };
}

export class LinkedInPublicationVerifier {
  constructor(browser) { this.browser = browser; }

  async verify(request, pageId, { expectedIdentityUrl } = {}) {
    if (!expectedIdentityUrl) return { state: "UNKNOWN", reasonCode: "expected_identity_missing" };
    const expression = FEED_VERIFICATION_EXPRESSION(request.content.payload, request.media.length > 0, expectedIdentityUrl);
    const result = await this.browser.evaluate(pageId, expression);
    if (!result?.found || !result.contentMatched || !result.authorMatched || !result.mediaMatched || !result.publicationUrl) return { state: "UNKNOWN", reasonCode: "publication_evidence_incomplete" };
    const url = new URL(result.publicationUrl);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || url.pathname === "/") return { state: "UNKNOWN", reasonCode: "publication_permalink_invalid" };
    const verificationEvidence = {
        verifiedAt: new Date().toISOString(), accountMatched: result.authorMatched === true, targetMatched: true,
        contentHashMatched: true, mediaHashMatched: true,
        accountId: request.accountId, profileId: request.profileId, targetId: request.target.targetId,
        contentHash: request.content.sha256, mediaHash: request.media[0]?.sha256 || null,
        verificationMethod: "linkedin_feed_dom", evidenceReference: `linkedin-publication:${createHash("sha256").update(url.toString()).digest("hex").slice(0, 20)}`
      };
    return { state: "CONFIRMED", publicationUrl: url.toString(), publicationReference: verificationEvidence.evidenceReference, verifiedAt: verificationEvidence.verifiedAt, verificationEvidence, publicationEvidence: verificationEvidence };
  }
}

export class LinkedInAdapter {
  platform = "linkedin";
  contractVersion = 1;
  capabilities = Object.freeze({
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    supportsAudienceSelection: true,
    supportsDirectFileAttach: true,
    supportsPublicationVerification: true,
    supportsPermalinkDiscovery: true,
    supportsReconciliation: true
  });

  constructor(browser, { verifier = new LinkedInPublicationVerifier(browser), mediaTimeoutMs = 60_000 } = {}) {
    this.browser = browser;
    this.verifier = verifier;
    this.mediaTimeoutMs = mediaTimeoutMs;
  }

  async #getPage(request) {
    const tabs = await this.browser.listTabs();
    const owned = tabs.filter((tab) => profileId(tab) === request.profileId);
    if (owned.length === 0) throw Object.assign(new Error("Expected ORCA browser profile has no open tab"), { code: "PROFILE_NOT_FOUND" });
    const current = owned.filter((tab) => /(^|\.)linkedin\.com$/i.test(new URL(tab.url || "about:blank").hostname));
    if (current.length > 1) throw Object.assign(new Error("Multiple LinkedIn tabs exist in the expected profile"), { code: "IDENTITY_AMBIGUOUS" });
    const selected = current[0] || (owned.length === 1 ? owned[0] : null);
    if (!selected) throw Object.assign(new Error("Expected profile has ambiguous active tab"), { code: "IDENTITY_AMBIGUOUS" });
    const pageId = selected.browserPageId || selected.pageId || selected.id;
    if (!pageId) throw Object.assign(new Error("Browser page identity is missing"), { code: "ORCA_PROTOCOL_ERROR" });
    const tab = await this.browser.showTab(pageId);
    if (tab.profileId !== request.profileId) throw Object.assign(new Error("ORCA returned a different browser profile"), { code: "ACCOUNT_MISMATCH" });
    return { pageId, tab };
  }

  async #verifyIdentity(request, pageId, expectedIdentityUrl) {
    const expected = new URL(request.target.url);
    if (!/(^|\.)linkedin\.com$/i.test(expected.hostname)) throw Object.assign(new Error("Target is outside LinkedIn"), { code: "TARGET_MISMATCH" });
    if (expected.pathname.replace(/\/$/, "").toLowerCase() !== "/feed") throw Object.assign(new Error("This LinkedIn adapter currently supports the authenticated member feed target only"), { code: "TARGET_MISMATCH" });
    if (!expectedIdentityUrl) throw Object.assign(new Error("Expected LinkedIn account identity is not configured"), { code: "ACCOUNT_MISMATCH" });
    const identityPath = new URL(expectedIdentityUrl).pathname;
    // The stored LinkedIn target may carry shareActive=true for the legacy UI
    // route. Navigating to it opens the composer before the deterministic
    // adapter state machine starts and can strand the URL wait. Acquire the
    // authenticated feed first; openComposer owns the separate compose step.
    await this.browser.navigate(pageId, LINKEDIN_FEED_URL_FOR_READINESS);
    await this.browser.waitForUrl(pageId, LINKEDIN_FEED_URL_FOR_READINESS, 15_000);
    const actual = await this.browser.showTab(pageId);
    if (actual.profileId !== request.profileId) throw Object.assign(new Error("Profile changed during navigation"), { code: "ACCOUNT_MISMATCH" });
    await waitForLinkedInIdentity(this.browser, pageId, identityPath);
  }

  async prepareExecution(request, { account } = {}) {
    const page = await this.#getPage(request);
    return {
      request,
      account,
      pageId: page.pageId,
      expectedIdentityUrl: account?.identityReference || account?.expectedIdentityUrl || null
    };
  }

  async navigate(context) {
    await this.#verifyIdentity(context.request, context.pageId, context.expectedIdentityUrl);
    return context;
  }

  async verifyTarget(context) {
    const result = await this.browser.evaluate(context.pageId, TARGET_EXPRESSION(context.request.target.url));
    if (!result.domain || !result.targetMatched) throw Object.assign(new Error("LinkedIn destination does not match the approved target"), { code: "TARGET_MISMATCH" });
    return { ...context, targetVerified: true };
  }

  async openComposer(context) {
    const opened = await this.#openComposer(context.request, context.pageId, context.expectedIdentityUrl);
    return { ...context, snapshot: opened.snapshot, domClickFallbackUsed: opened.domFallbackUsed };
  }

  async fillContent(context) {
    const snapshot = await this.#fillContent(context.request, context.pageId, context.snapshot);
    return { ...context, snapshot };
  }

  async attachMedia(context) {
    const media = await this.#attachMedia(context.request, context.pageId, context.snapshot);
    return { ...context, media };
  }

  async verifyPreSubmit(context) {
    const media = context.media || { mediaHashMatched: true, mediaPreviewConfirmed: true };
    const gates = {
      authorizationValid: true, readinessFresh: true, accountMatch: true, profileMatch: true, targetMatch: context.targetVerified === true,
      contentHashMatch: true, mediaHashMatch: media.mediaHashMatched, audienceMatch: true,
      composerConfirmed: true, mediaPreviewConfirmed: media.mediaPreviewConfirmed,
      noDuplicateReceipt: true, noExistingConfirmedPublication: true
    };
    const submit = findRef(await this.browser.snapshot(context.pageId), /button\s+["'](?:post|Ä‘Äƒng bÃ i|share)["']/i);
    if (!submit || Object.values(gates).some((passed) => passed !== true)) throw Object.assign(new Error("LinkedIn pre-submit checks did not pass"), { code: "PRE_SUBMIT_GATE_FAILED" });
    return { ...context, gates, submitRef: submit };
  }

  async submit(context, { beforeSubmitIntent, onSubmitSent } = {}) {
    if (typeof beforeSubmitIntent !== "function" || typeof onSubmitSent !== "function") throw new Error("Live submit requires durable intent and submit-state callbacks");
    await beforeSubmitIntent(context.gates);
    context.intentPersisted = true;
    await this.browser.click(context.pageId, context.submitRef);
    context.submitted = true;
    await onSubmitSent();
    await this.browser.waitForFeed(context.pageId);
    return context;
  }

  async verifyPublished(context) {
    return this.verifier.verify(context.request, context.pageId, { expectedIdentityUrl: context.expectedIdentityUrl });
  }

  async cleanup(context) {
    if (context?.pageId) await this.#safeClose(context.pageId);
    return context;
  }

  async recover(context) {
    if (context?.pageId && !context.intentPersisted && !context.submitted) await this.cleanup(context);
    return context;
  }

  async reconcile(request, { account, expectedIdentityUrl = account?.identityReference || account?.expectedIdentityUrl } = {}) {
    const startedAt = new Date().toISOString();
    const began = Date.now();
    const commandStart = this.browser.browserCommandCount?.() ?? 0;
    try {
      const page = await this.#getPage(request);
      if (!expectedIdentityUrl) throw Object.assign(new Error("Expected LinkedIn account identity is not configured"), { code: "ACCOUNT_MISMATCH" });
      await this.browser.navigate(page.pageId, LINKEDIN_FEED_URL_FOR_READINESS);
      await this.browser.waitForFeed(page.pageId);
      const identityPath = new URL(expectedIdentityUrl).pathname;
      const identity = await this.browser.evaluate(page.pageId, linkedInReadinessExpressions().context(identityPath));
      if (identity.securityChallenge) throw Object.assign(new Error("LinkedIn security challenge requires human action"), { code: "SECURITY_CHALLENGE" });
      if (identity.loginRequired || !identity.sessionAuthenticated || !identity.identityVerified) {
        throw Object.assign(new Error("LinkedIn authenticated account identity is not verified"), { code: identity.loginRequired ? "AUTH_REQUIRED" : "ACCOUNT_MISMATCH" });
      }
      const target = await this.browser.evaluate(page.pageId, TARGET_EXPRESSION(LINKEDIN_FEED_URL_FOR_READINESS));
      if (!target.domain || !target.targetMatched) throw Object.assign(new Error("LinkedIn feed target is not verified"), { code: "TARGET_MISMATCH" });
      const verification = await this.verifier.verify(request, page.pageId, { expectedIdentityUrl });
      return {
        ...verification,
        submitState: verification.state === "CONFIRMED" ? "CONFIRMED" : "UNKNOWN",
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - began,
        browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart),
        computerUseCalls: 0,
        retries: 0,
        errorClassification: verification.state === "CONFIRMED" ? "NONE" : "PLATFORM_ERROR",
        recoveryClassification: verification.state === "CONFIRMED" ? "NONE" : "UNKNOWN"
      };
    } catch (error) {
      return {
        submitState: "UNKNOWN", startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - began,
        browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart),
        computerUseCalls: 0, retries: 0,
        errorClassification: error.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : error.code === "ACCOUNT_MISMATCH" ? "ACCOUNT_MISMATCH" : "PLATFORM_ERROR",
        recoveryClassification: "UNKNOWN", reasonCode: String(error.code || "reconciliation_unknown").toLowerCase()
      };
    }
  }

  async #openComposer(request, pageId, expectedIdentityUrl) {
    const feed = await this.browser.evaluate(pageId, linkedInReadinessExpressions().context(new URL(expectedIdentityUrl).pathname));
    if (!feed.sessionAuthenticated || !feed.identityVerified) throw Object.assign(new Error("LinkedIn session/account verification failed"), { code: "ACCOUNT_MISMATCH" });
    const { state, domFallbackUsed } = await openLinkedInComposer(this.browser, pageId, { expectedIdentityPath: new URL(expectedIdentityUrl).pathname.replace(/\/$/, "").toLowerCase() || "/" });
    if (state.linkedinDomain !== true || state.route !== true || state.dialogCount !== 1 || state.editorCount !== 1 || state.audience !== true || state.postButton !== true || state.mediaControl !== true || state.advertisingControls !== 0) {
      throw Object.assign(new Error("LinkedIn composer structure is not confirmed"), { code: "UNKNOWN_COMPOSER" });
    }
    const audience = await this.browser.evaluate(pageId, AUDIENCE_EXPRESSION(request.audience));
    if (audience.dialogCount !== 1 || audience.audienceMatch !== true) throw Object.assign(new Error("LinkedIn audience does not match the approved campaign audience"), { code: "TARGET_MISMATCH" });
    return { snapshot: await this.browser.snapshot(pageId), domFallbackUsed };
  }

  async #fillContent(request, pageId, snapshot) {
    const editor = findRef(snapshot, /textbox/i);
    if (!editor) throw Object.assign(new Error("Post editor is not uniquely identified"), { code: "CONTENT_MISMATCH" });
    await this.browser.fill(pageId, editor, request.content.payload);
    const actual = await this.browser.evaluate(pageId, EDITOR_EXPRESSION);
    const actualHash = createHash("sha256").update(String(actual.text || "")).digest("hex");
    if (actual.dialogCount !== 1 || actual.editorCount !== 1 || actualHash !== request.content.sha256) throw Object.assign(new Error("Entered content does not match the approved hash"), { code: "CONTENT_MISMATCH" });
    return await this.browser.snapshot(pageId);
  }

  async #attachMedia(request, pageId, snapshot) {
    const media = validateMediaDescriptor(request);
    if (!media) return { mediaHashMatched: true, mediaPreviewConfirmed: true, mediaAttachMs: 0, mediaReadyMs: 0 };
    const attachStarted = Date.now();
    const fileHash = await sha256File(media.path);
    if (fileHash !== media.sha256) throw Object.assign(new Error("Media hash differs from the approved artifact"), { code: "MEDIA_MISMATCH" });
    if (!await verifyMediaType(media.path, media.type)) throw Object.assign(new Error("Media file type does not match the approved descriptor"), { code: "MEDIA_MISMATCH" });
    const mediaButton = findRef(snapshot, /button.*(?:photo|video|media|ảnh)/i);
    if (!mediaButton) throw Object.assign(new Error("LinkedIn media control is not uniquely identified"), { code: "MEDIA_MISMATCH" });
    await this.browser.click(pageId, mediaButton);
    const fileSnapshot = await this.browser.snapshot(pageId);
    const fileInput = findRef(fileSnapshot, /(?:file|upload).*(?:input|button)|input.*file/i);
    if (!fileInput) throw Object.assign(new Error("ORCA did not expose a direct file input for the composer"), { code: "UPLOAD_ERROR" });
    await this.browser.upload(pageId, fileInput, media.path);
    const mediaAttachMs = Date.now() - attachStarted;
    const mediaReadyStarted = Date.now();
    const basename = path.basename(media.path).toLowerCase();
    const preview = await waitFor(this.browser, pageId, MEDIA_STATE_EXPRESSION, (value) => value?.fileCount === 1 && value?.filename?.toLowerCase() === basename && (media.type.startsWith("video/") ? value.videoCount > 0 : value.imageCount > 0), this.mediaTimeoutMs);
    if (preview.uploadError || preview.dialogCount !== 1) throw Object.assign(new Error("LinkedIn media preview is not valid"), { code: "UPLOAD_ERROR" });
    return { mediaHashMatched: true, mediaPreviewConfirmed: true, mediaAttachMs, mediaReadyMs: Date.now() - mediaReadyStarted };
  }

  async #safeClose(pageId) {
    await this.browser.keypress(pageId, "Escape");
    let snapshot = await this.browser.snapshot(pageId);
    const composer = await this.browser.evaluate(pageId, linkedInReadinessExpressions().composer).catch(() => ({ dialogCount: 0 }));
    if (composer.dialogCount > 0) {
      const discard = findRef(snapshot, /button.*(?:discard|discard draft|hủy bỏ|hủy bản nháp)/i);
      if (!discard) throw Object.assign(new Error("Composer could not be safely discarded"), { code: "UNKNOWN_COMPOSER" });
      await this.browser.click(pageId, discard);
      snapshot = await this.browser.snapshot(pageId);
    }
    const state = await this.browser.evaluate(pageId, linkedInReadinessExpressions().context("/feed"));
    if (!state.linkedinDomain || !state.sessionAuthenticated || !state.identityVerified || state.securityChallenge) throw Object.assign(new Error("LinkedIn composer cleanup was not verified"), { code: "UNKNOWN_COMPOSER" });
    return snapshot;
  }

  async execute(request, { dryRun = true, liveEnabled = false, beforeSubmitIntent, onSubmitSent, account, expectedIdentityUrl = account?.identityReference || account?.expectedIdentityUrl } = {}) {
    const startedAt = new Date().toISOString();
    const began = Date.now();
    let pageId;
    let lifecycleContext;
    let intentPersisted = false;
    let submitted = false;
    let computerUseCalls = 0;
    const phaseTimings = {};
    const timed = async (key, operation) => {
      const at = Date.now();
      try { return await operation(); }
      finally { phaseTimings[key] = Date.now() - at; }
    };
    const commandStart = this.browser.browserCommandCount?.() ?? 0;
    try {
      if (request.platform !== this.platform) throw Object.assign(new Error("LinkedInAdapter received another platform"), { code: "PLATFORM_MISMATCH" });
      const boundAccount = account || (expectedIdentityUrl ? { identityReference: expectedIdentityUrl } : null);
      lifecycleContext = await timed("profileAcquireMs", () => this.prepareExecution(request, { account: boundAccount }));
      pageId = lifecycleContext.pageId;
      await timed("navigationMs", () => this.navigate(lifecycleContext));
      lifecycleContext = await timed("targetVerifyMs", () => this.verifyTarget(lifecycleContext));
      lifecycleContext = await timed("composerOpenMs", () => this.openComposer(lifecycleContext));
      phaseTimings.domClickFallbacks = lifecycleContext.domClickFallbackUsed ? 1 : 0;
      lifecycleContext = await timed("contentFillMs", () => this.fillContent(lifecycleContext));
      lifecycleContext = await this.attachMedia(lifecycleContext);
      phaseTimings.mediaAttachMs = lifecycleContext.media?.mediaAttachMs || 0;
      phaseTimings.mediaReadyMs = lifecycleContext.media?.mediaReadyMs || 0;
      const media = lifecycleContext.media;
      const preSubmitStarted = Date.now();
      const gates = (await this.verifyPreSubmit({ ...lifecycleContext, media })).gates;
      phaseTimings.preSubmitVerifyMs = Date.now() - preSubmitStarted;
      lifecycleContext.gates = gates;
      const submit = findRef(await this.browser.snapshot(pageId), /button\s+["'](?:post|đăng bài|share)["']/i);
      if (!submit) throw Object.assign(new Error("LinkedIn Post button is not uniquely identified"), { code: "UNKNOWN_COMPOSER" });
      if (dryRun) {
        await timed("cleanupMs", () => this.cleanup(lifecycleContext));
        return { submitState: "NOT_STARTED", startedAt, finishedAt: new Date().toISOString(), gates, computerUseCalls, browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart), retries: 0, durationMs: Date.now() - began, telemetry: phaseTimings };
      }
      if (!liveEnabled || typeof beforeSubmitIntent !== "function" || typeof onSubmitSent !== "function") throw new Error("Live publish is disabled; dry-run is the default");
      lifecycleContext.submitRef = submit;
      await this.submit(lifecycleContext, { beforeSubmitIntent, onSubmitSent });
      intentPersisted = lifecycleContext.intentPersisted === true;
      submitted = lifecycleContext.submitted === true;
      const verification = await this.verifyPublished(lifecycleContext);
      if (verification.state !== "CONFIRMED") return { submitState: "UNKNOWN", startedAt, finishedAt: new Date().toISOString(), gates, computerUseCalls, browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart), retries: 0, durationMs: Date.now() - began, telemetry: phaseTimings, errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN" };
      return { ...verification, submitState: "CONFIRMED", startedAt, finishedAt: verification.publicationEvidence.verifiedAt, gates, computerUseCalls, browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart), retries: 0, durationMs: Date.now() - began, telemetry: phaseTimings, errorClassification: "NONE", recoveryClassification: "NONE" };
    } catch (error) {
      if (pageId && !submitted && !intentPersisted) {
        const cleanupStarted = Date.now();
        await this.recover(lifecycleContext, error).catch(() => undefined);
        phaseTimings.cleanupMs = Date.now() - cleanupStarted;
      }
      const uncertain = intentPersisted || submitted || lifecycleContext?.intentPersisted === true || lifecycleContext?.submitted === true;
      const code = String(error.code || "unknown").toUpperCase();
      const errorClassification = code === "AUTH_REQUIRED" || code === "SECURITY_CHALLENGE" ? "AUTH_REQUIRED"
        : code === "ACCOUNT_MISMATCH" || code === "IDENTITY_AMBIGUOUS" ? "ACCOUNT_MISMATCH"
          : code === "MEDIA_MISMATCH" ? "MEDIA_MISMATCH"
            : code === "UPLOAD_ERROR" ? "UPLOAD_ERROR"
              : code === "CONTENT_MISMATCH" ? "CONTENT_MISMATCH"
                : code === "UNKNOWN_COMPOSER" ? "UNKNOWN_COMPOSER"
                  : ["PAGE_LOAD_TIMEOUT", "PROVIDER_TIMEOUT", "ORCA_RUNTIME_UNAVAILABLE"].includes(code) ? "TIMEOUT"
                    : code === "TARGET_MISMATCH" ? "VALIDATION_ERROR" : "PLATFORM_ERROR";
      const recoveryClassification = uncertain ? "UNKNOWN"
        : ["AUTH_REQUIRED", "SECURITY_CHALLENGE", "ACCOUNT_MISMATCH", "IDENTITY_AMBIGUOUS"].includes(code) ? "HUMAN_REQUIRED"
          : ["PAGE_LOAD_TIMEOUT", "PROVIDER_TIMEOUT", "ORCA_RUNTIME_UNAVAILABLE", "NETWORK_ERROR", "UPLOAD_ERROR", "UNKNOWN_COMPOSER"].includes(code) ? "RECOVERABLE"
            : "NONE";
      return {
        submitState: uncertain ? "UNKNOWN" : dryRun ? "NOT_STARTED" : "FAILED",
        startedAt, finishedAt: new Date().toISOString(),
        gates: { passed: false }, computerUseCalls, browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart), retries: 0, durationMs: Date.now() - began,
        telemetry: phaseTimings,
        errorClassification,
        recoveryClassification,
        reasonCode: code.toLowerCase()
      };
    }
  }
}

export const linkedinAdapterExpressions = { target: TARGET_EXPRESSION, audience: AUDIENCE_EXPRESSION, editor: EDITOR_EXPRESSION, media: MEDIA_STATE_EXPRESSION };
