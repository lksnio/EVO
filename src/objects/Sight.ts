import Phaser from 'phaser';
import { clarity, darkness, farthest, vision, type Vision } from '../sim/sight';

// ---------------------------------------------------------------------------
// Die Sicht im Bild: Über allem liegt trübes Wasser (in den Farben des Hintergrunds), und nur dort, wohin der Fisch blickt,
// ist es klar – nach vorn weit, nach hinten ein kleiner Kreis. Weiter draußen wird es dunkel, in der Tiefe bis fast schwarz.
// Beides sind Bilder über dem ganzen Schirm, die jedes Bild neu entstehen: erst das trübe Wasser (bzw. das Dunkle), dann wird
// das Blickfeld (hell = klar) daraus ausradiert – an der Stelle des Fischs und in seine Blickrichtung gedreht; für das
// Dunkle ein Stück größer. Die Rechnung dahinter steht in sim/sight.ts – dieselbe gilt für die Tiere (LevelScene.sightStep).
// ---------------------------------------------------------------------------

/** Kantenlänge des Blickfeld-Bilds (es ist ohnehin weich – grob genügt) */
const T = 256;
/** Auflösung des Wassers über dem Schirm (halb so fein wie das Bild – es ist weich), das Dunkle noch gröber */
const DW = 640, DH = 360;
const KW = 320, KH = 180;

let uid = 0;

export class Sight {
  private veil: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Image;
  private dt: Phaser.Textures.DynamicTexture;
  private dark: Phaser.Textures.DynamicTexture;
  private tex: Phaser.Textures.CanvasTexture;
  private texDark: Phaser.Textures.CanvasTexture;
  private fieldKey: string;
  private darkKey: string;
  /** wie dunkel es hinter dem Rand höchstens wird */
  private darkA = 0.5;
  /** Blickrichtung (Bogenmaß, 0 = nach rechts) – sie folgt dem Fisch weich */
  heading = 0;
  /** die Sicht des Tiers, die gerade gilt (sie wächst nach einem Segen sichtbar heran) */
  shown = -1;
  /** Wasserqualität und Tiefe, wie sie gerade gelten (sie folgen dem Ort und der Tiefe weich) */
  water = -1;
  deep = -1;
  /** das Blickfeld, wie es gezeichnet ist (und für die Tiere gilt) */
  v: Vision = { front: 1, back: 1, fade: 1, backFade: 1 };
  private drawnAt = -1;
  private since = 0;
  /** so weit reichen die Blickfeld-Bilder (halbe Kantenlänge, Bildpunkte der Welt): für das Trübe und für das Dunkle */
  private half = 1;
  private halfDark = 1;
  /** in besonderen Momenten (Szenen mit der Kamera) lichtet sich das Wasser ganz: 0 = trüb wie immer … 1 = alles klar */
  open = 0;

  /**
   * murkKey: das trübe Wasser (Bild in Schirmgröße); view: der Bildausschnitt (Bildpunkte der Welt, fest am Schirm);
   * full: so weit ist es vom Fisch bis zum Bildrand vor ihm.
   */
  constructor(private scene: Phaser.Scene, private murkKey: string, private view: { x: number; y: number; w: number; h: number }, depth: number, readonly full: number) {
    const n = ++uid;
    this.fieldKey = `sight_field_${n}`;
    this.darkKey = `sight_fdark_${n}`;
    const dtKey = `sight_veil_${n}`, darkKey = `sight_dark_${n}`;
    this.tex = scene.textures.createCanvas(this.fieldKey, T, T)!;
    this.texDark = scene.textures.createCanvas(this.darkKey, T, T)!;
    this.dt = scene.textures.addDynamicTexture(dtKey, DW, DH)!;
    this.dark = scene.textures.addDynamicTexture(darkKey, KW, KH)!;
    this.veil = scene.add.image(view.x, view.y, dtKey).setOrigin(0).setScrollFactor(0).setDisplaySize(view.w, view.h).setDepth(depth);
    this.shade = scene.add.image(view.x, view.y, darkKey).setOrigin(0).setScrollFactor(0).setDisplaySize(view.w, view.h).setDepth(depth + 0.01);
    scene.events.once('shutdown', () => {
      this.veil.destroy();
      this.shade.destroy();
      for (const k of [this.fieldKey, this.darkKey, dtKey, darkKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
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
    return Math.max(this.open, clarity(fwd * k, side * k, this.v));
  }

  /**
   * Jedes Bild: Das Blickfeld folgt dem Fisch (px, py) und dreht sich weich in seine Blickrichtung (look). sight: die Sicht des
   * Tiers (wächst nach einem Segen langsam heran); water: die Wasserqualität des Ortes; deep: wie tief (0 … 1). clear: Das
   * Wasser lichtet sich ganz (eine Szene mit der Kamera).
   */
  update(dt: number, px: number, py: number, look: number, sight: number, water: number, deep: number, clear = false) {
    this.open = Math.max(0, Math.min(1, this.open + (clear ? dt * 1.5 : -dt * 1.5)));
    this.veil.setAlpha(1 - this.open);
    this.shade.setAlpha(1 - this.open);
    let d = look - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 5);
    const ease = (cur: number, to: number, rate: number) => (cur < 0 ? to : cur + Math.sign(to - cur) * Math.min(Math.abs(to - cur), dt * rate));
    this.shown = ease(this.shown, sight, 0.08);
    this.water = ease(this.water, water, 0.5);
    this.deep = ease(this.deep, deep, 0.4);
    // das Blickfeld neu zeichnen, wenn es sich merklich geändert hat (höchstens etwa zehnmal je Sekunde)
    this.since += dt;
    const want = vision(this.shown, this.full, this.water, this.deep);
    const moved = Math.abs(want.front - this.v.front) / this.v.front > 0.012 || Math.abs(want.fade - this.v.fade) / this.v.fade > 0.03;
    if (this.drawnAt < 0 || (moved && this.since > 0.1)) this.redraw(want);

    const wv = this.scene.cameras.main.worldView;
    const v = this.view;
    const sx = (px - wv.x) / v.w, sy = (py - wv.y) / v.h;
    // das trübe Wasser
    const kx = DW / v.w, ky = DH / v.h;
    const murk = this.scene.textures.getFrame(this.murkKey);
    this.dt.clear();
    this.dt.stamp(this.murkKey, undefined, 0, 0, { originX: 0, originY: 0, scaleX: DW / murk.width, scaleY: DH / murk.height });
    this.dt.stamp(this.fieldKey, undefined, sx * DW, sy * DH, {
      rotation: this.heading, scaleX: (this.half * 2 * kx) / T, scaleY: (this.half * 2 * ky) / T, blendMode: Phaser.BlendModes.ERASE,
    });
    this.dt.render();
    // hinter dem Rand das Dunkle: Es beginnt gleich am Rand und nimmt nach außen zu – in der Tiefe dunkler und früher
    const mx = KW / v.w, my = KH / v.h;
    this.dark.clear();
    this.dark.fill(0x000000, this.darkA);
    this.dark.stamp(this.darkKey, undefined, sx * KW, sy * KH, {
      rotation: this.heading, scaleX: (this.halfDark * 2 * mx) / T, scaleY: (this.halfDark * 2 * my) / T, blendMode: Phaser.BlendModes.ERASE,
    });
    this.dark.render();
  }

  /** Die Blickfelder neu zeichnen: hell, wo es klar ist – nach außen in einem kurzen, weichen Übergang in Wasser (und in einem
   *  langen ins Dunkle). */
  private redraw(v: Vision) {
    this.v = v;
    this.drawnAt = this.scene.time.now;
    this.since = 0;
    const dk = darkness(v, this.deep);
    this.darkA = dk.alpha;
    this.half = this.paint(this.tex, v);
    this.halfDark = this.paint(this.texDark, dk.field);
  }

  /** Ein Blickfeld in sein Bild malen; gibt zurück, wie weit es reicht (halbe Kantenlänge, Bildpunkte der Welt). */
  private paint(tex: Phaser.Textures.CanvasTexture, v: Vision) {
    const half = farthest(v) * 1.04 + 8;
    const ctx = tex.getContext();
    const img = ctx.createImageData(T, T);
    const px = (half * 2) / T;
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const c = clarity((i + 0.5 - T / 2) * px, (j + 0.5 - T / 2) * px, v);
        const o = (j * T + i) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(255 * c);
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    return half;
  }
}
