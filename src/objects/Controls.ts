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
  talk: false,
  call: false,
};

type Action = keyof typeof touch;

/**
 * Bildschirm-Knöpfe, die gerade angetippt wurden (das HUD setzt sie beim Antippen): Ein kurzes Tippen zählt, auch wenn der
 * Finger schon vor dem nächsten Bild wieder oben ist.
 */
export const tapped: Partial<Record<Action, boolean>> = {};

/**
 * Tastatur + Touch zusammengefasst, mit "gerade gedrückt"-Erkennung. Ein Tastendruck wird gemerkt, bis das Spiel ihn abholt –
 * sonst ginge ein kurzer Druck verloren, der zwischen zwei Bildern schon wieder losgelassen wurde (auch Phasers JustDown
 * vergisst ihn dann). Gehaltene Tasten wiederholen sich dabei nicht.
 */
export class Controls {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private prev: Record<Action, boolean> = { left: false, right: false, up: false, down: false, jump: false, bite: false, sprint: false, ram: false, talk: false, call: false };
  held: Record<Action, boolean> = { ...this.prev };
  pressed: Record<Action, boolean> = { ...this.prev };
  /** seit dem letzten Bild gedrückte Tasten (Tastencodes) – auch die, die schon wieder losgelassen sind */
  private hit = new Set<number>();

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
      // Ansprechen: wer nah genug bei einem Artgenossen ist, der etwas zu erzählen hat
      talk: k(K.F, K.ENTER),
      // deine Gruppe rufen bzw. fortschicken (sobald sie auf deinen Ruf kommt)
      call: k(K.S),
    };
    const onDown = (e: KeyboardEvent) => {
      if (!e.repeat) this.hit.add(e.keyCode);
    };
    kb.on('keydown', onDown);
    scene.events.once('shutdown', () => kb.off('keydown', onDown));
  }

  /** Gerade gesperrt (Gespräch, Szene): Was gedrückt wurde, verfällt – es soll danach nicht nachträglich wirken. */
  clear() {
    this.hit.clear();
    for (const a of Object.keys(this.held) as Action[]) {
      this.held[a] = false;
      this.pressed[a] = false;
      this.prev[a] = touch[a];
      tapped[a] = false;
    }
  }

  update() {
    for (const a of Object.keys(this.keys) as Action[]) {
      const t = touch[a];
      // seit dem letzten Bild gedrückt (auch wenn schon wieder losgelassen)
      const down = this.keys[a].some((key) => this.hit.has(key.keyCode)) || (t && !this.prev[a]) || !!tapped[a];
      this.pressed[a] = down;
      this.held[a] = down || this.keys[a].some((key) => key.isDown) || t;
      this.prev[a] = t;
      tapped[a] = false;
    }
    this.hit.clear();
  }
}
