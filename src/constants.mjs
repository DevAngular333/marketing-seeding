export const POST_STATUSES = Object.freeze([
  "draft",
  "needs_review",
  "approved",
  "queued",
  "publishing",
  "processing",
  "published",
  "removed",
  "failed",
  "paused",
  "rejected"
]);

export const TRANSITIONS = Object.freeze({
  draft: ["needs_review", "approved", "rejected"],
  needs_review: ["draft", "approved", "rejected"],
  approved: ["queued", "paused", "rejected"],
  queued: ["publishing", "paused", "failed"],
  publishing: ["processing", "published", "failed"],
  processing: ["published", "failed"],
  published: ["paused", "removed"],
  removed: ["needs_review", "rejected"],
  failed: ["needs_review", "rejected"],
  paused: ["needs_review", "approved", "queued"],
  rejected: ["draft"]
});

export const CHANNELS = Object.freeze({
  facebook_group: {
    label: "Facebook Groups",
    dailyLimitPerAccount: 3,
    minimumIntervalMinutes: 45,
    requiresRulesReview: true,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  threads: {
    label: "Threads",
    maxContentChars: 500,
    dailyLimitPerAccount: 3,
    minimumIntervalMinutes: 60,
    requiresRulesReview: false,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  reddit: {
    label: "Reddit",
    dailyLimitPerAccount: 3,
    minimumIntervalMinutes: 60,
    requiresRulesReview: true,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  product_hunt: {
    label: "Product Hunt",
    dailyLimitPerAccount: 1,
    minimumIntervalMinutes: 1440,
    requiresRulesReview: true,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  indie_hackers: {
    label: "Indie Hackers",
    dailyLimitPerAccount: 1,
    minimumIntervalMinutes: 720,
    requiresRulesReview: true,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  linkedin: {
    label: "LinkedIn",
    maxContentChars: 3000,
    dailyLimitPerAccount: 3,
    minimumIntervalMinutes: 60,
    requiresRulesReview: false,
    requiresHumanApproval: true,
    replyRequiresApproval: true
  },
  email: {
    label: "Email có đồng ý nhận tin",
    dailyLimitPerAccount: 50,
    minimumIntervalMinutes: 5,
    requiresRulesReview: true,
    requiresHumanApproval: true,
    replyRequiresApproval: true,
    requiresConsent: true
  }
});

export function nowIso(now = new Date()) {
  return now.toISOString();
}
