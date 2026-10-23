import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game, type UpKey } from '../state/GameState';
import type { LevelScene } from './LevelScene';
import type { SwarmInfo } from '../objects/Swarm';
import { EPOCHS, yearsAgo, type EpochDef } from '../data/epochs';
import { phases, worldYears } from '../sim/life';
import { CLASSES } from '../data/classes';
import { SPECIES } from '../data/species';
import { tapped, touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, panel, soundButton, text, title } from '../ui/ui';
import { openKeys } from '../ui/keysPanel';
import { capture, keyLabel, matches, onKeysChanged } from '../state/keymap';
import { upTrail } from '../ui/upTrail';
import { Overview } from '../ui/overview';
import { netInfo } from '../net/NetSync';
import { UPGRADES } from '../data/life';
import { BROOD, OXYGEN } from '../data/karbon';

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Die Anzeige im Level: oben die Zeit (Zeitalter und Jahresangabe), sonst kaum etwas – mehr zeigt die Übersicht (Taste C).
 * Verletzung und Verstecktsein zeigen sich am Bildrand, am Herzschlag und am Tier.
 */
export class HudScene extends Phaser.Scene {
  private ep!: EpochDef;
  private placeName = '';
  private hurtV!: Phaser.GameObjects.Image;
  private edgeV!: Phaser.GameObjects.Image;
  private hideV!: Phaser.GameObjects.Image;
  /** Neuer Eintrag in der Chronik (oder eine Meldung zum Leben): ein schmales Schild oben links, das sanft einblendet */
  private dexC!: Phaser.GameObjects.Container;
  private dexGlow!: Phaser.GameObjects.Image;
  private dexQueue: { head: string; name: string }[] = [];
  /** gerade läuft ein Kino-Moment (schwarze Balken) */
  private cineOn = false;
  private dexBusy = false;
  private hp = 1;
  private hidden = false;
  private hurtA = 0;
  private hideA = 0;
  private pulse = 0;
  private pauseC?: Phaser.GameObjects.Container;
  private pauseNav?: MenuNav;
  /** vor der großen Muschel: die Wahl, wofür sie segnet */
  private shrineC?: Phaser.GameObjects.Container;
  private shrineNav?: MenuNav;
  /** die Seite „Steuerung“ (über der Rast) */
  private keys?: Phaser.GameObjects.Container;
  private portrait?: CreatureView;
  private giveUp?: Button;
  private giveUpArmed = false;
  private isTouch = false;
  private ramBtn = false;
  private bossC!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossShown = false;
  private overview?: Overview;
  /** der Weg ins Hauptmenü läuft gerade (die Sekunden zählen herunter) */
  private quitting = false;
  private overviewGlow?: Phaser.GameObjects.Image;
  private clockText!: Phaser.GameObjects.Text;
  private fuse!: Phaser.GameObjects.Graphics;
  /** Lebenslinie: wie weit das Leben des eigenen Tiers ist (0 … 1), ob es ausgewachsen ist und ob ein Nachkomme wartet */
  private lifeFrac = 0;
  private heir = false;
  /** Antwort im Gespräch (ja oder nein) */
  private choiceC?: Phaser.GameObjects.Container;
  /** frisch geschlüpft: Die Anzeigen kommen erst, wenn das Tier aufgewacht ist */
  private wake = false;
  /** Karbon: die Zeile unter der Brutlinie (Generation, Eier, Nahrung bzw. Zeit bis zum neuen Gelege) */
  private broodText?: Phaser.GameObjects.Text;
  private broodAt = 0;

  constructor() {
    super('Hud');
  }

  init(d: { epoch: number; place?: string; wake?: boolean }) {
    this.ep = EPOCHS[d?.epoch ?? 0];
    this.wake = !!d?.wake;
    this.placeName = d?.place ?? this.ep.place;
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    this.giveUpArmed = false;
    this.ramBtn = false;
    this.overview = undefined;
    this.overviewGlow = undefined;
    this.bossShown = false;
    this.hp = 1;
    this.hidden = false;
    this.hurtA = this.hideA = this.pulse = 0;
    this.lifeFrac = 0;
    this.heir = false;
  }

  create() {
    const ep = this.ep;

    // Bildränder: Verletzung (rot), Versteck (grünlich-dunkel)
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
    this.clockText = text(this, W / 2, 50, yearsAgo(worldYears(ep.from, ep.to), 1), 21, UI.bone).setOrigin(0.5);
    this.fuse = this.add.graphics();
    this.spawnTimeUi();
    this.lifeFrac = game.run ? game.life.age / phases(game.life.gen).span : 0;
    // Karbon: statt der Lebenslinie die Brut – Jugend bis zur Metamorphose, dann die Zeit bis zum neuen Gelege
    this.broodText = game.brood ? text(this, W / 2, 84, '', 15, UI.bone, { stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0) : undefined;
    this.broodAt = 0;
    this.drawFuse();
    // Ein neues Tier in der Chronik des Lebens: ein kleines Schild oben links
    this.dexQueue = [];
    this.cineOn = false;
    this.dexBusy = false;
    this.dexC = this.add.container(22, 22).setAlpha(0).setDepth(7);
    this.dexGlow = this.add.image(0, 0, 'glow').setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 120).setAlpha(0).setDepth(6);

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    // Die Übersicht über das eigene Tier: Der Knopf leuchtet leise, wenn eine neue Muschel gefunden wurde.
    this.overviewGlow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0);
    const ovB = new Button(this, W - 156, 38, keyLabel('overview'), { w: 50, h: 50, size: keyLabel('overview').length > 2 ? 14 : 22, onClick: () => this.toggleOverview() }).setAlpha(0.75);
    const offKeys = onKeysChanged(() => ovB.setLabel(keyLabel('overview')));
    this.events.once('shutdown', offKeys);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);
    this.updateGlow();
    this.swarmUi();
    this.netUi();
    this.questUi();
    this.choiceUi();

    // Beim Betreten eines Ortes: nur sein Name, sanft ein- und wieder ausgeblendet
    const head = title(this, W / 2, H / 2 - 90, this.placeName, 46).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 1, duration: 900, hold: 2200, yoyo: true, delay: this.wake ? 3000 : 0 });
    // Frisch geschlüpft: Erst wacht das Tier auf, dann kommen die Anzeigen. Am Ende eines Lebens treten sie zurück (veil).
    const cam = this.cameras.main;
    if (this.wake) {
      cam.setAlpha(0);
      this.tweens.add({ targets: cam, alpha: 1, duration: 1600, delay: 2600 });
    }
    const onVeil = (on: boolean) => {
      this.tweens.killTweensOf(cam);
      this.tweens.add({ targets: cam, alpha: on ? 0 : 1, duration: on ? 1400 : 900 });
    };
    bus.on('veil', onVeil);
    this.events.once('shutdown', () => bus.off('veil', onVeil));

    const run = game.run;
    if (run?.ramNew) {
      run.ramNew = false;
      this.time.delayedCall(5200, () => this.ramUnlocked());
    }

    const isTouch = (this.isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch'));
    if (isTouch) this.touchControls(ep.habitat === 'water');

    this.quitting = false;
    this.quitUi();
    const onShrine = () => this.openShrine();
    bus.on('shrineOpen', onShrine);
    this.events.once('shutdown', () => {
      bus.off('shrineOpen', onShrine);
      this.shrineC = undefined;
      this.shrineNav = undefined;
    });

    const kb = this.input.keyboard!;
    // Esc ist fest; Rast und Übersicht liegen auf den Tasten der Belegung (die Seite „Steuerung“ fängt ihre Tasten selbst)
    kb.on('keydown-ESC', () => !capture.on && !this.keys && (this.overview ? this.toggleOverview() : this.togglePause()));
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.keys) return;
      if (matches('pause', e)) this.togglePause();
      else if (matches('overview', e)) this.toggleOverview();
    });

    const onVitals = (hp: number, hidden: boolean) => {
      this.hp = hp;
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
      for (const id of ids) if (SPECIES[id]) this.dexQueue.push({ head: 'NEU IN DER CHRONIK DES LEBENS', name: SPECIES[id].name });
      this.nextDex();
    };
    bus.on('dex', onDex);
    bus.on('clock', onClock);
    bus.on('life', onLife);
    bus.on('notice', onNotice);
    bus.on('boss', onBoss);
    bus.on('vitals', onVitals);
    const onBeat = (k: number) => (this.pulse = Math.max(this.pulse, k));
    bus.on('heartbeat', onBeat);
    this.events.once('shutdown', () => bus.off('heartbeat', onBeat));
    bus.on('ramUnlocked', onRam);
    bus.on('shell', onShell);
    // Kino-Moment: schwarze Balken oben und unten
    const barH = 64;
    const bars = [this.add.rectangle(0, -barH, W, barH, 0x000000, 1).setOrigin(0).setDepth(50), this.add.rectangle(0, H, W, barH, 0x000000, 1).setOrigin(0).setDepth(50)];
    const onCine = (on: boolean) => {
      this.cineOn = on;
      this.tweens.add({ targets: bars[0], y: on ? 0 : -barH, duration: 900, ease: 'Sine.inOut' });
      this.tweens.add({ targets: bars[1], y: on ? H - barH : H, duration: 900, ease: 'Sine.inOut' });
      // neue Einträge der Chronik warten, bis die Balken wieder weg sind
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
    if (game.brood) return this.drawBrood();
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
   * Karbon: die Brutlinie. Links die Jugend (kühl, füllt sich mit der Nahrung bis zur Metamorphose), rechts die Gefahr (Ocker,
   * am Ende rostrot – die Zeit bis zum neuen Gelege). Darunter: Generation, Eier im Nest, was noch fehlt.
   */
  private drawBrood() {
    const b = game.brood!;
    const g = this.fuse;
    const x0 = W / 2 - 170, w = 340, y = 70, meta = 0.32;
    const young = b.phase === 'young';
    const f = young ? meta * Math.min(1, b.food / BROOD.food) : meta + (1 - meta) * (1 - b.left / BROOD.danger);
    g.clear();
    g.fillStyle(0x2a2420, 1);
    g.fillRect(x0, y, w, 3);
    g.fillStyle(0x6fa8a0, 0.9);
    g.fillRect(x0, y, w * Math.min(f, meta), 3);
    if (f > meta) {
      g.fillStyle(f > 0.9 ? 0xa4503a : 0xc8913c, 0.9);
      g.fillRect(x0 + w * meta, y, w * (f - meta), 3);
    }
    g.fillStyle(0x8a7a60, 0.8);
    g.fillRect(x0 + w * meta - 0.5, y - 2, 1, 7);
    g.fillStyle(0xffe0a0, 1);
    g.fillCircle(x0 + w * f, y + 1.5, 3);
    if (!this.broodText) return;
    const eggs = `${b.eggs} ${b.eggs === 1 ? 'Ei' : 'Eier'}`;
    let line: string;
    if (young) line = `Generation ${b.gen}  ·  ${eggs}  ·  Nahrung ${Math.floor(b.food)}/${BROOD.food} bis zur Metamorphose`;
    else {
      const s = Math.ceil(b.left), mm = Math.floor(s / 60), ss = `${s % 60}`.padStart(2, '0');
      const lvl = this.scene.get('Level') as LevelScene;
      const away = lvl?.place && lvl.place.id !== b.nest.place;
      line = `Generation ${b.gen}  ·  ${eggs}  ·  neues Gelege in ${mm}:${ss}${away ? '  ·  das Nest ist ungeschützt!' : ''}`;
    }
    if (line !== this.broodText.text) this.broodText.setText(line);
    this.broodText.setColor(b.eggs <= 10 && !young ? '#e0806a' : UI.bone);
  }

  /**
   * Laichzeit: In dem Moment, in dem das Tier ausgewachsen ist, steht unter der Lebenslinie einmal kurz, klein und warm, dass
   * Laichzeit ist und was noch fehlt („Laichzeit · noch 18 Nahrung“) – dann geht es langsam wieder weg. Nur ein Hinweis.
   */
  private spawnTimeUi() {
    const t = text(this, W / 2, 86, '', 15, UI.ochre, { stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setAlpha(0);
    const show = (msg: string) => {
      this.tweens.killTweensOf(t);
      t.setText(msg).setAlpha(0).setY(80);
      this.tweens.add({ targets: t, alpha: 0.85, y: 86, duration: 900, ease: 'Sine.out' });
      this.tweens.add({ targets: t, alpha: 0, delay: 5200, duration: 2600, ease: 'Sine.inOut' });
    };
    bus.on('spawnHint', show);
    this.events.once('shutdown', () => bus.off('spawnHint', show));
  }

  /** Der Knopf der Übersicht leuchtet leise, solange dort eine neue Muschel zu sehen ist. */
  private updateGlow() {
    const g = this.overviewGlow;
    if (!g) return;
    const fresh = game.shells > game.seenShells;
    this.tweens.killTweensOf(g);
    if (!fresh) {
      g.setAlpha(0);
      return;
    }
    g.setAlpha(0.06);
    this.tweens.add({ targets: g, alpha: 0.22, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' });
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
   * Der Knopf für deine Gruppe (links neben der Übersicht, Taste S): erst sichtbar, wenn sie auf deinen Ruf kommt.
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

  /** Der laufende Auftrag: Titel, Ziel und Fortschritt in einem Schild oben links (wie die Einträge der Chronik). */
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

  // ---------------------------------------------------------------- Übersicht (Taste C)

  toggleOverview() {
    if (this.shrineC) return;
    if (this.overview) {
      this.overview.destroy();
      this.overview = undefined;
      this.updateGlow();
      if (!this.pauseC) this.scene.resume('Level');
      return;
    }
    const lvl = this.scene.get('Level') as unknown as LevelScene;
    // nicht, während das Tier einschläft
    if (this.pauseC || !lvl || lvl.ended || lvl.player?.dead || !game.run) return;
    audio.sfx('select');
    this.scene.pause('Level');
    this.overview = new Overview(this, { morph: lvl.player.morph(), hp: lvl.player.hp, hpMax: lvl.player.stats.maxHp }, () => this.toggleOverview());
  }

  /**
   * Ein neuer Eintrag in der Chronik des Lebens: Ein schmales Schild gleitet oben links herein – dunkle Fläche, feine ochrefarbene Linien,
   * links eine kleine Ammonitenspirale, daneben in kleinen Buchstaben „Neu in der Chronik des Lebens“ und darunter der Name.
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
    this.tweens.add({ targets: this.dexGlow, alpha: 0.3, duration: 600, delay: 250, yoyo: true, hold: 120, ease: 'Sine.inOut' });
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

  update(_time: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    const ease = (cur: number, to: number, k: number) => cur + (to - cur) * Math.min(1, dt * k);

    // Verletzung: alle vier Bildränder färben sich rot; schlägt das Herz (wenn dich etwas jagt – LevelScene.heartStep),
    // pochen sie mit
    const hurt = this.hp < 0.6 ? Math.pow((0.6 - this.hp) / 0.6, 0.8) : 0;
    this.hurtA = ease(this.hurtA, hurt, 4);
    this.pulse = Math.max(0, this.pulse - dt * 2.4);
    const beat = this.pulse * (hurt > 0 ? 1 : 0);
    this.hurtV.setAlpha(Math.min(1, this.hurtA * 0.45 + beat * 0.2));
    this.edgeV.setAlpha(Math.min(1, this.hurtA * 0.7 + beat * 0.25));

    // Versteckt im Dickicht
    this.hideA = ease(this.hideA, this.hidden ? 0.6 : 0, 5);
    this.hideV.setAlpha(this.hideA);

    this.portrait?.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.2);
    this.overview?.update(dt);
    // Karbon: die Brutlinie viermal je Sekunde neu
    if (game.brood && _time > this.broodAt) {
      this.broodAt = _time + 250;
      this.drawBrood();
    }
  }

  /** Der Schädel ist hart genug: Ab jetzt kann man gezielt rammen (ein Ton, bei Touch erscheint der Knopf). */
  private ramUnlocked() {
    audio.sfx('evolve');
    if (this.isTouch) this.ramButton();
  }

  // ---------------------------------------------------------------- Die große Muschel

  /**
   * Vor der großen Muschel: Man verteilt seine Muscheln auf Lebenskraft, Ausdauer und Sicht. Jeder Segen kostet doppelt so
   * viele wie der vorige (1, 2, 4, 8 … – gleich, wofür). Die Welt steht so lange still.
   */
  private openShrine() {
    const lvl = this.scene.get('Level') as unknown as LevelScene;
    if (this.shrineC || this.pauseC || this.overview || !lvl || lvl.ended || lvl.player?.dead || !game.run) return;
    audio.sfx('select');
    this.scene.pause('Level');
    const c = (this.shrineC = this.add.container(0, 0).setDepth(52));
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0).setInteractive());
    const x0 = W / 2 - 440, y0 = 104, pw = 880, ph = 512;
    c.add(panel(this, x0, y0, pw, ph, 0.94));
    // ein warmer Schimmer hinter dem Titel, wie das Glühen der Perle
    c.add(this.add.image(W / 2, y0 + 58, 'glow').setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(420, 120).setAlpha(0.16));
    c.add(title(this, W / 2, y0 + 56, 'Die große Muschel', 40).setOrigin(0.5));

    const free = game.shellsFree, total = game.shells, cost = game.upCost, done = game.upCount, all = done >= UPGRADES.max;
    const mus = (n: number) => `${n} ${n === 1 ? 'Muschel' : 'Muscheln'}`;
    const info = text(this, W / 2 + 14, y0 + 102, `${free} frei  ·  ${total} gefunden  ·  Segen ${done} von ${UPGRADES.max}${all ? '' : `  ·  der nächste kostet ${mus(cost)}`}`, 18, UI.boneDim).setOrigin(0.5);
    c.add(info);
    c.add(this.add.image(info.x - info.width / 2 - 10, info.y + 1, 'shell').setOrigin(1, 0.5).setDisplaySize(18, 20));
    const trail = game.upTrail;

    const ups = game.ups;
    const now = game.shown(ups);
    const cols: { k: UpKey; name: string; what: string; val: (v: ReturnType<typeof game.shown>) => number }[] = [
      { k: 'hp', name: 'Lebenskraft', what: `+${nf(UPGRADES.hp * 100, 1)} %  ·  ein größerer Körper`, val: (v) => v.hpMax },
      // im Karbon: Sauerstoff statt Sicht – länger an Land, ohne auszutrocknen
      game.upKeys.includes('oxy')
        ? { k: 'oxy', name: 'Sauerstoff', what: `+${Math.round(OXYGEN.perUp * 100)} %  ·  länger an Land`, val: (v) => v.oxy }
        : { k: 'sight', name: 'Sicht', what: `+${Math.round(UPGRADES.sightPer * 100)} %  ·  größere Augen`, val: (v) => v.sight },
      { k: 'stam', name: 'Ausdauer', what: '+¼ Kreis  ·  kräftigere Flossen', val: (v) => v.stam },
    ];
    const items: Button[] = [];
    cols.forEach((col, i) => {
      const cx = W / 2 + (i - 1) * 282, top = y0 + 152;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.22);
      g.fillRoundedRect(cx - 128, top, 256, 262, 10);
      g.lineStyle(1, 0xc8913c, 0.22);
      g.strokeRoundedRect(cx - 128, top, 256, 262, 10);
      c.add(g);
      const maxed = game.upMaxed(col.k) || all;
      const next = col.val(game.shown({ ...ups, [col.k]: ups[col.k] + 1 }));
      c.add(text(this, cx, top + 30, col.name.toUpperCase(), 14, UI.ochre, { fontStyle: '700' }).setOrigin(0.5).setLetterSpacing(4));
      c.add(title(this, cx, top + 84, maxed ? String(col.val(now)) : `${col.val(now)}  →  ${next}`, 34, UI.bone).setOrigin(0.5));
      c.add(upTrail(this, cx, top + 115, trail.filter((d) => d.key === col.k), { size: 14, step: 20, perRow: 12 }).c);
      c.add(text(this, cx, top + 151, game.upMaxed(col.k) ? 'so stark, wie es geht' : col.what, 15, UI.boneDim).setOrigin(0.5));
      const b = new Button(this, cx, top + 216, col.name, { w: 220, h: 50, color: UI.ochreN, onClick: () => this.pickShrine(col.k) });
      b.setDisabled(maxed || free < cost);
      items.push(b);
      c.add(b);
    });
    const note = !total
      ? 'Noch keine Muscheln. Sie fallen von erlegten Tieren – von starken öfter als von schwachen.'
      : all
        ? `Deine Linie hat alle ${UPGRADES.max} Segen.${game.brood ? '' : ' Beginnt eine neue, sind alle Muscheln wieder frei.'}`
      : free < cost
        ? `Für den nächsten Segen fehlen noch ${mus(cost - free)}.`
        : game.brood
          ? 'Die Segen gelten für deine ganze Art – auch über das Aussterben hinaus.'
          : 'Die Segen gelten für deine ganze Linie. Beginnt eine neue, sind alle Muscheln wieder frei.';
    c.add(text(this, W / 2, y0 + 440, note, 16, UI.boneDim, { align: 'center' }).setOrigin(0.5));
    const go = new Button(this, W / 2, y0 + 482, 'Gehen', { w: 200, h: 42, size: 18, icon: 'ic_back', onClick: () => this.closeShrine() });
    items.push(go);
    c.add(go);
    this.shrineNav = new MenuNav(this, items, 3);
    this.shrineNav.focus(Math.max(0, items.findIndex((b) => !b.disabled)));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 220, ease: 'Sine.out' });
  }

  private closeShrine(quiet = false) {
    if (!this.shrineC) return;
    this.shrineC.destroy();
    this.shrineC = undefined;
    if (this.shrineNav) this.shrineNav.enabled = false;
    this.shrineNav = undefined;
    if (!quiet) audio.sfx('back');
    this.scene.resume('Level');
  }

  /** Gewählt: Die Welt läuft weiter, und die große Muschel segnet (LevelScene.bless). */
  private pickShrine(k: UpKey) {
    if (!this.shrineC) return;
    this.closeShrine(true);
    bus.emit('shrineBless', k);
  }

  // ---------------------------------------------------------------- Rast (Pause)

  togglePause() {
    // läuft der Weg ins Hauptmenü, bricht die Rast-Taste (oder der Knopf) ihn nur ab
    if (this.quitting) {
      bus.emit('quitCancel');
      return;
    }
    // vor der großen Muschel: Esc (und die Rast-Taste) lässt sie stehen
    if (this.shrineC) {
      this.closeShrine();
      return;
    }
    const lvl = this.scene.get('Level') as unknown as { ended?: boolean };
    if (this.overview) this.toggleOverview();
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
    // Liegt Laich deiner Generation, kann man sein Leben an die Nachkommen weitergeben (statt die Linie aufzugeben)
    const heir = game.roe.length > 0;
    const y0 = heir ? 236 : 252, step = heir ? 58 : 66, h = heir ? 50 : 54;
    const b1 = new Button(this, bx, y0, 'Weiter', { w: 300, h, icon: 'ic_play', color: UI.ochreN, onClick: () => this.resumeGame() });
    const b3 = new Button(this, bx, y0 + step, 'Steuerung', { w: 300, h, onClick: () => this.showControls() });
    // Zum Hauptmenü: Das Spiel läuft noch 5 Sekunden weiter (so entkommt man keiner Gefahr), dann geht es genau hier weiter
    const b4 = new Button(this, bx, y0 + step * 2, 'Hauptmenü', { w: 300, h, icon: 'ic_home', onClick: () => this.quit() });
    const items = [b1, b3, b4];
    if (heir) items.push(new Button(this, bx, y0 + step * 3, 'Leben weitergeben', { w: 300, h, icon: 'ic_swarm', onClick: () => this.handOver() }));
    const b2 = new Button(this, bx, y0 + step * items.length, 'Aufgeben', { w: 300, h, icon: 'ic_skull', onClick: () => this.abort() });
    items.push(b2);
    this.giveUp = b2;
    this.giveUpArmed = false;
    c.add(items);
    const note = heir
      ? 'Weitergeben: Du spielst als Jungtier aus deinem Gelege weiter.\nAufgeben: Die Linie stirbt aus.'
      : 'Wer aufgibt, lässt seine Linie aussterben.\nDas Spiel ist dann vorbei.';
    c.add(text(this, bx, y0 + step * (items.length - 1) + 50, note, 16, UI.boneDim, { align: 'center' }).setOrigin(0.5, 0));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, items);
  }

  /** Die Seite "Steuerung" in der Rast: Tasten ansehen und neu belegen. */
  private showControls() {
    if (!this.pauseC || this.keys) return;
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.keys = openKeys(this, 55, () => {
      this.keys = undefined;
      if (this.pauseNav) this.pauseNav.enabled = true;
    });
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

  /** Zum Hauptmenü: Die Rast schließt, das Spiel läuft noch ein paar Sekunden weiter (LevelScene.quitStep), dann geht es ins Menü. */
  private quit() {
    this.resumeGame();
    bus.emit('quit');
  }

  /**
   * Der Weg ins Hauptmenü läuft: mitten oben ein Schild mit den Sekunden, die noch bleiben. Esc (oder ein Tipp darauf) bricht ab.
   * n < 0: abgebrochen oder vorbei.
   */
  private quitUi() {
    const c = this.add.container(W / 2, 150).setDepth(9).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x050403, 0.72);
    bg.fillRoundedRect(-190, -34, 380, 68, 12);
    bg.lineStyle(1.5, 0xd8b070, 0.5);
    bg.strokeRoundedRect(-190, -34, 380, 68, 12);
    const head = title(this, 0, -10, '', 22, UI.ochre).setOrigin(0.5);
    const sub = text(this, 0, 16, this.isTouch ? 'Tippen: abbrechen' : 'Esc: abbrechen', 15, UI.boneDim).setOrigin(0.5);
    c.add([bg, head, sub]);
    c.setSize(380, 68).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.quitting && bus.emit('quitCancel'));
    const onCount = (n: number) => {
      this.tweens.killTweensOf(c);
      this.quitting = n >= 0;
      if (n < 0) {
        this.tweens.add({ targets: c, alpha: 0, duration: 300 });
        return;
      }
      head.setText(`Zum Hauptmenü in ${n} …`);
      c.setAlpha(1).setScale(1.06);
      this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Sine.out' });
      audio.sfx('select');
    };
    bus.on('quitCount', onCount);
    this.events.once('shutdown', () => bus.off('quitCount', onCount));
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
    // Am Laich öffnet derselbe Knopf die Eiübersicht (wie E).
    const bite = this.touchBtn(1190, 600, 60, 'Biss', 'bite', 0xc8473a);
    const onAble = (on: boolean) => bite.setText(on ? 'Laich' : 'Biss');
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
    // am Handy: „Reden“ – an der großen Muschel „Beten“
    const onTalk = (on: boolean, label = 'Reden') => {
      if (on) t.setText(label);
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
