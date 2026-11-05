import Phaser from 'phaser';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { skyAbove } from '../level/waterBounds';
import { waterLightAt } from './waterGeometry';
import { newCanvas } from '../util/canvas';
import { DEPTH } from '../config';
import { focus, surface, swellAt } from '../sim/swell';
import { stormSwell, sunlight, type Weather } from '../sim/weather';
import { lagoonEnabled } from './lagoonAssets';

const FILES = {
  sky: new URL('../assets/water/sky.webp', import.meta.url).href,
  waterline: new URL('../assets/water/waterline.webp', import.meta.url).href,
};
export function preloadWaterSurface(scene: Phaser.Scene) {
  for (const [id, url] of Object.entries(FILES)) if (!scene.textures.exists('surface_' + id)) scene.load.image('surface_' + id, url);
}

/** Mirror once at load time so both joins are continuous, even when crossing a long painting's boundary. */
function panorama(scene: Phaser.Scene, id: keyof typeof FILES) {
  const key = 'surface_loop_' + id;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get('surface_' + id).getSourceImage() as HTMLImageElement;
  const [canvas, ctx] = newCanvas(source.width * 2, source.height, true);
  ctx.drawImage(source, 0, 0); ctx.translate(source.width * 2, 0); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** so viele Zeilen Himmel liegen über der gemalten Kante (in Bildpunkten der Malerei) – Raum für hohe Wellen bei Sturm */
const SKY_PAD = 40;
/** je Spalte der Malerei (samt Himmel darüber): die Zeile, in der das Wasser beginnt – dort schlagen Regentropfen auf */
let crestRows: Uint8Array | undefined;

/**
 * Die gemalte Wellenkante, über dem Kamm mit der Farbe des Himmels an seinem unteren Rand aufgefüllt (er ist dort eine
 * einzige Farbe) – und darüber noch ein Streifen Himmel. So bleibt zwischen Himmel und Wasser kein Spalt, wenn die Kante
 * auf und ab wogt, auch bei Sturm: Das Band reicht immer über den unteren Rand des Himmels hinaus.
 */
function filledWaterline(scene: Phaser.Scene) {
  const key = 'surface_loop_waterline_sky';
  if (scene.textures.exists(key) && crestRows) return key;
  const src = scene.textures.get(panorama(scene, 'waterline')).getSourceImage() as HTMLCanvasElement;
  const sky = scene.textures.get('surface_sky').getSourceImage() as HTMLImageElement;
  const [, pctx] = newCanvas(sky.width, 1, true);
  pctx.drawImage(sky, 0, sky.height - 1, sky.width, 1, 0, 0, sky.width, 1);
  const row = pctx.getImageData(0, 0, sky.width, 1).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < row.length; i += 4) { r += row[i]; g += row[i + 1]; b += row[i + 2]; }
  const n = row.length / 4;
  const w = src.width, h = src.height + SKY_PAD;
  const [canvas, ctx] = newCanvas(w, h, true);
  ctx.drawImage(src, 0, SKY_PAD);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const sr = Math.round(r / n), sg = Math.round(g / n), sb = Math.round(b / n);
  crestRows = new Uint8Array(w);
  // Spalte für Spalte von oben bis zur Kante: Himmel darunter legen (die weiche Kante bleibt, sie liegt nun auf Himmel)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4, a = d[o + 3] / 255;
      if (a > 0.98) { crestRows[x] = y; break; }
      d[o] = Math.round(d[o] * a + sr * (1 - a));
      d[o + 1] = Math.round(d[o + 1] * a + sg * (1 - a));
      d[o + 2] = Math.round(d[o + 2] * a + sb * (1 - a));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Wolken für den Himmel: weiche, dunkle Ballen, nahtlos in beide Richtungen. */
function cloudTexture(scene: Phaser.Scene) {
  const key = 'surface_clouds';
  if (scene.textures.exists(key)) return key;
  const W = 512, H = 256, [canvas, ctx] = newCanvas(W, H);
  let seed = 77;
  const rnd = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * W, cy = rnd() * H, rx = 40 + rnd() * 110, ry = 16 + rnd() * 40, a = 0.18 + rnd() * 0.3, shade = 70 + rnd() * 50;
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(${shade},${shade + 12},${shade + 20},${a})`);
      g.addColorStop(0.6, `rgba(${shade},${shade + 12},${shade + 20},${a * 0.45})`);
      g.addColorStop(1, `rgba(${shade},${shade + 12},${shade + 20},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Kleine Bilder für den Regen: ein Spritzer, ein flacher Aufschlag an der Wasserlinie, ein Bläschen unter Wasser. */
function rainTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('rain_drop')) return;
  const [d, dx] = newCanvas(8, 8);
  const g = dx.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, 'rgba(236,248,246,1)'); g.addColorStop(0.5, 'rgba(214,238,236,0.7)'); g.addColorStop(1, 'rgba(214,238,236,0)');
  dx.fillStyle = g; dx.fillRect(0, 0, 8, 8);
  scene.textures.addCanvas('rain_drop', d);
  const [r, rx] = newCanvas(32, 8);
  rx.strokeStyle = 'rgba(232,248,244,0.9)'; rx.lineWidth = 1.5;
  rx.beginPath(); rx.ellipse(16, 4, 14, 2.4, 0, Math.PI, Math.PI * 2); rx.stroke();
  scene.textures.addCanvas('rain_ripple', r);
  const [b, bx] = newCanvas(10, 10);
  bx.strokeStyle = 'rgba(214,240,238,0.85)'; bx.lineWidth = 1.2;
  bx.beginPath(); bx.arc(5, 5, 3.4, 0, Math.PI * 2); bx.stroke();
  bx.fillStyle = 'rgba(255,255,255,0.9)'; bx.fillRect(3.4, 2.8, 1.4, 1.4);
  scene.textures.addCanvas('rain_bubble', b);
}

/** Der Lichtsaum unter der Oberfläche: oben hell, nach unten weich auslaufend (waagrecht gleich – die Helligkeit kommt je Punkt). */
function glintTexture(scene: Phaser.Scene) {
  const key = 'surface_glint';
  if (scene.textures.exists(key)) return key;
  const [canvas, ctx] = newCanvas(8, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(214,246,236,0)');
  g.addColorStop(0.1, 'rgba(214,246,236,0.95)');
  g.addColorStop(0.22, 'rgba(176,228,220,0.55)');
  g.addColorStop(0.55, 'rgba(140,206,204,0.16)');
  g.addColorStop(1, 'rgba(120,190,196,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Abstand der Stützpunkte auf den Wellenbändern (Bildpunkte der Welt); der weiche Lichtsaum braucht weniger */
const STEP = 24;
const GLINT_STEP = 36;
/** so viele Regentropfen fallen höchstens zugleich (im Bild) */
const DROPS = 260;
/** Wind: So schräg fällt der Regen (Bildpunkte seitwärts je Bildpunkt Fall) */
const SLANT = -0.16;

interface Band {
  ropes: Phaser.GameObjects.Rope[];
  /** ein weiteres Stück anlegen (nur bei sehr weitem Blick, etwa im Weltbaukasten) */
  make: () => Phaser.GameObjects.Rope;
  /** so lang ist eine Wiederholung der Malerei in der Welt */
  span: number;
  /** Mitte des Bandes unter der Ruhelage der Oberfläche */
  mid: number;
  scaleY: number;
  /** die Malerei treibt langsam mit (Bildpunkte je Sekunde) */
  drift: number;
  /** wie stark das Band dem Seegang folgt, und wo es ihn abliest (versetzt: ein zweiter Kamm hinter dem ersten) */
  follow: number;
  shift: number;
  /** Grundfarbe (wird bei Wolken dunkler) */
  color: number;
}

interface Drop {
  x: number;
  y: number;
  /** Fallgeschwindigkeit (Bildpunkte je Sekunde) und Länge des Strichs */
  v: number;
  len: number;
  /** vorn (1) oder weiter hinten (0): hinten dünner, blasser, langsamer */
  near: number;
  on: boolean;
  /** eben aufgeschlagen: noch dieses Bild bis an die Kante zeichnen, dann fort */
  hit: boolean;
}

const CLEAR: Weather = { cloud: 0, rain: 0 };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** eine Farbe zum Grau der Wolken hin abdunkeln (0 = unverändert) */
function overcast(color: number, k: number, to = 0x55636b) {
  const ch = (c: number, sh: number) => Math.round(lerp((c >> sh) & 255, (to >> sh) & 255, k));
  return (ch(color, 16) << 16) | (ch(color, 8) << 8) | ch(color, 0);
}

/**
 * Die Wasseroberfläche: Himmel darüber, darunter die gemalte Wellenkante – auf biegsamen Bändern, die dem Seegang folgen
 * (sim/swell.ts): Die Kämme heben sich spitz, die Täler sind breit, Wellenzüge laufen gegeneinander und in Gruppen durch.
 * Darunter ein Lichtsaum, wo die Kämme das Licht bündeln.
 *
 * Und das Wetter (sim/weather.ts): Wolken ziehen auf, Himmel und Wasser werden dunkler und grauer, der Seegang wird höher.
 * Regnet es, fällt er schräg im Wind; jeder Tropfen schlägt genau auf der wogenden Kante auf – mit einem kleinen Spritzer
 * und einem flachen Aufschlag, und unter Wasser steigen feine Bläschen auf. Je Bild: einige hundert Sinus-Rechnungen und
 * höchstens ein paar hundert Striche, keine neuen Texturen.
 */
export class WaterSurface {
  private sky: Phaser.GameObjects.TileSprite;
  private clouds: Phaser.GameObjects.TileSprite;
  private air: Phaser.GameObjects.Rectangle;
  private bands: Band[];
  private glint: Phaser.GameObjects.Rope;
  private glintCount: number;
  private rain: Phaser.GameObjects.Graphics;
  private drops: Drop[] = [];
  private splash: Phaser.GameObjects.Particles.ParticleEmitter;
  private ripple: Phaser.GameObjects.Particles.ParticleEmitter;
  private bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private shown = true;
  private objects: Phaser.GameObjects.GameObject[] = [];
  /** ruhige Orte (der Laichfluss) wogen weniger */
  private strength: number;
  private lastT = 0;
  private tint = -1;
  /** Höhe der gemalten Kante samt Himmelsstreifen (Bildpunkte der Malerei) */
  private bandRows: number;

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (skyAbove(ep, place, L) === undefined || !scene.textures.exists('surface_sky')) return undefined;
    return new WaterSurface(scene, L, swellAt(place.kind), lagoonEnabled(scene, ep, place));
  }
  private constructor(private scene: Phaser.Scene, private L: LevelData, strength: number, paintedCoast: boolean) {
    const y = L.surfaceY;
    this.strength = strength;
    rainTextures(scene);
    this.air = scene.add.rectangle(0, y - 2400, 6000, 2400, 0xb6c9c3).setOrigin(0).setDepth(DEPTH.decoFront + .4);
    // der Himmel endet etwas über der Ruhelage – darunter reicht immer das Band mit seinem Himmelsstreifen
    this.sky = scene.add.tileSprite(0, y - 652, 6000, 650, panorama(scene, 'sky')).setOrigin(0).setDepth(DEPTH.decoFront + .5).setTileScale(2, 1);
    this.clouds = scene.add.tileSprite(0, y - 652, 6000, 560, cloudTexture(scene)).setOrigin(0).setDepth(DEPTH.decoFront + .52).setTileScale(2.2, 1.6).setAlpha(0);
    const band = (key: string, depth: number, scaleY: number, span: number, mid: number, drift: number, follow: number, shift: number, color: number, alpha = 1): Band => {
      const count = Math.round(span / STEP) + 1;
      const make = () => {
        const points = Array.from({ length: count }, (_, i) => new Phaser.Math.Vector2(i * STEP, 0));
        const r = scene.add.rope(0, y + mid, key, undefined, points, true).setDepth(depth).setScale(1, scaleY).setAlpha(alpha).setColors(color);
        this.objects?.push(r);
        return r;
      };
      return { ropes: [make(), make()], make, span: (count - 1) * STEP, mid, scaleY, drift, follow, shift, color };
    };
    const src = scene.textures.get(panorama(scene, 'waterline')).getSourceImage() as HTMLCanvasElement;
    this.bandRows = src.height + SKY_PAD;
    this.bands = [
      // die gemalte Kante (darüber Himmel): 2 × so breit wie gemalt, halb so hoch; die Mitte liegt so, dass die Malerei
      // wie früher sitzt (der Himmelsstreifen kommt oben dazu)
      band(filledWaterline(scene), DEPTH.decoFront + .7, .5, src.width * 2, 17 - SKY_PAD / 4, 7, 1, 0, 0xffffff),
      // ein zweiter, heller Kamm dahinter, durchscheinend: Er wogt versetzt und schwächer
      band(panorama(scene, 'waterline'), DEPTH.decoFront + .8, .4, src.width * 1.43, 14, -3.2, .75, 140, 0xc1e5dc, .28),
    ];
    // The coast sits over the band's opaque sky padding. Repeat only its transparent painted crest in front of the
    // shoreline: identical points and drift keep the waves aligned, without cutting a gray stripe through the trees.
    if (paintedCoast) this.bands.push(band(panorama(scene, 'waterline'), DEPTH.decoFront + .72, .5, src.width * 2, 17, 7, 1, 0, 0xffffff));
    // der Lichtsaum folgt der Kamera (er ist waagrecht gleichförmig – nur die Helligkeit je Punkt kommt aus dem Seegang)
    this.glintCount = Math.ceil((1280 / .8 + 400) / GLINT_STEP) + 2;
    const gp = Array.from({ length: this.glintCount }, (_, i) => new Phaser.Math.Vector2(i * GLINT_STEP, 0));
    this.glint = scene.add.rope(0, y + 44, glintTexture(scene), undefined, gp, true).setDepth(DEPTH.decoFront + .65)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(1, 1.1);
    // Regen: Striche vor dem Himmel, hinter der Wellenkante (sie verdeckt, wo er ins Wasser fällt)
    this.rain = scene.add.graphics().setDepth(DEPTH.decoFront + .62);
    for (let i = 0; i < DROPS; i++) this.drops.push({ x: 0, y: 0, v: 0, len: 0, near: 0, on: false, hit: false });
    // Spritzer und Aufschläge vor der Kante, Bläschen unter ihr
    this.splash = scene.add.particles(0, 0, 'rain_drop', {
      emitting: false, lifespan: { min: 220, max: 420 }, speed: { min: 50, max: 150 }, angle: { min: -128, max: -52 },
      gravityY: 900, scale: { start: 0.55, end: 0.15 }, alpha: { start: 0.85, end: 0 },
    }).setDepth(DEPTH.decoFront + .75);
    this.ripple = scene.add.particles(0, 0, 'rain_ripple', {
      emitting: false, lifespan: { min: 260, max: 380 }, speed: 0, scaleX: { start: 0.25, end: 1.1 }, scaleY: { start: 0.6, end: 1 },
      alpha: { start: 0.7, end: 0 },
    }).setDepth(DEPTH.decoFront + .75);
    this.bubbles = scene.add.particles(0, 0, 'rain_bubble', {
      emitting: false, lifespan: { min: 500, max: 1050 }, speedY: { min: 25, max: 85 }, speedX: { min: -12, max: 12 }, gravityY: -95,
      scale: { min: 0.35, max: 0.75 }, alpha: { start: 0.6, end: 0 },
    }).setDepth(DEPTH.decoFront + .66);
    this.objects.push(this.air, this.sky, this.clouds, this.glint, this.rain, this.splash, this.ripple, this.bubbles);
    scene.events.once('shutdown', this.destroy, this);
    this.update(0);
  }

  /** Wo an der Stelle x (Welt) gerade das Wasser beginnt – die gemalte Kante auf dem wogenden Band. */
  private waterAt(x: number, t: number, s: number) {
    const b = this.bands[0];
    // welcher Punkt des Bandes liegt nach seiner Verschiebung (zum Kamm hin) gerade bei x? Zwei Schritte genügen.
    let x0 = x - surface(x, t, s).dx;
    x0 = x - surface(x0, t, s).dx;
    const w = surface(x0, t, s);
    const off = ((t * b.drift) % b.span + b.span) % b.span;
    const u = ((((x0 - off) % b.span) + b.span) % b.span) / b.span;
    const row = crestRows ? crestRows[Math.min(crestRows.length - 1, Math.floor(u * crestRows.length))] : SKY_PAD + 30;
    return this.L.surfaceY + b.mid + w.dy + (row - this.bandRows / 2) * b.scaleY;
  }

  /** time: Spielzeit (ms); weather: das Wetter am Ort (sim/weather.ts). */
  update(time: number, weather: Weather = CLEAR) {
    const cam = this.scene.cameras.main, view = cam.worldView;
    const y = this.L.surfaceY;
    const visible = view.top < y + 140 && view.bottom > y - 2400;
    if (visible !== this.shown) { this.shown = visible; for (const o of this.objects) (o as Phaser.GameObjects.Rope).setVisible(visible); }
    const t = time / 1000, dt = Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    if (!visible) { this.rain.clear(); return; }
    const s = this.strength * stormSwell(weather), cloud = weather.cloud, light = sunlight(weather);
    const x = view.left - 200, width = view.width + 400;
    this.air.setPosition(x, y - 2400).setSize(width, 2400);
    this.sky.setPosition(x, y - 652).setSize(width, 650);
    this.sky.tilePositionX = x * .08;
    // Wolken: ziehen mit dem Wind, oben dichter, zum Horizont hin dünner
    this.clouds.setPosition(x, y - 652).setSize(width, 560);
    this.clouds.tilePositionX = (x * .12 + t * 9) / 2.2;
    const ca = cloud * 0.9;
    this.clouds.setAlpha(ca, ca, ca * 0.35, ca * 0.35);
    // Himmel, Luft und Wasserkante werden gemeinsam grauer und dunkler (gleiche Tönung: Die Kante bleibt nahtlos)
    const tint = overcast(0xffffff, cloud * 0.62);
    if (tint !== this.tint) {
      this.tint = tint;
      this.sky.setTint(tint);
      this.air.setFillStyle(overcast(0xb6c9c3, cloud * 0.62));
      for (const b of this.bands) for (const r of b.ropes) r.setColors(b.color === 0xffffff ? tint : overcast(b.color, cloud * 0.5));
    }
    for (const b of this.bands) {
      // die Malerei treibt langsam; die Bänder liegen Stück an Stück, ein Band je Wiederholung
      const off = ((t * b.drift) % b.span + b.span) % b.span;
      const first = Math.floor((x - off) / b.span);
      while (b.ropes.length < Math.ceil(width / b.span) + 1) {
        const r = b.make();
        r.setColors(b.color === 0xffffff ? this.tint : overcast(b.color, cloud * 0.5));
        b.ropes.push(r);
      }
      b.ropes.forEach((r, j) => {
        const rx = off + (first + j) * b.span;
        const on = rx < x + width && rx + b.span > x;
        r.setVisible(on);
        if (!on) return;
        r.setPosition(rx, y + b.mid);
        const from = Math.max(0, Math.floor((x - rx) / STEP) - 1), to = Math.min(r.points.length - 1, Math.ceil((x + width - rx) / STEP) + 1);
        for (let i = from; i <= to; i++) {
          const w = surface(rx + i * STEP + b.shift, t, s * b.follow);
          r.points[i].x = i * STEP + w.dx;
          r.points[i].y = w.dy / b.scaleY;
        }
        r.setDirty();
      });
    }
    // der Lichtsaum: Wo ein Kamm das Licht bündelt, leuchtet es unter der Oberfläche auf – in den Lichtbahnen hell, sonst
    // leise, über einer Höhle gar nicht; unter Wolken matter, und im Regen blitzt er dort, wo Tropfen einschlagen
    const need = Math.ceil(width / GLINT_STEP) + 2;
    if (need > this.glintCount) {
      this.glintCount = need;
      this.glint.setPoints(Array.from({ length: need }, (_, i) => new Phaser.Math.Vector2(i * GLINT_STEP, 0)));
    }
    const g = this.glint, gx = Math.floor(x / GLINT_STEP) * GLINT_STEP;
    g.setPosition(gx, y + 44);
    const alphas = g.alphas, sparkle = Math.floor(t * 11);
    for (let i = 0; i < this.glintCount; i++) {
      const wx = gx + i * GLINT_STEP, w = surface(wx, t, s);
      g.points[i].x = i * GLINT_STEP + w.dx;
      g.points[i].y = w.dy / 1.1;
      const f = focus(wx, t, 0, s), cave = this.L.cave && wx > this.L.cave.x - 120 && wx < this.L.cave.x + this.L.cave.w;
      const hit = weather.rain > 0.02 && ((Math.imul(Math.floor(wx / GLINT_STEP) + 7919, sparkle * 2654435761) >>> 0) % 100) < 14 * weather.rain ? 0.28 * weather.rain : 0;
      const a = cave ? 0 : ((0.08 + 0.62 * f * f) * light + hit) * (0.3 + 0.7 * waterLightAt(this.L, wx, y + 40));
      alphas[i * 2] = a;
      alphas[i * 2 + 1] = a;
    }
    g.setDirty();
    this.rainStep(t, dt, weather.rain, s, view);
  }

  /** Der Regen: schräge Striche, jeder Tropfen schlägt genau auf der Kante auf – Spritzer, Aufschlag, Bläschen. */
  private rainStep(t: number, dt: number, rain: number, s: number, view: Phaser.Geom.Rectangle) {
    const g = this.rain;
    g.clear();
    const want = Math.round(DROPS * Math.min(1, rain * 1.1));
    if (want === 0 && !this.drops.some(d => d.on)) return;
    // ganz unter Wasser sieht man keinen Himmel: nichts fällt, bis die Kamera wieder hinaufschaut (dann regnet es gleich überall)
    if (view.top > this.L.surfaceY + 30) {
      for (const d of this.drops) d.on = false;
      return;
    }
    const L = this.L;
    const spawn = (d: Drop, anywhere: boolean) => {
      d.near = Math.random() < 0.55 ? 1 : 0;
      d.v = d.near ? 1050 + Math.random() * 350 : 760 + Math.random() * 220;
      d.len = d.near ? 26 + Math.random() * 18 : 14 + Math.random() * 10;
      d.x = view.left - 60 + Math.random() * (view.width + 160);
      const top = view.top - 30;
      d.y = anywhere ? top + Math.random() * Math.max(10, L.surfaceY - top) : top - Math.random() * 140;
      d.on = true;
      d.hit = false;
    };
    let active = 0;
    for (const d of this.drops) if (d.on) active++;
    for (const d of this.drops) {
      if (d.hit) { d.on = false; d.hit = false; active--; }
      if (!d.on) {
        if (active >= want) continue;
        spawn(d, t < 0.5 || active < want * 0.5);
        active++;
      }
      d.y += d.v * dt;
      d.x += d.v * SLANT * dt;
      if (d.x < view.left - 120) d.x += view.width + 200;
      else if (d.x > view.right + 120) d.x -= view.width + 200;
      if (d.y > L.surfaceY - 60) {
        const water = this.waterAt(d.x, t, s);
        if (d.y >= water) {
          if (d.near && view.contains(d.x, water)) {
            // nicht jeder Tropfen braucht ein eigenes Bild – es fallen sehr viele
            const r = Math.random();
            if (r < 0.4) this.splash.emitParticleAt(d.x, water - 1, r < 0.12 ? 2 : 1);
            if (r > 0.72) this.ripple.emitParticleAt(d.x, water + 1, 1);
            if (r > 0.3 && r < 0.48) this.bubbles.emitParticleAt(d.x + (Math.random() - 0.5) * 6, water + 22 + Math.random() * 16, 1);
          }
          // der Strich reicht noch bis an die Kante – erst im nächsten Bild ist der Tropfen fort
          d.y = water;
          d.hit = true;
          continue;
        }
      }
    }
    // erst die hinteren, dann die vorderen Striche (zwei Zeichenaufrufe)
    for (const near of [0, 1]) {
      g.lineStyle(near ? 1.5 : 1, near ? 0xdceeee : 0xb8cccf, (near ? 0.42 : 0.24) * Math.min(1, 0.4 + rain));
      g.beginPath();
      for (const d of this.drops) {
        if (!d.on || d.near !== near) continue;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - d.len * SLANT, d.y - d.len);
      }
      g.strokePath();
    }
  }

  destroy() {
    this.scene.events.off('shutdown', this.destroy, this);
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
