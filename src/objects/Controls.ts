import Phaser from 'phaser';

/** Zustand der Bildschirm-Knöpfe (Touch), wird vom HUD gesetzt. */
export const touch = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  bite: false,
  sprint: false,
  ram: false,
};

type Action = keyof typeof touch;

/** Tastatur + Touch zusammengefasst, mit "gerade gedrückt"-Erkennung. */
export class Controls {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private prev: Record<Action, boolean> = { left: false, right: false, up: false, down: false, jump: false, bite: false, sprint: false, ram: false };
  held: Record<Action, boolean> = { ...this.prev };
  pressed: Record<Action, boolean> = { ...this.prev };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const k = (...codes: number[]) => codes.map((c) => kb.addKey(c, true, false));
    this.keys = {
      // Pfeiltasten schwimmen, die linke Hand liegt auf Q W E R
      left: k(K.LEFT),
      right: k(K.RIGHT),
      up: k(K.UP),
      down: k(K.DOWN),
      jump: k(K.SPACE, K.UP),
      bite: k(K.E, K.Q, K.J),
      sprint: k(K.W, K.SHIFT),
      ram: k(K.R),
    };
  }

  clear() {
    for (const a of Object.keys(this.held) as Action[]) {
      this.held[a] = false;
      this.pressed[a] = false;
    }
  }

  update() {
    for (const a of Object.keys(this.keys) as Action[]) {
      const h = this.keys[a].some((key) => key.isDown) || touch[a];
      this.pressed[a] = h && !this.prev[a];
      this.held[a] = h;
      this.prev[a] = h;
    }
  }
}
