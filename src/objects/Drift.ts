import Phaser from 'phaser';
import { DEPTH } from '../config';
import { GRAPTO_FRAMES, graptoAtlas, planktonAtlas } from '../art/lifeArt';
import { groundAt } from '../level/terrain';
import type { LevelData } from '../level/LevelGen';

// Was frei im Wasser treibt: Plankton (winzige, hell schimmernde Lebewesen), Meeresschnee (Schwebstoffe, die langsam
// sinken) und graptolithenartige Kolonien. Nur Kulisse – nichts davon lässt sich fressen oder stören. Jede Schicht liegt
// in einer eigenen Tiefe (Parallaxe): Je weiter hinten, desto kleiner, blasser und langsamer zieht sie am Bild vorbei.

interface Mote {
  img: Phaser.GameObjects.Image;
  /** Tiefe der Schicht: 1 = auf Höhe des Geschehens, kleiner = weiter hinten */
  d: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  sp: number;
  sway: number;
  spin: number;
  base: number;
  a: number;
  pulse: number;
}

export interface DriftCounts {
  plankton: number;
  snow: number;
  grapto: number;
}

/** Wie viel treibt wo? Der Fluss am Start ist klar, im trüben Wasser wimmelt es, in der Tiefe rieselt vor allem Schnee. */
export function driftCounts(kind: string, epochId: string): DriftCounts {
  const k: Record<string, DriftCounts> = {
    start: { plankton: 18, snow: 20, grapto: 0 },
    lush: { plankton: 64, snow: 36, grapto: 3 },
    murky: { plankton: 84, snow: 66, grapto: 4 },
    deep: { plankton: 34, snow: 62, grapto: 6 },
    abyss: { plankton: 16, snow: 78, grapto: 4 },
  };
  const c = k[kind] ?? k.lush;
  // Graptolithen: Blüte im Ordovizium und Silur, im Devon fast verschwunden
  const g = epochId === 'ordovizium' ? 1 : epochId === 'silur' ? 0.8 : 0.12;
  return { plankton: c.plankton, snow: c.snow, grapto: Math.round(c.grapto * g) };
}

export class Drift {
  private motes: Mote[] = [];
  private t = 0;
  private seeded = false;

  constructor(private scene: Phaser.Scene, private L: LevelData, counts: DriftCounts, deepWorld: boolean) {
    planktonAtlas(scene);
    graptoAtlas(scene);
    const make = (kind: 'plankton' | 'snow' | 'grapto') => {
      const dl = [0.6, 0.78, 1, 1][Math.floor(Math.random() * 4)];
      let atlas = 'plankton', frame: string;
      let base = 1, a = 1, vx: number, vy: number, sway: number, spin: number, glow = false;
      if (kind === 'plankton') {
        const names = ['acritarch', 'radiolarian', 'chitinozoan', 'chitinochain', 'ostracod', 'larva', 'medusa', 'cyano', 'speck', 'speck'];
        frame = names[Math.floor(Math.random() * names.length)];
        base = 0.55 + Math.random() * 0.55;
        a = 0.55 + Math.random() * 0.4;
        vx = (Math.random() - 0.5) * 14;
        vy = (Math.random() - 0.5) * 5;
        sway = 5 + Math.random() * 8;
        spin = (Math.random() - 0.5) * 0.5;
        glow = frame === 'speck' || frame === 'medusa' || frame === 'radiolarian' || frame === 'acritarch' ? Math.random() < (deepWorld ? 0.8 : 0.45) : false;
      } else if (kind === 'snow') {
        frame = Math.random() < 0.7 ? 'snow1' : 'snow2';
        base = 0.5 + Math.random() * 0.9;
        a = 0.35 + Math.random() * 0.4;
        vx = (Math.random() - 0.5) * 5;
        vy = 4 + Math.random() * 12;
        sway = 2 + Math.random() * 3;
        spin = (Math.random() - 0.5) * 1.2;
      } else {
        atlas = 'grapto';
        frame = GRAPTO_FRAMES[Math.floor(Math.random() * GRAPTO_FRAMES.length)];
        base = 0.55 + Math.random() * 0.55;
        a = 0.55 + Math.random() * 0.3;
        vx = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 6);
        vy = (Math.random() - 0.5) * 3;
        sway = 2 + Math.random() * 4;
        spin = (Math.random() - 0.5) * 0.12;
      }
      const img = scene.add.image(0, 0, atlas, frame).setDepth(DEPTH.carcass + 0.5).setScrollFactor(dl, dl);
      if (glow) img.setBlendMode(Phaser.BlendModes.ADD);
      img.setRotation(Math.random() * Math.PI * 2);
      const m: Mote = {
        img, d: dl, x: 0, y: 0, vx, vy, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.7,
        sway, spin, base: base * (0.62 + 0.38 * dl), a: a * (0.5 + 0.5 * dl), pulse: glow ? 0.35 : 0.12,
      };
      img.setVisible(false);
      this.motes.push(m);
    };
    for (let i = 0; i < counts.plankton; i++) make('plankton');
    for (let i = 0; i < counts.snow; i++) make('snow');
    for (let i = 0; i < counts.grapto; i++) make('grapto');
  }

  update(time: number, dt: number) {
    const cam = this.scene.cameras.main;
    // das Sichtfeld selbst berechnen (worldView ist erst nach dem Zeichnen auf dem neuesten Stand)
    const vw = cam.width / cam.zoomX, vh = cam.height / cam.zoomY;
    const v = { x: cam.scrollX + (cam.width - vw) / 2, y: cam.scrollY + (cam.height - vh) / 2, width: vw, height: vh };
    const L = this.L;
    this.t = time / 1000;
    const M = 70;
    // beim ersten Bild über das Sichtfeld verteilen (die Kamera steht dann schon an ihrem Platz)
    if (!this.seeded) {
      this.seeded = true;
      for (const m of this.motes) {
        const k = 1 - m.d;
        m.x = v.x - cam.scrollX * k + Math.random() * v.width;
        m.y = v.y - cam.scrollY * k + Math.random() * v.height;
      }
    }
    for (const m of this.motes) {
      const k = 1 - m.d;
      const lx0 = v.x - cam.scrollX * k, ly0 = v.y - cam.scrollY * k;
      const lx1 = lx0 + v.width, ly1 = ly0 + v.height;
      m.x += (m.vx * (0.5 + 0.5 * m.d) + Math.sin(this.t * m.sp + m.ph) * m.sway * 0.5) * dt;
      m.y += (m.vy * (0.5 + 0.5 * m.d) + Math.cos(this.t * m.sp * 0.8 + m.ph) * m.sway * 0.3) * dt;
      // verlässt etwas das Bild, taucht es auf der anderen Seite wieder auf (an anderer Höhe bzw. Stelle) – auch nach einem Sprung der Kamera
      const spanX = v.width + 2 * M, spanY = v.height + 2 * M;
      if (m.x < lx0 - M || m.x > lx1 + M) {
        m.x = lx0 - M + ((((m.x - (lx0 - M)) % spanX) + spanX) % spanX);
        m.y = ly0 + Math.random() * v.height;
      }
      if (m.y < ly0 - M || m.y > ly1 + M) {
        m.y = ly0 - M + ((((m.y - (ly0 - M)) % spanY) + spanY) % spanY);
        m.x = lx0 + Math.random() * v.width;
      }
      // sichtbar nur im Wasser: unter der Oberfläche und über dem Grund
      const wx = m.x + cam.scrollX * k, wy = m.y + cam.scrollY * k;
      const ok = wy > L.surfaceY + 24 && wy < groundAt(L.terrain.hp, wx) - 10;
      m.img.setVisible(ok);
      if (!ok) continue;
      m.img.setPosition(m.x, m.y);
      m.img.setRotation(m.img.rotation + m.spin * dt);
      m.img.setScale(m.base * (1 + 0.06 * Math.sin(this.t * 1.7 + m.ph)));
      m.img.setAlpha(m.a * (1 - m.pulse + m.pulse * (0.5 + 0.5 * Math.sin(this.t * 1.3 + m.ph * 2))));
    }
  }
}
