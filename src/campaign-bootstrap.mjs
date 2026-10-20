import path from "node:path";
import { createHash } from "node:crypto";

const MAX_AUDIENCE_ITEMS = 32;
const MAX_AUDIENCE_ITEM_LENGTH = 160;
const MAX_REFERENCE_LENGTH = 200;
const MAX_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function text(value, label, max = 500) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return normalized;
}

function safeSlug(value, fallback = "product") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 96);
  return slug || fallback;
}

/** Normalize the human-facing audience policy into one stable serialization. */
export function normalizeBootstrapAudience(value = []) {
  const source = Array.isArray(value) ? value : [value];
  const rows = [...new Set(source
    .flatMap((item) => typeof item === "string" ? item.split(",") : [item])
    .map((item) => text(item, "audience item", MAX_AUDIENCE_ITEM_LENGTH).toLowerCase())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  if (!rows.length) throw new Error("At least one audience segment is required");
  if (rows.length > MAX_AUDIENCE_ITEMS) throw new Error(`Audience supports at most ${MAX_AUDIENCE_ITEMS} segments`);
  return rows;
}

export function canonicalAudienceSerialization(value = []) {
  return JSON.stringify(normalizeBootstrapAudience(value));
}

/** Derive stable campaign/product identities from a canonical repository and brief. */
export function deriveBootstrapIdentity({ productRepo, name, objective, audience = [], platform = "linkedin", authorizationReference } = {}) {
  const repository = text(productRepo, "productRepo", 2_000);
  const productId = safeSlug(path.basename(repository));
  const campaignName = text(name || `${productId} distribution`, "campaign name", 240);
  const campaignObjective = text(objective || `Distribute ${productId} with verified evidence`, "campaign objective", 1_000);
  const reference = text(authorizationReference, "authorizationReference", MAX_REFERENCE_LENGTH);
  const canonicalAudience = canonicalAudienceSerialization(audience);
  const identity = digest({ productRepo: repository, productId, name: campaignName, objective: campaignObjective, platform: String(platform).toLowerCase(), audience: canonicalAudience });
  return {
    productId,
    campaignName,
    campaignObjective,
    audience: JSON.parse(canonicalAudience),
    campaignId: `campaign-bootstrap-${identity.slice(0, 32)}`,
    identity,
    authorizationReference: reference
  };
}

function parseTimestamp(value, label) {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) throw new Error(`${label} must be a valid timestamp`);
  return at;
}

/**
 * Derive a bounded UTC schedule from a high-level campaign policy. Explicit
 * timestamps are accepted only as policy input; otherwise the window is
 * derived from the bootstrap observation time and validityHours.
 */
export function deriveBootstrapSchedule({ now = new Date(), validFrom, validUntil, validityHours = 24, timezone = "UTC", quota = 1, concurrency = 1 } = {}) {
  const observed = parseTimestamp(now, "bootstrap now");
  // Minute precision gives repeated bootstrap calls a stable identity while
  // keeping the derived window current and bounded.
  const from = validFrom === undefined ? new Date(Math.floor(observed.getTime() / 60_000) * 60_000) : parseTimestamp(validFrom, "validFrom");
  const until = validUntil === undefined
    ? new Date(from.getTime() + (Number(validityHours) || 24) * 60 * 60 * 1000)
    : parseTimestamp(validUntil, "validUntil");
  if (until <= from) throw new Error("Bootstrap validity window must increase");
  if (until.getTime() - from.getTime() > MAX_VALIDITY_MS) throw new Error("Bootstrap validity window exceeds 90 days");
  if (from.getTime() > observed.getTime() + 30_000) throw new Error("Bootstrap validity cannot begin in the future");
  if (!Number.isInteger(Number(quota)) || Number(quota) < 1) throw new Error("Bootstrap quota must be a positive integer");
  if (!Number.isInteger(Number(concurrency)) || Number(concurrency) < 1) throw new Error("Bootstrap concurrency must be a positive integer");
  const normalizedTimezone = text(timezone || "UTC", "schedule timezone", 64);
  try { new Intl.DateTimeFormat("en-US", { timeZone: normalizedTimezone }).format(observed); } catch { throw new Error("schedule timezone is invalid"); }
  return {
    timezone: normalizedTimezone,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startLocal: "00:00",
    endLocal: "23:59",
    validFrom: from.toISOString(),
    validUntil: until.toISOString(),
    nextExecutionAt: from.toISOString(),
    cadence: "single",
    quota: Number(quota),
    concurrency: Number(concurrency),
    identity: digest({ timezone: normalizedTimezone, validFrom: from.toISOString(), validUntil: until.toISOString(), quota: Number(quota), concurrency: Number(concurrency) })
  };
}

export function deriveBootstrapAuthorizationId({ campaignId, contentIdentity, scheduleIdentity, authorizationReference } = {}) {
  return `campaign-auth-bootstrap-${digest({ campaignId, contentIdentity, scheduleIdentity, authorizationReference }).slice(0, 32)}`;
}

export function deriveBootstrapTemplateId({ campaignId, productIntelligenceHash, platform = "linkedin" } = {}) {
  return `template-bootstrap-${digest({ campaignId, productIntelligenceHash, platform }).slice(0, 24)}`;
}

export function bootstrapIdentityFingerprint(value) {
  return digest(value);
}

