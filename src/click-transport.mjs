import { createHash } from "node:crypto";

const SAFE_TOKEN = /^[a-zA-Z0-9_.:-]{1,120}$/;

function token(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text && SAFE_TOKEN.test(text) ? text : fallback;
}

function timestamp(value) {
  if (!value) return null;
  const text = String(value);
  return Number.isFinite(Date.parse(text)) ? text : null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stableValue(child)]));
}

function elementFingerprint(value) {
  if (!value || typeof value !== "object") return null;
  return JSON.stringify(stableValue({
    id: value.id || null,
    ref: value.ref || null,
    role: value.role || null,
    tagName: value.tagName || value.tag || null,
    accessibleName: value.accessibleName || value.name || null,
    controlRef: value.controlRef || null,
    controlIdentity: value.controlIdentity || null
  }));
}

function sanitizeActiveElement(value) {
  if (!value || typeof value !== "object") return null;
  return {
    tagName: value.tagName ? String(value.tagName).slice(0, 30) : null,
    role: value.role ? String(value.role).slice(0, 40) : null,
    id: value.id ? String(value.id).slice(0, 100) : null,
    accessibleName: value.accessibleName ? String(value.accessibleName).slice(0, 120) : null,
    isTargetControl: value.isTargetControl === true
  };
}

export function controlStateHash(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value ?? null))).digest("hex");
}

export function clickPreflightEvidence(observation, checkedAt = new Date().toISOString()) {
  const control = observation?.preClickControlEvidence || observation || {};
  return {
    status: control.actionable === true && control.connected === true && control.visible === true && control.enabled === true &&
      control.hitTargetMatched === true && control.composerMatched === true ? "PASSED" : "FAILED",
    checkedAt: timestamp(checkedAt) || new Date().toISOString(),
    controlIdentity: /^[a-f0-9]{64}$/i.test(String(control.controlIdentity || "")) ? String(control.controlIdentity).toLowerCase() : null,
    controlRef: control.controlRef ? String(control.controlRef).slice(0, 100) : null,
    connected: control.connected === true,
    visible: control.visible === true,
    enabled: control.enabled === true,
    actionable: control.actionable === true,
    hitTargetMatched: control.hitTargetMatched === true,
    composerMatched: control.composerMatched === true,
    composerState: token(control.composerState, "UNKNOWN"),
    activeElement: control.activeElement && typeof control.activeElement === "object" ? {
      tagName: control.activeElement.tagName ? String(control.activeElement.tagName).slice(0, 30) : null,
      role: control.activeElement.role ? String(control.activeElement.role).slice(0, 40) : null,
      id: control.activeElement.id ? String(control.activeElement.id).slice(0, 100) : null,
      accessibleName: control.activeElement.accessibleName ? String(control.activeElement.accessibleName).slice(0, 120) : null,
      isTargetControl: control.activeElement.isTargetControl === true
    } : null,
    scrollPosition: control.scrollPosition && typeof control.scrollPosition === "object" ? {
      x: Number.isFinite(Number(control.scrollPosition.x)) ? Number(control.scrollPosition.x) : null,
      y: Number.isFinite(Number(control.scrollPosition.y)) ? Number(control.scrollPosition.y) : null
    } : null,
    stateHash: /^[a-f0-9]{64}$/i.test(String(control.stateHash || "")) ? String(control.stateHash).toLowerCase() : controlStateHash({
      composerState: control.composerState || "UNKNOWN",
      composerMatched: control.composerMatched === true,
      controlIdentity: control.controlIdentity || null,
      connected: control.connected === true,
      visible: control.visible === true,
      enabled: control.enabled === true,
      actionable: control.actionable === true,
      hitTargetMatched: control.hitTargetMatched === true
    })
  };
}

export function clickCommandEvidence(result, { elementRef, preflight, startedAt, completedAt } = {}) {
  const command = result && typeof result === "object" ? result : {};
  const commandStartedAt = timestamp(startedAt) || timestamp(command.startedAt);
  const commandCompletedAt = timestamp(completedAt) || timestamp(command.completedAt) || commandStartedAt;
  return {
    status: "COMMAND_COMPLETED",
    commandStatus: command.commandStatus || command.status || "COMMAND_COMPLETED",
    observedAt: commandCompletedAt || new Date().toISOString(),
    transport: token(command.transport, "browser.click"),
    elementRef: elementRef ? String(elementRef).slice(0, 100) : null,
    targetIdentity: command.targetIdentity ? String(command.targetIdentity).slice(0, 160) : null,
    commandStartedAt,
    commandCompletedAt,
    providerResult: command.providerResult && typeof command.providerResult === "object" ? {
      clicked: command.providerResult.clicked ? String(command.providerResult.clicked).slice(0, 100) : null
    } : null,
    diagnostics: command.diagnostics && typeof command.diagnostics === "object" ? {
      trial: Number.isSafeInteger(Number(command.diagnostics.trial)) ? Number(command.diagnostics.trial) : null
    } : null,
    preflight: preflight ? clickPreflightEvidence(preflight, preflight.checkedAt) : null
  };
}

export function controlActivationEvidence({ before, after, controlIdentity, observedAt = new Date().toISOString(), strongCandidate = false } = {}) {
  const observedTime = timestamp(observedAt) || new Date().toISOString();
  const beforeState = before || null;
  const afterState = after || null;
  if (!afterState) {
    return {
      status: "CONTROL_ACTIVATION_UNKNOWN",
      observedAt: observedTime,
      expectedTransition: "post_click_control_semantic_transition",
      observedTransitions: [],
      signals: [],
      controlIdentity: /^[a-f0-9]{64}$/i.test(String(controlIdentity || "")) ? String(controlIdentity).toLowerCase() : null,
      beforeActiveElement: sanitizeActiveElement(beforeState?.activeElement),
      afterActiveElement: null,
      beforeAriaExpanded: beforeState?.ariaExpanded ?? null,
      afterAriaExpanded: null,
      beforeRelatedComponentVisible: beforeState?.relatedComponentVisible ?? null,
      afterRelatedComponentVisible: null,
      beforeStateHash: controlStateHash(beforeState),
      afterStateHash: null,
      activationConfidence: "NONE"
    };
  }
  const signals = [];
  const changedControl = beforeState?.controlIdentity && afterState.controlIdentity && beforeState.controlIdentity !== afterState.controlIdentity;
  if (changedControl) signals.push("control_identity_changed");
  if (afterState.composerState && afterState.composerState !== beforeState?.composerState) signals.push("composer_state_changed");
  if (afterState.postButtonState && afterState.postButtonState !== beforeState?.postButtonState) signals.push("post_button_state_changed");
  if (afterState.confirmationState && !["NONE", "UNKNOWN"].includes(afterState.confirmationState)) signals.push("confirmation_ui_observed");
  if (afterState.url && beforeState?.url && afterState.url !== beforeState.url) signals.push("url_changed");
  const activeElementChanged = elementFingerprint(beforeState?.activeElement) !== elementFingerprint(afterState.activeElement);
  // Focus is useful evidence only when the browser reports that focus landed
  // on the control being observed. A background focus change is not enough to
  // claim activation of the clicked control.
  if (activeElementChanged && afterState.activeElement?.isTargetControl === true) signals.push("active_element_changed");
  if (beforeState?.ariaExpanded !== undefined && afterState.ariaExpanded !== undefined &&
      String(beforeState.ariaExpanded) !== String(afterState.ariaExpanded)) signals.push("aria_expanded_changed");
  if (beforeState?.relatedComponentVisible !== undefined && afterState.relatedComponentVisible !== undefined &&
      Boolean(beforeState.relatedComponentVisible) !== Boolean(afterState.relatedComponentVisible)) signals.push("related_component_visibility_changed");
  if (beforeState?.semanticStateHash && afterState.semanticStateHash && beforeState.semanticStateHash !== afterState.semanticStateHash) {
    signals.push("control_semantic_state_changed");
  }
  return {
    status: changedControl ? "CONTROL_CHANGED_UNEXPECTEDLY" : signals.length ? "CONTROL_ACTIVATED" : "CONTROL_NOT_OBSERVED",
    observedAt: observedTime,
    expectedTransition: "post_click_control_semantic_transition",
    observedTransitions: signals,
    signals,
    controlIdentity: /^[a-f0-9]{64}$/i.test(String(controlIdentity || "")) ? String(controlIdentity).toLowerCase() : null,
    beforeActiveElement: sanitizeActiveElement(beforeState.activeElement),
    afterActiveElement: sanitizeActiveElement(afterState.activeElement),
    beforeAriaExpanded: beforeState.ariaExpanded ?? null,
    afterAriaExpanded: afterState.ariaExpanded ?? null,
    beforeRelatedComponentVisible: beforeState.relatedComponentVisible ?? null,
    afterRelatedComponentVisible: afterState.relatedComponentVisible ?? null,
    beforeScrollPosition: beforeState.scrollPosition || null,
    afterScrollPosition: afterState.scrollPosition || null,
    beforeStateHash: controlStateHash(beforeState),
    afterStateHash: controlStateHash(afterState),
    activationConfidence: signals.length ? "HIGH" : "NONE"
  };
}

export function assertClickPreflight(observation) {
  const evidence = clickPreflightEvidence(observation);
  if (evidence.status !== "PASSED") {
    throw Object.assign(new Error("Browser click target failed immediate preflight"), {
      code: "CLICK_TARGET_PRECHECK_FAILED",
      preflight: evidence
    });
  }
  return evidence;
}

