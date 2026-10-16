import Phaser from 'phaser';
import {
  type Appearance, type CreatureTex, type Layout, type PartTex,
  CREATURE_RES, creatureTextures,
} from '../art/creatureArt';

export type AnimMode = 'swim' | 'walk' | 'air' | 'idle';

type Img = Phaser.GameObjects.Image;

/**
 * Die sichtbare Spielfigur: ein Container aus Einzelteilen, die animiert werden
 * (Beine laufen, Flossen schlagen, Kiefer beißt, Kopf senkt sich zum Hornstoß).
 */
export class CreatureView extends Phaser.GameObjects.Container {
  a!: Appearance;
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
  private baseScale: number;
  private facing = 1;
  headTilt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, a: Appearance, scale = 1) {
    super(scene, x, y);
    this.baseScale = scale;
    scene.add.existing(this);
    this.build(a);
  }

  build(a: Appearance) {
    this.removeAll(true);
    this.legs = [];
    this.fin = undefined;
    this.a = { ...a };
    const T: CreatureTex = creatureTextures(this.scene, a);
    const L = T.layout;
    this.L = L;
    const img = (p: PartTex, x: number, y: number) =>
      new Phaser.GameObjects.Image(this.scene, x, y, p.key).setOrigin(p.ox, p.oy).setScale(1 / CREATURE_RES);

    if (L.land && T.leg) {
      const far = 0xa0a4b0;
      this.legs[0] = img(T.leg, L.legF[0] + 4 * L.s, L.legF[1] - 2 * L.s).setTint(far);
      this.legs[1] = img(T.leg, L.legB[0] + 4 * L.s, L.legB[1] - 2 * L.s).setTint(far);
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
      this.fin = img(T.fin, 4 * L.s, 7 * L.s);
      this.add(this.fin);
    }
    this.applyScale();
    return this;
  }

  bite() {
    this.biteT = 0;
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

  /** Färbt alle Teile kurz ein (z. B. rot bei Treffer). */
  flash(color: number | null) {
    const apply = (o: Phaser.GameObjects.GameObject) => {
      if (o instanceof Phaser.GameObjects.Container) o.list.forEach(apply);
      else if (o instanceof Phaser.GameObjects.Image) {
        const far = this.legs[0] === o || this.legs[1] === o;
        if (color === null) {
          if (far) o.setTint(0xa0a4b0);
          else o.clearTint();
        } else o.setTint(color);
      }
    };
    this.list.forEach(apply);
  }

  animate(dt: number, mode: AnimMode, speed01 = 0) {
    this.t += dt;
    const t = this.t;
    const L = this.L;
    let open = 0;
    if (this.biteT >= 0) {
      this.biteT += dt;
      const b = this.biteT;
      open = b < 0.07 ? b / 0.07 : Math.max(0, 1 - (b - 0.07) / 0.15);
      if (b > 0.25) this.biteT = -1;
    }
    this.jaw.rotation = open * 0.8 + (mode === 'idle' ? Math.max(0, Math.sin(t * 1.3)) * 0.05 : 0);
    this.headC.x = L.neck[0] + open * 3 * L.s;

    if (!L.land) {
      const sp = 6 + speed01 * 9;
      this.tailImg.rotation = Math.sin(t * sp) * (0.16 + speed01 * 0.24);
      if (this.fin) this.fin.rotation = 0.15 + Math.sin(t * 5.5) * 0.35;
      const bob = Math.sin(t * 2.2) * 0.6;
      this.bodyImg.y = bob;
      this.tailImg.y = L.tail[1] + bob;
      this.headC.y = L.neck[1] + bob;
      this.headC.rotation = Math.sin(t * sp + 1) * 0.03 + this.headTilt;
      return;
    }

    let lf = 0, lb = 0, ff = 0, fb = 0, bob = 0, headR = 0;
    let tailR = Math.sin(t * 2.4) * 0.08;
    if (mode === 'walk') {
      this.phase += dt * (5 + speed01 * 9);
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
      // Amphibien stehen breitbeinig, Säuger gerade
      const splay = this.a.cls === 'amphibian' ? 0.32 : this.a.cls === 'reptile' ? 0.12 : 0.04;
      this.legs[0].rotation = ff - splay;
      this.legs[1].rotation = fb + splay;
      this.legs[2].rotation = lf - splay;
      this.legs[3].rotation = lb + splay;
    }
    this.bodyImg.y = bob;
    this.headC.y = L.neck[1] + bob;
    this.tailImg.y = L.tail[1] + bob;
    this.tailImg.rotation = tailR;
    this.headC.rotation = headR + this.headTilt;
  }
}
