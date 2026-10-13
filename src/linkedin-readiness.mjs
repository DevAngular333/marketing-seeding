import { createHash } from "node:crypto";
import { classifyReadinessError } from "./readiness.mjs";
import { findComposerTrigger, LINKEDIN_FEED_URL_FOR_READINESS } from "./orca-browser-client.mjs";

const CONTEXT_EXPRESSION = (expectedPath) => `(() => {
  const path = location.pathname || '';
  const host = location.hostname || '';
  const expectedPath = ${JSON.stringify(expectedPath)}.replace(/\\/$/, '').toLowerCase() || '/';
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const identityVerified = anchors.some((anchor) => {
    try { const url = new URL(anchor.href, location.href); return url.hostname.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && url.pathname.replace(/\\/$/, '').toLowerCase() === expectedPath; } catch { return false; }
  });
  const pageText = document.body?.innerText || '';
  const securityChallenge = /captcha|security key|passkey|two[- ]step|verify your identity|checkpoint|security challenge|xác minh danh tính|khóa bảo mật/i.test(path + ' ' + pageText.slice(0, 3000));
  const visible = (node) => Boolean(node && node.getClientRects().length);
  const pathSegments = path.toLowerCase().split('/').filter(Boolean);
  const loginRoute = pathSegments[0] === 'login' || (pathSegments[0] === 'uas' && pathSegments[1] === 'login');
  const loginForm = Array.from(document.querySelectorAll('input[name="session_key"], input[name="session_password"]')).some(visible);
  const loginRequired = loginRoute || loginForm;
  const feedReachable = host.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && /\\/feed\\/?$/i.test(path) && Boolean(document.querySelector('main,#main-content'));
  const authenticatedNavigation = Array.from(document.querySelectorAll('nav,[role="navigation"]')).some(visible);
  const composerTrigger = Array.from(document.querySelectorAll('button,[role="button"]')).some((node) => visible(node) && [node.getAttribute('aria-label') || '', node.innerText || ''].some((label) => /^(?:start a post|bắt đầu bài đăng)$/i.test(label.trim())));
  const sessionAuthenticated = !loginRequired && feedReachable && authenticatedNavigation && composerTrigger;
  return { linkedinDomain: host.toLowerCase().replace(/^www\\./, '') === 'linkedin.com', loginRequired, securityChallenge, sessionAuthenticated, authenticatedNavigation, composerTrigger, identityVerified, feedReachable };
})()`;

const COMPOSER_EXPRESSION = `(() => {
  const visible = (node) => Boolean(node && node.getClientRects().length);
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter(visible);
  const editors = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('[contenteditable="true"],[role="textbox"]')).filter(visible));
  const controls = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('button,[role="button"],input,[role="combobox"]')).filter(visible).map((node) => ({
    ariaLabel: (node.getAttribute('aria-label') || '').trim(),
    text: (node.innerText || '').replace(/\\s+/g, ' ').trim(),
    placeholder: (node.getAttribute('placeholder') || '').trim(),
    role: (node.getAttribute('role') || '').trim().toLowerCase(),
    tag: (node.tagName || '').toLowerCase()
  })));
  const fields = (control) => [control.ariaLabel, control.text, control.placeholder].filter(Boolean);
  const has = (pattern) => controls.some((control) => fields(control).some((field) => pattern.test(field)));
  const advertisingControls = controls.filter((control) => fields(control).some((field) => /budget|billing|campaign|ad account|boost|sponsor|ngân sách|thanh toán|chiến dịch|tài khoản quảng cáo|quảng bá/i.test(field))).length;
  const path = location.pathname.replace(/\\/$/, '').toLowerCase() || '/';
  const route = path === '/sharing/compose';
  const feedWithComposerSurface = /\\/feed$/i.test(path) && dialogs.length === 1;
  const routeCompatible = route || feedWithComposerSurface;
  const audience = has(/post to|audience|mọi người|đăng cho|anyone|everyone/i);
  const postButton = controls.some((control) => control.tag === 'button' && fields(control).some((field) => /^(đăng bài|post|publish)(?:$|[\\s.…])/i.test(field)));
  const mediaControl = has(/media|photo|video|phương tiện truyền thông|ảnh/i);
  const closeControl = has(/close|dismiss|cancel|hủy|đóng/i);
  const linkedinDomain = /(^|\\.)linkedin\\.com$/i.test(location.hostname);
  const confirmed = linkedinDomain && routeCompatible && dialogs.length === 1 && editors.length === 1 && audience && postButton && advertisingControls === 0;
  const signalCount = [routeCompatible, dialogs.length === 1, editors.length === 1, audience, postButton, mediaControl, closeControl].filter(Boolean).length;
  return { linkedinDomain, route, routeCompatible, dialogCount: dialogs.length, editorCount: editors.length, audience, postButton, mediaControl, closeControl, advertisingControls, signalCount, confirmed };
})()`;

function linkedInPath(value) {
  const url = new URL(value);
  return url.pathname.replace(/\/$/, "").toLowerCase() || "/";
}

export function classifyLinkedInComposerState(result) {
  const routeCompatible = result?.routeCompatible === true || result?.route === true;
  if (result?.confirmed === true || (result?.linkedinDomain === true && routeCompatible && result?.dialogCount === 1 && result?.editorCount === 1 && result?.audience === true && result?.postButton === true && result?.advertisingControls === 0)) return "CONFIRMED";
  if (result?.dialogCount === 0 && result?.route !== true && result?.editorCount === 0) return "NOT_COMPOSER";
  const composerEvidence = result?.editorCount > 0 || result?.audience === true || result?.postButton === true || result?.mediaControl === true;
  if (result?.route === true || composerEvidence) return "UNKNOWN";
  return "NOT_COMPOSER";
}

async function sampleComposerState(browser, pageId, timeoutMs) {
  const started = Date.now();
  let state;
  do {
    state = await browser.evaluate(pageId, COMPOSER_EXPRESSION);
    if (classifyLinkedInComposerState(state) === "CONFIRMED") return state;
    if (Date.now() - started >= timeoutMs) return state;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() - started < timeoutMs);
  return state;
}

async function waitForComposer(browser, pageId, timeoutMs = 8_000) {
  const started = Date.now();
  if (typeof browser.waitForExpression === "function") {
    const expression = `(${COMPOSER_EXPRESSION}).confirmed === true`;
    await browser.waitForExpression(pageId, expression, timeoutMs).catch(() => undefined);
    const state = await browser.evaluate(pageId, COMPOSER_EXPRESSION);
    if (classifyLinkedInComposerState(state) === "CONFIRMED") return state;
    const remaining = Math.max(0, timeoutMs - (Date.now() - started));
    return remaining ? sampleComposerState(browser, pageId, remaining) : state;
  }
  return sampleComposerState(browser, pageId, timeoutMs);
}

const COMPOSER_TRIGGER_DOM_CLICK = `(() => {
  const visible = (node) => Boolean(node && node.getClientRects().length);
  const host = location.hostname.toLowerCase().replace(/^www\\./, '');
  const path = location.pathname.replace(/\\/$/, '').toLowerCase() || '/';
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter(visible);
  const candidates = Array.from(document.querySelectorAll('button,[role="button"]')).filter((node) => {
    if (!visible(node) || node.disabled || node.getAttribute('aria-disabled') === 'true') return false;
    const labels = [node.getAttribute('aria-label') || '', node.innerText || ''].map((value) => value.trim());
    return labels.some((label) => /^(?:start a post|bắt đầu bài đăng)$/i.test(label));
  });
  if (host !== 'linkedin.com' || path !== '/feed' || dialogs.length !== 0 || candidates.length !== 1) {
    return { clicked: false, reason: 'composer_trigger_fallback_precondition_failed' };
  }
  candidates[0].click();
  return { clicked: true };
})()`;

export async function openLinkedInComposer(browser, pageId, trigger, { mountTimeoutMs = 8_000 } = {}) {
  await browser.click(pageId, trigger);
  let state = await browser.evaluate(pageId, COMPOSER_EXPRESSION);
  if (classifyLinkedInComposerState(state) === "CONFIRMED") return { state, domFallbackUsed: false };

  // If a dialog/route has started mounting, wait for that same surface. Never
  // click again while an ambiguous or partial composer is present.
  const mounting = state?.routeCompatible === true || state?.dialogCount > 0 || state?.editorCount > 0;
  if (mounting) return { state: await waitForComposer(browser, pageId, mountTimeoutMs), domFallbackUsed: false };

  // Some ORCA hosts acknowledge a semantic click on this custom LinkedIn DIV
  // without dispatching a DOM event. A narrowly-scoped DOM click is allowed only
  // after proving the feed is still open and the unique composer trigger remains.
  const fallback = await browser.evaluate(pageId, COMPOSER_TRIGGER_DOM_CLICK);
  if (fallback?.clicked !== true) return { state, domFallbackUsed: false };
  state = await waitForComposer(browser, pageId, mountTimeoutMs);
  return { state, domFallbackUsed: true };
}

function safeEvidence(value) {
  return `linkedin-readiness:${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)}`;
}

export class LinkedInReadinessProvider {
  constructor(browser, { ttlMs } = {}) {
    if (!browser) throw new Error("LinkedIn readiness requires an ORCA browser adapter");
    this.browser = browser;
    this.ttlMs = ttlMs;
  }

  async checkReadiness(context) {
    const checkedAt = new Date();
    try {
      const identityReference = context.identityReference || context.expectedIdentityUrl;
      if (!context.profileId || !identityReference) {
        return { state: "HUMAN_REQUIRED", reasonCode: "account_identity_not_configured", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }
      const profile = (await this.browser.listProfiles()).find((item) => (typeof item === "string" ? item : item.id || item.profileId) === context.profileId);
      if (!profile) {
        return { state: "HUMAN_REQUIRED", reasonCode: "expected_profile_missing", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }

      const tabs = (await this.browser.listTabs()).filter((tab) => {
        const profileId = typeof tab.profile === "string" ? tab.profile : tab.profile?.id || tab.profile?.profileId || tab.profileId;
        return profileId === context.profileId;
      });
      let pageId;
      if (tabs.length === 0) pageId = await this.browser.createTab(context.profileId);
      else {
        const linkedinTabs = tabs.filter((tab) => /(^|\.)linkedin\.com$/i.test(new URL(tab.url || "about:blank").hostname));
        if (linkedinTabs.length > 1) {
          return { state: "HUMAN_REQUIRED", reasonCode: "profile_has_ambiguous_linkedin_tabs", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
        }
        const selected = linkedinTabs[0] || (tabs.length === 1 ? tabs[0] : null);
        if (!selected) return { state: "HUMAN_REQUIRED", reasonCode: "profile_tab_identity_ambiguous", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
        pageId = selected.browserPageId || selected.pageId || selected.id;
      }
      if (!pageId) return { state: "UNKNOWN", reasonCode: "browser_page_identity_missing", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };

      let tab = await this.browser.showTab(pageId);
      if (tab.profileId !== context.profileId) {
        return { state: "HUMAN_REQUIRED", reasonCode: "browser_profile_mismatch", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }
      if (!/(^|\.)linkedin\.com$/i.test(new URL(tab.url || "about:blank").hostname) || !/\/feed\/?$/i.test(new URL(tab.url).pathname)) {
        await this.browser.navigate(pageId, LINKEDIN_FEED_URL_FOR_READINESS);
        await this.browser.waitForFeed(pageId);
        tab = await this.browser.showTab(pageId);
      }

      let contextState = await this.browser.evaluate(pageId, CONTEXT_EXPRESSION(linkedInPath(identityReference)));
      if (contextState.securityChallenge) {
        return { state: "HUMAN_REQUIRED", reasonCode: "security_challenge", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }
      if (contextState.loginRequired || !contextState.sessionAuthenticated) {
        if (contextState.loginRequired) {
          return { state: "HUMAN_REQUIRED", reasonCode: "authentication_required", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
        }
        return { state: "UNKNOWN", reasonCode: "linkedin_auth_state_ambiguous", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };
      }
      if (!contextState.identityVerified) {
        return { state: "HUMAN_REQUIRED", reasonCode: "account_identity_mismatch", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }
      if (!contextState.feedReachable) {
        return { state: "UNKNOWN", reasonCode: "linkedin_feed_unavailable", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };
      }

      const snapshot = await this.browser.snapshot(pageId);
      const trigger = findComposerTrigger(snapshot);
      if (!trigger) return { state: "BLOCKED", reasonCode: "composer_trigger_missing", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };
      const opened = await openLinkedInComposer(this.browser, pageId, trigger);
      const composer = opened.state;
      const composerClassification = classifyLinkedInComposerState(composer);
      if (composerClassification !== "CONFIRMED") {
        await this.browser.pressEscape(pageId).catch(() => undefined);
        return {
          state: composerClassification === "UNKNOWN" ? "UNKNOWN" : "BLOCKED",
          reasonCode: composerClassification === "UNKNOWN" ? "composer_state_incomplete" : "composer_not_confirmed",
          retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString()
        };
      }
      await this.browser.pressEscape(pageId);
      await this.browser.waitForFeed(pageId);
      contextState = await this.browser.evaluate(pageId, CONTEXT_EXPRESSION(linkedInPath(identityReference)));
      const composerClosed = contextState.feedReachable && contextState.identityVerified && contextState.sessionAuthenticated;
      if (!composerClosed) return { state: "UNKNOWN", reasonCode: "composer_close_unverified", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };
      const finishedAt = new Date();
      return {
        state: "READY",
        checkedAt: checkedAt.toISOString(),
        expiresAt: new Date(checkedAt.getTime() + (this.ttlMs || 5 * 60 * 1000)).toISOString(),
        reasonCode: "linkedin_session_target_composer_verified",
        capabilities: { sessionAuthenticated: true, identityVerified: true, feedReachable: true, composerAvailable: true, composerCloseable: true },
        evidenceReference: safeEvidence({ platform: context.platform, profileId: context.profileId, targetId: context.targetId, checkedAt: checkedAt.toISOString(), finishedAt: finishedAt.toISOString() }),
        retryable: false,
        recoveryClassification: "NONE"
      };
    } catch (error) {
      return { ...classifyReadinessError(error), checkedAt: checkedAt.toISOString() };
    }
  }
}

export function linkedInReadinessExpressions() {
  return { context: CONTEXT_EXPRESSION, composer: COMPOSER_EXPRESSION };
}
