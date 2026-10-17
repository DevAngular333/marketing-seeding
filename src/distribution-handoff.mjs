import { createHash } from "node:crypto";

const MAX_JSON_BYTES = 100_000;
const MAX_TEXT = 2_000;
const MAX_ARRAY = 32;
const HASH_RE = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEY = /(?:credential|password|secret|token|cookie|session|browser|profile|selector|cdp|webdriver|playwright|puppeteer|orca|jev|submit|publish|execution|grant|lease|authorization|approval|dispatch|postid|permalink)/i;
const FORBIDDEN_VALUE = /(?:bearer\s+|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,}|cookie\s*=|session[_ -]?token|cdp|webdriver|playwright|puppeteer)/i;

function clean(value, max = MAX_TEXT) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error("distribution handoff contains missing or oversized text");
  if (FORBIDDEN_VALUE.test(text)) throw new Error("distribution handoff contains forbidden execution or credential material");
  return text;
}
function hash(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function scan(value, path = "root", seen = new Set()) {
  if (value && typeof value === "object") {
    if (seen.has(value)) throw new Error("distribution handoff must be acyclic");
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY) throw new Error(`${path} exceeds bounded array length`);
      value.forEach((item, i) => scan(item, `${path}[${i}]`, seen));
    } else for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) throw new Error(`distribution handoff field is forbidden: ${path}.${key}`);
      scan(child, `${path}.${key}`, seen);
    }
    seen.delete(value);
  } else if (typeof value === "string" && (value.length > MAX_TEXT || FORBIDDEN_VALUE.test(value))) {
    throw new Error(`distribution handoff value is forbidden or oversized: ${path}`);
  }
}

export function validateDistributionHandoff(input = {}, { state, campaignId } = {}) {
  const errors = [];
  try {
    if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_JSON_BYTES) return { ok: false, errors: [`handoff exceeds ${MAX_JSON_BYTES} bytes`] };
  } catch { return { ok: false, errors: ["handoff must be JSON serializable"] }; }
  try { scan(input); } catch (error) { return { ok: false, errors: [error.message] }; }
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["handoff must be an object"] };
  if (String(input.mode || "") !== "DRY_RUN") errors.push("only explicit DRY_RUN handoffs are accepted");
  const campaign = (state?.campaigns || []).find((item) => item.id === String(campaignId || input.campaignId || ""));
  if (!campaign) errors.push("campaign not found");
  if (String(input.campaignId || "") !== String(campaignId || "")) errors.push("campaignId mismatch");
  const productId = String(input.productId || "");
  const knownProductId = campaign?.productIntelligence?.document?.productId || campaign?.id;
  if (!productId || productId !== knownProductId) errors.push("productId mismatch");
  const content = input.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) errors.push("content reference is required");
  const candidate = content && (campaign?.contentCandidates || []).find((item) => item.contentId === content.contentId && item.contentIdentity === content.contentIdentity);
  if (!candidate) errors.push("content reference is not an exact campaign content candidate");
  if (candidate && content.sha256 !== createHash("sha256").update(candidate.content).digest("hex")) errors.push("content sha256 mismatch");
  const media = input.media === undefined ? [] : input.media;
  if (!Array.isArray(media) || media.length > MAX_ARRAY) errors.push("media must be a bounded array");
  const artifacts = state?.artifacts || [];
  for (const ref of Array.isArray(media) ? media : []) {
    const artifact = artifacts.find((item) => item.id === ref?.artifactId);
    if (!artifact || artifact.campaignId !== campaign?.id || artifact.sha256 !== ref.sha256 || !HASH_RE.test(String(ref.sha256 || ""))) errors.push("media reference or sha256 mismatch");
  }
  const targetId = String(input.platform?.targetId || input.targetId || "");
  if (targetId && !(state?.targets || []).some((target) => target.id === targetId && (campaign?.contentCandidates || []).some((candidateItem) => candidateItem.targetId === targetId))) errors.push("target is not campaign bound");
  if (errors.length) return { ok: false, errors };
  const sanitized = {
    schemaVersion: 1, mode: "DRY_RUN", campaignId: campaign.id, productId,
    content: { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity, sha256: content.sha256 },
    media: media.map((ref) => ({ artifactId: ref.artifactId, sha256: ref.sha256 })),
    platform: targetId ? { targetId } : null,
    source: input.source ? { system: clean(input.source.system || "system-agentic"), version: clean(input.source.version || "1") } : { system: "system-agentic", version: "1" }
  };
  const handoffHash = hash(sanitized);
  return { ok: true, handoff: { ...sanitized, handoffHash }, result: { mode: "DRY_RUN", canonicalStateTouched: true, liveDispatch: false, publicationAttempts: 0 } };
}

export function stableHandoffIdentity(handoff) { return handoff?.handoffHash || hash(handoff); }
export const DISTRIBUTION_HANDOFF_LIMITS = Object.freeze({ MAX_JSON_BYTES, MAX_TEXT, MAX_ARRAY });
