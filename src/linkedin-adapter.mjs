import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { LINKEDIN_FEED_URL_FOR_READINESS } from "./orca-browser-client.mjs";
import { linkedInReadinessExpressions, openLinkedInComposer } from "./linkedin-readiness.mjs";
import { attachLinkedInMedia, cleanupLinkedInComposer } from "./linkedin-media.mjs";


function refOf(line) {
  return line.match(/\bref=([^\],\s]+)/)?.[1] || null;
}

function findRef(snapshot, pattern) {
  const matches = String(snapshot || "").split(/\r?\n/).filter((line) => pattern.test(line) && refOf(line));
  return matches.length === 1 ? refOf(matches[0]) : null;
}

async function withinDeadline(operation, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Object.assign(new Error("LinkedIn verification deadline elapsed"), { code: "VERIFICATION_DEADLINE" });
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("LinkedIn verification deadline elapsed"), { code: "VERIFICATION_DEADLINE" })), remaining); })
    ]);
  } finally { clearTimeout(timer); }
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

export const LINKEDIN_VERIFICATION_EXPRESSION = (content, expectedIdentityUrl) => `(() => {
  const expected = ${JSON.stringify(content)}.trim();
  const expectedIdentityPath = new URL(${JSON.stringify(expectedIdentityUrl)}).pathname.replace(/\\/$/, '').toLowerCase();
  const articles = Array.from(new Set(document.querySelectorAll('article,[data-urn]')));
  return articles.map((article) => {
    const text = article.innerText || article.textContent || '';
    if (!text.includes(expected)) return null;
    const links = Array.from(article.querySelectorAll('a[href]')).map((node) => { try { return new URL(node.href, location.href); } catch { return null; } }).filter(Boolean);
    const author = links.find((url) => url.hostname.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && url.pathname.replace(/\\/$/, '').toLowerCase() === expectedIdentityPath);
    const permalinkUrl = links.find((url) => url.hostname.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && /\\/(?:feed\\/update|posts)\\//i.test(url.pathname));
    const urnNode = article.matches('[data-urn]') ? article : article.querySelector('[data-urn]');
    const activityUrn = urnNode?.getAttribute('data-urn') || text.match(/urn:li:(?:activity|share):[\\w-]+/)?.[0] || null;
    const activityId = activityUrn?.match(/urn:li:(?:activity|share):([\\w-]+)/)?.[1] || permalinkUrl?.pathname.match(/\\/(?:feed\\/update|posts)\\/([^/]+)/i)?.[1] || null;
    const publicationUrl = permalinkUrl?.toString() || (activityUrn ? 'https://www.linkedin.com/feed/update/' + activityUrn + '/' : null);
    const timeNode = article.querySelector('time[datetime],[data-timestamp]');
    const rawTimestamp = timeNode?.getAttribute('datetime') || timeNode?.getAttribute('data-timestamp') || null;
    const candidateTimestamp = rawTimestamp && Number.isFinite(Date.parse(rawTimestamp)) ? new Date(rawTimestamp).toISOString() : null;
    const video = article.querySelector('video');
    const image = article.querySelector('img[src]');
    return { found: true, contentMatched: true, authorMatched: Boolean(author), authorPath: author?.pathname.replace(/\\/$/, '').toLowerCase() || null,
      activityUrn, activityId, publicationUrl, candidateTimestamp, mediaPresent: Boolean(video || image), mediaType: video ? 'video' : image ? 'image' : null };
  }).filter(Boolean);
})()`;

const LINKEDIN_POST_CONFIRMATION_EXPRESSION = `(() => {
  const visible = (node) => Boolean(node && node.getClientRects().length);
  return Array.from(document.querySelectorAll('[role="alert"],[role="status"],.share-creation-state__success-container'))
    .filter(visible).map((node) => (node.innerText || node.textContent || '').trim())
    .filter((text) => /post(?:ed| is live)|shared|published|đã đăng|đã chia sẻ/i.test(text))
    .slice(0, 5).map((text) => text.slice(0, 200));
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
  constructor(browser, { timeoutMs = 9_000, maxCandidateAgeMs = 30 * 60_000 } = {}) {
    this.browser = browser;
    this.timeoutMs = timeoutMs;
    this.maxCandidateAgeMs = maxCandidateAgeMs;
  }

  async verify(request, pageId, { expectedIdentityUrl, submittedAt } = {}) {
    if (!expectedIdentityUrl) return { state: "UNKNOWN", reasonCode: "expected_identity_missing" };
    const observedAt = new Date().toISOString();
    const submittedMs = Date.parse(submittedAt || "");
    if (!Number.isFinite(submittedMs)) return { state: "UNKNOWN", reasonCode: "submit_timestamp_missing" };
    const expression = LINKEDIN_VERIFICATION_EXPRESSION(request.content.payload, expectedIdentityUrl);
    const identity = new URL(expectedIdentityUrl);
    const profileRoot = `${identity.origin}${identity.pathname.replace(/\/$/, "")}`;
    const surfaces = [
      { name: "post_submit_confirmation", url: null },
      { name: "feed", url: LINKEDIN_FEED_URL_FOR_READINESS },
      { name: "recent_activity", url: `${profileRoot}/recent-activity/all/` },
      { name: "videos", url: `${profileRoot}/recent-activity/videos/` }
    ];
    const deadline = Date.now() + this.timeoutMs;
    const observations = [];
    let confirmationSignals = [];
    for (const [index, surface] of surfaces.entries()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        if (surface.url && index > 0) {
          await withinDeadline(this.browser.navigate(pageId, surface.url), deadline);
          const navigationBudget = deadline - Date.now();
          if (navigationBudget <= 0) break;
          const urlWaitMs = Math.min(1_000, Math.max(1, Math.floor(navigationBudget / (surfaces.length - index + 1))));
          await withinDeadline(this.browser.waitForUrl(pageId, surface.url, urlWaitMs), deadline);
        } else if (index === 0) {
          const signals = await withinDeadline(this.browser.evaluate(pageId, LINKEDIN_POST_CONFIRMATION_EXPRESSION), deadline);
          if (Array.isArray(signals)) confirmationSignals = signals;
          const found = await withinDeadline(this.browser.evaluate(pageId, expression), deadline);
          if (Array.isArray(found)) observations.push(...found.map((candidate) => ({ ...candidate, surface: surface.name })));
          continue;
        }
        const waitBudget = deadline - Date.now();
        if (waitBudget <= 0) break;
        const waitMs = Math.max(1, Math.floor(waitBudget / (surfaces.length - index)));
        if (typeof this.browser.waitForExpression === "function") await withinDeadline(this.browser.waitForExpression(pageId, `(${expression}).some((candidate) => candidate.contentMatched)`, waitMs), deadline).catch(() => undefined);
        const found = await withinDeadline(this.browser.evaluate(pageId, expression), deadline);
        if (Array.isArray(found)) observations.push(...found.map((candidate) => ({ ...candidate, surface: surface.name })));
      } catch {
        // A secondary surface may be unavailable; preserve any evidence collected elsewhere.
      }
    }
    const candidates = observations.map((candidate) => {
      const url = candidate.publicationUrl ? new URL(candidate.publicationUrl) : null;
      const stableId = candidate.activityId || null;
      const timestamp = Date.parse(candidate.candidateTimestamp || "");
      const timestampMatched = Number.isFinite(timestamp) && timestamp >= submittedMs && timestamp <= submittedMs + this.maxCandidateAgeMs;
      const permalinkMatched = Boolean(url && /(^|\.)linkedin\.com$/i.test(url.hostname) && url.pathname !== "/" && stableId);
      const expectedMediaType = request.media?.[0]?.type?.startsWith("video/") ? "video" : request.media?.[0]?.type?.startsWith("image/") ? "image" : null;
      const mediaVerification = !expectedMediaType ? candidate.mediaPresent ? "MISMATCHED" : "MATCHED" : !candidate.mediaPresent ? "NOT_VERIFIABLE" : candidate.mediaType !== expectedMediaType ? "MISMATCHED" : "NOT_VERIFIABLE";
      return { ...candidate, permalinkMatched, stableId, timestampMatched, mediaVerification, permalink: url?.toString() || null };
    }).sort((left, right) => (Number(right.authorMatched) + Number(right.contentMatched) + Number(right.timestampMatched) + Number(right.permalinkMatched)) - (Number(left.authorMatched) + Number(left.contentMatched) + Number(left.timestampMatched) + Number(left.permalinkMatched)));
    const candidate = candidates[0] || null;
    const candidateConfirmed = Boolean(candidate?.authorMatched && candidate.contentMatched && candidate.timestampMatched && candidate.permalinkMatched);
    const mediaHashMatched = candidateConfirmed && candidate?.mediaVerification === "MATCHED";
    const evidenceReference = candidate?.permalink || candidate?.activityUrn || `linkedin-search:${request.executionId}`;
    const verificationEvidence = {
      verifiedAt: observedAt, accountMatched: candidate?.authorMatched === true, targetMatched: Boolean(candidate?.permalinkMatched),
      contentHashMatched: candidate?.contentMatched === true, mediaHashMatched,
      accountId: request.accountId, profileId: request.profileId, targetId: request.target.targetId,
      contentHash: request.content.sha256, mediaHash: mediaHashMatched ? request.media?.[0]?.sha256 || null : null,
      verificationMethod: "linkedin_read_only_activity_dom", evidenceReference,
      verificationDetails: {
        executionId: request.executionId, submittedAt: new Date(submittedMs).toISOString(), observedAt,
        authorIdentity: { expectedPath: identity.pathname.replace(/\/$/, "").toLowerCase(), observedPath: candidate?.authorPath || null, matched: candidate?.authorMatched === true },
        contentMatch: { expectedSha256: request.content.sha256, matched: candidate?.contentMatched === true },
        candidate: { surface: candidate?.surface || null, activityUrn: candidate?.activityUrn || null, postId: candidate?.stableId || null, permalink: candidate?.permalink || null, timestamp: candidate?.candidateTimestamp || null, timestampMatched: candidate?.timestampMatched === true },
        media: { present: candidate?.mediaPresent === true, type: candidate?.mediaType || null, hashStatus: candidate?.mediaVerification || "NOT_VERIFIABLE" },
        confirmationSignals
      }
    };
    if (!candidateConfirmed) return { state: "UNKNOWN", reasonCode: candidate ? "publication_candidate_evidence_incomplete" : "publication_not_observed", publicationUrl: candidate?.permalink || undefined, publicationReference: evidenceReference, verificationEvidence, publicationEvidence: verificationEvidence };
    if (!mediaHashMatched) return { state: "UNKNOWN", reasonCode: candidate.mediaVerification === "MISMATCHED" ? "publication_media_type_mismatch" : "publication_media_identity_not_verifiable", publicationUrl: candidate.permalink, publicationReference: evidenceReference, verificationEvidence, publicationEvidence: verificationEvidence };
    return { state: "CONFIRMED", publicationUrl: candidate.permalink, publicationReference: evidenceReference, verifiedAt: observedAt, verificationEvidence, publicationEvidence: verificationEvidence };
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
    const media = await this.#attachMedia(context.request, context.pageId);
    return { ...context, media };
  }

  async verifyPreSubmit(context) {
    const media = context.media || { mediaHashMatched: true, mediaPreviewConfirmed: true };
    const gates = {
      authorizationValid: true, readinessFresh: true, accountMatch: true, profileMatch: true, targetMatch: context.targetVerified === true,
      contentHashMatch: true, mediaHashMatch: media.mediaHashMatched, audienceMatch: media.audienceMatch === true,
      composerConfirmed: true, mediaPreviewConfirmed: media.mediaPreviewConfirmed,
      noDuplicateReceipt: true, noExistingConfirmedPublication: true
    };
    const submit = findRef(await this.browser.snapshot(context.pageId), /button\s+["\'](?:post|\u0111\u0103ng b\u00e0i|share)["\']/i);
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
    context.submittedAt = new Date().toISOString();
    return context;
  }

  async verifyPublished(context) {
    return this.verifier.verify(context.request, context.pageId, {
      expectedIdentityUrl: context.expectedIdentityUrl,
      executionId: context.request.executionId,
      submittedAt: context.submittedAt
    });
  }

  async cleanup(context) {
    if (context?.pageId) await this.#safeClose(context.pageId, context.request);
    return context;
  }

  async recover(context) {
    if (context?.pageId && !context.intentPersisted && !context.submitted) await this.cleanup(context);
    return context;
  }

  async reconcile(request, { account, expectedIdentityUrl = account?.identityReference || account?.expectedIdentityUrl, submittedAt } = {}) {
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
      const verification = await this.verifier.verify(request, page.pageId, { expectedIdentityUrl, executionId: request.executionId, submittedAt });
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

  async #attachMedia(request, pageId) {
    const media = validateMediaDescriptor(request);
    if (!media) return { mediaHashMatched: true, mediaPreviewConfirmed: true, audienceMatch: true, mediaAttachMs: 0, mediaReadyMs: 0 };
    const fileHash = await sha256File(media.path);
    if (fileHash !== media.sha256) throw Object.assign(new Error("Media hash differs from the approved artifact"), { code: "MEDIA_MISMATCH" });
    if (!await verifyMediaType(media.path, media.type)) throw Object.assign(new Error("Media file type does not match the approved descriptor"), { code: "MEDIA_MISMATCH" });
    const result = await attachLinkedInMedia(this.browser, pageId, media, { timeoutMs: this.mediaTimeoutMs });
    const audience = await this.browser.evaluate(pageId, AUDIENCE_EXPRESSION(request.audience));
    if (audience.dialogCount !== 1 || audience.audienceMatch !== true) throw Object.assign(new Error("LinkedIn audience changed while attaching media"), { code: "TARGET_MISMATCH" });
    return { ...result, audienceMatch: true };
  }
  async #safeClose(pageId, request) {
    await cleanupLinkedInComposer(this.browser, pageId, request.content.sha256);
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
      phaseTimings.mediaControlOpenMs = lifecycleContext.media?.mediaControlOpenMs || 0;
      phaseTimings.uploadTargetDiscoveryMs = lifecycleContext.media?.uploadTargetDiscoveryMs || 0;
      phaseTimings.fileAttachMs = lifecycleContext.media?.fileAttachMs || 0;
      const media = lifecycleContext.media;
      const preSubmitStarted = Date.now();
      const gates = (await this.verifyPreSubmit({ ...lifecycleContext, media })).gates;
      phaseTimings.preSubmitVerifyMs = Date.now() - preSubmitStarted;
      lifecycleContext.gates = gates;
      const submit = findRef(await this.browser.snapshot(pageId), /button\s+["\'](?:post|\u0111\u0103ng b\u00e0i|share)["\']/i);
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
      if (verification.state !== "CONFIRMED") return { ...verification, submitState: "UNKNOWN", startedAt, finishedAt: new Date().toISOString(), gates, computerUseCalls, browserCommands: Math.max(0, (this.browser.browserCommandCount?.() ?? commandStart) - commandStart), retries: 0, durationMs: Date.now() - began, telemetry: phaseTimings, errorClassification: "PLATFORM_ERROR", recoveryClassification: "UNKNOWN" };
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
        uploadFailure: error.uploadFailure || null,
        reasonCode: code.toLowerCase()
      };
    }
  }
}

export const linkedinAdapterExpressions = { target: TARGET_EXPRESSION, audience: AUDIENCE_EXPRESSION, editor: EDITOR_EXPRESSION };
