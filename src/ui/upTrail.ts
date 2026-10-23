import type Phaser from 'phaser';
import type { UpKey } from '../state/GameState';
import { tex } from '../util/canvas';
import { text } from './ui';

// Die Segen der großen Muschel: eine Kugel je Segen unter dem zugehörigen Wert.
// Eine goldene Geburt ersetzt nur den weißen Glanzpunkt durch einen dezenten goldenen Schimmer.

/** Farben je Richtung: Glanz, Mitte, Rand (für den gewölbten Stein) – und der Name. */
export const UP_LOOK: Record<UpKey, { name: string; c: [string, string, string]; dot: number }> = {
  hp: { name: 'Lebenskraft', c: ['#ff9c86', '#c8382a', '#4e120c'], dot: 0xc8382a },
  stam: { name: 'Ausdauer', c: ['#f4f2ea', '#a29e92', '#3e3b35'], dot: 0xa29e92 },
  sight: { name: 'Sicht', c: ['#6c7176', '#1c1e21', '#030304'], dot: 0x2a2d30 },
  oxy: { name: 'Sauerstoff', c: ['#bdeaff', '#3a8cc4', '#0e3150'], dot: 0x3a8cc4 },
};

const R = 32;

/** Ein Stein: gewölbt (Verlauf von oben links), feiner dunkler Rand, ein Glanzpunkt. */
function dotTexture(scene: Phaser.Scene, k: UpKey, gold = false) {
  return tex(scene, `updot_${k}${gold ? '_gold' : ''}`, R * 2, R * 2, (ctx) => {
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
    ctx.strokeStyle = gold ? 'rgba(245,200,105,0.2)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.74, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = gold ? 'rgba(255,211,117,0.8)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(R * 0.68, R * 0.56, R * 0.17, R * 0.11, -0.6, 0, Math.PI * 2);
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
  /** Optionaler Text, wenn es noch keine Segen gibt (sonst keine Beschriftung) */
  empty?: string;
}

/**
 * Die Punktfolge, mittig um (x, y) – reicht eine Reihe nicht, darunter weiter. Gibt den Container und seine Höhe zurück.
 */
export function upTrail(scene: Phaser.Scene, x: number, y: number, trail: { key: UpKey; gold: boolean }[], o: TrailOpts = {}) {
  const size = o.size ?? 16, step = o.step ?? size + 6, per = o.perRow ?? 10;
  const c = scene.add.container(x, y);
  if (!trail.length) {
    if (o.empty) c.add(text(scene, 0, 0, o.empty, 13, '#6c6454', { fontStyle: 'italic' }).setOrigin(0.5));
    return { c, h: size };
  }
  const rows = Math.ceil(trail.length / per);
  trail.forEach((d, i) => {
    const row = Math.floor(i / per), inRow = row < rows - 1 ? per : trail.length - per * (rows - 1);
    const px = ((i % per) - (inRow - 1) / 2) * step;
    const py = row * (size + 8);
    c.add(scene.add.image(px, py, dotTexture(scene, d.key, d.gold)).setDisplaySize(size, size));
  });
  return { c, h: rows * (size + 8) - 8 };
}
