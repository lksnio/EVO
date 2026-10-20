import Phaser from 'phaser';
import { clarity, farthest } from '../sim/sight';

// ---------------------------------------------------------------------------
// Die Sicht im Bild: Über allem liegt trübes Wasser (in den Farben des Hintergrunds), und nur dort, wohin der Fisch blickt,
// ist es klar – nach vorn weit, nach hinten ein kleiner Kreis. Das Wasser ist ein Bild über dem ganzen Schirm, das jedes Bild
// neu entsteht: erst das trübe Wasser, dann wird das Blickfeld (hell = klar) daraus ausradiert – an der Stelle des Fischs und
// in seine Blickrichtung gedreht. Die Rechnung dahinter steht in sim/sight.ts – dieselbe gilt für die Tiere
// (LevelScene.sightStep).
// ---------------------------------------------------------------------------

/** Kantenlänge des Blickfeld-Bilds (es ist ohnehin weich – grob genügt) */
const T = 192;
/** Auflösung des Wassers über dem Schirm (halb so fein wie das Bild – es ist weich) */
const DW = 640, DH = 360;

let uid = 0;

export class Sight {
  private veil: Phaser.GameObjects.Image;
  private dt: Phaser.Textures.DynamicTexture;
  private tex: Phaser.Textures.CanvasTexture;
  private fieldKey: string;
  /** Blickrichtung (Bogenmaß, 0 = nach rechts) – sie folgt dem Fisch weich */
  heading = 0;
  /** die Sicht, die gerade gilt (sie wächst nach einem Segen sichtbar heran) */
  shown = -1;
  private drawn = -1;
  /** so weit reicht das Blickfeld-Bild (halbe Kantenlänge, Bildpunkte der Welt) */
  private half = 1;
  /** in besonderen Momenten (Szenen mit der Kamera) lichtet sich das Wasser ganz: 0 = trüb wie immer … 1 = alles klar */
  open = 0;

  /**
   * murkKey: das trübe Wasser (Bild in Schirmgröße); view: der Bildausschnitt (Bildpunkte der Welt, fest am Schirm);
   * full: so weit ist es vom Fisch bis zum Bildrand vor ihm.
   */
  constructor(private scene: Phaser.Scene, private murkKey: string, private view: { x: number; y: number; w: number; h: number }, depth: number, readonly full: number) {
    const n = ++uid;
    this.fieldKey = `sight_field_${n}`;
    const dtKey = `sight_veil_${n}`;
    this.tex = scene.textures.createCanvas(this.fieldKey, T, T)!;
    this.dt = scene.textures.addDynamicTexture(dtKey, DW, DH)!;
    this.veil = scene.add.image(view.x, view.y, dtKey).setOrigin(0).setScrollFactor(0).setDisplaySize(view.w, view.h).setDepth(depth);
    scene.events.once('shutdown', () => {
      this.veil.destroy();
      for (const k of [this.fieldKey, dtKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
    });
  }

  /** Wie klar man an dieser Stelle sieht (0 … 1). r: Ausdehnung des Dings – von großen Tieren sieht man den Rand früher. */
  clarityAt(px: number, py: number, x: number, y: number, r = 0) {
    const dx = x - px, dy = y - py;
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    const fwd = dx * c + dy * s, side = -dx * s + dy * c;
    const d = Math.hypot(fwd, side);
    if (d < 1) return 1;
    const k = Math.max(0, d - r) / d;
    return Math.max(this.open, clarity(fwd * k, side * k, Math.max(0, this.shown), this.full));
  }

  /**
   * Jedes Bild: Das Blickfeld folgt dem Fisch (px, py) und dreht sich weich in seine Blickrichtung (look); die Sicht wächst
   * nach einem Segen langsam auf ihren neuen Wert (sight). clear: Das Wasser lichtet sich ganz (eine Szene mit der Kamera).
   */
  update(dt: number, px: number, py: number, look: number, sight: number, clear = false) {
    this.open = Math.max(0, Math.min(1, this.open + (clear ? dt * 1.5 : -dt * 1.5)));
    this.veil.setAlpha(1 - this.open);
    let d = look - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 5);
    if (this.shown < 0) this.shown = sight;
    else if (Math.abs(sight - this.shown) > 1e-4) this.shown += Math.sign(sight - this.shown) * Math.min(Math.abs(sight - this.shown), dt * 0.08);
    if (Math.abs(this.shown - this.drawn) > 0.004) this.redraw();
    // das Wasser über dem Schirm: erst trüb, dann das Blickfeld daraus ausradieren
    const wv = this.scene.cameras.main.worldView;
    const v = this.view;
    const kx = DW / v.w, ky = DH / v.h;
    const murk = this.scene.textures.getFrame(this.murkKey);
    this.dt.clear();
    this.dt.stamp(this.murkKey, undefined, 0, 0, { originX: 0, originY: 0, scaleX: DW / murk.width, scaleY: DH / murk.height });
    this.dt.stamp(this.fieldKey, undefined, (px - wv.x) * kx, (py - wv.y) * ky, {
      rotation: this.heading, scaleX: (this.half * 2 * kx) / T, scaleY: (this.half * 2 * ky) / T, blendMode: Phaser.BlendModes.ERASE,
    });
    this.dt.render();
  }

  /** Das Blickfeld neu zeichnen: hell, wo es klar ist – nach außen weich in Wasser übergehend. */
  private redraw() {
    this.drawn = this.shown;
    this.half = farthest(this.shown, this.full) * 1.04 + 8;
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(T, T);
    const px = (this.half * 2) / T;
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const c = clarity((i + 0.5 - T / 2) * px, (j + 0.5 - T / 2) * px, this.shown, this.full);
        const o = (j * T + i) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(255 * c);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
