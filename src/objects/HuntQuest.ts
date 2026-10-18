import { LEVEL_ZOOM } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { JAGD } from '../data/quests';
import { placeOf, startPlace } from '../data/world';
import { clamp } from '../util/math';
import { touch } from './Controls';
import type { Animal } from './Animal';
import { Kin } from './Kin';
import { Bubble, Mouth, Prompt } from './Quest';
import type { LevelScene } from '../scenes/LevelScene';

// Der Auftrag „Die gemeinsame Jagd“ (Daten und Zielzahlen: data/quests.ts, JAGD). Nachdem der Gefährte gefressen wurde, wartet
// im selben Ort eine kleine Gruppe Überlebender deiner Art – echte Artgenossen mit ihrem gewohnten Verhalten. Einer erzählt von
// einem Schwarm Sacabambaspis und fragt, ob du mitjagst. Sagst du ja, folgt dir die Gruppe; der Schwarm (kräftige Tiere, die
// sich mit einem Gegenstoß wehren und fliehen) zieht ein Stück entfernt. Gejagt wird mit den üblichen Mitteln: Greifst du an,
// helfen die Artgenossen mit. Sind genug erlegt und du warst selbst dabei, erklärt dir einer der Überlebenden, wie du die
// Gruppe künftig rufen kannst. Wer dabei stirbt, fehlt der Gruppe für immer (game.swarm).

const Z = LEVEL_ZOOM;
const TALK_RANGE = 300;
/** Kennungen für den Schwarm der Beute und die wartende Gruppe (wie die Schwärme und Rudel des Ortes) */
const SCHOOL_HERD = 90001, GROUP_HERD = 90002;

type Step = { say: string } | { ask: true } | { wait: number } | { run: () => void };

/** „{n} von {k}“ – Platzhalter in den Texten füllen. */
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

export class HuntQuest {
  /** Gespräch läuft: Steuerung gesperrt, Kamera bei den Tieren */
  busy = false;
  /** Gruppe bzw. Schwarm sind an diesem Ort aufgestellt */
  private on = false;
  /** hier wartet die Gruppe und zieht der Schwarm (der Ort, in dem der Gefährte gefressen wurde) */
  private here = false;
  private placeName = '';
  private meet = { x: 0, y: 0 };
  private den = { x: 0, y: 0 };
  /** die wartende Gruppe (vor der Jagd) */
  private group: Kin[] = [];
  /** wer im Gespräch innehält */
  private cast: Kin[] = [];
  private speaker?: Kin;
  private school = new Set<Animal>();
  private bubble: Bubble;
  private mouth: Mouth;
  private prompt?: Prompt;
  private steps: Step[] = [];
  private si = -1;
  private waitMs = 0;
  private advanceAt = 0;
  private wantAdvance = false;
  /** die Frage ist gestellt: ja (0) oder nein (1) */
  private choosing = false;
  private sel = 0;
  private nearShown = false;
  private touchMode: boolean;
  private offs: (() => void)[] = [];
  private cam = { k: 0, kTo: 0, fx: 0, fy: 0 };
  private hold?: { x: number; y: number };
  /** der Schwarm sammelt sich neu (bis dahin) */
  private regroupAt = 0;
  private hudAt = 0;
  private hudKey = '';

  constructor(private host: LevelScene) {
    this.bubble = new Bubble(host);
    this.mouth = new Mouth(host);
    this.touchMode = host.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    const ep = host.ep;
    if (host.water && ep.id === JAGD.epoch) {
      const place = placeOf(ep, startPlace(ep).links[0]);
      this.here = host.place.id === place.id;
      this.placeName = place.name;
    }
    const kb = host.input.keyboard;
    const adv = () => {
      if (this.choosing) this.pick(this.sel);
      else this.wantAdvance = true;
    };
    const move = (d: number) => () => {
      if (!this.choosing) return;
      this.sel = (this.sel + d + 2) % 2;
      audio.sfx('click');
      bus.emit('choice', [JAGD.lines.yes, JAGD.lines.no], this.sel);
    };
    const tap = () => {
      if (!this.choosing) this.wantAdvance = true;
    };
    const onPick = (i: number) => this.choosing && this.pick(i);
    const left = move(-1), right = move(1);
    kb?.on('keydown-F', adv);
    kb?.on('keydown-ENTER', adv);
    kb?.on('keydown-SPACE', adv);
    kb?.on('keydown-LEFT', left);
    kb?.on('keydown-A', left);
    kb?.on('keydown-RIGHT', right);
    kb?.on('keydown-D', right);
    host.input.on('pointerdown', tap);
    bus.on('choicePick', onPick);
    this.offs.push(() => {
      kb?.off('keydown-F', adv);
      kb?.off('keydown-ENTER', adv);
      kb?.off('keydown-SPACE', adv);
      kb?.off('keydown-LEFT', left);
      kb?.off('keydown-A', left);
      kb?.off('keydown-RIGHT', right);
      kb?.off('keydown-D', right);
      host.input.off('pointerdown', tap);
      bus.off('choicePick', onPick);
    });
    host.events.once('shutdown', () => this.destroy());
  }

  private get step() {
    return game.questStep(JAGD.id);
  }

  /** Der gespeicherte Stand der Jagd. */
  private get state() {
    const r = game.run!;
    r.hunt ??= { kills: 0, took: false, size: 0 };
    return r.hunt;
  }

  /** Läuft der Auftrag in diesem Zeitalter (der Gefährte ist gefressen, die Jagd noch nicht geschafft)? */
  private get open() {
    const h = this.host;
    return h.water && h.ep.id === JAGD.epoch && !!game.run && game.questStep(JAGD.after) >= 2 && this.step < 3;
  }

  // ---------------------------------------------------------------- Aufstellen

  /** Treffpunkt und Revier des Schwarms: im freien Wasser, weit genug auseinander – unabhängig davon, von wo man kommt. */
  private placeSpots() {
    const h = this.host, L = h.L;
    const spot = (x: number) => {
      let y = h.openY(x);
      for (let k = 0; k < 14 && (h.solidAt(x, y) || h.solidAt(x, y + 30)); k++) y -= 40;
      return { x, y: Math.max(y, h.surfaceY + 120) };
    };
    const mx = clamp(L.width * 0.42, 400, L.width - 400);
    const dir = mx + JAGD.far < L.width - 300 ? 1 : -1;
    this.meet = spot(mx);
    this.den = spot(clamp(mx + dir * JAGD.far, 300, L.width - 300));
  }

  private setup() {
    if (this.on || !this.here || !this.open) return;
    this.on = true;
    this.placeSpots();
    if (this.step <= 1) this.spawnGroup();
    else this.spawnSchool();
  }

  /** Die Überlebenden warten am Treffpunkt (beim ersten Mal entsteht die Gruppe deiner Art). */
  private spawnGroup() {
    const h = this.host;
    const [g0, g1] = JAGD.group;
    const s = game.swarm ?? game.foundSwarm(g0 + Math.floor(Math.random() * (g1 - g0 + 1)));
    const n = s.members.length;
    s.members.forEach((m, i) => {
      const want = { x: this.meet.x + (i - (n - 1) / 2) * 70, y: this.meet.y + (i % 2 ? 36 : -28) };
      const at = h.kinSpot(want.x, want.y) ?? want;
      const k = h.spawnMember(m, at.x, at.y);
      k.home = { x: this.meet.x, y: this.meet.y };
      k.loyalty = Math.max(k.loyalty, 0.62);
      h.joinHerd(k, GROUP_HERD);
      this.group.push(k);
    });
    this.prompt = new Prompt(h, this.touchMode);
  }

  /** Der Schwarm Sacabambaspis: kräftige Tiere (sie wehren sich), die in ihrem Revier bleiben. Erlegte kommen nicht wieder. */
  private spawnSchool(count?: number) {
    const h = this.host, st = this.state;
    const n = count ?? Math.max(JAGD.kills - st.kills, JAGD.school - st.kills, 1);
    const [s0, s1] = JAGD.size;
    for (let i = 0; i < n; i++) {
      const a = h.spawnAnimal(JAGD.prey, this.den.x + (Math.random() - 0.5) * 260, this.den.y + (Math.random() - 0.5) * 140, SCHOOL_HERD);
      a.sz = s0 + Math.random() * (s1 - s0);
      a.setScale(a.sz);
      a.hp = a.maxHp = Math.round(a.def.hp * a.sz);
      a.home = { x: this.den.x, y: this.den.y };
      a.bound = true;
      this.school.add(a);
    }
  }

  // ---------------------------------------------------------------- Ablauf je Bild

  update(time: number, delta: number) {
    const h = this.host, p = h.player;
    const dt = Math.min(0.1, delta / 1000);
    if (!this.on && !h.quest?.busy && !h.ended) this.setup();
    // wer im Revier wartet, ist der Sprecher (stirbt er, spricht ein anderer)
    if (this.step <= 1 && (!this.speaker || this.speaker.dead)) this.speaker = this.group.find((k) => !k.dead);
    const sp = this.speaker;
    if (this.prompt && this.step <= 1) {
      const near = !!sp && !sp.dead && !this.busy && !p.dead && !h.ended && !h.cineActive && !h.quest?.busy && Math.hypot(p.x - sp.x, p.y - sp.y) < TALK_RANGE;
      this.prompt.update(dt, sp?.x ?? 0, sp?.y ?? 0, near);
      if (near !== this.nearShown) {
        this.nearShown = near;
        bus.emit('talk', near);
      }
      if (near && (h.controls.pressed.talk || touch.talk)) this.begin(this.step === 0 ? JAGD.lines.first : JAGD.lines.again, true);
    }
    if (this.busy && (h.ended || p.dead)) this.abort();
    if (this.busy) {
      this.holdPlayer();
      this.runScene(dt, time);
    }
    this.cameraStep(dt);
    this.bubble.update(dt, h.cameras.main.worldView);
    this.mouth.update(time, sp && !sp.dead ? sp.view : undefined, this.busy && this.bubble.typing);
    if (this.step === 2 && !this.busy && this.open) this.huntStep(time);
  }

  /** Die Jagd: neu sammeln, wenn zu wenige Tiere übrig sind; geschafft, wenn genug erlegt sind und du dabei warst. */
  private huntStep(time: number) {
    const st = this.state;
    if (this.on) {
      for (const a of this.school) if (!a.active) this.school.delete(a);
      const alive = [...this.school].filter((a) => !a.dead).length;
      const need = st.took ? JAGD.kills - st.kills : Math.max(1, JAGD.kills - st.kills);
      if (alive < need) {
        if (!this.regroupAt) this.regroupAt = time + JAGD.regroup * 1000;
        else if (time >= this.regroupAt) {
          this.regroupAt = 0;
          this.spawnSchool(need - alive);
        }
      } else this.regroupAt = 0;
    }
    if (st.kills >= JAGD.kills && st.took) return this.finish();
    if (time > this.hudAt) {
      this.hudAt = time + 300;
      this.hud();
    }
  }

  /** Ziel und Fortschritt in der Anzeige (oben links). */
  private hud() {
    const st = this.state, H = JAGD.hud;
    const lines = [fill(H.goal, { n: st.kills, k: JAGD.kills }), fill(H.group, { a: game.swarm?.members.length ?? 0, g: st.size })];
    if (!this.here) lines.push(fill(H.away, { ort: this.placeName }));
    else if (this.regroupAt) lines.push(H.regroup);
    else if (st.kills >= JAGD.kills && !st.took) lines.push(H.join);
    else {
      const live = [...this.school].filter((a) => !a.dead);
      const p = this.host.player;
      if (live.length) {
        const cx = live.reduce((s, a) => s + a.x, 0) / live.length;
        if (Math.abs(cx - p.x) > 900) lines.push(fill(H.where, { dir: cx > p.x ? 'rechts' : 'links' }));
      }
    }
    const key = lines.join('|');
    if (key === this.hudKey) return;
    this.hudKey = key;
    bus.emit('questHud', { title: H.title, lines });
  }

  // ---------------------------------------------------------------- Ereignisse aus dem Level

  /** Du hast ein Tier des Schwarms getroffen: Du jagst selbst mit. */
  hit(a: Animal) {
    if (this.step !== 2 || !this.school.has(a) || this.state.took) return;
    this.state.took = true;
    game.save();
  }

  /** Ein Tier ist gestorben: Zählt es für die Jagd (von dir oder deinen Artgenossen erlegt)? */
  died(a: Animal, byPlayer: boolean) {
    if (!this.school.has(a)) return;
    this.school.delete(a);
    if (this.step !== 2) return;
    const h = this.host, st = this.state;
    const yours = byPlayer || h.time.now - a.hitByPlayerAt < 8000;
    const killer = a.lastAttacker;
    if (yours || killer === h.player || killer instanceof Kin) st.kills++;
    if (yours) st.took = true;
    game.save();
    this.hudKey = '';
  }

  // ---------------------------------------------------------------- Gespräche

  /** Ein Gespräch beginnt: die Kamera rückt heran, die Gruppe hält inne, Räuber ringsum ziehen ab. */
  private begin(lines: string[], offer: boolean) {
    const h = this.host, p = h.player, sp = this.speaker;
    if (!sp || sp.dead) return;
    this.busy = true;
    this.nearShown = false;
    bus.emit('talk', false);
    const cam = h.cameras.main;
    cam.stopFollow();
    const v = cam.worldView;
    this.cam.fx = v.centerX;
    this.cam.fy = v.centerY;
    this.cam.kTo = 1;
    p.shielded = true;
    const side = p.x >= sp.x ? 1 : -1;
    let hy = sp.y + 12;
    for (let k = 0; k < 10 && h.solidAt(sp.x + side * 240, hy); k++) hy -= 40;
    this.hold = { x: clamp(sp.x + side * 240, 80, h.L.width - 80), y: hy };
    for (const a of [...h.animals]) {
      if (a.dead || a.scripted || a.kin || a.boss || Math.hypot(a.x - sp.x, a.y - sp.y) > 1500) continue;
      if (a.target === p) a.target = null;
      if (a.role !== 'prey') a.backOff(sp.x);
    }
    // wer dabei ist, hält inne (und kann in diesem Moment nicht angegriffen werden)
    this.cast = (this.group.length ? this.group : h.swarm?.present ?? []).filter((k) => !k.dead);
    for (const k of this.cast) {
      k.scripted = true;
      k.b.setVelocity(0, 0);
    }
    p.facing = sp.x >= p.x ? 1 : -1;
    sp.dir = p.x >= sp.x ? 1 : -1;
    bus.emit('cine', true);
    audio.musicLevel(0.35, 1.6);
    this.advanceAt = 0;
    this.wantAdvance = false;
    this.steps = [{ wait: 900 }, ...lines.map((s) => ({ say: s }))];
    if (offer) this.steps.push({ ask: true });
    this.steps.push({ run: () => this.end() });
    this.si = -1;
    this.nextStep();
  }

  private nextStep(): void {
    this.si++;
    const s = this.steps[this.si];
    if (!s) return;
    const sp = this.speaker;
    if ('say' in s || 'ask' in s) {
      if (!sp || sp.dead) return this.nextStep();
      this.bubble.show(() => ({ x: sp.x, y: sp.y - 28 }), 'say' in s ? s.say : JAGD.lines.ask, 'ask' in s);
      this.advanceAt = this.host.time.now + 650;
      this.wantAdvance = false;
    } else if ('wait' in s) this.waitMs = s.wait;
    else {
      s.run();
      if (this.busy) this.nextStep();
    }
  }

  private runScene(dt: number, time: number) {
    const s = this.steps[this.si];
    if (!s) return;
    const sp = this.speaker, p = this.host.player;
    if (sp && !sp.dead) {
      sp.dir = p.x >= sp.x ? 1 : -1;
      p.facing = sp.x >= p.x ? 1 : -1;
    }
    if ('say' in s || 'ask' in s) {
      if ('ask' in s && !this.bubble.typing && !this.choosing) {
        // die Frage steht: ja oder nein
        this.choosing = true;
        this.sel = 0;
        bus.emit('choice', [JAGD.lines.yes, JAGD.lines.no], this.sel);
        return;
      }
      const ok = time >= this.advanceAt;
      if (this.wantAdvance && ok) {
        this.wantAdvance = false;
        if (this.bubble.typing) this.bubble.finish();
        else if ('say' in s) {
          this.bubble.hide();
          this.nextStep();
        }
      } else this.wantAdvance = false;
    } else if ('wait' in s) {
      this.waitMs -= dt * 1000;
      if (this.waitMs <= 0) this.nextStep();
    }
  }

  /** Die Antwort: Ja – die Jagd beginnt; nein – die Gruppe wartet weiter (man kann es sich anders überlegen). */
  private pick(i: number) {
    this.choosing = false;
    bus.emit('choice', null, 0);
    this.bubble.hide();
    audio.sfx('select');
    const yes = i === 0;
    const then: Step[] = (yes ? JAGD.lines.accept : JAGD.lines.decline).map((s) => ({ say: s }));
    then.push({ run: () => (yes ? this.startHunt() : game.setQuestStep(JAGD.id, 1)) });
    this.steps.splice(this.si + 1, 0, ...then);
    this.advanceAt = this.host.time.now + 450;
    this.nextStep();
  }

  /** Die Jagd beginnt: Die Gruppe folgt dir, der Schwarm zieht in seinem Revier. */
  private startHunt() {
    const h = this.host;
    game.setQuestStep(JAGD.id, 2);
    const st = this.state;
    st.kills = 0;
    st.took = false;
    st.size = game.swarm?.members.length ?? 0;
    this.spawnSchool();
    const s = game.swarm;
    this.group.filter((k) => !k.dead).forEach((k, i) => {
      k.escort = true;
      k.slot = i;
      h.leaveHerd(k);
    });
    if (s) s.out = this.group.filter((k) => !k.dead).map((k) => k.memberId!);
    this.group = [];
    this.prompt?.destroy();
    this.prompt = undefined;
    game.save();
    h.swarm?.emit();
  }

  /**
   * Geschafft: Wer überlebt hat, gehört fortan zu deiner Gruppe und kommt auf deinen Ruf – das erklärt dir einer von ihnen.
   * Hat keiner überlebt, bleibt nur die Beute.
   */
  private finish() {
    const h = this.host, s = game.swarm;
    game.setQuestStep(JAGD.id, 3);
    this.prompt?.destroy();
    this.prompt = undefined;
    const H = JAGD.hud;
    if (!s || !s.members.length) {
      bus.emit('questHud', { title: H.title, lines: [H.lost] });
      h.time.delayedCall(6000, () => bus.emit('questHud', null));
      return;
    }
    s.callable = true;
    game.save();
    bus.emit('questHud', null);
    const p = h.player;
    const present = (h.swarm?.present ?? []).filter((k) => !k.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    this.speaker = present[0];
    if (!this.speaker) return h.swarm?.emit();
    const ruf = this.touchMode ? 'mit dem Knopf oben rechts' : 'mit der Taste S';
    this.begin(JAGD.lines.success.map((l) => l.replace('{ruf}', ruf)), false);
  }

  /** Das Gespräch ist zu Ende: Balken weg, die Kamera folgt wieder dir, die Gruppe bewegt sich wieder. */
  private end() {
    const h = this.host, p = h.player;
    this.busy = false;
    this.cam.kTo = 0;
    p.shielded = false;
    this.bubble.hide();
    for (const k of this.cast) k.scripted = false;
    this.cast = [];
    bus.emit('cine', false);
    audio.musicLevel(1, 2);
    h.cameras.main.startFollow(p.rect, true, 0.1, 0.1);
    h.cameras.main.setDeadzone(90, 70);
    h.swarm?.emit();
    this.hudKey = '';
  }

  /** Alles abbrechen (das Zeitalter ist vorbei oder das Tier tot). */
  abort() {
    if (!this.busy) return;
    this.busy = false;
    this.choosing = false;
    bus.emit('choice', null, 0);
    this.bubble.hide();
    bus.emit('cine', false);
    this.host.player.shielded = false;
    for (const k of this.cast) k.scripted = false;
    this.cast = [];
    this.steps = [];
  }

  /** Das eigene Tier bleibt während des Gesprächs an seinem Platz und schwebt nur leicht. */
  private holdPlayer() {
    const p = this.host.player, hold = this.hold;
    if (!hold) return;
    const t = this.host.time.now / 1000;
    p.body.setVelocity(clamp((hold.x - p.x) * 2.2, -340, 340), clamp((hold.y + Math.sin(t * 1.4) * 6 - p.y) * 2.2, -340, 340));
  }

  /** Die Kamera: im Gespräch nah bei beiden Tieren, danach sanft zurück. */
  private cameraStep(dt: number) {
    const h = this.host, cam = h.cameras.main, p = h.player, c = this.cam;
    c.k += (c.kTo - c.k) * Math.min(1, dt * 2.2);
    if (c.k < 0.003 && c.kTo === 0) {
      if (c.k !== 0) {
        c.k = 0;
        cam.setZoom(Z);
      }
      return;
    }
    cam.setZoom(Z * (1 + 0.34 * c.k));
    if (this.busy) {
      const sp = this.speaker;
      const mx = sp && !sp.dead ? (p.x + sp.x) / 2 : p.x, my = (sp && !sp.dead ? (p.y + sp.y) / 2 : p.y) - 24;
      c.fx += (mx - c.fx) * Math.min(1, dt * 3);
      c.fy += (my - c.fy) * Math.min(1, dt * 3);
      cam.centerOn(c.fx, c.fy);
    }
  }

  destroy() {
    for (const o of this.offs) o();
    this.offs = [];
    this.prompt?.destroy();
    this.bubble.destroy();
    this.mouth.destroy();
    bus.emit('choice', null, 0);
  }
}
