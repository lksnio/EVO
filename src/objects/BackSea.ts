import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { EpochDef } from '../data/epochs';
import { SPECIES, type SpeciesDef } from '../data/species';
import { placeOf, type PlaceKind } from '../data/world';
import { faunaAffinity } from '../sim/habitat';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { clamp, hashStr } from '../util/math';

/**
 * Das Meer hinter dem Spielfeld: Schwärme und ab und zu ein großer Fisch ziehen in mehreren Tiefenstufen
 * durch das Wasser. Sie sind nur Kulisse – ohne Körper, ohne Verhalten, nichts davon kann gebissen oder gefressen
 * werden. Je weiter hinten, desto kleiner, dunkler, durchsichtiger und langsamer (und sie wandern mit der Kamera
 * nur wenig mit, wie ein Hintergrund). Sie liegen hinter dem Gelände, den Pflanzen und allen echten Tieren.
 */

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layer {
  /** wie stark die Schicht mit der Kamera mitwandert (0 = steht am Bildschirm, 1 = wie das Spielfeld) */
  f: number;
  depth: number;
  tint: number;
  alpha: number;
  scale: [number, number];
  speed: [number, number];
  schools: number;
}

// Zwei Tiefenstufen zwischen den Hintergrundbildern: hinter den fernen Hügeln (die wandern mit 0,08 und 0,28 mit der Kamera)
// und zwischen Hügeln und Nebel. Die Schichten wandern daher etwas stärker mit als die Hügel hinter ihnen (nie so stark wie das
// Spielfeld): Wer nach links schwimmt, sieht sie nach rechts davonziehen – und ein Fisch, der selbst nach rechts schwimmt, ist
// entsprechend schneller weg. Die Eigengeschwindigkeit ist der Bruchteil f der echten Schwimmgeschwindigkeit (Perspektive).
const LAYERS: Layer[] = [
  { f: 0.2, depth: DEPTH.bg + 0.5, tint: 0x243f4e, alpha: 0.6, scale: [0.7, 0.9], speed: [9, 20], schools: 12 },
  { f: 0.42, depth: DEPTH.bg + 1.3, tint: 0x2f5266, alpha: 0.62, scale: [0.86, 1.06], speed: [19, 42], schools: 9 },
];

/** wie dicht es in den Orten wimmelt */
const DENSITY: Record<PlaceKind, number> = { start: 0.12, lush: 1.5, murky: 0.75, deep: 0.65, abyss: 0.45 };

interface Member {
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
  ph: number;
  /** gerade gezeigtes Bild der Schwimmbewegung */
  fr: number;
}

interface School {
  layer: number;
  def: SpeciesDef;
  members: Member[];
  x: number;
  y: number;
  vx: number;
  /** halbe Breite der Gruppe samt Fisch */
  half: number;
  ph: number;
  big: boolean;
}

export class BackSea {
  private schools: School[] = [];
  private pool: { def: SpeciesDef; w: number }[] = [];
  private bigPool: SpeciesDef[] = [];
  private lastX = 0;
  private lastY = 0;
  private t = 0;
  private bigAt = 0;
  private bigDelay = 1;
  /** wie schnell sich die Kamera gerade bewegt (geglättet, Pixel pro Sekunde) – bestimmt, von wo neue Gruppen hereinschwimmen */
  private camV = 0;
  private enabled = true;

  constructor(
    private scene: Phaser.Scene,
    private view: View,
    ep: EpochDef,
    private placeId: string,
    private kind: PlaceKind,
    private surfaceY: number,
    dim: boolean,
    /** im sicheren Startgebiet: Dort lebt außer der eigenen Art kein Tier – auch in der Ferne zieht keines vorbei */
    calm = false,
  ) {
    if (!calm) this.buildPool(ep);
    if (!this.pool.length) {
      this.enabled = false;
      return;
    }
    const k = DENSITY[kind] * (dim ? 0.5 : 1);
    LAYERS.forEach((l, i) => {
      const n = Math.round(l.schools * k);
      for (let s = 0; s < n; s++) this.spawn(i, true);
    });
    const cam = scene.cameras.main;
    this.lastX = cam.scrollX;
    this.lastY = cam.scrollY;
    this.bigDelay = placeOf(ep, this.placeId).waterway === 0 ? 12 : kind === 'start' ? 4 : kind === 'deep' ? 0.7 : 1;
    this.bigAt = (6000 + Math.random() * 9000) * this.bigDelay;
  }

  /** Welche Tiere ziehen hier durch? Schwimmer der Zeit, je Ort etwas anders gewichtet. */
  private buildPool(ep: EpochDef) {
    const place = placeOf(ep, this.placeId);
    const seen = new Set<string>();
    for (const [id, n] of ep.fauna) {
      const d = SPECIES[id];
      if (!d || d.crawl || seen.has(id)) continue;
      // keine Seeskorpione und kein Krabbelzeug – Fische, Quallen und Kopffüßer
      if (d.art.t !== 'fish' && d.art.t !== 'jelly' && d.art.t !== 'cone') continue;
      seen.add(id);
      const taste = 0.45 + 1.1 * ((hashStr(ep.id + '/' + this.placeId + '/' + id) % 1000) / 1000);
      const len = (d.art as { len?: number }).len ?? 40;
      const w = n * (d.where?.[this.kind] ?? 1) * taste * (d.role === 'predator' ? 0.4 : 1) * (d.art.t === 'jelly' ? 0.5 : 1) * (0.5 + Math.min(1, len / 60)) * faunaAffinity(place, d);
      if (w > 0.05) this.pool.push({ def: d, w });
      if (d.art.t === 'fish' || d.art.t === 'cone') {
        const len = d.art.len;
        if (len >= 100 && faunaAffinity(place, d, true) > 0) this.bigPool.push(d);
      }
    }
    // die ganz Großen der Zeit (Herrscher und Durchzügler) tauchen nur in der Ferne auf
    for (const id of [...ep.passers.map(([id]) => id), ...(ep.apex ? [ep.apex] : [])]) {
      const d = SPECIES[id];
      if (d && (d.art.t === 'fish' || d.art.t === 'cone') && faunaAffinity(place, d, true) > 0 && !this.bigPool.includes(d)) this.bigPool.push(d);
    }
    // gibt es keinen Großen, wird der größte Fisch der Zeit einfach größer gezeigt
    if (!this.bigPool.length) {
      const fishes = this.pool.map((p) => p.def).filter((d) => d.art.t === 'fish');
      fishes.sort((a, b) => (b.art as { len: number }).len - (a.art as { len: number }).len);
      if (fishes[0]) this.bigPool.push(fishes[0]);
    }
    for (const d of [...this.pool.map((p) => p.def), ...this.bigPool]) makeSpeciesTextures(this.scene, d);
  }

  private pickSpecies() {
    let sum = 0;
    for (const p of this.pool) sum += p.w;
    let r = Math.random() * sum;
    for (const p of this.pool) {
      r -= p.w;
      if (r <= 0) return p.def;
    }
    return this.pool[0].def;
  }

  /** Das Wasser unter der Oberfläche, in dem Fische schwimmen dürfen (in den Koordinaten der Hintergrundbilder). */
  private band() {
    const v = this.view;
    const cam = this.scene.cameras.main;
    const top = Math.max(v.y + 30, this.surfaceY - cam.scrollY + 60);
    return { top, bottom: v.y + v.h * 0.86 };
  }

  private spawn(li: number, anywhere: boolean, big = false, old?: School) {
    const layer = LAYERS[li];
    const v = this.view;
    const def = big ? this.bigPool[Math.floor(Math.random() * this.bigPool.length)] : this.pickSpecies();
    const art = def.art;
    // Gruppengröße: Schwärme etwas kleiner als vorn, Große allein
    let n = 1;
    if (!big && def.herd) n = Math.max(2, Math.round((def.herd[0] + Math.random() * (def.herd[1] - def.herd[0])) * 0.8));
    else if (!big && art.t === 'jelly') n = 2 + Math.floor(Math.random() * 3);
    const sc = layer.scale[0] + Math.random() * (layer.scale[1] - layer.scale[0]);
    // Große Fische: so groß, dass sie auch aus der Ferne eindrucksvoll sind
    const baseLen = (art as { len?: number }).len ?? ((art as { r?: number }).r ?? 16) * 2;
    const bigK = big ? Math.max(1, 190 / baseLen) * (0.8 + Math.random() * 0.5) : 1;
    const spread = n > 1 ? 24 + n * 9 : 0;
    const half = spread + baseLen * sc * bigK * 0.6;
    const speed = layer.speed[0] + Math.random() * (layer.speed[1] - layer.speed[0]);
    const b = this.band();
    // Beim Aufbau überall im Bild, später von einer Seite außerhalb hereinschwimmend
    // Bewegt sich die Kamera, rutscht der Hintergrund zur Gegenseite: Von dort her kommen die neuen Gruppen ins Bild
    const side = Math.abs(this.camV) > 40 ? (this.camV > 0 ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
    const x = anywhere ? v.x + Math.random() * v.w : side < 0 ? v.x - half - 60 - Math.random() * 260 : v.x + v.w + half + 60 + Math.random() * 260;
    // jede Gruppe schwimmt für sich: bei ruhiger Kamera ins Bild hinein, sonst in eine beliebige Richtung
    const dir = anywhere || Math.abs(this.camV) > 40 ? (Math.random() < 0.5 ? 1 : -1) : -side;
    const y = b.top + (b.bottom - b.top) * (big ? 0.12 + Math.random() * 0.6 : Math.random() * 0.92);
    const members: Member[] = [];
    const old2 = old?.members ?? [];
    for (let i = 0; i < n; i++) {
      let img = old2[i]?.img;
      if (!img) img = this.scene.add.image(0, 0, speciesKey(def.id, 0)).setScrollFactor(0);
      img.setTexture(speciesKey(def.id, 0)).setDepth(layer.depth).setTint(big ? 0x4a7a90 : layer.tint).setAlpha(layer.alpha).setScale(sc * bigK * (0.86 + Math.random() * 0.28));
      members.push({ img, ox: (Math.random() - 0.5) * 2 * spread, oy: (Math.random() - 0.5) * (spread * 0.6 + 10), ph: Math.random() * 6, fr: 0 });
    }
    // überzählige Bilder einer Gruppe, die vorher größer war
    for (let i = n; i < old2.length; i++) old2[i].img.destroy();
    const s: School = { layer: li, def, members, x, y, vx: dir * speed, half, ph: Math.random() * 6, big };
    if (old) this.schools[this.schools.indexOf(old)] = s;
    else this.schools.push(s);
    return s;
  }

  /** quiet: 0..1 – im stillen Fluss am Start gibt es (noch) keine Fische in der Ferne */
  /** wie gut man durch das Wasser in die Ferne sieht (0 … 1) – in klarem Wasser dicht unter der Oberfläche gut, sonst kaum */
  see = 1;

  update(time: number, dt: number, deepK: number, quiet = 0) {
    if (!this.enabled) return;
    void time;
    const cam = this.scene.cameras.main;
    const dx = clamp(cam.scrollX - this.lastX, -300, 300), dy = clamp(cam.scrollY - this.lastY, -300, 300);
    this.lastX = cam.scrollX;
    this.lastY = cam.scrollY;
    this.camV += (dx / Math.max(0.001, dt) - this.camV) * Math.min(1, dt * 4);
    this.t += dt;
    const v = this.view;
    const b = this.band();
    const surfaceScreen = this.surfaceY - cam.scrollY;
    const fade = (1 - 0.82 * deepK) * (1 - quiet) * this.see;

    // ab und zu zieht ein ganz großer Fisch durch die Ferne (nie mehr als einer zugleich)
    this.bigAt -= dt * 1000;
    if (this.bigAt <= 0 && this.bigPool.length) {
      this.bigAt = (22000 + Math.random() * 30000) * this.bigDelay;
      if (!this.schools.some((s) => s.big)) this.spawn(Math.random() < 0.6 ? 0 : 1, false, true);
    }

    for (const s of [...this.schools]) {
      const layer = LAYERS[s.layer];
      s.x += s.vx * dt - dx * layer.f;
      s.y += -dy * layer.f;
      // Wer weit aus dem Bild ist, schwimmt als neue Gruppe auf der anderen Seite wieder herein (Große verschwinden einfach)
      const out = s.x + s.half < v.x - 120 || s.x - s.half > v.x + v.w + 120 || s.y > v.y + v.h + 120;
      if (out) {
        if (s.big) {
          for (const m of s.members) m.img.destroy();
          this.schools.splice(this.schools.indexOf(s), 1);
        } else this.spawn(s.layer, false, false, s);
        continue;
      }
      // ein sanftes Auf und Ab
      const jelly = s.def.art.t === 'jelly';
      const bob = Math.sin(this.t * 0.55 + s.ph) * (jelly ? 14 : 9);
      const flip = s.vx < 0;
      for (const m of s.members) {
        const mx = s.x + m.ox + Math.sin(this.t * 0.9 + m.ph) * 4;
        const my = s.y + m.oy + bob + Math.sin(this.t * 1.3 + m.ph * 2) * 3;
        m.img.setPosition(mx, my);
        m.img.setFlipX(flip);
        const fr = Math.floor(this.t * 5.5 + m.ph) & 1;
        if (fr !== m.fr) {
          m.fr = fr;
          m.img.setTexture(speciesKey(s.def.id, fr));
        }
        // über der Wasseroberfläche gibt es keine Fische
        const vis = my > Math.max(surfaceScreen, v.y) + 22 && my < b.bottom + 240;
        m.img.setVisible(vis);
        if (vis) m.img.setAlpha(layer.alpha * fade * (s.big ? 0.8 : 1));
      }
    }
  }

  destroy() {
    for (const s of this.schools) for (const m of s.members) m.img.destroy();
    this.schools = [];
  }
}
