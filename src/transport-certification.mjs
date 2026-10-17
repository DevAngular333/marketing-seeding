/**
 * Deterministic, resettable certification harness. The harness is deliberately
 * callback based so it can certify a local fixture and a real browser without
 * knowing provider-specific DOM details.
 */
export const DEFAULT_CERTIFICATION_POLICY = Object.freeze({
  minimumAttempts: 10,
  minimumActivationRate: 0.95,
  maximumWrongTargetActivations: 0,
  maximumSilentFallbacks: 0
});

function emptyMetrics() {
  return {
    attempts: 0,
    commandCompleted: 0,
    positiveActivation: 0,
    noTransition: 0,
    wrongTargetActivations: 0,
    preflightRejections: 0,
    staleTarget: 0,
    hitTargetDrift: 0,
    silentFallbacks: 0,
    trials: []
  };
}

function safeError(error) {
  return error ? { code: String(error.code || "ERROR"), message: String(error.message || error).slice(0, 240) } : null;
}

/**
 * Run fresh reset/resolve/preflight/click/observe/cleanup trials.
 *
 * createTrial() must return:
 *   { reset, resolveTarget, preflight, observeBefore, observeAfter,
 *     classifyActivation, cleanup }
 * classifyActivation returns CONTROL_ACTIVATED, CONTROL_NOT_OBSERVED,
 * CONTROL_CHANGED_UNEXPECTEDLY, or WRONG_TARGET_ACTIVATION.
 */
export async function certifyTransport({ transport, createTrial, attempts = DEFAULT_CERTIFICATION_POLICY.minimumAttempts, identity = {}, policy = DEFAULT_CERTIFICATION_POLICY } = {}) {
  if (!transport || typeof transport.click !== "function") throw new Error("Certification requires a browser interaction transport");
  if (typeof createTrial !== "function") throw new Error("Certification requires a resettable trial factory");
  const metrics = emptyMetrics();
  const startedAt = new Date().toISOString();
  for (let index = 0; index < attempts; index += 1) {
    const trial = await createTrial(index);
    const record = { index: index + 1, reset: "NOT_RUN", preflight: "NOT_RUN", commandStatus: "NOT_RUN", activation: "NOT_RUN", error: null };
    try {
      await trial.reset?.();
      record.reset = "COMPLETED";
      const before = await trial.observeBefore?.();
      const target = await trial.resolveTarget();
      let preflight;
      try {
        preflight = await trial.preflight?.(target);
        if (preflight?.status === "FAILED" || preflight?.actionable === false) {
          metrics.preflightRejections += 1;
          if (preflight?.staleTarget) metrics.staleTarget += 1;
          if (preflight?.hitTargetMatched === false || preflight?.hitTargetDrift) metrics.hitTargetDrift += 1;
          record.preflight = "REJECTED";
          record.error = { code: "PREFLIGHT_REJECTED" };
          continue;
        }
        record.preflight = "PASSED";
      } catch (error) {
        metrics.preflightRejections += 1;
        if (["STALE_TARGET", "TARGET_DETACHED"].includes(error.code)) metrics.staleTarget += 1;
        if (["HIT_TARGET_DRIFT", "OVERLAY_INTERCEPTED"].includes(error.code)) metrics.hitTargetDrift += 1;
        record.preflight = "REJECTED";
        record.error = safeError(error);
        continue;
      }
      const receipt = await transport.click(target, { validate: async () => preflight, diagnostics: { trial: index + 1 } });
      record.commandStatus = receipt?.commandStatus || receipt?.status || "OUTCOME_UNKNOWN";
      if (record.commandStatus === "COMMAND_COMPLETED") metrics.commandCompleted += 1;
      const after = await trial.observeAfter?.();
      const activation = await trial.classifyActivation?.({ before, after, target, receipt });
      record.activation = activation?.status || "CONTROL_NOT_OBSERVED";
      if (record.activation === "CONTROL_ACTIVATED") metrics.positiveActivation += 1;
      else if (record.activation === "WRONG_TARGET_ACTIVATION" || record.activation === "CONTROL_CHANGED_UNEXPECTEDLY") metrics.wrongTargetActivations += 1;
      else metrics.noTransition += 1;
      if (activation?.silentFallback === true) metrics.silentFallbacks += 1;
    } catch (error) {
      record.error = safeError(error);
      if (record.commandStatus === "NOT_RUN") metrics.preflightRejections += 1;
      else metrics.noTransition += 1;
    } finally {
      try { await trial.cleanup?.(); } catch (error) { record.cleanupError = safeError(error); }
      metrics.trials.push(record);
      metrics.attempts += 1;
    }
  }
  const activationSuccessRate = metrics.attempts ? metrics.positiveActivation / metrics.attempts : 0;
  const certified = metrics.attempts >= policy.minimumAttempts &&
    activationSuccessRate >= policy.minimumActivationRate &&
    metrics.wrongTargetActivations <= policy.maximumWrongTargetActivations &&
    metrics.silentFallbacks <= policy.maximumSilentFallbacks;
  return {
    transport: identity.transport || transport.runtimeIdentity?.().transport || "browser-interaction",
    identity: { ...(transport.runtimeIdentity?.() || {}), ...identity },
    startedAt,
    finishedAt: new Date().toISOString(),
    policy: { ...policy },
    metrics: { ...metrics, activationSuccessRate },
    certified
  };
}

export function summarizeCertification(record) {
  const metrics = record?.metrics || emptyMetrics();
  return {
    transport: record?.transport || null,
    attempts: metrics.attempts,
    commandCompleted: metrics.commandCompleted,
    positiveActivation: metrics.positiveActivation,
    noTransition: metrics.noTransition,
    wrongTargetActivations: metrics.wrongTargetActivations,
    preflightRejections: metrics.preflightRejections,
    staleTarget: metrics.staleTarget,
    hitTargetDrift: metrics.hitTargetDrift,
    activationSuccessRate: metrics.activationSuccessRate || 0,
    certified: record?.certified === true
  };
}
