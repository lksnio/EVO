import Phaser from 'phaser';
import type { UpKey } from '../state/GameState';
import { tex } from '../util/canvas';
import { text } from './ui';

// Die Segen der großen Muschel als Punktfolge – jeder Segen ein kleiner Stein in der Farbe seiner Richtung, in der Reihenfolge,
// in der er kam: Lebenskraft rot, Ausdauer grau, Sicht schwarz (im Karbon Sauerstoff blau). Ein Segen aus einer goldenen
// Geburt trägt einen goldenen Ring und schimmert.

/** Farben je Richtung: Glanz, Mitte, Rand (für den gewölbten Stein) – und der Name. */
export const UP_LOOK: Record<UpKey, { name: string; c: [string, string, string]; dot: number }> = {
  hp: { name: 'Lebenskraft', c: ['#ff9c86', '#c8382a', '#4e120c'], dot: 0xc8382a },
  stam: { name: 'Ausdauer', c: ['#f4f2ea', '#a29e92', '#3e3b35'], dot: 0xa29e92 },
  sight: { name: 'Sicht', c: ['#6c7176', '#1c1e21', '#030304'], dot: 0x2a2d30 },
  oxy: { name: 'Sauerstoff', c: ['#bdeaff', '#3a8cc4', '#0e3150'], dot: 0x3a8cc4 },
};

const R = 32;

/** Ein Stein: gewölbt (Verlauf von oben links), feiner dunkler Rand, ein Glanzpunkt. */
function dotTexture(scene: Phaser.Scene, k: UpKey) {
  return tex(scene, `updot_${k}`, R * 2, R * 2, (ctx) => {
    const [hi, mid, lo] = UP_LOOK[k].c;
    const g = ctx.createRadialGradient(R * 0.7, R * 0.62, R * 0.08, R, R, R * 0.92);
    g.addColorStop(0, hi);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.86, 0, Math.PI * 2);
    ctx.fill();
    // ein heller Saum unten (Licht, das durch den Stein fällt)
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.74, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(R * 0.68, R * 0.56, R * 0.17, R * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Der goldene Ring einer goldenen Geburt: Gold mit Kanten, oben ein Funkeln. */
function ringTexture(scene: Phaser.Scene) {
  return tex(scene, 'updot_ring', R * 2 + 16, R * 2 + 16, (ctx) => {
    const c = R + 8;
    const g = ctx.createLinearGradient(0, 0, c * 2, c * 2);
    g.addColorStop(0, '#fff2bc');
    g.addColorStop(0.35, '#e8b44a');
    g.addColorStop(0.6, '#a8701c');
    g.addColorStop(1, '#ffe08a');
    ctx.strokeStyle = g;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.86 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,36,8,0.8)';
    ctx.lineWidth = 1.2;
    for (const r of [R * 0.86 + 2, R * 0.86 + 8]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ein vierstrahliges Funkeln oben rechts
    ctx.fillStyle = 'rgba(255,250,220,0.95)';
    const sx = c + R * 0.62, sy = c - R * 0.62;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 9);
    ctx.lineTo(sx + 2, sy - 2);
    ctx.lineTo(sx + 9, sy);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx, sy + 9);
    ctx.lineTo(sx - 2, sy + 2);
    ctx.lineTo(sx - 9, sy);
    ctx.lineTo(sx - 2, sy - 2);
    ctx.closePath();
    ctx.fill();
  });
}

export interface TrailOpts {
  /** Durchmesser eines Steins (Bildpunkte) */
  size?: number;
  /** Abstand von Mitte zu Mitte */
  step?: number;
  /** so viele je Reihe, dann die nächste */
  perRow?: number;
  /** Text, wenn es noch keine Segen gibt */
  empty?: string;
}

/**
 * Die Punktfolge, mittig um (x, y) – reicht eine Reihe nicht, darunter weiter. Gibt den Container und seine Höhe zurück.
 * Goldene Steine schimmern (ein leises Pulsieren dahinter).
 */
export function upTrail(scene: Phaser.Scene, x: number, y: number, trail: { key: UpKey; gold: boolean }[], o: TrailOpts = {}) {
  const size = o.size ?? 16, step = o.step ?? size + 6, per = o.perRow ?? 10;
  const c = scene.add.container(x, y);
  if (!trail.length) {
    c.add(text(scene, 0, 0, o.empty ?? 'noch kein Segen', 13, '#6c6454', { fontStyle: 'italic' }).setOrigin(0.5));
    return { c, h: size };
  }
  ringTexture(scene);
  const rows = Math.ceil(trail.length / per);
  trail.forEach((d, i) => {
    const row = Math.floor(i / per), inRow = row < rows - 1 ? per : trail.length - per * (rows - 1);
    const px = ((i % per) - (inRow - 1) / 2) * step;
    const py = row * (size + 8);
    if (d.gold) {
      const glow = scene.add.image(px, py, 'glow').setTint(0xffc860).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size * 3.2, size * 3.2).setAlpha(0.35);
      scene.tweens.add({ targets: glow, alpha: 0.12, scale: glow.scale * 0.8, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
      c.add(glow);
    }
    c.add(scene.add.image(px, py, dotTexture(scene, d.key)).setDisplaySize(size, size));
    if (d.gold) c.add(scene.add.image(px, py, 'updot_ring').setDisplaySize(size * 1.5, size * 1.5));
  });
  return { c, h: rows * (size + 8) - 8 };
}

/** Eine kleine Legende: ein Stein je Richtung mit ihrem Namen (nur die Richtungen dieses Zeitalters). */
export function upLegend(scene: Phaser.Scene, x: number, y: number, keys: UpKey[], gold = false) {
  const c = scene.add.container(x, y);
  const items = [...keys.map((k) => ({ k, name: UP_LOOK[k].name })), ...(gold ? [{ k: 'gold' as const, name: 'golden' }] : [])];
  let w = 0;
  const parts: Phaser.GameObjects.GameObject[] = [];
  for (const it of items) {
    const dot = it.k === 'gold'
      ? scene.add.image(w + 5, 0, ringTexture(scene)).setDisplaySize(13, 13)
      : scene.add.image(w + 5, 0, dotTexture(scene, it.k)).setDisplaySize(10, 10);
    const t = text(scene, w + 13, 0, it.name, 11, '#8c826e').setOrigin(0, 0.5);
    parts.push(dot, t);
    w += 13 + t.width + 12;
  }
  w -= 12;
  for (const p of parts) (p as unknown as { x: number }).x -= w / 2;
  c.add(parts);
  return c;
}
