import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { audio } from '../audio/Audio';
import { SPAWN } from '../data/life';
import { bus, game, upGain, type Clutch, type RoeEgg, type Sex, type Traits } from '../state/GameState';
import { isAdult, spawnBlock, worldNow, youngOf, type SpawnBlock } from '../sim/life';
import { clamp } from '../util/math';
import { CreatureView } from './CreatureView';
import { Roe } from './Food';
import type { Kin } from './Kin';
import { Prompt } from './Quest';
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
  /** darin liegt ein goldenes Ei: ein goldener Schimmer und aufsteigende Funken */
  gold?: Phaser.GameObjects.Image;
  sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** befruchtbar und du bist bereit: Das Gelege schimmert warm (stärker, wenn du nah genug bist) */
  mark?: Phaser.GameObjects.Image;
  /** Laich der Artgenossen, der zum Ort gehört (im Startgebiet): verdirbt nicht */
  lasting?: boolean;
}

const rnd = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/** so färbt sich ein Gelege mit einem goldenen Ei */
const GOLD_TINT = 0xffd468;

/**
 * Laichen im Laichfluss (dem Startort, flussaufwärts der Mündung) – sobald das eigene Tier ausgewachsen ist (Laichzeit) und
 * genug für wenigstens einen Nachkommen gefressen hat (siehe data/life.ts, SPAWN). Jedes Laichen macht aus der gesammelten
 * Nahrung Nachwuchs; wer später wieder genug gefressen hat, laicht noch einmal – die Nachkommen zählen zusammen. Gelaicht
 * wird mit derselben Taste wie gefressen (E): Zur Laichzeit frisst man Laich der eigenen Art nicht, man befruchtet ihn –
 * Laich deiner Art ist ohnehin nie Futter.
 *   – Männchen befruchten Laich ihrer Art: Im Startgebiet liegt er schon (die Artgenossen laichen dort), sonst kommt ein
 *     Weibchen und legt in deiner Nähe. Zur Laichzeit schimmert befruchtbarer Laich warm – nah genug, schimmert er stärker.
 *   – Weibchen legen ihren Laich dicht am Grund ab; kurz darauf kommt ein Männchen deiner Art und befruchtet ihn.
 * Sobald ein Gelege befruchtet ist, liegen seine Eier auf dem Stapel der nächsten Generation (GameState.layEggs) – mit den
 * Werten, die dein Tier jetzt, zur Laichzeit, weitergibt. Stirbt es, wählt man ein Ei (RoeScene).
 * Wird das Tier ausgewachsen, steht einmal kurz oben im Bild unter der Lebenslinie, dass Laichzeit ist und was noch fehlt
 * (Ereignis 'spawnHint') – dann geht es wieder weg; danach zeigt nur noch das Zeichen „E“, wann es geht.
 */
export class SpawnCtl {
  private broods: Brood[] = [];
  private able = false;
  /** Männchen: der befruchtbare Laich in Reichweite */
  private target?: Brood;
  private t = 0;
  /** war das Tier schon ausgewachsen, als man zuletzt nachsah (nur beim Erwachsenwerden kommt der Hinweis) */
  private wasAdult?: boolean;
  /** Weibchen, bereit: ein warmer Schimmer am Grund unter ihr */
  private nest?: Phaser.GameObjects.Image;
  /** Das Zeichen der Aktionstaste öffnet beim Laich die Eiübersicht. */
  private prompt: Prompt;
  private touchMode: boolean;
  /** frühestens dann legt ein Weibchen deiner Art (wenn du als Männchen bereit bist) */
  private femaleAt = 0;
  private female?: Kin;
  private nextKin = 900;
  /** frisch geschlüpfte Geschwister (nur zum Ansehen): Sie schwärmen in alle Richtungen aus */
  private fry: { v: CreatureView; vx: number; vy: number; t: number }[] = [];
  /** was gerade noch fehlt (für die Anzeige der Laichzeit) */
  block: SpawnBlock | null = 'jung';
  /** so viel Nahrung braucht ein Nachkomme (gilt das ganze Leben – das Tier verändert sich darin nicht) */
  readonly base = game.broodBase;

  constructor(private host: LevelScene) {
    this.touchMode = host.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.prompt = new Prompt(host, this.touchMode, 'bite');
    this.femaleAt = host.time.now + rnd(SPAWN.femaleDelay) * 1000;
    // die eigenen Gelege an diesem Ort – ein noch unbefruchtetes bekommt (wieder) Besuch von einem Männchen
    game.decayClutches();
    for (const c of game.life.clutches) if (c.place === host.place.id) this.addBrood(c.x, c.y, c.at, { clutch: c });
    // der Laich deiner Art, der hier schon liegt (im Startgebiet): befruchtbar – wo schon dein eigenes Gelege liegt, nicht
    for (const roe of host.roes) {
      if (!roe.own || roe.hatched || this.broods.some((b) => b.roe === roe)) continue;
      roe.spared = true;
      roe.img.setDepth(DEPTH.terrain + 1);
      if (this.broods.some((b) => b.clutch && Math.abs(b.x - roe.x) < 60)) {
        roe.vanish();
        continue;
      }
      this.broods.push({ roe, x: roe.x, y: roe.y, at: worldNow(), mother: game.kinTraits(this.kinIndex(2)), lasting: true });
    }
    // Der Laichgrund bleibt auch ohne Nahrung, Partnerbesuch oder verfügbare Eier zugänglich.
    if (host.place.kind === 'start' && !this.broods.length) {
      const x = Math.max(100, (host.L.riverEnd ?? host.L.width * 0.25) * 0.45);
      const b = this.addBrood(x, this.groundY(x) - 12, worldNow(), { mother: game.kinTraits(this.kinIndex(2)) });
      b.lasting = true;
    }
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
    this.t += dt;
    this.fryStep(dt);
    // das Leben ist zu Ende (oder ein neues hat schon begonnen): hier geschieht nichts mehr
    if (h.ended) {
      this.setAble(false);
      this.marks(false);
      this.prompt.update(dt, p.x, p.y, false);
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
      this.setAble(false);
      this.marks(false);
      this.prompt.update(dt, p.x, p.y, false);
      return;
    }
    const life = game.life;
    const male = run.sex === 1;
    // Männchen: der nächste befruchtbare Laich in Reichweite
    this.target = undefined;
    if (male) {
      let best = SPAWN.reach;
      for (const b of this.broods) {
        const d = Math.hypot(b.x - p.x, b.y - 20 - p.y);
        if ((b.mother || b.clutch || b.lasting) && d < best) {
          best = d;
          this.target = b;
        }
      }
    }
    const atGround = male ? !!this.target : this.groundY(p.x) - p.y < SPAWN.ground;
    this.block = spawnBlock({ age: life.age, gen: life.gen, fed: life.fed, base: this.base, young: game.young, lastSpawn: life.lastSpawn, inGrounds: this.grounds, atGround, male });
    this.setAble(!!this.target);
    // Der dauerhafte Laich ist jederzeit erkennbar; erst die Übersicht prüft die Voraussetzungen zum Befruchten.
    // ein Weibchen vor etwas Fressbarem frisst mit E (act) – dann sagt die Zeile das auch
    const eats = !male && this.block === null && this.host.foodAhead();
    this.marks(male);
    this.nestHint(!male && this.block === null && !eats);
    this.tell(male, eats);
    // jetzt geht es: das Zeichen „E“ über dem Laich (Männchen) bzw. über dem Weibchen am Grund
    const t = this.target;
    if (male && t) this.prompt.update(dt, t.x, t.y - 4, true);
    else this.prompt.update(dt, p.x, p.y + 20, !male && this.block === null && !eats);
    // Ein Weibchen deiner Art laicht, wenn du als Männchen bereit im Laichfluss bist (und kein Laich mehr da ist)
    const ready = male && isAdult(life.age, life.gen) && this.grounds && youngOf(life.fed, this.base) >= 1 && game.young < SPAWN.maxYoung
      && life.age - life.lastSpawn >= SPAWN.cooldown;
    if (ready && !this.female && !this.broods.some((b) => b.mother) && time > this.femaleAt) this.callFemale(time);
  }

  /** Am dauerhaften Laich ansehen, unabhängig von Alter und Nahrung. */
  visit(): boolean {
    if (this.host.ended || this.host.player.dead || !this.target) return false;
    this.host.openRoe();
    return true;
  }

  get offer(): { count: number; reason: string } {
    const life = game.life;
    const block = spawnBlock({ age: life.age, gen: life.gen, fed: life.fed, base: this.base, young: game.young,
      lastSpawn: life.lastSpawn, inGrounds: this.grounds, atGround: !!this.target, male: true });
    const reason: Record<SpawnBlock, string> = {
      jung: 'Ab der Laichzeit kannst du neue Eier befruchten.',
      nahrung: `Noch ${Math.max(1, Math.ceil(this.base - life.fed))} Nahrung für das nächste Ei.`,
      voll: `Bereits ${SPAWN.maxYoung} Nachkommen in diesem Leben befruchtet.`,
      pause: 'Schwimme eine Weile weiter, bevor du erneut befruchtest.',
      ort: 'Befruchten ist im Laichfluss möglich.',
      grund: 'Schwimme näher an den Laich.', gelege: 'Schwimme näher an den Laich.',
    };
    return { count: block ? 0 : Math.min(youngOf(life.fed, this.base), SPAWN.maxYoung - game.young), reason: block ? reason[block] : '' };
  }

  /** Der eigene Knopf in der Eiübersicht: erst hier wird Nahrung zu neuen Nachkommen. */
  fertilize(): number {
    if (!this.target || this.host.ended || this.host.player.dead || !this.offer.count) return 0;
    const n = this.offer.count;
    this.fertilizeAsMale(this.target);
    return n;
  }

  /**
   * E gedrückt: Laichen, wenn es jetzt geht (sonst beißt bzw. frisst man wie immer). food: Vor dem Maul liegt etwas zu
   * fressen – ein Weibchen frisst dann, statt abzulegen.
   */
  act(food: boolean): boolean {
    if (this.block !== null || this.host.ended) return false;
    if (this.target) {
      this.fertilizeAsMale(this.target);
      return true;
    }
    if (game.run?.sex === 1 || food) return false;
    this.lay();
    return true;
  }

  /**
   * Was oben im Bild unter der Lebenslinie steht – leise und kurz: dass Laichzeit ist und, wenn nötig, wohin. Was genau fehlt
   * (wie viel Nahrung noch), steht nur in der Übersicht (C). Wer schon gelaicht hat und gerade nicht kann, sieht nichts.
   */
  private tell(male: boolean, eats = false) {
    const life = game.life;
    const adult = isAdult(life.age, life.gen);
    // nur in dem Moment, in dem das Tier ausgewachsen ist (nicht, wer schon ausgewachsen hierher kam)
    const now = adult && this.wasAdult === false;
    this.wasAdult = adult;
    if (!now) return;
    let msg = '';
    {
      const b = this.block;
      msg = b === null ? (male || !eats ? 'Laichzeit' : 'Laichzeit · ein Stück weiter')
        : b === 'gelege' ? 'Laichzeit'
        : b === 'grund' ? 'Laichzeit · am Grund'
        : b === 'ort' ? 'Laichzeit · im Laichfluss'
        : b === 'nahrung' ? `Laichzeit · noch ${Math.max(1, Math.ceil(this.base - life.fed))} Nahrung`
        : '';
    }
    bus.emit('spawnHint', msg || 'Laichzeit');
  }

  /** Befruchtbarer Laich schimmert warm, solange Laichzeit ist – der in Reichweite stärker. */
  private marks(on: boolean) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.6);
    for (const b of this.broods) {
      const show = on && !!(b.mother || b.clutch || b.lasting);
      if (!show) {
        if (b.mark?.visible) {
          b.mark.setVisible(false);
          if (b.gold) b.roe.img.setTint(GOLD_TINT);
          else b.roe.img.clearTint();
        }
        continue;
      }
      b.mark ??= this.host.add.image(b.x, b.y - 16, 'glow').setTint(0xffc870).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 70).setDepth(DEPTH.terrain + 0.5);
      const near = b === this.target;
      b.mark.setVisible(true).setAlpha((near ? 0.42 : 0.2) + (near ? 0.25 : 0.12) * pulse);
      b.roe.img.setTint(near ? 0xffd890 : 0xffe4b8);
    }
  }

  /** Weibchen, bereit: ein leiser, warmer Schimmer am Grund unter ihr. */
  private nestHint(on: boolean) {
    const p = this.host.player;
    if (!on) {
      this.nest?.setVisible(false);
      return;
    }
    this.nest ??= this.host.add.image(p.x, p.y, 'glow').setTint(0xffc870).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(110, 40).setDepth(DEPTH.terrain + 0.5);
    this.nest.setVisible(true).setPosition(p.x, this.groundY(p.x) - 4).setAlpha(0.22 + 0.12 * Math.sin(this.t * 2.6));
  }

  private setAble(v: boolean) {
    if (v === this.able) return;
    this.able = v;
    bus.emit('spawnable', v);
  }

  // ---------------------------------------------------------------- Weibchen

  /** Ein Gelege ablegen – am Grund, genau unter dir. */
  private lay() {
    const h = this.host, p = h.player;
    const y = Math.round(this.groundY(p.x) + 6);
    const young = game.takeYoung();
    game.markSpawn();
    const c = game.addClutch({ place: h.place.id, x: Math.round(p.x), y, at: worldNow(), fert: false, role: 'mother', young });
    const b = this.addBrood(c.x, c.y, c.at, { clutch: c });
    this.layFx(b, p.x, p.y);
    bus.emit('notice', 'Laichen', 'Gelege abgelegt');
    this.callMale(b, rnd(SPAWN.maleDelay));
  }

  /** Ein Männchen deiner Art kommt vom Meer herauf und befruchtet dein Gelege. */
  private callMale(b: Brood, delay: number) {
    const h = this.host;
    if (b.maleCalled) return;
    b.maleCalled = true;
    if (b.clutch) game.maleCalled(b.clutch.id);
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
          if (k.dead || !b.clutch || h.ended || !this.broods.includes(b)) return;
          this.fertilizeOwn(b, k.genes);
          k.dismiss();
        },
      };
    });
  }

  private fertilizeOwn(b: Brood, genes?: Genes) {
    if (!b.clutch || b.clutch.fert) return;
    const partner = genes ?? game.kinTraits(this.kinIndex(1));
    game.fertilize(b.clutch.id, partner);
    const eggs = game.layEggs(b.clutch, this.host.heirNow(partner));
    this.miltFx(b);
    this.told(b, eggs);
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
        const b = this.addBrood(Math.round(x), Math.round(gy + 6), worldNow(), { mother: k.genes });
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
    const h = this.host;
    const young = game.takeYoung();
    game.markSpawn();
    const partner = b.mother ?? game.kinTraits(this.kinIndex(2));
    b.clutch = game.addClutch({ place: h.place.id, x: b.x, y: b.y, at: b.at, fert: true, role: 'father', partner, young });
    b.mother = partner;
    b.lasting = true;
    // die Eier kommen auf den Stapel der nächsten Generation – so, wie dein Tier jetzt ist
    const eggs = game.layEggs(b.clutch, h.heirNow(partner));
    this.miltFx(b);
    this.told(b, eggs);
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
    if (b.clutch?.gold) this.goldFx(b, false);
    return b;
  }

  /** Befruchtet: Wie viele Eier im Laich liegen – und leuchtet eines golden, sieht und hört man es. */
  private told(b: Brood, eggs: RoeEgg[]) {
    const n = eggs.length, gold = eggs.filter((e) => e.gold);
    if (!gold.length) {
      bus.emit('notice', 'Laichen', `${n} ${n === 1 ? 'neues Ei' : 'neue Eier'} befruchtet · insgesamt ${game.young} Nachkommen`);
      return;
    }
    this.goldFx(b, true);
    bus.emit('notice', 'GOLDENE GEBURT', `Ein Ei leuchtet golden · ${upGain(gold[0].gold!)}${gold.length > 1 ? ` (und ${gold.length - 1} weiteres)` : ''}`);
  }

  /** Ein goldenes Ei im Gelege: ein goldener Schimmer, der atmet (frisch gelegt: ein Funkeln und ein heller Klang). */
  private goldFx(b: Brood, fresh: boolean) {
    const h = this.host;
    if (!b.gold) {
      const g = h.add.image(b.x, b.y - 18, 'glow').setTint(0xffb830).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(190, 120).setAlpha(0.75).setDepth(DEPTH.terrain + 1.5);
      h.tweens.add({ targets: g, alpha: 0.35, scaleX: g.scaleX * 0.84, scaleY: g.scaleY * 0.84, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.inOut' });
      b.gold = g;
      b.roe.img.setTint(GOLD_TINT);
      // goldene Funken steigen vom Gelege auf
      b.sparks = h.add.particles(b.x, b.y - 14, 'p_dot', {
        x: { min: -26, max: 26 }, lifespan: 1800, frequency: 140, speedY: { min: -38, max: -12 }, speedX: { min: -8, max: 8 },
        scale: { start: 0.42, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffc040], blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.terrain + 1.6);
    }
    if (!fresh) return;
    h.glitter(b.x, b.y - 22, 22);
    h.cameras.main.flash(260, 255, 220, 140);
    audio.sfx('shell');
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
    const now = worldNow();
    game.decayClutches(now);
    const life = game.life.clutches;
    for (const b of [...this.broods]) {
      const gone = b.clutch ? !life.includes(b.clutch) : !b.lasting && now - b.at > SPAWN.decay * 1000;
      if (!gone) continue;
      this.broods = this.broods.filter((x) => x !== b);
      b.roe.vanish();
      b.glow?.destroy();
      b.gold?.destroy();
      b.sparks?.destroy();
      b.mark?.destroy();
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
   * Was unterwegs ist, kommt an: Jedes eigene Gelege, zu dem schon ein Männchen gerufen wurde, gilt als befruchtet – wenn
   * du den Ort verlässt und bevor eine neue Generation schlüpft (auch wenn dein Tier stirbt, bevor er da ist).
   */
  settle() {
    for (const c of game.life.clutches) {
      if (!c.called || c.fert) continue;
      const b = this.broods.find((x) => x.clutch === c);
      const partner = b?.male?.genes ?? game.kinTraits(this.kinIndex(1));
      game.fertilize(c.id, partner);
      game.layEggs(c, this.host.heirNow(partner));
    }
  }

  /** Der Ort wird verlassen: Ein Männchen, das schon unterwegs war, findet dein Gelege trotzdem. */
  private shutdown() {
    this.settle();
    for (const f of this.fry) f.v.destroy();
    this.fry = [];
    bus.emit('spawnable', false);
  }

}
