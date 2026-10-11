import { readFile } from "node:fs/promises";

const MAX_FEED_BYTES = 5 * 1024 * 1024;
const MAX_LEADS = 500;
const MAX_EVIDENCE_PER_LEAD = 50;
const PUBLIC_HOSTS = new Set(["github.com", "githubusercontent.com", "github.io"]);

function safeEvidence(value) {
  if (!value || typeof value !== "object") return null;
  let url;
  try { url = new URL(String(value.url || "")); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) ||
      ![...PUBLIC_HOSTS].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null;
  return {
    signalId: String(value.signalId || "").slice(0, 160),
    source: String(value.source || "").slice(0, 80),
    kind: String(value.kind || "").slice(0, 80),
    occurredAt: String(value.occurredAt || "").slice(0, 80),
    url: url.toString(),
    snippet: String(value.snippet || "").slice(0, 500),
  };
}

function safeLead(value) {
  if (!value || typeof value !== "object" || !value.leadId) return null;
  const score = (item) => Number.isFinite(item) && item >= 0 && item <= 1 ? item : null;
  return {
    leadId: String(value.leadId).slice(0, 160),
    segment: String(value.segment || "").slice(0, 160),
    fit: score(value.fit),
    whyNow: score(value.whyNow),
    reach: score(value.reach),
    evidence: Array.isArray(value.evidence)
      ? value.evidence.slice(0, MAX_EVIDENCE_PER_LEAD).map(safeEvidence).filter(Boolean)
      : [],
  };
}

export async function readAutoGtmFeed(filePath) {
  try {
    const content = await readFile(filePath);
    if (content.byteLength > MAX_FEED_BYTES) return empty("invalid", "feed_too_large");
    const payload = JSON.parse(content.toString("utf8").replace(/^\uFEFF/, ""));
    if (payload.schemaVersion !== 1) return empty("unsupported_schema", "unsupported_schema_version");
    const status = ["ready", "not_initialized", "not_configured", "unsupported_schema"].includes(payload.status)
      ? payload.status : "invalid";
    const generatedAt = typeof payload.generatedAt === "string" ? payload.generatedAt : null;
    const parsedAt = generatedAt ? Date.parse(generatedAt) : NaN;
    if (!Number.isFinite(parsedAt)) return empty("invalid", "invalid_generated_at");
    const ageMs = Math.max(0, Date.now() - parsedAt);
    const leads = Array.isArray(payload.leads)
      ? payload.leads.slice(0, MAX_LEADS).map(safeLead).filter(Boolean)
      : [];
    return {
      ok: status === "ready" || status === "not_initialized",
      source: "auto-gtm",
      status: status === "ready" && ageMs > 24 * 60 * 60 * 1000 ? "stale" : status,
      generatedAt,
      ageMs,
      campaignId: /^[a-zA-Z0-9_-]{1,120}$/.test(String(payload.campaignId || ""))
        ? payload.campaignId : null,
      portfolioProduct: String(payload.portfolioProduct || "").slice(0, 200),
      leads,
      leadCount: leads.length,
      signalCount: leads.reduce((total, lead) => total + lead.evidence.length, 0),
      reason: status === "not_initialized" ? "source_database_missing"
        : status === "not_configured" ? "product_domain_required" : null,
    };
  } catch (error) {
    if (error.code === "ENOENT") return empty("unavailable", "feed_not_generated");
    if (error instanceof SyntaxError) return empty("invalid", "invalid_json");
    throw error;
  }
}

function empty(status, reason) {
  return { ok: status === "not_initialized", source: "auto-gtm", status,
    generatedAt: null, ageMs: null, campaignId: null, portfolioProduct: "",
    leads: [], leadCount: 0, signalCount: 0, reason };
}
