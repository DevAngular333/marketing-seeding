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
  const loginRequired = /\\/(?:login|checkpoint)\\/?$/i.test(path) || Boolean(document.querySelector('input[name="session_key"], input[name="session_password"]'));
  const sessionAuthenticated = !loginRequired && Boolean(document.querySelector('#global-nav,[data-control-name="identity_welcome_message"],.global-nav'));
  const feedReachable = host.toLowerCase().replace(/^www\\./, '') === 'linkedin.com' && /\\/feed\\/?$/i.test(path) && Boolean(document.querySelector('main,#main-content'));
  return { linkedinDomain: host.toLowerCase().replace(/^www\\./, '') === 'linkedin.com', loginRequired, securityChallenge, sessionAuthenticated, identityVerified, feedReachable };
})()`;

const COMPOSER_EXPRESSION = `(() => {
  const visible = (node) => Boolean(node && node.getClientRects().length);
  const dialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"]')).filter(visible);
  const editors = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('[contenteditable="true"],[role="textbox"]')).filter(visible));
  const labels = dialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('button,[role="button"],input,[role="combobox"]')).filter(visible).map((node) => [node.getAttribute('aria-label') || '', node.innerText || '', node.getAttribute('placeholder') || ''].join(' ')));
  const has = (pattern) => labels.some((label) => pattern.test(label));
  const advertisingControls = labels.filter((label) => /budget|billing|campaign|ad account|boost|sponsor|ngân sách|thanh toán|chiến dịch|tài khoản quảng cáo|quảng bá/i.test(label)).length;
  const route = location.pathname.replace(/\\/$/, '').toLowerCase() === '/sharing/compose';
  const audience = has(/post to|audience|mọi người|đăng cho|anyone|everyone/i);
  const postButton = has(/^(đăng bài|post|publish)$/i);
  const mediaControl = has(/media|photo|video|phương tiện truyền thông|ảnh|video/i);
  return { linkedinDomain: /(^|\\.)linkedin\\.com$/i.test(location.hostname), route, dialogCount: dialogs.length, editorCount: editors.length, audience, postButton, mediaControl, advertisingControls };
})()`;

function linkedInPath(value) {
  const url = new URL(value);
  return url.pathname.replace(/\/$/, "").toLowerCase() || "/";
}

function confirmedComposer(result) {
  return result?.linkedinDomain === true && result.route === true && result.dialogCount === 1 && result.editorCount === 1 &&
    result.audience === true && result.postButton === true && result.mediaControl === true && result.advertisingControls === 0;
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
      if (!context.profileId || !context.expectedIdentityUrl) {
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

      let contextState = await this.browser.evaluate(pageId, CONTEXT_EXPRESSION(linkedInPath(context.expectedIdentityUrl)));
      if (contextState.securityChallenge) {
        return { state: "HUMAN_REQUIRED", reasonCode: "security_challenge", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
      }
      if (contextState.loginRequired || !contextState.sessionAuthenticated) {
        return { state: "HUMAN_REQUIRED", reasonCode: "authentication_required", retryable: false, recoveryClassification: "HUMAN_REQUIRED", checkedAt: checkedAt.toISOString() };
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
      await this.browser.click(pageId, trigger);
      const composer = await this.browser.evaluate(pageId, COMPOSER_EXPRESSION);
      if (!confirmedComposer(composer)) {
        await this.browser.pressEscape(pageId).catch(() => undefined);
        return { state: "BLOCKED", reasonCode: "composer_not_confirmed", retryable: true, recoveryClassification: "RECOVERABLE", checkedAt: checkedAt.toISOString() };
      }
      await this.browser.pressEscape(pageId);
      await this.browser.waitForFeed(pageId);
      contextState = await this.browser.evaluate(pageId, CONTEXT_EXPRESSION(linkedInPath(context.expectedIdentityUrl)));
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
