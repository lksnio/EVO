import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import type { Morph } from '../art/creatureArt';
import { audio } from '../audio/Audio';
import { DEPTH } from '../config';
import { clamp, type Rect } from '../util/math';
import { Animal, type World } from './Animal';
import { CreatureView, type AnimMode } from './CreatureView';

/**
 * Ein Artgenosse: fast wie du – kleine genetische Abweichungen, Männchen oder Weibchen.
 * Er hält sich in deiner Nähe, frisst, flieht vor Räubern (mit Warnruf) und versteckt sich,
 * wenn du dich versteckst. Wer Beute mit ihm teilt, den verteidigt er.
 */
export class Kin extends Animal {
  view: CreatureView;
  private offY: number;
  private slot: number;
  private calledAt = -1e9;
  private dying = false;

  constructor(world: World, def: SpeciesDef, x: number, y: number, m: Morph, slot: number) {
    super(world, def, x, y, { texture: 'p_dot' });
    this.kin = true;
    this.slot = slot;
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

  tick(time: number, dt: number) {
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

  // ------------------------------------------------------------------ Verhalten

  protected think(time: number, dt: number) {
    void dt;
    const W = this.world;
    const p = W.player;
    this.attacking = false;
    this.hiddenNow = false;
    const sprint = this.def.speed * (this.def.sprint ?? 1.3);

    // Gefahr: Warnruf und ab ins Dickicht – oder weg
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
    if (p.hidden && !p.dead) {
      const c = this.nearCover(360);
      if (c) {
        this.go('hide');
        this.moveTo(c.x + c.w / 2 + (this.slot - 2) * 10, this.coverY(c), this.def.speed * 0.9, true);
        this.hideIfInside(c);
        return;
      }
    }

    // Wer Beute mit dir geteilt hat, verteidigt dich
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

    if (this.food && this.hunger > 0.4 && this.dist(p) < 420) return this.eatFood(time);
    this.followGroup(time);
  }

  /** Bei der Gruppe bleiben – jeder hat seinen Platz neben dir. */
  private followGroup(time: number) {
    const W = this.world;
    const p = W.player;
    if (p.dead) return this.wander(time);
    const side = this.slot % 2 ? 1 : -1;
    const gap = 46 + Math.floor(this.slot / 2) * 40;
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
