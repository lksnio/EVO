import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { Theme } from '../data/epochs';
import { tex, type Ctx } from '../util/canvas';
import { clamp, hashStr, mulberry32, type Rng } from '../util/math';

export interface RetroBackdropOptions {
  theme: Theme;
  variant?: 'normal' | 'dark' | 'cave';
  /** Unter Wasser: versunkene Maschinen und Lichtbahnen. An Land: überwachsene Ruinen. */
  water?: boolean;
  seed?: string | number;
  depth?: number;
}

interface Palette {
  sky: readonly [string, string, string];
  far: string;
  farEdge: string;
  steel: string;
  edge: string;
  shadow: string;
  cyan: string;
  magenta: string;
  amber: string;
  growth: string;
}

// Eigene, sparsame Farbrampen: Leuchtfarben sitzen an Konturen und Leitungen, nicht auf großen Flächen.
const PALETTES: Record<Theme, Palette> = {
  ozean: {
    sky: ['#040c28', '#082850', '#103c60'], far: '#103050', farEdge: '#204868',
    steel: '#10283c', edge: '#286078', shadow: '#08182c',
    cyan: '#40d8f0', magenta: '#d850c8', amber: '#f8a048', growth: '#185860',
  },
  sumpf: {
    sky: ['#100c30', '#202048', '#204058'], far: '#182c40', farEdge: '#305460',
    steel: '#102c38', edge: '#28606c', shadow: '#081c28',
    cyan: '#58e8c8', magenta: '#d860d8', amber: '#f8b848', growth: '#28705c',
  },
  reptil: {
    sky: ['#180c28', '#302040', '#583048'], far: '#382438', farEdge: '#684060',
    steel: '#302438', edge: '#785060', shadow: '#180c24',
    cyan: '#50d8f0', magenta: '#e858a8', amber: '#f8a040', growth: '#605040',
  },
  eis: {
    sky: ['#080c30', '#182858', '#285070'], far: '#203858', farEdge: '#386888',
    steel: '#182c48', edge: '#407890', shadow: '#101c38',
    cyan: '#70e8f8', magenta: '#b078f0', amber: '#f8b060', growth: '#387080',
  },
  eden: {
    sky: ['#100c30', '#282048', '#384c58'], far: '#283c48', farEdge: '#486860',
    steel: '#183038', edge: '#487068', shadow: '#102030',
    cyan: '#58e8c8', magenta: '#e070d0', amber: '#f8c060', growth: '#407858',
  },
};

const TW = 320, TH = 180;
/** Ein Texturpixel bleibt vier Bildschirmpixel breit – unabhängig vom Kamera-Zoom. */
const ART_SCALE = 4;
export const RETRO_PARALLAX = [0.06, 0.18, 0.36, 0.62] as const;

function poly(c: Ctx, points: readonly (readonly [number, number])[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fill();
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function trace(c: Ctx, x: number, y: number, width: number, color: string, right = true) {
  const d = right ? 1 : -1;
  for (let k = 0; k < 7; k++) rect(c, x + k * d, y + k, 1, 1, color);
  rect(c, right ? x + 7 : x - width, y + 7, width - 7, 1, color);
  rect(c, right ? x + width - 2 : x - width, y + 6, 3, 3, color);
}

/** Ein rasterförmig abgestufter Dunst statt eines weichgezeichneten Farbverlaufs. */
function sky(c: Ctx, p: Palette, r: Rng, dark: boolean, water: boolean) {
  const stops = p.sky.map((v) => parseInt(v.slice(1), 16));
  const rgb = (n: number, shift: number) => (n >> shift) & 255;
  const dim = dark ? 0.58 : 1;
  for (let y = 0; y < TH; y += 3) {
    const k = y / TH * 2, n = Math.min(1, Math.floor(k)), f = k - n;
    const channels = [16, 8, 0].map((s) => Math.round((rgb(stops[n], s) * (1 - f) + rgb(stops[n + 1], s) * f) * dim / 8) * 8);
    rect(c, 0, y, TW, 3, `rgb(${channels.join(',')})`);
  }
  // Die Lichtbahnen sind stufige Polygone, wie von Hand auf einem kleinen Raster gezeichnet.
  if (water) for (const x of [22, 136, 260]) {
    c.globalAlpha = dark ? 0.05 : 0.08;
    poly(c, [[x, 0], [x + 9, 0], [x + 55, 132], [x + 19, 132]], p.cyan);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(r() * TW), y = Math.floor(r() * 116);
    rect(c, x, y, 1, 1, r() > 0.8 ? p.farEdge : p.far);
  }
  // Ferner Horizont: versunkene Gebäudekronen und gestaffelte Hügel.
  for (let x = -8; x < TW + 16; x += 11) {
    const h = 10 + Math.floor(r() * 32), w = 9 + Math.floor(r() * 9);
    poly(c, [[x, TH], [x, 153 - h], [x + 3, 153 - h], [x + 3, 150 - h], [x + w - 3, 150 - h], [x + w - 3, 153 - h], [x + w, 153 - h], [x + w, TH]], p.far);
    rect(c, x + 4, 154 - h, Math.max(1, w - 8), 1, p.farEdge);
    if (r() > 0.52) rect(c, x + 5, 160 - h, 1, 3, p.farEdge);
  }
}

/** Nieten, geschrägte Panzerplatten und wenige kleine Wartungslichter. */
function tower(c: Ctx, x: number, base: number, w: number, h: number, p: Palette, r: Rng, near: boolean) {
  const y = base - h, face = near ? p.steel : p.far;
  poly(c, [[x, base], [x, y + 7], [x + 7, y], [x + w - 7, y], [x + w, y + 7], [x + w, base]], face);
  rect(c, x + 7, y, w - 14, 1, near ? p.edge : p.farEdge);
  rect(c, x + 2, y + 9, 2, h - 9, p.shadow);
  rect(c, x + w - 3, y + 9, 1, h - 9, near ? p.edge : p.farEdge);
  for (let yy = y + 13; yy < base; yy += 15) {
    rect(c, x + 5, yy, w - 10, 1, p.shadow);
    rect(c, x + 6, yy + 2, 1, 1, p.farEdge);
    rect(c, x + w - 7, yy + 2, 1, 1, p.farEdge);
    for (let xx = x + 8; xx < x + w - 8; xx += 5) {
      rect(c, xx, yy + 5, 2, 3, near && r() > 0.65 ? p.cyan : p.farEdge);
    }
  }
  if (near) {
    rect(c, x + 7, y + 6, 7, 2, p.cyan);
    rect(c, x + w - 13, y + 6, 5, 2, p.amber);
    // Wartungsschacht mit schrägen Warnmarkierungen.
    rect(c, x + 7, base - 19, w - 14, 16, p.shadow);
    for (let i = 0; i < 3; i++) poly(c, [[x + 8 + i * 4, base - 19], [x + 10 + i * 4, base - 19], [x + 8 + i * 4, base - 16], [x + 6 + i * 4, base - 16]], p.amber);
  }
}

/** Pixelweiser Ring mit Zahnkranz; keine geglätteten Canvas-Kreislinien. */
function turbine(c: Ctx, cx: number, cy: number, radius: number, p: Palette) {
  for (let y = -radius - 3; y <= radius + 3; y++) for (let x = -radius - 3; x <= radius + 3; x++) {
    const d = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    const tooth = Math.floor((angle + Math.PI) * 12 / Math.PI) % 2 === 0 ? 2 : 0;
    if (d > radius + tooth || d < radius - 6) continue;
    const rim = d > radius - 1 || d < radius - 5;
    rect(c, cx + x, cy + y, 1, 1, rim ? (x + y < 0 ? p.edge : p.shadow) : p.steel);
  }
  // Querverstrebungen hinter der Nabe, sichtbare Leuchtmarken außen.
  poly(c, [[cx - radius + 6, cy - 2], [cx + radius - 6, cy - 2], [cx + radius - 6, cy + 2], [cx - radius + 6, cy + 2]], p.steel);
  rect(c, cx - 2, cy - radius + 6, 4, radius * 2 - 12, p.steel);
  rect(c, cx - 4, cy - 4, 9, 9, p.shadow);
  rect(c, cx - 2, cy - 2, 5, 5, p.farEdge);
  rect(c, cx - 3, cy - radius + 1, 7, 2, p.cyan);
  rect(c, cx + radius - 3, cy - 3, 2, 7, p.magenta);
  rect(c, cx - 3, cy + radius - 2, 7, 2, p.amber);
}

function distantWorks(c: Ctx, p: Palette, r: Rng, water: boolean) {
  // Unterschiedliche Silhouetten, mit Freiräumen dazwischen: Turm, Rundportal und lange Brücke.
  tower(c, 14, 171, 30, 82, p, r, false);
  tower(c, 84, 171, 20, 52, p, r, false);
  tower(c, 206, 171, 34, 98, p, r, false);
  tower(c, 288, 171, 24, 59, p, r, false);
  rect(c, 0, 142, TW, 3, p.far);
  rect(c, 0, 142, TW, 1, p.farEdge);
  for (let x = -10; x < TW + 24; x += 32) {
    poly(c, [[x, 145], [x + 3, 145], [x + 30, 172], [x + 27, 172]], p.far);
  }
  // Eine große Ringanlage bleibt als Landmarke erkennbar, ohne die Spielfläche zu belegen.
  turbine(c, 153, 126, 30, { ...p, steel: p.far, edge: p.farEdge, cyan: p.farEdge, magenta: p.edge, amber: p.farEdge });
  rect(c, 150, 155, 7, 25, p.far);
  if (!water) {
    for (const x of [54, 114, 264]) {
      poly(c, [[x, 180], [x + 2, 104], [x + 5, 104], [x + 7, 180]], p.far);
      for (let j = 0; j < 5; j++) poly(c, [[x + 3, 105 + j * 8], [x - 11 - j, 100 + j * 5], [x - 10, 96 + j * 5], [x + 4, 102 + j * 8]], p.farEdge);
    }
  }
}

function machinery(c: Ctx, p: Palette, r: Rng, water: boolean) {
  tower(c, 62, 185, 38, 86, p, r, true);
  tower(c, 254, 185, 32, 65, p, r, true);
  // Mehrstufiges Brückendeck mit diagonalen Trägern und einer Leitungsfuge.
  poly(c, [[-10, 161], [40, 161], [49, 151], [125, 151], [135, 161], [207, 161], [220, 148], [TW + 8, 148], [TW + 8, 180], [-10, 180]], p.steel);
  poly(c, [[-10, 161], [40, 161], [49, 151], [125, 151], [135, 161], [207, 161], [220, 148], [TW + 8, 148], [TW + 8, 150], [221, 150], [208, 163], [134, 163], [124, 153], [50, 153], [41, 163], [-10, 163]], p.edge);
  rect(c, 0, 174, TW, 3, p.shadow);
  for (let x = 0; x < TW; x += 40) {
    poly(c, [[x + 1, 165], [x + 5, 165], [x + 17, 177], [x + 13, 177]], p.shadow);
    rect(c, x + 23, 166, 8, 1, p.farEdge);
    rect(c, x + 30, 171, 1, 1, p.amber);
  }
  // Zwei verkleidete Rohrbögen statt einfacher Rechteckkulissen.
  for (const [x, y, w] of [[117, 134, 79], [12, 154, 31]]) {
    poly(c, [[x, 180], [x, y + 6], [x + 6, y], [x + w - 6, y], [x + w, y + 6], [x + w, 180], [x + w - 6, 180], [x + w - 6, y + 8], [x + 6, y + 8], [x + 6, 180]], p.shadow);
    rect(c, x + 6, y, w - 12, 2, p.edge);
    rect(c, x + 8, y + 2, w - 16, 1, p.cyan);
    for (let xx = x + 12; xx < x + w - 8; xx += 13) rect(c, xx, y - 1, 3, 8, p.steel);
  }
  trace(c, 92, 143, 32, p.cyan);
  trace(c, 278, 151, 29, p.magenta, false);
  if (water) for (let i = 0; i < 12; i++) {
    const x = Math.floor(r() * TW), y = 169 + Math.floor(r() * 9);
    poly(c, [[x, 180], [x + 2, y - 14], [x + 5, y - 20], [x + 4, y - 7], [x + 9, y - 14], [x + 7, 180]], p.growth);
  }
  else for (let x = 0; x < TW; x += 17) {
    poly(c, [[x, 180], [x + 2, 163], [x + 5, 168], [x + 10, 158], [x + 8, 180]], p.growth);
  }
}

function nearWorks(c: Ctx, p: Palette, water: boolean) {
  // Die nächste Ebene ist bewusst luftig: starke Formen am Rand, das Zentrum bleibt lesbar.
  rect(c, 0, 177, TW, 3, p.shadow);
  for (const x of [6, 310]) {
    poly(c, [[x - 5, 180], [x - 5, 112], [x - 2, 108], [x + 4, 108], [x + 8, 112], [x + 8, 180]], p.shadow);
    rect(c, x - 2, 112, 1, 64, p.edge);
    rect(c, x, 116, 2, 17, p.cyan);
    rect(c, x, 139, 2, 5, p.magenta);
    rect(c, x - 4, 152, 12, 4, p.steel);
  }
  turbine(c, 221, 175, 19, p);
  if (water) {
    for (const [x, y] of [[28, 68], [116, 101], [178, 48], [244, 79], [294, 27]]) {
      rect(c, x, y, 1, 1, p.farEdge);
      rect(c, x + 1, y - 2, 1, 1, p.edge);
    }
  } else {
    for (const x of [17, 197, 297]) {
      poly(c, [[x, 180], [x + 3, 142], [x + 5, 151], [x + 11, 138], [x + 7, 180]], p.growth);
    }
  }
}

/**
 * Vier gekachelte Pixel-Art-Ebenen, unabhängig von Weltgröße und Bildschirmauflösung.
 * Einmal beim Levelaufbau erzeugen, in update(camera, elapsedMs) bewegen. Die Texturen werden wiederverwendet;
 * es entstehen weder pro Weltabschnitt noch pro Frame neue GameObjects.
 */
export class RetroBackdrop {
  readonly layers: Phaser.GameObjects.TileSprite[];
  private destroyed = false;
  private lastZoom = -1;
  private lastWidth = -1;
  private lastHeight = -1;

  constructor(private scene: Phaser.Scene, options: RetroBackdropOptions) {
    const water = options.water ?? true;
    const p = PALETTES[options.theme];
    const variant = options.variant ?? 'normal';
    const seed = hashStr(`${options.theme}/${variant}/${water}/${options.seed ?? 'evo-snes'}`);
    const keys = [0, 1, 2, 3].map((i) => tex(scene, `retro_bg_${seed}_${i}`, TW, TH, (c) => {
      c.imageSmoothingEnabled = false;
      const random = mulberry32(seed + i * 719);
      if (i === 0) sky(c, p, random, variant !== 'normal', water);
      else if (i === 1) distantWorks(c, p, random, water);
      else if (i === 2) machinery(c, p, random, water);
      else nearWorks(c, p, water);
    }));
    this.layers = keys.map((key, i) => {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return scene.add.tileSprite(0, 0, 1, 1, key)
        .setScrollFactor(0).setDepth((options.depth ?? DEPTH.bg) + i)
        .setName(`retro-parallax-${i}`);
    });
    this.update(scene.cameras.main, 0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, elapsedMs: number) {
    if (this.destroyed) return;
    const zoom = Math.max(0.1, camera.zoom);
    const width = camera.width, height = camera.height;
    // Ein schmaler Überstand vermeidet Fugen bei Kamerawackeln und gebrochenem Zoom.
    if (zoom !== this.lastZoom || width !== this.lastWidth || height !== this.lastHeight) {
      for (const sprite of this.layers) {
        sprite.setPosition(width / 2, height / 2);
        sprite.setSize((width + 16) / zoom, (height + 16) / zoom);
        sprite.setTileScale(ART_SCALE / zoom);
      }
      this.lastZoom = zoom;
      this.lastWidth = width;
      this.lastHeight = height;
    }
    for (let i = 0; i < this.layers.length; i++) {
      const sprite = this.layers[i];
      sprite.tilePositionX = Math.floor(camera.scrollX * zoom * RETRO_PARALLAX[i] / ART_SCALE);
      // Kein vertikaler Himmel-Repeat beim Tauchen: nur die transparenten Architekturen verschieben sich leicht.
      sprite.tilePositionY = i === 0 ? 0 : Math.floor(clamp(camera.scrollY * zoom * i * 0.008 / ART_SCALE, -8, 12));
    }
    // Wenige langsame Schwebepunkte auf der nahen Ebene – die Maschinen selbst gleiten nur mit der Kamera.
    this.layers[3].setAlpha(0.92 + Math.sin(elapsedMs * 0.00045) * 0.035);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const sprite of this.layers) sprite.destroy();
  }
}
