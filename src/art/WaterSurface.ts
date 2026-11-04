import Phaser from 'phaser';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { skyAbove } from '../level/waterBounds';
import { waterLightAt } from './waterGeometry';
import { newCanvas } from '../util/canvas';
import { DEPTH } from '../config';
import { focus, surface, swellAt } from '../sim/swell';

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

/**
 * Die gemalte Wellenkante, über dem Kamm mit der Farbe des Himmels an seinem unteren Rand aufgefüllt (er ist dort eine
 * einzige Farbe). So bleibt zwischen Himmel und Wasser kein Spalt, wenn die Kante auf und ab wogt – das Band reicht immer
 * über den unteren Rand des Himmels hinaus.
 */
function filledWaterline(scene: Phaser.Scene) {
  const key = 'surface_loop_waterline_sky';
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(panorama(scene, 'waterline')).getSourceImage() as HTMLCanvasElement;
  const sky = scene.textures.get('surface_sky').getSourceImage() as HTMLImageElement;
  const [, pctx] = newCanvas(sky.width, 1, true);
  pctx.drawImage(sky, 0, sky.height - 1, sky.width, 1, 0, 0, sky.width, 1);
  const row = pctx.getImageData(0, 0, sky.width, 1).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < row.length; i += 4) { r += row[i]; g += row[i + 1]; b += row[i + 2]; }
  const n = row.length / 4;
  const w = src.width, h = src.height;
  const [canvas, ctx] = newCanvas(w, h, true);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const sr = Math.round(r / n), sg = Math.round(g / n), sb = Math.round(b / n);
  // Spalte für Spalte von oben bis zur Kante: Himmel darunter legen (die weiche Kante bleibt, sie liegt nun auf Himmel)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4, a = d[o + 3] / 255;
      if (a > 0.98) break;
      d[o] = Math.round(d[o] * a + sr * (1 - a));
      d[o + 1] = Math.round(d[o + 1] * a + sg * (1 - a));
      d[o + 2] = Math.round(d[o + 2] * a + sb * (1 - a));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
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
}

/**
 * Die Wasseroberfläche: Himmel darüber, darunter die gemalte Wellenkante – auf biegsamen Bändern, die dem Seegang folgen
 * (sim/swell.ts): Die Kämme heben sich spitz, die Täler sind breit, Wellenzüge laufen gegeneinander und in Gruppen durch.
 * Darunter ein Lichtsaum, wo die Kämme das Licht bündeln. Je Bild: einige hundert Sinus-Rechnungen, keine neuen Texturen.
 */
export class WaterSurface {
  private sky: Phaser.GameObjects.TileSprite;
  private air: Phaser.GameObjects.Rectangle;
  private bands: Band[];
  private glint: Phaser.GameObjects.Rope;
  private glintCount: number;
  private shown = true;
  private objects: Phaser.GameObjects.GameObject[] = [];
  /** ruhige Orte (der Laichfluss) wogen weniger */
  private strength: number;

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (skyAbove(ep, place, L) === undefined || !scene.textures.exists('surface_sky')) return undefined;
    return new WaterSurface(scene, L, swellAt(place.kind));
  }
  private constructor(private scene: Phaser.Scene, private L: LevelData, strength: number) {
    const y = L.surfaceY;
    this.strength = strength;
    this.air = scene.add.rectangle(0, y - 2400, 6000, 2400, 0xb6c9c3).setOrigin(0).setDepth(DEPTH.decoFront + .4);
    this.sky = scene.add.tileSprite(0, y - 640, 6000, 650, panorama(scene, 'sky')).setOrigin(0).setDepth(DEPTH.decoFront + .5).setTileScale(2, 1);
    const band = (key: string, depth: number, scaleY: number, span: number, mid: number, drift: number, follow: number, shift: number, setup: (r: Phaser.GameObjects.Rope) => void): Band => {
      const count = Math.round(span / STEP) + 1;
      const make = () => {
        const points = Array.from({ length: count }, (_, i) => new Phaser.Math.Vector2(i * STEP, 0));
        const r = scene.add.rope(0, y + mid, key, undefined, points, true).setDepth(depth).setScale(1, scaleY);
        setup(r);
        this.objects?.push(r);
        return r;
      };
      return { ropes: [make(), make()], make, span: (count - 1) * STEP, mid, scaleY, drift, follow, shift };
    };
    const src = scene.textures.get(panorama(scene, 'waterline')).getSourceImage() as HTMLCanvasElement;
    this.bands = [
      // die gemalte Kante (über dem Kamm Himmel): 2 × so breit wie gemalt, halb so hoch
      band(filledWaterline(scene), DEPTH.decoFront + .7, .5, src.width * 2, 17, 7, 1, 0, () => {}),
      // ein zweiter, heller Kamm dahinter, durchscheinend: Er wogt versetzt und schwächer
      band(panorama(scene, 'waterline'), DEPTH.decoFront + .8, .4, src.width * 1.43, 14, -3.2, .75, 140, (r) => r.setAlpha(.28).setColors(0xc1e5dc)),
    ];
    // der Lichtsaum folgt der Kamera (er ist waagrecht gleichförmig – nur die Helligkeit je Punkt kommt aus dem Seegang)
    this.glintCount = Math.ceil((1280 / .8 + 400) / GLINT_STEP) + 2;
    const gp = Array.from({ length: this.glintCount }, (_, i) => new Phaser.Math.Vector2(i * GLINT_STEP, 0));
    this.glint = scene.add.rope(0, y + 44, glintTexture(scene), undefined, gp, true).setDepth(DEPTH.decoFront + .65)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(1, 1.1);
    this.objects.push(this.air, this.sky, this.glint);
    scene.events.once('shutdown', this.destroy, this);
    this.update(0);
  }

  update(time: number) {
    const cam = this.scene.cameras.main, view = cam.worldView;
    const y = this.L.surfaceY;
    const visible = view.top < y + 140 && view.bottom > y - 2400;
    if (visible !== this.shown) { this.shown = visible; for (const o of this.objects) (o as Phaser.GameObjects.Rope).setVisible(visible); }
    if (!visible) return;
    const t = time / 1000, s = this.strength;
    const x = view.left - 200, width = view.width + 400;
    this.air.setPosition(x, y - 2400).setSize(width, 2400);
    this.sky.setPosition(x, y - 640).setSize(width, 650);
    this.sky.tilePositionX = x * .08;
    for (const b of this.bands) {
      // die Malerei treibt langsam; die Bänder liegen Stück an Stück, ein Band je Wiederholung
      const off = ((t * b.drift) % b.span + b.span) % b.span;
      const first = Math.floor((x - off) / b.span);
      while (b.ropes.length < Math.ceil(width / b.span) + 1) b.ropes.push(b.make());
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
    // leise, über einer Höhle gar nicht
    const need = Math.ceil(width / GLINT_STEP) + 2;
    if (need > this.glintCount) {
      this.glintCount = need;
      this.glint.setPoints(Array.from({ length: need }, (_, i) => new Phaser.Math.Vector2(i * GLINT_STEP, 0)));
    }
    const g = this.glint, gx = Math.floor(x / GLINT_STEP) * GLINT_STEP;
    g.setPosition(gx, y + 44);
    const alphas = g.alphas;
    for (let i = 0; i < this.glintCount; i++) {
      const wx = gx + i * GLINT_STEP, w = surface(wx, t, s);
      g.points[i].x = i * GLINT_STEP + w.dx;
      g.points[i].y = w.dy / 1.1;
      const f = focus(wx, t, 0, s), cave = this.L.cave && wx > this.L.cave.x - 120 && wx < this.L.cave.x + this.L.cave.w;
      const a = cave ? 0 : (0.08 + 0.62 * f * f) * (0.3 + 0.7 * waterLightAt(this.L, wx, y + 40));
      alphas[i * 2] = a;
      alphas[i * 2 + 1] = a;
    }
    g.setDirty();
  }
  destroy() {
    this.scene.events.off('shutdown', this.destroy, this);
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
