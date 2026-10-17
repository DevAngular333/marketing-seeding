// Small DOM-free browser fixture used to exercise the transport boundary
// without opening a social site or invoking a publication control.
export class ClickTransportFixture {
  constructor() {
    this.dialog = { id: "composer-1", visible: true };
    this.editor = { text: "safe fixture", owner: this.dialog };
    this.button = { ref: "post-like", visible: true, enabled: true, attached: true, owner: this.dialog };
    this.overlay = null;
    this.clicks = 0;
    this.transitions = [];
  }

  observe() {
    const hitTargetMatched = this.button.attached && this.button.visible && !this.overlay;
    return {
      dialog: { id: this.dialog.id, visible: this.dialog.visible },
      editor: { text: this.editor.text, ownerId: this.editor.owner?.id || null },
      control: {
        ref: this.button.ref, visible: this.button.visible, enabled: this.button.enabled,
        attached: this.button.attached, ownerId: this.button.owner?.id || null,
        composerMatched: this.button.owner === this.dialog,
        hitTargetMatched, actionable: Boolean(this.button.visible && this.button.enabled && this.button.attached && this.button.owner === this.dialog && hitTargetMatched)
      }
    };
  }

  click(ref) {
    if (ref !== this.button.ref) throw new Error("fixture control ref mismatch");
    const before = this.observe();
    if (!before.control.actionable) return { emitted: false, before, after: before };
    this.clicks += 1;
    this.transitions.push("focus_changed");
    this.button.enabled = false;
    const after = this.observe();
    return { emitted: true, before, after };
  }
}

