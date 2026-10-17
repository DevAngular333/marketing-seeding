import test from "node:test";
import assert from "node:assert/strict";
import {
  OrcaAccessibilityTransport,
  OrcaPointerTransport,
  assertValidatedTransport,
  assertTransportCannotChangeAfterIntent,
  selectCertifiedTransport,
  transportReceipt
} from "../src/browser-interaction-transport.mjs";
import { certifyTransport, DEFAULT_CERTIFICATION_POLICY, summarizeCertification } from "../src/transport-certification.mjs";
import { BrowserInteractionFixture } from "./fixtures/browser-interaction-fixture.mjs";

function fixtureTransport(fixture) {
  return {
    runtimeIdentity: () => ({ transport: "fixture", provider: "local-fixture", providerVersion: "1" }),
    async click(target, options = {}) {
      await options.validate?.();
      return fixture.click(target);
    }
  };
}

test("transport receipt is distinct from activation", () => {
  const receipt = transportReceipt({ status: "COMMAND_COMPLETED", elementRef: "safe-1" }, {
    transport: "orca-accessibility", targetIdentity: "control-hash", startedAt: "2026-10-17T00:00:00.000Z", completedAt: "2026-10-17T00:00:00.100Z"
  });
  assert.equal(receipt.commandStatus, "COMMAND_COMPLETED");
  assert.equal(receipt.activation, null);
});

test("local fixture certifies stable reversible control with reset between trials", async () => {
  const fixture = new BrowserInteractionFixture();
  const record = await certifyTransport({
    transport: fixtureTransport(fixture), attempts: 10,
    identity: { transport: "fixture", providerVersion: "1" },
    createTrial: async () => ({
      reset: () => fixture.reset(),
      observeBefore: () => fixture.state(),
      resolveTarget: () => fixture.targetRef(),
      preflight: () => fixture.preflight(),
      observeAfter: () => fixture.state(),
      classifyActivation: ({ before, after }) => ({ status: before.popoverOpen !== after.popoverOpen ? "CONTROL_ACTIVATED" : "CONTROL_NOT_OBSERVED" }),
      cleanup: () => fixture.reset()
    })
  });
  assert.equal(record.certified, true);
  assert.equal(record.metrics.attempts, 10);
  assert.equal(record.metrics.commandCompleted, 10);
  assert.equal(record.metrics.positiveActivation, 10);
  assert.equal(record.metrics.activationSuccessRate, 1);
  assert.equal(summarizeCertification(record).certified, true);
});

test("certification counts stale, moving, detached, and overlay preflight failures", async () => {
  const fixture = new BrowserInteractionFixture();
  const record = await certifyTransport({
    transport: fixtureTransport(fixture), attempts: 4,
    policy: { ...DEFAULT_CERTIFICATION_POLICY, minimumAttempts: 4 },
    createTrial: async (index) => ({
      reset: () => fixture.reset(),
      observeBefore: () => fixture.state(),
      resolveTarget: () => {
        const target = fixture.targetRef();
        if (index === 0) fixture.target.id = "moved-after-resolution";
        if (index === 1) fixture.target.attached = false;
        if (index === 2) fixture.overlay = true;
        return target;
      },
      preflight: (target) => {
        if (index === 0) throw Object.assign(new Error("stale"), { code: "STALE_TARGET" });
        return fixture.preflight(target);
      },
      observeAfter: () => fixture.state(),
      classifyActivation: () => ({ status: "CONTROL_NOT_OBSERVED" }),
      cleanup: () => fixture.reset()
    })
  });
  assert.equal(record.metrics.attempts, 4);
  assert.equal(record.metrics.preflightRejections, 3);
  assert.equal(record.metrics.staleTarget, 2);
  assert.equal(record.metrics.hitTargetDrift, 1);
  assert.equal(record.certified, false);
});

test("selection is deterministic and transport cannot switch after durable intent", () => {
  const a = { runtimeIdentity: () => ({ transport: "orca-accessibility", providerVersion: "1.4.227" }) };
  const b = { runtimeIdentity: () => ({ transport: "playwright-pointer", providerVersion: "1.56.0" }) };
  const selected = selectCertifiedTransport({ transports: [b, a], platform: "linkedin", runtime: { providerVersion: "1.4.227" }, certifications: [{ transport: "orca-accessibility", providerVersion: "1.4.227", certified: true }] });
  assert.equal(selected, a);
  assert.throws(() => assertTransportCannotChangeAfterIntent({ selectedTransport: "orca-accessibility", requestedTransport: "playwright-pointer", intentPersisted: true }), /cannot change/);
  assert.equal(assertTransportCannotChangeAfterIntent({ selectedTransport: "orca-accessibility", requestedTransport: "playwright-pointer", intentPersisted: false }), "orca-accessibility");
});

test("final-submit validation contract rejects an unmarked custom transport", () => {
  assert.throws(() => assertValidatedTransport({ async click() {} }), /not certified/);
  const transport = new OrcaAccessibilityTransport({ async click() {} });
  assert.equal(assertValidatedTransport(transport), transport);
});

test("ORCA accessibility transport preserves normalized receipt", async () => {
  const browser = {
    runtimeVersion: "1.4.227",
    async click(pageId, ref, { validate }) { assert.equal(pageId, "page"); assert.equal(ref, "e1"); await validate(); return { status: "COMMAND_COMPLETED", providerResult: { clicked: ref } }; },
    browserCommandCount: () => 1
  };
  const transport = new OrcaAccessibilityTransport(browser);
  const receipt = await transport.click({ pageId: "page", targetRef: "e1", targetIdentity: "hash" }, { validate: async () => ({ status: "PASSED" }) });
  assert.equal(receipt.status, "COMMAND_COMPLETED");
  assert.equal(receipt.commandStatus, "COMMAND_COMPLETED");
  assert.equal(receipt.targetIdentity, "hash");
  assert.equal(receipt.transport, "orca-accessibility");
});

test("ORCA pointer transport uses one validated normal pointer sequence", async () => {
  const calls = [];
  const browser = {
    runtimeVersion: "1.4.227",
    async mouseMove(pageId, x, y) { calls.push(["move", pageId, x, y]); return {}; },
    async mouseDown(pageId, button) { calls.push(["down", pageId, button]); return {}; },
    async mouseUp(pageId, button) { calls.push(["up", pageId, button]); return { released: true }; }
  };
  const transport = new OrcaPointerTransport(browser);
  const receipt = await transport.click({ pageId: "page", targetRef: "safe", targetIdentity: "hash", boundingBox: { x: 10, y: 20, width: 80, height: 30 } }, { validate: async () => ({ status: "PASSED", hitTargetMatched: true }) });
  assert.equal(receipt.commandStatus, "COMMAND_COMPLETED");
  assert.deepEqual(calls, [["move", "page", 50, 35], ["down", "page", "left"], ["up", "page", "left"]]);
  assert.equal(receipt.activation, null);
});

test("ORCA pointer transport emits no pointer input when final validation fails", async () => {
  const calls = [];
  const browser = {
    async mouseMove(...args) { calls.push(["move", ...args]); },
    async mouseDown(...args) { calls.push(["down", ...args]); },
    async mouseUp(...args) { calls.push(["up", ...args]); }
  };
  const transport = new OrcaPointerTransport(browser);
  await assert.rejects(
    transport.click({ pageId: "page", targetRef: "safe", boundingBox: { x: 10, y: 20, width: 80, height: 30 } }, {
      validate: async () => { throw Object.assign(new Error("target moved"), { code: "HIT_TARGET_DRIFT" }); }
    }),
    /target moved/
  );
  assert.deepEqual(calls, []);
});
