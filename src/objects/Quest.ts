import Phaser from 'phaser';
import { DEPTH, FONT, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { SPECIES } from '../data/species';
import { placeOf, startPlace } from '../data/world';
import { questOf, type QuestDef } from '../data/quests';
import { groundAt } from '../level/terrain';
import { makeSpeciesTextures } from '../art/speciesArt';
import { clamp } from '../util/math';
import { touch } from './Controls';
import { Animal } from './Animal';
import { CreatureView } from './CreatureView';
import type { LevelScene } from '../scenes/LevelScene';

// Aufträge im Level: Ein Artgenosse wartet an einer festen Stelle. Wer nah genug ist, sieht über ihm ein kleines Zeichen und kann
// ihn mit F ansprechen. Dann rückt die Kamera an beide Tiere heran (wie beim Riesen im Hintergrund, mit schwarzen Balken), er redet
// in Sprechblasen, und danach geschieht, was der Auftrag vorsieht – hier: Er schwimmt in den nächsten Ort vor, und dort wird er
// von einem Tier gefressen, das in diese Zeit passt.

const TALK_RANGE = 300;
const NOTICE_RANGE = 700;

type Step =
  | { say: string }
  | { wait: number }
  | { until: (dt: number) => boolean }
  | { run: () => void };

/** Der Artgenosse, der den Auftrag gibt: sieht aus wie das eigene Tier, nur etwas anders – und bewegt sich nach Drehbuch. */
class Gefaehrte {
  view: CreatureView;
  x: number;
  y: number;
  dir = -1;
  vx = 0;
  vy = 0;
  /** schwebt: leichtes Auf und Ab */
  private t = Math.random() * 6;
  /** Zittern vor Angst */
  fear = 0;
  gone = false;
  /** wird gerade verschluckt: Die Ansicht wird von außen bewegt */
  swallowed = false;

  constructor(host: LevelScene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.view = new CreatureView(host, x, y, game.kinMorph(0, 1));
    this.view.setDepth(DEPTH.player - 1);
    this.view.setFacing(this.dir);
  }

  /** Ein Stück auf ein Ziel zuschwimmen; wahr, wenn er dort ist. */
  swimTo(tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 6) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      return true;
    }
    const k = Math.min(1, d / 60);
    const wx = (dx / d) * speed * k, wy = (dy / d) * speed * k;
    this.vx += (wx - this.vx) * Math.min(1, dt * 4);
    this.vy += (wy - this.vy) * Math.min(1, dt * 4);
    if (Math.abs(dx) > 16) this.dir = Math.sign(dx);
    return false;
  }

  update(dt: number) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const moving = Math.hypot(this.vx, this.vy);
    if (moving < 12) {
      this.vx *= 0.92;
      this.vy *= 0.92;
    }
    const bob = Math.sin(this.t * 1.7) * (moving > 30 ? 0 : 3.5);
    if (this.swallowed) return;
    const jx = this.fear > 0 ? Math.sin(this.t * 55) * 1.8 * this.fear : 0;
    this.view.setPosition(this.x + jx, this.y + bob);
    this.view.setFacing(this.dir);
    this.view.animate(dt, 'swim', Math.min(1.2, moving / 220 + 0.18 + this.fear * 0.5));
    this.view.rotation = this.dir * clamp(this.vy / 260, -1, 1) * 0.3;
  }

  destroy() {
    this.gone = true;
    this.view.destroy();
  }
}

/**
 * Sprechen: Solange sich die Sprechblase füllt, bewegt sich das Maul des Sprechers, aus dem Maul steigen Bläschen auf und
 * es blubbert leise – in Silben, mal mehr, mal weniger.
 */
export class Mouth {
  private next = 0;
  private pe: Phaser.GameObjects.Particles.ParticleEmitter;
  private last?: CreatureView;

  constructor(scene: Phaser.Scene) {
    this.pe = scene.add.particles(0, 0, 'p_bubble', {
      speedX: { min: -14, max: 14 }, speedY: { min: -70, max: -36 }, gravityY: -40, lifespan: { min: 900, max: 1600 },
      scale: { start: 0.45, end: 0.95 }, alpha: { start: 0.9, end: 0 }, emitting: false,
    }).setDepth(DEPTH.fx);
  }

  /** view: wer spricht; on: ob er gerade spricht (die Blase füllt sich). */
  update(time: number, view: CreatureView | undefined, on: boolean) {
    if (this.last && this.last !== view) this.last.talk = 0;
    this.last = view;
    if (!view || !view.active) return;
    view.talk = on ? 1 : 0;
    if (!on || time < this.next) return;
    this.next = time + 110 + Math.random() * 150;
    const m = view.mouthWorld();
    this.pe.explode(Math.random() < 0.35 ? 2 : 1, m.x, m.y - 2);
    if (Math.random() < 0.8) audio.sfx('blub');
  }

  stop() {
    if (this.last) this.last.talk = 0;
    this.last = undefined;
  }

  destroy() {
    this.stop();
    this.pe.destroy();
  }
}

/** Eine Sprechblase über einem Tier: Der Text erscheint Buchstabe für Buchstabe. */
export class Bubble {
  private c: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private t: Phaser.GameObjects.Text;
  private mark: Phaser.GameObjects.Graphics;
  private full = '';
  private shown = 0;
  private w = 0;
  private h = 0;
  private anchor: () => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private age = 0;
  private question = false;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.t = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '25px', color: '#ece2c8', fontStyle: '500', resolution: 2, lineSpacing: 4 }).setOrigin(0, 0);
    this.mark = scene.add.graphics();
    this.c = scene.add.container(0, 0, [this.g, this.t, this.mark]).setDepth(DEPTH.text).setAlpha(0).setVisible(false);
  }

  get typing() {
    return this.shown < this.full.length;
  }

  get visible() {
    return this.c.visible;
  }

  /** Eine Zeile anzeigen (bei einer Frage ohne „weiter“-Zeichen – geantwortet wird darunter). */
  show(anchor: () => { x: number; y: number }, str: string, question = false) {
    this.anchor = anchor;
    this.question = question;
    // erst mit Umbrüchen messen, dann Buchstabe für Buchstabe zeigen (damit nichts im Text hin- und herspringt)
    const m = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '25px', fontStyle: '500', wordWrap: { width: 430 }, lineSpacing: 4 }).setVisible(false);
    const lines = m.getWrappedText(str);
    m.destroy();
    this.full = lines.join('\n');
    this.t.setText('');
    this.shown = 0;
    this.age = 0;
    const probe = this.scene.add.text(0, 0, this.full, { fontFamily: FONT, fontSize: '25px', fontStyle: '500', lineSpacing: 4 }).setVisible(false);
    this.w = Math.ceil(probe.width) + 44;
    this.h = Math.ceil(probe.height) + 32;
    probe.destroy();
    this.t.setPosition(22, 15);
    this.g.clear();
    this.g.fillStyle(0x000000, 0.35);
    this.g.fillRoundedRect(3, 6, this.w, this.h, 14);
    this.g.fillStyle(0x0d0c0b, 0.9);
    this.g.fillRoundedRect(0, 0, this.w, this.h, 14);
    this.g.lineStyle(1.6, 0xc8913c, 0.6);
    this.g.strokeRoundedRect(0.8, 0.8, this.w - 1.6, this.h - 1.6, 14);
    this.g.lineStyle(1, 0xffffff, 0.06);
    this.g.strokeRoundedRect(5, 5, this.w - 10, this.h - 10, 10);
    this.c.setVisible(true);
    this.scene.tweens.killTweensOf(this.c);
    this.scene.tweens.add({ targets: this.c, alpha: 1, duration: 220 });
    audio.sfx('talk');
  }

  /** Den Rest der Zeile sofort zeigen. */
  finish() {
    this.shown = this.full.length;
    this.t.setText(this.full);
  }

  hide() {
    this.scene.tweens.killTweensOf(this.c);
    this.scene.tweens.add({ targets: this.c, alpha: 0, duration: 200, onComplete: () => this.c.setVisible(false) });
  }

  update(dt: number, view: Phaser.Geom.Rectangle) {
    if (!this.c.visible) return;
    this.age += dt;
    if (this.typing) {
      this.shown = Math.min(this.full.length, this.shown + dt * 52);
      this.t.setText(this.full.slice(0, Math.floor(this.shown)));
    }
    const a = this.anchor();
    // über dem Tier, aber immer im Bild
    const x = clamp(a.x - this.w / 2, view.x + 24, view.right - this.w - 24);
    const y = clamp(a.y - 74 - this.h, view.y + 90, view.bottom - 120);
    this.c.setPosition(x, y);
    // Zipfel, der auf den Sprecher zeigt
    const tx = clamp(a.x - x, 30, this.w - 30);
    this.mark.clear();
    this.mark.fillStyle(0x0d0c0b, 0.9);
    this.mark.fillTriangle(tx - 10, this.h - 1, tx + 10, this.h - 1, tx, this.h + 16);
    this.mark.lineStyle(1.6, 0xc8913c, 0.6);
    this.mark.lineBetween(tx - 10, this.h - 0.5, tx, this.h + 16);
    this.mark.lineBetween(tx + 10, this.h - 0.5, tx, this.h + 16);
    // wenn die Zeile fertig ist, deutet ein kleines Dreieck rechts unten auf „weiter“
    if (!this.typing && !this.question) {
      const k = 0.5 + 0.5 * Math.sin(this.age * 5);
      this.mark.fillStyle(0xe0a848, 0.35 + 0.5 * k);
      this.mark.fillTriangle(this.w - 30, this.h - 20 + k * 2, this.w - 18, this.h - 20 + k * 2, this.w - 24, this.h - 12 + k * 2);
    }
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.c);
    this.c.destroy();
  }
}

/** Das kleine Zeichen über einem Artgenossen, den man ansprechen kann. */
export class Prompt {
  private c: Phaser.GameObjects.Container;
  private a = 0;
  private t = 0;

  constructor(scene: Phaser.Scene, touchMode: boolean) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(2, 4, 38, 30, 9);
    g.fillStyle(0x0d0c0b, 0.88);
    g.fillRoundedRect(0, 0, 38, 30, 9);
    g.lineStyle(1.5, 0xc8913c, 0.7);
    g.strokeRoundedRect(0.75, 0.75, 36.5, 28.5, 9);
    g.fillStyle(0x0d0c0b, 0.88);
    g.fillTriangle(12, 29, 26, 29, 19, 38);
    const label = scene.add.text(19, 15, touchMode ? '···' : 'F', { fontFamily: TITLE_FONT, fontSize: touchMode ? '20px' : '19px', color: '#e0a848', fontStyle: '700', resolution: 2 }).setOrigin(0.5);
    this.c = scene.add.container(0, 0, [g, label]).setDepth(DEPTH.text).setAlpha(0).setScale(1.3);
  }

  update(dt: number, x: number, y: number, want: boolean) {
    this.t += dt;
    this.a += ((want ? 1 : 0) - this.a) * Math.min(1, dt * 6);
    this.c.setAlpha(this.a);
    this.c.setVisible(this.a > 0.02);
    this.c.setPosition(x - 19 * 1.3, y - 88 + Math.sin(this.t * 3) * 3);
  }

  destroy() {
    this.c.destroy();
  }
}

/** Führt die Aufträge eines Ortes: stellt den Artgenossen hin, wartet aufs Ansprechen und spielt die Szenen ab. */
export class Quest {
  private def?: QuestDef;
  private npc?: Gefaehrte;
  private prompt?: Prompt;
  private bubble: Bubble;
  private mouth: Mouth;
  /** Szene läuft: Steuerung gesperrt, Kamera bei den Tieren */
  busy = false;
  private steps: Step[] = [];
  private si = -1;
  private waitMs = 0;
  /** Zustand der Sprechblase: wartet auf „weiter“ */
  private advanceAt = 0;
  private cam = { k: 0, kTo: 0, fx: 0, fy: 0 };

  /** Die Kamera ist gerade nah dran (Gespräch) – dann bestimmt dieser Auftrag den Zoom. */
  get zooming() {
    return this.cam.k > 0 || this.cam.kTo > 0;
  }
  private eater?: Animal;
  private nearShown = false;
  private touchMode: boolean;
  private wantAdvance = false;
  private offs: (() => void)[] = [];
  private leaving = false;
  /** Wo das eigene Tier während der Szene bleibt (neben dem Gefährten, nicht mitten in ihm) */
  private hold?: { x: number; y: number };

  constructor(private host: LevelScene) {
    this.bubble = new Bubble(host);
    this.mouth = new Mouth(host);
    this.touchMode = host.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.def = questOf(host.ep.id);
    if (this.def && host.water) this.setup(this.def);
    // „weiter“ im Gespräch: F, Eingabe oder Antippen
    const kb = host.input.keyboard;
    const adv = () => {
      this.wantAdvance = true;
    };
    kb?.on('keydown-F', adv);
    kb?.on('keydown-ENTER', adv);
    host.input.on('pointerdown', adv);
    this.offs.push(() => {
      kb?.off('keydown-F', adv);
      kb?.off('keydown-ENTER', adv);
      host.input.off('pointerdown', adv);
    });
    host.events.once('shutdown', () => this.destroy());
  }

  private get step() {
    return this.def ? game.questStep(this.def.id) : 0;
  }

  private get targetName() {
    const ep = this.host.ep;
    return placeOf(ep, startPlace(ep).links[0]).name;
  }

  /** Wo wartet er? Im Startort rechts vom Fluss im offenen Meer, im Zielort gleich rechts vom Ankunftsplatz. */
  private setup(def: QuestDef) {
    const h = this.host, L = h.L;
    const step = this.step;
    let x = 0, y = 0;
    if (step === 0 && h.place.kind === 'start') {
      const re = L.riverEnd ?? L.width * 0.36;
      x = re + (L.width - re) * 0.26;
      y = 0;
    } else if (step === 1 && h.place.id === placeOf(h.ep, startPlace(h.ep).links[0]).id) {
      x = L.start.x + 640;
      y = L.start.y;
    } else return;
    x = clamp(x, 200, L.width - 200);
    const floor = groundAt(L.terrain.hp, x);
    if (!y) y = clamp(floor - 300, L.surfaceY + 220, floor - 150);
    // nicht im Fels
    for (let k = 0; k < 14 && (h.solidAt(x, y) || h.solidAt(x, y + 30)); k++) y -= 40;
    this.npc = new Gefaehrte(h, x, y);
    this.prompt = new Prompt(h, this.touchMode);
    void def;
  }

  // ---------------------------------------------------------------- Ablauf je Bild

  update(time: number, delta: number) {
    if (!this.def) return;
    const dt = Math.min(0.1, delta / 1000);
    const h = this.host, p = h.player;
    const npc = this.npc;
    if (npc && !npc.gone) {
      this.updateNpc(dt, time);
      if (this.busy || this.leaving) this.prompt?.update(dt, npc.x, npc.y, false);
      else {
        const d = Math.hypot(p.x - npc.x, p.y - npc.y);
        // sieht dich: dreht sich zu dir
        if (d < NOTICE_RANGE && Math.abs(p.x - npc.x) > 20) npc.dir = Math.sign(p.x - npc.x);
        const near = d < TALK_RANGE && !p.dead && !h.ended && !h.cineActive;
        this.prompt?.update(dt, npc.x, npc.y, near);
        if (near !== this.nearShown) {
          this.nearShown = near;
          bus.emit('talk', near);
        }
        if (near && (h.controls.pressed.talk || touch.talk)) this.begin();
      }
    }
    if (this.busy && (h.ended || p.dead)) this.abort();
    if (this.busy) this.holdPlayer();
    if (this.busy) this.runScene(dt, time);
    // die Kamera: auch nach der Szene sanft zurück
    this.cameraStep(dt);
    this.bubble.update(dt, h.cameras.main.worldView);
    this.mouth.update(time, npc && !npc.gone ? npc.view : undefined, this.busy && this.bubble.typing);
    if (this.eater && !this.eater.dead && this.eater.active) this.eaterStep(dt);
  }

  private updateNpc(dt: number, _time: number) {
    const npc = this.npc!;
    // wer fortgeschwommen ist, ist irgendwann aus der Welt
    if (this.leaving) {
      const h = this.host;
      const tx = npc.x + 400;
      const floor = groundAt(h.L.terrain.hp, clamp(tx, 0, h.L.width));
      const ty = clamp(npc.y, h.L.surfaceY + 180, floor - 170);
      npc.swimTo(tx, ty, 250, dt);
      if (npc.x > h.L.width + 140) {
        npc.destroy();
        this.leaving = false;
      }
    }
    npc.update(dt);
  }

  // ---------------------------------------------------------------- Szenen

  private begin() {
    const def = this.def!, h = this.host, p = h.player, npc = this.npc!;
    const step = this.step;
    this.busy = true;
    this.nearShown = false;
    bus.emit('talk', false);
    // Kamera: dem eigenen Tier nicht mehr folgen, sondern auf beide Tiere richten
    const cam = h.cameras.main;
    cam.stopFollow();
    const v = cam.worldView;
    this.cam.fx = v.centerX;
    this.cam.fy = v.centerY;
    this.cam.kTo = 1;
    this.zb = 0;
    this.zbTo = 0.34;
    p.shielded = true;
    // das eigene Tier schwimmt an seinen Platz neben dem Gefährten (auf der Seite, auf der es gerade ist)
    const side = p.x >= npc.x ? 1 : -1;
    let hy = npc.y + 12;
    for (let k = 0; k < 10 && h.solidAt(npc.x + side * 250, hy); k++) hy -= 40;
    this.hold = { x: clamp(npc.x + side * 250, 80, h.L.width - 80), y: hy };
    // Räuber ringsum ziehen ab (und kein Tier hat es mehr auf dich abgesehen – siehe LevelScene.truce): Dies ist ein stiller Moment
    for (const a of [...h.animals]) {
      if (a.dead || a.scripted || Math.hypot(a.x - npc.x, a.y - npc.y) > 1500) continue;
      if (a.target === p) a.target = null;
      if (a.role !== 'prey') a.backOff(npc.x);
    }
    p.facing = npc.x >= p.x ? 1 : -1;
    npc.dir = p.x >= npc.x ? 1 : -1;
    npc.vx = npc.vy = 0;
    bus.emit('cine', true);
    audio.musicLevel(0.35, 1.6);
    this.advanceAt = 0;
    this.wantAdvance = false;
    const say = (s: string) => ({ say: s.replace('{ort}', this.targetName) });
    const first = step === 0;
    this.steps = [{ wait: 1100 }];
    if (first) {
      for (const s of def.first) this.steps.push(say(s));
      this.steps.push({
        run: () => {
          // er schwimmt vor – der Auftrag geht weiter
          game.setQuestStep(def.id, 1);
          this.leaving = true;
        },
      });
      this.steps.push({ wait: 1900 });
    } else {
      for (const s of def.second) this.steps.push(say(s));
      this.steps.push(say(def.hear));
      this.steps.push({ run: () => this.hear() });
      this.steps.push({ wait: 2000 });
      this.steps.push({ run: () => this.spawnEater() });
      this.steps.push({ until: (dt) => this.eaterApproach(dt) });
      this.steps.push({ until: (dt) => this.eaterStrike(dt) });
      this.steps.push({ wait: 1300 });
      this.steps.push({ run: () => this.eaterLeave() });
      this.steps.push({ wait: 2600 });
    }
    this.steps.push({ run: () => this.end() });
    this.si = -1;
    this.nextStep();
  }

  private nextStep(): void {
    this.si++;
    const s = this.steps[this.si];
    if (!s) return;
    const npc = this.npc;
    if ('say' in s) {
      // ohne Sprecher gibt es nichts zu sagen
      if (!npc || npc.gone) return this.nextStep();
      this.bubble.show(() => ({ x: npc.x, y: npc.y - 28 }), s.say);
      this.advanceAt = this.host.time.now + 650;
      this.wantAdvance = false;
    } else if ('wait' in s) this.waitMs = s.wait;
    else if ('run' in s) {
      s.run();
      if (this.busy) this.nextStep();
    }
  }

  private runScene(dt: number, time: number) {
    const s = this.steps[this.si];
    if (!s) return;
    const npc = this.npc;
    const h = this.host, p = h.player;
    // Blickrichtung zueinander, solange nichts anderes im Spiel ist
    if (npc && !npc.gone && this.looking) {
      npc.dir = p.x >= npc.x ? 1 : -1;
      p.facing = npc.x >= p.x ? 1 : -1;
    }
    if ('say' in s) {
      const ok = time >= this.advanceAt;
      if (this.wantAdvance && ok) {
        this.wantAdvance = false;
        if (this.bubble.typing) this.bubble.finish();
        else {
          this.bubble.hide();
          this.nextStep();
        }
      } else this.wantAdvance = false;
    } else if ('wait' in s) {
      this.waitMs -= dt * 1000;
      if (this.waitMs <= 0) this.nextStep();
    } else if ('until' in s) {
      if (s.until(dt)) this.nextStep();
    }
  }

  private looking = true;

  /** Die Szene ist zu Ende: Balken weg, die Kamera folgt wieder dem eigenen Tier. */
  private end() {
    const h = this.host, p = h.player;
    this.busy = false;
    this.cam.kTo = 0;
    p.shielded = false;
    this.bubble.hide();
    bus.emit('cine', false);
    audio.musicLevel(1, 2);
    audio.sea(h.water ? 0.08 : 0, 2.5);
    h.cameras.main.startFollow(p.rect, true, 0.1, 0.1);
    h.cameras.main.setDeadzone(90, 70);
    this.looking = true;
  }

  /** Alles abbrechen (das Zeitalter ist vorbei oder das Tier tot). */
  abort() {
    if (!this.busy) return;
    this.busy = false;
    this.bubble.hide();
    bus.emit('cine', false);
    this.host.player.shielded = false;
    this.steps = [];
  }

  /** Das eigene Tier bleibt während der Szene an seinem Platz und schwebt nur leicht. */
  private holdPlayer() {
    const p = this.host.player, hold = this.hold;
    if (!hold) return;
    const t = this.host.time.now / 1000;
    p.body.setVelocity(clamp((hold.x - p.x) * 2.2, -340, 340), clamp((hold.y + Math.sin(t * 1.4) * 6 - p.y) * 2.2, -340, 340));
  }

  // ---------------------------------------------------------------- Kamera

  private cameraStep(dt: number) {
    const h = this.host, cam = h.cameras.main, p = h.player;
    const c = this.cam;
    c.k += (c.kTo - c.k) * Math.min(1, dt * 2.2);
    if (c.k < 0.003 && c.kTo === 0) {
      if (c.k !== 0) {
        c.k = 0;
        cam.setZoom(h.camZoom);
      }
      return;
    }
    this.zb += (this.zbTo - this.zb) * Math.min(1, dt * 1.6);
    cam.setZoom(h.camZoom * (1 + this.zb * c.k));
    if (this.busy) {
      // der Mittelpunkt zwischen den beteiligten Tieren (etwas nach oben, damit die Sprechblase Platz hat)
      const npc = this.npc;
      const pts = [{ x: p.x, y: p.y }];
      if (npc && !npc.gone) pts.push({ x: npc.x, y: npc.y });
      if (this.eater && this.eater.active && !this.eater.dead) pts.push({ x: this.eater.x, y: this.eater.y });
      const mx = pts.reduce((s, q) => s + q.x, 0) / pts.length, my = pts.reduce((s, q) => s + q.y, 0) / pts.length - 24;
      c.fx += (mx - c.fx) * Math.min(1, dt * 3);
      c.fy += (my - c.fy) * Math.min(1, dt * 3);
      cam.centerOn(c.fx, c.fy);
    }
  }

  /** Wie weit die Kamera heranrückt (gesprochen: nah; wenn das große Tier kommt: etwas weiter zurück) */
  private zb = 0;
  private zbTo = 0.34;

  // ---------------------------------------------------------------- das große Tier

  private hear() {
    const h = this.host, npc = this.npc!, p = h.player;
    // beide schauen sich um: erst voneinander weg, dann zueinander, dann dorthin, woher es kommt (rechts)
    this.looking = false;
    const side = p.x >= npc.x ? 1 : -1;
    npc.dir = -side;
    p.facing = side;
    audio.sfx('rumble');
    audio.sea(0.5, 1.5);
    h.cameras.main.shake(2200, 0.0022);
    h.time.delayedCall(650, () => {
      if (npc.gone) return;
      npc.dir = side;
      p.facing = -side;
    });
    h.time.delayedCall(1300, () => {
      if (npc.gone) return;
      npc.dir = 1;
      p.facing = 1;
    });
    npc.fear = 0.6;
  }

  private spawnEater() {
    const def = this.def!, h = this.host, npc = this.npc!;
    const sp = SPECIES[def.eater];
    makeSpeciesTextures(h, sp);
    const v = h.cameras.main.worldView;
    const x = Math.max(v.right + 200, npc.x + 900);
    const a = new Animal(h, sp, x, npc.y - 10);
    a.scripted = true;
    a.dir = -1;
    a.setFlipX(true);
    a.setAlpha(0);
    h.tweens.add({ targets: a, alpha: 1, duration: 900 });
    h.animals.push(a);
    this.eater = a;
    this.zbTo = 0.1;
    this.atk = '';
    this.atkT = 0;
  }

  private atk: '' | 'wind' | 'strike' | 'chew' = '';
  private atkT = 0;

  /** Es schwimmt langsam heran. */
  private eaterApproach(dt: number) {
    const a = this.eater, npc = this.npc;
    if (!a || !npc) return true;
    const gap = a.x - npc.x;
    const sp = 230;
    a.b.setVelocity(-sp, (npc.y - 6 - a.y) * 0.6);
    npc.fear = Math.min(1, npc.fear + dt * 0.3);
    a.setFlipX(true);
    if (gap < 330) {
      a.b.setVelocity(0, 0);
      this.atk = 'wind';
      this.atkT = 0;
      npc.fear = 1;
      return true;
    }
    return false;
  }

  /** Ausholen, zuschnappen – und der Gefährte ist verschwunden. */
  private eaterStrike(dt: number) {
    const a = this.eater, npc = this.npc;
    if (!a || !npc) return true;
    const h = this.host;
    this.atkT += dt;
    const WIND = 0.9;
    if (this.atk === 'wind') {
      const k = Math.min(1, this.atkT / WIND);
      a.b.setVelocityX(40 * k);
      a.setScale(a.sz * (1 - 0.16 * k), a.sz * (1 + 0.1 * k));
      a.setTint(k > 0.5 ? 0xff9a82 : 0xffb8a8);
      if (this.atkT >= WIND) {
        this.atk = 'strike';
        this.atkT = 0;
        audio.sfx('growl');
      }
      return false;
    }
    // vorschnellen
    a.clearTint();
    a.setScale(a.sz * 1.14, a.sz * 0.93);
    a.b.setVelocity(-520, (npc.y - a.y) * 3);
    const mouth = a.x - a.displayWidth * 0.46;
    if (mouth <= npc.x + 30 || this.atkT > 1.4) {
      a.b.setVelocity(0, 0);
      this.swallow();
      return true;
    }
    void h;
    return false;
  }

  /** Der Gefährte verschwindet im Maul. */
  private swallow() {
    const a = this.eater!, npc = this.npc!, h = this.host;
    const mx = a.x - a.displayWidth * 0.46, my = a.y;
    npc.swallowed = true;
    h.tweens.add({ targets: npc.view, x: mx, y: my, scaleX: 0.25, scaleY: 0.25, alpha: 0.2, duration: 160, onComplete: () => npc.destroy() });
    npc.vx = npc.vy = 0;
    h.bleed(mx, my, 14);
    h.puff(mx, my, 10, 0xffc0b0);
    h.cameras.main.shake(260, 0.012);
    audio.sfx('bite');
    h.time.delayedCall(120, () => audio.sfx('snarl'));
    h.time.delayedCall(420, () => audio.sfx('chew'));
    game.setQuestStep(this.def!.id, 2);
    this.atk = 'chew';
    // das Tier kaut kurz
    h.tweens.add({ targets: a, scaleX: a.sz, scaleY: a.sz, duration: 260 });
  }

  /** Es schwimmt gemächlich davon. */
  private eaterLeave() {
    const a = this.eater;
    if (!a) return;
    a.dir = 1;
    a.setFlipX(false);
    a.clearTint();
    this.atk = '';
    this.leaveAt = this.host.time.now;
    this.zbTo = 0.05;
  }

  private leaveAt = 0;

  private eaterStep(dt: number) {
    const a = this.eater!;
    if (this.leaveAt) {
      const t = (this.host.time.now - this.leaveAt) / 1000;
      a.b.setVelocity(Math.min(190, 50 + t * 40), -6);
      const v = this.host.cameras.main.worldView;
      if (a.x - a.displayWidth > v.right + 60 || t > 14) {
        this.host.dropAnimal(a);
        a.vanish();
        this.eater = undefined;
      }
    }
    void dt;
  }

  /** Wahr, solange gerade ein Auftrag das Spiel in der Hand hat (kein Kino-Moment des Riesen im Hintergrund). */
  get active() {
    return this.busy;
  }

  destroy() {
    for (const o of this.offs) o();
    this.offs = [];
    this.npc?.destroy();
    this.prompt?.destroy();
    this.bubble.destroy();
    this.mouth.destroy();
    bus.emit('talk', false);
  }
}
