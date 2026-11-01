import Phaser from 'phaser';
import { newCanvas, type Ctx } from '../../util/canvas';
import { clamp } from '../../util/math';
import { palette, morphKey, quantize, type Morph } from '../creatureArt';
import { withInk } from '../ink';
import { fishAnatomy, smoothstep, type FishAnatomy, type FinSpec } from './anatomy';
import { solveSpine } from './spine';
import { finBox, jawPath, paintBody, paintJaw, paintMedianFin, paintOverlay, paintPectoral, paintPelvicFin } from './paint';

// ---------------------------------------------------------------------------
// Das Fisch-Rig: Die Zeichnung (paint.ts) liegt als EIN Netz über Kopf, Rumpf, Schwanzstiel und Schwanzflosse. Das Netz
// folgt einer Wirbelsäule aus Gelenken (eine Spalte je Gelenk): Jede Pose wird neu aus der Ruheform berechnet – Fehler
// summieren sich nie auf. Der Drehpunkt (anchorX) bleibt in Ruhe; nach vorn folgt die Spalte dem Kopf, nach hinten läuft eine
// Welle, die zum Schwanz hin anschwillt. Flossen sind eigene kleine Netze, die an der Wirbelsäule hängen und mit Verzögerung
// nachschwingen. Der Unterkiefer ist ein Teil mit Gelenk am Kopf; die Mundhöhle füllt den Spalt, wenn das Maul aufgeht.
//
// Aufteilung (siehe README, „Das Fisch-Rig“):
//   Grundgestaltung  – paint.ts  (Zeichnung, aus Anatomie und Palette)
//   Anatomie         – anatomy.ts (Maße und Ansatzpunkte aus den Evolutionswerten)
//   Bewegung         – dieses Rig (Pose aus Zeit, Tempo, Biss; keine Evolutionswerte)
// ---------------------------------------------------------------------------

export const FISH_RES = 3;
const COLS = 16;
const ROWS = 3;

export interface FishPose {
  /** Zeit in Sekunden (für die Atmung) */
  t: number;
  dt: number;
  /** Schwimmtempo 0 … 1 */
  speed01: number;
  mode: 'swim' | 'idle' | 'crawl' | 'walk' | 'air';
  /** Maul 0 (zu) … 1 (weit offen) */
  open: number;
  /** Vorstoß des Kopfes (−0,5 zurück … 1,2 vor) */
  lunge: number;
  /** Zusammenbeißen / Knirschen */
  clench: number;
  grind: number;
  /** Ausholen vor dem Biss (0 … 1): Der Körper krümmt sich zusammen */
  coil: number;
  /** Kopf senkt sich beim Kauen (0 … 1) */
  dip: number;
  /** Kopfneigung in Bogenmaß (Haltung, Rammen, Kopfschütteln, Biss) */
  pitch: number;
  /** 0 … 1: kommt zur Ruhe */
  still: number;
  /** Schritt-Takt im Kriechen */
  crawlPhase: number;
}

export interface FishTex {
  A: FishAnatomy;
  keys: { body: string; overlay: string; jaw: string; dorsal: string; anal: string; pelvic: string; pec: string; pecFar: string };
  /** Umfang der Texturen in Zeicheneinheiten */
  box: Record<'body' | 'overlay' | 'jaw' | 'dorsal' | 'anal' | 'pelvic' | 'pec', { x0: number; x1: number; y0: number; y1: number }>;
  lid: number;
  lidEdge: number;
}

type Box = { x0: number; x1: number; y0: number; y1: number };

function makeTex(scene: Phaser.Scene, key: string, box: Box, s: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return key;
  const R = FISH_RES * s;
  const [c, ctx] = newCanvas((box.x1 - box.x0) * R, (box.y1 - box.y0) * R);
  ctx.scale(R, R);
  ctx.translate(-box.x0, -box.y0);
  draw(ctx);
  scene.textures.addCanvas(key, c);
  return key;
}

/** Alle Texturen dieses Fisches (einmal je Aussehen). */
export function fishTextures(scene: Phaser.Scene, mIn: Morph): FishTex {
  return withInk(true, () => {
    const m = quantize(mIn);
    const A = fishAnatomy(m);
    const P = palette(m);
    const id = 'cr2_' + morphKey(m);
    const s = A.s;
    const bodyBox = A.bounds;
    // die Überlagerung (Kiemendeckel) umfasst nur die Wange
    const ovBox: Box = { x0: A.hx - 13, x1: A.hx + 9, y0: A.hy - A.hg.H * 0.34, y1: A.hy + A.hg.H * 0.54 };
    const jawBox: Box = { x0: -4, x1: A.jawLen + 4, y0: -(A.m.diet < -0.3 ? 3 : 5), y1: A.jawH + 3 };
    const dBox = finBox('dorsal', A.dorsal), aBox = finBox('anal', A.anal), vBox = finBox('pelvic', A.pelvic), pBox = finBox('pectoral', A.pectoral);
    const keys = {
      body: makeTex(scene, id + '_fb', bodyBox, s, (ctx) => paintBody(ctx, A, P)),
      overlay: makeTex(scene, id + '_fo', ovBox, s, (ctx) => paintOverlay(ctx, A, P)),
      jaw: makeTex(scene, id + '_fj', jawBox, s, (ctx) => paintJaw(ctx, A, P)),
      dorsal: makeTex(scene, id + '_fd', dBox, s, (ctx) => paintMedianFin(ctx, A.dorsal, P, -1, true)),
      anal: makeTex(scene, id + '_fa', aBox, s, (ctx) => paintMedianFin(ctx, A.anal, P, 1, false)),
      pelvic: makeTex(scene, id + '_fv', vBox, s, (ctx) => paintPelvicFin(ctx, A.pelvic, P)),
      pec: makeTex(scene, id + '_fp', pBox, s, (ctx) => paintPectoral(ctx, A.pectoral, P, false)),
      pecFar: makeTex(scene, id + '_fq', pBox, s, (ctx) => paintPectoral(ctx, A.pectoral, P, true)),
    };
    return {
      A, keys,
      box: { body: bodyBox, overlay: ovBox, jaw: jawBox, dorsal: dBox, anal: aBox, pelvic: vBox, pec: pBox },
      lid: palette(m).base, lidEdge: palette(m).dark,
    };
  });
}

/** Ein verformbares Netz: Spalten × Zeilen über einer Textur, die Ruhepositionen bleiben unverändert erhalten. */
class Grid {
  readonly mesh: Phaser.GameObjects.Mesh2D;
  private idx: number[] = [];
  private ord: number[] = [];
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  private v: number[];
  constructor(scene: Phaser.Scene, key: string, readonly box: Box, readonly cols: number, readonly rows: number) {
    this.vx = new Float32Array((cols + 1) * (rows + 1));
    this.vy = new Float32Array((cols + 1) * (rows + 1));
    const v: number[] = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols, w = j / rows;
        v.push(0, 0, u, w);
        this.vx[j * (cols + 1) + i] = box.x0 + (box.x1 - box.x0) * u;
        this.vy[j * (cols + 1) + i] = box.y0 + (box.y1 - box.y0) * w;
      }
    }
    const idx: number[] = [], ord: number[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tl = j * (cols + 1) + i, tr = tl + 1, bl = tl + cols + 1, br = bl + 1;
        idx.push(tl, bl, tr, 0, bl, tr, br, 0);
        // Viereck in der Reihenfolge, die der Mesh2D-Zeichner erwartet: gemeinsame Kante bl–tr
        ord.push(tl, bl, tr, 0, bl, tr, br, 0);
      }
    }
    this.v = v;
    this.idx = idx;
    this.ord = ord;
    this.mesh = this.build(scene, key, v);
  }

  private build(scene: Phaser.Scene, key: string, v: number[]) {
    const m = new Phaser.GameObjects.Mesh2D(scene, 0, 0, key, v, this.idx, true);
    m.indicesOrdered = this.ord;
    m.useOrderedIndices = true;
    m.setSize(this.box.x1 - this.box.x0, this.box.y1 - this.box.y0);
    return m;
  }

  set(i: number, j: number, x: number, y: number) {
    const k = (j * (this.cols + 1) + i) * 4;
    this.v[k] = x;
    this.v[k + 1] = y;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Kopfneigung: Haltung plus das leichte Mitnicken im Takt, beim Ausholen zurück, beim Kauen nach unten. */
const hp0 = (p: FishPose, ph: number, calm: number, idle: boolean) => p.pitch + Math.sin(ph + 1) * 0.026 * calm * (idle ? 0.4 : 1) - p.coil * 0.1 + p.dip * 0.22;
/** Auf und Ab des ganzen Tiers: Atmen, im Kriechen die Schritte. */
const bobOf = (p: FishPose, crawl: boolean, calm: number) => (Math.sin(p.t * 2.2) * 0.6 - (crawl ? Math.abs(Math.cos(p.crawlPhase)) * 1.4 : 0)) * calm;

export class FishRig {
  readonly A: FishAnatomy;
  readonly parts: Phaser.GameObjects.GameObject[] = [];
  readonly lid: Phaser.GameObjects.Graphics;
  readonly cavity: Phaser.GameObjects.Graphics;
  private body: Grid;
  private overlay: Grid;
  private jaw: Phaser.GameObjects.Image;
  private fins: { grid: Grid; kind: 'dorsal' | 'anal' | 'pelvic' | 'pec' | 'pecFar' }[] = [];
  private s: number;

  // Zustand der Bewegung: Phasen werden aufsummiert, Pose und Netz aber nie
  private ph = Math.random() * 6;
  private fph = Math.random() * 6;
  private sp = 0;
  private kick = 0;
  /** Spine: Position und Winkel je Spalte (Zeicheneinheiten) */
  private sx: Float32Array;
  private sy: Float32Array;
  private sb: Float32Array;
  private colX: Float32Array;
  private lastOpen = 0;
  /** Augenposition (Pixel, im Container) und Neigung der letzten Pose */
  eyeX = 0;
  eyeY = 0;
  eyeRot = 0;

  constructor(scene: Phaser.Scene, readonly T: FishTex) {
    const A = (this.A = T.A);
    this.s = A.s;
    const b = T.box.body;
    this.body = new Grid(scene, T.keys.body, b, COLS, ROWS);
    this.sx = new Float32Array(COLS + 1);
    this.sy = new Float32Array(COLS + 1);
    this.sb = new Float32Array(COLS + 1);
    this.colX = new Float32Array(COLS + 1);
    for (let i = 0; i <= COLS; i++) this.colX[i] = lerp(b.x0, b.x1, i / COLS);

    const finGrid = (kind: 'dorsal' | 'anal' | 'pelvic' | 'pec' | 'pecFar') => {
      const box = T.box[kind === 'pecFar' ? 'pec' : kind];
      const g = new Grid(scene, T.keys[kind], box, kind === 'pec' || kind === 'pecFar' ? 3 : 4, 2);
      this.fins.push({ grid: g, kind });
      return g.mesh;
    };
    // von hinten nach vorn: ferne Flossen, Rücken und After, Mundhöhle, Unterkiefer, Körper, nahe Brustflosse, Lid
    const pecFar = finGrid('pecFar');
    const pelvic = finGrid('pelvic');
    const dorsal = finGrid('dorsal');
    const anal = finGrid('anal');
    this.cavity = new Phaser.GameObjects.Graphics(scene);
    const jb = T.box.jaw;
    this.jaw = new Phaser.GameObjects.Image(scene, 0, 0, T.keys.jaw).setOrigin(-jb.x0 / (jb.x1 - jb.x0), -jb.y0 / (jb.y1 - jb.y0)).setScale(this.s / FISH_RES);
    const pec = finGrid('pec');
    this.lid = new Phaser.GameObjects.Graphics(scene);
    this.overlay = new Grid(scene, T.keys.overlay, T.box.overlay, 5, 3);
    const overlay = this.overlay.mesh;
    this.parts.push(pecFar, pelvic, dorsal, anal, this.cavity, this.jaw, this.body.mesh, pec, overlay, this.lid);
    for (const f of this.fins) f.grid.mesh.setScale(1);
    this.pose({ t: 0, dt: 0, speed01: 0, mode: 'idle', open: 0, lunge: 0, clench: 0, grind: 0, coil: 0, dip: 0, pitch: 0, still: 0, crawlPhase: 0 });
  }

  /** Spalte → Position am Netz in Pixeln. */
  private colAt(x: number) {
    const k = clamp((x - this.T.box.body.x0) / (this.T.box.body.x1 - this.T.box.body.x0), 0, 1) * COLS;
    const i = Math.min(COLS - 1, Math.floor(k)), f = k - i;
    return { i, f };
  }

  /** Ein Punkt der Zeichnung (Körperkoordinaten) in die Pose übersetzt: Pixel im Container und Neigung. */
  mapPoint(x: number, y: number) {
    const { i, f } = this.colAt(x);
    const px = lerp(this.sx[i], this.sx[i + 1], f), py = lerp(this.sy[i], this.sy[i + 1], f);
    const b = lerp(this.sb[i], this.sb[i + 1], f);
    const s = this.s;
    return { x: (px - Math.sin(b) * y) * s, y: (py + Math.cos(b) * y) * s, rot: b };
  }

  pose(p: FishPose) {
    const A = this.A, s = this.s;
    const dt = p.dt;
    const calm = 1 - 0.7 * p.still;
    // Tempo weich nachführen: Bei Beschleunigung schnellerer Schlag und kurzer Schub
    const target = p.mode === 'crawl' ? 0.12 : p.mode === 'idle' ? 0 : p.speed01;
    const accel = target - this.sp;
    this.sp += accel * Math.min(1, dt * 5);
    this.kick = Math.max(0, this.kick - dt * 2.4, Math.min(0.7, accel * 1.6));
    const sp = clamp(this.sp, 0, 1);
    const crawl = p.mode === 'crawl';
    const idle = p.mode === 'idle';
    const hz = crawl ? 3.2 : idle ? 2.2 : 5 + sp * 8.5;
    this.ph += dt * hz;
    this.fph += dt * (idle ? 2.4 : 4.6 + sp * 3);

    const b = this.T.box.body;
    const bw = A.bw;
    const xa = A.anchorX;
    const Ls = Math.max(10, xa - b.x0);
    // Ausschlag an der Schwanzspitze (Zeicheneinheiten): ruhig klein, schnell groß, beim Anschub kurz größer
    const amp = bw * (idle ? 0.032 : crawl ? 0.05 : 0.07 + 0.15 * sp) * (1 + this.kick * 0.35) * calm;
    const lam = Ls * (idle ? 1.9 : 1.5 - 0.3 * sp);
    const kw = (Math.PI * 2) / lam;
    // bei hohem Tempo wird mehr vom Rumpf in die Welle einbezogen (steilerer Anstieg weiter vorn)
    const pw = 2.5 - 0.7 * sp;
    solveSpine(
      { colX: this.colX, xa, bw, Ls, amp, kw, ph: this.ph, pw, coil: p.coil, pitch: hp0(p, this.ph, calm, idle), bob: bobOf(p, crawl, calm), neckEnd: A.neckX + bw * 0.1, lungeDx: p.lunge * (3 + 3 * A.m.jaw) * calm },
      this.sx, this.sy, this.sb,
    );
    const J = A.m.jaw;

    // das Netz: jede Zeile folgt ihrer Spalte (senkrecht zur Wirbelsäule); beim Zubeißen presst sich der Kopf zusammen
    const neckEnd = A.neckX + bw * 0.1;
    const squash = p.clench * (0.05 + 0.07 * J);
    const gb = this.body;
    for (let j = 0; j <= ROWS; j++) {
      for (let i = 0; i <= COLS; i++) {
        const k = j * (COLS + 1) + i;
        const ry = gb.vy[k];
        const th = 1 + squash * smoothstep(xa, neckEnd, this.colX[i]);
        const be = this.sb[i];
        gb.set(i, j, (this.sx[i] - Math.sin(be) * ry * th) * s, (this.sy[i] + Math.cos(be) * ry * th) * s);
      }
    }

    // Überlagerung (Kiemendeckel): jeder Punkt folgt der Wirbelsäule wie der Körper
    {
      const og = this.overlay;
      for (let j = 0; j <= og.rows; j++) {
        for (let i = 0; i <= og.cols; i++) {
          const k = j * (og.cols + 1) + i;
          const q = this.mapPoint(og.vx[k], og.vy[k]);
          og.set(i, j, q.x, q.y);
        }
      }
    }

    // ---- Auge und Lid
    const eye = this.mapPoint(A.eye.x, A.eye.y);
    this.eyeX = eye.x;
    this.eyeY = eye.y;
    this.eyeRot = eye.rot;
    this.lid.setPosition(eye.x, eye.y).setRotation(eye.rot);

    // ---- Maul: Unterkiefer im Gelenk, Mundhöhle dazwischen
    const hj = this.mapPoint(A.hinge[0], A.hinge[1]);
    const J1 = 0.95 + 0.45 * J;
    const rest = p.clench ? -p.clench * 0.06 : 0;
    const opening = p.open * J1 + rest + (idle ? Math.max(0, Math.sin(p.t * 1.3)) * 0.04 : 0);
    this.jaw.setPosition(hj.x, hj.y).setRotation(hj.rot + opening);
    this.drawCavity(hj.x, hj.y, hj.rot, opening);

    // ---- Flossen
    const trail = 0.15 + 0.55 * sp; // bei Tempo legen sich die Flossen an
    for (const f of this.fins) {
      const g = f.grid;
      let at: ReturnType<FishRig['mapPoint']>, ax_: number, ay_: number, spec: FinSpec;
      let rootRot = 0;
      let swayK = 0;
      let flap = 0;
      const lag = (x: number) => Math.sin(this.fph * 0.9 - (xa - x) * kw * 0.9 - 0.8);
      switch (f.kind) {
        case 'dorsal': spec = A.dorsal; ax_ = 0; ay_ = -1; break;
        case 'anal': spec = A.anal; ax_ = 0; ay_ = 1; break;
        case 'pelvic': spec = A.pelvic; ax_ = 0; ay_ = 1; break;
        default: spec = A.pectoral; ax_ = -0.7; ay_ = 0.7; break;
      }
      at = this.mapPoint(spec.at[0], spec.at[1]);
      const bodyRot = at.rot;
      switch (f.kind) {
        case 'dorsal': swayK = lag(spec.at[0]) * 0.28 * calm + trail * 0.5; break;
        case 'anal': swayK = lag(spec.at[0] - 4) * 0.3 * calm + trail * 0.45; break;
        case 'pelvic': swayK = lag(spec.at[0]) * 0.2 * calm + trail * 0.5; rootRot = 0.1; break;
        default: {
          // Brustflosse: ruhig fächelnd, im Kriechen Schritt für Schritt, bei Tempo angelegt
          const far = f.kind === 'pecFar';
          if (crawl) flap = -0.25 + Math.sin(p.crawlPhase + (far ? Math.PI : 0)) * 0.75;
          else flap = (0.12 + Math.sin(this.fph * 1.15 + (far ? 1.1 : 0)) * 0.34 * (1 - 0.55 * sp)) * calm - trail * 0.35;
          swayK = Math.sin(this.fph * 1.15 + 0.7 + (far ? 1.1 : 0)) * 0.22 * calm;
          break;
        }
      }
      const len = spec.len;
      const cb = Math.cos(bodyRot + flap + rootRot), sb = Math.sin(bodyRot + flap + rootRot);
      const ox = at.x, oy = at.y + (f.kind === 'pecFar' ? -1.2 * s : 0);
      const dxn = ax_, dyn = ay_;
      // Biegung der Flosse: Je weiter vom Ansatz entfernt, desto stärker schwingt sie seitlich nach hinten aus
      for (let j = 0; j <= g.rows; j++) {
        for (let i = 0; i <= g.cols; i++) {
          const k = j * (g.cols + 1) + i;
          const lx = g.vx[k], ly = g.vy[k];
          const dist = lx * dxn + ly * dyn;
          const u = clamp(dist / Math.max(4, len), 0, 1.15);
          // Biegung quer zur Flossenachse, nach hinten (−x); Brustflossen biegen sich zusätzlich ein Stück nach unten
          const bend = swayK * u * u * len * 0.55;
          const pectoral = f.kind === 'pec' || f.kind === 'pecFar';
          const px = lx - bend * (pectoral ? 0.7 : 1);
          const py = ly + (pectoral ? bend * 0.35 : 0);
          g.set(i, j, ox + (px * cb - py * sb) * s, oy + (px * sb + py * cb) * s);
        }
      }
    }
  }

  /** Mundhöhle: dunkle Fläche zwischen Oberlippe und Unterkiefer, nur wenn das Maul offen ist. */
  private drawCavity(hx: number, hy: number, rot: number, opening: number) {
    const g = this.cavity;
    if (opening < 0.03) {
      if (this.lastOpen >= 0.03) g.clear();
      this.lastOpen = opening;
      return;
    }
    this.lastOpen = opening;
    g.clear();
    const s = this.s, A = this.A;
    const len = A.jawLen;
    const c = Math.cos(opening), sn = Math.sin(opening);
    const tipY = 0.3 * c + len * sn, tipX = len * c;
    // Keil zwischen Oberlippe und Unterkiefer; vorn offen: Die Vorderkante ist nach innen gewölbt (man sieht in den Rachen, nicht auf
    // eine Kante), hinten reicht er ein Stück in den Kopf, damit keine Lücke bleibt
    const to = (x: number, y: number): [number, number] => [hx + (x * Math.cos(rot) - y * Math.sin(rot)) * s, hy + (x * Math.sin(rot) + y * Math.cos(rot)) * s];
    const a0 = to(-2.2, -0.5), a1 = to(len + 0.4, -0.5), a2 = to(tipX, tipY), a3 = to(-2.2, 3.2);
    const cx = (len + 0.4 + tipX) * 0.5 * 0.62, cy = (-0.5 + tipY) * 0.5;
    const ctrl = to(cx, cy);
    g.fillStyle(0x2a0c10, 1);
    g.beginPath();
    g.moveTo(a0[0], a0[1]);
    g.lineTo(a1[0], a1[1]);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      g.lineTo(u * u * a1[0] + 2 * u * t * ctrl[0] + t * t * a2[0], u * u * a1[1] + 2 * u * t * ctrl[1] + t * t * a2[1]);
    }
    g.lineTo(a3[0], a3[1]);
    g.closePath();
    g.fillPath();
    // Gaumen: ein hellerer Streifen unter der Oberlippe
    g.lineStyle(Math.max(1, 1.2 * s), 0x6a2a30, 0.9);
    const a: [number, number] = [hx + (1 * Math.cos(rot) - 0.9 * Math.sin(rot)) * s, hy + (1 * Math.sin(rot) + 0.9 * Math.cos(rot)) * s];
    const b2: [number, number] = [hx + ((len - 1) * Math.cos(rot) - 0.9 * Math.sin(rot)) * s, hy + ((len - 1) * Math.sin(rot) + 0.9 * Math.cos(rot)) * s];
    g.lineBetween(a[0], a[1], b2[0], b2[1]);
  }

  destroy() {
    for (const o of this.parts) o.destroy();
  }
}

export { jawPath };
