import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURE_ROOT = path.resolve(process.env.MARKETING_FIXTURE_ROOT || "D:\\build-agentic-AI\\marketing-seeding-fixture");
const fixtureAutomationModule = pathToFileURL(path.join(FIXTURE_ROOT, "src", "automation.mjs")).href;
let adapterPromise;
async function loadFixtureAdapter() { adapterPromise ||= import(fixtureAutomationModule); return adapterPromise; }
function boolEnv(name, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  return value ? ["1", "true", "yes", "on"].includes(value) : fallback;
}
function isFixtureHost(url) { try { return new URL(url).hostname === "fixture.local"; } catch { return false; } }

/** Local fixture worker: prepares a fixture receipt only; it never publishes externally. */
export class FixtureWorkerBridge {
  constructor({ service, endpoint = process.env.CLOAKBROWSER_CDP_URL || "", cdpEnabled = boolEnv("SEEDING_FIXTURE_CDP_ENABLED"), e2eLive = boolEnv("SEEDING_FIXTURE_E2E_LIVE"), enabled = boolEnv("SEEDING_FIXTURE_WORKER"), intervalMs = Number(process.env.SEEDING_FIXTURE_WORKER_INTERVAL_MS || 60_000) } = {}) {
    if (!service) throw new Error("FixtureWorkerBridge requires a service");
    if (!Number.isFinite(intervalMs) || intervalMs < 1_000) throw new Error("SEEDING_FIXTURE_WORKER_INTERVAL_MS must be at least 1000ms");
    this.service = service; this.endpoint = String(endpoint || "").trim(); this.cdpEnabled = cdpEnabled; this.e2eLive = e2eLive; this.enabled = enabled; this.intervalMs = intervalMs;
    this.timer = null; this.running = false; this.lastRunAt = null; this.lastSummary = null; this.lastCdpAttached = false;
  }
  async runOnce() {
    if (!this.enabled) return { enabled: false, processed: 0, skipped: 0 };
    if (this.running) return { enabled: true, skipped: true, reason: "worker_already_running" };
    this.running = true; const processed = [];
    try {
      const { FixtureAutomation, MockPage, attachCloakBrowser } = await loadFixtureAdapter();
      const state = await this.service.store.read();
      const candidates = state.posts.filter((post) => ["draft_ready", "queued", "awaiting_publish"].includes(post.status));
      for (const post of candidates) {
        const contentSha256 = createHash("sha256").update(String(post.content || "")).digest("hex");
        const prior = (state.fixtureAutomationRuns || []).find((run) => run.postId === post.id && run.contentSha256 === contentSha256);
        if (prior) continue;
        const target = state.targets.find((item) => item.id === post.targetId); const targetUrl = target?.url || "https://fixture.local";
        if (this.cdpEnabled && !this.e2eLive && !isFixtureHost(targetUrl)) { const error = new Error("CDP fixture mode only permits fixture.local mock domains"); error.code = "FIXTURE_DOMAIN_GUARD"; throw error; }
        let browser = null;
        try {
          let page = new MockPage();
          if (this.cdpEnabled) { const attached = await attachCloakBrowser({ endpoint: this.endpoint || undefined, launchLocal: !this.endpoint }); browser = attached.browser; page = attached.page; this.lastCdpAttached = true; }
          const result = await new FixtureAutomation({ page }).publishMock({
            id: post.id, platform: target?.channel || "fixture", targetUrl, content: post.content, mediaPath: post.assetPath || null, e2eLive: this.e2eLive,
            selectors: { content: "[contenteditable='true'], textarea, [role='textbox']", media: "input[type='file']" },
            publishSelectors: ["button[type='submit']", "button:has-text('Đăng')", "button:has-text('Post')", "button:has-text('Publish')", "button:has-text('Share')"]
          });
          const receipt = await this.service.recordFixtureAutomation(post.id, { contentSha256, fixturePublicationUrl: result.publicationUrl || null, e2eStatus: result.status && result.status.startsWith("e2e_") ? result.status : null, observedUrl: result.observedUrl || null, selector: result.selector || null, evidence: result.evidence || "Fixture composer prepared; no external side effect was performed", cdpEndpointConfigured: Boolean(this.endpoint), cdpAttached: Boolean(browser), externalSideEffects: false }, "fixture-worker");
          processed.push(receipt);
        } finally { if (browser && typeof browser.disconnect === "function") await browser.disconnect(); else if (browser?.close) await browser.close(); }
      }
      this.lastRunAt = new Date().toISOString(); this.lastSummary = { processed: processed.length, skipped: candidates.length - processed.length };
      return { enabled: true, ...this.lastSummary, results: processed };
    } catch (error) { console.error("[FixtureWorkerBridge Error]:", error); if (error?.code === "FIXTURE_DOMAIN_GUARD") throw error; return { enabled: true, error: error.message }; }
    finally { this.running = false; }
  }
  start() { if (!this.enabled || this.timer) return this.timer; this.timer = setInterval(() => this.runOnce().catch(() => undefined), this.intervalMs); this.timer.unref?.(); return this.timer; }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  runtime() { return { enabled: this.enabled, mode: "local-fixture", e2eLive: this.e2eLive, cdpEndpointConfigured: Boolean(this.endpoint), cdpEnabled: this.cdpEnabled, cdpAttached: this.lastCdpAttached, intervalMs: this.intervalMs, running: this.running, lastRunAt: this.lastRunAt, lastSummary: this.lastSummary }; }
}
