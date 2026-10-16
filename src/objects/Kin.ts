import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import type { Morph } from '../art/creatureArt';
import { audio } from '../audio/Audio';
import { DEPTH } from '../config';
import { clamp, type Rect } from '../util/math';
import { Animal, type World } from './Animal';
import { Carcass, Plant } from './Food';
import { CreatureView, type AnimMode } from './CreatureView';

/** Was die Level-Szene den Artgenossen zusätzlich bietet. */
export interface KinWorld extends World {
  /** ein Artgenosse hat sich abgewandt (zu wenig Futter abbekommen) */
  kinSnubbed(k: Kin): void;
  /** ein Artgenosse zieht allein weiter */
  kinLeaving(k: Kin): void;
  /** ein Artgenosse hat geteilte Beute bekommen */
  kinShared(k: Kin): void;
}

/**
 * Ein Artgenosse: fast wie du – kleine genetische Abweichungen, Männchen oder Weibchen.
 *
 * Die Gruppe lernt in der Situation: Wer Beute teilt, mit dem jagen sie weiter zusammen
 * und den verteidigen sie. Wer alles selbst frisst, den verlassen sie nach und nach.
 * Sie greifen an, was du angreifst, fliehen mit Warnruf vor Räubern und verstecken sich,
 * wenn du dich versteckst.
 */
export class Kin extends Animal {
  view: CreatureView;
  /** Treue zum Spieler: 0 = geht eigene Wege … 1 = folgt überallhin */
  loyalty: number;
  private offY: number;
  private slot: number;
  private calledAt = -1e9;
  private dying = false;
  private leaving = false;
  private prey: Animal | null = null;
  private huntUntil = 0;
  private want: Plant | Carcass | null = null;

  constructor(world: KinWorld, def: SpeciesDef, x: number, y: number, m: Morph, slot: number, loyalty: number) {
    super(world, def, x, y, { texture: 'p_dot' });
    this.kin = true;
    this.slot = slot;
    this.loyalty = clamp(loyalty, 0.15, 0.95);
    this.setVisible(false);
    this.view = new CreatureView(world, x, y, m);
    this.view.setDepth(DEPTH.player - 1);
    const L = this.view.L;
    this.b.setSize(Math.round(L.halfW * 2), Math.round(L.footY - L.topY), true);
    this.offY = -(L.topY + L.footY) / 2;
    this.hunger = 0.2 + Math.random() * 0.3;
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (!this.dying) this.view.destroy();
    });
  }

  private get kw() {
    return this.world as KinWorld;
  }

  /** frisst Fleisch (sonst Pflanzen; Allesfresser beides) */
  get eatsMeat() {
    return this.def.diet === 'meat' || this.omni;
  }

  omni = false;

  tick(time: number, dt: number) {
    if (!this.dead && !this.leaving) {
      // Lange hungrig, ohne dass der Anführer etwas abgibt: Die Treue schwindet
      if (this.hunger > 0.9) this.loyalty -= 0.004 * dt;
      this.ally = this.loyalty >= 0.6;
      if (this.loyalty < 0.12) this.startLeaving();
    }
    super.tick(time, dt);
    if (this.dying || !this.active) return;
    this.syncView(dt);
  }

  private syncView(dt: number) {
    const v = this.view;
    const b = this.b;
    v.setPosition(this.x, this.y + this.offY);
    v.setFacing(this.dir);
    let mode: AnimMode = 'idle';
    if (this.world.water) mode = 'swim';
    else if (!(b.blocked.down || b.touching.down)) mode = 'air';
    else if (Math.abs(b.velocity.x) > 20) mode = 'walk';
    const sp = Math.hypot(b.velocity.x, this.world.water ? b.velocity.y : 0) / Math.max(1, this.def.speed);
    v.animate(dt, mode, Math.min(1.2, sp));
    v.rotation = this.world.water ? this.dir * clamp(b.velocity.y / (this.def.speed || 1), -1, 1) * 0.3 : 0;
    v.setShade(this.hiddenNow ? 0x4e4e4e : null);
  }

  hurt(dmg: number, from: Animal | World['player'], kind: 'bite' | 'ram' | 'other') {
    super.hurt(dmg, from, kind);
    if (from === this.world.player) this.loyalty -= 0.5;
    if (this.dead) return;
    this.view.flash(0xff5040);
    this.world.time.delayedCall(110, () => this.active && this.view.flash(null));
  }

  protected die(byPlayer: boolean) {
    this.dying = true;
    super.die(byPlayer);
    const v = this.view;
    this.world.tweens.add({ targets: v, alpha: 0, angle: this.dir * 160, duration: 1000, ease: 'Sine.in', onComplete: () => v.destroy() });
  }

  // ------------------------------------------------------------------ Gemeinsam jagen

  /** Der Spieler greift an – die Gruppe hilft. */
  joinHunt(a: Animal, until: number) {
    if (this.leaving || this.dead || a.dead || a.kin) return;
    this.prey = a;
    this.huntUntil = until;
  }

  /** Beute geteilt: Die Bindung wächst. */
  protected sharedMeal(c: Carcass, time: number) {
    void time;
    if (!c.byPlayer) return;
    this.loyalty = Math.min(1, this.loyalty + 0.14);
    this.kw.kinShared(this);
  }

  /** Nichts abbekommen, weil der Anführer alles selbst gefressen hat. */
  snub(amount: number) {
    if (this.dead || this.leaving) return;
    this.loyalty -= amount;
    this.dir = Math.sign(this.x - this.world.player.x) || this.dir;
    this.kw.kinSnubbed(this);
  }

  private startLeaving() {
    if (this.leaving) return;
    this.leaving = true;
    this.ally = false;
    this.prey = null;
    this.kw.kinLeaving(this);
  }

  // ------------------------------------------------------------------ Verhalten

  protected think(time: number, dt: number) {
    void dt;
    const W = this.world;
    const p = W.player;
    this.attacking = false;
    this.hiddenNow = false;
    const sprint = this.def.speed * (this.def.sprint ?? 1.3);

    // Geht eigene Wege: zum fernen Rand und fort
    if (this.leaving) {
      const edge = this.x < (W.physics.world.bounds.width / 2) ? 10 : W.physics.world.bounds.width - 10;
      this.go('wander');
      this.moveTo(edge, this.y, this.def.speed * 0.9, true);
      if (Math.abs(this.x - edge) < 40) this.leave();
      return;
    }

    // Gemeinsame Jagd geht vor (außer die Beute ist längst zu stark geworden)
    const hunt = this.prey;
    if (hunt && (hunt.dead || time > this.huntUntil)) this.prey = null;
    if (this.prey) {
      const tg = this.prey;
      this.target = tg;
      this.go('hunt');
      this.chase(tg, sprint);
      this.tryBite(time, tg);
      return;
    }

    // Gefahr: Warnruf und ab ins Versteck – oder weg
    const th = this.threatObj;
    if (th) {
      if (this.st !== 'flee') {
        this.go('flee');
        if (time - this.calledAt > 4000) {
          this.calledAt = time;
          audio.sfx('call');
        }
      }
      const c = this.nearCover(280);
      if (c) {
        this.moveTo(c.x + c.w / 2, this.coverY(c), sprint, true);
        this.hideIfInside(c);
      } else this.runFrom(th.x, th.y, sprint);
      return;
    }
    if (this.st === 'flee' && this.stT < 1.2) {
      this.moveTo(this.x + this.dir * 150, this.y, this.def.speed, true);
      return;
    }

    // Versteckt sich der Spieler, verstecken sie sich auch
    if (p.hidden && !p.dead && this.loyalty > 0.3) {
      const c = this.nearCover(360);
      if (c) {
        this.go('hide');
        this.moveTo(c.x + c.w / 2 + (this.slot - 2) * 10, this.coverY(c), this.def.speed * 0.9, true);
        this.hideIfInside(c);
        return;
      }
    }

    // Treue Artgenossen verteidigen dich
    if (this.ally) {
      const e = this.playerEnemy(260);
      if (e && e.def.power <= this.def.power * 4) {
        this.target = e;
        this.go('hunt');
        this.chase(e, this.def.speed * 1.2);
        this.tryBite(time, e);
        return;
      }
    }
    this.target = null;

    // Fressen
    const food = this.hunger > 0.4 ? this.findFood() : null;
    if (this.want && this.want !== food) this.want.wanted.delete(this);
    this.want = food;
    if (food) {
      food.wanted.add(this);
      this.food = food;
      return this.eatHere(time, food);
    }

    // Nähe zur Gruppe – je treuer, desto enger
    if (this.loyalty >= 0.3) this.followGroup(time);
    else this.wander(time);
  }

  private findFood(): Plant | Carcass | null {
    const W = this.world;
    const p = W.player;
    let best: Plant | Carcass | null = null;
    let bd = 340;
    if (this.eatsMeat) {
      for (const c of W.carcasses) {
        if (c.gone || c.units <= 0) continue;
        const d = this.dist(c);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    }
    if (!best && (this.def.diet === 'plant' || this.omni)) {
      bd = 280;
      for (const pl of W.plants) {
        if (pl.units <= 0) continue;
        if (Math.hypot(pl.x - p.x, pl.y - p.y) > 460 && this.loyalty > 0.3) continue;
        const d = this.dist(pl);
        if (d < bd && (W.water || Math.abs(pl.y - this.b.bottom) < 90)) {
          bd = d;
          best = pl;
        }
      }
    }
    return best;
  }

  private eatHere(time: number, f: Plant | Carcass) {
    const isMeat = f instanceof Carcass;
    const fy = isMeat ? f.y - 10 : f.y - 20;
    if (this.dist({ x: f.x, y: fy }) < 40) {
      this.go('graze');
      this.halt();
      this.dir = Math.sign(f.x - this.x) || this.dir;
      if (time > this.feedAt) {
        this.feedAt = time + 1200;
        if (f.take(time)) {
          this.hunger = Math.max(0, this.hunger - (isMeat ? 0.4 : 0.28));
          this.world.puff(f.x, f.y - 14, 3, isMeat ? 0x6a1a10 : 0x6a7a3a);
          if (isMeat) {
            f.ateFrom.add(this);
            this.view.showMeat(2400);
            this.world.bleed(f.x, f.y - 8, 3);
            this.sharedMeal(f, time);
          } else if (Math.hypot(this.x - this.world.player.x, this.y - this.world.player.y) < 260) {
            // gemeinsam grasen hält die Gruppe zusammen
            this.loyalty = Math.min(1, this.loyalty + 0.015);
          }
        }
      }
    } else this.moveTo(f.x, fy, this.def.speed * 0.85, true);
  }

  /** Bei der Gruppe bleiben – jeder hat seinen Platz neben dir. */
  private followGroup(time: number) {
    const W = this.world;
    const p = W.player;
    if (p.dead) return this.wander(time);
    const side = this.slot % 2 ? 1 : -1;
    const gap = 46 + Math.floor(this.slot / 2) * 40 + (1 - this.loyalty) * 140;
    const tx = p.x + side * gap;
    const ty = W.water ? p.y + ((this.slot % 3) - 1) * 34 : p.y;
    const d = Math.hypot(tx - this.x, W.water ? ty - this.y : 0);
    if (d > 34) {
      this.go('follow');
      this.moveTo(tx, ty, this.def.speed * (d > 260 ? 1.15 : d > 120 ? 0.85 : 0.5), d > 260);
    } else {
      this.go('idle');
      this.halt();
      if (Math.random() < 0.01) this.dir = Math.sign(p.x - this.x) || this.dir;
    }
  }

  private nearCover(range: number): Rect | null {
    let best: Rect | null = null;
    let bd = range;
    for (const c of this.world.cover) {
      const d = Math.hypot(c.x + c.w / 2 - this.x, c.y + c.h / 2 - this.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  private coverY(c: Rect) {
    return this.world.water ? c.y + c.h * 0.6 : this.y;
  }

  private hideIfInside(c: Rect) {
    if (this.x > c.x + 4 && this.x < c.x + c.w - 4 && this.y > c.y - 10 && this.y < c.y + c.h + 10) {
      this.hiddenNow = true;
      this.halt();
    }
  }
}
