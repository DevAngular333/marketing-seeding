import { validateExecutionReceiptV1 } from "./execution-contracts.mjs";

function readinessResult(request) {
  return {
    state: String(request.readiness.state).toUpperCase(),
    checkedAt: request.readiness.checkedAt,
    reasonCode: "execution_readiness_fresh"
  };
}

function errorClass(result, dryRun) {
  if (dryRun && result.submitState === "NOT_STARTED" && !result.reasonCode) return "NONE";
  return result.errorClassification || (result.submitState === "CONFIRMED" ? "NONE" : result.submitState === "UNKNOWN" ? "PLATFORM_ERROR" : "VALIDATION_ERROR");
}

function recoveryClass(result) {
  if (result.recoveryClassification) return result.recoveryClassification;
  if (result.submitState === "UNKNOWN" || result.submitState === "SUBMIT_SENT") return "UNKNOWN";
  return "NONE";
}

export class JevExecutionWorker {
  constructor({ service, adapters, workerId = `jev-${process.pid}`, env = process.env, leaseMs = 120_000, now = () => new Date() } = {}) {
    if (!service) throw new Error("JEV worker requires the control-plane service");
    this.service = service;
    this.adapters = adapters instanceof Map ? adapters : new Map(Object.entries(adapters || {}));
    this.workerId = String(workerId).trim();
    if (!this.workerId) throw new Error("workerId is required");
    this.env = env;
    this.leaseMs = leaseMs;
    this.now = now;
  }

  #liveEnabled(executionId, context) {
    if (this.env.SEEDING_JEV_LIVE_ENABLED !== "true" || context.authorization?.allowLiveExecution !== true) return false;
    if (context.request.testJob === true) return this.env.SEEDING_JEV_LIVE_EXECUTION_ID === executionId;
    return this.env.SEEDING_JEV_AUTONOMOUS_LIVE_ENABLED === "true";
  }

  #receipt(requestRow, request, result, { dryRun = false, reconciliation = false } = {}) {
    const finishedAt = result.finishedAt || this.now().toISOString();
    const startedAt = result.startedAt || finishedAt;
    return validateExecutionReceiptV1({
      schemaVersion: 1,
      executionId: request.executionId,
      jobId: request.jobId,
      attempt: requestRow.attempt,
      startedAt,
      finishedAt,
      readinessResult: result.readinessResult || readinessResult(request),
      submitState: result.submitState || "FAILED",
      dryRun,
      publicationUrl: result.publicationUrl || null,
      publicationReference: result.publicationReference || null,
      publicationEvidence: result.publicationEvidence || undefined,
      reconciliation,
      errorClassification: errorClass(result, dryRun),
      recoveryClassification: recoveryClass(result),
      telemetry: {
        durationMs: Math.max(0, Math.trunc(result.durationMs || Date.parse(finishedAt) - Date.parse(startedAt) || 0)),
        browserCommands: Math.max(0, Math.trunc(result.browserCommands || 0)),
        computerUseCalls: Math.max(0, Math.trunc(result.computerUseCalls || 0)),
        retries: Math.max(0, Math.trunc(result.retries || 0))
      }
    });
  }

  async run(executionId, { dryRun = true } = {}) {
    const initial = await this.service.executionContext(executionId);
    if (initial.requestRow.state !== "REQUEST_READY" || initial.requestRow.submitState !== "NOT_STARTED") {
      return { status: "NOT_DISPATCHABLE", executionId, state: initial.requestRow.state };
    }
    const leaseResult = await this.service.acquireExecutionLease(executionId, this.workerId, { leaseMs: this.leaseMs });
    if (!leaseResult.acquired) return { status: "LEASE_BUSY", executionId, reason: leaseResult.reason };
    const lease = leaseResult.lease;
    let leaseLost = false;
    let heartbeatBusy = false;
    const heartbeat = setInterval(async () => {
      if (heartbeatBusy || leaseLost) return;
      heartbeatBusy = true;
      try {
        if (!await this.service.renewExecutionLease(lease.id, lease.token, { leaseMs: this.leaseMs })) leaseLost = true;
      } catch { leaseLost = true; }
      finally { heartbeatBusy = false; }
    }, Math.max(1_000, Math.floor(this.leaseMs / 3)));
    heartbeat.unref?.();
    try {
      if (initial.request.platform !== "linkedin") return { status: "UNSUPPORTED_PLATFORM", executionId, platform: initial.request.platform };
      if (!initial.account || initial.account.status !== "enabled" || initial.account.profileId !== initial.request.profileId || !initial.account.expectedIdentityUrl) {
        return { status: "HUMAN_REQUIRED", executionId, reasonCode: "account_profile_binding_invalid" };
      }

      const readiness = await this.service.refreshCampaignJobReadiness(initial.post.id, this.workerId, { force: true });
      if (readiness.status !== "queued" || readiness.readinessState !== "READY") {
        return { status: readiness.readinessState || "BLOCKED", executionId, reasonCodes: readiness.reasons || [] };
      }
      const refreshed = await this.service.prepareExecutionRequest(initial.post.id, this.workerId);
      if (refreshed.executionId !== executionId || refreshed.state !== "REQUEST_READY") {
        return { status: "NOT_DISPATCHABLE", executionId, state: refreshed.state };
      }
      if (leaseLost) return { status: "LEASE_LOST", executionId };
      const context = await this.service.executionContext(executionId);
      const adapter = this.adapters.get(context.request.platform);
      if (!adapter) return { status: "ADAPTER_UNAVAILABLE", executionId, platform: context.request.platform };
      const liveEnabled = !dryRun && this.#liveEnabled(executionId, context);
      if (!dryRun && !liveEnabled) return { status: "LIVE_NOT_AUTHORIZED", executionId };
      await this.service.markExecutionStarted(executionId, lease, { dryRun });

      const result = await adapter.execute(context.request, {
        dryRun,
        liveEnabled,
        expectedIdentityUrl: context.account.expectedIdentityUrl,
        beforeSubmitIntent: (verifiedGates) => {
          if (leaseLost) throw Object.assign(new Error("Execution lease was lost before submit"), { code: "LEASE_LOST" });
          return this.service.beginExecutionSubmitIntent(executionId, lease, {
            liveEnabled,
            liveExecutionId: this.env.SEEDING_JEV_LIVE_EXECUTION_ID,
            autonomousLiveEnabled: this.env.SEEDING_JEV_AUTONOMOUS_LIVE_ENABLED === "true",
            verifiedGates
          });
        },
        onSubmitSent: () => this.service.markExecutionSubmitSent(executionId, lease)
      });
      const receipt = this.#receipt(context.requestRow, context.request, result, { dryRun });
      await this.service.recordExecutionReceipt(executionId, receipt, `jev-worker:${this.workerId}`);
      return { status: dryRun ? "DRY_RUN_COMPLETE" : receipt.submitState, executionId, receipt };
    } finally {
      clearInterval(heartbeat);
      await this.service.releaseExecutionLease(lease.id, lease.token);
    }
  }

  async runReadyOnce({ dryRun = true } = {}) {
    const ready = await this.service.readyExecutionRequests();
    const results = [];
    for (const item of ready) {
      try {
        results.push(await this.run(item.executionId, { dryRun }));
      } catch (error) {
        results.push({ status: "WORKER_ERROR", executionId: item.executionId, reasonCode: String(error.code || "worker_error").toLowerCase() });
      }
    }
    return results;
  }

  async reconcile(executionId) {
    const initial = await this.service.executionContext(executionId);
    if (!["SUBMIT_SENT_INTENT", "SUBMIT_SENT", "SUBMIT_RESULT_UNKNOWN"].includes(initial.requestRow.state)) {
      return { status: "NOT_RECONCILABLE", executionId, state: initial.requestRow.state };
    }
    const leaseResult = await this.service.acquireExecutionLease(executionId, this.workerId, { leaseMs: this.leaseMs, mode: "reconcile" });
    if (!leaseResult.acquired) return { status: "LEASE_BUSY", executionId, reason: leaseResult.reason };
    const lease = leaseResult.lease;
    try {
      await this.service.markExecutionReconciliationAttempt(executionId);
      const context = await this.service.executionContext(executionId);
      const adapter = this.adapters.get(context.request.platform);
      if (!adapter || typeof adapter.reconcile !== "function") return { status: "VERIFIER_UNAVAILABLE", executionId };
      const result = await adapter.reconcile(context.request, { expectedIdentityUrl: context.account?.expectedIdentityUrl });
      const receipt = this.#receipt(context.requestRow, context.request, result, { reconciliation: true });
      if (!(result.submitState === "UNKNOWN" && context.requestRow.state === "SUBMIT_RESULT_UNKNOWN")) {
        await this.service.recordExecutionReceipt(executionId, receipt, `jev-worker:${this.workerId}`);
      }
      return { status: receipt.submitState, executionId, receipt };
    } finally {
      await this.service.releaseExecutionLease(lease.id, lease.token);
    }
  }

  async reconcilePendingOnce() {
    const pending = await this.service.pendingExecutionReconciliations();
    const results = [];
    for (const item of pending) {
      try {
        results.push(await this.reconcile(item.executionId));
      } catch (error) {
        results.push({ status: "RECONCILIATION_ERROR", executionId: item.executionId, reasonCode: String(error.code || "reconciliation_error").toLowerCase() });
      }
    }
    return results;
  }
}
