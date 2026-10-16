import { Enemy, type EnemyHost } from './Enemy';
import type { EnemyDef } from '../data/enemies';
import { audio } from '../audio/Audio';
import { bus } from '../state/GameState';
import { clamp } from '../util/math';

// Die fünf Endgegner. Jeder hat ein eigenes Verhaltensmuster mit
// Phasen, in denen er verwundbar ist.

export class Boss extends Enemy {
  active2 = false;
  /** Schadensmultiplikator (z. B. wenn der Boss betäubt ist). */
  private weak = 1;
  private cycle = 0;
  private summoned = false;

  constructor(host: EnemyHost, def: EnemyDef, x: number, y: number) {
    super(host, def, x, y);
    this.dir = -1;
    this.go('intro');
  }

  private get A() {
    return this.host.arena!;
  }

  start() {
    this.active2 = true;
    this.go('idle');
    audio.sfx('roar');
    this.host.cameras.main.shake(500, 0.008);
  }

  damage(amount: number, fromX: number): boolean {
    const dmg = Math.round(amount * this.weak);
    const died = super.damage(dmg, fromX);
    bus.emit('bossHp', Math.max(0, this.hp), this.maxHp);
    return died;
  }

  protected behave(time: number, dt: number) {
    if (!this.active2) {
      this.b.setVelocity(0, this.def.air || this.host.water ? 0 : this.b.velocity.y);
      this.dir = -1;
      return;
    }
    switch (this.def.id) {
      case 'panzerfisch':
        return this.panzerfisch(dt);
      case 'riesenlibelle':
        return this.libelle(dt);
      case 'trex':
        return this.trex(dt);
      case 'saebelzahn':
        return this.tiger(dt);
      case 'kristall':
        return this.kristall(time, dt);
    }
  }

  private face() {
    this.dir = Math.sign(this.host.player.x - this.x) || this.dir;
  }

  private shake(on: boolean) {
    if (on) this.setTint(0xffb0a0);
    else this.clearTint();
  }

  // ---------------------------------------------------------------- Urozean
  private panzerfisch(_dt: number) {
    const p = this.host.player, b = this.b, A = this.A;
    const rage = this.hp < this.maxHp * 0.35 ? 1.3 : 1;
    switch (this.st) {
      case 'idle':
        if (this.x < A.x0 + 180) this.dir = 1;
        else if (this.x > A.x1 - 180) this.dir = -1;
        b.setVelocity(this.dir * 90 * rage, clamp((p.y - this.y) * 0.9, -80, 80));
        if (this.stT > 2.6 / rage) {
          this.face();
          this.go('wind');
          this.shake(true);
          audio.sfx('buzz');
        }
        break;
      case 'wind':
        b.setVelocity(-this.dir * 25, 0);
        if (this.stT > 0.7) {
          this.shake(false);
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          b.setVelocity(Math.cos(a) * 380 * rage, Math.sin(a) * 380 * rage);
          this.dir = Math.sign(b.velocity.x) || this.dir;
          this.go('charge');
        }
        break;
      case 'charge':
        if (this.stT > 1.3 || this.x < A.x0 + 120 || this.x > A.x1 - 120 || b.blocked.down || b.blocked.up) {
          this.go('recover');
        }
        break;
      case 'recover':
        b.setVelocity(b.velocity.x * 0.9, b.velocity.y * 0.9);
        if (this.stT > 0.9) {
          this.cycle++;
          if (this.hp < this.maxHp * 0.6 && this.cycle % 2 === 0) {
            this.host.spawnEnemy('kleinfisch', this.x, this.y - 40);
            this.host.spawnEnemy('raubfisch', this.x, this.y + 40);
          }
          this.go('idle');
        }
        break;
    }
  }

  // ---------------------------------------------------------------- Sümpfe
  private libelle(_dt: number) {
    const p = this.host.player, b = this.b, A = this.A;
    const hoverY = A.floor - 300;
    const lowY = A.floor - 62;
    switch (this.st) {
      case 'idle':
        if (this.x < A.x0 + 160) this.dir = 1;
        else if (this.x > A.x1 - 160) this.dir = -1;
        b.setVelocity(this.dir * 130, (hoverY + Math.sin(this.t * 2) * 25 - this.y) * 2);
        if (this.stT > 2.5) {
          this.cycle++;
          const nextSt = this.cycle % 3 === 2 ? 'spit' : 'wind';
          this.go(nextSt);
          if (nextSt === 'wind') audio.sfx('buzz');
        }
        break;
      case 'spit':
        b.setVelocity(0, (hoverY - this.y) * 2);
        this.face();
        if (this.stT > 0.35 && this.next === 0) {
          this.next = 1;
          for (const off of [-90, 0, 90]) this.fire(p.x + off, p.y, 'pr_acid', this.def.dmg, 280);
        }
        if (this.stT > 1.1) {
          this.next = 0;
          this.go('idle');
        }
        break;
      case 'wind':
        b.setVelocity(0, -40);
        this.face();
        this.shake(true);
        if (this.stT > 0.55) {
          this.shake(false);
          this.target = { x: p.x, y: lowY };
          this.go('dive');
        }
        break;
      case 'dive': {
        const a = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        b.setVelocity(Math.cos(a) * 430, Math.sin(a) * 430);
        if (this.y >= lowY - 6 || this.stT > 1.3) {
          this.dir = this.x < (A.x0 + A.x1) / 2 ? 1 : -1;
          this.go('skim');
        }
        break;
      }
      case 'skim':
        b.setVelocity(this.dir * 250, (lowY - this.y) * 3);
        if (this.stT > 1.5 || this.x < A.x0 + 100 || this.x > A.x1 - 100) this.go('rise');
        break;
      case 'rise':
        b.setVelocity(this.dir * 60, -220);
        if (this.y <= hoverY) this.go('idle');
        break;
    }
  }

  // ---------------------------------------------------------------- Reptilien
  private trex(_dt: number) {
    const p = this.host.player, b = this.b, A = this.A;
    const rage = this.hp < this.maxHp * 0.5;
    switch (this.st) {
      case 'idle':
        this.face();
        b.setVelocityX(this.dir * (rage ? 95 : 75));
        if (Math.abs(p.x - this.x) < 170) this.go('biteWind');
        else if (this.stT > 2.6) {
          this.cycle++;
          this.go(this.cycle % 3 === 1 ? 'roar' : 'chargeWind');
        }
        break;
      case 'biteWind':
        b.setVelocityX(0);
        this.shake(true);
        if (this.stT > 0.35) {
          this.shake(false);
          b.setVelocityX(this.dir * 280);
          this.go('bite');
        }
        break;
      case 'bite':
        if (this.stT > 0.3) {
          b.setVelocityX(0);
          if (this.stT > 0.7) this.go('idle');
        }
        break;
      case 'roar':
        b.setVelocityX(0);
        if (this.next === 0) {
          this.next = 1;
          audio.sfx('roar');
          this.host.cameras.main.shake(600, 0.01);
          for (const s of [-1, 1]) this.host.shoot(this.x + s * 60, A.floor - 20, s * 300, 0, 'pr_wave', this.def.dmg, false);
          if (rage) {
            for (let i = 0; i < 4; i++) {
              const x = A.x0 + 80 + Math.random() * (A.x1 - A.x0 - 160);
              this.host.time.delayedCall(250 + i * 220, () => this.host.shoot(x, A.floor - 600, 0, 50, 'pr_rock', this.def.dmg, true));
            }
          }
        }
        if (this.stT > 1.4) {
          this.next = 0;
          this.go('idle');
        }
        break;
      case 'chargeWind':
        this.face();
        b.setVelocityX(0);
        this.shake(true);
        if (this.stT > 0.65) {
          this.shake(false);
          this.go('charge');
        }
        break;
      case 'charge':
        b.setVelocityX(this.dir * (rage ? 470 : 420));
        if (Math.random() < 0.4) this.host.puff(this.x - this.dir * 60, b.bottom, 1);
        if (b.blocked.left || b.blocked.right || this.x < A.x0 + 90 || this.x > A.x1 - 90) {
          audio.sfx('boom');
          this.host.cameras.main.shake(400, 0.012);
          this.host.floatText(this.x, this.y - 120, 'Betäubt!', '#ffe080', 28);
          b.setVelocityX(-this.dir * 80);
          this.weak = 2;
          this.go('stunned');
        } else if (this.stT > 3) this.go('idle');
        break;
      case 'stunned':
        b.setVelocityX(b.velocity.x * 0.9);
        this.setAngle(Math.sin(this.stT * 12) * 3);
        if (this.stT > 1.8) {
          this.weak = 1;
          this.setAngle(0);
          this.go('idle');
        }
        break;
    }
  }

  // ---------------------------------------------------------------- Eiszeit
  private tiger(_dt: number) {
    const p = this.host.player, b = this.b, A = this.A;
    const dx = p.x - this.x;
    switch (this.st) {
      case 'idle': {
        this.face();
        const want = Math.abs(dx) < 260 ? -this.dir : this.dir;
        b.setVelocityX(want * 120);
        if (this.x < A.x0 + 100 || this.x > A.x1 - 100) b.setVelocityX(this.dir * 120);
        if (this.stT > 1.7) {
          this.cycle++;
          if (!this.summoned && this.hp < this.maxHp * 0.5) this.go('howl');
          else this.go(this.cycle % 2 ? 'pounceWind' : 'dashWind');
        }
        break;
      }
      case 'pounceWind':
        this.face();
        b.setVelocityX(0);
        this.setScale(1.05, 0.9);
        if (this.stT > 0.45) {
          this.setScale(1);
          b.setVelocity(clamp((p.x - this.x) / 0.9, -440, 440), -640);
          this.go('pounce');
        }
        break;
      case 'pounce':
        if (this.stT > 0.25 && this.onFloor) {
          b.setVelocityX(0);
          this.host.puff(this.x, b.bottom, 6);
          this.host.cameras.main.shake(200, 0.006);
          this.go('recover');
        }
        break;
      case 'dashWind':
        this.face();
        b.setVelocityX(0);
        this.shake(true);
        if (this.stT > 0.35) {
          this.shake(false);
          this.go('dash');
        }
        break;
      case 'dash':
        b.setVelocityX(this.dir * 500);
        if (this.stT > 0.75 || b.blocked.left || b.blocked.right) {
          b.setVelocityX(0);
          this.go('recover');
        }
        break;
      case 'recover':
        b.setVelocityX(0);
        if (this.stT > 0.75) this.go('idle');
        break;
      case 'howl':
        b.setVelocityX(0);
        if (this.next === 0) {
          this.next = 1;
          this.summoned = true;
          audio.sfx('roar');
          this.host.spawnEnemy('eiswolf', A.x0 + 80, A.floor - 40);
          this.host.spawnEnemy('eiswolf', A.x1 - 80, A.floor - 40);
        }
        if (this.stT > 1) {
          this.next = 0;
          this.go('idle');
        }
        break;
    }
  }

  // ---------------------------------------------------------------- Eden
  private kristall(_time: number, _dt: number) {
    const p = this.host.player, b = this.b, A = this.A;
    const cx = (A.x0 + A.x1) / 2;
    const rage = this.hp < this.maxHp * 0.5;
    const moveTo = (x: number, y: number, k = 2) => b.setVelocity((x - this.x) * k, (y - this.y) * k);
    this.dir = Math.sign(p.x - this.x) || 1;
    switch (this.st) {
      case 'idle':
        moveTo(cx + Math.sin(this.t * 0.6) * 300, A.floor - 270 + Math.sin(this.t * 1.3) * 30);
        if (this.stT > (rage ? 1.8 : 2.4)) {
          this.cycle++;
          const c = this.cycle % 4;
          this.go(c === 0 ? 'descend' : c === 2 ? 'volley' : 'burst');
          if (rage && this.cycle % 5 === 0) {
            this.host.spawnEnemy('schatten', A.x0 + 100, A.floor - 200);
            this.host.spawnEnemy('schatten', A.x1 - 100, A.floor - 200);
          }
        }
        break;
      case 'burst': {
        b.setVelocity(0, 0);
        const shots = rage ? [0.25, 0.9] : [0.25];
        for (const at of shots) {
          if (this.stT >= at && this.next < shots.indexOf(at) + 1) {
            this.next = shots.indexOf(at) + 1;
            const n = 10;
            const off = this.cycle * 0.3 + at;
            for (let i = 0; i < n; i++) {
              const a = off + (i / n) * Math.PI * 2;
              this.host.shoot(this.x, this.y, Math.cos(a) * 230, Math.sin(a) * 230, 'pr_shard', this.def.dmg, false);
            }
            audio.sfx('shoot');
          }
        }
        if (this.stT > 1.3) {
          this.next = 0;
          this.go('idle');
        }
        break;
      }
      case 'volley':
        b.setVelocity(0, 0);
        for (let i = 0; i < 3; i++) {
          if (this.stT >= 0.2 + i * 0.25 && this.next === i) {
            this.next = i + 1;
            this.fire(p.x, p.y, 'pr_shard', this.def.dmg, 320);
          }
        }
        if (this.stT > 1.1) {
          this.next = 0;
          this.go('idle');
        }
        break;
      case 'descend':
        moveTo(clamp(p.x, A.x0 + 150, A.x1 - 150), A.floor - 115, 2.5);
        this.weak = 1.5;
        this.setTint(0xfff0ff);
        if (this.stT > 2.6) {
          this.weak = 1;
          this.clearTint();
          this.go('idle');
        }
        break;
    }
  }
}
