import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { CreatureView } from '../objects/CreatureView';
import { game, ZERO_TRAITS } from '../state/GameState';
import { CLASSES } from '../data/classes';
import type { Morph } from '../art/creatureArt';
import { clamp } from '../util/math';
import { ANIM, INTERP_MS } from './protocol';
import { Interp } from './Interp';
import type { NetFish } from './schema';

/**
 * Ein Aussehen aus dem Netz – nur Zahlen in vernünftigen Grenzen (es kommt von einem anderen Spieler). Fehlt es oder ist es
 * kaputt, schwimmt dort ein schlichter Urfisch.
 */
function parseLook(s: string): Morph {
  try {
    const raw = JSON.parse(s) as Record<string, unknown>;
    if (raw && typeof raw === 'object' && typeof raw.cls === 'string' && raw.cls in CLASSES) {
      const m: Record<string, unknown> = { cls: raw.cls };
      for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) m[k] = clamp(v, -1e6, 1e6);
      m.size = clamp(Number(m.size) || 1, 0.15, 2.5);
      return m as unknown as Morph;
    }
  } catch {
    /* unten: Ersatz */
  }
  return game.morph({ traits: ZERO_TRAITS, fierce: 0 });
}

/**
 * Der Fisch eines anderen Spielers: Er wird etwas verzögert gezeigt und zwischen den Meldungen geglättet (net/Interp.ts),
 * damit er ruhig schwimmt, obwohl seine Lage nur etwa 20 Mal je Sekunde ankommt. Darüber steht sein Name.
 */
export class RemoteFish {
  readonly view: CreatureView;
  private label: Phaser.GameObjects.Text;
  private path = new Interp(INTERP_MS);
  private look = '';
  private anim = 0;
  private facing = 1;
  private speed01 = 0;
  private away = false;

  constructor(scene: Phaser.Scene, f: NetFish, now: number) {
    this.look = f.look;
    this.view = new CreatureView(scene, f.x, f.y, parseLook(f.look));
    this.view.setDepth(DEPTH.player - 1);
    this.label = scene.add
      .text(f.x, f.y - 60, f.name, { fontFamily: FONT, fontSize: '17px', color: '#f0e6d2', stroke: '#0a0907', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.text - 1)
      .setAlpha(0.85);
    this.push(f, now);
  }

  /** tot oder gerade ohne Verbindung (für die Tiere kein Ziel) */
  get dead() {
    return this.anim === ANIM.dead;
  }

  get gone() {
    return this.away;
  }

  /** schnell unterwegs (Spurt, Stoß) – fällt auf */
  get fast() {
    return this.anim === ANIM.dash || this.anim === ANIM.ram || this.speed01 > 0.85;
  }

  get facingDir() {
    return this.facing;
  }

  /** Eine neue Meldung vom Server. */
  push(f: NetFish, now: number) {
    // ein älterer Server meldet keine Uhrzeit: dann die Ankunft
    this.path.push(f.t || now, f.x, f.y, now);
    if (f.look !== this.look && f.look) {
      this.look = f.look;
      this.view.build(parseLook(f.look));
    }
    if (f.anim !== this.anim && (f.anim === ANIM.bite || f.anim === ANIM.ram)) this.view.bite();
    this.anim = f.anim;
    this.facing = f.facing < 0 ? -1 : 1;
    this.away = f.away;
    if (this.label.text !== f.name) this.label.setText(f.name);
  }

  update(now: number, dt: number) {
    const p = this.path.at(now, dt);
    // Sprünge (nach einer Pause im Netz, einer Korrektur des Servers) weich aufholen – sonst genau auf der Bahn
    const k = Math.hypot(p.x - this.view.x, p.y - this.view.y) > 60 ? Math.min(1, dt * 12) : 1;
    const x = this.view.x + (p.x - this.view.x) * k, y = this.view.y + (p.y - this.view.y) * k;
    const v = Math.hypot(x - this.view.x, y - this.view.y) / Math.max(0.001, dt);
    this.speed01 += (clamp(v / 260, 0, 1) - this.speed01) * Math.min(1, dt * 6);
    this.view.setPosition(x, y);
    this.view.setFacing(this.facing);
    const dead = this.anim === ANIM.dead;
    this.view.headTilt = this.anim === ANIM.ram ? 0.62 : 0;
    this.view.squint(this.anim === ANIM.ram ? 0.8 : 0);
    this.view.animate(dt, this.speed01 > 0.12 ? 'swim' : 'idle', dead ? 0 : this.speed01);
    this.view.setAlpha(this.away ? 0.45 : dead ? 0.6 : 1);
    this.label.setPosition(x, y + (this.view.L?.topY ?? -24) - 8);
  }

  destroy() {
    this.view.destroy();
    this.label.destroy();
  }
}
