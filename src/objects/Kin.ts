import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import type { Morph } from '../art/creatureArt';
import type { Sex, Traits } from '../state/GameState';
import { audio } from '../audio/Audio';
import { DEPTH } from '../config';
import { clamp, type Rect } from '../util/math';
import { Animal, type World } from './Animal';
import { Meat, Plant } from './Food';
import { CreatureView, type AnimMode } from './CreatureView';

/** Was die Level-Szene den Artgenossen zusätzlich bietet. */
export interface KinWorld extends World {
  /** ein Artgenosse ist verärgert – bei gemeinsamer Beute nichts abbekommen (bit: er hat zugebissen) */
  kinSnubbed(k: Kin, bit: boolean): void;
  /** ein Artgenosse zieht allein weiter */
  kinLeaving(k: Kin): void;
  /** ein Artgenosse hat von gemeinsamer Beute gefressen */
  kinShared(k: Kin, c: Meat): void;
}

/**
 * Ein Artgenosse: fast wie du – kleine genetische Abweichungen, Männchen oder Weibchen.
 *
 * Artgenossen leben ihr eigenes Leben: Sie streifen durch ihr Revier, fressen und fliehen vor
 * Räubern – sie schwimmen nicht im Schwarm hinter dir her. Greifst du in ihrer Nähe etwas an,
 * helfen sie manchmal mit; je mehr deine Art zum Rudeltier geworden ist, desto öfter. Wer mitgekämpft
 * hat, will aber auch mitfressen: Frisst du die Beute allein, beißt er dich und zieht verärgert ab.
 *
 * Wer zu deiner Gruppe gehört (memberId) und gerufen ist (escort), folgt dir locker und hilft bei jedem Angriff. Fortgeschickt
 * (dismiss) schwimmt er davon – er lebt weiter und kommt auf den nächsten Ruf wieder.
 */
export class Kin extends Animal {
  view: CreatureView;
  /** Erbanlagen dieses Artgenossen (kann die Linie weiterführen) */
  genes?: { traits: Traits; sex: Sex; seed: number };
  /** Vertrauen zum Spieler: 0 = misstrauisch … 1 = steht dir bei */
  loyalty: number;
  /** Nummer in deiner Gruppe (game.swarm) – fehlt bei Artgenossen, die nicht dazugehören */
  memberId?: number;
  /** begleitet dich: folgt locker und hilft bei jedem Angriff */
  escort = false;
  /** Platz in der Begleitung (damit nicht alle an derselben Stelle schwimmen) */
  slot = 0;
  /** fortgeschickt: schwimmt davon und verlässt den Ort (lebend) */
  homeward = false;
  private offY: number;
  private calledAt = -1e9;
  private dying = false;
  private leaving = false;
  private prey: Animal | null = null;
  private huntUntil = 0;
  /** zuletzt gefragt, ob er mithilft (je Beute wird nur einmal entschieden) */
  private asked: Animal | null = null;
  private want: Plant | Meat | null = null;
  /** verärgert: beißt einmal zu … */
  private angryUntil = 0;
  /** … und hält sich dann eine Weile von dir fern */
  private sulkUntil = 0;

  constructor(world: KinWorld, def: SpeciesDef, x: number, y: number, m: Morph, loyalty: number) {
    super(world, def, x, y, { texture: 'p_dot' });
    this.kin = true;
    // Die Größe steckt in den Erbanlagen (Ansicht), nicht in einer zufälligen Streuung
    this.sz = 1;
    this.setScale(1);
    this.hp = this.maxHp = def.hp;
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

  protected get meatEater() {
    return this.eatsMeat;
  }

  omni = false;

  /** gerade verärgert (hilft nicht, hält Abstand) */
  get sulking() {
    return this.world.time.now < this.sulkUntil;
  }

  tick(time: number, dt: number) {
    if (!this.dead && !this.leaving) {
      this.ally = this.loyalty >= 0.6 && !this.sulking;
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

  /**
   * Du greifst in der Nähe etwas an. Ob dieser Artgenosse mithilft, entscheidet sich einmal je Beute
   * (chance: je mehr Rudeltier, desto eher). Wer schon mitjagt, bleibt dabei.
   */
  offerHunt(a: Animal, until: number, chance: number) {
    if (this.leaving || this.dead || a.dead || a.kin || this.sulking) return;
    if (this.prey === a) {
      this.huntUntil = until;
      return;
    }
    if (this.asked === a) return;
    this.asked = a;
    if (Math.random() < chance) {
      this.prey = a;
      this.huntUntil = until;
    }
  }

  /** Von gemeinsamer Beute gefressen: Das Vertrauen wächst. */
  protected sharedMeal(c: Meat, time: number) {
    void time;
    if (!c.byPlayer) return;
    this.loyalty = Math.min(1, this.loyalty + 0.14);
    this.kw.kinShared(this, c);
  }

  /** Fortgeschickt: nicht mehr folgen, sondern davonschwimmen (er lebt weiter und kommt auf den nächsten Ruf wieder). */
  dismiss() {
    if (this.dead || this.leaving) return;
    this.escort = false;
    this.homeward = true;
    this.prey = null;
  }

  /** Erneut gerufen, bevor er fort war: Er kehrt um und begleitet dich wieder. */
  recall(slot: number) {
    if (this.dead || this.leaving) return;
    this.homeward = false;
    this.escort = true;
    this.slot = slot;
  }

  /** Bei gemeinsamer Beute nichts abbekommen: einmal zubeißen (bite) und verärgert davonschwimmen. */
  grudge(bite: boolean) {
    if (this.dead || this.leaving) return;
    const now = this.world.time.now;
    this.loyalty -= bite ? 0.3 : 0.1;
    this.prey = null;
    this.ally = false;
    if (bite) this.angryUntil = now + 2600;
    this.sulkUntil = now + (bite ? 26000 : 9000);
    this.dir = Math.sign(this.world.player.x - this.x) || this.dir;
    this.kw.kinSnubbed(this, bite);
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

    // Geht eigene Wege (oder ist fortgeschickt): zum fernen Rand und fort
    if (this.leaving || this.homeward) {
      const edge = this.x < (W.physics.world.bounds.width / 2) ? 10 : W.physics.world.bounds.width - 10;
      this.go('wander');
      this.moveTo(edge, this.y, this.def.speed * 0.9, true);
      if (Math.abs(this.x - edge) < 40) this.leave();
      return;
    }

    // Verärgert: einmal zubeißen, dann davon
    if (time < this.angryUntil && !p.dead) {
      this.target = p;
      this.go('hunt');
      this.chase(p, sprint);
      this.tryBite(time, p);
      return;
    }

    // Gemeinsame Jagd geht vor (bis die Beute tot oder die Zeit um ist)
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

    // Wer dir vertraut, steht dir bei, wenn du in der Nähe angegriffen wirst
    if (this.ally && !p.dead && this.dist(p) < 320) {
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

    // Fressen – Beute, bei der man mitgekämpft hat, will man auf jeden Fall
    const food = this.findFood();
    if (this.want && this.want !== food) this.want.wanted.delete(this);
    this.want = food;
    if (food) {
      food.wanted.add(this);
      this.food = food;
      return this.eatHere(time, food);
    }

    // Verärgert: Abstand halten
    if (this.sulking && !p.dead) {
      const away = Math.sign(this.x - p.x) || 1;
      this.home.x = clamp(p.x + away * 700, 40, W.physics.world.bounds.width - 40);
      this.go('wander');
      if (Math.abs(this.x - p.x) < 600) {
        this.moveTo(this.home.x, this.home.y, this.def.speed * 0.9, true);
        return;
      }
    }
    // gerufen: dir locker hinterherschwimmen
    if (this.escort && !p.dead) return this.escortStep();
    // sonst: im eigenen Revier umherstreifen
    this.wander(time);
  }

  /** Locker hinterher: jeder an seinem Platz hinter dir, mal etwas höher, mal tiefer – wer zurückfällt, schließt zügig auf. */
  private escortStep() {
    const W = this.world;
    const p = W.player;
    const back = -(p.facing ?? (this.x < p.x ? 1 : -1));
    const row = this.slot % 3, lane = Math.floor(this.slot / 3);
    const tx = clamp(p.x + back * (95 + 55 * row + 35 * lane), 40, W.physics.world.bounds.width - 40);
    let ty = p.y + [-46, 38, -6][row] + (lane % 2 ? 1 : -1) * 28 * lane;
    if (W.water) ty = Math.max(ty, W.surfaceY + 40);
    if (W.solidAt(tx, ty)) ty = p.y;
    const d = this.dist({ x: tx, y: ty });
    if (d < 36) {
      this.go('idle');
      this.halt();
      return;
    }
    this.go('follow');
    this.moveTo(tx, ty, this.def.speed * (d > 420 ? 1.35 : d > 160 ? 0.95 : 0.5));
  }

  private findFood(): Plant | Meat | null {
    const W = this.world;
    let best: Plant | Meat | null = null;
    if (this.eatsMeat) {
      let bd = Infinity;
      for (const c of W.meats) {
        if (c.gone || c.units <= 0) continue;
        const d = this.dist(c);
        // eigene Beute: von weiter her und auch ohne großen Hunger
        const mine = c.kill.helpers.has(this) && !c.kill.fed.has(this);
        if (mine ? d < 700 && this.hunger > 0.05 : d < 340 && this.hunger > 0.4) {
          const score = mine ? d * 0.4 : d;
          if (score < bd) {
            bd = score;
            best = c;
          }
        }
      }
    }
    if (!best && (this.def.diet === 'plant' || this.omni) && this.hunger > 0.4) {
      let bd = 280;
      for (const pl of W.plants) {
        if (pl.units <= 0 || pl.toxic || pl.heals) continue;
        const d = this.dist(pl);
        if (d < bd && (W.water || Math.abs(pl.y - this.b.bottom) < 90)) {
          bd = d;
          best = pl;
        }
      }
    }
    return best;
  }

  private eatHere(time: number, f: Plant | Meat) {
    const isMeat = f instanceof Meat;
    const fy = isMeat ? f.y : f.y - 20;
    if (this.dist({ x: f.x, y: fy }) < 40) {
      this.go('graze');
      this.halt();
      this.dir = Math.sign(f.x - this.x) || this.dir;
      if (time > this.feedAt) {
        this.feedAt = time + 1100;
        if (f.take(time)) {
          this.hunger = Math.max(0, this.hunger - (isMeat ? 0.4 : 0.28));
          this.world.puff(f.x, f.y - 6, 3, isMeat ? 0x6a1a10 : 0x6a7a3a);
          if (isMeat) {
            f.ateFrom.add(this);
            f.kill.fed.add(this);
            this.view.chew();
            this.sharedMeal(f, time);
          }
        }
      }
    } else this.moveTo(f.x, fy, this.def.speed * 0.9, true);
  }

  /** Die Angriffsbewegung zeigt die Ansicht: Maul auf, vorstoßen, zuschnappen. */
  protected get showsAttack() {
    return false;
  }

  protected onStrike() {
    this.view.bite();
  }

  protected onStrikeHit(tg: Animal | World['player']) {
    // verärgert: einmal zugebissen – jetzt zieht er ab
    if (tg === this.world.player && this.angryUntil) {
      this.angryUntil = 0;
      audio.sfx('snarl');
    }
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
