import { createHash } from "node:crypto";

const BRIDGE_VERSION = 1;
const MAX_ENVELOPE_BYTES = 120_000;
const MAX_TEXT = 160;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const FORBIDDEN_KEY = /(?:credential|password|secret|token|cookie|session|browser|profile|selector|cdp|webdriver|playwright|puppeteer|orca|jev|submit|publish|execution|grant|lease|authorization|approval|dispatch|postid|permalink)/i;
const FORBIDDEN_VALUE = /(?:bearer\s+|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,}|cookie\s*=|session[_ -]?token|cdp|webdriver|playwright|puppeteer)/i;

function requiredText(value, label, max = MAX_TEXT) {
  if (typeof value !== "string") throw new Error(`${label} must be a bounded safe string`);
  const text = value.trim();
  if (!text || text.length > max || FORBIDDEN_VALUE.test(text)) throw new Error(`${label} must be a bounded safe string`);
  return text;
}

function assertSafeEnvelopeValue(value, path = "envelope", seen = new Set(), boundedStrings = true) {
  if (value && typeof value === "object") {
    if (seen.has(value)) throw new Error("handoff envelope must be acyclic");
    seen.add(value);
    if (Array.isArray(value)) value.forEach((item, index) => assertSafeEnvelopeValue(item, `${path}[${index}]`, seen, boundedStrings));
    else for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) throw new Error(`handoff envelope field is forbidden: ${path}.${key}`);
      assertSafeEnvelopeValue(child, `${path}.${key}`, seen, boundedStrings && key !== "payload");
    }
    seen.delete(value);
  } else if (typeof value === "string" && ((boundedStrings && value.length > MAX_TEXT) || FORBIDDEN_VALUE.test(value))) {
    throw new Error(`handoff envelope value is forbidden or oversized: ${path}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function envelopeHash(envelope) {
  const { envelopeHash: _ignored, ...identity } = envelope;
  return createHash("sha256").update(stable(identity)).digest("hex");
}

function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }

/** Construct a bounded upstream envelope for a local producer or fixture. */
export function createSystemAgenticHandoffEnvelope(payload, { sourceVersion = "1", emittedAt = new Date().toISOString() } = {}) {
  if (!isObject(payload)) throw new Error("handoff payload must be an object");
  const campaignId = requiredText(payload.campaignId, "handoff payload campaignId");
  const envelope = {
    bridgeVersion: BRIDGE_VERSION,
    source: { system: "SYSTEM_AGENTIC_AI", version: requiredText(sourceVersion, "handoff source version") },
    emittedAt: requiredTimestamp(emittedAt),
    mode: "DRY_RUN",
    campaignId,
    payload: { ...payload, mode: "DRY_RUN", campaignId }
  };
  const withHash = { ...envelope, envelopeHash: envelopeHash(envelope) };
  validateSystemAgenticHandoffEnvelope(withHash);
  return withHash;
}

function requiredTimestamp(value) {
  const timestamp = requiredText(value, "handoff emittedAt", 40);
  if (!ISO_TIMESTAMP_RE.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error("handoff emittedAt must be a UTC ISO timestamp");
  return timestamp;
}

/** Validate only the provider-neutral bridge envelope; payload validation stays downstream. */
export function validateSystemAgenticHandoffEnvelope(input = {}) {
  let serialized;
  try { serialized = JSON.stringify(input); } catch { throw new Error("handoff envelope must be JSON serializable"); }
  if (typeof serialized !== "string") throw new Error("handoff envelope must be a JSON object");
  if (Buffer.byteLength(serialized, "utf8") > MAX_ENVELOPE_BYTES) throw new Error(`handoff envelope exceeds ${MAX_ENVELOPE_BYTES} bytes`);
  if (!isObject(input)) throw new Error("handoff envelope must be an object");
  assertSafeEnvelopeValue(input);
  if (input.bridgeVersion !== BRIDGE_VERSION) throw new Error(`unsupported handoff bridgeVersion: ${String(input.bridgeVersion)}`);
  if (!isObject(input.source) || input.source.system !== "SYSTEM_AGENTIC_AI") throw new Error("handoff source system must be SYSTEM_AGENTIC_AI");
  requiredText(input.source.version, "handoff source version");
  requiredTimestamp(input.emittedAt);
  if (input.mode !== "DRY_RUN") throw new Error("only explicit DRY_RUN handoff envelopes are accepted");
  const campaignId = requiredText(input.campaignId, "handoff envelope campaignId");
  if (!isObject(input.payload)) throw new Error("handoff envelope payload is required");
  if (input.payload.mode !== "DRY_RUN") throw new Error("handoff payload must be DRY_RUN");
  if (String(input.payload.campaignId || "") !== campaignId) throw new Error("handoff envelope/payload campaignId mismatch");
  if (input.payload.handoffVersion !== 1) throw new Error("handoff payload must use handoffVersion 1");
  if (input.payload.source !== undefined) throw new Error("handoff payload must not carry a second source envelope");
  const computedHash = envelopeHash(input);
  if (input.envelopeHash !== undefined && (!/^[a-f0-9]{64}$/.test(String(input.envelopeHash)) || input.envelopeHash !== computedHash)) {
    throw new Error("handoff envelope hash mismatch");
  }
  return { ok: true, campaignId, envelopeHash: computedHash, bridgeVersion: BRIDGE_VERSION, source: { system: "SYSTEM_AGENTIC_AI", version: input.source.version }, emittedAt: input.emittedAt };
}

/** Consume one envelope through the existing campaign-owned DRY_RUN seam. */
export async function consumeSystemAgenticHandoff(service, input, actor = "system-agentic-bridge", { expectedCampaignId } = {}) {
  if (!service || typeof service.attachDistributionHandoff !== "function") throw new Error("handoff bridge requires a SeedingService consumer");
  const bridge = validateSystemAgenticHandoffEnvelope(input);
  if (expectedCampaignId !== undefined && String(expectedCampaignId) !== bridge.campaignId) throw new Error("handoff envelope campaignId does not match route");
  const payload = {
    ...input.payload,
    source: { system: bridge.source.system, version: bridge.source.version, envelopeHash: bridge.envelopeHash, emittedAt: bridge.emittedAt }
  };
  const result = await service.attachDistributionHandoff(bridge.campaignId, payload, actor);
  return { bridge, ...result };
}

export const SYSTEM_AGENTIC_HANDOFF_BRIDGE = Object.freeze({ version: BRIDGE_VERSION, maxEnvelopeBytes: MAX_ENVELOPE_BYTES });
