import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertClickPreflight, clickCommandEvidence, controlActivationEvidence, controlStateHash } from "../src/click-transport.mjs";
import { validateSubmitAcceptanceEvidence } from "../src/execution-contracts.mjs";
import { OrcaCliClient } from "../src/orca-browser-client.mjs";
import { ClickTransportFixture } from "./fixtures/click-transport-fixture.mjs";

const control = (overrides = {}) => ({
  controlIdentity: "a".repeat(64), controlRef: "e13", composerState: "OPEN",
  connected: true, visible: true, enabled: true, actionable: true,
  hitTargetMatched: true, composerMatched: true, ...overrides
});

test("command completion plus a semantic UI transition records CONTROL_ACTIVATED", () => {
  const before = { composerState: "OPEN", postButtonState: "ENABLED", url: "https://www.linkedin.com/feed/" };
  const after = { composerState: "CLOSED", postButtonState: "DISAPPEARED", confirmationState: "NONE", url: before.url };
  const evidence = controlActivationEvidence({ before, after, controlIdentity: "a".repeat(64), observedAt: "2026-10-17T06:00:01.000Z" });
  assert.equal(evidence.status, "CONTROL_ACTIVATED");
  assert.deepEqual(evidence.observedTransitions, ["composer_state_changed", "post_button_state_changed"]);
  assert.equal(evidence.beforeStateHash, controlStateHash(before));
  assert.equal(evidence.afterStateHash, controlStateHash(after));
});

test("command completion with no semantic UI transition records CONTROL_NOT_OBSERVED", () => {
  const state = { composerState: "OPEN", postButtonState: "ENABLED", confirmationState: "NONE", url: "https://www.linkedin.com/feed/" };
  const evidence = controlActivationEvidence({ before: state, after: { ...state }, controlIdentity: "a".repeat(64) });
  assert.equal(evidence.status, "CONTROL_NOT_OBSERVED");
  assert.deepEqual(evidence.signals, []);
});

test("control-specific focus transition is positive activation evidence", () => {
  const evidence = controlActivationEvidence({
    before: { activeElement: { tagName: "body", id: "" }, ariaExpanded: false },
    after: { activeElement: { tagName: "button", id: "post-like", isTargetControl: true }, ariaExpanded: true }
  });
  assert.equal(evidence.status, "CONTROL_ACTIVATED");
  assert.deepEqual(evidence.signals, ["active_element_changed", "aria_expanded_changed"]);
  assert.equal(evidence.afterActiveElement.isTargetControl, true);
});

test("unrelated focus transition does not claim activation", () => {
  const evidence = controlActivationEvidence({
    before: { activeElement: { tagName: "body", id: "" } },
    after: { activeElement: { tagName: "input", id: "search", isTargetControl: false } }
  });
  assert.equal(evidence.status, "CONTROL_NOT_OBSERVED");
  assert.deepEqual(evidence.signals, []);
});

test("activation receipt serializes semantic transition evidence", () => {
  const receipt = validateSubmitAcceptanceEvidence({
    observedAt: "2026-10-17T06:00:01.000Z",
    controlActivationEvidence: {
      status: "CONTROL_ACTIVATED", observedAt: "2026-10-17T06:00:01.000Z",
      signals: ["active_element_changed", "aria_expanded_changed"],
      observedTransitions: ["active_element_changed", "aria_expanded_changed"],
      beforeActiveElement: { tagName: "body", id: "", isTargetControl: false },
      afterActiveElement: { tagName: "button", id: "safe-control", isTargetControl: true },
      beforeAriaExpanded: false, afterAriaExpanded: true,
      beforeRelatedComponentVisible: false, afterRelatedComponentVisible: true,
      beforeStateHash: "a".repeat(64), afterStateHash: "b".repeat(64), activationConfidence: "HIGH"
    }
  });
  assert.equal(receipt.controlActivationEvidence.afterActiveElement.isTargetControl, true);
  assert.equal(receipt.controlActivationEvidence.afterAriaExpanded, true);
  assert.equal(receipt.controlActivationEvidence.afterRelatedComponentVisible, true);
  assert.equal(receipt.controlActivationEvidence.activationConfidence, "HIGH");
});

test("stale, detached, covered, or disabled controls emit no input", () => {
  for (const overrides of [
    { connected: false }, { visible: false }, { enabled: false },
    { hitTargetMatched: false }, { actionable: false }, { composerMatched: false }
  ]) {
    assert.throws(() => assertClickPreflight(control(overrides)), /preflight/);
  }
});

test("a passed preflight and command receipt remain separate from activation", () => {
  const preflight = assertClickPreflight(control());
  const command = clickCommandEvidence({ transport: "orca-cli-browser-click", startedAt: "2026-10-17T06:00:00.000Z", completedAt: "2026-10-17T06:00:00.100Z" }, {
    elementRef: "e13", preflight, completedAt: "2026-10-17T06:00:00.100Z"
  });
  assert.equal(command.status, "COMMAND_COMPLETED");
  assert.equal(command.preflight.status, "PASSED");
  assert.equal(command.status === "CONTROL_ACTIVATED", false);
});

test("activation receipt supports unexpected state classification without implying acceptance", () => {
  const evidence = controlActivationEvidence({
    before: { composerState: "OPEN", postButtonState: "ENABLED" },
    after: { composerState: "OPEN", postButtonState: "DISABLED", confirmationState: "ERROR" },
    controlIdentity: "b".repeat(64)
  });
  assert.equal(evidence.status, "CONTROL_ACTIVATED");
  assert.equal(evidence.status === "PLATFORM_ACCEPTED", false);
});

test("control identity change is never reported as activation", () => {
  const evidence = controlActivationEvidence({
    before: { controlIdentity: "a".repeat(64), composerState: "OPEN" },
    after: { controlIdentity: "b".repeat(64), composerState: "CLOSED" }
  });
  assert.equal(evidence.status, "CONTROL_CHANGED_UNEXPECTEDLY");
  assert.ok(evidence.signals.includes("control_identity_changed"));
});

test("local synthetic dialog fixture emits one normal click and an observable transition", () => {
  const fixture = new ClickTransportFixture();
  const before = fixture.observe();
  const result = fixture.click("post-like");
  assert.equal(result.emitted, true);
  assert.equal(fixture.clicks, 1);
  assert.equal(result.after.control.enabled, false);
  assert.notDeepEqual(result.before, result.after);
  assert.equal(fixture.click("post-like").emitted, false, "disabled fixture control cannot be clicked again");
  assert.deepEqual(before.control.ownerId, result.after.control.ownerId);
});

test("synthetic overlay, detached, moving, and hidden controls fail before input", () => {
  const cases = [
    (fixture) => { fixture.overlay = { id: "overlay" }; },
    (fixture) => { fixture.button.attached = false; },
    (fixture) => { fixture.button.owner = { id: "other-composer" }; },
    (fixture) => { fixture.button.visible = false; }
  ];
  for (const mutate of cases) {
    const fixture = new ClickTransportFixture();
    mutate(fixture);
    const result = fixture.click("post-like");
    assert.equal(result.emitted, false);
    assert.equal(fixture.clicks, 0);
  }
});

test("Orca click receipt reports transport completion separately from activation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orca-click-fixture-"));
  const executable = path.join(directory, "orca-fixture");
  await writeFile(executable, "#!/bin/sh\nprintf '%s' '{\"ok\":true,\"result\":{\"clicked\":\"e13\"}}'\n", "utf8");
  await chmod(executable, 0o755);
  const client = new OrcaCliClient({ executable, worktree: "current" });
  const result = await client.click("page-1", "e13", { validate: async () => ({ status: "PASSED", actionable: true }) });
  assert.equal(result.status, "COMMAND_COMPLETED");
  assert.equal(result.transport, "orca-cli-browser-click");
  assert.equal(result.providerResult.clicked, "e13");
  assert.equal(result.preflight.status, "PASSED");
});

