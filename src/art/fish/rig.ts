import Phaser from 'phaser';
import { newCanvas, type Ctx } from '../../util/canvas';
import { clamp } from '../../util/math';
import { palette, morphKey, quantize, type Morph } from '../creatureArt';
import { withInk } from '../ink';
import { fishAnatomy, smoothstep, type FishAnatomy, type FinSpec } from './anatomy';
import { solveSpine } from './spine';
import { MOUTH_KEY, paintBodyPainted, paintEyePainted, paintFinPainted, paintJawPainted, paintOverlayPainted, paintedReady } from './painted';
import { eyeBox, finBox, jawPath, paintBody, paintEye, paintJaw, paintMedianFin, paintOverlay, paintPectoral, paintPelvicFin } from './paint';

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
const MOUTH_COLS = 8;
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
  keys: { body: string; eye: string; overlay: string; jaw: string; dorsal: string; anal: string; pelvic: string; pec: string; pecFar: string };
  /** Umfang der Texturen in Zeicheneinheiten */
  box: Record<'body' | 'eye' | 'overlay' | 'jaw' | 'dorsal' | 'anal' | 'pelvic' | 'pec', { x0: number; x1: number; y0: number; y1: number }>;
  lid: number;
  lidEdge: number;
}

export type Box = { x0: number; x1: number; y0: number; y1: number };

/**
 * Völlig durchsichtige Pixel bekommen Alpha 1/255 (und Farbe schwarz). Der Tintmodus der Aufhellung (MULTIPLY_TWO) rechnet mit der
 * unvormultiplizierten Farbe, also Farbe ÷ Alpha: Bei Alpha 0 wäre das 0 ÷ 0 und je nach Grafikkarte ein heller Fleck um die Zeichnung.
 */
function floorAlpha(ctx: Ctx) {
  const c = ctx.canvas;
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0) d[i] = 1;
  ctx.putImageData(id, 0, 0);
}

export function makeTex(scene: Phaser.Scene, key: string, box: Box, s: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return key;
  const R = FISH_RES * s;
  const [c, ctx] = newCanvas((box.x1 - box.x0) * R, (box.y1 - box.y0) * R, true);
  ctx.scale(R, R);
  ctx.translate(-box.x0, -box.y0);
  draw(ctx);
  floorAlpha(ctx);
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
    const eyeB = eyeBox(A);
    const jawBox: Box = { x0: -4, x1: A.jawLen + 4, y0: -(A.m.diet < -0.3 ? 3 : 5), y1: A.jawH + 3 };
    const dBox = finBox('dorsal', A.dorsal), aBox = finBox('anal', A.anal), vBox = finBox('pelvic', A.pelvic), pBox = finBox('pectoral', A.pectoral);
    // gemalte Texturen (art/EVO_fish_painted_v1), sobald sie geladen sind; sonst (und mit ?procfish) die programmierte Zeichnung
    const painted = paintedReady(scene);
    const id2 = painted ? id + 'P' : id;
    const keys = {
      body: makeTex(scene, id2 + '_fb', bodyBox, s, (ctx) => (painted ? paintBodyPainted(ctx, scene, A, P) : paintBody(ctx, A, P))),
      eye: makeTex(scene, id2 + '_fe', eyeB, s, (ctx) => (painted ? paintEyePainted(ctx, scene, A, P) : paintEye(ctx, A, P))),
      overlay: makeTex(scene, id2 + '_fo', ovBox, s, (ctx) => (painted ? paintOverlayPainted(ctx, scene, A, P) : paintOverlay(ctx, A, P))),
      jaw: makeTex(scene, id2 + '_fj', jawBox, s, (ctx) => (painted ? paintJawPainted(ctx, scene, A, P) : paintJaw(ctx, A, P))),
      dorsal: makeTex(scene, id2 + '_fd', dBox, s, (ctx) => (painted ? paintFinPainted(ctx, scene, 'dorsal', A, P) : paintMedianFin(ctx, A.dorsal, P, -1, true))),
      anal: makeTex(scene, id2 + '_fa', aBox, s, (ctx) => (painted ? paintFinPainted(ctx, scene, 'anal', A, P) : paintMedianFin(ctx, A.anal, P, 1, false))),
      pelvic: makeTex(scene, id2 + '_fv', vBox, s, (ctx) => (painted ? paintFinPainted(ctx, scene, 'pelvic', A, P) : paintPelvicFin(ctx, A.pelvic, P))),
      // (Stützflossen mit kräftigem Stiel bleiben programmiert)
      pec: makeTex(scene, id2 + '_fp', pBox, s, (ctx) => (painted && !A.pectoral.lobed ? paintFinPainted(ctx, scene, 'pectoral', A, P) : paintPectoral(ctx, A.pectoral, P, false))),
      pecFar: makeTex(scene, id2 + '_fq', pBox, s, (ctx) => (painted && !A.pectoral.lobed ? paintFinPainted(ctx, scene, 'pectoral', A, P, true) : paintPectoral(ctx, A.pectoral, P, true))),
    };
    return {
      A, keys,
      box: { body: bodyBox, eye: eyeB, overlay: ovBox, jaw: jawBox, dorsal: dBox, anal: aBox, pelvic: vBox, pec: pBox },
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
  constructor(scene: Phaser.Scene, key: string, readonly box: Box, readonly cols: number, readonly rows: number, uv: [number, number, number, number] = [0, 0, 1, 1]) {
    this.vx = new Float32Array((cols + 1) * (rows + 1));
    this.vy = new Float32Array((cols + 1) * (rows + 1));
    const v: number[] = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols, w = j / rows;
        v.push(0, 0, uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * w);
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
  /** gemaltes Maul (nur mit gemalten Texturen): schmale Gaumenfläche oben und Mundboden unten; die Höhle dazwischen ist `cavity` */
  private palate?: Grid;
  private floor?: Grid;
  private eyeImg: Phaser.GameObjects.Image;
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
  private reach: Float32Array;
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
    // Reichweite des Netzes senkrecht zur Wirbelsäule je Spalte (hinter dem Stiel die Schwanzflosse, sonst der Körper)
    this.reach = new Float32Array(COLS + 1).map((_, i) => (this.colX[i] < A.pedX ? Math.max(A.tail.spread * 1.1, 6) : Math.max(Math.abs(b.y0), Math.abs(b.y1)) * 0.85));

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
    // gemaltes Maulinneres (ein Netz, das zwischen Oberlippe und Unterkiefer aufgespannt wird); ohne gemalte Texturen die dunkle Fläche
    if (paintedReady(scene)) {
      const unit = { x0: 0, x1: 1, y0: 0, y1: 1 };
      // aus der gemalten Innenfläche nur zwei schmale Streifen: die hellere obere Fläche als Gaumen, die untere als Mundboden
      this.palate = new Grid(scene, MOUTH_KEY, unit, MOUTH_COLS, 1, [0.45, 0.1, 0.95, 0.4]);
      this.floor = new Grid(scene, MOUTH_KEY, unit, MOUTH_COLS, 1, [0.45, 0.6, 0.95, 0.88]);
    }
    const jb = T.box.jaw;
    this.jaw = new Phaser.GameObjects.Image(scene, 0, 0, T.keys.jaw).setOrigin(-jb.x0 / (jb.x1 - jb.x0), -jb.y0 / (jb.y1 - jb.y0)).setScale(1 / FISH_RES);
    const pec = finGrid('pec');
    this.lid = new Phaser.GameObjects.Graphics(scene);
    this.eyeImg = new Phaser.GameObjects.Image(scene, 0, 0, T.keys.eye).setScale(1 / FISH_RES);
    this.overlay = new Grid(scene, T.keys.overlay, T.box.overlay, 5, 3);
    const overlay = this.overlay.mesh;
    this.parts.push(pecFar, pelvic, dorsal, anal, this.cavity, ...(this.palate && this.floor ? [this.palate.mesh, this.floor.mesh] : []), this.jaw, this.body.mesh, pec, overlay, this.eyeImg, this.lid);
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
      { colX: this.colX, xa, bw, Ls, amp, kw, ph: this.ph, pw, coil: p.coil, pitch: hp0(p, this.ph, calm, idle), bob: bobOf(p, crawl, calm), neckEnd: A.neckX + bw * 0.1, lungeDx: p.lunge * (3 + 3 * A.m.jaw) * calm, reach: this.reach },
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
    this.eyeImg.setPosition(eye.x, eye.y).setRotation(eye.rot);

    // ---- Maul: Unterkiefer im Gelenk, Mundhöhle dazwischen
    const hj = this.mapPoint(A.hinge[0], A.hinge[1]);
    // größter Öffnungswinkel: kurze Kiefer öffnen weit, lange schmaler (die Spitze soll nicht ausufern; Länge und Winkel gemeinsam parametriert)
    const J1 = Math.min(0.9, 0.8 * Math.pow(10.4 / Math.max(6, A.jawLen), 0.42) + 0.05);
    const rest = p.clench ? -p.clench * 0.06 : 0;
    const opening = p.open * J1 + rest + (idle ? Math.max(0, Math.sin(p.t * 1.3)) * 0.04 : 0);
    // feste Arten: Die Maulspalte kann schräg stehen (Winkel jawRest gegen die Körperachse); der Kiefer öffnet sich von dort aus
    const lipRot = hj.rot + (A.jawRest ?? 0);
    this.jaw.setPosition(hj.x, hj.y).setRotation(lipRot + opening);
    if (this.palate && this.floor) this.drawMouth(hj.x, hj.y, lipRot, opening);
    else this.drawCavity(hj.x, hj.y, lipRot, opening);

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

  /**
   * Das Maul nach den Bissreferenzen: eine DUNKLE, zurückliegende Höhle (gebogene Fläche zwischen Oberlippe und Unterkiefer, hinten weich
   * unter Wange und Kieferwurzel verschwindend), dazu nur zwei schmale gemalte Innenflächen – oben der Gaumen an der Oberlippe, unten der
   * Mundboden am Kiefer. Beide folgen ihren Lippen, laufen an den Enden aus und wachsen mit der Öffnung. Beim Schließen verschwindet alles.
   */
  private drawMouth(hx: number, hy: number, rot: number, opening: number) {
    const pal = this.palate!, flo = this.floor!, g = this.cavity;
    const vis = opening >= 0.03;
    pal.mesh.setVisible(vis);
    flo.mesh.setVisible(vis);
    g.clear();
    if (!vis) return;
    const s = this.s, A = this.A;
    const len = A.jawLen * 0.97;
    const fade = Math.min(1, opening / 0.12);
    const c0 = Math.cos(rot), s0 = Math.sin(rot), c1 = Math.cos(rot + opening), s1 = Math.sin(rot + opening);
    // Punkte im Rahmen des Kopfes (Oberlippe) bzw. des Kiefers (Unterlippe), beide mit dem Gelenk als Ursprung
    const up = (x: number, y: number): [number, number] => [hx + (x * c0 - y * s0) * s, hy + (x * s0 + y * c0) * s];
    const jw = (x: number, y: number): [number, number] => [hx + (x * c1 - y * s1) * s, hy + (x * s1 + y * c1) * s];
    const LIP = -0.2, JAW = -0.3;
    // die Höhle: oben die Lippe, vorn eine nach innen gewölbte Kante, unten die Kieferoberkante, hinten ein weicher Bogen unter der Wange
    const pts: [number, number][] = [];
    const bez = (p0: [number, number], p1: [number, number], p2: [number, number], n = 8) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } };
    const uL = up(-3.4, LIP - 0.8), uF = up(len, LIP), jF = jw(len, JAW), jL = jw(-3.4, JAW + 1.2);
    pts.push(uL);
    pts.push(uF);
    // vorn nach innen gewölbt: Die Öffnung ist offen, man sieht keine Kante
    bez(uF, [(uF[0] + jF[0]) / 2 - (c0 + c1) * 0.5 * len * 0.22 * s, (uF[1] + jF[1]) / 2 - (s0 + s1) * 0.5 * len * 0.22 * s], jF);
    pts.push(jL);
    bez(jL, up(-7.5, (LIP + JAW) / 2 + opening * 4), uL);
    g.fillStyle(0x140709, 0.96 * fade);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillPath();
    // tiefer im Rachen noch dunkler: ein zweiter, kleinerer Bogen
    g.fillStyle(0x08030a, 0.55 * fade);
    g.beginPath();
    const mid = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const q = [mid(uL, uF, 0.04), mid(uL, uF, 0.5), mid(jL, jF, 0.5), mid(jL, jF, 0.04)];
    g.moveTo(q[0][0], q[0][1]);
    g.lineTo(q[1][0], q[1][1]);
    g.lineTo(q[2][0], q[2][1]);
    g.lineTo(q[3][0], q[3][1]);
    g.closePath();
    g.fillPath();
    // Gaumen: schmaler Streifen an der Oberlippe (dicker in der Mitte, läuft vorn und hinten aus)
    const th = 1.0 + 1.7 * opening;
    for (let i = 0; i <= MOUTH_COLS; i++) {
      const t = i / MOUTH_COLS, x = -1.5 + (len - 1.5 + 1.5) * t, prof = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.7);
      const a1 = up(x, LIP - 0.2), a2 = up(x, LIP - 0.2 + th * prof);
      pal.set(i, 0, a1[0], a1[1]);
      pal.set(i, 1, a2[0], a2[1]);
      // Mundboden: Streifen an der Kieferoberkante, nach oben (in die Öffnung) gerichtet
      const b1 = jw(x, JAW + 0.3), b2 = jw(x, JAW + 0.3 - th * 0.85 * prof);
      flo.set(i, 0, b2[0], b2[1]);
      flo.set(i, 1, b1[0], b1[1]);
    }
    pal.mesh.setAlpha(fade);
    flo.mesh.setAlpha(fade);
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
