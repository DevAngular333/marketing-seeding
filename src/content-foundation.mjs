import { createHash } from "node:crypto";
import { CHANNELS } from "./constants.mjs";

const MAX_CANDIDATES = 24;
const MAX_CONTENT = 3000;
const SECRET = /(?:password|passphrase|secret|token|cookie|authorization|credential|api[_-]?key|session(?:[_ -]?token)?)\s*[:=]/i;
const SECRET_ASSIGNMENT = /(?:password|passphrase|secret|token|cookie|authorization|credential|api[_-]?key|session(?:[_ -]?token)?)\s*[:=]\s*\S+/i;
const SECRET_VALUE = /(?:bearer\s+[a-z0-9._-]{6,}|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,})/i;
function clean(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value) { return createHash("sha256").update(stable(value)).digest("hex"); }
function assertSafe(value, field) {
  if (SECRET.test(String(value || "")) || SECRET_ASSIGNMENT.test(String(value || "")) || SECRET_VALUE.test(String(value || ""))) throw new Error(`Content contains credential/session material: ${field}`);
}
function bounded(value, field, max, { required = true } = {}) {
  if (value === undefined || value === null || (required && String(value).trim() === "")) throw new Error(`${field} is required`);
  if (String(value).length > max) throw new Error(`${field} exceeds bounded input length ${max}`);
  return clean(value, max);
}
function sanitizeEvidence(evidence = []) {
  return (Array.isArray(evidence) ? evidence : []).map((item) => ({ id: clean(item?.id, 160), hash: clean(item?.hash, 64), locator: clean(item?.locator, 500) })).filter((item) => item.id && /^[a-f0-9]{64}$/.test(item.hash));
}

/** Derive draft-only candidates. This function has no I/O or authority side effects. */
export function deriveContentCandidates({ productIntelligence, story, targets = [] } = {}) {
  const handoff = productIntelligence?.handoff;
  const document = productIntelligence?.document;
  if (!handoff || handoff.readinessStatus !== "READY" || !document) throw new Error("Content derivation requires READY product intelligence");
  const claims = Array.isArray(document.CLAIMS_WE_CAN_PROVE) ? document.CLAIMS_WE_CAN_PROVE : [];
  const evidence = sanitizeEvidence(document.evidence);
  const evidenceHashes = new Set(evidence.map((item) => item.hash));
  const claimMap = new Map();
  for (const claim of claims) {
    const id = bounded(claim?.id, "claim id", 160); const text = bounded(claim?.text, "claim text", 1200);
    assertSafe(text, `claim:${id}`);
    const refs = Array.isArray(claim?.evidenceRefs) ? claim.evidenceRefs.map((ref) => clean(ref, 64)).filter((ref) => evidenceHashes.has(ref)) : [];
    if (id && text && refs.length) claimMap.set(id, { id, text, evidenceRefs: refs });
  }
  if (!story) throw new Error("Content derivation requires an existing story");
  const storyId = bounded(story.id, "story id", 160);
  const storyTitle = bounded(story.title, "story title", 240);
  const storyCta = bounded(story.callToAction, "story callToAction", 300);
  assertSafe(storyTitle, "story.title"); assertSafe(storyCta, "story.callToAction");
  const requestedClaimIds = Array.isArray(story.claimIds) && story.claimIds.length ? story.claimIds.map((id) => clean(id, 160)) : [...claimMap.keys()];
  const selected = requestedClaimIds.map((id) => claimMap.get(id)).filter(Boolean);
  if (!selected.length || selected.length !== requestedClaimIds.length) throw new Error("Content derivation requires supported claims with evidence");
  const boundedTargets = (Array.isArray(targets) ? targets : []).slice(0, MAX_CANDIDATES);
  if (!boundedTargets.length) throw new Error("Content derivation requires at least one target");
  return boundedTargets.map((target) => {
    const targetId = bounded(target?.id, "target id", 160);
    const channel = bounded(target?.channel, "target channel", 80).toLowerCase();
    const policy = CHANNELS[channel];
    if (!policy) throw new Error(`Unsupported channel: ${channel}`);
    const content = `${storyTitle} — ${selected.map((claim) => claim.text).join(" ")} ${storyCta}`.trim();
    if (content.length > MAX_CONTENT) throw new Error(`Content exceeds ${MAX_CONTENT} characters`);
    if (policy.maxContentChars && content.length > policy.maxContentChars) throw new Error(`Content exceeds ${policy.maxContentChars} characters for ${channel}`);
    const claimIds = selected.map((claim) => claim.id);
    const refs = [...new Set(selected.flatMap((claim) => claim.evidenceRefs))].sort();
    const identity = hash({ storyId, targetId, channel, content, claimIds, evidenceRefs: refs });
    return { contentId: `content-${identity.slice(0, 24)}`, contentIdentity: identity, storyId, targetId, channel, content, claimIds, evidenceRefs: refs, status: "draft" };
  });
}

export const CONTENT_FOUNDATION_LIMIT = MAX_CANDIDATES;
