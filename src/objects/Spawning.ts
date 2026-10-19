import Phaser from 'phaser';
import { DEPTH, TILE, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { SPAWN } from '../data/life';
import { bus, game, type Clutch, type Sex, type Traits } from '../state/GameState';
import { isAdult, spawnBlock, type SpawnBlock } from '../sim/life';
import { clamp } from '../util/math';
import { touch } from './Controls';
import { CreatureView } from './CreatureView';
import { Roe } from './Food';
import type { Kin } from './Kin';
import type { LevelScene } from '../scenes/LevelScene';

type Genes = { traits: Traits; seed: number; sex: Sex };

/** Ein Gelege im Laichfluss, das hier zu sehen ist. */
interface Brood {
  roe: Roe;
  x: number;
  y: number;
  /** Weltzeit (ms), als es gelegt wurde */
  at: number;
  /** dein Gelege (es steht im Spielstand) */
  clutch?: Clutch;
  /** von einem Weibchen deiner Art gelegt und noch unbefruchtet: Wer es befruchtet, wird Vater der nächsten Generation */
  mother?: Genes;
  /** ein Männchen deiner Art ist unterwegs, um dein Gelege zu befruchten */
  male?: Kin;
  maleCalled?: boolean;
  glow?: Phaser.GameObjects.Image;
}

const rnd = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/**
 * Das Zeichen beim Laichen: über dem eigenen Tier (Weibchen) bzw. über dem Gelege (Männchen) steht „L“. Wer die Taste hält,
 * sieht den Ring sich füllen – ist er voll, ist gelaicht.
 */
class HoldSign {
  private c: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private a = 0;
  private t = 0;

  constructor(scene: Phaser.Scene, touchMode: boolean) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(1.5, 3, 19);
    g.fillStyle(0x0d0c0b, 0.88);
    g.fillCircle(0, 0, 19);
    g.lineStyle(1.5, 0xc8913c, 0.55);
    g.strokeCircle(0, 0, 18.5);
    const label = scene.add.text(0, 0, touchMode ? '···' : 'L', { fontFamily: TITLE_FONT, fontSize: touchMode ? '18px' : '19px', color: '#e0a848', fontStyle: '700', resolution: 2 }).setOrigin(0.5);
    this.ring = scene.add.graphics();
    this.c = scene.add.container(0, 0, [g, this.ring, label]).setDepth(DEPTH.text).setAlpha(0).setScale(1.25);
  }

  update(dt: number, x: number, y: number, want: boolean, k: number) {
    this.t += dt;
    this.a += ((want ? 1 : 0) - this.a) * Math.min(1, dt * 6);
    this.c.setAlpha(this.a).setVisible(this.a > 0.02);
    this.c.setPosition(x, y - 84 + Math.sin(this.t * 3) * 3);
    this.ring.clear();
    if (k > 0.01) {
      this.ring.lineStyle(4, 0xffe0a0, 0.95);
      this.ring.beginPath();
      this.ring.arc(0, 0, 18.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      this.ring.strokePath();
    }
  }

  destroy() {
    this.c.destroy();
  }
}

/**
 * Laichen im Laichfluss (dem Startort, flussaufwärts der Mündung), dicht am Grund – sobald das eigene Tier ausgewachsen und
 * satt genug ist (siehe data/life.ts, SPAWN):
 *   – Weibchen halten L und legen ein Gelege. Kurz darauf kommt ein Männchen deiner Art und befruchtet es.
 *   – Männchen: Bist du bereit im Laichfluss, kommt ein Weibchen deiner Art und legt ein Gelege – halte L daran, um es zu
 *     befruchten.
 * Ein befruchtetes Gelege bleibt im Spielstand: Stirbt dein Tier, schlüpft daraus die nächste Generation (LevelScene).
 * Unbefruchtete Gelege verderben nach einer Weile. Später übernehmen andere Spieler die Rolle des Partners.
 */
export class SpawnCtl {
  private broods: Brood[] = [];
  private sign: HoldSign;
  private holdT = 0;
  private bubbleAt = 0;
  private able = false;
  /** frühestens dann legt ein Weibchen deiner Art (wenn du als Männchen bereit bist) */
  private femaleAt = 0;
  private female?: Kin;
  private nextKin = 900;
  /** frisch geschlüpfte Geschwister (nur zum Ansehen): Sie schwärmen in alle Richtungen aus */
  private fry: { v: CreatureView; vx: number; vy: number; t: number }[] = [];
  /** was gerade noch fehlt (für die Tafel) */
  block: SpawnBlock | null = 'jung';

  constructor(private host: LevelScene) {
    const touchMode = host.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.sign = new HoldSign(host, touchMode);
    this.femaleAt = host.time.now + rnd(SPAWN.femaleDelay) * 1000;
    // die eigenen Gelege an diesem Ort – ein noch unbefruchtetes bekommt (wieder) Besuch von einem Männchen
    game.decayClutches();
    for (const c of game.life.clutches) if (c.place === host.place.id) this.addBrood(c.x, c.y, c.at, { clutch: c });
    for (const b of this.broods) if (b.clutch && !b.clutch.fert) this.callMale(b, rnd(SPAWN.maleDelay));
    host.events.once('shutdown', () => this.shutdown());
  }

  /** Hier ist Laichgrund: im Laichfluss (dem Startort), flussaufwärts der Mündung. */
  get grounds() {
    const h = this.host;
    return h.place.kind === 'start' && !!h.L.riverEnd && h.player.x < h.L.riverEnd;
  }

  private groundY(x: number) {
    const L = this.host.L;
    return L.ground[clamp(Math.floor(x / TILE), 0, L.ground.length - 1)];
  }

  /** Ein neues Leben beginnt: Das Gelege schlüpft – Bläschen, ein Funkeln, und die Geschwister schwärmen aus. */
  hatched() {
    const h = this.host, p = h.player;
    const x = p.x, y = p.y + 20;
    h.puff(x, y, 14, 0xf4f0e0);
    h.glitter(x, y - 10, 10);
    audio.sfx('laich');
    const m = p.morph();
    for (let i = 0; i < 5; i++) {
      const dir = i % 2 ? 1 : -1;
      const v = new CreatureView(h, x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 24, { ...m, seed: m.seed + 17 * (i + 1) });
      v.setDepth(DEPTH.enemies).setFacing(dir);
      this.fry.push({ v, vx: dir * (80 + Math.random() * 90), vy: -15 - Math.random() * 45, t: Math.random() * 0.4 });
    }
    h.time.delayedCall(1400, () => !h.ended && bus.emit('notice', 'Geschlüpft', `Generation ${game.life.gen} – wachse heran`));
  }

  private fryStep(dt: number) {
    if (!this.fry.length) return;
    for (const f of this.fry) {
      f.t += dt;
      f.vy *= 1 - Math.min(1, dt * 0.8);
      f.v.setPosition(f.v.x + f.vx * dt, f.v.y + f.vy * dt);
      f.v.animate(dt, 'swim', 0.7);
      f.v.setAlpha(clamp(3.2 - f.t, 0, 1));
    }
    this.fry = this.fry.filter((f) => {
      if (f.t < 3.2) return true;
      f.v.destroy();
      return false;
    });
  }

  update(time: number, dt: number) {
    const h = this.host, p = h.player;
    const run = game.run;
    this.fryStep(dt);
    // das Leben ist zu Ende (oder ein neues hat schon begonnen): hier geschieht nichts mehr
    if (h.ended) {
      this.holdT = 0;
      this.setAble(false);
      this.sign.update(dt, p.x, p.y, false, 0);
      return;
    }
    this.decay();
    if (this.female && (this.female.dead || !this.female.active)) this.female = undefined;
    for (const b of this.broods) {
      // das Männchen ist unterwegs umgekommen: ein anderes kommt
      if (b.clutch && !b.clutch.fert && b.male && (b.male.dead || !b.male.active)) {
        b.male = undefined;
        b.maleCalled = false;
        this.callMale(b, rnd(SPAWN.maleDelay));
      }
    }
    const busy = !run || p.dead || !!h.quest?.busy || !!h.hunt?.busy || h.cineActive;
    if (busy) {
      this.holdT = 0;
      this.setAble(false);
      this.sign.update(dt, p.x, p.y, false, 0);
      return;
    }
    const life = game.life;
    const male = run.sex === 1;
    const food = p.satiety / Math.max(1, p.maxSat);
    // Männchen: das nächste unbefruchtete Gelege eines Weibchens deiner Art in Reichweite
    let target: Brood | undefined;
    if (male) {
      let best = SPAWN.reach;
      for (const b of this.broods) {
        const d = Math.hypot(b.x - p.x, b.y - 20 - p.y);
        if (b.mother && !b.clutch && d < best) {
          best = d;
          target = b;
        }
      }
    }
    const atGround = male ? !!target : this.groundY(p.x) - p.y < SPAWN.ground;
    this.block = spawnBlock({ age: life.age, food, lastSpawn: life.lastSpawn, inGrounds: this.grounds, atGround, male });
    const able = this.block === null;
    this.setAble(able);
    const held = h.controls.held.spawn || touch.spawn;
    if (able && held) this.holdT += dt;
    else this.holdT = Math.max(0, this.holdT - dt * 2);
    const k = clamp(this.holdT / SPAWN.hold, 0, 1);
    const sx = target ? target.x : p.x, sy = target ? target.y - 10 : p.y;
    this.sign.update(dt, sx, sy, able, able ? k : 0);
    // beim Halten steigen Bläschen auf
    if (able && held && time > this.bubbleAt) {
      this.bubbleAt = time + 160;
      h.puff(p.x - p.facing * 6, p.y + 8, 1, 0xf4f0e0);
    }
    if (able && k >= 1) {
      this.holdT = 0;
      if (target) this.fertilizeAsMale(target);
      else if (!male) this.lay();
    }
    // Ein Weibchen deiner Art laicht, wenn du als Männchen bereit im Laichfluss bist
    const ready = male && isAdult(life.age) && this.grounds && food >= SPAWN.minFood && life.age - life.lastSpawn >= SPAWN.cooldown;
    if (ready && !this.female && !this.broods.some((b) => b.mother) && time > this.femaleAt) this.callFemale(time);
  }

  private setAble(v: boolean) {
    if (v === this.able) return;
    this.able = v;
    bus.emit('spawnable', v);
    if (!v) touch.spawn = false;
  }

  // ---------------------------------------------------------------- Weibchen

  /** Ein Gelege ablegen – am Grund, genau unter dir. */
  private lay() {
    const h = this.host, p = h.player;
    const y = Math.round(this.groundY(p.x) + 6);
    p.satiety = Math.max(0.01, p.satiety - p.maxSat * SPAWN.costFemale);
    game.markSpawn();
    const c = game.addClutch({ place: h.place.id, x: Math.round(p.x), y, at: Date.now(), fert: false, role: 'mother' });
    const b = this.addBrood(c.x, c.y, c.at, { clutch: c });
    this.layFx(b, p.x, p.y);
    bus.emit('notice', 'Gelege abgelegt', 'Ein Männchen deiner Art kommt …');
    this.callMale(b, rnd(SPAWN.maleDelay));
  }

  /** Ein Männchen deiner Art kommt vom Meer herauf und befruchtet dein Gelege. */
  private callMale(b: Brood, delay: number) {
    const h = this.host;
    if (b.maleCalled) return;
    b.maleCalled = true;
    h.time.delayedCall(delay * 1000, () => {
      if (h.ended || !this.broods.includes(b) || !b.clutch || b.clutch.fert) return;
      const v = h.cameras.main.worldView;
      const x = Math.min(h.L.width - 80, v.right + 140);
      const k = h.spawnKinAt(this.kinIndex(1), x, Math.max(h.surfaceY + 80, b.y - 140));
      k.homeDir = 1;
      b.male = k;
      k.task = {
        x: b.x + 4,
        y: b.y - 34,
        stay: 1.6,
        t: 0,
        done: () => {
          if (k.dead || !b.clutch) return;
          this.fertilizeOwn(b, k.genes);
          k.dismiss();
        },
      };
    });
  }

  private fertilizeOwn(b: Brood, genes?: Genes) {
    if (!b.clutch || b.clutch.fert) return;
    game.fertilize(b.clutch.id, genes ?? game.kinTraits(this.kinIndex(1)));
    this.miltFx(b);
    bus.emit('notice', 'Gelege befruchtet', 'Deine Linie geht weiter.');
  }

  // ---------------------------------------------------------------- Männchen

  /** Ein Weibchen deiner Art kommt und legt ein Gelege – nicht weit vor dir am Grund. */
  private callFemale(time: number) {
    const h = this.host, p = h.player;
    this.femaleAt = time + SPAWN.femaleEvery * 1000;
    const re = h.L.riverEnd ?? h.L.width;
    const dir = p.facing || 1;
    const x = clamp(p.x + dir * (170 + Math.random() * 110), 200, re - 140);
    const gy = this.groundY(x);
    const v = h.cameras.main.worldView;
    const k = h.spawnKinAt(this.kinIndex(2), Math.min(h.L.width - 80, v.right + 140), Math.max(h.surfaceY + 80, gy - 160));
    k.homeDir = 1;
    this.female = k;
    k.task = {
      x,
      y: gy - 40,
      stay: 1.5,
      t: 0,
      done: () => {
        if (k.dead) return;
        const b = this.addBrood(Math.round(x), Math.round(gy + 6), Date.now(), { mother: k.genes });
        this.layFx(b, x, gy - 40);
        // sie bleibt noch eine Weile in der Nähe, dann zieht sie ins Meer
        k.task = {
          x: x + 80,
          y: gy - 100,
          stay: 25,
          t: 0,
          done: () => {
            k.dismiss();
            if (this.female === k) this.female = undefined;
          },
        };
      },
    };
  }

  /** Als Männchen ein Gelege befruchten: Es wird zu deinem – daraus schlüpft deine nächste Generation. */
  private fertilizeAsMale(b: Brood) {
    const h = this.host, p = h.player;
    p.satiety = Math.max(0.01, p.satiety - p.maxSat * SPAWN.costMale);
    game.markSpawn();
    b.clutch = game.addClutch({ place: h.place.id, x: b.x, y: b.y, at: b.at, fert: true, role: 'father', partner: b.mother });
    b.mother = undefined;
    this.miltFx(b);
    bus.emit('notice', 'Gelege befruchtet', 'Deine Linie geht weiter.');
  }

  // ---------------------------------------------------------------- Gelege

  private addBrood(x: number, y: number, at: number, o: { clutch?: Clutch; mother?: Genes }): Brood {
    const h = this.host;
    const roe = new Roe(h, x, y, 'own', 1, SPAWN.eggs, true);
    roe.spared = true;
    // vor dem Boden (auch am Hang ganz zu sehen), hinter allen Tieren
    roe.img.setDepth(DEPTH.terrain + 1);
    h.roes.push(roe);
    const b: Brood = { roe, x, y, at, ...o };
    this.broods.push(b);
    if (b.clutch?.fert) this.glow(b);
    return b;
  }

  /** Befruchtet: Das Gelege schimmert warm. */
  private glow(b: Brood) {
    if (b.glow) return;
    const g = this.host.add.image(b.x, b.y - 14, 'glow').setTint(0xffe2a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 80).setAlpha(0.22).setDepth(DEPTH.terrain + 0.5);
    this.host.tweens.add({ targets: g, alpha: 0.5, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    b.glow = g;
  }

  private layFx(b: Brood, x: number, y: number) {
    const h = this.host;
    b.roe.img.setScale(0.2);
    h.tweens.add({ targets: b.roe.img, scale: 1, duration: 700, ease: 'Back.out' });
    h.puff(x, y + 10, 10, 0xf4f0e0);
    h.glitter(b.x, b.y - 20, 6);
    audio.sfx('laich');
  }

  /** Die Milch des Männchens: eine helle Wolke über dem Gelege. */
  private miltFx(b: Brood) {
    const h = this.host;
    h.puff(b.x, b.y - 30, 16, 0xf6f6f0);
    h.glitter(b.x, b.y - 24, 8);
    audio.sfx('bond');
    this.glow(b);
  }

  /** Unbefruchtete Gelege verderben nach einer Weile. */
  private decay() {
    const now = Date.now();
    game.decayClutches(now);
    const life = game.life.clutches;
    for (const b of [...this.broods]) {
      const gone = b.clutch ? !life.includes(b.clutch) : now - b.at > SPAWN.decay * 1000;
      if (!gone) continue;
      this.broods = this.broods.filter((x) => x !== b);
      b.roe.vanish();
      b.glow?.destroy();
      if (b.clutch) bus.emit('notice', 'Gelege verdorben', 'Es wurde nicht befruchtet.');
    }
  }

  /** Ein Artgenosse des gewünschten Geschlechts (Männchen 1, Weibchen 2). */
  private kinIndex(sex: Sex) {
    const id = game.run?.id ?? 0;
    let i = this.nextKin++;
    if (((i + id) % 2 ? 1 : 2) !== sex) i = this.nextKin++;
    return i;
  }

  /**
   * Der Ort wird verlassen: Ein Männchen, das schon unterwegs war, findet dein Gelege trotzdem – es wird befruchtet,
   * während du fort bist.
   */
  private shutdown() {
    for (const b of this.broods) if (b.clutch && !b.clutch.fert && b.maleCalled) this.fertilizeQuietly(b);
    for (const f of this.fry) f.v.destroy();
    this.fry = [];
    this.sign.destroy();
    bus.emit('spawnable', false);
  }

  private fertilizeQuietly(b: Brood) {
    if (!b.clutch || b.clutch.fert) return;
    game.fertilize(b.clutch.id, b.male?.genes ?? game.kinTraits(this.kinIndex(1)));
  }
}
