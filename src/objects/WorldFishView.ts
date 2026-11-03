import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { FishRig } from '../art/fish/rig';
import { worldFishTex } from '../art/fish/worldFish';

/**
 * Die sichtbare Gestalt eines festen Weltfisches (art/fish/worldFish.ts): ein Container (`root`) mit dem Fisch-Rig. Das Arcade-Sprite des Tiers
 * (Animal) bleibt Logik- und Physikträger – Größe, Trefferfläche, Biss und Verhalten ändern sich nicht –, diese Ansicht folgt ihm:
 * Ort, Richtung, Winkel, Größe (auch Stauchen beim Biss), Deckkraft, Tiefe und Einfärbung werden aus dem Sprite übernommen.
 * Pro Bild wird nur die Pose gerechnet; die Texturen entstehen einmal je Art.
 */
export class WorldFishView {
  readonly rig: FishRig;
  /** die Wurzel der Ansicht (Ursprung = Mitte der Zeichnung): Ort, Drehung, Größe, Deckkraft und Tiefe setzt man hier */
  readonly root: Phaser.GameObjects.Container;
  private holder: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private open = 0;
  private lunge = 0;
  private coil = 0;
  private tintKey = '';
  /** Entwickler (Werkstatt): hält das Maul auf diesem Öffnungsgrad */
  holdOpen = 0;

  constructor(scene: Phaser.Scene, readonly def: SpeciesDef, texW: number) {
    this.scene = scene;
    this.root = new Phaser.GameObjects.Container(scene, 0, 0);
    const { T } = worldFishTex(scene, def, texW);
    this.rig = new FishRig(scene, T);
    // Der Ursprung des Containers ist die Mitte der Zeichnung (wie beim Sprite, dessen Bild auf seinen Inhalt zugeschnitten ist)
    const b = T.A.bounds, s = T.A.s;
    this.holder = new Phaser.GameObjects.Container(scene, -((b.x0 + b.x1) / 2) * s, -((b.y0 + b.y1) / 2) * s);
    this.holder.add(this.rig.parts);
    this.root.add(this.holder);
    scene.add.existing(this.root);
  }

  /**
   * Ein Bild der Bewegung. `speed01`: Schwimmtempo 0 … 1, `jaw`: das Maul, wie es die Logik des Tiers zeigt (0 zu, 1 halb offen = Ausholen,
   * 2 weit auf = Zuschnappen). Öffnung, Vorstoß und Krümmung folgen weich, damit die Phasen ineinander übergehen.
   */
  animate(dt: number, speed01: number, jaw: 0 | 1 | 2, tUp = 0) {
    const k = Math.min(1, dt * 16);
    const tOpen = jaw === 2 ? 1 : jaw === 1 ? 0.55 : 0;
    const tLunge = jaw === 2 ? 1 : jaw === 1 ? -0.45 : 0;
    const tCoil = jaw === 1 ? 0.8 : 0;
    this.open += (tOpen - this.open) * k;
    this.lunge += (tLunge - this.lunge) * k;
    this.coil += (tCoil - this.coil) * Math.min(1, dt * 10);
    const moving = speed01 > 0.04;
    this.rig.pose({
      t: this.scene.time.now / 1000, dt, speed01, mode: moving ? 'swim' : 'idle',
      open: Math.max(this.open, this.holdOpen), lunge: this.lunge, clench: 0, grind: 0, coil: this.coil, dip: 0, pitch: tUp, still: 0, crawlPhase: 0,
    });
    this.rig.eyes(0, 0.95 * Math.min(1, Math.max(tOpen, this.open) / 0.55));
  }

  /** Einfärbung des Tieres übernehmen (Treffer, Wut, Trübe): `color` null = keine; `fill` = vollflächig (weißer Blitz). */
  setTintState(color: number | null, fill: boolean) {
    const key = color === null ? '' : (fill ? 'f' : 'm') + color;
    if (key === this.tintKey) return;
    this.tintKey = key;
    for (const o of this.rig.parts) {
      if (o instanceof Phaser.GameObjects.Mesh2D) {
        const mesh = o as unknown as { clearTint(): void; setTint(c: number): void; setTintMode(m: number): void };
        if (color === null) {
          mesh.setTintMode(Phaser.TintModes.MULTIPLY);
          mesh.clearTint();
        } else {
          mesh.setTintMode(fill ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
          mesh.setTint(color);
        }
      } else if (o instanceof Phaser.GameObjects.Image) {
        if (color === null) {
          o.setTintMode(Phaser.TintModes.MULTIPLY);
          o.clearTint();
        } else {
          o.setTintMode(fill ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
          o.setTint(color);
        }
      }
    }
  }

  destroy() {
    this.root.destroy();
  }
}
