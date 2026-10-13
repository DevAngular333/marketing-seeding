import { createHash } from "node:crypto";
import path from "node:path";
import { executionAccountKey } from "./readiness.mjs";

const SUPPORTED_AUTH_STATUSES = new Set(["active", "paused", "expired", "revoked"]);
const sha256Pattern = /^[a-f0-9]{64}$/i;

function required(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeDuplicateContent(value) {
  return String(value || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function campaignScopeFingerprint(campaign) {
  return digest({
    id: campaign.id,
    productRepo: campaign.productRepo,
    track: campaign.track || null,
    objective: campaign.objective,
    audience: campaign.audience || [],
    landingUrl: campaign.landingUrl || null
  });
}

export function campaignContentHash(content) {
  return digest(String(content || ""));
}

export function publicationIdentityKey({ campaignId, contentId, platform, accountId, targetId }) {
  return digest({ campaignId, contentId, platform, accountId, targetId });
}

export function publicationIdentityKeysForPost(post, state) {
  const target = state.targets?.find((item) => item.id === post.targetId);
  if (!target || !post.campaignId) return [];
  const contentIds = new Set([
    post.contentId,
    post.storyId,
    post.content ? createHash("sha256").update(String(post.content)).digest("hex") : null
  ].map((value) => String(value || "").trim()).filter(Boolean));
  return [...contentIds].map((contentId) => publicationIdentityKey({
    campaignId: post.campaignId,
    contentId,
    platform: target.channel,
    accountId: target.accountId,
    targetId: target.id
  }));
}

export function normalizeCampaignAuthorization(input, campaign, now = new Date()) {
  const validFrom = required(input.validFrom, "validFrom");
  const validUntil = required(input.validUntil, "validUntil");
  const fromMs = Date.parse(validFrom);
  const untilMs = Date.parse(validUntil);
  if (!Number.isFinite(fromMs) || !Number.isFinite(untilMs) || untilMs <= fromMs) {
    throw new Error("Campaign authorization requires a valid, increasing validity window");
  }
  if (untilMs - fromMs > 90 * 24 * 60 * 60 * 1000) throw new Error("Campaign authorization validity cannot exceed 90 days");

  const destinations = Array.isArray(input.destinations) ? input.destinations.map((item) => ({
    platform: required(item.platform, "destination platform"),
    accountId: required(item.accountId, "destination accountId"),
    targetId: required(item.targetId, "destination targetId"),
    profileId: String(item.profileId || "").trim() || null
  })) : [];
  if (destinations.length === 0) throw new Error("Campaign authorization requires at least one approved destination");
  if (new Set(destinations.map((item) => `${item.platform}\0${item.accountId}\0${item.targetId}`)).size !== destinations.length) {
    throw new Error("Campaign authorization destinations must be unique");
  }

  const approvedAssets = Array.isArray(input.approvedAssets) ? input.approvedAssets.map((item) => ({
    artifactId: required(item.artifactId, "approved asset artifactId"),
    sha256: required(item.sha256, "approved asset sha256").toLowerCase()
  })) : [];
  if (approvedAssets.some((item) => !sha256Pattern.test(item.sha256))) throw new Error("Approved asset hashes must be SHA-256 hex digests");
  if (new Set(approvedAssets.map((item) => item.artifactId)).size !== approvedAssets.length) throw new Error("Approved assets must be unique");

  const contentBoundary = input.contentBoundary || {};
  const mode = String(contentBoundary.mode || "approved_copy_set");
  if (!new Set(["approved_copy_set", "approved_template_set"]).has(mode)) throw new Error("Unsupported campaign contentBoundary mode");
  const contentHashes = Array.isArray(contentBoundary.contentHashes) ? [...new Set(contentBoundary.contentHashes.map((item) => String(item).toLowerCase()))] : [];
  const approvedClaims = Array.isArray(contentBoundary.approvedClaims) ? contentBoundary.approvedClaims.map((item) => ({
    id: required(item.id, "approved claim id"),
    text: required(item.text, "approved claim text"),
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map((ref) => ({
      relativePath: required(ref.relativePath, "approved claim source relativePath"),
      sha256: required(ref.sha256, "approved claim source sha256").toLowerCase()
    })) : []
  })) : [];
  if (new Set(approvedClaims.map((claim) => claim.id)).size !== approvedClaims.length) throw new Error("Approved claim IDs must be unique");
  if (mode === "approved_copy_set" && (contentHashes.length === 0 || contentHashes.some((item) => !sha256Pattern.test(item)))) {
    throw new Error("approved_copy_set requires one or more SHA-256 contentHashes");
  }
  const templates = Array.isArray(contentBoundary.templates) ? contentBoundary.templates.map((item) => ({
    id: required(item.id, "approved template id"),
    platform: required(item.platform, "approved template platform"),
    template: required(item.template, "approved template text")
  })) : [];
  if (new Set(templates.map((item) => `${item.platform}\0${item.id}`)).size !== templates.length) throw new Error("Campaign templates must be unique per platform and ID");
  const authorizedPlatforms = new Set(destinations.map((item) => item.platform));
  if (templates.some((item) => !authorizedPlatforms.has(item.platform))) throw new Error("Campaign templates cannot exceed the authorized platform scope");
  if (mode === "approved_template_set") {
    if (approvedClaims.length === 0 || approvedClaims.some((claim) => claim.sourceRefs.length === 0) || templates.length === 0) {
      throw new Error("approved_template_set requires source-bound claims and at least one exact template");
    }
    if (approvedClaims.some((claim) => claim.sourceRefs.some((ref) => !sha256Pattern.test(ref.sha256)))) throw new Error("Approved claim source refs require SHA-256 hashes");
    const approvedIds = new Set(approvedClaims.map((claim) => claim.id));
    const validToken = /^\{\{(?:claim:[a-zA-Z0-9_.-]+|disclosure)\}\}$/;
    for (const template of templates) {
      const tokens = template.template.match(/\{\{[^}]+\}\}/g) || [];
      if (tokens.some((token) => !validToken.test(token))) throw new Error(`Unsupported placeholder in campaign template ${template.id}`);
      for (const token of tokens.filter((value) => value.startsWith("{{claim:"))) {
        if (!approvedIds.has(token.slice(8, -2))) throw new Error(`Template references an unapproved claim: ${token}`);
      }
      if (contentBoundary.requiredDisclosures?.length && !tokens.includes("{{disclosure}}")) {
        throw new Error(`Template ${template.id} must include the required disclosure placeholder`);
      }
    }
  }
  const contentBoundaryNormalized = {
    mode,
    contentHashes,
    approvedClaims,
    templates,
    requiredDisclosures: [...new Set((contentBoundary.requiredDisclosures || []).map((item) => required(item, "required disclosure")))],
    forbiddenTerms: [...new Set((contentBoundary.forbiddenTerms || []).map((item) => required(item, "forbidden term").toLocaleLowerCase("en-US")))],
    maxCharactersByPlatform: { ...(contentBoundary.maxCharactersByPlatform || {}) },
    allowRepeatSameContent: contentBoundary.allowRepeatSameContent === true
  };
  if (Object.entries(contentBoundaryNormalized.maxCharactersByPlatform).some(([platform, value]) => !platform || !Number.isInteger(Number(value)) || Number(value) < 1)) {
    throw new Error("maxCharactersByPlatform must contain positive integer limits");
  }

  const audienceRules = input.audienceRules || {};
  const allowedAudiences = Array.isArray(audienceRules.allowedAudiences)
    ? [...new Set(audienceRules.allowedAudiences.map((item) => required(item, "allowed audience")))] : [];
  if (allowedAudiences.length === 0) throw new Error("Campaign authorization requires explicit allowedAudiences");

  const schedule = input.schedule || {};
  const timezone = required(schedule.timezone, "schedule timezone");
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(now); } catch { throw new Error("schedule timezone is invalid"); }
  const weekdays = Array.isArray(schedule.weekdays) ? [...new Set(schedule.weekdays.map(Number))].sort() : [];
  if (weekdays.length === 0 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("schedule weekdays must use 0-6");
  const startLocal = required(schedule.startLocal, "schedule startLocal");
  const endLocal = required(schedule.endLocal, "schedule endLocal");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startLocal) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endLocal) || startLocal >= endLocal) {
    throw new Error("schedule requires a valid same-day startLocal/endLocal window");
  }

  const limits = input.rateLimits || {};
  const rateLimits = {
    maxJobsPerAccountPerDay: Number(limits.maxJobsPerAccountPerDay),
    maxJobsPerCampaignPerDay: Number(limits.maxJobsPerCampaignPerDay),
    maxConcurrency: Number(limits.maxConcurrency),
    minIntervalMinutes: Number(limits.minIntervalMinutes || 0)
  };
  if (Object.values(rateLimits).some((value) => !Number.isInteger(value) || value < 0) ||
      rateLimits.maxJobsPerAccountPerDay < 1 || rateLimits.maxJobsPerCampaignPerDay < 1 || rateLimits.maxConcurrency < 1) {
    throw new Error("rateLimits must define positive daily job limits and maxConcurrency");
  }

  return {
    id: required(input.id || `campaign-auth-${Date.now()}`, "authorization id"),
    campaignId: campaign.id,
    status: "active",
    platforms: [...new Set(destinations.map((item) => item.platform))],
    destinations,
    approvedAssets,
    contentBoundary: contentBoundaryNormalized,
    audienceRules: { allowedAudiences },
    schedule: { timezone, weekdays, startLocal, endLocal },
    rateLimits,
    validFrom: new Date(fromMs).toISOString(),
    validUntil: new Date(untilMs).toISOString(),
    approvedAt: now.toISOString(),
    campaignBinding: campaignScopeFingerprint(campaign)
  };
}

export function campaignAuthorizationFingerprint(authorization) {
  const { approvedAt, approvedBy, activatedAt, updatedAt, binding, status, ...scope } = authorization;
  return digest(scope);
}

function localClock(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((part) => part.type === "weekday")?.value);
  const result = {
    weekday: weekdayIndex,
    date: `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`,
    time: `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`
  };
  if (result.weekday < 0 || !result.date || !result.time) throw new Error("Campaign schedule clock could not be resolved");
  return result;
}

export function evaluateCampaignAuthorization(post, state, now = new Date()) {
  const authorization = (state.campaignAuthorizations || []).find((item) => item.id === post.campaignAuthorizationId);
  if (!authorization || authorization.campaignId !== post.campaignId) return { allowed: false, reasons: ["campaign_authorization_missing"] };
  const campaign = (state.campaigns || []).find((item) => item.id === post.campaignId);
  const target = (state.targets || []).find((item) => item.id === post.targetId);
  const account = target ? (state.executionAccounts || []).find((item) => item.id === executionAccountKey(target.channel, target.accountId)) : null;
  const reasons = [];
  if (!campaign || campaign.status !== "active") reasons.push("campaign_not_active");
  if (!SUPPORTED_AUTH_STATUSES.has(authorization.status) || authorization.status !== "active") reasons.push("campaign_authorization_not_active");
  if (authorization.binding !== campaignAuthorizationFingerprint(authorization)) reasons.push("campaign_authorization_binding_stale");
  if (post.campaignAuthorizationBinding !== authorization.binding) reasons.push("job_authorization_binding_stale");
  if (!Number.isFinite(Date.parse(authorization.validFrom)) || now < new Date(authorization.validFrom)) reasons.push("campaign_authorization_not_yet_valid");
  if (!Number.isFinite(Date.parse(authorization.validUntil)) || now > new Date(authorization.validUntil)) reasons.push("campaign_authorization_expired");
  if (!campaign || authorization.campaignBinding !== campaignScopeFingerprint(campaign)) reasons.push("campaign_scope_changed");
  if (!target) reasons.push("target_missing");
  if (!account || account.status !== "enabled") reasons.push("execution_account_unavailable");
  if (account && target?.profileId !== account.profileId) reasons.push("execution_profile_mismatch");
  const destination = authorization.destinations?.find((item) => item.targetId === post.targetId && item.platform === target?.channel && item.accountId === target?.accountId && item.targetUrl === target?.url && item.profileId === account?.profileId && target?.profileId === account?.profileId);
  if (!destination) reasons.push("destination_not_authorized");
  if (post.assetPath) {
    const asset = authorization.approvedAssets?.find((item) => item.artifactId === post.artifactId && item.sha256 === post.assetSha256);
    if (!asset) reasons.push("asset_not_authorized");
    const artifact = (state.artifacts || []).find((item) => item.id === post.artifactId);
    let pathsMatch = false;
    try { pathsMatch = Boolean(artifact?.path && post.assetPath && path.resolve(artifact.path) === path.resolve(post.assetPath)); } catch {}
    if (!artifact || artifact.campaignId !== post.campaignId || artifact.status !== "verified" || artifact.sha256 !== post.assetSha256 || !pathsMatch) reasons.push("asset_evidence_missing_or_stale");
  } else if (post.artifactId || post.assetSha256) {
    reasons.push("asset_path_missing");
  }
  const content = String(post.content || "");
  const boundary = authorization.contentBoundary || {};
  if (boundary.mode === "approved_copy_set") {
    if (!boundary.contentHashes?.includes(campaignContentHash(content))) reasons.push("content_not_in_approved_copy_set");
  } else if (boundary.mode === "approved_template_set") {
    const approved = new Set((boundary.approvedClaims || []).map((claim) => claim.id));
    const claimIds = Array.isArray(post.claimIds) ? post.claimIds : [];
    const template = boundary.templates?.find((item) => item.id === post.templateId && item.platform === target?.channel);
    if (!template || claimIds.length === 0 || claimIds.some((id) => !approved.has(id))) reasons.push("content_template_scope_invalid");
    if (template) {
      const claims = new Map((boundary.approvedClaims || []).map((claim) => [claim.id, claim]));
      const templateClaimIds = [...template.template.matchAll(/\{\{claim:([a-zA-Z0-9_.-]+)\}\}/g)].map((match) => match[1]);
      const expectedIds = [...new Set(templateClaimIds)].sort();
      if (JSON.stringify([...new Set(claimIds)].sort()) !== JSON.stringify(expectedIds)) reasons.push("content_template_claim_binding_mismatch");
      let expectedContent = template.template.replace(/\{\{claim:([a-zA-Z0-9_.-]+)\}\}/g, (_, id) => claims.get(id)?.text || "");
      expectedContent = expectedContent.replace(/\{\{disclosure\}\}/g, (boundary.requiredDisclosures || []).join("\n"));
      if (content !== expectedContent) reasons.push("content_outside_approved_template");
    }
    const suppliedSources = new Set((Array.isArray(post.contentSourceRefs) ? post.contentSourceRefs : []).map((reference) => typeof reference === "string" ? reference : `${reference.relativePath}#${reference.sha256}`));
    for (const claim of (boundary.approvedClaims || []).filter((item) => claimIds.includes(item.id))) {
      if (claim.sourceRefs.some((reference) => !suppliedSources.has(`${reference.relativePath}#${reference.sha256}`))) reasons.push("content_source_binding_missing");
    }
  } else reasons.push("content_boundary_invalid");

  if ((boundary.forbiddenTerms || []).some((term) => content.toLocaleLowerCase("en-US").includes(term))) reasons.push("forbidden_content_term");
  if ((boundary.requiredDisclosures || []).some((disclosure) => !content.includes(disclosure))) reasons.push("required_disclosure_missing");
  const maxChars = Number(boundary.maxCharactersByPlatform?.[target?.channel]);
  if (Number.isFinite(maxChars) && maxChars > 0 && content.length > maxChars) reasons.push("content_too_long_for_campaign");

  if (!authorization.audienceRules?.allowedAudiences?.includes(post.audience)) reasons.push("audience_not_authorized");
  const requestedScheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : now;
  const scheduledAtValid = Number.isFinite(requestedScheduledAt.getTime());
  if (!scheduledAtValid) reasons.push("schedule_timestamp_invalid");
  const scheduledAt = scheduledAtValid ? requestedScheduledAt : now;
  if (scheduledAt < new Date(authorization.validFrom) || scheduledAt > new Date(authorization.validUntil)) reasons.push("schedule_outside_authorization_window");
  if (scheduledAt > now) reasons.push("schedule_not_due");
  let local;
  try {
    local = localClock(scheduledAt, authorization.schedule?.timezone);
    if (!authorization.schedule.weekdays.includes(local.weekday) || local.time < authorization.schedule.startLocal || local.time > authorization.schedule.endLocal) reasons.push("schedule_outside_allowed_window");
  } catch {
    reasons.push("campaign_schedule_invalid");
    local = { date: "", weekday: -1, time: "" };
  }

  // Keep campaign-wide limits continuous across authorization renewals. A
  // superseded authorization must not reset daily quotas, spacing, concurrency,
  // or idempotency for work already created under the same campaign.
  const active = (state.posts || []).filter((item) => item.id !== post.id && item.campaignId === authorization.campaignId);
  const dayKey = local;
  const countedStatuses = new Set(["queued", "publishing", "processing", "published"]);
  const sameDay = active.filter((item) => {
    if (!countedStatuses.has(item.status)) return false;
    const time = item.publishedAt || item.queuedAt || item.scheduledAt || item.createdAt;
    if (!time) return false;
    let at;
    try { at = localClock(new Date(time), authorization.schedule.timezone); } catch { return false; }
    return at.date === dayKey.date;
  });
  if (sameDay.length >= authorization.rateLimits.maxJobsPerCampaignPerDay) reasons.push("campaign_daily_limit_reached");
  const sameAccountToday = sameDay.filter((item) => state.targets?.find((targetItem) => targetItem.id === item.targetId)?.accountId === target?.accountId);
  if (sameAccountToday.length >= authorization.rateLimits.maxJobsPerAccountPerDay) reasons.push("account_daily_limit_reached");
  const lastAccountPublication = active
    .filter((item) => ["queued", "publishing", "processing", "published"].includes(item.status))
    .filter((item) => {
      const itemTarget = state.targets?.find((targetItem) => targetItem.id === item.targetId);
      return itemTarget?.channel === target?.channel && itemTarget?.accountId === target?.accountId;
    })
    .map((item) => item.publishedAt || item.processingAt || item.publishingAt || item.queuedAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()))
    .sort((left, right) => right - left)[0];
  if (lastAccountPublication && (scheduledAt - lastAccountPublication) / 60_000 < authorization.rateLimits.minIntervalMinutes) reasons.push("campaign_minimum_interval_not_met");
  const inFlight = active.filter((item) => ["publishing", "processing"].includes(item.status));
  if (inFlight.length >= authorization.rateLimits.maxConcurrency) reasons.push("campaign_concurrency_limit_reached");

  const duplicateIdentity = post.idempotencyKey && active.some((item) => !["failed", "rejected", "removed"].includes(item.status) && (
    item.idempotencyKey === post.idempotencyKey || publicationIdentityKeysForPost(item, state).includes(post.idempotencyKey)
  ));
  if (duplicateIdentity) reasons.push("publication_identity_exists");
  const normalizedContent = normalizeDuplicateContent(post.content);
  const repeatedContent = normalizedContent && authorization.contentBoundary?.allowRepeatSameContent !== true && (state.posts || []).some((item) => {
    if (item.id === post.id || ["failed", "rejected", "removed"].includes(item.status) || normalizeDuplicateContent(item.content) !== normalizedContent) return false;
    const itemTarget = state.targets?.find((targetItem) => targetItem.id === item.targetId);
    return itemTarget?.channel === target?.channel && itemTarget?.accountId === target?.accountId;
  });
  if (repeatedContent) reasons.push("duplicate_content_for_account");
  return { allowed: reasons.length === 0, reasons, authorization, target };
}
