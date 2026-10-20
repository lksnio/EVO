import Phaser from 'phaser';
import { capture, keysOf, onKeysChanged } from '../state/keymap';

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
  private keys!: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private prev: Record<Action, boolean> = { left: false, right: false, up: false, down: false, jump: false, bite: false, sprint: false, ram: false, talk: false, call: false };
  held: Record<Action, boolean> = { ...this.prev };
  pressed: Record<Action, boolean> = { ...this.prev };
  /** seit dem letzten Bild gedrückte Tasten (Tastencodes) – auch die, die schon wieder losgelassen sind */
  private hit = new Set<number>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    // die Tasten kommen aus der Belegung (frei wählbar auf der Seite „Steuerung“); auch die Tasten für „nach oben“ lassen auftauchen
    const bind = () => {
      const k = (codes: readonly number[]) => codes.map((c) => kb.addKey(c, true, false));
      this.keys = Object.fromEntries((Object.keys(touch) as Action[]).map((a) => [a, k(a === 'jump' ? [...keysOf('jump'), ...keysOf('up')] : keysOf(a))])) as Record<Action, Phaser.Input.Keyboard.Key[]>;
    };
    bind();
    const off = onKeysChanged(bind);
    const onDown = (e: KeyboardEvent) => {
      if (!e.repeat && !capture.on) this.hit.add(e.keyCode);
    };
    kb.on('keydown', onDown);
    scene.events.once('shutdown', () => {
      kb.off('keydown', onDown);
      off();
    });
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
