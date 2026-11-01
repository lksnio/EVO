import Phaser from 'phaser';
import type { SpeciesDef } from '../../data/species';
import { css, mix, shade } from '../../util/color';
import { ell, newCanvas, type Ctx } from '../../util/canvas';
import type { FishPose } from '../fish/rig';

/** Jointed shells and limbs; no fish spine is applied to chitin or a cephalopod shell. */
export class InvertebrateRig {
  readonly parts: Phaser.GameObjects.GameObject[] = [];
  readonly width: number;
  readonly height: number;
  private joints: { image: Phaser.GameObjects.Image | Phaser.GameObjects.Container; x: number; y: number; phase: number; motion: 'leg' | 'plate' | 'arm' | 'bell' | 'paddle' | 'claw'; index: number }[] = [];
  private phase = Math.random() * Math.PI * 2;

  constructor(readonly scene: Phaser.Scene, readonly def: SpeciesDef) {
    const p = def.art;
    this.height = p.t === 'jelly' ? 135 : p.t === 'trilo' ? 55 : 65;
    this.width = p.t === 'jelly' ? 68 : p.t === 'bug' ? 140 : 120;
    const c = p.c;
    const part = (name: string, box: [number, number, number, number], x: number, y: number, draw: (ctx: Ctx) => void) => {
      const key = `fauna_${def.id}_${name}`;
      const [x0, y0, w, h] = box;
      if (!scene.textures.exists(key)) {
        const [canvas, ctx] = newCanvas(w * 3, h * 3, true);
        ctx.scale(3, 3); ctx.translate(-x0, -y0); draw(ctx);
        scene.textures.addCanvas(key, canvas);
      }
      const img = new Phaser.GameObjects.Image(scene, x, y, key).setOrigin(-x0 / w, -y0 / h).setScale(1 / 3);
      this.parts.push(img);
      return img;
    };
    const joint = (image: Phaser.GameObjects.Image | Phaser.GameObjects.Container, motion: (typeof this.joints)[number]['motion'], index: number, phase: number) => {
      this.joints.push({ image, x: image.x, y: image.y, phase, motion, index });
    };
    const surface = (ctx: Ctx, path: () => void, col: number, h: number, edge = 1) => {
      path(); const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, css(mix(col, 0xc9c5a5, 0.5))); g.addColorStop(0.3, css(shade(col, 0.15)));
      g.addColorStop(0.68, css(col)); g.addColorStop(1, css(shade(col, -0.55)));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(shade(col, -0.75)); ctx.lineWidth = edge; ctx.stroke();
    };
    const segment = (ctx: Ctx, col: number, l: number, h: number) => surface(ctx, () => {
      ctx.beginPath(); ctx.moveTo(0, -h * 0.4); ctx.quadraticCurveTo(l * 0.6, -h, l, -h * 0.45);
      ctx.quadraticCurveTo(l * 1.12, 0, l, h * 0.45); ctx.quadraticCurveTo(l * 0.6, h, 0, h * 0.4); ctx.closePath();
    }, col, h);
    if (p.t === 'bug' || p.t === 'trilo') {
      const trilo = p.t === 'trilo';
      const legs = trilo ? 9 : p.legs;
      for (const side of [-1, 1]) for (let i = 0; i < legs; i++) {
        const x = 27 - i * (trilo ? 6.5 : 12);
        const img = part(`leg_${side}_${i}`, [-30, -25, 36, 50], x, side * (trilo ? 10 : 5), ctx => {
          ctx.save(); ctx.scale(1, side);
          // Two stiff links and a hooked tip, with the knee visibly separate.
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const [w, col] of [[4, shade(c, -0.7)], [2, shade(c, 0.3)]] as const) {
            ctx.strokeStyle = css(col); ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, 7); ctx.lineTo(-21, 14); ctx.lineTo(-25, 11); ctx.stroke();
          }
          ctx.restore();
        });
        joint(img, 'leg', side, i * 0.8 + (side < 0 ? Math.PI : 0));
      }
      if (!trilo && p.paddles) for (const side of [-1, 1]) {
        const img = part('paddle_' + side, [-32, -12, 38, 38], -4, side * 7, ctx => {
          surface(ctx, () => { ell(ctx, -15, 10 * side, 16, 5, -side * 0.55); }, mix(c, 0x718b7b, 0.3), 10);
        });
        joint(img, 'paddle', side, side * 1.2);
      }
      // Tail to head: overlapping tergites cover joints, each plate stays rigid.
      const count = trilo ? 10 : p.segs;
      for (let i = count - 1; i >= 0; i--) {
        const x = 33 - i * (trilo ? 7.2 : 8.2), h = trilo ? 14 - i * 0.65 : 9 - i * 0.35;
        const img = part('plate_' + i, [-8, -h - 3, 19, h * 2 + 6], x, 0, ctx => {
          surface(ctx, () => { ell(ctx, 0, 0, 9, h); }, c, h);
          surface(ctx, () => { ell(ctx, 2, -0.7, 4, h * 0.65); }, shade(c, 0.12), h);
          ctx.strokeStyle = css(mix(c, 0xc8c4a0, 0.45), 0.65); ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(-2, -h * 0.8); ctx.quadraticCurveTo(-6, 0, -2, h * 0.8); ctx.stroke();
        });
        joint(img, 'plate', i, i * 0.4);
      }
      if (!trilo) part('telson', [-25, -8, 30, 16], -39, 0, ctx => {
        surface(ctx, () => { ctx.beginPath(); ctx.moveTo(3, -4); ctx.quadraticCurveTo(-12, -3, -23, 0); ctx.lineTo(3, 4); ctx.closePath(); }, c, 5);
      });
      if (!trilo && p.pincers) for (const side of [-1, 1]) {
        const img = part('claw_' + side, [-3, -15, 42, 31], 32, side * 8, ctx => {
          segment(ctx, c, 18, 4);
          surface(ctx, () => { ctx.beginPath(); ctx.moveTo(16, -5); ctx.quadraticCurveTo(29, -12, 37, -3); ctx.lineTo(25, -4); ctx.lineTo(22, 0); ctx.lineTo(36, 4); ctx.quadraticCurveTo(26, 12, 16, 5); ctx.closePath(); }, c, 10);
        });
        joint(img, 'claw', side, side);
      }
      part('head', [-22, -24, 42, 48], 32, 0, ctx => {
        surface(ctx, () => { ell(ctx, 0, 0, trilo ? 13 : 12, trilo ? 18 : 11); }, c, 18, 1.3);
        if (trilo) {
          ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(-18, -21); ctx.moveTo(-7, 12); ctx.lineTo(-18, 21);
          ctx.strokeStyle = css(shade(c, 0.12)); ctx.lineWidth = 2; ctx.stroke();
        }
        for (const y of [-1, 1]) {
          ell(ctx, 6, y * (trilo ? 9 : 6), 2.5, 2); ctx.fillStyle = '#172524'; ctx.fill();
          ell(ctx, 6.7, y * (trilo ? 9 : 6) - 0.6, 0.65, 0.65); ctx.fillStyle = '#b8bf98'; ctx.fill();
        }
      });
    } else if (p.t === 'cone') {
      // A solid chambered shell, with separate mantle, funnel and four articulated arms.
      part('shell', [-62, -17, 94, 34], 0, 0, ctx => {
        const shell = () => { ctx.beginPath(); ctx.moveTo(-60, 0); ctx.quadraticCurveTo(-13, -10, 25, -16); ctx.quadraticCurveTo(31, 0, 25, 16); ctx.quadraticCurveTo(-13, 10, -60, 0); ctx.closePath(); };
        surface(ctx, shell, mix(c, 0xb4ab89, 0.35), 17);
        ctx.save(); shell(); ctx.clip();
        for (let i = 0; i < 13; i++) {
          const x = 22 - i * 6.4;
          ctx.beginPath(); ctx.ellipse(x, 0, 3, 17, 0, -Math.PI / 2, Math.PI / 2);
          ctx.strokeStyle = css(shade(c, -0.55), 0.55); ctx.lineWidth = 1.1; ctx.stroke();
        }
        ctx.restore();
      });
      part('mantle', [-3, -13, 27, 26], 22, 0, ctx => segment(ctx, mix(c, 0x7c8981, 0.5), 17, 10));
      for (let arm = 0; arm < 6; arm++) {
        const root = new Phaser.GameObjects.Container(scene, 36, (arm - 2.5) * 2.7);
        this.parts.push(root);
        let parent = root;
        for (let i = 0; i < 5; i++) {
          const img = part(`arm_${arm}_${i}`, [-1, -4, 12, 8], 0, 0, ctx => segment(ctx, mix(c, 0xb0aa88, 0.4), 9, 2.8 - i * 0.4));
          this.parts.pop();
          const link = new Phaser.GameObjects.Container(scene, 0, 0); parent.add(link); link.add(img);
          joint(link, 'arm', i, arm * 0.8 + i * 0.6);
          const next = new Phaser.GameObjects.Container(scene, 8, 0); link.add(next); parent = next;
        }
        root.setRotation((arm - 2.5) * 0.12);
      }
      part('eye', [-4, -4, 8, 8], 34, -6, ctx => {
        ell(ctx, 0, 0, 3.2, 3.2); ctx.fillStyle = '#bdad71'; ctx.fill();
        ell(ctx, 0.8, 0, 1.7, 2); ctx.fillStyle = '#122321'; ctx.fill();
        ell(ctx, 1.5, -1, 0.7, 0.7); ctx.fillStyle = '#f4eacc'; ctx.fill();
      });
    } else if (p.t === 'jelly') {
      for (let i = 0; i < 8; i++) {
        const root = new Phaser.GameObjects.Container(scene, (i - 3.5) * 6, 5);
        this.parts.push(root);
        let parent = root;
        for (let j = 0; j < 7; j++) {
          const img = part(`tent_${i}_${j}`, [-3, -1, 6, 13], 0, 0, ctx => {
            ctx.strokeStyle = css(mix(c, 0xc9c0b5, 0.4), 0.75); ctx.lineWidth = 2 - j * 0.16;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(1.5, 5, 0, 11); ctx.stroke();
          });
          this.parts.pop();
          const link = new Phaser.GameObjects.Container(scene, 0, 0); parent.add(link); link.add(img); joint(link, 'arm', j, i + j * 0.4);
          const next = new Phaser.GameObjects.Container(scene, 0, 10); link.add(next); parent = next;
        }
      }
      const bell = part('bell', [-36, -35, 72, 51], 0, 0, ctx => {
        surface(ctx, () => { ctx.beginPath(); ctx.moveTo(-32, 7); ctx.bezierCurveTo(-34, -43, 34, -43, 32, 7); ctx.quadraticCurveTo(0, 17, -32, 7); ctx.closePath(); }, mix(c, 0xb5c5c0, 0.3), 32);
        ctx.strokeStyle = css(mix(c, 0xe1dbce, 0.65), 0.6); ctx.lineWidth = 1.2;
        for (const x of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(0, -29); ctx.quadraticCurveTo(x, -18, x * 1.2, 8); ctx.stroke(); }
      });
      joint(bell, 'bell', 0, 0);
    }
    this.pose({ t: 0, dt: 0, speed01: 0, mode: 'idle', open: 0, lunge: 0, clench: 0, grind: 0, coil: 0, dip: 0, pitch: 0, still: 0, crawlPhase: 0 });
  }

  pose(p: FishPose) {
    const trilo = this.def.art.t === 'trilo';
    this.phase += p.dt * (1.5 + p.speed01 * (trilo ? 10 : 5));
    for (const j of this.joints) {
      const ph = this.phase + j.phase;
      switch (j.motion) {
        case 'leg': j.image.rotation = Math.sin(ph * 2) * (0.1 + p.speed01 * 0.25) * j.index; break;
        case 'paddle': j.image.rotation = Math.sin(ph) * 0.4 * j.index; break;
        case 'plate': j.image.setPosition(j.x, j.y + Math.sin(ph) * (trilo ? 0.25 : 0.8) * j.index / 8).setRotation(trilo ? 0 : Math.sin(ph) * j.index * 0.006); break;
        case 'arm': j.image.rotation = Math.sin(ph) * (0.12 + j.index * 0.025); break;
        case 'bell': j.image.setScale((1 + Math.sin(ph) * 0.07) / 3, (1 - Math.sin(ph) * 0.06) / 3); break;
        case 'claw': j.image.rotation = j.index * (0.22 + p.open * 0.25 + Math.sin(ph) * 0.04); break;
      }
    }
  }
}
