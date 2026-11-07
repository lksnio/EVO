import Phaser from 'phaser';
import type { Morph } from '../creatureArt';
import { drawEyeLids } from '../eyeLids';
import { starterInkColor, starterInkPainting } from '../fish/starterAppearance';
import { Grid, type Box, type FishPose } from '../fish/rig';
import { newCanvas } from '../../util/canvas';
import { clamp } from '../../util/math';
import { lineageBodyTexture, lineageJawTexture, lineageTexture } from './assets';
import { LINEAGE_ORIGIN, LINEAGE_WIDTH, lineageRegistration, type LineageFormId, type LineageRegistration } from './forms';
import { lineageBinding, lineagePoint, type Binding, type LineagePose } from './motion';

interface CutArt { body: string; jaw: string; jawBox: Box }
interface CanvasPiece { key: string; box: Box; binding: Binding }
interface Material { target: Phaser.GameObjects.Image | Phaser.GameObjects.Mesh2D; base: string; box?: Box; current: string }
interface CanvasPart { image: Phaser.GameObjects.Image; binding: Binding; box: Box }
const cuts = new WeakMap<Phaser.Textures.TextureManager, Map<LineageFormId, CutArt>>();
const canvasParts = new WeakMap<Phaser.Textures.TextureManager, Map<LineageFormId, { body: string; pieces: CanvasPiece[] }>>();
const styles = new WeakMap<Phaser.Textures.TextureManager, Map<string, { users: number; touched: number }>>();
let used = 0;
const BODY: Binding = { kind: 'body', weight: 0, pivot: [0, 0] };
const smooth = (a: number, b: number, value: number) => {
  const k = clamp((value - a) / (b - a), 0, 1); return k * k * (3 - 2 * k);
};

function polygon(c: CanvasRenderingContext2D, points: number[][], w: number, h: number) {
  c.beginPath(); points.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h)); c.closePath();
}
function belowLip(c: CanvasRenderingContext2D, points: number[][], w: number, h: number) {
  c.beginPath(); points.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h));
  c.lineTo(w, points.at(-1)![1] * h); c.lineTo(w, h); c.lineTo(points[0][0] * w, h); c.closePath();
}
function crop(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Box {
  const w = canvas.width, h = canvas.height, c = canvas.getContext('2d', { willReadFrequently: true })!;
  const d = c.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  if (x1 <= x0 || y1 <= y0) { x0 = y0 = 0; x1 = y1 = 1; }
  const [small, target] = newCanvas(x1 - x0, y1 - y0, true);
  target.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  scene.textures.addCanvas(key, small);
  return { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h };
}

/** Keep upper fangs on the skull, lower fangs on the mandible, and draw the oral cavity between the moving lips. */
function cutArt(scene: Phaser.Scene, id: LineageFormId, r: LineageRegistration): CutArt {
  let cache = cuts.get(scene.textures); if (!cache) cuts.set(scene.textures, cache = new Map());
  const saved = cache.get(id); if (saved) return saved;
  const uploaded = scene.textures.get(lineageTexture(id)).getSourceImage() as HTMLImageElement;
  const source = starterInkPainting(uploaded, LINEAGE_WIDTH), w = source.width, h = source.height;
  const [body, b] = newCanvas(w, h, true), [jaw, j] = newCanvas(w, h, true);
  b.drawImage(source, 0, 0); b.save(); belowLip(b, r.upperLip, w, h); b.clip(); b.clearRect(0, 0, w, h); b.restore();
  j.save(); belowLip(j, r.lowerLip, w, h); j.clip(); j.drawImage(source, 0, 0); j.restore();
  // The cheek overlaps the mandible's root like a real jaw joint. Without this socket,
  // closing an originally open painting exposes a straight triangular cut behind the chin.
  b.save(); b.beginPath(); b.ellipse(r.hinge[0]*w,(r.hinge[1]+.075)*h,.035*w,.135*h,0,0,Math.PI*2);
  b.clip(); b.drawImage(source,0,0); b.restore();
  for (const tooth of r.teeth) {
    const keep = tooth.upper ? b : j, remove = tooth.upper ? j : b;
    keep.save(); polygon(keep, tooth.polygon, w, h); keep.clip(); keep.drawImage(source, 0, 0); keep.restore();
    remove.save(); polygon(remove, tooth.polygon, w, h); remove.clip(); remove.clearRect(0, 0, w, h); remove.restore();
  }
  const bodyKey = lineageBodyTexture(id), jawKey = lineageJawTexture(id);
  scene.textures.addCanvas(bodyKey, body);
  const jawBox = crop(scene, jawKey, jaw);
  source.width = source.height = jaw.width = jaw.height = 1;
  scene.textures.remove(lineageTexture(id));
  const result = { body: bodyKey, jaw: jawKey, jawBox }; cache.set(id, result); return result;
}

/** A small shared material cache: only live variants and eight recently used variants occupy extra texture memory. */
function material(scene: Phaser.Scene, sourceKey: string, r: LineageRegistration, m: Morph, light: number, box?: Box) {
  const fin = Math.round(clamp(m.finColor ?? 0, 0, 1) * 12), shade = Math.round(clamp(m.scaleShade ?? 0, 0, 1) * 12);
  if (!fin && !shade && !light) return sourceKey;
  const key = sourceKey + `_f${fin}_s${shade}_l${light}`;
  let cache = styles.get(scene.textures); if (!cache) styles.set(scene.textures, cache = new Map());
  if (scene.textures.exists(key)) { cache.get(key)!.touched = ++used; return key; }
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
  const [canvas, c] = newCanvas(source.width, source.height, true); c.drawImage(source, 0, 0);
  const data = c.getImageData(0, 0, canvas.width, canvas.height), d = data.data;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4; if (d[i + 3] < 8) continue;
    const u = box ? box.x0 + (box.x1 - box.x0) * x / canvas.width : x / canvas.width;
    const v = box ? box.y0 + (box.y1 - box.y0) * y / canvas.height : y / canvas.height;
    const bind = fin ? lineageBinding(u, v, r.id) : BODY;
    const warmth = clamp((d[i] - d[i + 2] + 12) / 28, 0, 1) * clamp((d[i + 1] - d[i + 2] + 8) / 20, 0, 1);
    const finWeight = bind.kind === 'fin' || bind.kind === 'tail' ? warmth : 0;
    const eye = Math.hypot(u - r.eye[0], (v - r.eye[1]) * r.height / r.width) < r.eye[2] * 1.5;
    const mouth = u > r.hinge[0] && v > r.upperLip[0][1];
    const dark = eye || mouth ? 1 : 1 - shade / 12 * .7 * (1 - finWeight);
    const mix = fin / 12 * .55 * finWeight, lum = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
    const blue = [lum * .40, lum * .91, lum * .97];
    for (let k = 0; k < 3; k++) {
      let value = (d[i + k] * (1 - mix) + blue[k] * mix) * dark;
      value += (255 - value) * light / 8 * .45 * smooth(24, 82, lum);
      d[i + k] = value;
    }
  }
  c.putImageData(data, 0, 0); scene.textures.addCanvas(key, canvas); cache.set(key, { users: 0, touched: ++used }); return key;
}
function retain(scene: Phaser.Scene, key: string) { const item = styles.get(scene.textures)?.get(key); if (item) item.users++; }
function release(scene: Phaser.Scene, key: string) {
  const cache = styles.get(scene.textures), item = cache?.get(key); if (item) { item.users--; item.touched = ++used; }
  const unused = [...cache?.entries() ?? []].filter(([, v]) => v.users <= 0).sort((a, b) => b[1].touched - a[1].touched);
  for (const [key] of unused.slice(8)) { scene.textures.remove(key); cache!.delete(key); }
}

/** Canvas uses true detached tail/limb images, so fallback rendering still paddles and walks. */
function splitCanvasParts(scene: Phaser.Scene, id: LineageFormId, sourceKey: string) {
  let cache = canvasParts.get(scene.textures); if (!cache) canvasParts.set(scene.textures, cache = new Map());
  const saved = cache.get(id); if (saved) return saved;
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
  const w = source.width, h = source.height;
  const [staticCanvas, staticCtx] = newCanvas(w, h, true); staticCtx.drawImage(source, 0, 0);
  const staticData = staticCtx.getImageData(0, 0, w, h), d = staticData.data;
  const groups = new Map<string, { binding: Binding; data: ImageData }>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] < 8) continue;
    const bind = lineageBinding(x / w, y / h, id);
    if (bind.kind === 'body' || bind.weight < .12) continue;
    const key = `${bind.kind}:${bind.pivot.join(',')}`;
    let group = groups.get(key);
    if (!group) { group = { binding: { ...bind, weight: 1 }, data: staticCtx.createImageData(w, h) }; groups.set(key, group); }
    for (let k = 0; k < 4; k++) group.data.data[i + k] = d[i + k];
    d[i + 3] = 0;
  }
  staticCtx.putImageData(staticData, 0, 0);
  const body = sourceKey + '_static'; scene.textures.addCanvas(body, staticCanvas);
  const pieces = [...groups.values()].map((group, i) => {
    const [canvas, c] = newCanvas(w, h, true); c.putImageData(group.data, 0, 0);
    const key = sourceKey + '_part' + i, box = crop(scene, key, canvas); canvas.width = canvas.height = 1;
    return { key, box, binding: group.binding };
  });
  const result = { body, pieces }; cache.set(id, result); return result;
}

/** Animated paintings for the shared shoreline lineage; the trunk never ripples or changes shape. */
export class LineageRig {
  readonly parts: Phaser.GameObjects.GameObject[] = [];
  readonly lid: Phaser.GameObjects.Graphics;
  private readonly cavity: Phaser.GameObjects.Graphics;
  private readonly r: LineageRegistration;
  private readonly art: CutArt;
  private readonly materials: Material[] = [];
  private body?: Grid;
  private jaw?: Grid;
  private bindings: Binding[] = [];
  private bodyImage?: Phaser.GameObjects.Image;
  private jawImage?: Phaser.GameObjects.Image;
  private pieces: CanvasPart[] = [];
  private phase = Math.random() * Math.PI * 2;
  private finPhase = 0;
  private speed = 0;
  private closed = 0;
  private attack = 0;
  private light = -1;
  private disposed = false;
  private motion: LineagePose = { phase: 0, finPhase: 0, speed: 0, still: 0, pitch: 0, bob: 0, lunge: 0, opening: 0, mode: 'idle' };

  constructor(private scene: Phaser.Scene, readonly morph: Morph) {
    this.r = lineageRegistration(morph.lineageForm!); this.art = cutArt(scene, this.r.id, this.r);
    this.cavity = new Phaser.GameObjects.Graphics(scene); this.lid = new Phaser.GameObjects.Graphics(scene);
    this.parts.push(this.cavity);
    const h = LINEAGE_WIDTH * this.r.height / this.r.width, s = morph.size;
    if (scene.sys.game.renderer.type === Phaser.WEBGL) {
      this.body = new Grid(scene, this.art.body, { x0: 0, x1: 1, y0: 0, y1: 1 }, 60, 30);
      this.jaw = new Grid(scene, this.art.jaw, this.art.jawBox, 16, 8);
      this.body.mesh.setSize(LINEAGE_WIDTH * s, h * s); this.jaw.mesh.setSize(LINEAGE_WIDTH * s, h * s);
      this.bindings = Array.from(this.body.vx, (u, i) => lineageBinding(u, this.body!.vy[i], this.r.id));
      this.parts.push(this.jaw.mesh, this.body.mesh);
      this.materials.push({ target: this.body.mesh, base: this.art.body, current: '' }, { target: this.jaw.mesh, base: this.art.jaw, box: this.art.jawBox, current: '' });
    } else {
      const cut = splitCanvasParts(scene, this.r.id, this.art.body);
      this.bodyImage = new Phaser.GameObjects.Image(scene, 0, 0, cut.body).setOrigin(LINEAGE_ORIGIN[0], LINEAGE_ORIGIN[1]).setDisplaySize(LINEAGE_WIDTH * s, h * s);
      const b = this.art.jawBox;
      this.jawImage = new Phaser.GameObjects.Image(scene, 0, 0, this.art.jaw)
        .setOrigin((this.r.hinge[0] - b.x0) / (b.x1 - b.x0), (this.r.hinge[1] - b.y0) / (b.y1 - b.y0))
        .setDisplaySize((b.x1 - b.x0) * LINEAGE_WIDTH * s, (b.y1 - b.y0) * h * s);
      this.parts.push(this.jawImage, this.bodyImage);
      this.materials.push({ target: this.bodyImage, base: cut.body, current: '' }, { target: this.jawImage, base: this.art.jaw, box: b, current: '' });
      for (const piece of cut.pieces) {
        const p = piece.binding.pivot, b = piece.box;
        const image = new Phaser.GameObjects.Image(scene, 0, 0, piece.key)
          .setOrigin((p[0] - b.x0) / (b.x1 - b.x0), (p[1] - b.y0) / (b.y1 - b.y0))
          .setDisplaySize((b.x1 - b.x0) * LINEAGE_WIDTH * s, (b.y1 - b.y0) * h * s);
        this.pieces.push({ image, binding: piece.binding, box: b }); this.parts.push(image);
        this.materials.push({ target: image, base: piece.key, box: b, current: '' });
      }
    }
    this.parts.push(this.lid); this.setLift(0);
    this.pose({ t: 0, dt: 0, speed01: 0, mode: 'idle', open: 0, lunge: 0, clench: 0, grind: 0, coil: 0, dip: 0, pitch: 0, still: 0, crawlPhase: 0 });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; for (const entry of this.materials) release(this.scene, entry.current);
  }
  private map(u: number, v: number, binding = BODY, jaw = false) {
    const q = lineagePoint(u, v, this.r, this.motion, binding, jaw);
    return { x: q.x * this.morph.size, y: q.y * this.morph.size, rot: q.rot };
  }
  eyes(closed: number, attack: number) { this.closed = clamp(closed, 0, 1); this.attack = clamp(attack, 0, 1); this.drawEyes(); }
  private drawEyes() {
    const p = this.map(this.r.eye[0], this.r.eye[1]); this.lid.setPosition(p.x, p.y).setRotation(p.rot);
    drawEyeLids(this.lid, 0, 0, this.r.eye[2] * LINEAGE_WIDTH * this.morph.size * 1.1, starterInkColor(this.r.skin), 0x081015, this.closed, this.attack);
  }
  setLift(value: number) {
    const light = Math.round(clamp(value, 0, .5) * 16); if (light === this.light) return;
    for (const entry of this.materials) {
      const next = material(this.scene, entry.base, this.r, this.morph, light, entry.box);
      retain(this.scene, next); entry.target.setTexture(next); if (entry.current) release(this.scene, entry.current); entry.current = next;
    }
    this.light = light;
  }
  pose(p: FishPose) {
    this.speed += (clamp(p.speed01, 0, 1.5) - this.speed) * Math.min(1, p.dt * 5);
    const active = p.mode === 'walk' || p.mode === 'crawl';
    this.phase += p.dt * (active ? 4 + this.speed * 8 : 2.2 + this.speed * 9);
    this.finPhase += p.dt * (2.8 + this.speed * 4.5);
    // Open paintings close toward a resting bite. Long fangs retain enough clearance to remain anatomically fitted.
    const bite = this.r.id.includes('-bite-'), max = this.r.id.endsWith('-2');
    const close = -this.r.paintAngle * (bite ? max ? .52 : .68 : 1);
    this.motion = { phase: this.phase, finPhase: this.finPhase, speed: this.speed, still: p.still,
      pitch: p.pitch + p.dip * .025 + Math.sin(this.phase * .5) * .004 * (1 - p.still),
      bob: Math.sin(p.t * 1.8) * .08 * (1 - p.still), lunge: p.lunge * (bite ? 3.5 : 2.7),
      opening: close + clamp(p.open, 0, 1) * (bite ? .48 : .42), mode: p.mode };
    if (this.body) for (let j = 0; j <= this.body.rows; j++) for (let i = 0; i <= this.body.cols; i++) {
      const k = j * (this.body.cols + 1) + i, q = this.map(this.body.vx[k], this.body.vy[k], this.bindings[k]); this.body.set(i, j, q.x, q.y);
    }
    if (this.jaw) for (let j = 0; j <= this.jaw.rows; j++) for (let i = 0; i <= this.jaw.cols; i++) {
      const k = j * (this.jaw.cols + 1) + i, q = this.map(this.jaw.vx[k], this.jaw.vy[k], BODY, true); this.jaw.set(i, j, q.x, q.y);
    }
    if (this.bodyImage) {
      const origin = this.map(LINEAGE_ORIGIN[0], LINEAGE_ORIGIN[1]); this.bodyImage.setPosition(origin.x, origin.y).setRotation(origin.rot);
      const h = this.map(this.r.hinge[0], this.r.hinge[1]); this.jawImage!.setPosition(h.x, h.y).setRotation(this.motion.pitch + this.motion.opening);
      for (const part of this.pieces) {
        const p = part.binding.pivot, q = this.map(p[0], p[1], part.binding), next = this.map(p[0] + .01, p[1], part.binding);
        part.image.setPosition(q.x, q.y).setRotation(Math.atan2(next.y - q.y, next.x - q.x));
      }
    }
    this.cavity.clear();
    const top = this.r.upperLip, bottom = this.r.lowerLip;
    this.cavity.fillStyle(0x141014, 1); this.cavity.beginPath();
    top.forEach(([u, v], i) => { const q = this.map(u, v); if (i) this.cavity.lineTo(q.x, q.y); else this.cavity.moveTo(q.x, q.y); });
    for (let i = bottom.length - 1; i >= 0; i--) { const q = this.map(bottom[i][0], bottom[i][1], BODY, true); this.cavity.lineTo(q.x, q.y); }
    this.cavity.closePath(); this.cavity.fillPath(); this.drawEyes();
  }
}
