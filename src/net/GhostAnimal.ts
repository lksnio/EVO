import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { Animal, type Target, type World } from '../objects/Animal';
import type { Rect } from '../util/math';
import { FAUNA_INTERP_MS, type AnimalRow } from './protocol';

interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * Ein Tier, das der Ortswächter rechnet – hier nur sein Stellvertreter: Es denkt nicht selbst, sondern schwimmt dorthin, wo
 * der Ortswächter es meldet (geglättet), und sieht aus wie dort (Richtung, Neigung, Aufglühen). Wer es trifft, sieht den
 * Treffer sofort; die Lebenskraft rechnet aber der Ortswächter (onHit). Stirbt es dabei, vergeht es gleich – und erst wenn
 * der Ortswächter widerspricht, taucht es wieder auf.
 */
export class GhostAnimal extends Animal {
  readonly ghost = true;
  /** Treffer an den Ortswächter weitergeben (dmg 0 = nur betäuben) */
  onHit?: (g: GhostAnimal, dmg: number, kind: 'bite' | 'ram' | 'other', stun: number) => void;
  /** gestorben (vorhergesagt) – an den Ortswächter gemeldet */
  onDie?: (g: GhostAnimal) => void;
  private samples: Sample[] = [];
  private tn = 0;
  private al = 100;
  private flashUntil = 0;

  constructor(world: World, def: SpeciesDef, r: AnimalRow, now: number) {
    super(world, def, r.x, r.y);
    this.netId = r.id;
    // nichts davon rechnet dieses Spiel: kein Körper in der Physik
    this.b.enable = false;
    this.apply(r, now);
    this.setAlpha(r.al / 100);
  }

  /** Eine neue Meldung des Ortswächters. */
  apply(r: AnimalRow, now: number) {
    const last = this.samples[this.samples.length - 1];
    if (!last || last.x !== r.x || last.y !== r.y || now - last.t > 300) this.samples.push({ t: now, x: r.x, y: r.y });
    while (this.samples.length > 2 && now - this.samples[0].t > 1500) this.samples.shift();
    this.dir = r.d < 0 ? -1 : 1;
    if (Math.abs(this.sz - r.sz) > 0.001) {
      this.sz = r.sz;
      this.setScale(r.sz);
    }
    this.maxHp = r.mh;
    // nur nach unten übernehmen, solange ein eigener Treffer noch unterwegs ist
    this.hp = now < this.flashUntil + 600 ? Math.min(this.hp, r.hp) : r.hp;
    this.setAngle(r.an);
    this.attacking = r.at;
    this.tn = r.tn;
    this.al = r.al;
  }

  tick(_time: number, dt: number) {
    if (this.dead) return;
    const now = performance.now();
    const t = now - FAUNA_INTERP_MS;
    const s = this.samples;
    let x = s[s.length - 1].x, y = s[s.length - 1].y;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1], b = s[i];
      if (a.t <= t && t <= b.t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        x = a.x + (b.x - a.x) * k;
        y = a.y + (b.y - a.y) * k;
        break;
      }
      if (i === 1 && t < a.t) {
        x = a.x;
        y = a.y;
      }
    }
    // ein kleiner Rückstand wird weich aufgeholt (z. B. nach dem ersten Bild)
    const k = Math.min(1, dt * 14);
    this.setPosition(this.x + (x - this.x) * k, this.y + (y - this.y) * k);
    this.setFlipX(this.dir < 0);
    if (now > this.flashUntil) {
      if (this.tn) this.setTint(this.tn).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (this.isTinted) this.clearTint();
    }
    this.setAlpha(this.al / 100);
  }

  /** Getroffen: sofort sichtbar – die Lebenskraft rechnet der Ortswächter. */
  hurt(dmg: number, _from: Target, kind: 'bite' | 'ram' | 'other') {
    if (this.dead || dmg <= 0) return;
    this.hp -= dmg;
    this.flashUntil = performance.now() + 90;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => this.active && this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    this.world.bleed(this.x, this.y, kind === 'ram' ? 4 : 6);
    this.onHit?.(this, dmg, kind, 0);
    if (this.hp <= 0) this.vanishDead();
  }

  stun(ms: number) {
    if (!this.dead) this.onHit?.(this, 0, 'other', ms);
  }

  // was ein echtes Tier dabei tut, rechnet der Ortswächter
  rage() {}
  panic() {}

  /** Gestorben (vom Ortswächter gemeldet oder vorhergesagt): kurz aufleuchten und vergehen. */
  vanishDead() {
    if (this.dead) return;
    this.dead = true;
    this.attacking = false;
    this.onDie?.(this);
    this.world.bleed(this.x, this.y, 10);
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.world.tweens.add({ targets: this, alpha: 0, scaleX: this.scaleX * 0.5, scaleY: this.scaleY * 0.5, duration: 260, ease: 'Sine.in', onComplete: () => this.destroy() });
  }

  hitRect(): Rect {
    if (!this.active) return { x: -1e6, y: -1e6, w: 0, h: 0 };
    const [fw, fh] = this.def.hit ?? [0.8, 0.8];
    const w = this.displayWidth * fw, h = this.displayHeight * fh;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }
}
