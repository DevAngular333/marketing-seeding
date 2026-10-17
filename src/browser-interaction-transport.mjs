/**
 * Provider-neutral boundary for normal browser interaction.
 *
 * A transport receipt says that the browser automation provider completed its
 * command. It never says that the page activated the control or accepted a
 * platform submission. Those are observed by the adapter in separate layers.
 */
export class BrowserInteractionTransport {
  constructor({ id = "browser-interaction", provider = "unknown", providerVersion = null } = {}) {
    this.id = String(id);
    this.provider = String(provider);
    this.providerVersion = providerVersion ? String(providerVersion) : null;
    // A final-submit transport must prove that it runs the caller's
    // pre-provider validation immediately before emitting browser input.
    // Implementations opt into this explicit contract; LinkedIn rejects
    // unmarked transports at its submit boundary.
    this.transportContractVersion = 1;
    this.requiresPreClickValidation = true;
  }

  assertPreClickValidation({ validate } = {}) {
    if (typeof validate !== "function") {
      throw Object.assign(new Error("Browser transport requires pre-provider validation"), { code: "TRANSPORT_VALIDATION_REQUIRED" });
    }
    return true;
  }

  runtimeIdentity() {
    return {
      transport: this.id,
      provider: this.provider,
      providerVersion: this.providerVersion
    };
  }

  async health() {
    return { state: "UNKNOWN", transport: this.id, provider: this.provider, providerVersion: this.providerVersion };
  }

  async resolveTarget() {
    throw new Error(`${this.id} does not implement resolveTarget`);
  }

  async preflight() {
    throw new Error(`${this.id} does not implement preflight`);
  }

  async click() {
    throw new Error(`${this.id} does not implement click`);
  }

  async observeActivation() {
    throw new Error(`${this.id} does not implement observeActivation`);
  }
}

function timestamp(value) {
  if (!value) return new Date().toISOString();
  const text = String(value);
  return Number.isFinite(Date.parse(text)) ? text : new Date().toISOString();
}

/** Normalize provider output while preserving command/activation separation. */
export function transportReceipt(result, { transport, targetIdentity, startedAt, completedAt, diagnostics } = {}) {
  const source = result && typeof result === "object" ? result : {};
  const commandStatus = source.status === undefined || source.status === null
    ? "COMMAND_COMPLETED"
    : source.status === "COMMAND_COMPLETED" ? "COMMAND_COMPLETED" : String(source.status || "OUTCOME_UNKNOWN");
  return {
    transport: String(transport || source.transport || "browser-interaction"),
    commandStatus,
    targetIdentity: targetIdentity ? String(targetIdentity).slice(0, 160) : source.elementRef ? String(source.elementRef).slice(0, 160) : null,
    startedAt: timestamp(startedAt || source.startedAt || source.commandStartedAt),
    completedAt: timestamp(completedAt || source.completedAt || source.commandCompletedAt),
    diagnostics: diagnostics && typeof diagnostics === "object" ? diagnostics : source.diagnostics || null,
    providerResult: source.providerResult && typeof source.providerResult === "object" ? source.providerResult : null,
    // This is deliberately not called activation. Callers must observe page
    // state separately and produce controlActivationEvidence.
    activation: null
  };
}

/** First implementation: ORCA's accessibility element command. */
export class OrcaAccessibilityTransport extends BrowserInteractionTransport {
  constructor(browser, { providerVersion = browser?.runtimeVersion || process.env.ORCA_VERSION || null } = {}) {
    super({ id: "orca-accessibility", provider: "orca", providerVersion });
    if (!browser) throw new Error("ORCA accessibility transport requires a browser client");
    this.browser = browser;
  }

  async health() {
    return {
      state: "READY",
      ...this.runtimeIdentity(),
      commandCount: this.browser.browserCommandCount?.() ?? null
    };
  }

  async click({ pageId, targetRef, targetIdentity = targetRef }, { validate, diagnostics } = {}) {
    if (!pageId || !targetRef) throw Object.assign(new Error("Browser transport target is incomplete"), { code: "TRANSPORT_TARGET_INVALID" });
    if (typeof this.browser.click !== "function") throw Object.assign(new Error("ORCA accessibility click transport is unavailable"), { code: "TRANSPORT_UNAVAILABLE" });
    this.assertPreClickValidation({ validate });
    const startedAt = new Date().toISOString();
    const result = await this.browser.click(pageId, targetRef, { validate });
    const completedAt = new Date().toISOString();
    const receipt = transportReceipt(result, {
      transport: this.id,
      targetIdentity,
      startedAt,
      completedAt,
      diagnostics
    });
    // Preserve the legacy receipt fields consumed by existing execution
    // contracts while adding the normalized boundary fields.
    return {
      ...result,
      ...receipt,
      status: receipt.commandStatus,
      elementRef: String(targetRef),
      startedAt,
      completedAt
    };
  }
}

/** Normal pointer transport exposed by ORCA's browser command surface. */
export class OrcaPointerTransport extends BrowserInteractionTransport {
  constructor(browser, { providerVersion = browser?.runtimeVersion || process.env.ORCA_VERSION || null } = {}) {
    super({ id: "orca-pointer", provider: "orca", providerVersion });
    if (!browser) throw new Error("ORCA pointer transport requires a browser client");
    this.browser = browser;
  }

  async click({ pageId, targetRef, targetIdentity = targetRef, boundingBox }, { validate, diagnostics } = {}) {
    if (!pageId || !targetRef || !boundingBox) throw Object.assign(new Error("ORCA pointer target is incomplete"), { code: "TRANSPORT_TARGET_INVALID" });
    if (typeof this.browser.mouseMove !== "function" || typeof this.browser.mouseDown !== "function" || typeof this.browser.mouseUp !== "function") {
      throw Object.assign(new Error("ORCA pointer click transport is unavailable"), { code: "TRANSPORT_UNAVAILABLE" });
    }
    this.assertPreClickValidation({ validate });
    const preflight = typeof validate === "function" ? await validate() : null;
    const startedAt = new Date().toISOString();
    const x = Math.round(Number(boundingBox.x) + Number(boundingBox.width) / 2);
    const y = Math.round(Number(boundingBox.y) + Number(boundingBox.height) / 2);
    await this.browser.mouseMove(pageId, x, y);
    await this.browser.mouseDown(pageId, "left");
    const providerResult = await this.browser.mouseUp(pageId, "left");
    const completedAt = new Date().toISOString();
    return {
      ...transportReceipt({ status: "COMMAND_COMPLETED", providerResult }, { transport: this.id, targetIdentity, startedAt, completedAt, diagnostics }),
      status: "COMMAND_COMPLETED", commandStatus: "COMMAND_COMPLETED", elementRef: String(targetRef), preflight,
      startedAt, completedAt, providerResult: providerResult && typeof providerResult === "object" ? providerResult : null
    };
  }
}

export function selectCertifiedTransport({ transports = [], certifications = [], platform = "linkedin", runtime = {} } = {}) {
  const certified = new Map(certifications.filter((item) => item?.certified === true).map((item) => [item.transport, item]));
  const candidates = transports.filter((transport) => {
    const identity = transport?.runtimeIdentity?.() || {};
    const record = certified.get(identity.transport);
    if (!record) return false;
    if (record.platform && record.platform !== platform) return false;
    return !runtime.providerVersion || !record.providerVersion || String(runtime.providerVersion) === String(record.providerVersion);
  }).sort((a, b) => String(a.runtimeIdentity?.().transport || "").localeCompare(String(b.runtimeIdentity?.().transport || "")));
  if (candidates.length === 0) throw Object.assign(new Error("No certified browser interaction transport is available"), { code: "TRANSPORT_NOT_CERTIFIED" });
  return candidates[0];
}

export function assertTransportCannotChangeAfterIntent({ selectedTransport, requestedTransport, intentPersisted = false } = {}) {
  if (intentPersisted && requestedTransport && requestedTransport !== selectedTransport) {
    throw Object.assign(new Error("Browser interaction transport cannot change after durable submit intent"), { code: "TRANSPORT_SWITCH_AFTER_INTENT" });
  }
  return selectedTransport;
}

/**
 * Final-submit callers must use a transport that explicitly implements the
 * validation contract. A duck-typed click function is insufficient because it
 * could silently ignore the callback that fences the last browser input.
 */
export function assertValidatedTransport(transport) {
  if (!transport || typeof transport.click !== "function" ||
      transport.transportContractVersion !== 1 ||
      transport.requiresPreClickValidation !== true ||
      typeof transport.assertPreClickValidation !== "function") {
    throw Object.assign(new Error("Browser interaction transport is not certified for validated final input"), { code: "TRANSPORT_NOT_CERTIFIED" });
  }
  return transport;
}
