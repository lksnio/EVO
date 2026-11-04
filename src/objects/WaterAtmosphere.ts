import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { LevelData } from '../level/LevelGen';
import { groundAt } from '../level/terrain';
import { waterSurfaces } from '../art/waterGeometry';
import { newCanvas } from '../util/canvas';
import { focus, surface } from '../sim/swell';
import { mulberry32 } from '../util/math';

const FRAMES = 8;
/** so viele Bilder der Kaustik je Sekunde – dazwischen wird weich übergeblendet */
const CAUSTIC_RATE = 1.6;
function textures(scene: Phaser.Scene) {
  if (scene.textures.exists('river_caustic_0')) return;
  for (let frame = 0; frame < FRAMES; frame++) {
    const [c, ctx] = newCanvas(256, 128);
    const phase = frame / FRAMES * Math.PI * 2;
    // Seamless in x; the phase changes the curvature, not just the offset of two fixed textures.
    for (let band = -1; band < 5; band++) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const a = x / 256 * Math.PI * 2;
        const y = band * 32 + 13 * Math.sin(a + phase + band * 1.3) + 5 * Math.sin(a * 3 - phase + band);
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (const [width, alpha] of [[10, 0.12], [4, 0.4], [1.5, 0.8]]) {
        ctx.strokeStyle = `rgba(185,231,212,${alpha})`; ctx.lineWidth = width; ctx.stroke();
      }
    }
    scene.textures.addCanvas('river_caustic_' + frame, c);
  }
  const [c, ctx] = newCanvas(192, 512);
  for (let y = 0; y < 512; y += 4) {
    const t = y / 512, w = 24 + t * 60;
    const g = ctx.createLinearGradient(96 - w, 0, 96 + w, 0);
    // oben blendet der Strahl weich ein (keine Oberkante: Das Wasser geht über dem Dach weiter), nach unten läuft er aus
    const fadeIn = Math.min(1, t / 0.14), alpha = fadeIn * fadeIn * (3 - 2 * fadeIn) * (1 - t) ** 1.8 * (0.4 + 0.3 * Math.sin(t * 18) ** 2);
    g.addColorStop(0, 'rgba(182,221,209,0)'); g.addColorStop(0.5, `rgba(182,221,209,${alpha})`); g.addColorStop(1, 'rgba(182,221,209,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, 192, 4);
  }
  scene.textures.addCanvas('river_soft_ray', c);
  // ein schmaler Lichtfaden: gleich unter der Oberfläche hell, nach unten lang auslaufend, zur Seite weich
  const [s, sx] = newCanvas(32, 512);
  for (let y = 0; y < 512; y += 2) {
    const t = y / 512, fadeIn = Math.min(1, t / 0.05);
    const a = fadeIn * (1 - t) ** 1.5;
    const g = sx.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(206,240,226,0)'); g.addColorStop(0.5, `rgba(206,240,226,${a})`); g.addColorStop(1, 'rgba(206,240,226,0)');
    sx.fillStyle = g; sx.fillRect(0, y, 32, 2);
  }
  scene.textures.addCanvas('swell_streak', s);
  // weiche helle Schlieren im Wasser (nahtlos in beide Richtungen): Wasser, das in sich selbst strömt
  const VW = 512, VH = 256, [veil, vx] = newCanvas(VW, VH);
  const vr = mulberry32(4711);
  for (let i = 0; i < 46; i++) {
    const cx = vr() * VW, cy = vr() * VH, rx = 30 + vr() * 110, ry = 12 + vr() * 34, a = 0.12 + vr() * 0.22;
    for (const ox of [-VW, 0, VW]) for (const oy of [-VH, 0, VH]) {
      vx.save();
      vx.translate(cx + ox, cy + oy);
      vx.scale(1, ry / rx);
      const g = vx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(196,236,226,${a})`); g.addColorStop(0.55, `rgba(196,236,226,${a * 0.4})`); g.addColorStop(1, 'rgba(196,236,226,0)');
      vx.fillStyle = g;
      vx.fillRect(-rx, -rx, rx * 2, rx * 2);
      vx.restore();
    }
  }
  scene.textures.addCanvas('swell_veil', veil);
  const [fog, fx] = newCanvas(256, 128);
  const g = fx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(72,128,139,0.12)'); g.addColorStop(0.6, 'rgba(53,106,120,0.6)'); g.addColorStop(1, 'rgba(31,74,89,0.25)');
  fx.fillStyle = g; fx.fillRect(0, 0, 256, 128);
  scene.textures.addCanvas('river_distance_water', fog);
}

interface Streak {
  image: Phaser.GameObjects.Image;
  x: number;
  alpha: number;
  angle: number;
  phase: number;
}

/**
 * Licht im Wasser, getrieben vom Seegang (sim/swell.ts): Unter jedem Wellenkamm bündelt sich das Licht – Lichtfäden leuchten
 * auf, wenn ein Kamm über sie läuft, und wiegen sich mit der Oberfläche; die breiten Lichtbahnen atmen mit der langen Dünung;
 * die Lichtnetze am Grund fließen weich ineinander und werden heller, wenn darüber ein Kamm vorbeizieht. So läuft sichtbar
 * Licht durch das Wasser, im Takt der Wellen oben. Cached textures and static surface masks; per frame: UVs, alpha and
 * transforms only.
 */
export class WaterAtmosphere {
  private surfaces: { image: Phaser.GameObjects.TileSprite; next: Phaser.GameObjects.TileSprite; alpha: number; mask: Phaser.Display.Masks.GeometryMask; shape: Phaser.GameObjects.Graphics; cx: number }[] = [];
  private rays: { image: Phaser.GameObjects.Image; alpha: number; angle: number; phase: number; x: number }[] = [];
  private streaks: Streak[] = [];
  private mist: Phaser.GameObjects.TileSprite;
  /** zwei Lagen heller Schlieren, die verschieden schnell und in verschiedene Richtungen durchs Bild ziehen */
  private veils: { image: Phaser.GameObjects.TileSprite; f: number; vx: number; vy: number; scale: number; alpha: number }[] = [];
  private phase = -1;

  constructor(private scene: Phaser.Scene, private L: LevelData, private swell = 1) {
    textures(scene);
    for (const [i, surface] of waterSurfaces(L).entries()) {
      const xs = surface.points.map(p => p[0]), ys = surface.points.map(p => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      const shape = new Phaser.GameObjects.Graphics(scene);
      shape.fillStyle(0xffffff).fillPoints(surface.points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      const mask = shape.createGeometryMask();
      // zwei Lagen: das jetzige Bild des Lichtnetzes und das nächste, weich übergeblendet (statt sichtbar zu springen)
      const layer = () => {
        const image = scene.add.tileSprite(x, y, w, h, 'river_caustic_0').setOrigin(0).setDepth(DEPTH.terrain + 0.8)
          .setBlendMode(Phaser.BlendModes.ADD).setMask(mask).setTileScale(1.2, 0.6);
        image.tilePositionX = x + i * 13; image.tilePositionY = y;
        return image;
      };
      this.surfaces.push({ image: layer(), next: layer(), alpha: 0.10 * surface.light, mask, shape, cx: x + w / 2 });
    }
    for (const [i, lit] of L.lit.entries()) {
      const x = (lit.x0 + lit.x1) / 2;
      if (L.cave && x < L.cave.x + L.cave.w + 100) continue;
      const reach = Math.min(650, Math.max(140, groundAt(L.terrain.hp, x) - L.surfaceY - 20));
      // das Licht kommt von weiter oben, als man sieht: Der Strahl beginnt über dem Dach aus Wasser
      const image = scene.add.image(x, L.surfaceY - 200, 'river_soft_ray').setOrigin(0.5, 0).setDisplaySize(120 + (i % 3) * 40, reach + 200)
        .setDepth(DEPTH.decoBack - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.rays.push({ image, alpha: 0.10, angle: -9 + i % 3 * 3, phase: i * 1.7, x });
      // Lichtfäden in der Lichtbahn: schmal, dicht unter der Oberfläche hell, verschieden lang und breit
      const r = mulberry32(Math.round(lit.x0) * 31 + i);
      for (let sx = lit.x0 - 40 + r() * 40; sx < lit.x1 + 40; sx += 26 + r() * 46) {
        const ground = groundAt(L.terrain.hp, sx) - L.surfaceY;
        if (ground < 90) continue;
        const len = Math.min(720, ground + 60) * (0.55 + r() * 0.45);
        const edge = Math.min(1, (sx - lit.x0 + 40) / 120, (lit.x1 + 40 - sx) / 120);
        const streak = scene.add.image(sx, L.surfaceY + 4, 'swell_streak').setOrigin(0.5, 0).setDisplaySize(10 + r() * 34, len)
          .setDepth(DEPTH.decoBack - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.streaks.push({ image: streak, x: sx, alpha: (0.1 + r() * 0.12) * Math.max(0.2, edge), angle: -8 + (r() - 0.5) * 5, phase: r() * 6 });
      }
    }
    const cam = scene.cameras.main;
    this.mist = scene.add.tileSprite(0, 0, cam.width * 4, cam.height * 4, 'river_distance_water').setOrigin(0.5)
      .setDepth(DEPTH.bg + 2.5).setAlpha(0.22).setTileScale(4, 6);
    // das Wasser selbst strömt: zwei Lagen weicher Schlieren vor der Ferne, hinter Gelände und Tieren (die hintere langsamer)
    for (const [f, vx, vy, scale, alpha] of [[0.5, 9, 1.6, 2.6, 0.16], [0.75, -6, -0.8, 3.8, 0.12]]) {
      const image = scene.add.tileSprite(0, 0, 16, 16, 'swell_veil').setOrigin(0).setDepth(DEPTH.bg + 2.6)
        .setBlendMode(Phaser.BlendModes.ADD).setTileScale(scale, scale);
      this.veils.push({ image, f, vx, vy, scale, alpha });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.update(0, 0);
  }

  update(time: number, dt: number) {
    const t = time / 1000, cam = this.scene.cameras.main, v = cam.worldView, sw = this.swell;
    const step = t * CAUSTIC_RATE, frame = Math.floor(step) % FRAMES, u = step - Math.floor(step);
    const light = this.L.zones[0]?.def.light ?? 1;
    for (const s of this.surfaces) {
      const visible = s.image.x + s.image.width > v.x - 100 && s.image.x < v.right + 100;
      s.image.setVisible(visible);
      s.next.setVisible(visible);
      if (frame !== this.phase) {
        s.image.setTexture('river_caustic_' + frame);
        s.next.setTexture('river_caustic_' + (frame + 1) % FRAMES);
      }
      if (!visible) continue;
      s.image.tilePositionX += dt * 4;
      s.next.tilePositionX = s.image.tilePositionX;
      // heller, wenn über dem Grund gerade ein Kamm das Licht bündelt
      const a = s.alpha * light * (0.45 + 1.1 * focus(s.cx, t, 300, sw));
      s.image.setAlpha(a * (1 - u));
      s.next.setAlpha(a * u);
    }
    this.phase = frame;
    for (const r of this.rays) {
      // die breiten Bahnen atmen mit der langen Dünung
      const f = focus(r.x, t, 900, sw);
      r.image.setAngle(r.angle + Math.sin(t * 0.16 + r.phase) * 2);
      r.image.setAlpha(r.alpha * light * (0.55 + 0.75 * f));
    }
    for (const s of this.streaks) {
      const on = s.x > v.x - 260 && s.x < v.right + 160;
      s.image.setVisible(on);
      if (!on) continue;
      // jeder Faden hängt an der Oberfläche über ihm: Er wandert mit ihr hin und her und leuchtet auf, wenn ein Kamm
      // (auch ein kurzer) über ihn läuft
      const w = surface(s.x, t, sw), f = focus(s.x, t, 300, sw);
      s.image.setPosition(s.x + w.dx * 0.8, this.L.surfaceY + 4 + w.dy);
      s.image.setAngle(s.angle + w.dx * 0.12 + Math.sin(t * 0.2 + s.phase) * 1.2);
      s.image.setAlpha(s.alpha * light * Math.pow(f, 2.2) * 2.2);
    }
    // die Schlieren: hängen an der Welt (mit etwas Tiefe), treiben mit der Strömung und wiegen sich mit dem Seegang; oben, wo
    // das Licht ist, deutlich – nach unten verlöschen sie
    const sy = this.L.surfaceY, fade = (y: number) => Math.max(0, Math.min(1, 1 - (y - sy - 120) / 1100));
    for (const l of this.veils) {
      const o = surface(cam.midPoint.x, t * 0.8, sw);
      l.image.setPosition(v.x - 4, v.y - 4).setSize(v.width + 8, v.height + 8);
      l.image.tilePositionX = ((v.x - 4) * l.f + t * l.vx + o.dx * 0.6) / l.scale;
      l.image.tilePositionY = ((v.y - 4) * l.f + t * l.vy + o.dy * 0.6) / l.scale;
      const top = fade(v.y) * l.alpha * light, bottom = fade(v.bottom) * l.alpha * light;
      l.image.setAlpha(top, top, bottom, bottom);
    }
    this.mist.setPosition(cam.midPoint.x, cam.midPoint.y);
    this.mist.tilePositionX = cam.scrollX * 0.18 + t * 1.4;
    this.mist.setAlpha(0.20 + 0.025 * Math.sin(t * 0.12));
  }

  destroy() {
    for (const s of this.surfaces) { s.image.clearMask(); s.next.clearMask(); s.mask.destroy(); s.shape.destroy(); s.image.destroy(); s.next.destroy(); }
    this.surfaces = [];
    for (const r of this.rays) r.image.destroy();
    this.rays = [];
    for (const s of this.streaks) s.image.destroy();
    this.streaks = [];
    for (const l of this.veils) l.image.destroy();
    this.veils = [];
    this.mist.destroy();
  }
}
