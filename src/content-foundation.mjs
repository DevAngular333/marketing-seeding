import { createHash } from "node:crypto";
import { CHANNELS } from "./constants.mjs";

const MAX_CANDIDATES = 24;
const MAX_CONTENT = 3000;
const SECRET = /(?:password|passphrase|secret|token|cookie|authorization|credential|api[_-]?key|session(?:[_ -]?token)?)\s*[:=]/i;
const SECRET_ASSIGNMENT = /(?:password|passphrase|secret|token|cookie|authorization|credential|api[_-]?key|session(?:[_ -]?token)?)\s*[:=]\s*\S+/i;
const SECRET_VALUE = /(?:bearer\s+[a-z0-9._-]{6,}|sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,})/i;
export const TEMPLATE_CANDIDATE_CONTRACT_VERSION = 1;
function clean(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value) { return createHash("sha256").update(stable(value)).digest("hex"); }
function canonicalClaimIds(claimIds = []) {
  return [...new Set((Array.isArray(claimIds) ? claimIds : []).map((item) => String(item).trim()).filter(Boolean))].sort();
}
export function canonicalTemplateSourceRefs(sourceRefs = []) {
  const byKey = new Map();
  for (const source of Array.isArray(sourceRefs) ? sourceRefs : []) {
    const relativePath = String(source?.relativePath || "").trim();
    const sha256 = String(source?.sha256 || "").trim().toLowerCase();
    if (!relativePath || !/^[a-f0-9]{64}$/.test(sha256)) continue;
    byKey.set(`${relativePath}\u0000${sha256}`, { relativePath, sha256 });
  }
  return [...byKey.values()].sort((left, right) => `${left.relativePath}\u0000${left.sha256}`.localeCompare(`${right.relativePath}\u0000${right.sha256}`));
}
export function templateClaimIds(template = "") {
  return canonicalClaimIds([...String(template || "").matchAll(/\{\{claim:([a-zA-Z0-9_.-]+)\}\}/g)].map((match) => match[1]));
}
export function templateFingerprint({ templateContractVersion = TEMPLATE_CANDIDATE_CONTRACT_VERSION, templateId, platform, template, requiredDisclosures = [] } = {}) {
  return hash({
    templateContractVersion,
    templateId: String(templateId || "").trim(),
    platform: String(platform || "").trim().toLowerCase(),
    template: String(template || ""),
    requiredDisclosures: [...new Set((Array.isArray(requiredDisclosures) ? requiredDisclosures : []).map((item) => String(item).trim()).filter(Boolean))]
  });
}
export function renderApprovedTemplate({ template, approvedClaims = [], requiredDisclosures = [] } = {}) {
  const claims = new Map((Array.isArray(approvedClaims) ? approvedClaims : []).map((claim) => [String(claim?.id || "").trim(), claim]));
  const rendered = String(template || "").replace(/\{\{claim:([a-zA-Z0-9_.-]+)\}\}/g, (_, id) => String(claims.get(id)?.text || "")).replace(/\{\{disclosure\}\}/g, [...new Set((Array.isArray(requiredDisclosures) ? requiredDisclosures : []).map((item) => String(item).trim()).filter(Boolean))].join("\n"));
  assertSafe(rendered, "template.renderedContent");
  return rendered;
}
export function templateCandidateBinding({ templateContractVersion = TEMPLATE_CANDIDATE_CONTRACT_VERSION, templateId, platform, template, requiredDisclosures = [], claimIds = [], sourceRefs = [], authorizationBinding = null } = {}) {
  return {
    templateContractVersion,
    templateId: String(templateId || "").trim(),
    templatePlatform: String(platform || "").trim().toLowerCase(),
    templateFingerprint: templateFingerprint({ templateContractVersion, templateId, platform, template, requiredDisclosures }),
    templateClaimIds: canonicalClaimIds(claimIds),
    templateSourceRefs: canonicalTemplateSourceRefs(sourceRefs),
    templateAuthorizationBinding: String(authorizationBinding || "").trim() || null
  };
}
export function contentCandidateIdentity({ storyId, targetId, channel, content, claimIds, evidenceRefs, templateBinding = null } = {}) {
  const payload = { storyId, targetId, channel, content, claimIds, evidenceRefs };
  if (templateBinding) payload.templateBinding = templateBinding;
  return hash(payload);
}
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
    const identity = contentCandidateIdentity({ storyId, targetId, channel, content, claimIds, evidenceRefs: refs });
    return { contentId: `content-${identity.slice(0, 24)}`, contentIdentity: identity, storyId, targetId, channel, content, claimIds, evidenceRefs: refs, status: "draft" };
  });
}

/** Render exact candidates from a reviewed campaign template and its approved claims. */
export function deriveTemplateContentCandidates({ story, targets = [], authorization, templateId } = {}) {
  const boundary = authorization?.contentBoundary || {};
  if (boundary.mode !== "approved_template_set") throw new Error("Template candidates require approved_template_set authorization");
  const requestedId = String(templateId || "").trim();
  if (!requestedId) throw new Error("Template candidate requires templateId");
  const selectedClaims = new Map((boundary.approvedClaims || []).map((claim) => [String(claim?.id || "").trim(), claim]));
  const boundedTargets = (Array.isArray(targets) ? targets : []).slice(0, MAX_CANDIDATES);
  if (!boundedTargets.length) throw new Error("Template derivation requires at least one target");
  const candidates = [];
  for (const target of boundedTargets) {
    const targetId = bounded(target?.id, "target id", 160);
    const channel = bounded(target?.channel, "target channel", 80).toLowerCase();
    const policy = CHANNELS[channel];
    if (!policy) throw new Error(`Unsupported channel: ${channel}`);
    const template = (boundary.templates || []).find((item) => String(item?.id || "") === requestedId && String(item?.platform || "").toLowerCase() === channel);
    if (!template) continue;
    const claimIds = templateClaimIds(template.template);
    if (!claimIds.length) throw new Error(`Template ${requestedId} must include at least one claim placeholder`);
    const claims = claimIds.map((id) => selectedClaims.get(id));
    if (claims.some((claim) => !claim)) throw new Error(`Template ${requestedId} references an unapproved claim`);
    const sourceRefs = canonicalTemplateSourceRefs(claims.flatMap((claim) => claim.sourceRefs || []));
    if (!sourceRefs.length) throw new Error(`Template ${requestedId} requires source-bound claims`);
    const storySources = canonicalTemplateSourceRefs(story?.groundingSources || []);
    const storySourceKeys = new Set(storySources.map((source) => `${source.relativePath}\u0000${source.sha256}`));
    if (sourceRefs.some((source) => !storySourceKeys.has(`${source.relativePath}\u0000${source.sha256}`))) {
      throw new Error(`Template ${requestedId} source is not bound to the story grounding`);
    }
    const content = renderApprovedTemplate({ template: template.template, approvedClaims: claims, requiredDisclosures: boundary.requiredDisclosures || [] });
    if (content.length > MAX_CONTENT) throw new Error(`Content exceeds ${MAX_CONTENT} characters`);
    if (policy.maxContentChars && content.length > policy.maxContentChars) throw new Error(`Content exceeds ${policy.maxContentChars} characters for ${channel}`);
    if ((boundary.forbiddenTerms || []).some((term) => content.toLocaleLowerCase("en-US").includes(String(term).toLocaleLowerCase("en-US")))) throw new Error("Template content contains a forbidden term");
    if ((boundary.requiredDisclosures || []).some((disclosure) => !content.includes(disclosure))) throw new Error("Template content is missing a required disclosure");
    const binding = templateCandidateBinding({ templateId: requestedId, platform: channel, template: template.template, requiredDisclosures: boundary.requiredDisclosures || [], claimIds, sourceRefs, authorizationBinding: authorization.binding });
    const evidenceRefs = sourceRefs.map((source) => `${source.relativePath}#${source.sha256}`);
    const identity = contentCandidateIdentity({ storyId: story.id, targetId, channel, content, claimIds: binding.templateClaimIds, evidenceRefs, templateBinding: binding });
    candidates.push({
      contentId: `content-${identity.slice(0, 24)}`,
      contentIdentity: identity,
      contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      storyId: String(story.id), targetId, channel, content, claimIds: binding.templateClaimIds,
      evidenceRefs, status: "draft", ...binding
    });
  }
  if (!candidates.length) throw new Error(`Template ${requestedId} has no target on its authorized platform`);
  return candidates;
}

export const CONTENT_FOUNDATION_LIMIT = MAX_CANDIDATES;
