import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { LevelData } from '../level/LevelGen';
import { groundAt } from '../level/terrain';
import { waterSurfaces } from '../art/waterGeometry';
import { newCanvas } from '../util/canvas';

const FRAMES = 8;
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
    const alpha = (1 - t) ** 1.8 * (0.4 + 0.3 * Math.sin(t * 18) ** 2);
    g.addColorStop(0, 'rgba(182,221,209,0)'); g.addColorStop(0.5, `rgba(182,221,209,${alpha})`); g.addColorStop(1, 'rgba(182,221,209,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, 192, 4);
  }
  scene.textures.addCanvas('river_soft_ray', c);
  const [fog, fx] = newCanvas(256, 128);
  const g = fx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(72,128,139,0.12)'); g.addColorStop(0.6, 'rgba(53,106,120,0.6)'); g.addColorStop(1, 'rgba(31,74,89,0.25)');
  fx.fillStyle = g; fx.fillRect(0, 0, 256, 128);
  scene.textures.addCanvas('river_distance_water', fog);
}

/** Cached textures and static surface masks. Per frame: UVs, alpha and transforms only. */
export class WaterAtmosphere {
  private surfaces: { image: Phaser.GameObjects.TileSprite; alpha: number; mask: Phaser.Display.Masks.GeometryMask; shape: Phaser.GameObjects.Graphics }[] = [];
  private rays: { image: Phaser.GameObjects.Image; alpha: number; angle: number; phase: number }[] = [];
  private mist: Phaser.GameObjects.TileSprite;
  private phase = -1;

  constructor(private scene: Phaser.Scene, private L: LevelData) {
    textures(scene);
    for (const [i, surface] of waterSurfaces(L).entries()) {
      const xs = surface.points.map(p => p[0]), ys = surface.points.map(p => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      const shape = new Phaser.GameObjects.Graphics(scene);
      shape.fillStyle(0xffffff).fillPoints(surface.points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      const mask = shape.createGeometryMask();
      const image = scene.add.tileSprite(x, y, w, h, 'river_caustic_0').setOrigin(0).setDepth(DEPTH.terrain + 0.8)
        .setBlendMode(Phaser.BlendModes.ADD).setMask(mask).setTileScale(1.2, 0.6);
      image.tilePositionX = x + i * 13; image.tilePositionY = y;
      this.surfaces.push({ image, alpha: 0.10 * surface.light, mask, shape });
    }
    for (const [i, lit] of L.lit.entries()) {
      const x = (lit.x0 + lit.x1) / 2;
      if (L.cave && x < L.cave.x + L.cave.w + 100) continue;
      const reach = Math.min(650, Math.max(140, groundAt(L.terrain.hp, x) - L.surfaceY - 20));
      const image = scene.add.image(x, L.surfaceY, 'river_soft_ray').setOrigin(0.5, 0).setDisplaySize(120 + (i % 3) * 40, reach)
        .setDepth(DEPTH.decoBack - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.rays.push({ image, alpha: 0.10, angle: -9 + i % 3 * 3, phase: i * 1.7 });
    }
    const cam = scene.cameras.main;
    this.mist = scene.add.tileSprite(0, 0, cam.width * 4, cam.height * 4, 'river_distance_water').setOrigin(0.5)
      .setDepth(DEPTH.bg + 2.5).setAlpha(0.22).setTileScale(4, 6);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.update(0, 0);
  }

  update(time: number, dt: number) {
    const t = time / 1000, cam = this.scene.cameras.main, v = cam.worldView;
    const frame = Math.floor(t * 1.5) % FRAMES;
    const light = this.L.zones[0]?.def.light ?? 1;
    for (const s of this.surfaces) {
      const visible = s.image.x + s.image.width > v.x - 100 && s.image.x < v.right + 100;
      s.image.setVisible(visible);
      if (frame !== this.phase) s.image.setTexture('river_caustic_' + frame);
      if (!visible) continue;
      s.image.tilePositionX += dt * 4;
      s.image.setAlpha(s.alpha * light * (0.85 + 0.15 * Math.sin(t * 0.6 + s.image.x * 0.002)));
    }
    this.phase = frame;
    for (const r of this.rays) {
      r.image.setAngle(r.angle + Math.sin(t * 0.16 + r.phase) * 2);
      r.image.setAlpha(r.alpha * light * (0.75 + 0.25 * Math.sin(t * 0.22 + r.phase)));
    }
    this.mist.setPosition(cam.midPoint.x, cam.midPoint.y);
    this.mist.tilePositionX = cam.scrollX * 0.18 + t * 1.4;
    this.mist.setAlpha(0.20 + 0.025 * Math.sin(t * 0.12));
  }

  destroy() {
    for (const s of this.surfaces) { s.image.clearMask(); s.mask.destroy(); s.shape.destroy(); s.image.destroy(); }
    this.surfaces = [];
    for (const r of this.rays) r.image.destroy();
    this.rays = [];
    this.mist.destroy();
  }
}
