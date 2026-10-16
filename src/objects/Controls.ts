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
      left: k(K.LEFT, K.A),
      right: k(K.RIGHT, K.D),
      up: k(K.UP, K.W),
      down: k(K.DOWN, K.S),
      jump: k(K.SPACE, K.UP, K.W),
      bite: k(K.J, K.X, K.Y),
      sprint: k(K.SHIFT, K.K),
      ram: k(K.R, K.V),
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
