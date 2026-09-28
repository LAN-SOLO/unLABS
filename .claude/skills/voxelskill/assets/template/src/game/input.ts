/** Keyboard state by KeyboardEvent.code (layout-independent: 'KeyW' is W on QWERTY, Z on AZERTY). */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True once per key press; call endFrame() after each frame. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
