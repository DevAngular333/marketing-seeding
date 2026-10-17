export class BrowserInteractionFixture {
  constructor() { this.reset(); }

  reset() {
    this.popoverOpen = false;
    this.comboboxExpanded = false;
    this.focused = null;
    this.target = { id: "safe-menu", attached: true, visible: true, enabled: true, x: 10, y: 10 };
    this.overlay = false;
    this.clicks = 0;
  }

  state() {
    return {
      popoverOpen: this.popoverOpen,
      comboboxExpanded: this.comboboxExpanded,
      focused: this.focused,
      targetId: this.target.id,
      attached: this.target.attached,
      visible: this.target.visible,
      enabled: this.target.enabled,
      hitTargetMatched: this.target.attached && this.target.visible && !this.overlay
    };
  }

  targetRef() { return { targetRef: this.target.id, targetIdentity: this.target.id }; }

  preflight() {
    const state = this.state();
    if (!state.attached) throw Object.assign(new Error("target detached"), { code: "TARGET_DETACHED" });
    if (!state.hitTargetMatched) throw Object.assign(new Error("overlay intercepted target"), { code: "OVERLAY_INTERCEPTED" });
    if (!state.visible || !state.enabled) throw Object.assign(new Error("target not actionable"), { code: "TARGET_NOT_ACTIONABLE" });
    return { status: "PASSED", actionable: true, hitTargetMatched: true };
  }

  click(target) {
    if (target.targetRef !== this.target.id) throw Object.assign(new Error("stale target"), { code: "STALE_TARGET" });
    this.preflight();
    this.clicks += 1;
    this.focused = this.target.id;
    this.popoverOpen = !this.popoverOpen;
    return { status: "COMMAND_COMPLETED", transport: "fixture", elementRef: this.target.id };
  }
}
