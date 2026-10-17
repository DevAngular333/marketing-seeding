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

function canonicalizeHandoff(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const canonicalKeys = ["productRun", "productArtifacts", "mediaArtifacts", "contentVariants", "contentPackage", "distributionIntent"];
  if (!canonicalKeys.some((key) => key in input)) return input;

  const productRun = input.productRun;
  const intent = input.distributionIntent;
  const packageRecord = input.contentPackage;
  const productArtifacts = input.productArtifacts === undefined ? [] : input.productArtifacts;
  const mediaArtifacts = input.mediaArtifacts === undefined ? [] : input.mediaArtifacts;
  const contentVariants = input.contentVariants === undefined ? [] : input.contentVariants;
  if (!productRun || typeof productRun !== "object" || Array.isArray(productRun)) throw new Error("productRun is required for canonical handoff");
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) throw new Error("distributionIntent is required for canonical handoff");
  if (!Array.isArray(productArtifacts) || !Array.isArray(mediaArtifacts) || !Array.isArray(contentVariants)) throw new Error("canonical artifact collections must be arrays");
  if (packageRecord !== undefined && (!packageRecord || typeof packageRecord !== "object" || Array.isArray(packageRecord))) throw new Error("contentPackage must be an object");

  const productId = String(input.productId || productRun.productId || intent.productId || "");
  if (!productId || productRun.productId !== productId || intent.productId !== productId) throw new Error("canonical product identity mismatch");
  if (productRun.contentVariantRefs !== undefined && (!Array.isArray(productRun.contentVariantRefs) || productRun.contentVariantRefs.length !== 1 || productRun.contentVariantRefs[0] !== (intent.contentVariantRefs || [])[0])) throw new Error("canonical ProductRun content reference mismatch");
  if (productRun.distributionIntentRefs !== undefined && (!Array.isArray(productRun.distributionIntentRefs) || productRun.distributionIntentRefs.length !== 1 || productRun.distributionIntentRefs[0] !== intent.distributionIntentId)) throw new Error("canonical ProductRun distribution reference mismatch");
  if (!productRun.distributionIntentRefs || !productRun.contentVariantRefs) throw new Error("canonical ProductRun references are required");
  const productArtifactIds = new Set(productArtifacts.map((item) => item?.artifactId).filter(Boolean));
  const mediaArtifactIds = new Set(mediaArtifacts.map((item) => item?.mediaArtifactId || item?.mediaVariantId || item?.artifactId).filter(Boolean));
  if (productRun.artifactRefs !== undefined && (!Array.isArray(productRun.artifactRefs) || productRun.artifactRefs.some((ref) => !productArtifactIds.has(ref)))) throw new Error("canonical ProductRun artifact reference mismatch");
  if (productRun.mediaRefs !== undefined && (!Array.isArray(productRun.mediaRefs) || productRun.mediaRefs.some((ref) => !mediaArtifactIds.has(ref)))) throw new Error("canonical ProductRun media reference mismatch");
  if (new Set(productArtifactIds).size !== productArtifacts.length || new Set(mediaArtifactIds).size !== mediaArtifacts.length) throw new Error("canonical artifact references must be unique");
  for (const artifact of [...productArtifacts, ...mediaArtifacts, ...contentVariants, ...(packageRecord ? [packageRecord] : [])]) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact) || artifact.productId !== productId) {
      throw new Error("canonical artifact product identity mismatch");
    }
  }

  const intentVariantRefs = intent.contentVariantRefs;
  if (!Array.isArray(intentVariantRefs) || intentVariantRefs.length !== 1 || new Set(intentVariantRefs).size !== intentVariantRefs.length) throw new Error("canonical handoff requires exactly one unique content variant");
  const contentVariantIds = contentVariants.map((item) => item?.contentVariantId).filter(Boolean);
  if (contentVariantIds.length !== contentVariants.length || new Set(contentVariantIds).size !== contentVariantIds.length || contentVariantIds.length !== intentVariantRefs.length || contentVariantIds.some((ref) => !intentVariantRefs.includes(ref))) throw new Error("canonical content variant references must resolve exactly");
  const variant = contentVariants.find((item) => item.contentVariantId === intentVariantRefs[0]);
  if (!variant) throw new Error("canonical content variant reference does not resolve");
  if (!Array.isArray(variant.sourceArtifactRefs) || variant.sourceArtifactRefs.some((ref) => !productArtifactIds.has(ref))) throw new Error("canonical content source artifact reference mismatch");
  if (!Array.isArray(variant.sourceMediaRefs) || variant.sourceMediaRefs.some((ref) => !mediaArtifactIds.has(ref))) throw new Error("canonical content source media reference mismatch");
  if (!Array.isArray(variant.mediaRefs) || variant.mediaRefs.length !== (intent.mediaRefs || []).length || variant.mediaRefs.some((ref, index) => ref !== (intent.mediaRefs || [])[index] || !mediaArtifactIds.has(ref))) throw new Error("canonical content media reference mismatch");
  if (packageRecord) {
    if (!packageRecord.contentPackageId || packageRecord.productId !== productId || !Array.isArray(packageRecord.contentVariantRefs) || packageRecord.contentVariantRefs.length !== 1 || packageRecord.contentVariantRefs[0] !== variant.contentVariantId) {
      throw new Error("canonical content package reference mismatch");
    }
    if (intent.contentPackageRef && intent.contentPackageRef !== packageRecord.contentPackageId) throw new Error("canonical content package reference mismatch");
    if (!Array.isArray(packageRecord.sourceArtifactRefs) || packageRecord.sourceArtifactRefs.some((ref) => !productArtifactIds.has(ref))) throw new Error("canonical package source artifact reference mismatch");
    if (!Array.isArray(packageRecord.mediaVariantRefs) || packageRecord.mediaVariantRefs.length !== (intent.mediaRefs || []).length || packageRecord.mediaVariantRefs.some((ref, index) => ref !== (intent.mediaRefs || [])[index] || !mediaArtifactIds.has(ref))) throw new Error("canonical package media reference mismatch");
  }
  const contentId = variant.contentVariantId || variant.contentId;
  const contentIdentity = variant.contentIdentity || variant.provenance?.contentIdentity || variant.metadata?.contentIdentity;
  if (!contentId || !contentIdentity || typeof variant.text !== "string" || !variant.text.trim()) throw new Error("canonical content variant lacks exact identity evidence");
  const computedContentSha256 = createHash("sha256").update(variant.text).digest("hex");
  if ((variant.sha256 && variant.sha256 !== computedContentSha256) || (variant.metadata?.sha256 && variant.metadata.sha256 !== computedContentSha256)) throw new Error("canonical content sha256 mismatch");
  const contentSha256 = computedContentSha256;

  const intentMediaRefs = intent.mediaRefs === undefined ? [] : intent.mediaRefs;
  if (!Array.isArray(intentMediaRefs) || intentMediaRefs.length > MAX_ARRAY) throw new Error("canonical media refs must be a bounded array");
  const media = intentMediaRefs.map((ref) => {
    const item = mediaArtifacts.find((candidate) => (candidate.mediaArtifactId || candidate.mediaVariantId || candidate.artifactId) === ref);
    if (!item) throw new Error("canonical media reference does not resolve");
    const artifactId = item.mediaArtifactId || item.mediaVariantId || item.artifactId;
    const sha256 = item.sha256 || item.metadata?.sha256;
    if (!HASH_RE.test(String(sha256 || ""))) throw new Error("canonical media reference lacks SHA-256 integrity");
    return { artifactId, sha256 };
  });
  if (mediaArtifactIds.size !== mediaArtifacts.length || mediaArtifacts.length !== intentMediaRefs.length || [...mediaArtifactIds].some((ref) => !intentMediaRefs.includes(ref))) throw new Error("canonical media references must resolve exactly");
  return {
    ...input,
    productId,
    content: { contentId, contentIdentity, sha256: contentSha256 },
    media,
    platform: input.platform
  };
}

export function validateDistributionHandoff(input = {}, { state, campaignId } = {}) {
  const errors = [];
  try {
    if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_JSON_BYTES) return { ok: false, errors: [`handoff exceeds ${MAX_JSON_BYTES} bytes`] };
  } catch { return { ok: false, errors: ["handoff must be JSON serializable"] }; }
  try { input = canonicalizeHandoff(input); } catch (error) { return { ok: false, errors: [error.message] }; }
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
