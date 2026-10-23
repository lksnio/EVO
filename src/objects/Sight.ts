import Phaser from 'phaser';
import { clarityFrom, disc, farthest, veil, vision, type Vision } from '../sim/sight';

// ---------------------------------------------------------------------------
// Die Sicht im Bild: Über allem liegt trübes Wasser (in den Farben des Hintergrunds), und nur in einem runden Bereich ist es
// klar – seine Mitte liegt ein Stück vor dem Fisch, in Blickrichtung (siehe sim/sight.ts: nach vorn doppelt so weit wie nach
// hinten). Dahinter wird es dunkel, in der Tiefe bis fast schwarz. Beides sind Bilder, die jedes Bild neu entstehen: erst das
// trübe Wasser (bzw. das Dunkle), dann wird der klare Bereich daraus ausradiert. Die Bilder hängen an der Welt (nicht am
// Schirm) und reichen ein Stück über den Bildrand hinaus – so sitzt der klare Bereich immer genau am Fisch, auch wenn die
// Kamera nachzieht. Dieselbe Rechnung gilt für die Tiere (LevelScene.sightStep).
// ---------------------------------------------------------------------------

/** Kantenlänge der Bilder des klaren Bereichs (er ist ohnehin weich – grob genügt) */
const T = 256;
/** Auflösung des Wassers über dem Bild (es ist weich), das Dunkle noch gröber */
const DW = 640, DH = 360;
const KW = 320, KH = 180;
/** so weit (Bildpunkte der Welt) reichen die Bilder über den Bildrand hinaus – mehr bewegt sich die Kamera in einem Bild nicht */
const M = 120;

let uid = 0;

export class Sight {
  private murkImg: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Image;
  private dt: Phaser.Textures.DynamicTexture;
  private dark: Phaser.Textures.DynamicTexture;
  private tex: Phaser.Textures.CanvasTexture;
  private texDark: Phaser.Textures.CanvasTexture;
  private fieldKey: string;
  private darkKey: string;
  /** Blickrichtung als Richtung (x, y): Sie folgt dem Fisch weich – beim Umdrehen gleitet der klare Bereich auf die andere Seite */
  private dir = { x: 1, y: 0 };
  /** die Sicht des Tiers, die gerade gilt (sie wächst nach einem Segen sichtbar heran) */
  shown = -1;
  /** Wasserqualität und Tiefe, wie sie gerade gelten (sie folgen dem Ort und der Tiefe weich) */
  water = -1;
  deep = -1;
  /** der klare Bereich, wie er gezeichnet ist (und für die Tiere gilt) */
  v: Vision = { front: 1, back: 1, fade: 1 };
  /** wie dicht das trübe Wasser ist und wie dunkel es hinter dem Rand wird */
  private murkA = 0.9;
  private darkA = 0.5;
  private drawn = false;
  private since = 0;
  /** so weit reichen die Bilder des klaren Bereichs (halbe Kantenlänge, Bildpunkte der Welt): für das Trübe und das Dunkle */
  private half = 1;
  private halfDark = 1;
  /** Mitte des klaren Bereichs (Welt) */
  cx = 0;
  cy = 0;

  /** murkKey: das trübe Wasser (ein Bild mit dem Farbverlauf des Wassers); full: so weit ist es vom Fisch bis zum Bildrand. */
  constructor(private scene: Phaser.Scene, private murkKey: string, depth: number, readonly full: number) {
    const n = ++uid;
    this.fieldKey = `sight_field_${n}`;
    this.darkKey = `sight_fdark_${n}`;
    const dtKey = `sight_veil_${n}`, darkKey = `sight_dark_${n}`;
    this.tex = scene.textures.createCanvas(this.fieldKey, T, T)!;
    this.texDark = scene.textures.createCanvas(this.darkKey, T, T)!;
    this.dt = scene.textures.addDynamicTexture(dtKey, DW, DH)!;
    this.dark = scene.textures.addDynamicTexture(darkKey, KW, KH)!;
    this.murkImg = scene.add.image(0, 0, dtKey).setOrigin(0).setDepth(depth);
    this.shade = scene.add.image(0, 0, darkKey).setOrigin(0).setDepth(depth + 0.01);
    scene.events.once('shutdown', () => {
      this.murkImg.destroy();
      this.shade.destroy();
      for (const k of [this.fieldKey, this.darkKey, dtKey, darkKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
    });
  }

  /** Wie klar man an dieser Stelle sieht (0 … 1). r: Ausdehnung des Dings – von großen Tieren sieht man den Rand früher. */
  clarityAt(x: number, y: number, r = 0) {
    const d = Math.max(0, Math.hypot(x - this.cx, y - this.cy) - r);
    return clarityFrom(d, this.v);
  }

  /**
   * Jedes Bild: Der klare Bereich folgt dem Fisch (px, py) und liegt in Blickrichtung (look, Bogenmaß) vor ihm. sight: die
   * Sicht des Tiers (wächst nach einem Segen langsam heran); water: die Wasserqualität des Ortes; deep: wie tief (0 … 1).
   */
  update(dt: number, px: number, py: number, look: number, sight: number, water: number, deep: number) {
    // die Blickrichtung gleitet (statt sich zu drehen): Beim Umdrehen wandert der klare Bereich durch den Fisch hindurch
    const k = Math.min(1, dt * 7);
    this.dir.x += (Math.cos(look) - this.dir.x) * k;
    this.dir.y += (Math.sin(look) - this.dir.y) * k;
    const ease = (cur: number, to: number, rate: number) => (cur < 0 ? to : cur + Math.sign(to - cur) * Math.min(Math.abs(to - cur), dt * rate));
    this.shown = ease(this.shown, sight, 0.08);
    this.water = ease(this.water, water, 0.5);
    this.deep = ease(this.deep, deep, 0.4);
    // den klaren Bereich neu zeichnen, wenn er sich merklich geändert hat (höchstens etwa zehnmal je Sekunde)
    this.since += dt;
    const want = vision(this.shown, this.full, this.water, this.deep);
    const moved = Math.abs(want.front - this.v.front) / this.v.front > 0.012 || Math.abs(want.fade - this.v.fade) / this.v.fade > 0.03;
    if (!this.drawn || (moved && this.since > 0.1)) this.redraw(want);
    const ve = veil(this.v, this.water, this.deep);
    this.murkA = ve.murk;
    this.darkA = ve.dark;

    const ahead = disc(this.v).ahead;
    this.cx = px + this.dir.x * ahead;
    this.cy = py + this.dir.y * ahead;
    // die Bilder hängen an der Welt: Sie decken den Bildausschnitt und ein Stück darüber hinaus
    const wv = this.scene.cameras.main.worldView;
    const x0 = wv.x - M, y0 = wv.y - M, w = wv.width + 2 * M, h = wv.height + 2 * M;
    this.murkImg.setPosition(x0, y0).setDisplaySize(w, h);
    this.shade.setPosition(x0, y0).setDisplaySize(w, h);
    // das trübe Wasser – den klaren Bereich daraus ausradiert
    const kx = DW / w, ky = DH / h;
    const murk = this.scene.textures.getFrame(this.murkKey);
    this.dt.clear();
    this.dt.stamp(this.murkKey, undefined, 0, 0, { originX: 0, originY: 0, scaleX: DW / murk.width, scaleY: DH / murk.height, alpha: this.murkA });
    this.dt.stamp(this.fieldKey, undefined, (this.cx - x0) * kx, (this.cy - y0) * ky, {
      scaleX: (this.half * 2 * kx) / T, scaleY: (this.half * 2 * ky) / T, blendMode: Phaser.BlendModes.ERASE,
    });
    this.dt.render();
    // hinter dem Rand das Dunkle: Es beginnt gleich am Rand und nimmt nach außen zu – in der Tiefe dunkler und früher
    const mx = KW / w, my = KH / h;
    this.dark.clear();
    this.dark.fill(0x000000, this.darkA);
    this.dark.stamp(this.darkKey, undefined, (this.cx - x0) * mx, (this.cy - y0) * my, {
      scaleX: (this.halfDark * 2 * mx) / T, scaleY: (this.halfDark * 2 * my) / T, blendMode: Phaser.BlendModes.ERASE,
    });
    this.dark.render();
  }

  /** Die Bilder des klaren Bereichs neu zeichnen: hell, wo es klar ist – nach außen kurz und weich ins Trübe, lang ins Dunkle. */
  private redraw(v: Vision) {
    this.v = v;
    this.drawn = true;
    this.since = 0;
    this.half = this.paint(this.tex, v);
    this.halfDark = this.paint(this.texDark, veil(v, this.water, this.deep).field);
  }

  /** Einen runden klaren Bereich in sein Bild malen; gibt zurück, wie weit er reicht (halbe Kantenlänge, Bildpunkte der Welt). */
  private paint(tex: Phaser.Textures.CanvasTexture, v: Vision) {
    const half = farthest(v) * 1.04 + 8;
    const ctx = tex.getContext();
    const img = ctx.createImageData(T, T);
    const px = (half * 2) / T;
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const c = clarityFrom(Math.hypot((i + 0.5 - T / 2) * px, (j + 0.5 - T / 2) * px), v);
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
