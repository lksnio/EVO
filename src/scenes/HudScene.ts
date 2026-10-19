import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import type { LevelScene } from './LevelScene';
import type { Kin } from '../objects/Kin';
import type { SwarmInfo } from '../objects/Swarm';
import { EPOCHS, yearsAgo, type EpochDef } from '../data/epochs';
import { WORLD } from '../data/life';
import { phases, worldYears } from '../sim/life';
import { CLASSES } from '../data/classes';
import { STAT_COUNT } from '../data/tablet';
import { SPECIES } from '../data/species';
import { tapped, touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, controlsList, panel, soundButton, text, title } from '../ui/ui';
import { TabletScreen } from '../ui/tabletScreen';
import { netInfo } from '../net/NetSync';

/**
 * Die Anzeige im Level: oben die Zeit (Zeitalter und Jahresangabe), sonst kaum etwas. Hunger steht nur auf der Steintafel (Taste C).
 * Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand, am Herzschlag und am Tier.
 */
export class HudScene extends Phaser.Scene {
  private ep!: EpochDef;
  private placeName = '';
  private hurtV!: Phaser.GameObjects.Image;
  private edgeV!: Phaser.GameObjects.Image;
  private hungerV!: Phaser.GameObjects.Image;
  private hideV!: Phaser.GameObjects.Image;
  /** Neuer Aquapendium-Eintrag (oder eine Meldung zum Leben): ein schmales Schild oben links, das sanft einblendet */
  private dexC!: Phaser.GameObjects.Container;
  private dexGlow!: Phaser.GameObjects.Image;
  private dexQueue: { head: string; name: string }[] = [];
  /** gerade läuft ein Kino-Moment (schwarze Balken) */
  private cineOn = false;
  private dexBusy = false;
  private hp = 1;
  private food = 1;
  private hidden = false;
  private hurtA = 0;
  private hungerA = 0;
  private hideA = 0;
  private pulse = 0;
  private beatAt = 0;
  private pauseC?: Phaser.GameObjects.Container;
  private pauseNav?: MenuNav;
  private portrait?: CreatureView;
  private giveUp?: Button;
  private giveUpArmed = false;
  private isTouch = false;
  private ramBtn = false;
  private bossC!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossShown = false;
  private tabletView?: TabletScreen;
  private tabletGlow?: Phaser.GameObjects.Image;
  private clockText!: Phaser.GameObjects.Text;
  private fuse!: Phaser.GameObjects.Graphics;
  /** Lebenslinie: wie weit das Leben des eigenen Tiers ist (0 … 1), ob es ausgewachsen ist und ob ein Nachkomme wartet */
  private lifeFrac = 0;
  private heir = false;
  /** Antwort im Gespräch (ja oder nein) */
  private choiceC?: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  init(d: { epoch: number; place?: string }) {
    this.ep = EPOCHS[d?.epoch ?? 0];
    this.placeName = d?.place ?? this.ep.place;
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    this.giveUpArmed = false;
    this.ramBtn = false;
    this.tabletView = undefined;
    this.tabletGlow = undefined;
    this.bossShown = false;
    this.hp = 1;
    this.food = 1;
    this.hidden = false;
    this.hurtA = this.hungerA = this.hideA = this.pulse = 0;
    this.lifeFrac = 0;
    this.heir = false;
    this.beatAt = 0;
  }

  create() {
    const ep = this.ep;

    // Bildränder: Hunger (dunkel), Verletzung (rot), Versteck (grünlich-dunkel)
    this.hungerV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0);
    this.hideV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x0c1a0a).setAlpha(0);
    this.hurtV = this.add.image(W / 2, H / 2, 'vignette_red').setDisplaySize(W, H).setAlpha(0);
    this.edgeV = this.add.image(W / 2, H / 2, 'edge_red').setDisplaySize(W, H).setAlpha(0);

    // Lebensbalken des Endgegners (unten)
    this.bossC = this.add.container(W / 2, H - 46).setAlpha(0).setDepth(8);
    this.bossName = title(this, 0, -18, '', 22, '#d8b070').setOrigin(0.5);
    this.bossBar = this.add.graphics();
    this.bossC.add([this.bossBar, this.bossName]);
    // Die Weltzeit (für alle gleich): Name der Zeit, Jahresangabe – darunter die Lebenslinie des eigenen Tiers
    const clockBg = this.add.graphics();
    clockBg.fillStyle(0x050403, 0.55);
    clockBg.fillRoundedRect(W / 2 - 200, 8, 400, 70, 12);
    title(this, W / 2, 26, ep.name.toUpperCase(), 18, UI.ochre).setOrigin(0.5).setLetterSpacing(3);
    this.clockText = text(this, W / 2, 50, yearsAgo(worldYears(ep.from, ep.to), WORLD.yearsPerSecond * 60), 21, UI.bone).setOrigin(0.5);
    this.fuse = this.add.graphics();
    this.spawnTimeUi();
    this.lifeFrac = game.run ? game.life.age / phases(game.life.gen).span : 0;
    this.drawFuse();
    // Ein neues Tier im Aquapendium: ein kleines Schild oben links
    this.dexQueue = [];
    this.cineOn = false;
    this.dexBusy = false;
    this.dexC = this.add.container(22, 22).setAlpha(0).setDepth(7);
    this.dexGlow = this.add.image(0, 0, 'glow').setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 120).setAlpha(0).setDepth(6);

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    // Die Steintafel: Dort steht der Hunger. Leuchtet, wenn sie etwas Neues zeigt.
    this.tabletGlow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0);
    new Button(this, W - 156, 38, 'C', { w: 50, h: 50, onClick: () => this.toggleTablet() }).setAlpha(0.75);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);
    this.updateGlow();
    this.swarmUi();
    this.netUi();
    this.questUi();
    this.choiceUi();

    // Beim Betreten eines Ortes: nur sein Name, sanft ein- und wieder ausgeblendet
    const head = title(this, W / 2, H / 2 - 90, this.placeName, 46).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 1, duration: 900, hold: 2200, yoyo: true });

    const run = game.run;
    if (run?.ramNew) {
      run.ramNew = false;
      this.time.delayedCall(5200, () => this.ramUnlocked());
    }

    const isTouch = (this.isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch'));
    if (isTouch) this.touchControls(ep.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.tabletView ? this.toggleTablet() : this.togglePause()));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-C', () => this.toggleTablet());

    const onVitals = (hp: number, food: number, hidden: boolean) => {
      this.hp = hp;
      this.food = food;
      this.hidden = hidden;
    };
    const onClock = (years: number, step: number) => {
      const t = yearsAgo(years, step);
      if (t !== this.clockText.text) this.clockText.setText(t);
    };
    const onLife = (frac: number, _stage: string, heir: boolean) => {
      if (Math.abs(frac - this.lifeFrac) > 0.0015 || heir !== this.heir) {
        this.lifeFrac = frac;
        this.heir = heir;
        this.drawFuse();
      }
    };
    const onNotice = (head: string, name: string) => {
      this.dexQueue.push({ head, name });
      this.nextDex();
    };
    const onRam = () => this.ramUnlocked();
    const onBoss = (name: string, f: number) => this.drawBoss(name, f);
    const onShell = () => this.updateGlow();
    const onDex = (ids: string[]) => {
      for (const id of ids) if (SPECIES[id]) this.dexQueue.push({ head: 'NEUER AQUAPENDIUM-EINTRAG', name: SPECIES[id].name });
      this.nextDex();
    };
    bus.on('dex', onDex);
    bus.on('clock', onClock);
    bus.on('life', onLife);
    bus.on('notice', onNotice);
    bus.on('boss', onBoss);
    bus.on('vitals', onVitals);
    bus.on('ramUnlocked', onRam);
    bus.on('shell', onShell);
    // Kino-Moment: schwarze Balken oben und unten
    const barH = 64;
    const bars = [this.add.rectangle(0, -barH, W, barH, 0x000000, 1).setOrigin(0).setDepth(50), this.add.rectangle(0, H, W, barH, 0x000000, 1).setOrigin(0).setDepth(50)];
    const onCine = (on: boolean) => {
      this.cineOn = on;
      this.tweens.add({ targets: bars[0], y: on ? 0 : -barH, duration: 900, ease: 'Sine.inOut' });
      this.tweens.add({ targets: bars[1], y: on ? H - barH : H, duration: 900, ease: 'Sine.inOut' });
      // neue Aquapendium-Einträge warten, bis die Balken wieder weg sind
      if (!on) this.time.delayedCall(900, () => this.nextDex());
    };
    bus.on('cine', onCine);
    this.events.once('shutdown', () => {
      bus.off('cine', onCine);
      bus.off('vitals', onVitals);
      bus.off('ramUnlocked', onRam);
      bus.off('boss', onBoss);
      bus.off('clock', onClock);
      bus.off('life', onLife);
      bus.off('notice', onNotice);
      bus.off('dex', onDex);
      bus.off('shell', onShell);
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
    });
  }

  /**
   * Die Lebenslinie: Wie weit das Leben des eigenen Tiers ist – erst das Heranwachsen (kühl), dann die besten Jahre (Ocker),
   * am Ende das Alter (rostrot). Der Punkt zeigt, wo es gerade steht; er leuchtet warm, sobald ein befruchtetes Gelege wartet.
   */
  private drawFuse() {
    const g = this.fuse;
    const x0 = W / 2 - 170, w = 340, y = 70;
    const P = phases(game.run ? game.life.gen : 1);
    const m = P.mature / P.span, o = P.old / P.span;
    const f = Math.min(1, Math.max(0, this.lifeFrac));
    g.clear();
    g.fillStyle(0x2a2420, 1);
    g.fillRect(x0, y, w, 3);
    const seg = (a: number, b: number, c: number) => {
      const e = Math.min(b, f);
      if (e > a) {
        g.fillStyle(c, 0.9);
        g.fillRect(x0 + w * a, y, w * (e - a), 3);
      }
    };
    seg(0, m, 0x6fa8a0);
    seg(m, o, 0xc8913c);
    seg(o, 1, 0xa4503a);
    // Marken: ausgewachsen, alt
    g.fillStyle(0x8a7a60, 0.8);
    g.fillRect(x0 + w * m - 0.5, y - 2, 1, 7);
    g.fillRect(x0 + w * o - 0.5, y - 2, 1, 7);
    if (this.heir) {
      g.fillStyle(0xffe2a0, 0.35);
      g.fillCircle(x0 + w * f, y + 1.5, 7);
    }
    g.fillStyle(this.heir ? 0xfff0c0 : 0xffe0a0, 1);
    g.fillCircle(x0 + w * f, y + 1.5, 3);
  }

  /**
   * Laichzeit: unter der Lebenslinie, klein und warm – dass es Zeit ist und was noch fehlt (zurück in den Laichfluss, zum
   * schimmernden Laich …). Geht es gerade, schimmert die Zeile; ist ein Gelege befruchtet, verblasst sie nach einer Weile.
   */
  private spawnTimeUi() {
    const t = text(this, W / 2, 86, '', 16, UI.ochre, { stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setAlpha(0);
    const show = (msg: string, now: boolean) => {
      this.tweens.killTweensOf(t);
      if (!msg) {
        this.tweens.add({ targets: t, alpha: 0, duration: 500 });
        return;
      }
      t.setText(msg).setColor(now ? '#f0c878' : UI.ochre);
      this.tweens.add({ targets: t, alpha: 0.9, duration: 500 });
      if (now) this.tweens.add({ targets: t, alpha: 0.55, yoyo: true, repeat: -1, duration: 900, delay: 500, ease: 'Sine.inOut' });
      if (msg.startsWith('Gelege befruchtet')) this.tweens.add({ targets: t, alpha: 0, delay: 7000, duration: 1500 });
    };
    bus.on('spawnTime', show);
    this.events.once('shutdown', () => bus.off('spawnTime', show));
  }

  /** Der Knopf der Steintafel leuchtet, solange es dort etwas Neues zu sehen gibt. */
  private updateGlow() {
    const g = this.tabletGlow;
    if (!g) return;
    const fresh = Math.min(STAT_COUNT, game.shells.length) > game.seenRows;
    this.tweens.killTweensOf(g);
    if (!fresh) {
      g.setAlpha(0);
      return;
    }
    g.setAlpha(0.1);
    this.tweens.add({ targets: g, alpha: 0.32, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
  }

  /**
   * Mehrspieler: unter den Knöpfen oben rechts, klein – wie viele andere Spieler an diesem Ort sind (oder dass die
   * Verbindung gerade weg ist). Wer allein ohne Server spielt, sieht nichts.
   */
  private netUi() {
    const t = text(this, W - 20, 74, '', 15, UI.boneDim, { stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0).setAlpha(0);
    const show = (state: string, n: number) => {
      this.tweens.killTweensOf(t);
      if (state === 'offline') return t.setAlpha(0);
      // dazu, wie lange eine Nachricht zum Server und zurück braucht (ab 150 ms merkt man es)
      const ms = netInfo.ping ? ` · ${Math.round(netInfo.ping)} ms` : '';
      const msg =
        state === 'online' ? (n ? `● ${n === 1 ? 'ein weiterer Spieler' : `${n} weitere Spieler`} hier${ms}` : `● online – allein hier${ms}`)
        : state === 'unterbrochen' ? '○ Verbindung unterbrochen …'
        : '○ getrennt – es geht allein weiter';
      t.setText(msg).setColor(state === 'online' && netInfo.ping < 150 ? UI.boneDim : UI.ochre).setAlpha(0.85);
      if (state === 'getrennt') this.tweens.add({ targets: t, alpha: 0, delay: 6000, duration: 1200 });
    };
    const onPing = () => netInfo.state === 'online' && show(netInfo.state, netInfo.others);
    show(netInfo.state, netInfo.others);
    bus.on('net', show);
    bus.on('ping', onPing);
    this.events.once('shutdown', () => {
      bus.off('net', show);
      bus.off('ping', onPing);
    });
  }

  /**
   * Der Knopf für deine Gruppe (links neben der Steintafel, Taste S): erst sichtbar, wenn sie auf deinen Ruf kommt.
   * Die Zahl zeigt, wie viele leben; solange sie bei dir sind, leuchtet er. Gleich nach dem Fortschicken ist er kurz matt.
   */
  private swarmUi() {
    const x = W - 214, y = 38;
    const glow = this.add.image(x, y, 'glow').setTint(0xbfe6ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 120).setAlpha(0);
    const btn = new Button(this, x, y, '', {
      w: 50,
      h: 50,
      icon: 'ic_swarm',
      iconOnly: true,
      sound: null,
      onClick: () => {
        // wie ein kurzer Tastendruck: Das Level liest ihn im nächsten Bild (Controls)
        touch.call = true;
        audio.unlock();
        this.time.delayedCall(200, () => (touch.call = false));
      },
    });
    const badge = text(this, x + 17, y + 15, '', 15, UI.bone, { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    let out = false;
    const show = (i: SwarmInfo) => {
      const vis = i.callable;
      btn.setVisible(vis);
      badge.setVisible(vis).setText(String(i.size));
      if (!vis) {
        this.tweens.killTweensOf(glow);
        glow.setAlpha(0);
        return;
      }
      btn.setAlpha(i.out || (i.ready && i.size > 0) ? 0.75 : 0.35);
      badge.setColor(i.size > 0 ? UI.bone : '#c8473a');
      if (i.out === out) return;
      out = i.out;
      this.tweens.killTweensOf(glow);
      glow.setAlpha(0);
      if (out) {
        glow.setAlpha(0.12);
        this.tweens.add({ targets: glow, alpha: 0.38, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.inOut' });
      }
    };
    const s = game.swarm;
    show({ callable: !!s?.callable, size: s?.members.length ?? 0, out: false, ready: true });
    bus.on('swarm', show);
    this.events.once('shutdown', () => bus.off('swarm', show));
  }

  /** Der laufende Auftrag: Titel, Ziel und Fortschritt in einem Schild oben links (wie die Aquapendium-Einträge). */
  private questUi() {
    const c = this.add.container(22, 100).setAlpha(0).setDepth(7);
    let shown = false;
    const show = (q: { title: string; lines: string[] } | null) => {
      this.tweens.killTweensOf(c);
      if (!q) {
        shown = false;
        this.tweens.add({ targets: c, alpha: 0, duration: 500, onComplete: () => c.removeAll(true) });
        return;
      }
      c.removeAll(true);
      const head = text(this, 18, 12, q.title.toUpperCase(), 12, UI.ochre, { fontStyle: '700' }).setOrigin(0, 0).setLetterSpacing(3);
      const rows = q.lines.map((l, i) => text(this, 18, 34 + i * 25, l, i === 0 ? 19 : 16, i === 0 ? UI.bone : UI.boneDim).setOrigin(0, 0));
      const w = Math.round(Math.max(280, 36 + Math.max(head.width, ...rows.map((r) => r.width)))), h = 44 + q.lines.length * 25;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(3, 5, w, h, 12);
      g.fillStyle(0x0d0c0b, 0.78);
      g.fillRoundedRect(0, 0, w, h, 12);
      g.lineStyle(1.5, 0xc8913c, 0.45);
      g.strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 12);
      c.add([g, head, ...rows]);
      if (!shown) {
        shown = true;
        c.setAlpha(0).setX(16);
        if (!this.cineOn) this.tweens.add({ targets: c, alpha: 1, x: 22, duration: 600, ease: 'Sine.out' });
      } else c.setAlpha(this.cineOn ? 0 : 1).setX(22);
    };
    // im Gespräch (Kino-Balken) tritt das Schild zurück
    const onCine = (on: boolean) => {
      if (!shown) return;
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, alpha: on ? 0 : 1, x: 22, duration: 500, delay: on ? 0 : 700 });
    };
    bus.on('questHud', show);
    bus.on('cine', onCine);
    this.events.once('shutdown', () => {
      bus.off('questHud', show);
      bus.off('cine', onCine);
    });
  }

  /** Eine Frage im Gespräch: zwei Antworten unten im Kino-Balken (Pfeiltasten wählen, F bestätigt – oder antippen). */
  private choiceUi() {
    const show = (opts: string[] | null, sel: number) => {
      if (!opts) {
        this.choiceC?.destroy();
        this.choiceC = undefined;
        return;
      }
      if (!this.choiceC) {
        const c = (this.choiceC = this.add.container(W / 2, H - 32).setDepth(55).setAlpha(0));
        opts.forEach((o, i) => {
          const b = new Button(this, (i - (opts.length - 1) / 2) * 300, 0, o, { w: 270, h: 44, size: 20, sound: null, onClick: () => bus.emit('choicePick', i) });
          c.add(b);
        });
        this.tweens.add({ targets: c, alpha: 1, duration: 300 });
      }
      this.choiceC.list.forEach((b, i) => (b as Button).setFocus(i === sel));
    };
    bus.on('choice', show);
    this.events.once('shutdown', () => {
      bus.off('choice', show);
      this.choiceC = undefined;
    });
  }

  /** Lebensbalken des Endgegners. */
  private drawBoss(name: string, f: number) {
    if (!this.bossShown && f > 0) {
      this.bossShown = true;
      this.tweens.add({ targets: this.bossC, alpha: 1, duration: 800 });
    }
    this.bossName.setText(name.toUpperCase());
    const g = this.bossBar;
    const w = 520;
    g.clear();
    g.fillStyle(0x050403, 0.7);
    g.fillRoundedRect(-w / 2 - 8, -4, w + 16, 22, 6);
    g.fillStyle(0x3a1410, 1);
    g.fillRect(-w / 2, 2, w, 10);
    g.fillStyle(0xb8321e, 1);
    g.fillRect(-w / 2, 2, w * f, 10);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(-w / 2, 2, w * f, 3);
    g.lineStyle(1.5, 0x8a6a40, 0.9);
    g.strokeRect(-w / 2 - 1, 1, w + 2, 12);
    if (f <= 0 && this.bossShown) this.tweens.add({ targets: this.bossC, alpha: 0, duration: 1200, delay: 1500 });
  }

  // ---------------------------------------------------------------- Steintafel (Taste C)

  toggleTablet() {
    if (this.tabletView) {
      this.tabletView.destroy();
      this.tabletView = undefined;
      this.updateGlow();
      if (!this.pauseC) this.scene.resume('Level');
      return;
    }
    const lvl = this.scene.get('Level') as unknown as LevelScene;
    if (this.pauseC || !lvl || lvl.ended || !game.run) return;
    audio.sfx('select');
    this.scene.pause('Level');
    const p = lvl.player;
    const kin = lvl.animals.filter((a) => a.kin && !a.dead) as unknown as Kin[];
    this.tabletView = new TabletScreen(
      this,
      {
        ctx: { cls: game.cls, traits: game.traits, hp: p.hp, sat: p.satiety, life: game.lifeK },
        morph: p.morph(),
        placeName: this.placeName,
        life: lvl.lifeStatus(),
        kin: kin.length,
        group: game.swarm?.members.length ?? 0,
      },
      () => this.toggleTablet(),
    );
  }

  /**
   * Ein neuer Eintrag im Aquapendium: Ein schmales Schild gleitet oben links herein – dunkle Fläche, feine ochrefarbene Linien,
   * links eine kleine Ammonitenspirale, daneben in kleinen Buchstaben „Neuer Aquapendium-Eintrag“ und darunter der Name.
   * Mehrere Einträge kommen nacheinander.
   */
  private nextDex() {
    if (this.dexBusy || this.cineOn || !this.dexQueue.length) return;
    const { head: headText, name } = this.dexQueue.shift()!;
    this.dexBusy = true;
    const c = this.dexC;
    c.removeAll(true);
    const head = text(this, 74, 13, headText.toUpperCase(), 12, UI.ochre, { fontStyle: '700' }).setOrigin(0, 0).setLetterSpacing(3);
    const nm = title(this, 74, 31, name, 22, UI.bone).setOrigin(0, 0);
    const w = Math.round(Math.max(312, 74 + Math.max(head.width, nm.width) + 28)), h = 66;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(3, 5, w, h, 12);
    g.fillStyle(0x0d0c0b, 0.84);
    g.fillRoundedRect(0, 0, w, h, 12);
    g.lineStyle(1.5, 0xc8913c, 0.55);
    g.strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, 12);
    g.lineStyle(1, 0xffffff, 0.06);
    g.strokeRoundedRect(4.5, 4.5, w - 9, h - 9, 9);
    // feine Trennlinie zwischen Zeichen und Schrift
    g.lineStyle(1, 0xc8913c, 0.28);
    g.lineBetween(62, 13, 62, h - 13);
    // das Zeichen: ein Ammonit in einem Ring
    const cx = 31, cy = h / 2;
    g.fillStyle(0x1b1712, 0.95);
    g.fillCircle(cx, cy, 21);
    g.lineStyle(1.5, 0xc8913c, 0.7);
    g.strokeCircle(cx, cy, 21);
    g.lineStyle(2, 0xe0b46a, 0.95);
    g.beginPath();
    for (let a = 0.2; a < Math.PI * 4.1; a += 0.12) {
      const rad = 1.4 + a * 1.3;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (a === 0.2) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    // Rippen auf dem Gehäuse
    g.lineStyle(1, 0xc8913c, 0.7);
    for (let a = 2.6; a < Math.PI * 4; a += 0.62) {
      const r0 = 1.4 + a * 1.3, r1 = r0 + 3.4;
      g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    c.add([g, head, nm]);
    // einblenden: leicht von links hereingleiten, am Zeichen leuchtet es kurz auf
    this.tweens.killTweensOf(c);
    this.tweens.killTweensOf(this.dexGlow);
    c.setAlpha(0).setX(-6);
    this.dexGlow.setPosition(22 + cx + 8, 22 + cy).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, x: 22, duration: 700, ease: 'Sine.out' });
    this.tweens.add({ targets: this.dexGlow, alpha: 0.5, duration: 600, delay: 250, yoyo: true, hold: 120, ease: 'Sine.inOut' });
    audio.sfx('entry');
    const crowded = this.dexQueue.length > 0;
    this.time.delayedCall(700 + (crowded ? 1700 : 3600), () => {
      this.tweens.add({
        targets: c,
        alpha: 0,
        y: 16,
        duration: 700,
        ease: 'Sine.in',
        onComplete: () => {
          c.setY(22);
          this.dexBusy = false;
          this.nextDex();
        },
      });
    });
  }

  update(time: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    const ease = (cur: number, to: number, k: number) => cur + (to - cur) * Math.min(1, dt * k);

    // Verletzung: alle vier Bildränder färben sich rot, ab einem gewissen Punkt schlägt das Herz hörbar
    const hurt = this.hp < 0.6 ? Math.pow((0.6 - this.hp) / 0.6, 0.8) : 0;
    this.hurtA = ease(this.hurtA, hurt, 4);
    if (this.hp < 0.33 && this.hp > 0 && time > this.beatAt && !this.pauseC) {
      this.beatAt = time + 520 + this.hp * 1800;
      this.pulse = 1;
      audio.sfx('heart');
    }
    this.pulse = Math.max(0, this.pulse - dt * 2.4);
    const beat = this.pulse * (hurt > 0 ? 1 : 0);
    this.hurtV.setAlpha(Math.min(1, this.hurtA * 0.45 + beat * 0.2));
    this.edgeV.setAlpha(Math.min(1, this.hurtA * 0.7 + beat * 0.25));

    // Hunger: Es gibt keinen Balken – der Magen knurrt, das Bild wird dunkler
    const hunger = this.food < 0.3 ? (0.3 - this.food) / 0.3 : 0;
    const starving = this.food <= 0.02 ? 0.12 + Math.sin(time / 600) * 0.08 : 0;
    this.hungerA = ease(this.hungerA, hunger * 0.65 + starving, 2);
    this.hungerV.setAlpha(Math.min(1, this.hungerA));

    // Versteckt im Dickicht
    this.hideA = ease(this.hideA, this.hidden ? 0.6 : 0, 5);
    this.hideV.setAlpha(this.hideA);

    this.portrait?.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.2);
    this.tabletView?.update(dt);
  }

  /** Der Schädel ist hart genug: Ab jetzt kann man gezielt rammen (ein Ton, bei Touch erscheint der Knopf). */
  private ramUnlocked() {
    audio.sfx('evolve');
    if (this.isTouch) this.ramButton();
  }

  // ---------------------------------------------------------------- Rast (Pause)

  togglePause() {
    const lvl = this.scene.get('Level') as unknown as { ended?: boolean };
    if (this.tabletView) this.toggleTablet();
    if (this.pauseC) {
      this.resumeGame();
      return;
    }
    if (lvl.ended) return;
    audio.sfx('select');
    this.scene.pause('Level');
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.66).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 380, 130, 760, 460, 0.92));
    c.add(title(this, W / 2, 182, 'Rast', 48).setOrigin(0.5));

    const lv = this.scene.get('Level') as unknown as { player?: { morph(): Morph } };
    const m = lv.player?.morph() ?? game.morph();
    c.add(this.add.image(W / 2 - 190, 470, 'shadow').setDisplaySize(240, 24).setAlpha(0.5));
    const v = new CreatureView(this, W / 2 - 190, 0, m, 1.6);
    v.setY(v.L.land ? 466 - v.L.footY * 1.6 : 400);
    c.add(v);
    this.portrait = v;
    c.add(text(this, W / 2 - 190, 518, CLASSES[m.cls].name, 20, UI.boneDim).setOrigin(0.5));

    const bx = W / 2 + 170;
    // Wartet ein befruchtetes Gelege, kann man sein Leben an die Nachkommen weitergeben (statt die Linie aufzugeben)
    const heir = !!game.heir();
    const y0 = heir ? 252 : 270, step = heir ? 62 : 70;
    const b1 = new Button(this, bx, y0, 'Weiter', { w: 300, icon: 'ic_play', color: UI.ochreN, onClick: () => this.resumeGame() });
    const b3 = new Button(this, bx, y0 + step, 'Steuerung', { w: 300, onClick: () => this.showControls() });
    const items = [b1, b3];
    if (heir) items.push(new Button(this, bx, y0 + step * 2, 'Leben weitergeben', { w: 300, icon: 'ic_swarm', onClick: () => this.handOver() }));
    const b2 = new Button(this, bx, y0 + step * items.length, 'Aufgeben', { w: 300, icon: 'ic_skull', onClick: () => this.abort() });
    items.push(b2);
    this.giveUp = b2;
    this.giveUpArmed = false;
    c.add(items);
    const note = heir
      ? 'Weitergeben: Du spielst als Jungtier aus deinem Gelege weiter.\nAufgeben: Die Linie stirbt aus.'
      : 'Wer aufgibt, lässt seine Linie aussterben.\nDas Spiel ist dann vorbei.';
    c.add(text(this, bx, y0 + step * items.length + 48, note, 16, UI.boneDim, { align: 'center' }).setOrigin(0.5, 0));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, items);
  }

  /** Die Seite "Steuerung" in der Rast. */
  private showControls() {
    if (!this.pauseC) return;
    const c = this.add.container(0, 0).setDepth(55);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.88).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 420, 70, 840, 580, 0.97));
    c.add(title(this, W / 2, 124, 'Steuerung', 40).setOrigin(0.5));
    controlsList(this, c, W / 2 + 30, 172, 21, 31);
    c.add(text(this, W / 2, 548, 'Auf dem Handy erscheinen Knöpfe auf dem Bildschirm.', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
    const back = new Button(this, W / 2, 604, 'Zurück', { w: 240, h: 48, onClick: () => close() });
    c.add(back);
    if (this.pauseNav) this.pauseNav.enabled = false;
    const nav = new MenuNav(this, [back]);
    const close = () => {
      nav.enabled = false;
      c.destroy();
      this.input.keyboard!.off('keydown-ESC', onEsc);
      if (this.pauseNav) this.pauseNav.enabled = true;
    };
    const onEsc = () => close();
    this.input.keyboard!.on('keydown-ESC', onEsc);
  }

  private resumeGame() {
    if (!this.pauseC) return;
    this.pauseC.destroy();
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.pauseNav = undefined;
    this.scene.resume('Level');
  }

  /** Das Leben an die Nachkommen weitergeben: Das Tier stirbt friedlich, die nächste Generation schlüpft. */
  private handOver() {
    this.resumeGame();
    bus.emit('handOver');
  }

  /** Erst nachfragen – Aufgeben beendet das Spiel. */
  private abort() {
    if (!this.giveUpArmed) {
      this.giveUpArmed = true;
      this.giveUp?.setLabel('Wirklich?').setColor(0x5a2420);
      return;
    }
    this.resumeGame();
    bus.emit('abortLevel');
  }

  // ---------------------------------------------------------------- Touch

  private touchControls(water: boolean) {
    this.input.addPointer(3);
    this.touchBtn(80, 610, 46, '◀', 'left');
    this.touchBtn(220, 610, 46, '▶', 'right');
    this.touchBtn(150, 540, 40, '▲', 'up');
    this.touchBtn(150, 680, 36, '▼', 'down');
    // zur Laichzeit laicht derselbe Knopf (wie E)
    const bite = this.touchBtn(1190, 600, 60, 'Biss', 'bite', 0xc8473a);
    const onAble = (on: boolean) => bite.setText(on ? 'Laichen' : 'Biss');
    bus.on('spawnable', onAble);
    this.events.once('shutdown', () => bus.off('spawnable', onAble));
    this.touchBtn(1060, 650, 50, water ? 'Hoch' : 'Sprung', 'jump', 0x9ab8b0);
    this.touchBtn(1070, 520, 44, 'Sprint', 'sprint', 0xc8913c);
    if (game.canRam) this.ramButton();
    this.talkButton();
  }

  /** Der Knopf zum Ansprechen: erscheint nur, wenn ein Artgenosse in der Nähe ist, der etwas zu erzählen hat. */
  private talkButton() {
    const x = 1066, y = 400, r = 42;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x0b0a09, 0.4);
    g.fillCircle(x, y, r);
    g.lineStyle(2.5, 0xe0a848, 0.6);
    g.strokeCircle(x, y, r);
    const t = text(this, x, y, 'Reden', 19, UI.bone, { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
    const z = this.add.zone(x, y, r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains).setDepth(7);
    const all = [g, t];
    for (const o of all) o.setAlpha(0);
    z.input!.enabled = false;
    // ein kurzes Antippen soll sicher ankommen: Der Knopf bleibt einen Augenblick „gedrückt“
    z.on('pointerdown', () => {
      touch.talk = true;
      audio.unlock();
      this.time.delayedCall(200, () => (touch.talk = false));
    });
    const onTalk = (on: boolean) => {
      this.tweens.add({ targets: all, alpha: on ? 0.9 : 0, duration: 250 });
      z.input!.enabled = on;
      if (!on) touch.talk = false;
    };
    bus.on('talk', onTalk);
    this.events.once('shutdown', () => bus.off('talk', onTalk));
  }

  /** Der Stoß-Knopf. */
  private ramButton() {
    if (this.ramBtn) return;
    this.ramBtn = true;
    this.touchBtn(1195, 460, 44, 'Stoß', 'ram', 0xb89a70);
  }

  private touchBtn(x: number, y: number, r: number, label: string, key: keyof typeof touch, color = 0xe6dcc4) {
    const g = this.add.graphics().setDepth(5);
    const draw = (down: boolean) => {
      g.clear();
      g.fillStyle(0x0b0a09, down ? 0.55 : 0.32);
      g.fillCircle(x, y, r);
      g.lineStyle(2.5, color, down ? 0.85 : 0.35);
      g.strokeCircle(x, y, r);
    };
    draw(false);
    const t = text(this, x, y, label, r > 50 ? 21 : 18, UI.bone, { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(6).setAlpha(0.85);
    const z = this.add.zone(x, y, r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains).setDepth(7);
    const set = (v: boolean) => {
      touch[key] = v;
      // ein kurzes Tippen zählt, auch wenn der Finger vor dem nächsten Bild schon wieder oben ist
      if (v) tapped[key] = true;
      draw(v);
      if (v) audio.unlock();
    };
    z.on('pointerdown', () => set(true));
    z.on('pointerup', () => set(false));
    z.on('pointerout', () => set(false));
    return t;
  }
}
