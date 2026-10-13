function keyOf(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) throw new Error("Platform id is invalid");
  return key;
}

function normalizeHost(value) {
  return String(value || "").trim().replace(/^www\./i, "").toLowerCase();
}

function validateHttpsIdentityUrl(platform, value, { hosts, pathPattern }) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error(`Expected identity URL for ${platform} is invalid`); }
  const host = normalizeHost(url.hostname);
  if (url.protocol !== "https:" || !hosts.includes(host) || !pathPattern.test(url.pathname)) {
    throw new Error(`Expected identity URL for ${platform} does not match its platform policy`);
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export class PlatformPolicyRegistry {
  #policies = new Map();

  constructor(initial = {}) {
    const entries = initial instanceof Map ? [...initial.entries()] : Object.entries(initial || {});
    for (const [platform, policy] of entries) this.register(platform, policy);
  }

  register(platform, policy) {
    const key = keyOf(platform);
    if (!policy || typeof policy !== "object") throw new Error(`Platform policy for ${key} must be an object`);
    const allowedTargetHosts = [...new Set((policy.allowedTargetHosts || []).map(normalizeHost).filter(Boolean))];
    if (allowedTargetHosts.some((host) => !/^[a-z0-9.-]+$/.test(host))) throw new Error(`Platform policy for ${key} has an invalid target host`);
    if (policy.normalizeIdentityUrl !== undefined && typeof policy.normalizeIdentityUrl !== "function") throw new Error(`Platform policy identity normalizer for ${key} must be a function`);
    if (policy.validateTargetUrl !== undefined && typeof policy.validateTargetUrl !== "function") throw new Error(`Platform policy URL validator for ${key} must be a function`);
    const normalized = {
      allowedTargetHosts,
      allowTargetSubdomains: policy.allowTargetSubdomains === true,
      normalizeIdentityUrl: policy.normalizeIdentityUrl || null,
      validateTargetUrl: policy.validateTargetUrl || null,
      targetUrlError: String(policy.targetUrlError || "").trim() || null,
      requiresIdentityUrl: policy.requiresIdentityUrl === true,
      defaultTargets: Array.isArray(policy.defaultTargets) ? structuredClone(policy.defaultTargets) : []
    };
    if (this.#policies.has(key)) throw new Error(`Platform policy is already registered: ${key}`);
    this.#policies.set(key, normalized);
    return normalized;
  }

  resolve(platform) { return this.#policies.get(keyOf(platform)) || null; }
  has(platform) { return this.#policies.has(keyOf(platform)); }
  platforms() { return [...this.#policies.keys()].sort(); }

  allowsTargetUrl(platform, value) {
    const policy = this.resolve(platform);
    if (!policy) return false;
    let url;
    try { url = new URL(String(value)); } catch { return false; }
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    const host = normalizeHost(url.hostname);
    const hostAllowed = policy.allowedTargetHosts.some((allowed) => host === allowed || (policy.allowTargetSubdomains && host.endsWith(`.${allowed}`)));
    return hostAllowed && (!policy.validateTargetUrl || policy.validateTargetUrl(url));
  }

  allowsCommunityUrl(platform, value) {
    const policy = this.resolve(platform);
    if (!policy) return false;
    let url;
    try { url = new URL(String(value)); } catch { return false; }
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    const host = normalizeHost(url.hostname);
    const hostAllowed = policy.allowedTargetHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    return hostAllowed;
  }

  targetUrlError(platform, value) {
    const policy = this.resolve(platform);
    if (!policy) return null;
    let url;
    try { url = new URL(String(value)); } catch { return null; }
    const host = normalizeHost(url.hostname);
    const hostAllowed = policy.allowedTargetHosts.some((allowed) => host === allowed || (policy.allowTargetSubdomains && host.endsWith(`.${allowed}`)));
    if (!hostAllowed) return null;
    return policy.validateTargetUrl && !policy.validateTargetUrl(url) ? policy.targetUrlError : null;
  }

  normalizeIdentityUrl(platform, value) {
    const policy = this.resolve(platform);
    if (!policy) {
      if (!value) return null;
      throw new Error(`No platform policy is registered for ${platform}`);
    }
    if (!value) {
      if (policy.requiresIdentityUrl) throw new Error(`Expected identity URL is required for ${platform}`);
      return null;
    }
    if (!policy.normalizeIdentityUrl) throw new Error(`Identity URL verification is not configured for ${platform}`);
    return policy.normalizeIdentityUrl(String(value));
  }

  defaultTargets() {
    return [...this.#policies.values()].flatMap((policy) => structuredClone(policy.defaultTargets));
  }
}

export const defaultPlatformPolicies = new PlatformPolicyRegistry({
  facebook_group: { allowedTargetHosts: ["facebook.com"] },
  facebook: { allowedTargetHosts: ["facebook.com"] },
  threads: { allowedTargetHosts: ["threads.net", "threads.com"] },
  reddit: {
    allowedTargetHosts: ["reddit.com"],
    targetUrlError: "Reddit target URL must identify a specific subreddit or user profile",
    validateTargetUrl: (url) => /^\/(?:r\/[^/]+|user\/[^/]+)/i.test(url.pathname)
  },
  product_hunt: { allowedTargetHosts: ["producthunt.com"] },
  indie_hackers: { allowedTargetHosts: ["indiehackers.com"] },
  linkedin: {
    allowedTargetHosts: ["linkedin.com", "lnkd.in"],
    requiresIdentityUrl: true,
    normalizeIdentityUrl: (value) => validateHttpsIdentityUrl("linkedin", value, {
      hosts: ["linkedin.com"],
      pathPattern: /^\/(?:in|company)\/[^/]+\/?$/i
    }),
    defaultTargets: [{
      id: "target_linkedin_global",
      channel: "linkedin",
      name: "LinkedIn professional audience",
      url: "https://www.linkedin.com/feed/?shareActive=true",
      accountId: "linkedin_primary",
      status: "needs_review",
      rulesStatus: "not_required",
      locale: "en"
    }]
  }
});
