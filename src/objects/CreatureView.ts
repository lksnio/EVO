import Phaser from 'phaser';
import {
  type CreatureTex, type Layout, type Morph, type PartTex,
  CREATURE_RES, creatureTextures, morphKey,
} from '../art/creatureArt';

/** crawl: ein Fisch stützt sich am Grund ab und läuft auf seinen Flossen */
export type AnimMode = 'swim' | 'walk' | 'air' | 'idle' | 'crawl';

type Img = Phaser.GameObjects.Image;

const FAR_TINT = 0x8a8a8a;

/**
 * Wie viele Ansichten ein Aussehen gerade nutzen. Jedes neue Aussehen kostet einige Texturen (zusammen
 * gut ein Megabyte); unbenutzte werden behalten, bis es zu viele sind – dann fliegen die ältesten raus.
 */
const users = new Map<string, number>();
const unused: string[] = [];
const KEEP_UNUSED = 8;
const PARTS = ['_b', '_h', '_t', '_j', '_s', '_l', '_f'];

function retain(key: string) {
  users.set(key, (users.get(key) ?? 0) + 1);
  const i = unused.indexOf(key);
  if (i >= 0) unused.splice(i, 1);
}

function release(tm: Phaser.Textures.TextureManager, key: string) {
  const n = (users.get(key) ?? 1) - 1;
  if (n > 0) {
    users.set(key, n);
    return;
  }
  users.delete(key);
  unused.push(key);
  while (unused.length > KEEP_UNUSED) {
    const old = unused.shift()!;
    for (const p of PARTS) if (tm.exists('cr2_' + old + p)) tm.remove('cr2_' + old + p);
  }
}

/**
 * Die sichtbare Spielfigur: ein Container aus Einzelteilen, die animiert werden
 * (Beine laufen, Flossen schlagen, Kiefer beißt und kaut, Kopf senkt sich beim Rammen).
 */
export class CreatureView extends Phaser.GameObjects.Container {
  m!: Morph;
  key = '';
  L!: Layout;
  private bodyImg!: Img;
  private headC!: Phaser.GameObjects.Container;
  private jaw!: Img;
  private tailImg!: Img;
  private legs: Img[] = [];
  private fin?: Img;
  private t = Math.random() * 10;
  private phase = 0;
  private biteT = -1;
  private chewT = -1;
  private shakeT = -1;
  private baseScale: number;
  private facing = 1;
  private shade: number | null = null;
  private tm?: Phaser.Textures.TextureManager;
  headTilt = 0;
  /** 0..1: Erschöpfung/Verletzung verlangsamt die Bewegungen */
  weary = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, m: Morph, scale = 1) {
    super(scene, x, y);
    this.baseScale = scale;
    scene.add.existing(this);
    this.build(m);
  }

  /** Baut die Figur neu, wenn sich das Aussehen (in Stufen) verändert hat. */
  build(m: Morph, force = false) {
    const key = morphKey(m);
    this.m = { ...m };
    if (!force && key === this.key) return this;
    const old = this.key;
    this.key = key;
    this.tm = this.scene.textures;
    retain(key);
    this.removeAll(true);
    this.legs = [];
    this.fin = undefined;
    const T: CreatureTex = creatureTextures(this.scene, m);
    if (old) release(this.tm, old);
    const L = T.layout;
    this.L = L;
    const img = (p: PartTex, x: number, y: number) =>
      new Phaser.GameObjects.Image(this.scene, x, y, p.key).setOrigin(p.ox, p.oy).setScale(1 / CREATURE_RES);

    if (L.land && T.leg) {
      this.legs[0] = img(T.leg, L.legF[0] + 4 * L.s, L.legF[1] - 2 * L.s);
      this.legs[1] = img(T.leg, L.legB[0] + 4 * L.s, L.legB[1] - 2 * L.s);
      this.add([this.legs[0], this.legs[1]]);
    }
    this.tailImg = img(T.tail, L.tail[0], L.tail[1]);
    this.add(this.tailImg);
    this.bodyImg = img(T.body, 0, 0);
    this.add(this.bodyImg);
    if (L.land && T.leg) {
      this.legs[2] = img(T.leg, L.legF[0], L.legF[1]);
      this.legs[3] = img(T.leg, L.legB[0], L.legB[1]);
      this.add([this.legs[2], this.legs[3]]);
    }
    this.headC = new Phaser.GameObjects.Container(this.scene, L.neck[0], L.neck[1]);
    const headImg = img(T.head, 0, 0);
    this.jaw = img(T.jaw, L.hg.hingeX * L.s, L.hg.mouthY * L.s);
    const teeth = img(T.teeth, 0, 0);
    this.headC.add([headImg, this.jaw, teeth]);
    this.add(this.headC);
    if (!L.land && T.fin) {
      this.fin = img(T.fin, 6 * L.s, 7 * L.s);
      this.add(this.fin);
    }
    this.applyScale();
    this.applyTint();
    return this;
  }

  destroy(fromScene?: boolean) {
    const key = this.key, tm = this.tm;
    this.key = '';
    super.destroy(fromScene);
    if (key && tm) release(tm, key);
  }

  bite() {
    this.biteT = 0;
  }

  /** Position des Auges in der Welt (für das Augenleuchten in Höhlen). */
  eyeWorld() {
    const hg = this.L.hg;
    const m = this.headC.getWorldTransformMatrix();
    const p = m.transformPoint(hg.ex * this.L.s, hg.ey * this.L.s);
    return { x: p.x, y: p.y, r: hg.er * this.L.s * Math.abs(this.scaleY) };
  }

  /** Kaubewegung beim Fressen */
  chew() {
    this.chewT = 0;
  }

  /** Kopfschütteln: "Ich bin satt." */
  refuse() {
    this.shakeT = 0;
  }

  setFacing(dir: number) {
    const f = dir < 0 ? -1 : 1;
    if (f !== this.facing) {
      this.facing = f;
      this.applyScale();
    }
    return this;
  }

  get dir() {
    return this.facing;
  }

  setBaseScale(s: number) {
    this.baseScale = s;
    this.applyScale();
    return this;
  }

  private applyScale() {
    this.setScale(this.baseScale * this.facing, this.baseScale);
  }

  /** Färbt alle Teile kurz ein (rot bei Treffer) – null stellt zurück. */
  flash(color: number | null) {
    this.tintAll(color);
    if (color === null) this.applyTint();
  }

  /** Abdunkeln, wenn die Figur im Dickicht versteckt ist. */
  setShade(c: number | null) {
    if (c === this.shade) return;
    this.shade = c;
    this.applyTint();
  }

  private applyTint() {
    this.tintAll(this.shade);
  }

  private tintAll(color: number | null) {
    const apply = (o: Phaser.GameObjects.GameObject) => {
      if (o instanceof Phaser.GameObjects.Container) o.list.forEach(apply);
      else if (o instanceof Phaser.GameObjects.Image) {
        const far = this.legs[0] === o || this.legs[1] === o;
        if (color === null) {
          if (far) o.setTint(FAR_TINT);
          else o.clearTint();
        } else o.setTint(far ? Phaser.Display.Color.GetColor(((color >> 16) & 255) * 0.6, ((color >> 8) & 255) * 0.6, (color & 255) * 0.6) : color);
      }
    };
    this.list.forEach(apply);
  }

  animate(dt: number, mode: AnimMode, speed01 = 0) {
    const slow = 1 - this.weary * 0.4;
    this.t += dt * slow;
    const t = this.t;
    const L = this.L;
    // Biss: Maul weit aufreißen (der Kopf holt kurz aus), vorstoßen und zuschnappen – dann knirschen
    // die Kiefer ein paar Mal aufeinander, der Kopf rüttelt. Je stärker das Gebiss, desto weiter das Maul
    // und desto wuchtiger Stoß und Knirschen.
    let open = 0, lunge = 0, clench = 0, grind = 0;
    if (this.biteT >= 0) {
      this.biteT += dt;
      const b = this.biteT;
      if (b < 0.07) {
        open = b / 0.07;
        lunge = -0.35 * open;
      } else if (b < 0.12) {
        const k = (b - 0.07) / 0.05;
        open = 1 - k;
        lunge = -0.35 + 1.35 * k;
      } else {
        const k = Math.min(1, (b - 0.12) / 0.34);
        clench = 1 - k;
        lunge = 1 - k * k;
        grind = Math.sin((b - 0.12) * 46) * (1 - k);
        open = Math.max(0, grind) * 0.32;
      }
      if (b > 0.46) this.biteT = -1;
    }
    const J = this.m.jaw;
    let dip = 0;
    if (this.chewT >= 0) {
      this.chewT += dt;
      const c = this.chewT;
      open = Math.max(open, Math.abs(Math.sin(c * 14)) * 0.45);
      dip = Math.min(1, c * 6) * (c > 0.5 ? Math.max(0, 1 - (c - 0.5) * 5) : 1);
      if (c > 0.7) this.chewT = -1;
    }
    let shake = 0;
    if (this.shakeT >= 0) {
      this.shakeT += dt;
      shake = Math.sin(this.shakeT * 30) * 0.18 * (1 - this.shakeT / 0.5);
      if (this.shakeT > 0.5) this.shakeT = -1;
    }
    this.jaw.rotation = open * (0.95 + 0.45 * J) - clench * 0.06 + (mode === 'idle' ? Math.max(0, Math.sin(t * 1.3)) * 0.04 : 0);
    this.headC.x = L.neck[0] + lunge * (3 + 3 * J) * L.s;
    this.headC.setScale(1 + clench * (0.05 + 0.07 * J));
    const biteTilt = (this.biteT >= 0 && this.biteT < 0.12 ? -open * 0.16 : 0) + grind * (0.05 + 0.05 * J);
    if (!L.land) {
      const crawl = mode === 'crawl';
      const sp = (crawl ? 3 : 6 + speed01 * 9) * slow;
      this.tailImg.rotation = Math.sin(t * sp) * (crawl ? 0.08 : 0.16 + speed01 * 0.24);
      let bob = Math.sin(t * 2.2) * 0.6;
      if (crawl) {
        // auf den Flossen am Grund entlang: Schritt für Schritt
        this.phase += dt * (6 + speed01 * 6) * slow;
        if (this.fin) this.fin.rotation = -0.25 + Math.sin(this.phase) * 0.75;
        bob = -Math.abs(Math.cos(this.phase)) * 1.4;
      } else if (this.fin) this.fin.rotation = 0.15 + Math.sin(t * 5.5) * 0.35;
      this.bodyImg.y = bob;
      this.tailImg.y = L.tail[1] + bob;
      this.headC.y = L.neck[1] + bob + dip * 2 * L.s;
      this.headC.rotation = Math.sin(t * sp + 1) * 0.03 + this.headTilt + shake + dip * 0.25 + biteTilt;
      return;
    }

    let lf = 0, lb = 0, ff = 0, fb = 0, bob = 0, headR = 0;
    let tailR = Math.sin(t * 2.4) * 0.08;
    if (mode === 'walk') {
      this.phase += dt * (5 + speed01 * 9) * slow;
      const amp = 0.18 + speed01 * 0.42;
      const sA = Math.sin(this.phase), sB = Math.sin(this.phase + Math.PI);
      lf = sB * amp;
      fb = sB * amp;
      lb = sA * amp;
      ff = sA * amp;
      bob = -Math.abs(Math.cos(this.phase)) * 1.6 * speed01 * L.s;
      headR = Math.sin(this.phase * 2) * 0.03;
      tailR += Math.sin(this.phase) * 0.06;
    } else if (mode === 'air') {
      lf = ff = -0.55;
      lb = fb = 0.6;
      tailR = 0.18;
      headR = -0.08;
    } else {
      bob = (Math.sin(t * 2) * 0.5 + 0.5) * 0.8 * L.s;
    }
    if (this.legs.length === 4) {
      const splay = this.m.cls === 'amphibian' ? 0.32 : this.m.cls === 'reptile' ? 0.12 : 0.04;
      this.legs[0].rotation = ff - splay;
      this.legs[1].rotation = fb + splay;
      this.legs[2].rotation = lf - splay;
      this.legs[3].rotation = lb + splay;
    }
    this.bodyImg.y = bob;
    this.headC.y = L.neck[1] + bob + dip * 4 * L.s;
    this.tailImg.y = L.tail[1] + bob;
    this.tailImg.rotation = tailR;
    this.headC.rotation = headR + this.headTilt + shake + dip * 0.45 + biteTilt;
  }
}
