import type Phaser from 'phaser';
import type { Art, SpeciesDef } from '../../data/species';
import { fishAnatomy, type FishAnatomy, type P2 } from '../fish/anatomy';
import type { Morph, Pal } from '../creatureArt';
import { fishTextures } from '../fish/rig';
import { bodyPath, paintBody, paintCaudal, paintJaw, paintOverlay, paintUpperTeeth, paintLowerTeeth } from '../fish/paint';
import { paintBodyPainted, paintJawPainted, paintedReady } from '../fish/painted';
import { css, mix, shade } from '../../util/color';
import type { Ctx } from '../../util/canvas';
import registration from './registration.json';

const images: Record<string, string> = {
  apsopelix: new URL('../../assets/fish/fauna/apsopelix.webp', import.meta.url).href,
  cheirolepis: new URL('../../assets/fish/fauna/cheirolepis.webp', import.meta.url).href,
  elonichthys: new URL('../../assets/fish/fauna/elonichthys.webp', import.meta.url).href,
  enchodus: new URL('../../assets/fish/fauna/enchodus.webp', import.meta.url).href,
  enchodus_fang: new URL('../../assets/fish/fauna/enchodus_fang.webp', import.meta.url).href,
  gillicus: new URL('../../assets/fish/fauna/gillicus.webp', import.meta.url).href,
  gillicus_anal: new URL('../../assets/fish/fauna/gillicus_anal.webp', import.meta.url).href,
  moythomasia: new URL('../../assets/fish/fauna/moythomasia.webp', import.meta.url).href,
  protosphyraena: new URL('../../assets/fish/fauna/protosphyraena.webp', import.meta.url).href,
  protosphyraena_pectoral: new URL('../../assets/fish/fauna/protosphyraena_pectoral.webp', import.meta.url).href,
  xiphactinus: new URL('../../assets/fish/fauna/xiphactinus.webp', import.meta.url).href,
  xiphactinus_jaw: new URL('../../assets/fish/fauna/xiphactinus_jaw.webp', import.meta.url).href,
};
export function preloadFauna(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(images)) {
    const id = path.split('/').pop()!.replace('.webp', '');
    if (id !== 'head_armor' && !scene.textures.exists('fauna_src_' + id)) scene.load.image('fauna_src_' + id, url);
  }
}

type FishArt = Extract<Art, { t: 'fish' }>;
type Registered = (typeof registration)[keyof typeof registration];
export const rayRegistration = (id: string): Registered | undefined => (registration as Record<string, Registered>)[id];

/** Fixed species share the player's skeleton, never its evolution or gameplay values. */
export function speciesAnatomy(def: SpeciesDef): FishAnatomy {
  if (def.art.t !== 'fish') throw new Error('Not a fish: ' + def.id);
  const p = def.art;
  const lobed = p.lobed || def.id === 'hyneria';
  const m: Morph = { cls: 'fish', size: 1, jaw: p.teeth ? (def.boss ? 0.9 : 0.2) : 0,
    skull: p.armor ? 0.8 : 0, stealth: p.eel ? 1 : 0, diet: p.teeth ? 0.6 : -0.5,
    scars: 0, belly: 1, fierce: def.role === 'apex' ? 0.7 : 0.15, hue: 1, seed: 7,
    limb: lobed ? 0.65 : 0, spike: p.armor ? -0.7 : 0, armor: p.armor ? 0.6 : 0,
    snout: p.snout ?? (def.id === 'rhizodus' ? 0.8 : p.shark ? 0.5 : 0), len: p.eel ? 1 : 0, girth: p.eel ? -1 : 0 };
  const A = fishAnatomy(m);
  A.s = 1;
  const r = rayRegistration(def.id);
  if (r) {
    // Uniform registration preserves the new paintings' proportions and alpha silhouette.
    const k = 100 / (r.bounds[2] - r.bounds[0]);
    const ox = (r.bounds[0] + r.bounds[2]) / 2, oy = r.points.tailRoot[1];
    const pt = (v: number[]): P2 => [(v[0] - ox) * k, (v[1] - oy) * k];
    const at = (name: keyof typeof r.points) => pt(r.points[name]);
    A.bounds = { x0: -52, x1: 52, y0: (r.bounds[1] - oy) * k - 3, y1: (r.bounds[3] - oy) * k + 4 };
    [A.hx, A.hy] = at('headStart');
    A.tip = at('upperLip'); A.hinge = at('jawHinge');
    // Lip angle belongs to the species; keep the jaw pivot below the eye.
    const e = at('eye');
    A.eye = { x: e[0], y: e[1], r: Math.max(1.1, Math.min(1.9, (A.bounds.y1 - A.bounds.y0) * 0.065)) };
    A.pedX = at('tailRoot')[0];
    A.bw = (A.hx - A.pedX) * 1.65; A.bh = (A.bounds.y1 - A.bounds.y0) * 0.65; A.bb = A.bh;
    A.hg = { ...A.hg, L: A.tip[0] - A.hx, H: A.bh * 0.9, ey: e[1] - A.hy, mouthY: A.hinge[1] - A.hy };
    A.jawRest = Math.atan2(A.tip[1] - A.hinge[1], A.tip[0] - A.hinge[0]);
    A.jawLen = Math.max(4, Math.hypot(A.tip[0] - A.hinge[0], A.tip[1] - A.hinge[1]));
    A.jawH = Math.max(2.4, Math.min(5, (A.bounds.y1 - A.hinge[1] - 4) * 0.55));
    A.dorsal.at = at('dorsalRoot'); A.anal.at = at('analRoot'); A.pelvic.at = at('pelvicRoot'); A.pectoral.at = at('pectoralRoot');
    A.dorsal.base = 19; A.dorsal.len = 12; A.anal.base = 13; A.anal.len = 9;
    A.pelvic.len = 7; A.pectoral.len = 15;
    A.anchorX = A.hx - 18; A.neckX = A.hx - 5;
    A.plate = 0;
  } else {
    // Keep each family slender/deep according to its species profile, with a readable head at game scale.
    const h = Math.max(p.h / p.len, p.eel ? 0.1 : 0.25);
    const bodyHeight = Math.max(...A.loop.map(q => q[1])) - Math.min(...A.loop.map(q => q[1]));
    const ky = h * (A.tip[0] - A.pedX) / bodyHeight;
    const map = (q: P2): P2 => [q[0], q[1] * ky];
    A.bh *= ky; A.bb *= ky; A.hy *= ky; A.pedH *= ky;
    A.hg = { ...A.hg, H: A.hg.H * ky, mouthY: A.hg.mouthY * ky, jawH: A.hg.jawH * ky, dome: A.hg.dome * ky, snoutH: A.hg.snoutH * ky, ey: A.hg.ey * ky };
    A.loop = A.loop.map(map); A.hinge = map(A.hinge); A.tip = map(A.tip); A.jawH *= ky;
    A.tail.spread *= Math.max(0.5, ky);
    A.eye.y *= ky;
    for (const f of [A.dorsal, A.anal, A.pelvic, A.pectoral]) f.at = map(f.at);
    A.bounds.y0 *= ky; A.bounds.y1 *= ky;
  }
  A.jawless = !!p.jawless;
  A.teeth = p.jawless || !p.teeth ? 'none' : p.armor ? 'blades' : 'teeth';
  if (p.shark) {
    A.plate = 0;
    A.tail.up = 0.7; A.tail.kind = 'shark';
    A.dorsal.shape = p.anvil ? 'anvil' : 'shark'; A.dorsal.stiffness = p.anvil ? 1 : 0.65;
    A.dorsal.len *= 1.15; A.dorsal.base *= 0.75;
    A.pectoral.shape = 'shark'; A.pectoral.len *= 1.3;
    A.dorsal2 = { k: 1, at: [A.pedX + 7, -A.pedH], base: 10, len: 9, shape: 'shark', stiffness: 0.65 };
  }
  if (lobed) {
    A.pectoral.lobed = true; A.pectoral.len = 17;
    A.tail.kind = 'lobed'; A.tail.up = 0; A.tail.fork = 1;
    A.dorsal.at[0] -= 7; A.dorsal.base *= 0.65;
    A.dorsal2 = { k: 1, at: [A.pedX + 9, -A.pedH], base: 13, len: 11 };
    A.pelvic.base = 11; A.pelvic.len = 11;
  }
  if (p.jawless || p.armor) {
    A.rigidFrom = A.hx - (p.armor || p.shield ? A.bw * 0.28 : 4);
    A.anchorX = A.rigidFrom - 8;
    A.neckX = A.rigidFrom;
    if (p.armor || p.shield) A.plate = 1;
    A.m.armor = 0;
    if (p.jawless) {
      A.jawH = 2; A.jawLen = 3;
      A.pectoral.k = p.shield ? 0.5 : 0; A.pelvic.k = 0; A.anal.k = 0;
      A.eye.x = A.hx + A.hg.L * 0.58;
      A.hinge = [A.tip[0], A.tip[1] + A.bh * 0.1];
      A.dorsal.at = [A.pedX + 9, -A.pedH]; A.dorsal.base = 12; A.dorsal.len = 8;
      if (p.shield || p.armor) {
        A.plate = 0;
        A.loop[2] = [A.hx + A.hg.L * 0.74, -A.bh * 0.2];
        A.loop[3] = [A.hx + A.hg.L * 0.42, -A.bh * 0.42];
        A.loop[4] = [A.hx, -A.bh * 0.5];
        A.loop[5] = [A.hx - A.bw * 0.15, -A.bh * 0.46];
        A.loop[6] = [A.bw * 0.08, -A.bh * 0.3];
        A.eye.r = 1.3;
        if (p.eyesFront) A.eye.x = A.hx + A.hg.L * 0.84;
        A.loop.push([A.hx + A.hg.L * 0.6, A.bh * 0.3]);
      }
    }
    if (p.arms) { A.pectoral.shape = 'arm'; A.pectoral.len = 25; A.pectoral.stiffness = 0.95; A.pelvic.k = 0; }
  }
  if (p.eel) {
    A.tail.kind = 'eel'; A.tail.spread *= 0.35;
    A.dorsal.base = A.bw * 0.8; A.dorsal.len = 4;
    A.pectoral.k = 0; A.pelvic.k = 0; A.anal.k = 0;
  }
  if (p.spiny || p.spines) { A.dorsal.shape = 'shark'; A.dorsal.stiffness = 0.85; }
  if (def.id === 'gillicus') { A.anal.base = 40; A.anal.len = 13; }
  // Include asymmetrical caudal tips and all solid plate silhouettes in the mesh bounds.
  if (!r) {
    A.bounds.x0 = Math.min(A.bounds.x0, A.pedX - A.tail.lobe * (1 + A.tail.up * 0.6) - 4);
    A.bounds.y0 = Math.min(A.bounds.y0, -A.tail.spread * (1 + A.tail.up) - 4);
  }
  return A;
}

const paletteOf = (p: FishArt, def: SpeciesDef): Pal => ({ base: p.c, belly: p.belly, fin: p.fin,
  dark: shade(p.c, -0.7), camo: shade(p.c, -0.25), eye: def.boss ? 0xcb8b37 : def.role === 'predator' ? 0xbf9a49 : 0x6c7250 });

function image(scene: Phaser.Scene, id: string) {
  return scene.textures.get('fauna_src_' + id).getSourceImage() as HTMLImageElement;
}

export function speciesFishTextures(scene: Phaser.Scene, def: SpeciesDef) {
  const A = speciesAnatomy(def), p = def.art as FishArt, P = paletteOf(p, def);
  const r = rayRegistration(def.id);
  return fishTextures(scene, A.m, { id: def.id, A, P,
    body: ctx => {
      if (r && scene.textures.exists('fauna_src_' + def.id)) {
        const k = 100 / (r.bounds[2] - r.bounds[0]);
        paintUpperTeeth(ctx, A);
        ctx.save();
        // Remove the immobile chin without drawing a seam through the neck.
        ctx.beginPath(); ctx.moveTo(-200, -200); ctx.lineTo(200, -200);
        ctx.lineTo(200, A.tip[1]); ctx.lineTo(A.tip[0], A.tip[1]);
        ctx.lineTo(A.hinge[0], A.hinge[1]); ctx.lineTo(A.hinge[0] - 1, 200); ctx.lineTo(-200, 200); ctx.closePath(); ctx.clip();
        ctx.drawImage(image(scene, def.id), -(r.bounds[0] + r.bounds[2]) * k / 2, -r.points.tailRoot[1] * k, r.size[0] * k, r.size[1] * k);
        ctx.restore();
        if (def.id === 'enchodus' && scene.textures.exists('fauna_src_enchodus_fang')) {
          ctx.drawImage(image(scene, 'enchodus_fang'), A.tip[0] - 6, A.tip[1] - 0.5, 4, 6);
        }
        return;
      }
      // Shared painted skin with family-specific caudal and skull; no whole-fish sprite is stretched.
      if (paintedReady(scene)) {
        ctx.save(); ctx.beginPath(); ctx.rect(A.pedX - 3, -500, 700, 1000); ctx.clip();
        paintBodyPainted(ctx, scene, A, P); ctx.restore();
        paintCaudal(ctx, A, P);
      } else paintBody(ctx, A, P);
      if (p.jawless && (p.armor || p.shield)) paintShield(ctx, A, P);
      if (p.shark) {
        ctx.save(); bodyPath(ctx, A); ctx.clip();
        ctx.strokeStyle = css(shade(p.c, -0.65), 0.75); ctx.lineWidth = 0.8;
        for (let i = 0; i < 5; i++) {
          const x = A.hx - 3 - i * 1.8;
          ctx.beginPath(); ctx.moveTo(x, A.hy - A.bh * 0.14); ctx.quadraticCurveTo(x - 2, A.hy, x - 0.5, A.hy + A.bh * 0.2); ctx.stroke();
        }
        ctx.restore();
      }
    },
    overlay: ctx => {
      if (r) {
        ctx.beginPath(); ctx.moveTo(A.hx + 2, A.eye.y - 2);
        ctx.quadraticCurveTo(A.hx - 3, A.hy, A.hx + 2, A.pectoral.at[1]);
        ctx.strokeStyle = css(P.dark, 0.5); ctx.lineWidth = 0.55; ctx.stroke();
      } else if (!p.shark && !p.jawless && !p.armor) paintOverlay(ctx, A, P);
    },
    jaw: ctx => {
      if (A.jawless) return;
      if (def.id === 'xiphactinus' && scene.textures.exists('fauna_src_xiphactinus_jaw')) {
        paintLowerTeeth(ctx, A);
        ctx.drawImage(image(scene, 'xiphactinus_jaw'), -2, -A.jawH * 0.2, A.jawLen + 3, A.jawH * 1.2);
      } else if (paintedReady(scene)) paintJawPainted(ctx, scene, A, P);
      else paintJaw(ctx, A, P);
    },
    fin: (ctx, kind, far) => {
      const id = def.id === 'gillicus' && kind === 'anal' ? 'gillicus_anal'
        : def.id === 'protosphyraena' && kind === 'pectoral' ? 'protosphyraena_pectoral' : '';
      if (!id || !scene.textures.exists('fauna_src_' + id)) return false;
      if (far) ctx.globalAlpha = 0.6;
      if (kind === 'anal') ctx.drawImage(image(scene, id), -A.anal.base / 2, -2, A.anal.base, A.anal.len + 2);
      else ctx.drawImage(image(scene, id), -A.pectoral.len, -3, A.pectoral.len + 2, A.pectoral.len * 0.7);
      return true;
    },
  });
}


/** Heterostracan/osteostracan shield: a rigid broad forebody with an organic trailing edge. */
function paintShield(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const x = A.rigidFrom!, h = A.bh, front = A.tip[0];
  ctx.save(); bodyPath(ctx, A); ctx.clip();
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x + 3, -h * 0.7);
    ctx.quadraticCurveTo(front, -h * 0.8, front + 3, 0);
    ctx.quadraticCurveTo(front, h * 0.5, x + 5, h * 0.55);
    ctx.bezierCurveTo(x + 2, h * 0.25, x - 3, h * 0.1, x + 1, -h * 0.14);
    ctx.quadraticCurveTo(x - 2, -h * 0.4, x + 3, -h * 0.7); ctx.closePath();
  };
  path(); const g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
  g.addColorStop(0, css(mix(P.base, 0xd3c9ac, 0.75))); g.addColorStop(0.4, css(mix(P.base, 0xb6ad95, 0.5)));
  g.addColorStop(1, css(shade(P.base, -0.15)));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = css(P.dark, 0.7); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6, -h * 0.45); ctx.quadraticCurveTo(x + 16, 0, x + 5, h * 0.42);
  ctx.moveTo(x + 12, -h * 0.05); ctx.quadraticCurveTo(front - 7, -h * 0.2, front - 2, 0);
  ctx.strokeStyle = css(P.dark, 0.45); ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore();
}
