import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { audio } from '../audio/Audio';
import { Prompt } from '../ui/InteractionPrompt';
import type { NetSync } from '../net/NetSync';
import type { RemoteFish } from '../net/RemoteFish';
import type { LevelScene } from '../scenes/LevelScene';

/**
 * Die dunkle Höhle links im Laichfluss (Devon): Sind zwei Spieler darin, erscheint die Aktionstaste (E). Wer sie drückt, ist
 * eingeloggt – so lange, bis auch der andere einloggt (dann beginnt das Laichduell, siehe scenes/DuelScene.ts) oder bis man
 * die Höhle wieder verlässt. Was gilt, entscheidet der Server (ZoneRoom); hier wird nur gezeigt und gemeldet.
 */
export class DuelCave {
  private prompt: Prompt;
  private note: Phaser.GameObjects.Text;
  /** eben eingeloggt, die Antwort des Servers steht noch aus (bis dahin kein zweites Zeichen) */
  private asked = 0;
  private wasIn = false;
  /** Augenleuchten der Fische im Dunkeln der Höhle */
  private glints = new Map<object, Phaser.GameObjects.Image>();
  private t = 0;

  constructor(private host: LevelScene, private net: NetSync | undefined) {
    const touchMode = host.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.prompt = new Prompt(host, touchMode, 'bite');
    const c = host.L.cave!;
    this.note = host.add.text(c.x + c.w / 2, c.y - 70, '', { fontFamily: FONT, fontSize: '19px', color: '#e8d6b0', stroke: '#0a0907', strokeThickness: 4, resolution: 2, align: 'center' })
      .setOrigin(0.5, 1).setDepth(DEPTH.text - 1).setAlpha(0);
    host.events.once('shutdown', () => this.destroy());
  }

  /** Ist (x, y) in der Höhle? m: etwas Spielraum (am Eingang zählt man noch dazu). */
  inside(x: number, y: number, m = 0) {
    const c = this.host.L.cave!;
    return x > c.x - m && x < c.x + c.w + m && y > c.y - m && y < c.y + c.h + m;
  }

  /** Die anderen Spieler, die gerade in der Höhle sind. */
  private mates(): RemoteFish[] {
    return (this.net?.players() ?? []).filter((f) => !f.dead && this.inside(f.x, f.y, 30));
  }

  /** Jetzt einloggen? Nur zu zweit in der Höhle und solange man es nicht schon ist. */
  private get can() {
    const p = this.host.player;
    return !!this.net && !p.dead && !this.host.ended && this.inside(p.x, p.y) && !this.net.inCave && this.host.time.now > this.asked && this.mates().length > 0;
  }

  update(dt: number) {
    this.t += dt;
    const h = this.host, p = h.player;
    const me = !p.dead && this.inside(p.x, p.y);
    // wer die Höhle verlässt, ist wieder ausgeloggt (der Server sieht es auch selbst)
    if (this.wasIn && !me && this.net?.inCave) this.net.caveLogin(false);
    this.wasIn = me;
    this.prompt.update(dt, p.x, p.y, this.can);
    // was gerade gilt: eingeloggt und wartend – oder ein anderer wartet schon
    const mates = this.mates();
    const ready = mates.find((f) => f.cave);
    let msg = '';
    if (me && this.net?.inCave) msg = mates.length ? `Bereit · warte auf ${mates[0].name}` : 'Bereit · warte auf einen zweiten Fisch';
    else if (ready) msg = `${ready.name} ist bereit zum Laichduell`;
    if (msg && this.note.text !== msg) this.note.setText(msg);
    this.note.setAlpha(this.note.alpha + ((msg ? 0.95 : 0) - this.note.alpha) * Math.min(1, dt * 5));
    this.glintStep();
  }

  /** Aktionstaste (E): in der Höhle einloggen. Gibt true zurück, wenn sie dafür gebraucht wurde. */
  act(): boolean {
    if (!this.can) return false;
    this.asked = this.host.time.now + 900;
    this.net!.caveLogin(true);
    audio.sfx('bond');
    this.host.glitter(this.host.player.x, this.host.player.y - 10, 6);
    return true;
  }

  /** In der Höhle sieht man von den Fischen nur noch die Augen. */
  private glintStep() {
    for (const g of this.glints.values()) g.setVisible(false);
    const p = this.host.player;
    this.glint(p, p.view, !p.dead && this.inside(p.x, p.y));
    for (const f of this.net?.players() ?? []) this.glint(f, f.view, !f.dead && this.inside(f.x, f.y));
  }

  private glint(key: object, v: { x: number; y: number; dir: number; L?: { halfW: number; topY: number } }, show: boolean) {
    if (!show || !v.L) return;
    let g = this.glints.get(key);
    if (!g) {
      g = this.host.add.image(0, 0, 'eyeglint').setDepth(DEPTH.cover + 0.5).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55);
      this.glints.set(key, g);
    }
    const flick = 0.75 + 0.25 * Math.sin(this.t * 2.3 + (key === this.host.player ? 0 : 1.7));
    g.setVisible(true).setAlpha(flick).setPosition(v.x + v.dir * v.L.halfW * 0.62, v.y + v.L.topY * 0.32);
  }

  destroy() {
    this.prompt.destroy();
    this.note.destroy();
    for (const g of this.glints.values()) g.destroy();
    this.glints.clear();
  }
}
