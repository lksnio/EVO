import { audio } from '../audio/Audio';
import { SWARM } from '../data/swarm';
import { bus, game, type Member } from '../state/GameState';
import { clamp } from '../util/math';
import type { Kill, Meat } from './Food';
import { Kin } from './Kin';
import type { LevelScene } from '../scenes/LevelScene';

/** Was das HUD über deine Gruppe wissen muss. */
export interface SwarmInfo {
  /** kommt auf deinen Ruf */
  callable: boolean;
  /** so viele leben */
  size: number;
  /** gerade bei dir */
  out: boolean;
  /** jetzt rufbar (nicht gerade fortgeschickt) */
  ready: boolean;
}

/**
 * Deine Gruppe im Level. Wer dazugehört, steht im Spielstand (game.swarm) – hier werden die Tiere dazu erzeugt und begleitet:
 *   – Rufen (Taste S): Die Artgenossen schwimmen von außerhalb des Bildes herbei – so viele, wie leben (höchstens game.swarmCap()) –,
 *     folgen dir locker und helfen bei jedem Angriff (LevelScene.callHunt). Nochmal S schickt sie fort; sie bleiben am Leben.
 *   – Wer gerufen ist, kommt beim Ortswechsel mit; seine Lebenskraft bleibt bis zur nächsten Generation, wie sie ist.
 *   – Wer stirbt, fehlt fortan; wer von gemeinsam erlegter Beute mitfrisst, lockt nach und nach weitere an (game.swarmShared).
 */
export class SwarmCtl {
  /** frühestens dann kann man wieder rufen */
  private readyAt = 0;
  private wasReady = true;
  /** geteilte Beute, die schon gezählt ist (jede Beute zählt einmal) */
  private counted = new WeakSet<Kill>();

  constructor(private host: LevelScene) {
    const s = game.swarm;
    // wer bei dir war, als du den Ort gewechselt hast, kommt mit
    if (s?.out.length) this.bring(s.members.filter((m) => s.out.includes(m.id)), true);
    host.time.delayedCall(250, () => this.emit());
  }

  /** die Artgenossen deiner Gruppe, die gerade hier sind */
  get present(): Kin[] {
    return this.host.animals.filter((a): a is Kin => a instanceof Kin && a.memberId !== undefined && !a.dead);
  }

  /** wer dich gerade begleitet */
  get escorts(): Kin[] {
    return this.present.filter((k) => k.escort);
  }

  update(time: number) {
    const ready = time >= this.readyAt;
    if (ready !== this.wasReady) {
      this.wasReady = ready;
      this.emit();
    }
  }

  /** Taste S: rufen – oder, wenn sie gerade bei dir sind, fortschicken. */
  toggle() {
    const s = game.swarm, h = this.host;
    if (!s?.callable || h.ended || h.player.dead) return;
    const now = h.time.now;
    const escorts = this.escorts;
    if (escorts.length) {
      for (const k of escorts) this.sendOff(k);
      s.out = [];
      this.readyAt = now + SWARM.cooldown;
      audio.sfx('snub');
      game.save();
      this.emit();
      return;
    }
    // wer gerade fortgeschickt davonschwimmt, kehrt um; die übrigen kommen von außerhalb des Bildes
    const back = this.present.filter((k) => k.homeward);
    const here = new Set(this.present.map((k) => k.memberId));
    const pick = s.members.filter((m) => !here.has(m.id)).slice(0, Math.max(0, game.swarmCap() - back.length));
    if (now < this.readyAt || (!pick.length && !back.length)) {
      audio.sfx('fail');
      return;
    }
    audio.sfx('call');
    back.forEach((k, i) => k.recall(i));
    this.bring(pick, false);
    s.out = this.escorts.map((k) => k.memberId!);
    game.save();
    this.emit();
  }

  /** Artgenossen holen: von außerhalb des Bildes (gerufen) bzw. gleich hinter dir (beim Ortswechsel mitgekommen). */
  bring(list: Member[], withYou: boolean) {
    const h = this.host, p = h.player, v = h.cameras.main.worldView;
    const side = -(p.facing || 1);
    const first = this.escorts.length;
    list.forEach((m, i) => {
      const off = SWARM.spawnOff + 45 * i;
      const x = withYou ? p.x + side * (110 + 50 * i) : side < 0 ? v.x - off : v.right + off;
      const want = { x: clamp(x, 60, h.L.width - 60), y: p.y + ((i % 3) - 1) * 50 };
      const at = h.kinSpot(want.x, want.y) ?? { x: clamp(p.x + side * 60, 60, h.L.width - 60), y: p.y };
      const k = h.spawnMember(m, at.x, at.y);
      k.escort = true;
      k.slot = first + i;
      k.dir = Math.sign(p.x - at.x) || 1;
    });
  }

  /** Fortschicken: Er schwimmt davon – lebend, mit der Lebenskraft, die er gerade hat. */
  private sendOff(k: Kin) {
    this.store(k);
    k.dismiss();
  }

  /** Die Lebenskraft eines Artgenossen im Spielstand festhalten. */
  private store(k: Kin) {
    const m = game.swarm?.members.find((x) => x.id === k.memberId);
    if (m && !k.dead) m.hp = clamp(k.hp / Math.max(1, k.maxHp), 0.05, 1);
  }

  /** Vor dem Ortswechsel bzw. am Ende des Zeitalters: wer bei dir ist und wie es ihm geht. */
  storeAll() {
    const s = game.swarm;
    if (!s) return;
    for (const k of this.present) this.store(k);
    s.out = this.escorts.map((k) => k.memberId!);
  }

  /** Ein Artgenosse deiner Gruppe ist gestorben: Er fehlt fortan. */
  died(k: Kin) {
    if (k.memberId === undefined) return;
    game.swarmLose(k.memberId, true);
    this.emit();
  }

  /** Verärgert davongezogen (zu oft nichts von der Beute abbekommen): Er verlässt die Gruppe. */
  quit(k: Kin) {
    if (k.memberId === undefined) return;
    game.swarmLose(k.memberId, false);
    this.emit();
  }

  /** Lebend fortgeschwommen (fortgeschickt): Er bleibt in der Gruppe und kommt auf den nächsten Ruf. */
  gone(k: Kin) {
    this.store(k);
  }

  /**
   * Ein Artgenosse hat von gemeinsamer Beute mitgefressen: Das zählt für die Platte „Schwarmfisch“ – und nach einigen solchen
   * Mahlzeiten schließt sich ein weiterer Artgenosse an (er kommt gleich dazu, wenn die Gruppe gerade bei dir ist).
   */
  shared(k: Kin, c: Meat) {
    if (k.memberId === undefined || this.counted.has(c.kill)) return;
    this.counted.add(c.kill);
    this.host.train.pack += 1;
    const m = game.swarmShared();
    if (!m) return;
    audio.sfx('bond');
    if (this.escorts.length) {
      this.bring([m], false);
      game.swarm!.out = this.escorts.map((e) => e.memberId!);
    }
    this.emit();
  }

  /** Das HUD (Knopf mit der Zahl) auf den neuesten Stand bringen. */
  emit() {
    const s = game.swarm;
    const info: SwarmInfo = { callable: !!s?.callable, size: s?.members.length ?? 0, out: this.escorts.length > 0, ready: this.host.time.now >= this.readyAt };
    bus.emit('swarm', info);
  }
}
