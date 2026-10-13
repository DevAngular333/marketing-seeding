import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { CHANNELS, nowIso } from "./constants.mjs";
import { approvalFingerprint, assertReplyCanSend, assertTransition, evaluateQueue } from "./guards.mjs";
import { collectOfficialMetrics, integrationReadiness } from "./integrations.mjs";
import { buildMarketingFlowGraph } from "./flow-graph.mjs";
import { campaignAuthorizationFingerprint, campaignScopeFingerprint, normalizeCampaignAuthorization, publicationIdentityKey, publicationIdentityKeysForPost } from "./campaign-authorization.mjs";

const METRIC_FIELDS = Object.freeze(["impressions", "reactions", "comments", "shares", "clicks", "leads"]);
const MAX_GROUNDING_BYTES = 2_000_000;
const MAX_SCREENSHOT_BYTES = 25_000_000;
const TARGET_READINESS_STATES = new Set(["ready", "checking", "warming_up", "blocked"]);
const PRODUCT_TRACKS = new Set(["3d", "vibe-code", "svg-animation"]);
const COMMUNITY_MEMBERSHIP_STATES = new Set(["joined", "pending", "rejected", "blocked", "not_applicable", "unknown"]);
const COMMUNITY_POST_STATES = new Set(["allowed", "manual_review", "blocked", "unknown", "not_applicable"]);
const PRODUCT_REPOS = Object.freeze({
  "design-os-3d-blender": "3d",
  "design-os-code2flow": "vibe-code",
  "design-os-svg-animation": "svg-animation"
});
const CHANNEL_HOSTS = Object.freeze({
  facebook_group: ["facebook.com"],
  threads: ["threads.net", "threads.com"],
  reddit: ["reddit.com"],
  product_hunt: ["producthunt.com"],
  indie_hackers: ["indiehackers.com"],
  linkedin: ["linkedin.com", "lnkd.in"]
});

const R19_CONTENT = `Final R19 - AI-assisted Blender automotive animation

I've finished this 4-second Full-HD test for a GT race-car education concept.

Blender rendered 96 native 3D states at 1920x1080 and 24 fps: assembled hero state, staggered shell/wheel/V12 separation, exploded-view hold, and controlled reassembly.

Pipeline: Brief -> scene planning -> Blender execution -> render -> validation -> final MP4.

I'm turning this workflow into practical learning material. Which part would you most want to learn: agent setup, procedural animation, render automation, or validation?

Honest note: this is a visual prototype, not a manufacturing-qualified model.

#Blender3D #BlenderAnimation #AutomotiveDesign #AIAgent #ProceduralWorkflow #3DWorkflow`;

const R19_CHANNEL_CONTENT = Object.freeze({
  facebook_group: R19_CONTENT,
  threads: `I turned one Blender brief into 96 validated Full-HD 3D states, then assembled them into a four-second GT exploded-view animation.

The useful part was not one render. It was the repeatable loop: brief -> scene plan -> Blender automation -> frame validation -> final MP4.

I'm shaping this into practical learning material. What would help you most: agent setup, procedural animation, render automation, or validation?

Visual prototype; not a manufacturing-qualified model.

#Blender3D #AIAgent #3DWorkflow`,
  reddit: `I built a small experiment around an AI-assisted Blender workflow and would value technical feedback.

The output is a four-second, 1920x1080 GT exploded-view animation made from 96 native 3D states: assembled hero pose, staggered shell/wheel/V12 separation, hold, and controlled reassembly.

The workflow was brief -> scene planning -> Blender execution -> render -> validation -> final MP4. I am considering turning the reproducible parts into learning material, especially the validation loop rather than presenting the first render as finished.

Which part would be most useful to unpack in detail: agent setup, procedural animation, render automation, or frame validation?

Disclosure: this is a visual prototype, not a manufacturing-qualified model.`,
  product_hunt: `R19 Workflow Lab turns a creative brief into a traceable Blender execution loop: plan the scene, automate repeatable steps, validate rendered evidence, and package the result.

The current proof artifact is a four-second Full-HD GT exploded-view animation built from 96 native 3D states. We are validating which part makers most want as a practical course: agent setup, procedural animation, render automation, or visual QA.

This is an early learning-product validation, not a manufacturing-ready vehicle model.`,
  indie_hackers: `Build log: validating an agentic Blender course with a real artifact.

Instead of writing the course first, I used a GT exploded-view animation to test the whole loop: brief -> scene plan -> Blender automation -> 96 rendered states -> validation -> final Full-HD MP4.

The next decision comes from evidence. I want to learn whether makers care most about agent setup, procedural animation, render automation, or visual QA before committing to the first module.

The current vehicle is an honest visual prototype, not a manufacturing-qualified model.`,
  linkedin: `I used one real Blender artifact to validate a repeatable agentic workflow: brief -> scene plan -> native execution -> 96 rendered states -> evidence review -> final Full-HD video.

The lesson is not “AI made a car”. The useful part is a traceable production loop where every claim is bound to repository evidence and the result stays explicitly labeled as a visual prototype.

I am now testing which learning module is most valuable: agent setup, procedural animation, render automation, or visual QA. Which one would you use first?

#Blender3D #AgenticAI #3DWorkflow`,
  email: `Subject: Which part of an evidence-first Blender workflow would help you most?

I am validating a practical learning series from a real Blender artifact: brief, scene planning, native execution, 96 rendered states, validation, and a final Full-HD video.

This message is only for people who explicitly opted in to product updates. If that is you, which module would be most useful: agent setup, procedural animation, render automation, or visual QA?

The current artifact is a visual prototype, not a manufacturing-qualified model. Every email run must retain consent and unsubscribe evidence.`
});

function upsertById(collection, value) {
  const index = collection.findIndex((item) => item.id === value.id);
  if (index === -1) collection.push(value);
  else collection[index] = { ...collection[index], ...value };
}

function addSeedDefaults(collection, value) {
  const index = collection.findIndex((item) => item.id === value.id);
  if (index === -1) {
    collection.push(value);
    return collection.at(-1);
  }
  collection[index] = { ...value, ...collection[index] };
  return collection[index];
}

function requireItem(collection, id, label) {
  const item = collection.find((entry) => entry.id === id);
  if (!item) throw new Error(`${label} not found: ${id}`);
  return item;
}

function optionalProductTrack(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const track = String(value).trim();
  if (!PRODUCT_TRACKS.has(track)) throw new Error(`Unsupported product track: ${track}`);
  return track;
}

async function requireProductRepo(value) {
  const requested = String(value || "").trim();
  if (!requested) throw new Error("Campaign productRepo is required");
  let resolved;
  try {
    resolved = await realpath(path.resolve(requested));
  } catch {
    throw new Error(`Campaign productRepo does not exist: ${requested}`);
  }
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error(`Campaign productRepo is not a directory: ${requested}`);
  return resolved;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readGroundingSource(productRepo, source) {
  const requested = String(source || "").trim();
  if (!requested) throw new Error("Grounding source path is required");
  const candidate = path.isAbsolute(requested) ? requested : path.resolve(productRepo, requested);
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch {
    throw new Error(`Grounding source does not exist: ${requested}`);
  }
  if (!isInside(productRepo, resolved)) {
    throw new Error(`Grounding source must be inside productRepo: ${requested}`);
  }
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error(`Grounding source is not a file: ${requested}`);
  if (info.size > MAX_GROUNDING_BYTES) {
    throw new Error(`Grounding source exceeds ${MAX_GROUNDING_BYTES} bytes: ${requested}`);
  }
  const content = await readFile(resolved);
  return {
    path: resolved,
    relativePath: path.relative(productRepo, resolved),
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: content.length
  };
}

async function readArtifactSource(productRepo, source) {
  const requested = String(source || "").trim();
  if (!requested) throw new Error("Artifact source path is required");
  const candidate = path.isAbsolute(requested) ? requested : path.resolve(productRepo, requested);
  let resolved;
  try {
    resolved = await realpath(candidate);
  } catch {
    throw new Error(`Artifact source does not exist: ${requested}`);
  }
  if (!isInside(productRepo, resolved)) throw new Error(`Artifact source must be inside productRepo: ${requested}`);
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error(`Artifact source is not a file: ${requested}`);
  const sha256 = await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(resolved);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
  return { path: resolved, relativePath: path.relative(productRepo, resolved), sha256, bytes: info.size };
}

async function assertPostArtifactCurrent(post, state) {
  if (!post.assetPath) return;
  if (!post.artifactId || !post.assetSha256) throw new Error("Publication guard blocked: asset_evidence_missing_or_stale");
  const artifact = requireItem(state.artifacts || [], post.artifactId, "Artifact");
  const campaign = requireItem(state.campaigns, post.campaignId, "Campaign");
  if (artifact.campaignId !== campaign.id || artifact.sha256 !== post.assetSha256 || path.resolve(post.assetPath) !== path.resolve(artifact.path)) {
    throw new Error("Publication guard blocked: asset_evidence_missing_or_stale");
  }
  const productRepo = await requireProductRepo(campaign.productRepo);
  const current = await readArtifactSource(productRepo, artifact.relativePath);
  if (current.sha256 !== artifact.sha256) throw new Error("Publication guard blocked: asset_source_changed_since_registration");
}

async function readBrowserScreenshot(stateFilePath, source, expectedSha256) {
  const requested = String(source || "").trim();
  if (!requested) throw new Error("Browser observation screenshotPath is required");
  const expected = String(expectedSha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error("screenshotSha256 must be a SHA-256 hex digest");
  const evidenceRoot = path.join(path.dirname(stateFilePath), "evidence");
  await mkdir(evidenceRoot, { recursive: true });
  const resolvedRoot = await realpath(evidenceRoot);
  let resolved;
  try {
    resolved = await realpath(path.isAbsolute(requested) ? requested : path.resolve(resolvedRoot, requested));
  } catch {
    throw new Error(`Browser observation screenshot does not exist: ${requested}`);
  }
  if (!isInside(resolvedRoot, resolved)) throw new Error("Browser observation screenshot must be inside the runtime evidence directory");
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error("Browser observation screenshot must be a file");
  if (info.size <= 0 || info.size > MAX_SCREENSHOT_BYTES) {
    throw new Error(`Browser observation screenshot must be between 1 and ${MAX_SCREENSHOT_BYTES} bytes`);
  }
  const sha256 = await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(resolved);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
  if (sha256 !== expected) throw new Error("screenshotSha256 does not match the runtime evidence file");
  return { path: resolved, sha256, bytes: info.size };
}

function canonicalPublicationUrl(value) {
  const requested = String(value || "").trim();
  let parsed;
  try {
    parsed = new URL(requested);
  } catch {
    throw new Error("Published transition requires a valid publication URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Published transition requires an HTTP(S) publication URL without credentials");
  }
  parsed.hash = "";
  return parsed;
}

function normalizedHost(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "");
}

function channelUrl(channel, value, label = "Target URL") {
  const parsed = canonicalPublicationUrl(value);
  const allowed = CHANNEL_HOSTS[channel];
  if (allowed && !allowed.includes(normalizedHost(parsed.hostname))) {
    throw new Error(`${label} must use an allowlisted ${channel} hostname`);
  }
  if (channel === "reddit" && !(/^\/r\/[^/]+|^\/user\/[^/]+/i.test(parsed.pathname))) {
    throw new Error("Reddit target URL must identify a specific subreddit or user profile");
  }
  return parsed.toString();
}

function requirePublicationEvidence(input, target) {
  const evidence = String(input.evidence || "").trim();
  if (!evidence) throw new Error("Published transition requires verification evidence");
  const publication = new URL(channelUrl(target.channel, input.publicationUrl, "Publication URL"));
  const targetUrl = canonicalPublicationUrl(target.url);
  const canonicalPath = (url) => `${url.origin}${url.pathname.replace(/\/+$/, "") || "/"}`.toLowerCase();
  if (publication.pathname === "/" || canonicalPath(publication) === canonicalPath(targetUrl)) {
    throw new Error("Published transition requires a specific post URL, not the target landing URL");
  }
  return { publicationUrl: publication.toString(), evidence };
}

function metricValue(input, field) {
  const value = input[field] ?? 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a finite nonnegative integer`);
  }
  return value;
}

function metricReading(input, field) {
  if (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === null || input[field] === undefined) {
    return { value: null, status: input.coverage?.[field] || "unknown" };
  }
  return { value: metricValue(input, field), status: input.coverage?.[field] || "measured" };
}

function metricReadingsMatchSnapshot(snapshot, readings) {
  if (!snapshot) return false;
  return METRIC_FIELDS.every((field) => {
    const priorStatus = snapshot.coverage?.[field] || (Number.isSafeInteger(snapshot[field]) ? "measured" : "unknown");
    return snapshot[field] === readings[field].value && priorStatus === readings[field].status;
  });
}

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

export function normalizeTargetReadiness(value, fallbackStatus = "needs_review") {
  const input = value && typeof value === "object" ? value : {};
  const state = String(input.state || (fallbackStatus === "active" ? "ready" : "checking")).trim();
  if (!TARGET_READINESS_STATES.has(state)) throw new Error(`Unsupported target readiness state: ${state}`);
  const reasonCode = String(input.reasonCode || (state === "ready" ? "eligible" : "eligibility_check_required")).trim();
  if (!/^[a-z0-9_]{2,64}$/.test(reasonCode)) throw new Error("Target readiness reasonCode must be a lowercase slug");
  const summary = String(input.summary || (state === "ready" ? "Kênh đã đủ điều kiện để chuẩn bị đăng" : "Chưa xác minh đủ điều kiện đăng")).trim();
  if (!summary || summary.length > 500) throw new Error("Target readiness summary must contain 1-500 characters");
  const nextSteps = Array.isArray(input.nextSteps) ? input.nextSteps.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (nextSteps.length > 6 || nextSteps.some((item) => item.length > 240)) {
    throw new Error("Target readiness supports at most 6 next steps of 240 characters each");
  }
  const evidence = input.evidence == null ? null : String(input.evidence).trim() || null;
  if (evidence && evidence.length > 1000) throw new Error("Target readiness evidence must contain at most 1000 characters");
  const checkedAt = input.checkedAt == null ? null : String(input.checkedAt).trim() || null;
  if (checkedAt && !Number.isFinite(Date.parse(checkedAt))) throw new Error("Target readiness checkedAt must be an ISO timestamp");
  const checks = {};
  for (const field of ["sessionValid", "composerCapable", "platformAvailable"]) {
    if (input.checks && typeof input.checks[field] === "boolean") checks[field] = input.checks[field];
  }
  return { state, reasonCode, summary, nextSteps, evidence, checkedAt, checks };
}

function currencyCode(value) {
  const currency = requiredText(value, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a three-letter ISO code");
  return currency;
}

export function normalizeKeywords(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  const keywords = [];
  for (const item of values) {
    const structured = Boolean(item && typeof item === "object");
    const phrase = String(structured ? item.phrase : item).trim().replace(/\s+/g, " ");
    if (!phrase) continue;
    if (phrase.length > 100) throw new Error("Keyword must contain at most 100 characters");
    const key = phrase.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push({
      phrase,
      intent: structured && item.intent ? String(item.intent) : "discovery",
      locale: structured && item.locale ? String(item.locale) : "global",
      status: structured && item.status ? String(item.status) : "active"
    });
  }
  if (keywords.length > 50) throw new Error("Campaign supports at most 50 keywords");
  return keywords;
}

function optionalHttpUrl(value, label) {
  const requested = String(value || "").trim();
  if (!requested) return null;
  let parsed;
  try { parsed = new URL(requested); } catch { throw new Error(`${label} must be a valid URL`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label} must be an HTTP(S) URL without credentials`);
  }
  return parsed.toString();
}

function normalizeScheduleMode(value) {
  const requested = String(value || "draft_only");
  // Legacy callers may still send this value. Owner standing approval now
  // replaces the Telegram product-review gate, so normalize it permanently.
  if (requested === "publish_with_product_review") return "publish_with_standing_approval";
  if (!new Set(["draft_only", "publish_with_standing_approval"]).has(requested)) {
    throw new Error("Invalid schedule mode");
  }
  return requested;
}

function normalizeCommunityMembership(input) {
  const productRepo = requiredText(input.productRepo, "productRepo");
  if (!PRODUCT_REPOS[productRepo]) throw new Error(`Unsupported productRepo: ${productRepo}`);
  const track = input.track === undefined ? PRODUCT_REPOS[productRepo] : String(input.track || "").trim();
  if (!PRODUCT_TRACKS.has(track) || PRODUCT_REPOS[productRepo] !== track) throw new Error("Community track must match productRepo");
  const platform = requiredText(input.platform, "platform").toLowerCase();
  if (!CHANNEL_HOSTS[platform] && platform !== "facebook" && platform !== "linkedin") throw new Error(`Unsupported community platform: ${platform}`);
  const communityName = requiredText(input.communityName, "communityName");
  const communityUrl = optionalHttpUrl(input.communityUrl || input.url, "communityUrl");
  if (communityUrl) {
    const host = new URL(communityUrl).hostname.replace(/^www\./, "").toLowerCase();
    const allowedHosts = platform === "facebook" || platform === "facebook_group" ? CHANNEL_HOSTS.facebook_group : platform === "linkedin" ? CHANNEL_HOSTS.linkedin : CHANNEL_HOSTS[platform] || [];
    if (allowedHosts.length && !allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) throw new Error("communityUrl host does not match platform");
  }
  const membershipStatus = String(input.membershipStatus || "unknown").trim();
  if (!COMMUNITY_MEMBERSHIP_STATES.has(membershipStatus)) throw new Error(`Unsupported membershipStatus: ${membershipStatus}`);
  const postStatus = String(input.postStatus || "unknown").trim();
  if (!COMMUNITY_POST_STATES.has(postStatus)) throw new Error(`Unsupported postStatus: ${postStatus}`);
  const notes = String(input.notes || "").trim();
  const evidence = String(input.evidence || "").trim();
  if (notes.length > 1000 || evidence.length > 2000) throw new Error("Community notes/evidence are too long");
  const checkedAt = input.checkedAt == null ? nowIso() : String(input.checkedAt).trim();
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error("checkedAt must be an ISO timestamp");
  return { productRepo, track, platform, communityName, communityUrl, membershipStatus, postStatus, accountId: String(input.accountId || "").trim() || null, notes, evidence, checkedAt };
}

function newest(items, timestampField, limit = 20) {
  return [...items]
    .sort((left, right) => String(right[timestampField] || "").localeCompare(String(left[timestampField] || "")))
    .slice(0, limit);
}

function metricTotals(metric = {}) {
  const snapshot = metric || {};
  return Object.fromEntries(METRIC_FIELDS.map((field) => [field, Number.isSafeInteger(snapshot[field]) ? snapshot[field] : null]));
}

export function buildTrafficPulse(post, snapshots = [], interactions = [], now = new Date()) {
  const metrics = snapshots
    .filter((snapshot) => snapshot.postId === post.id)
    .sort((left, right) => String(right.capturedAt || "").localeCompare(String(left.capturedAt || "")));
  const latest = metrics[0] || null;
  const previous = metrics[1] || null;
  const latestTotals = metricTotals(latest);
  const previousTotals = metricTotals(previous);
  const delta = Object.fromEntries(METRIC_FIELDS.map((field) => [field,
    Number.isSafeInteger(latestTotals[field]) && Number.isSafeInteger(previousTotals[field])
      ? latestTotals[field] - previousTotals[field]
      : null
  ]));
  const openInteractions = interactions.filter((interaction) => interaction.postId === post.id && interaction.status === "open").length;
  const nowMs = now.getTime();
  const publishedMs = Date.parse(post.publishedAt || post.updatedAt || "");
  const latestMs = latest ? Date.parse(latest.capturedAt) : Number.NaN;
  const hour = 60 * 60 * 1000;
  let nextReviewAt = Number.isFinite(publishedMs) ? publishedMs + hour : nowMs;
  if (latest) {
    const elapsedSincePublished = Number.isFinite(publishedMs) ? latestMs - publishedMs : 0;
    nextReviewAt = latestMs + (elapsedSincePublished < 23 * hour ? 23 * hour : 24 * hour);
    if (elapsedSincePublished >= 23 * hour && elapsedSincePublished < 71 * hour) nextReviewAt = publishedMs + 72 * hour;
  }
  let recommendation = "Ghi snapshot traffic đầu tiên";
  let priority = "due";
  if (openInteractions > 0) {
    recommendation = `Ưu tiên xử lý ${openInteractions} tương tác đang mở`;
    priority = "engage";
  } else if (!latest) {
    recommendation = nowMs >= nextReviewAt ? "Đến hạn snapshot traffic 1 giờ" : "Chờ mốc snapshot traffic 1 giờ";
    priority = nowMs >= nextReviewAt ? "due" : "watch";
  } else if (nowMs >= nextReviewAt) {
    recommendation = "Snapshot traffic đã đến hạn cập nhật";
    priority = "due";
  } else if (delta.leads > 0 || delta.clicks > 0) {
    recommendation = "Traffic có tín hiệu chuyển đổi; kiểm tra CTA và nguồn tốt nhất";
    priority = "scale";
  } else if (delta.comments > 0 || delta.reactions > 0 || delta.shares > 0) {
    recommendation = "Tương tác đang tăng; theo dõi bình luận và phản hồi có căn cứ";
    priority = "engage";
  } else {
    recommendation = "Tiếp tục theo dõi đến checkpoint kế tiếp";
    priority = "watch";
  }
  return {
    postId: post.id,
    publicationUrl: post.publicationUrl || null,
    latest,
    previous,
    delta,
    openInteractions,
    nextReviewAt: new Date(nextReviewAt).toISOString(),
    recommendation,
    priority
  };
}

export class SeedingService {
  constructor(store) {
    this.store = store;
  }

  async init() {
    return this.store.init();
  }

  async snapshot() {
    return this.store.read();
  }

  async flowGraph() {
    return buildMarketingFlowGraph(await this.store.read());
  }

  async bootstrapR19(actor = "operator") {
    const productRepo = await requireProductRepo("D:\\design-os-3d-blender");
    const result = await this.store.mutate(actor, "bootstrap_r19", (state) => {
      const createdAt = nowIso();
      addSeedDefaults(state.campaigns, {
        id: "campaign_r19_gt_course_validation",
        name: "R19 GT course market validation",
        objective: "Validate global demand for an agentic Blender workflow course using a real media artifact.",
        productRepo,
        assetPath: "C:\\Users\\Admin\\Desktop\\GT-Purple-Drift-Exploded-R19-FullHD.mp4",
        audience: ["Blender artists", "3D educators", "AI automation builders", "indie makers"],
        status: "active",
        createdAt
      });

      const targets = [
        {
          id: "target_fb_blender3d_malaysia",
          channel: "facebook_group",
          name: "Blender 3D Malaysia",
          url: "https://www.facebook.com/groups/77005549170",
          accountId: "facebook_61560390790557",
          status: "active",
          rulesStatus: "reviewed",
          locale: "en-MY",
          notes: "Public Blender workflow group; import a direct permalink and verification evidence before marking published."
        },
        {
          id: "target_threads_global",
          channel: "threads",
          name: "Threads global maker audience",
          url: "https://www.threads.net/",
          accountId: "threads_primary",
          status: "needs_review",
          rulesStatus: "not_required",
          locale: "en"
        },
        {
          id: "target_reddit_blender",
          channel: "reddit",
          name: "Relevant Blender/AI subreddit",
          url: "https://www.reddit.com/r/3Dmodeling/",
          accountId: "reddit_primary",
          status: "needs_review",
          rulesStatus: "pending",
          locale: "en"
        },
        {
          id: "target_product_hunt",
          channel: "product_hunt",
          name: "Product Hunt launch",
          url: "https://www.producthunt.com/",
          accountId: "product_hunt_primary",
          status: "needs_review",
          rulesStatus: "pending",
          locale: "en"
        },
        {
          id: "target_indie_hackers",
          channel: "indie_hackers",
          name: "Indie Hackers build log",
          url: "https://www.indiehackers.com/",
          accountId: "indie_hackers_primary",
          status: "needs_review",
          rulesStatus: "pending",
          locale: "en"
        },
        {
          id: "target_linkedin_global",
          channel: "linkedin",
          name: "LinkedIn professional audience",
          url: "https://www.linkedin.com/feed/?shareActive=true",
          accountId: "linkedin_primary",
          status: "needs_review",
          rulesStatus: "not_required",
          locale: "en"
        },
        {
          id: "target_email_opt_in",
          channel: "email",
          name: "Consent-based product updates",
          url: "https://localhost.invalid/consent-based-email",
          accountId: "email_opt_in_primary",
          status: "needs_review",
          rulesStatus: "pending",
          locale: "en",
          consentBasis: null,
          audienceSource: null,
          unsubscribeMechanism: null,
          notes: "Placeholder only. Keep inactive until consent source and unsubscribe evidence are reviewed."
        }
      ];
      for (const target of targets) addSeedDefaults(state.targets, { createdAt, ...target });

      const posts = targets.map((target) => ({
        id: `post_r19_${target.channel}`,
        campaignId: "campaign_r19_gt_course_validation",
        targetId: target.id,
        content: R19_CHANNEL_CONTENT[target.channel],
        assetPath: "C:\\Users\\Admin\\Desktop\\GT-Purple-Drift-Exploded-R19-FullHD.mp4",
        language: "en",
        status: "needs_review",
        approvedAt: null,
        publishedAt: null,
        publicationUrl: null,
        evidence: null,
        createdAt,
        updatedAt: createdAt
      }));
      for (const post of posts) {
        const existing = state.posts.find((item) => item.id === post.id);
        if (!existing) {
          state.posts.push(post);
          continue;
        }
        if (["draft", "needs_review"].includes(existing.status) && !existing.approvedAt) {
          existing.content = post.content;
          existing.assetPath = post.assetPath;
          existing.language = post.language;
          existing.updatedAt = createdAt;
        }
      }
      return { campaignId: "campaign_r19_gt_course_validation", postCount: posts.length };
    });
    return result.result;
  }

  async createCampaign(input, actor = "operator") {
    const productRepo = await requireProductRepo(input.productRepo);
    const track = optionalProductTrack(input.track);
    const result = await this.store.mutate(actor, "campaign_created", (state) => {
      const campaign = {
        id: randomUUID(),
        name: String(input.name || "").trim(),
        objective: String(input.objective || "").trim(),
        productRepo,
        track,
        landingUrl: optionalHttpUrl(input.landingUrl, "Campaign landingUrl"),
        keywords: normalizeKeywords(input.keywords),
        audience: Array.isArray(input.audience) ? input.audience : [],
        status: "draft",
        createdAt: nowIso()
      };
      if (!campaign.name || !campaign.objective) throw new Error("Campaign name and objective are required");
      state.campaigns.push(campaign);
      return campaign;
    });
    return result.result;
  }

  async authorizeCampaign(campaignId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "campaign_authorization_activated", async (state) => {
      const campaign = requireItem(state.campaigns, campaignId, "Campaign");
      const authorization = normalizeCampaignAuthorization(input, campaign);
      const productRepo = await requireProductRepo(campaign.productRepo);
      if ((state.campaignAuthorizations || []).some((item) => item.id === authorization.id)) throw new Error("Campaign authorization id already exists");
      for (const destination of authorization.destinations) {
        const target = requireItem(state.targets, destination.targetId, "Target");
        if (target.channel !== destination.platform || target.accountId !== destination.accountId) {
          throw new Error(`Authorized destination identity does not match target ${destination.targetId}`);
        }
        const registeredProfile = String(target.profileId || target.browserProfileId || "").trim() || null;
        if (destination.profileId && registeredProfile && destination.profileId !== registeredProfile) {
          throw new Error(`Authorized profile identity does not match target ${destination.targetId}`);
        }
        destination.profileId = registeredProfile || destination.profileId;
        destination.targetUrl = target.url;
      }
      for (const approvedAsset of authorization.approvedAssets) {
        const artifact = requireItem(state.artifacts || [], approvedAsset.artifactId, "Artifact");
        if (artifact.campaignId !== campaignId || artifact.sha256 !== approvedAsset.sha256 || artifact.status !== "verified") {
          throw new Error(`Approved asset identity is not verified for campaign: ${approvedAsset.artifactId}`);
        }
        const currentAsset = await readArtifactSource(productRepo, artifact.relativePath);
        if (currentAsset.sha256 !== artifact.sha256 || currentAsset.path !== artifact.path) {
          throw new Error(`Approved asset changed since registration: ${artifact.id}`);
        }
      }
      const verifiedSourceRefs = new Set((state.stories || [])
        .filter((story) => story.campaignId === campaignId)
        .flatMap((story) => story.groundingSources || [])
        .map((source) => `${source.relativePath}#${source.sha256}`));
      for (const claim of authorization.contentBoundary.approvedClaims) {
        for (const source of claim.sourceRefs) {
          if (!verifiedSourceRefs.has(`${source.relativePath}#${source.sha256}`)) {
            throw new Error(`Approved claim source is not bound to verified campaign grounding: ${source.relativePath}`);
          }
          const currentSource = await readGroundingSource(productRepo, source.relativePath);
          if (currentSource.relativePath !== source.relativePath || currentSource.sha256 !== source.sha256) {
            throw new Error(`Approved claim source changed since grounding: ${source.relativePath}`);
          }
        }
      }
      state.campaignAuthorizations ||= [];
      for (const previous of state.campaignAuthorizations.filter((item) => item.campaignId === campaignId && item.status === "active")) {
        previous.status = "superseded";
        previous.supersededAt = nowIso();
        for (const post of state.posts.filter((item) => item.campaignAuthorizationId === previous.id && item.status === "queued")) {
          post.status = "blocked";
          post.blockedAt = previous.supersededAt;
          post.authorizationDecision = { evaluatedAt: previous.supersededAt, allowed: false, reasons: ["campaign_authorization_superseded"] };
        }
      }
      authorization.approvedBy = actor;
      authorization.activatedAt = authorization.approvedAt;
      authorization.binding = campaignAuthorizationFingerprint(authorization);
      state.campaignAuthorizations.push(authorization);
      campaign.status = "active";
      campaign.updatedAt = authorization.activatedAt;
      const inheritingPosts = state.posts.filter((item) => item.campaignId === campaignId && ["draft", "needs_review", "approved", "queued", "blocked"].includes(item.status));
      for (const post of inheritingPosts) post.status = "blocked";
      for (const post of inheritingPosts) {
        const target = state.targets.find((item) => item.id === post.targetId);
        post.campaignAuthorizationId = authorization.id;
        post.campaignAuthorizationBinding = authorization.binding;
        post.contentId ||= post.storyId || createHash("sha256").update(post.content || "").digest("hex");
        post.idempotencyKey ||= publicationIdentityKey({ campaignId, contentId: post.contentId, platform: target?.channel, accountId: target?.accountId, targetId: post.targetId });
        post.jobLifecycle ||= [{ state: "CREATED", at: post.createdAt || authorization.activatedAt }];
        post.jobLifecycle.push({ state: "AUTHORIZED", at: authorization.activatedAt, authorizationId: authorization.id });
        const eligibility = evaluateQueue(post, state);
        post.authorizationDecision = { evaluatedAt: authorization.activatedAt, allowed: eligibility.allowed, reasons: eligibility.reasons };
        if (eligibility.allowed) {
          post.status = "queued";
          post.queuedAt = authorization.activatedAt;
          post.queuedKillEpoch = Number.isSafeInteger(state.control?.killSwitch?.epoch) ? state.control.killSwitch.epoch : 0;
          post.jobLifecycle.push({ state: "READY", at: authorization.activatedAt }, { state: "QUEUED", at: authorization.activatedAt });
        } else {
          post.status = "blocked";
          post.blockedAt = authorization.activatedAt;
          post.jobLifecycle.push({ state: "BLOCKED", at: authorization.activatedAt, reasons: eligibility.reasons });
        }
      }
      return authorization;
    });
    return result.result;
  }

  async setCampaignAuthorizationStatus(campaignId, status, actor = "operator") {
    if (!new Set(["paused", "active", "revoked"]).has(status)) throw new Error("Unsupported campaign authorization status");
    const result = await this.store.mutate(actor, `campaign_authorization_${status}`, (state) => {
        const authorization = [...(state.campaignAuthorizations || [])].reverse().find((item) => item.campaignId === campaignId && item.status !== "superseded");
        if (!authorization) throw new Error("Campaign authorization not found");
        if (status === "active") {
          const campaign = requireItem(state.campaigns, campaignId, "Campaign");
          if (campaign.status !== "active") throw new Error("Paused or inactive campaign cannot resume authorization");
          if (authorization.status === "revoked" || authorization.status === "superseded") throw new Error("Revoked or superseded campaign authorization cannot be resumed");
          if (!Number.isFinite(Date.parse(authorization.validUntil)) || Date.parse(authorization.validUntil) <= Date.now()) throw new Error("Expired campaign authorization cannot be resumed");
          if (authorization.campaignBinding !== campaignScopeFingerprint(campaign)) throw new Error("Campaign scope changed; create a new authorization before resuming");
          if (authorization.binding !== campaignAuthorizationFingerprint(authorization)) throw new Error("Campaign authorization scope changed; create a new authorization before resuming");
        }
      authorization.status = status;
      authorization.updatedAt = nowIso();
      if (status !== "active") {
        for (const post of state.posts.filter((item) => item.campaignAuthorizationId === authorization.id && item.status === "queued")) {
          post.status = "blocked";
          post.blockedAt = authorization.updatedAt;
          post.authorizationDecision = { evaluatedAt: authorization.updatedAt, allowed: false, reasons: [`campaign_authorization_${status}`] };
        }
      } else {
        for (const post of state.posts.filter((item) => item.campaignAuthorizationId === authorization.id && ["blocked", "draft"].includes(item.status))) {
          const eligibility = evaluateQueue(post, state);
          post.authorizationDecision = { evaluatedAt: authorization.updatedAt, allowed: eligibility.allowed, reasons: eligibility.reasons };
          if (eligibility.allowed) {
            post.status = "queued";
            post.queuedAt = authorization.updatedAt;
            post.queuedKillEpoch = Number.isSafeInteger(state.control?.killSwitch?.epoch) ? state.control.killSwitch.epoch : 0;
            post.jobLifecycle ||= [{ state: "CREATED", at: post.createdAt }];
            post.jobLifecycle.push({ state: "READY", at: authorization.updatedAt }, { state: "QUEUED", at: authorization.updatedAt });
            delete post.blockedAt;
          }
        }
      }
      return authorization;
    });
    return result.result;
  }

  async registerArtifact(campaignId, input, actor = "operator") {
    const state = await this.store.read();
    const campaign = requireItem(state.campaigns, campaignId, "Campaign");
    const productRepo = await requireProductRepo(campaign.productRepo);
    const source = await readArtifactSource(productRepo, input.path);
    const evidence = requiredText(input.evidence, "artifact evidence");
    const result = await this.store.mutate(actor, "artifact_registered", (nextState) => {
      requireItem(nextState.campaigns, campaignId, "Campaign");
      nextState.artifacts ||= [];
      const artifact = {
        id: randomUUID(),
        campaignId,
        name: requiredText(input.name, "artifact name"),
        mediaType: requiredText(input.mediaType || "application/octet-stream", "artifact mediaType"),
        ...source,
        evidence,
        status: "verified",
        createdAt: nowIso()
      };
      nextState.artifacts.push(artifact);
      return artifact;
    });
    return result.result;
  }

  async createStory(campaignId, input, actor = "ai-drafter") {
    const state = await this.store.read();
    const campaign = requireItem(state.campaigns, campaignId, "Campaign");
    const productRepo = await requireProductRepo(campaign.productRepo);
    const requestedSources = Array.isArray(input.groundingSources) ? input.groundingSources : [];
    const groundingSources = await Promise.all(requestedSources.map((source) => readGroundingSource(productRepo, source)));
    if (groundingSources.length === 0) throw new Error("Story requires product-repository grounding sources");
    if (input.artifactId) {
      const artifact = requireItem(state.artifacts || [], input.artifactId, "Artifact");
      if (artifact.campaignId !== campaignId) throw new Error("Story artifact must belong to the campaign");
    }
    const result = await this.store.mutate(actor, "story_created", (nextState) => {
      nextState.stories ||= [];
      const story = {
        id: randomUUID(),
        campaignId,
        artifactId: input.artifactId || null,
        title: requiredText(input.title, "story title"),
        angle: requiredText(input.angle, "story angle"),
        audience: requiredText(input.audience, "story audience"),
        callToAction: requiredText(input.callToAction, "story callToAction"),
        language: String(input.language || "en").trim(),
        groundingSources,
        disclosure: String(input.disclosure || "AI-assisted draft grounded in verified repository evidence.").trim(),
        status: "draft",
        createdAt: nowIso()
      };
      nextState.stories.push(story);
      return story;
    });
    return result.result;
  }

  async createChannelDrafts(storyId, input, actor = "ai-drafter") {
    const variants = Array.isArray(input.variants) ? input.variants : [];
    if (variants.length === 0) throw new Error("At least one channel variant is required");
    const initialState = await this.store.read();
    const initialStory = requireItem(initialState.stories || [], storyId, "Story");
    const initialCampaign = requireItem(initialState.campaigns, initialStory.campaignId, "Campaign");
    const productRepo = await requireProductRepo(initialCampaign.productRepo);
    const result = await this.store.mutate(actor, "channel_drafts_created", (state) => {
      const story = requireItem(state.stories || [], storyId, "Story");
      const seenTargets = new Set();
      const createdPostIds = new Set();
      const posts = variants.map((variant) => {
        const target = requireItem(state.targets, variant.targetId, "Target");
        if (seenTargets.has(target.id)) throw new Error(`Duplicate target variant: ${target.id}`);
        seenTargets.add(target.id);
        const content = requiredText(variant.content, "variant content");
        const policy = CHANNELS[target.channel];
        if (!policy) throw new Error(`Unsupported channel: ${target.channel}`);
        if (policy.maxContentChars && content.length > policy.maxContentChars) {
          throw new Error(`Content exceeds ${policy.maxContentChars} characters for ${target.channel}`);
        }
        const artifact = story.artifactId
          ? requireItem(state.artifacts || [], story.artifactId, "Artifact")
          : null;
        const assetPath = artifact ? artifact.path : null;
        if (variant.assetPath) {
          if (!artifact) throw new Error("A post asset must reference a registered artifact");
          const requestedAssetPath = path.isAbsolute(String(variant.assetPath))
            ? path.resolve(String(variant.assetPath))
            : path.resolve(productRepo, String(variant.assetPath));
          if (requestedAssetPath !== path.resolve(artifact.path)) {
            throw new Error("A post asset must match the story's registered artifact");
          }
        }
        const idempotencyKey = publicationIdentityKey({
          campaignId: story.campaignId,
          contentId: String(variant.contentId || story.id),
          platform: target.channel,
          accountId: target.accountId,
          targetId: target.id
        });
        const existing = state.posts.find((item) => item.idempotencyKey === idempotencyKey);
        if (existing) return existing;
        const created = {
          id: randomUUID(),
          campaignId: story.campaignId,
          storyId: story.id,
          contentId: String(variant.contentId || story.id),
          artifactId: story.artifactId,
          targetId: target.id,
          content,
          templateId: String(variant.templateId || "").trim() || null,
          audience: String(variant.audience || "").trim(),
          claimIds: Array.isArray(variant.claimIds) ? [...new Set(variant.claimIds.map(String))] : [],
          contentSourceRefs: Array.isArray(variant.contentSourceRefs) ? variant.contentSourceRefs.map((reference) => typeof reference === "string" ? reference : ({ relativePath: String(reference.relativePath || ""), sha256: String(reference.sha256 || "").toLowerCase() })) : [],
          assetPath,
          assetSha256: artifact?.sha256 || null,
          language: String(variant.language || story.language || "en"),
          status: "draft",
          approvedAt: null,
          idempotencyKey,
          scheduledAt: variant.scheduledAt ? new Date(variant.scheduledAt).toISOString() : null,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        createdPostIds.add(created.id);
        return created;
      });
      state.posts.push(...posts.filter((post) => !state.posts.some((item) => item.id === post.id)));
      const campaignAuthorizations = (state.campaignAuthorizations || []).filter((item) => item.campaignId === story.campaignId);
      const authorization = [...campaignAuthorizations].reverse().find((item) => item.status === "active") || campaignAuthorizations.at(-1);
      if (authorization) {
        for (const post of posts) {
          if (!createdPostIds.has(post.id)) continue;
          if (post.campaignAuthorizationId) continue;
          post.campaignAuthorizationId = authorization.id;
          post.campaignAuthorizationBinding = authorization.binding;
          post.jobLifecycle = [{ state: "CREATED", at: post.createdAt }, { state: "AUTHORIZED", at: nowIso(), authorizationId: authorization.id }];
          const eligibility = evaluateQueue(post, state);
          post.authorizationDecision = { evaluatedAt: nowIso(), allowed: eligibility.allowed, reasons: eligibility.reasons };
          if (eligibility.allowed) {
            post.status = "queued";
            post.queuedAt = nowIso();
            post.queuedKillEpoch = Number.isSafeInteger(state.control?.killSwitch?.epoch) ? state.control.killSwitch.epoch : 0;
            post.jobLifecycle.push({ state: "READY", at: post.queuedAt }, { state: "QUEUED", at: post.queuedAt });
          } else {
            post.status = "blocked";
            post.blockedAt = nowIso();
            post.jobLifecycle.push({ state: "BLOCKED", at: post.blockedAt, reasons: eligibility.reasons });
          }
        }
      }
      story.status = "adapted";
      story.updatedAt = nowIso();
      return posts;
    });
    return result.result;
  }

  async queueAuthorizedCampaignJobs(campaignId, actor = "scheduler") {
    const result = await this.store.mutate(actor, "campaign_jobs_readiness_evaluated", (state) => {
      const candidates = state.posts.filter((post) => post.campaignId === campaignId && post.campaignAuthorizationId && ["blocked", "draft"].includes(post.status));
      const decisions = [];
      for (const post of candidates) {
        const eligibility = evaluateQueue(post, state);
        post.authorizationDecision = { evaluatedAt: nowIso(), allowed: eligibility.allowed, reasons: eligibility.reasons };
        if (eligibility.allowed) {
          const at = nowIso();
          post.status = "queued";
          post.queuedAt = at;
          post.queuedKillEpoch = Number.isSafeInteger(state.control?.killSwitch?.epoch) ? state.control.killSwitch.epoch : 0;
          post.jobLifecycle ||= [{ state: "CREATED", at: post.createdAt }];
          post.jobLifecycle.push({ state: "READY", at }, { state: "QUEUED", at });
          delete post.blockedAt;
        } else {
          post.status = "blocked";
          post.blockedAt ||= nowIso();
        }
        decisions.push({ postId: post.id, status: post.status, reasons: eligibility.reasons });
      }
      return decisions;
    });
    return result.result;
  }

  async queueDueCampaignJobs(actor = "scheduler") {
    await this.expireCampaignAuthorizations(actor);
    const state = await this.store.read();
    const now = Date.now();
    const campaignIds = [...new Set(state.posts
      .filter((post) => post.campaignAuthorizationId && ["blocked", "draft"].includes(post.status))
      .filter((post) => post.authorizationDecision?.reasons?.includes("schedule_not_due"))
      .filter((post) => Number.isFinite(Date.parse(post.scheduledAt || "")) && Date.parse(post.scheduledAt) <= now)
      .map((post) => post.campaignId))];
    const results = [];
    for (const campaignId of campaignIds) {
      results.push({ campaignId, decisions: await this.queueAuthorizedCampaignJobs(campaignId, actor) });
    }
    return results;
  }

  async expireCampaignAuthorizations(actor = "scheduler") {
    const snapshot = await this.store.read();
    const now = Date.now();
    const dueIds = new Set((snapshot.campaignAuthorizations || [])
      .filter((authorization) => authorization.status === "active")
      .filter((authorization) => !Number.isFinite(Date.parse(authorization.validUntil)) || Date.parse(authorization.validUntil) <= now)
      .map((authorization) => authorization.id));
    if (dueIds.size === 0) return [];
    const result = await this.store.mutate(actor, "campaign_authorizations_expired", (state) => {
      const expired = [];
      for (const authorization of (state.campaignAuthorizations || []).filter((item) => dueIds.has(item.id) && item.status === "active")) {
        const at = nowIso();
        authorization.status = "expired";
        authorization.updatedAt = at;
        expired.push(authorization.id);
        for (const post of state.posts.filter((item) => item.campaignAuthorizationId === authorization.id && item.status === "queued")) {
          post.status = "blocked";
          post.blockedAt = at;
          post.authorizationDecision = { evaluatedAt: at, allowed: false, reasons: ["campaign_authorization_expired"] };
        }
      }
      return expired;
    });
    return result.result;
  }

  async createSchedule(campaignId, input, actor = "operator") {
    const channels = [...new Set(Array.isArray(input.channels) ? input.channels.map(String) : [])];
    if (channels.length === 0 || channels.some((channel) => !CHANNELS[channel])) {
      throw new Error("Schedule channels must contain supported channels");
    }
    const localTime = String(input.localTime || "09:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error("Schedule localTime must use HH:mm");
    const mode = normalizeScheduleMode(input.mode);
    const result = await this.store.mutate(actor, "schedule_created", (state) => {
      const campaign = requireItem(state.campaigns, campaignId, "Campaign");
      const track = optionalProductTrack(input.track === undefined ? campaign.track : input.track);
      state.schedules ||= [];
      const schedule = {
        id: randomUUID(),
        campaignId,
        name: requiredText(input.name || "Daily product content", "schedule name"),
        cadence: "daily",
        localTime,
        timezone: String(input.timezone || "Asia/Saigon"),
        track,
        channels,
        mode,
        status: input.status === "paused" ? "paused" : "active",
        requiresHumanPublishApproval: false,
        approvalPolicy: "campaign_authorization",
        approvalReference: mode === "publish_with_standing_approval"
          ? requiredText(input.approvalReference, "schedule approvalReference")
          : null,
        createdAt: nowIso()
      };
      state.schedules.push(schedule);
      return schedule;
    });
    return result.result;
  }

  async updateSchedule(scheduleId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "schedule_updated", (state) => {
      const schedule = requireItem(state.schedules || [], scheduleId, "Schedule");
      if (input.name !== undefined) schedule.name = requiredText(input.name, "schedule name");
      if (input.localTime !== undefined) {
        const localTime = String(input.localTime);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error("Schedule localTime must use HH:mm");
        schedule.localTime = localTime;
      }
      if (input.timezone !== undefined) schedule.timezone = requiredText(input.timezone, "schedule timezone");
      if (input.track !== undefined) schedule.track = optionalProductTrack(input.track);
      if (input.channels !== undefined) {
        const channels = [...new Set(Array.isArray(input.channels) ? input.channels.map(String) : [])];
        if (channels.length === 0 || channels.some((channel) => !CHANNELS[channel])) {
          throw new Error("Schedule channels must contain supported channels");
        }
        schedule.channels = channels;
      }
      if (input.status !== undefined) {
        if (!new Set(["active", "paused"]).has(String(input.status))) throw new Error("Invalid schedule status");
        schedule.status = String(input.status);
      }
      if (input.mode !== undefined) {
        const mode = String(input.mode);
        const normalizedMode = normalizeScheduleMode(mode);
        schedule.mode = normalizedMode;
        schedule.requiresHumanPublishApproval = false;
        schedule.approvalPolicy = "campaign_authorization";
        schedule.approvalReference = normalizedMode === "publish_with_standing_approval"
          ? requiredText(input.approvalReference || schedule.approvalReference, "schedule approvalReference")
          : null;
      } else if (input.approvalReference !== undefined && schedule.mode === "publish_with_standing_approval") {
        schedule.approvalReference = requiredText(input.approvalReference, "schedule approvalReference");
      }
      schedule.updatedAt = nowIso();
      return schedule;
    });
    return result.result;
  }

  async recordScheduleRun(scheduleId, input, actor = "scheduler") {
    const allowed = new Set(["due", "running", "succeeded", "failed", "blocked"]);
    const status = String(input.status || "");
    if (!allowed.has(status)) throw new Error("Invalid schedule run status");
    const result = await this.store.mutate(actor, "schedule_run_recorded", (state) => {
      const schedule = requireItem(state.schedules || [], scheduleId, "Schedule");
      if (input.artifactId) {
        const artifact = requireItem(state.artifacts || [], input.artifactId, "Artifact");
        if (artifact.campaignId !== schedule.campaignId) throw new Error("Schedule run artifact must belong to the campaign");
      }
      if (input.storyId) {
        const story = requireItem(state.stories || [], input.storyId, "Story");
        if (story.campaignId !== schedule.campaignId) throw new Error("Schedule run story must belong to the campaign");
      }
      state.scheduleRuns ||= [];
      const run = {
        id: randomUUID(),
        scheduleId,
        campaignId: schedule.campaignId,
        status,
        artifactId: input.artifactId || null,
        storyId: input.storyId || null,
        note: String(input.note || "").slice(0, 1000),
        externalSideEffects: input.externalSideEffects === true,
        recordedAt: nowIso()
      };
      state.scheduleRuns.push(run);
      return run;
    });
    return result.result;
  }

  async updateCampaign(campaignId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "campaign_updated", (state) => {
      const campaign = requireItem(state.campaigns, campaignId, "Campaign");
      const authorizationScopeBefore = JSON.stringify({ objective: campaign.objective, audience: campaign.audience || [], track: campaign.track || null, landingUrl: campaign.landingUrl || null, productRepo: campaign.productRepo });
      for (const field of ["name", "objective", "status"]) {
        if (input[field] !== undefined) campaign[field] = String(input[field]).trim();
      }
      if (input.landingUrl !== undefined) campaign.landingUrl = optionalHttpUrl(input.landingUrl, "Campaign landingUrl");
      if (input.keywords !== undefined) campaign.keywords = normalizeKeywords(input.keywords);
      if (input.audience !== undefined) campaign.audience = Array.isArray(input.audience) ? input.audience : [];
      if (input.track !== undefined) campaign.track = optionalProductTrack(input.track);
      if (!campaign.name || !campaign.objective) throw new Error("Campaign name and objective are required");
      campaign.updatedAt = nowIso();
      const authorizationScopeAfter = JSON.stringify({ objective: campaign.objective, audience: campaign.audience || [], track: campaign.track || null, landingUrl: campaign.landingUrl || null, productRepo: campaign.productRepo });
      if (authorizationScopeBefore !== authorizationScopeAfter) {
        for (const authorization of (state.campaignAuthorizations || []).filter((item) => item.campaignId === campaignId && item.status === "active")) {
          authorization.status = "paused";
          authorization.updatedAt = campaign.updatedAt;
          for (const post of state.posts.filter((item) => item.campaignAuthorizationId === authorization.id && item.status === "queued")) {
            post.status = "blocked";
            post.blockedAt = campaign.updatedAt;
            post.authorizationDecision = { evaluatedAt: campaign.updatedAt, allowed: false, reasons: ["campaign_scope_changed"] };
          }
        }
      }
      if (campaign.status !== "active") {
        for (const authorization of (state.campaignAuthorizations || []).filter((item) => item.campaignId === campaignId && item.status === "active")) {
          authorization.status = "paused";
          authorization.updatedAt = campaign.updatedAt;
          for (const post of state.posts.filter((item) => item.campaignAuthorizationId === authorization.id && item.status === "queued")) {
            post.status = "blocked";
            post.blockedAt = campaign.updatedAt;
            post.authorizationDecision = { evaluatedAt: campaign.updatedAt, allowed: false, reasons: ["campaign_paused"] };
          }
        }
      }
      return campaign;
    });
    return result.result;
  }

  async createPost(input, actor = "operator") {
    const result = await this.store.mutate(actor, "post_created", (state) => {
      requireItem(state.campaigns, input.campaignId, "Campaign");
      const target = requireItem(state.targets, input.targetId, "Target");
      const content = String(input.content || "");
      const contentId = String(input.contentId || createHash("sha256").update(content).digest("hex"));
      const idempotencyKey = publicationIdentityKey({ campaignId: input.campaignId, contentId, platform: target.channel, accountId: target.accountId, targetId: target.id });
      const existing = state.posts.find((item) => item.idempotencyKey === idempotencyKey || publicationIdentityKeysForPost(item, state).includes(idempotencyKey));
      if (existing) return existing;
      const artifact = input.artifactId ? requireItem(state.artifacts || [], input.artifactId, "Artifact") : null;
      if (artifact && (artifact.campaignId !== input.campaignId || artifact.status !== "verified")) {
        throw new Error("Post artifact must be verified and belong to its campaign");
      }
      if (input.assetPath && !artifact) throw new Error("A post asset must reference a registered artifact");
      const assetPath = artifact ? artifact.path : null;
      if (input.assetPath && path.resolve(String(input.assetPath)) !== path.resolve(artifact.path)) {
        throw new Error("Post asset path must match its registered artifact");
      }
      if (input.assetSha256 && (!artifact || String(input.assetSha256).toLowerCase() !== artifact.sha256)) {
        throw new Error("Post asset SHA-256 must match its registered artifact");
      }
      const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) throw new Error("scheduledAt must be a valid timestamp");
      const at = nowIso();
      const post = {
        id: randomUUID(),
        campaignId: input.campaignId,
        targetId: input.targetId,
        storyId: String(input.storyId || "").trim() || null,
        content,
        contentId,
        idempotencyKey,
        audience: String(input.audience || "").trim(),
        templateId: String(input.templateId || "").trim() || null,
        claimIds: Array.isArray(input.claimIds) ? [...new Set(input.claimIds.map(String))] : [],
        contentSourceRefs: Array.isArray(input.contentSourceRefs) ? input.contentSourceRefs.map((reference) => typeof reference === "string" ? reference : ({ relativePath: String(reference.relativePath || ""), sha256: String(reference.sha256 || "").toLowerCase() })) : [],
        artifactId: artifact?.id || null,
        assetPath,
        assetSha256: artifact?.sha256 || null,
        scheduledAt: scheduledAt?.toISOString() || null,
        language: input.language || "en",
        status: "draft",
        approvedAt: null,
        createdAt: at,
        updatedAt: at
      };
      state.posts.push(post);
      const authorizations = (state.campaignAuthorizations || []).filter((item) => item.campaignId === input.campaignId);
      const authorization = [...authorizations].reverse().find((item) => item.status === "active") || authorizations.at(-1);
      if (authorization) {
        post.campaignAuthorizationId = authorization.id;
        post.campaignAuthorizationBinding = authorization.binding;
        post.jobLifecycle = [{ state: "CREATED", at }, { state: "AUTHORIZED", at, authorizationId: authorization.id }];
        const eligibility = evaluateQueue(post, state);
        post.authorizationDecision = { evaluatedAt: at, allowed: eligibility.allowed, reasons: eligibility.reasons };
        if (eligibility.allowed) {
          post.status = "queued";
          post.queuedAt = at;
          post.queuedKillEpoch = Number.isSafeInteger(state.control?.killSwitch?.epoch) ? state.control.killSwitch.epoch : 0;
          post.jobLifecycle.push({ state: "READY", at }, { state: "QUEUED", at });
        } else {
          post.status = "blocked";
          post.blockedAt = at;
          post.jobLifecycle.push({ state: "BLOCKED", at, reasons: eligibility.reasons });
        }
      }
      return post;
    });
    return result.result;
  }

  async createTarget(input, actor = "operator") {
    const result = await this.store.mutate(actor, "target_created", (state) => {
      if (!CHANNELS[input.channel]) throw new Error(`Unsupported channel: ${input.channel}`);
      const target = {
        id: randomUUID(),
        channel: input.channel,
        name: String(input.name || "").trim(),
        url: channelUrl(input.channel, input.url),
        accountId: String(input.accountId || "").trim(),
        status: input.status || "needs_review",
        rulesStatus: input.rulesStatus || (CHANNELS[input.channel].requiresRulesReview ? "pending" : "not_required"),
        locale: input.locale || "en",
        notes: input.notes || "",
        consentBasis: input.consentBasis ? String(input.consentBasis).trim() : null,
        audienceSource: input.audienceSource ? String(input.audienceSource).trim() : null,
        unsubscribeMechanism: input.unsubscribeMechanism ? String(input.unsubscribeMechanism).trim() : null,
        readiness: normalizeTargetReadiness(input.readiness, input.status || "needs_review"),
        createdAt: nowIso()
      };
      if (!target.name || !target.url || !target.accountId) {
        throw new Error("Target name, URL and accountId are required");
      }
      if (CHANNELS[input.channel].requiresConsent && target.status === "active" &&
          (!target.consentBasis || !target.audienceSource || !target.unsubscribeMechanism)) {
        throw new Error("Active email targets require consentBasis, audienceSource and unsubscribeMechanism");
      }
      state.targets.push(target);
      return target;
    });
    return result.result;
  }

  async updateTarget(targetId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "target_updated", (state) => {
      const target = requireItem(state.targets, targetId, "Target");
      for (const field of ["name", "url", "accountId", "status", "rulesStatus", "locale", "notes", "consentBasis", "audienceSource", "unsubscribeMechanism"]) {
        if (input[field] !== undefined) target[field] = input[field];
      }
      if (input.readiness !== undefined) target.readiness = normalizeTargetReadiness(input.readiness, target.status);
      else target.readiness = normalizeTargetReadiness(target.readiness, target.status);
      if (target.readiness.state !== "ready") target.status = "needs_review";
      if (input.status === "active" && target.readiness.state !== "ready") {
        throw new Error("Target cannot become active until readiness state is ready");
      }
      target.url = channelUrl(target.channel, target.url);
      if (CHANNELS[target.channel]?.requiresConsent && target.status === "active" &&
          (!String(target.consentBasis || "").trim() || !String(target.audienceSource || "").trim() || !String(target.unsubscribeMechanism || "").trim())) {
        throw new Error("Active email targets require consentBasis, audienceSource and unsubscribeMechanism");
      }
      target.updatedAt = nowIso();
      for (const post of state.posts.filter((item) => item.targetId === target.id && ["approved", "queued"].includes(item.status))) {
        post.status = post.campaignAuthorizationId ? "blocked" : "needs_review";
        if (post.campaignAuthorizationId) {
          post.blockedAt = target.updatedAt;
          post.authorizationDecision = { evaluatedAt: target.updatedAt, allowed: false, reasons: ["target_identity_or_readiness_changed"] };
        }
        post.approvedAt = null;
        delete post.approvedBy;
        delete post.approvalBinding;
        delete post.approvalBinding;
        post.updatedAt = target.updatedAt;
      }
      for (const post of state.posts.filter((item) => item.targetId === target.id && item.campaignAuthorizationId && item.status === "blocked")) {
        const decision = evaluateQueue(post, state);
        post.authorizationDecision = { evaluatedAt: target.updatedAt, allowed: decision.allowed, reasons: decision.reasons };
        if (decision.allowed) {
          post.status = "queued";
          post.queuedAt = target.updatedAt;
          post.jobLifecycle ||= [{ state: "CREATED", at: post.createdAt }];
          post.jobLifecycle.push({ state: "READY", at: target.updatedAt }, { state: "QUEUED", at: target.updatedAt });
          delete post.blockedAt;
        }
      }
      return target;
    });
    return result.result;
  }

  async createCommunityMembership(input, actor = "operator") {
    const normalized = normalizeCommunityMembership(input);
    const result = await this.store.mutate(actor, "community_membership_recorded", (state) => {
      state.communityMemberships ||= [];
      const existing = state.communityMemberships.find((item) => item.productRepo === normalized.productRepo && item.platform === normalized.platform && item.communityUrl === normalized.communityUrl && item.communityName === normalized.communityName);
      if (existing) {
        Object.assign(existing, normalized, { updatedAt: nowIso() });
        return existing;
      }
      const membership = { id: randomUUID(), ...normalized, createdAt: nowIso(), updatedAt: nowIso() };
      state.communityMemberships.push(membership);
      return membership;
    });
    return result.result;
  }

  async updateCommunityMembership(membershipId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "community_membership_updated", (state) => {
      state.communityMemberships ||= [];
      const membership = requireItem(state.communityMemberships, membershipId, "Community membership");
      const normalized = normalizeCommunityMembership({ ...membership, ...input });
      Object.assign(membership, normalized, { updatedAt: nowIso() });
      return membership;
    });
    return result.result;
  }

  async updatePost(postId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "post_updated", (state) => {
      const post = requireItem(state.posts, postId, "Post");
      if (!["draft", "needs_review", "paused", "failed", "blocked"].includes(post.status)) {
        throw new Error(`Post cannot be edited from ${post.status}`);
      }
      const contentChanged = input.content !== undefined && String(input.content) !== post.content;
      const assetChanged = input.assetPath !== undefined && String(input.assetPath || "") !== String(post.assetPath || "");
      const assetHashChanged = input.assetSha256 !== undefined && String(input.assetSha256 || "").toLowerCase() !== String(post.assetSha256 || "").toLowerCase();
      let verifiedAssetHash;
      if (input.assetSha256 !== undefined) {
        verifiedAssetHash = String(input.assetSha256 || "").trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(verifiedAssetHash)) {
          throw new Error("assetSha256 must be a 64-character SHA-256 hex digest");
        }
        const artifact = (state.artifacts || []).find((item) => item.id === post.artifactId);
        if (!artifact || artifact.sha256 !== verifiedAssetHash) {
          throw new Error("assetSha256 must match the post's registered artifact");
        }
        const assetPath = input.assetPath !== undefined ? input.assetPath : post.assetPath;
        if (!assetPath || path.resolve(assetPath) !== path.resolve(artifact.path)) {
          throw new Error("assetPath must resolve to the post's registered artifact path");
        }
      }
      if (input.content !== undefined) post.content = String(input.content).trim();
      if (input.assetPath !== undefined) post.assetPath = input.assetPath || null;
      if (verifiedAssetHash !== undefined) post.assetSha256 = verifiedAssetHash;
      if (input.language !== undefined) post.language = input.language;
      if (input.externalId !== undefined) post.externalId = String(input.externalId || "").trim() || null;
      if (!post.content) throw new Error("Post content is required");
      if (contentChanged || assetChanged || assetHashChanged) {
        post.status = post.campaignAuthorizationId ? "blocked" : "needs_review";
        if (post.campaignAuthorizationId) {
          post.authorizationDecision = { evaluatedAt: nowIso(), allowed: false, reasons: ["job_content_or_asset_changed"] };
          post.blockedAt = nowIso();
        }
        post.approvedAt = null;
        delete post.approvedBy;
        delete post.approvalBinding;
      }
      post.updatedAt = nowIso();
      return post;
    });
    return result.result;
  }

  async approvePost(postId, actor = "operator") {
    const result = await this.store.mutate(actor, "post_approved", (state) => {
      const post = requireItem(state.posts, postId, "Post");
      if (!["draft", "needs_review", "paused"].includes(post.status)) {
        throw new Error(`Post cannot be approved from ${post.status}`);
      }
      post.status = "approved";
      const target = requireItem(state.targets, post.targetId, "Target");
      post.approvedAt = nowIso();
      post.approvedBy = actor;
      post.approvalBinding = approvalFingerprint(post, target);
      post.updatedAt = post.approvedAt;
      return post;
    });
    return result.result;
  }

  async transitionPost(postId, input, actor = "operator") {
    const result = await this.store.mutate(actor, `post_transition_${input.status}`, async (state) => {
      const post = requireItem(state.posts, postId, "Post");
      assertTransition(post.status, input.status);
      if (["queued", "publishing"].includes(input.status)) {
        await assertPostArtifactCurrent(post, state);
        const decision = evaluateQueue(post, state);
        if (!decision.allowed) throw new Error(`Publication guard blocked: ${decision.reasons.join(", ")}`);
      }
      let publicationEvidence = null;
      if (input.status === "published") {
        const target = requireItem(state.targets, post.targetId, "Target");
        publicationEvidence = requirePublicationEvidence(input, target);
      }
      const at = nowIso();
      state.publicationAttempts ||= [];
      if (input.status === "publishing") {
        const attempt = {
          id: randomUUID(), postId: post.id, targetId: post.targetId,
          contentSha256: createHash("sha256").update(post.content).digest("hex"),
          approvalBinding: post.approvalBinding,
          campaignAuthorizationId: post.campaignAuthorizationId || null,
          campaignAuthorizationBinding: post.campaignAuthorizationBinding || null,
          status: "prepared",
          preparedAt: at,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        };
        state.publicationAttempts.push(attempt);
        post.publicationAttemptId = attempt.id;
      }
      if (input.status === "published") {
        const attempt = requireItem(state.publicationAttempts, post.publicationAttemptId, "Publication attempt");
        if (attempt.status !== "prepared" || attempt.approvalBinding !== post.approvalBinding ||
            attempt.campaignAuthorizationId !== (post.campaignAuthorizationId || null) ||
            attempt.campaignAuthorizationBinding !== (post.campaignAuthorizationBinding || null) ||
            attempt.contentSha256 !== createHash("sha256").update(post.content).digest("hex")) {
          throw new Error("Publication attempt is stale or does not match the approved content");
        }
        if (Date.parse(attempt.expiresAt) < Date.now()) throw new Error("Publication attempt expired; return the post through review");
        attempt.status = "verified";
        attempt.verifiedAt = at;
        attempt.publicationUrl = publicationEvidence.publicationUrl;
      }
      if (input.status === "failed" && post.publicationAttemptId) {
        const attempt = state.publicationAttempts.find((item) => item.id === post.publicationAttemptId);
        if (attempt && attempt.status === "prepared") {
          attempt.status = "failed";
          attempt.finishedAt = at;
          attempt.error = String(input.error || "Publication failed").slice(0, 500);
        }
      }
      post.status = input.status;
      post.updatedAt = at;
      post[`${input.status}At`] = at;
      if (publicationEvidence) {
        post.publicationUrl = publicationEvidence.publicationUrl;
        post.evidence = publicationEvidence.evidence;
        if (input.externalId !== undefined) post.externalId = String(input.externalId || "").trim() || null;
      }
      if (input.status === "needs_review") {
        post.approvedAt = null;
        delete post.approvedBy;
        delete post.approvalBinding;
      }
      if (input.error) post.error = input.error;
      else if (input.status === "published") delete post.error;
      return post;
    });
    return result.result;
  }

  async recordMetrics(postId, input, actor = "operator", trusted = {}) {
    const result = await this.store.mutate(actor, "metrics_recorded", (state) => {
      requireItem(state.posts, postId, "Post");
      const readings = Object.fromEntries(METRIC_FIELDS.map((field) => [field, metricReading(input, field)]));
      const snapshot = {
        id: randomUUID(),
        postId,
        capturedAt: nowIso(),
        ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].value])),
        coverage: Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].status])),
        source: trusted.officialChannel ? `official:${trusted.officialChannel}` : "manual",
        provenance: trusted.officialChannel
          ? { kind: "official_api", adapter: trusted.officialChannel, verifiedAt: nowIso() }
          : { kind: "verified_manual", actor, verifiedAt: nowIso() }
      };
      state.metricSnapshots.push(snapshot);
      return snapshot;
    });
    return result.result;
  }

  async recordBrowserObservation(postId, input, actor = "local-draft-automation") {
    const screenshot = await readBrowserScreenshot(this.store.filePath, input.screenshotPath, input.screenshotSha256);
    const result = await this.store.mutate(actor, "browser_observation_recorded", (state) => {
      const post = requireItem(state.posts, postId, "Post");
      if (post.status !== "published" || !post.publicationUrl) {
        throw new Error("Browser observation requires a published post with a permalink");
      }
      const target = requireItem(state.targets, post.targetId, "Target");
      const observedUrl = channelUrl(target.channel, input.observedUrl, "Observed URL");
      const comparableUrl = (value) => {
        const parsed = canonicalPublicationUrl(value);
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "") || "/"}`;
      };
      if (comparableUrl(observedUrl) !== comparableUrl(post.publicationUrl)) {
        throw new Error("Browser observation URL must match the stored publication permalink");
      }
      const evidence = requiredText(input.evidence, "browser observation evidence");
      const screenshotSha256 = screenshot.sha256;
      const observedAt = new Date(input.observedAt || Date.now());
      if (!Number.isFinite(observedAt.getTime())) throw new Error("observedAt must be a valid timestamp");
      if (observedAt.getTime() > Date.now() + 5 * 60_000 || observedAt.getTime() < Date.now() - 24 * 60 * 60_000) {
        throw new Error("observedAt must be within the last 24 hours and not in the future");
      }
      const status = String(input.status || "verified").trim().toLowerCase();
      if (!["verified", "unknown"].includes(status)) throw new Error("Browser observation status must be verified or unknown");
      state.collectorRuns ||= [];
      const run = {
        id: randomUUID(), postId, channel: target.channel,
        status: status === "verified" ? "succeeded" : "unknown",
        mode: "browser_assisted", at: observedAt.toISOString(), observedUrl,
        evidence: evidence.slice(0, 500), screenshotPath: screenshot.path,
        screenshotSha256, screenshotBytes: screenshot.bytes
      };
      if (status === "unknown") {
        run.reason = requiredText(input.reason, "unknown observation reason").slice(0, 300);
        state.collectorRuns.push(run);
        return { status, collectorRun: run, metricSnapshot: null };
      }
      if (!METRIC_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input, field))) {
        throw new Error("Verified browser observation requires at least one visible metric");
      }
      const readings = Object.fromEntries(METRIC_FIELDS.map((field) => [field, metricReading(input, field)]));
      const snapshot = {
        id: randomUUID(), postId, capturedAt: observedAt.toISOString(),
        ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].value])),
        coverage: Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].status])),
        source: `browser:${target.channel}`,
        provenance: {
          kind: "browser_verified", observedUrl, evidence: evidence.slice(0, 500),
          screenshotPath: screenshot.path, screenshotSha256, screenshotBytes: screenshot.bytes,
          actor, verifiedAt: nowIso()
        }
      };
      const previous = [...state.metricSnapshots]
        .filter((item) => item.postId === postId)
        .sort((left, right) => String(right.capturedAt || "").localeCompare(String(left.capturedAt || "")))[0];
      const metricsChanged = !metricReadingsMatchSnapshot(previous, readings);
      run.metricsChanged = metricsChanged;
      if (metricsChanged) state.metricSnapshots.push(snapshot);
      state.collectorRuns.push(run);
      return { status, collectorRun: run, metricSnapshot: metricsChanged ? snapshot : null, metricsChanged };
    });
    return result.result;
  }

  async collectMetrics(postId, actor = "official-collector", options = {}) {
    const state = await this.store.read();
    const post = requireItem(state.posts, postId, "Post");
    const target = requireItem(state.targets, post.targetId, "Target");
    try {
      const metrics = await collectOfficialMetrics(post, target, options);
      const persisted = await this.store.mutate(actor, "collector_succeeded", (nextState) => {
        requireItem(nextState.posts, postId, "Post");
        const readings = Object.fromEntries(METRIC_FIELDS.map((field) => [field, metricReading(metrics, field)]));
        const snapshot = {
          id: randomUUID(), postId, capturedAt: nowIso(),
          ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].value])),
          coverage: Object.fromEntries(METRIC_FIELDS.map((field) => [field, readings[field].status])),
          source: `official:${target.channel}`,
          provenance: { kind: "official_api", adapter: target.channel, verifiedAt: nowIso() }
        };
        nextState.metricSnapshots.push(snapshot);
        nextState.collectorRuns ||= [];
        nextState.collectorRuns.push({ id: randomUUID(), postId, channel: target.channel, status: "succeeded", at: nowIso() });
        return snapshot;
      });
      return persisted.result;
    } catch (error) {
      await this.store.mutate(actor, "collector_failed", (nextState) => {
        nextState.collectorRuns ||= [];
        nextState.collectorRuns.push({
          id: randomUUID(), postId, channel: target.channel, status: "failed", at: nowIso(), error: String(error.message).slice(0, 300)
        });
      });
      throw error;
    }
  }

  async collectAllMetrics(actor = "official-collector", options = {}) {
    const state = await this.store.read();
    const results = [];
    const readiness = new Map(integrationReadiness(options.env || process.env).map((item) => [item.id, item]));
    for (const post of state.posts.filter((item) => item.status === "published")) {
      const target = state.targets.find((item) => item.id === post.targetId);
      const provider = readiness.get(target?.channel);
      if (!provider || provider.mode === "manual_only" || !provider.configured) {
        const status = provider?.mode === "manual_only" ? "not_applicable" : "unknown";
        await this.store.mutate(actor, `collector_${status}`, (nextState) => {
          nextState.collectorRuns ||= [];
          nextState.collectorRuns.push({ id: randomUUID(), postId: post.id, channel: target?.channel || "unknown", status, at: nowIso(), reason: provider?.mode === "manual_only" ? "manual_only" : "official_api_not_configured" });
        });
        results.push({ postId: post.id, ok: null, status, reason: provider?.mode === "manual_only" ? "manual_only" : "official_api_not_configured" });
        continue;
      }
      try {
        const metric = await this.collectMetrics(post.id, actor, options);
        results.push({ postId: post.id, ok: true, metricId: metric.id });
      } catch (error) {
        results.push({ postId: post.id, ok: false, error: error.message });
      }
    }
    return results;
  }

  async recordConversion(campaignId, input, actor = "conversion-collector") {
    const result = await this.store.mutate(actor, "conversion_recorded", (state) => {
      requireItem(state.campaigns, campaignId, "Campaign");
      state.conversions ||= [];
      const eventId = requiredText(input.eventId, "eventId");
      const source = requiredText(input.source, "source");
      if (state.conversions.some((event) => event.source === source && event.eventId === eventId)) {
        throw new Error("Duplicate conversion event");
      }
      const occurredAt = new Date(requiredText(input.occurredAt, "occurredAt"));
      if (Number.isNaN(occurredAt.getTime())) throw new Error("occurredAt must be a valid timestamp");
      const conversion = {
        id: randomUUID(), campaignId, eventId, source,
        name: requiredText(input.name, "name"), valueMinor: metricValue(input, "valueMinor"),
        currency: currencyCode(input.currency), occurredAt: occurredAt.toISOString(), recordedAt: nowIso(),
        consentBasis: requiredText(input.consentBasis, "consentBasis")
      };
      state.conversions.push(conversion);
      return conversion;
    });
    return result.result;
  }

  async recordKeywordMetrics(campaignId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "keyword_metrics_recorded", (state) => {
      const campaign = requireItem(state.campaigns, campaignId, "Campaign");
      const keyword = String(input.keyword || "").trim();
      if (!keyword) throw new Error("Keyword is required");
      const configured = (campaign.keywords || []).some((item) => item.phrase.toLocaleLowerCase("en-US") === keyword.toLocaleLowerCase("en-US"));
      if (!configured) throw new Error(`Keyword is not configured for campaign: ${keyword}`);
      const rank = input.rank === undefined || input.rank === null || input.rank === "" ? null : metricValue(input, "rank");
      if (rank === 0) throw new Error("rank must be a positive integer when provided");
      const snapshot = {
        id: randomUUID(),
        campaignId,
        keyword,
        capturedAt: nowIso(),
        impressions: metricValue(input, "impressions"),
        clicks: metricValue(input, "clicks"),
        leads: metricValue(input, "leads"),
        rank,
        source: input.source || "manual"
      };
      state.keywordSnapshots ||= [];
      state.keywordSnapshots.push(snapshot);
      return snapshot;
    });
    return result.result;
  }

  async addInteraction(postId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "interaction_added", (state) => {
      requireItem(state.posts, postId, "Post");
      const externalId = String(input.externalId || "").trim() || null;
      if (externalId) {
        const existing = state.interactions.find((item) => item.postId === postId && item.externalId === externalId);
        if (existing) return existing;
      }
      const interaction = {
        id: randomUUID(),
        postId,
        kind: input.kind || "comment",
        authorLabel: input.authorLabel || "unknown",
        text: String(input.text || ""),
        externalId,
        status: "open",
        capturedAt: nowIso()
      };
      state.interactions.push(interaction);
      return interaction;
    });
    return result.result;
  }

  async draftReply(interactionId, input, actor = "ai-drafter") {
    const result = await this.store.mutate(actor, "reply_drafted", async (state) => {
      const interaction = requireItem(state.interactions, interactionId, "Interaction");
      const post = requireItem(state.posts, interaction.postId, "Post");
      const campaign = requireItem(state.campaigns, post.campaignId, "Campaign");
      const requestedSources = Array.isArray(input.groundingSources) ? input.groundingSources : [];
      const productRepo = await requireProductRepo(campaign.productRepo);
      const groundingSources = await Promise.all(requestedSources.map((source) => readGroundingSource(productRepo, source)));
      const reply = {
        id: randomUUID(),
        interactionId,
        text: String(input.text || "").trim(),
        groundingSources,
        groundingSummary: String(input.groundingSummary || "").trim(),
        productRepo,
        status: "draft",
        approvedAt: null,
        createdAt: nowIso()
      };
      if (!reply.text) throw new Error("Reply text is required");
      if (groundingSources.length === 0 || !reply.groundingSummary) {
        throw new Error("Reply requires product-repository grounding sources and summary");
      }
      state.replies.push(reply);
      return reply;
    });
    return result.result;
  }

  async approveReply(replyId, actor = "operator") {
    const result = await this.store.mutate(actor, "reply_approved", (state) => {
      const reply = requireItem(state.replies, replyId, "Reply");
      if (reply.status !== "draft") throw new Error(`Reply cannot be approved from ${reply.status}`);
      reply.status = "approved";
      reply.approvedAt = nowIso();
      reply.approvedBy = actor;
      return reply;
    });
    return result.result;
  }

  async markReplySent(replyId, input, actor = "operator") {
    const result = await this.store.mutate(actor, "reply_sent", (state) => {
      const reply = requireItem(state.replies, replyId, "Reply");
      assertReplyCanSend(reply, state);
      const evidence = String(input.evidence || "").trim();
      if (!evidence) throw new Error("Reply send evidence is required");
      reply.status = "sent";
      reply.sentAt = nowIso();
      reply.evidence = evidence;
      const interaction = requireItem(state.interactions, reply.interactionId, "Interaction");
      interaction.status = "replied";
      interaction.repliedAt = reply.sentAt;
      return reply;
    });
    return result.result;
  }

  async recordFixtureAutomation(postId, input, actor = "fixture-worker") {
    const evidence = requiredText(input.evidence, "fixture automation evidence");
    const e2eStatus = String(input.e2eStatus || "").trim();
    const allowedE2EStatuses = new Set(["e2e_verified_readonly", "e2e_dom_timeout", "e2e_network_error"]);
    if (e2eStatus && !allowedE2EStatuses.has(e2eStatus)) throw new Error("Unsupported E2E fixture status");
    const fixturePublicationUrl = input.fixturePublicationUrl ? requiredText(input.fixturePublicationUrl, "fixture publication URL") : null;
    if (!fixturePublicationUrl && !e2eStatus) throw new Error("Fixture automation requires a fixture URL or E2E status");
    if (fixturePublicationUrl && !fixturePublicationUrl.startsWith("https://fixture.local/")) {
      throw new Error("Fixture automation URL must remain on fixture.local");
    }
    const contentSha256 = requiredText(input.contentSha256, "fixture content hash");
    const result = await this.store.mutate(actor, "fixture_automation_completed", (state) => {
      const post = requireItem(state.posts, postId, "Post");
      state.fixtureAutomationRuns ||= [];
      const existing = state.fixtureAutomationRuns.find((run) => run.postId === post.id && run.contentSha256 === contentSha256);
      if (existing) return existing;
      const run = {
        id: randomUUID(),
        postId: post.id,
        mode: "local-fixture",
        dashboardStatus: "Đã chuẩn bị (Auto-Worker mô phỏng)",
        e2eStatus: e2eStatus || null,
        fixturePublicationUrl,
        publicationUrl: null,
        observedUrl: input.observedUrl ? String(input.observedUrl) : null,
        selector: input.selector ? String(input.selector) : null,
        evidence,
        contentSha256,
        cdpEndpointConfigured: input.cdpEndpointConfigured === true,
        cdpAttached: input.cdpAttached === true,
        externalSideEffects: false,
        at: nowIso()
      };
      state.fixtureAutomationRuns.push(run);
      return run;
    });
    return result.result;
  }

  async dashboard() {
    const state = await this.store.read();
    state.keywordSnapshots ||= [];
    state.conversions ||= [];
    state.collectorRuns ||= [];
    state.artifacts ||= [];
    state.stories ||= [];
    state.schedules ||= [];
    state.scheduleRuns ||= [];
    state.publicationAttempts ||= [];
    state.fixtureAutomationRuns ||= [];
    state.communityMemberships ||= [];
    const latestMetrics = new Map();
    for (const metric of state.metricSnapshots) {
      const current = latestMetrics.get(metric.postId);
      if (!current || metric.capturedAt > current.capturedAt) latestMetrics.set(metric.postId, metric);
    }
    const metricCoverage = Object.fromEntries(METRIC_FIELDS.map((field) => [field, { measured: 0, unknown: 0, unsupported: 0 }]));
    const totals = [...latestMetrics.values()].reduce((sum, metric) => {
      for (const key of METRIC_FIELDS) {
        const status = metric.coverage?.[key] || (Number.isSafeInteger(metric[key]) ? "measured" : "unknown");
        metricCoverage[key][status] = (metricCoverage[key][status] || 0) + 1;
        if (Number.isSafeInteger(metric[key])) sum[key] += metric[key];
      }
      return sum;
    }, { impressions: 0, reactions: 0, comments: 0, shares: 0, clicks: 0, leads: 0 });
    const statuses = Object.fromEntries(state.posts.map((post) => post.status).reduce((map, status) => {
      map.set(status, (map.get(status) || 0) + 1);
      return map;
    }, new Map()));
    const channels = Object.entries(CHANNELS).map(([id, policy]) => ({
      id,
      label: policy.label,
      targets: state.targets.filter((target) => target.channel === id).length,
      posts: state.posts.filter((post) => state.targets.find((target) => target.id === post.targetId)?.channel === id).length
    }));
    const trafficPulse = state.posts
      .filter((post) => post.status === "published")
      .map((post) => buildTrafficPulse(post, state.metricSnapshots, state.interactions));
    const browserWindowMinutes = 24 * 60;
    const browserWindowStartedAt = Date.now() - browserWindowMinutes * 60 * 1000;
    const publishedPosts = state.posts.filter((post) => post.status === "published" && post.publicationUrl);
    const latestBrowserRunByPost = new Map();
    for (const run of state.collectorRuns.filter((item) => item.mode === "browser_assisted")) {
      const current = latestBrowserRunByPost.get(run.postId);
      if (!current || String(run.at || "") >= String(current.at || "")) latestBrowserRunByPost.set(run.postId, run);
    }
    const currentBrowserRuns = publishedPosts
      .map((post) => latestBrowserRunByPost.get(post.id))
      .filter((run) => run && Date.parse(run.at || "") >= browserWindowStartedAt);
    const browserCoverage = {
      windowMinutes: browserWindowMinutes,
      totalPublished: publishedPosts.length,
      observed: currentBrowserRuns.length,
      verified: currentBrowserRuns.filter((run) => run.status === "succeeded").length,
      unknown: currentBrowserRuns.filter((run) => run.status === "unknown").length,
      missing: Math.max(0, publishedPosts.length - currentBrowserRuns.length),
      complete: publishedPosts.length > 0 && currentBrowserRuns.length === publishedPosts.length,
      lastObservationAt: currentBrowserRuns.map((run) => run.at).sort().at(-1) || null,
      missingPostIds: publishedPosts.filter((post) => !currentBrowserRuns.some((run) => run.postId === post.id)).map((post) => post.id)
    };
    const latestKeywordMetrics = new Map();
    for (const snapshot of state.keywordSnapshots) {
      const key = `${snapshot.campaignId}\u0000${snapshot.keyword.toLocaleLowerCase("en-US")}`;
      const current = latestKeywordMetrics.get(key);
      if (!current || snapshot.capturedAt > current.capturedAt) latestKeywordMetrics.set(key, snapshot);
    }
    const keywordPerformance = state.campaigns.flatMap((campaign) => (campaign.keywords || []).map((keyword) => {
      const key = `${campaign.id}\u0000${keyword.phrase.toLocaleLowerCase("en-US")}`;
      return { campaignId: campaign.id, ...keyword, latest: latestKeywordMetrics.get(key) || null };
    }));
    return {
      revision: state.revision,
      updatedAt: state.updatedAt,
      campaignCount: state.campaigns.length,
      targetCount: state.targets.length,
      postCount: state.posts.length,
      communityMemberships: state.communityMemberships,
      statuses,
      totals,
      metricCoverage,
      openInteractions: state.interactions.filter((item) => item.status === "open").length,
      pendingReplies: state.replies.filter((item) => item.status !== "sent").length,
      channels,
      campaigns: state.campaigns,
      targets: state.targets.map((target) => ({
        ...target,
        readiness: normalizeTargetReadiness(target.readiness, target.status)
      })),
      posts: state.posts,
      latestMetrics: Object.fromEntries(latestMetrics),
      latestMetricSnapshots: newest([...latestMetrics.values()], "capturedAt"),
      trafficPulse,
      browserCoverage,
      keywordPerformance,
      recentInteractions: newest(state.interactions, "capturedAt"),
      recentReplies: newest(state.replies, "createdAt"),
      recentAudit: newest(state.auditLog, "at"),
      integrations: integrationReadiness(),
      recentConversions: newest(state.conversions, "occurredAt"),
      recentCollectorRuns: newest(state.collectorRuns, "at"),
      recentArtifacts: newest(state.artifacts, "createdAt"),
      recentStories: newest(state.stories, "createdAt"),
      recentPublicationAttempts: newest(state.publicationAttempts, "preparedAt"),
      fixtureAutomation: {
        mode: "local-fixture",
        runs: newest(state.fixtureAutomationRuns, "at")
      },
      schedules: state.schedules,
      recentScheduleRuns: newest(state.scheduleRuns, "recordedAt"),
      flowGraph: buildMarketingFlowGraph(state)
    };
  }
}
