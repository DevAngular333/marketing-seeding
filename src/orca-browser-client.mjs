import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LINKEDIN_FEED_URL = "https://www.linkedin.com/feed/";

function resultOf(payload) {
  return payload?.result ?? payload;
}

function parsePayload(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("ORCA returned non-JSON output"), { code: "ORCA_PROTOCOL_ERROR" }); }
}

function normalizeProfileId(value) {
  return typeof value === "string" ? value : value?.id || value?.profileId || "";
}

function profileIdFromTab(tab) {
  return typeof tab?.profile === "string" ? tab.profile : tab?.profile?.id || tab?.profile?.profileId || tab?.profileId || "";
}

function pageIdFrom(value) {
  return value?.browserPageId || value?.pageId || value?.id || value?.tab?.browserPageId || value?.tab?.pageId || value?.tab?.id || "";
}

export class OrcaCliClient {
  constructor({ executable = process.env.ORCA_CLI || "orca", timeoutMs = 12_000, worktree = process.env.SEEDING_ORCA_WORKTREE || "current", providerVersion = process.env.ORCA_VERSION || null } = {}) {
    this.executable = executable;
    this.timeoutMs = timeoutMs;
    this.worktree = worktree;
    this.runtimeVersion = providerVersion ? String(providerVersion) : null;
    this.observedRuntimeVersion = null;
    this.runtimeVersionProbeCount = 0;
    this.browserCommands = 0;
  }

  browserCommandCount() { return this.browserCommands; }

  runtimeIdentity() {
    return {
      provider: "orca",
      providerVersion: this.runtimeVersion,
      observedProviderVersion: this.observedRuntimeVersion,
      executable: this.executable,
      worktree: this.worktree
    };
  }

  /**
   * Read the executable's version without touching a browser tab. The
   * configured version remains the certification pin; an observed version is
   * never promoted into that pin automatically.
   */
  async probeRuntimeVersion() {
    this.runtimeVersionProbeCount += 1;
    try {
      const { stdout, stderr } = await execFileAsync(this.executable, ["--version"], {
        windowsHide: true,
        timeout: this.timeoutMs,
        maxBuffer: 64_000
      });
      const output = `${String(stdout || "")}\n${String(stderr || "")}`;
      const match = output.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/);
      if (!match) throw Object.assign(new Error("ORCA executable version is unavailable"), { code: "ORCA_RUNTIME_VERSION_UNKNOWN" });
      this.observedRuntimeVersion = match[0];
      return this.observedRuntimeVersion;
    } catch (error) {
      if (error.code === "ENOENT") throw Object.assign(new Error("ORCA CLI is unavailable"), { code: "ORCA_RUNTIME_UNAVAILABLE" });
      if (error.killed || error.code === "ETIMEDOUT") throw Object.assign(new Error("ORCA runtime version probe timed out"), { code: "PROVIDER_TIMEOUT" });
      if (error.code === "ORCA_RUNTIME_VERSION_UNKNOWN") throw error;
      throw Object.assign(new Error("ORCA runtime version probe failed"), { code: "ORCA_RUNTIME_VERSION_UNKNOWN" });
    }
  }

  /**
   * Read the connected Orca daemon/runtime identity without touching a tab.
   * The executable version alone is insufficient when an older daemon is
   * still resident on the host; status is the read-only observation of the
   * runtime that will receive browser commands.
   */
  async probeConnectedRuntimeVersion() {
    this.runtimeVersionProbeCount += 1;
    try {
      const { stdout, stderr } = await execFileAsync(this.executable, ["status", "--json"], {
        windowsHide: true,
        timeout: this.timeoutMs,
        maxBuffer: 256_000
      });
      const payload = parsePayload(String(stdout || "").trim() || String(stderr || "").trim());
      const result = payload.result ?? payload;
      const observed = result?.runtime?.appVersion || result?.appVersion || result?.app?.version || null;
      if (!observed || typeof observed !== "string") {
        throw Object.assign(new Error("Connected ORCA runtime version is unavailable"), { code: "ORCA_RUNTIME_VERSION_UNKNOWN" });
      }
      return String(observed).trim();
    } catch (error) {
      if (error.code === "ENOENT") throw Object.assign(new Error("ORCA CLI is unavailable"), { code: "ORCA_RUNTIME_UNAVAILABLE" });
      if (error.killed || error.code === "ETIMEDOUT") throw Object.assign(new Error("Connected ORCA runtime status probe timed out"), { code: "PROVIDER_TIMEOUT" });
      if (["ORCA_RUNTIME_VERSION_UNKNOWN", "ORCA_RUNTIME_UNAVAILABLE", "PROVIDER_TIMEOUT"].includes(error.code)) throw error;
      throw Object.assign(new Error("Connected ORCA runtime status probe failed"), { code: "ORCA_RUNTIME_VERSION_UNKNOWN" });
    }
  }

  /**
   * Final-submit guard. A live transport must be explicitly pinned to the
   * certified executable version and the read-only probe must match it.
   */
  async assertRuntimeVersion({ expectedVersion = this.runtimeVersion } = {}) {
    const expected = String(expectedVersion || "").trim();
    if (!expected) throw Object.assign(new Error("ORCA runtime version is not pinned for final submit"), { code: "ORCA_RUNTIME_VERSION_UNPINNED" });
    const observed = await this.probeRuntimeVersion();
    if (observed !== expected) {
      throw Object.assign(new Error("ORCA runtime version does not match the certification pin"), {
        code: "ORCA_RUNTIME_VERSION_MISMATCH",
        expectedVersion: expected,
        observedVersion: observed
      });
    }
    const connected = await this.probeConnectedRuntimeVersion();
    if (connected !== expected) {
      throw Object.assign(new Error("Connected ORCA runtime version does not match the certification pin"), {
        code: "ORCA_CONNECTED_RUNTIME_VERSION_MISMATCH",
        expectedVersion: expected,
        observedVersion: connected
      });
    }
    this.observedRuntimeVersion = connected;
    return { expectedVersion: expected, observedVersion: observed, connectedRuntimeVersion: connected, executable: this.executable };
  }

  async #run(args) {
    this.browserCommands += 1;
    try {
      const { stdout } = await execFileAsync(this.executable, [...args, "--json"], {
        windowsHide: true,
        timeout: this.timeoutMs,
        maxBuffer: 1_000_000
      });
      const payload = parsePayload(stdout);
      if (payload.ok === false) throw Object.assign(new Error("ORCA browser command was rejected"), { code: "ORCA_COMMAND_FAILED" });
      return resultOf(payload);
    } catch (error) {
      if (error.code === "ENOENT") throw Object.assign(new Error("ORCA CLI is unavailable"), { code: "ORCA_RUNTIME_UNAVAILABLE" });
      if (error.killed || error.code === "ETIMEDOUT") throw Object.assign(new Error("ORCA browser command timed out"), { code: "PROVIDER_TIMEOUT" });
      if (error.code && !["ORCA_COMMAND_FAILED", "ORCA_PROTOCOL_ERROR"].includes(error.code)) throw error;
      throw Object.assign(new Error(error.code === "ORCA_PROTOCOL_ERROR" ? error.message : "ORCA browser command failed"), { code: error.code || "ORCA_COMMAND_FAILED" });
    }
  }

  async listProfiles() {
    const result = await this.#run(["tab", "profile", "list"]);
    return Array.isArray(result) ? result : result.profiles || result.items || [];
  }

  async listTabs() {
    const result = await this.#run(["tab", "list", "--show-profile", "--worktree", this.worktree]);
    return Array.isArray(result) ? result : result.tabs || result.items || [];
  }

  async createTab(profileId) {
    const result = await this.#run(["tab", "create", "--url", LINKEDIN_FEED_URL, "--profile", profileId, "--worktree", this.worktree]);
    const pageId = pageIdFrom(result);
    if (!pageId) throw Object.assign(new Error("ORCA did not return a browser page identity"), { code: "ORCA_PROTOCOL_ERROR" });
    return pageId;
  }

  async showTab(pageId) {
    const result = await this.#run(["tab", "show", "--page", pageId, "--worktree", this.worktree]);
    const tab = result.tab || result;
    return { pageId: pageIdFrom(tab) || pageId, profileId: profileIdFromTab(tab), url: String(tab.url || "") };
  }

  async navigate(pageId, url) {
    await this.#run(["goto", "--url", url, "--page", pageId, "--worktree", this.worktree]);
  }

  async snapshot(pageId) {
    const result = await this.#run(["snapshot", "--page", pageId, "--worktree", this.worktree]);
    return String(result.snapshot || result.text || "");
  }

  async evaluate(pageId, expression) {
    const result = await this.#run(["eval", "--expression", expression, "--page", pageId, "--worktree", this.worktree]);
    const raw = result.result ?? result.value ?? result;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { throw Object.assign(new Error("ORCA evaluation returned an invalid result"), { code: "ORCA_PROTOCOL_ERROR" }); }
    }
    return raw;
  }

  async click(pageId, element, { validate, onProviderCallStarted } = {}) {
    // The optional validator runs immediately before the single transport
    // command. It proves only that the target is still safe to address; the
    // command receipt remains separate from control activation.
    const preflight = typeof validate === "function" ? await validate() : null;
    // This callback is deliberately emitted only after the final validation
    // has passed and immediately before the provider command is sent. A
    // validation failure therefore remains distinguishable from a provider
    // command whose outcome is unknown after it started.
    const providerCallStartedAt = new Date().toISOString();
    onProviderCallStarted?.(providerCallStartedAt);
    const startedAt = providerCallStartedAt;
    const result = await this.#run(["click", "--element", element, "--page", pageId, "--worktree", this.worktree]);
    const completedAt = new Date().toISOString();
    return {
      status: "COMMAND_COMPLETED",
      transport: "orca-cli-browser-click",
      elementRef: String(element),
      startedAt,
      completedAt,
      providerCallStarted: true,
      providerCallStartedAt,
      preflight,
      providerResult: result && typeof result === "object" ? {
        clicked: result.clicked ? String(result.clicked).slice(0, 100) : null
      } : null
    };
  }

  async mouseMove(pageId, x, y) {
    return this.#run(["mouse", "move", "--x", String(Math.round(x)), "--y", String(Math.round(y)), "--page", pageId, "--worktree", this.worktree]);
  }

  async mouseDown(pageId, button = "left") {
    return this.#run(["mouse", "down", "--button", button, "--page", pageId, "--worktree", this.worktree]);
  }

  async mouseUp(pageId, button = "left") {
    return this.#run(["mouse", "up", "--button", button, "--page", pageId, "--worktree", this.worktree]);
  }

  async fill(pageId, element, value) {
    await this.#run(["fill", "--element", element, "--value", String(value), "--page", pageId, "--worktree", this.worktree]);
  }

  async upload(pageId, element, filePath) {
    await this.#run(["upload", "--element", element, "--files", filePath, "--page", pageId, "--worktree", this.worktree]);
  }

  async uploadSelector(pageId, selector, filePath) {
    const quote = (value) => `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
    const command = `upload ${quote(selector)} ${quote(filePath)} --json`;
    await this.#run(["exec", "--command", command, "--page", pageId, "--worktree", this.worktree]);
  }

  async keypress(pageId, key) {
    await this.#run(["keypress", "--key", key, "--page", pageId, "--worktree", this.worktree]);
  }

  async pressEscape(pageId) {
    await this.#run(["keypress", "--key", "Escape", "--page", pageId, "--worktree", this.worktree]);
  }

  async waitForFeed(pageId) {
    await this.#run(["wait", "--url", "https://www.linkedin.com/feed/", "--timeout", "10000", "--page", pageId, "--worktree", this.worktree]);
  }

  async waitForUrl(pageId, url, timeoutMs = 10_000) {
    const parsed = new URL(url);
    await this.#run(["wait", "--url", `${parsed.origin}${parsed.pathname}`, "--timeout", String(timeoutMs), "--page", pageId, "--worktree", this.worktree]);
  }

  async waitForExpression(pageId, expression, timeoutMs = 8_000) {
    await this.#run(["wait", "--fn", expression, "--timeout", String(timeoutMs), "--page", pageId, "--worktree", this.worktree]);
  }
}

export function findComposerTrigger(snapshot) {
  const matches = [...String(snapshot || "").matchAll(/^\s*-\s+button\s+"(?:Bắt đầu bài đăng|Start a post)"\s+\[ref=([^\]]+)\]/gim)];
  if (matches.length !== 1) return null;
  return matches[0][1];
}

export const LINKEDIN_FEED_URL_FOR_READINESS = LINKEDIN_FEED_URL;
