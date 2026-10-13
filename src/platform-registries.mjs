export const PLATFORM_ADAPTER_CONTRACT_VERSION = 1;

export const PLATFORM_CAPABILITIES = Object.freeze([
  "supportsText",
  "supportsImage",
  "supportsVideo",
  "supportsAudienceSelection",
  "supportsDirectFileAttach",
  "supportsPublicationVerification",
  "supportsPermalinkDiscovery",
  "supportsReconciliation"
]);

export const PLATFORM_ADAPTER_LIFECYCLE = Object.freeze([
  "prepareExecution",
  "navigate",
  "verifyTarget",
  "openComposer",
  "fillContent",
  "attachMedia",
  "verifyPreSubmit",
  "submit",
  "verifyPublished",
  "cleanup",
  "recover"
]);

function platformKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) throw new Error("Platform id is invalid");
  return key;
}

function entriesOf(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) return value;
  return Object.entries(value || {});
}

export function validatePlatformAdapter(platform, adapter) {
  platformKey(platform);
  if (!adapter || typeof adapter !== "object") throw new Error(`Adapter for ${platform} must be an object`);
  if (adapter.platform !== undefined && platformKey(adapter.platform) !== platformKey(platform)) throw new Error(`Adapter platform ${adapter.platform} does not match registry key ${platform}`);
  if (adapter.contractVersion !== PLATFORM_ADAPTER_CONTRACT_VERSION) throw new Error(`Adapter for ${platform} must implement contract version ${PLATFORM_ADAPTER_CONTRACT_VERSION}`);
  if (typeof adapter.execute !== "function") throw new Error(`Adapter for ${platform} must implement execute()`);
  if (typeof adapter.reconcile !== "function") throw new Error(`Adapter for ${platform} must implement reconcile()`);
  if (!adapter.capabilities || typeof adapter.capabilities !== "object") throw new Error(`Adapter for ${platform} must declare capabilities`);
  for (const capability of PLATFORM_CAPABILITIES) {
    if (typeof adapter.capabilities[capability] !== "boolean") throw new Error(`Adapter for ${platform} must declare boolean capability ${capability}`);
  }
  for (const operation of PLATFORM_ADAPTER_LIFECYCLE) {
    if (adapter[operation] !== undefined && typeof adapter[operation] !== "function") throw new Error(`Adapter operation ${platform}.${operation} must be a function`);
  }
  return adapter;
}

export class PlatformAdapterRegistry {
  #adapters = new Map();

  constructor(initial = {}) {
    for (const [platform, adapter] of entriesOf(initial)) this.register(platform, adapter);
  }

  register(platform, adapter) {
    const key = platformKey(platform);
    validatePlatformAdapter(key, adapter);
    if (this.#adapters.has(key)) throw new Error(`Platform adapter is already registered: ${key}`);
    this.#adapters.set(key, adapter);
    return adapter;
  }

  resolve(platform) { return this.#adapters.get(platformKey(platform)) || null; }
  has(platform) { return this.#adapters.has(platformKey(platform)); }
  platforms() { return [...this.#adapters.keys()].sort(); }
}

export class ReadinessProviderRegistry {
  #providers = new Map();

  constructor(initial = {}) {
    for (const [platform, provider] of entriesOf(initial)) this.register(platform, provider);
  }

  register(platform, provider) {
    const key = platformKey(platform);
    if (!provider || typeof provider.checkReadiness !== "function") throw new Error(`Readiness provider for ${key} must implement checkReadiness()`);
    if (this.#providers.has(key)) throw new Error(`Readiness provider is already registered: ${key}`);
    this.#providers.set(key, provider);
    return provider;
  }

  resolve(platform) { return this.#providers.get(platformKey(platform)) || null; }
  has(platform) { return this.#providers.has(platformKey(platform)); }
  platforms() { return [...this.#providers.keys()].sort(); }

  async checkReadiness(platform, context) {
    const provider = this.resolve(platform);
    if (!provider) return {
      state: "BLOCKED",
      reasonCode: "readiness_provider_not_registered",
      retryable: false,
      recoveryClassification: "NONE"
    };
    return provider.checkReadiness(context);
  }
}

export function normalizePublicationVerification(input) {
  const states = new Set(["CONFIRMED", "UNKNOWN", "FAILED"]);
  const state = String(input?.state || "UNKNOWN").toUpperCase();
  if (!states.has(state)) throw new Error("Publication verifier state must be CONFIRMED, UNKNOWN, or FAILED");
  const verificationEvidence = input.verificationEvidence || input.publicationEvidence || null;
  const verifiedAt = input.verifiedAt || verificationEvidence?.verifiedAt || null;
  return {
    state,
    publicationReference: input.publicationReference ? String(input.publicationReference) : null,
    publicationUrl: input.publicationUrl ? String(input.publicationUrl) : null,
    verificationEvidence,
    verifiedAt,
    reasonCode: input.reasonCode ? String(input.reasonCode) : null
  };
}
