import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { CreatureView } from '../objects/CreatureView';
import { game, ZERO_TRAITS } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { clamp } from '../util/math';
import { ANIM, INTERP_MS } from './protocol';
import { Interp } from './Interp';
import type { NetFish } from './schema';
import { networkMorph } from './morphProtocol';

/**
 * Peer appearance accepts bounded numbers and known lineage form IDs. Missing or damaged data uses a basic local form.
 */
function parseLook(s: string): Morph {
  return networkMorph(s) ?? game.morph({ traits: ZERO_TRAITS, fierce: 0 });
}

/** Was ein Fisch eines anderen Spielers am Ort meldet. */
export type FishRow = Pick<NetFish, 'name' | 'x' | 'y' | 'facing' | 'anim' | 'look' | 't' | 'away'> & {mouth?:number;charge?:number;identity?:string;observer?:boolean};

/**
 * Der Fisch eines anderen Spielers: Er wird etwas verzögert gezeigt und zwischen den Meldungen geglättet (net/Interp.ts),
 * damit er ruhig schwimmt, obwohl seine Lage nur etwa 20 Mal je Sekunde ankommt. Darüber steht sein Name.
 */
export class RemoteFish {
  readonly view: CreatureView;
  private label: Phaser.GameObjects.Text;
  private path = new Interp(INTERP_MS);
  private charge=0;
  private look = '';
  private anim = 0;
  private facing = 1;
  private speed01 = 0;
  private away = false;
  /** sein Name */
  name = '';
  identity='';
  private observer=false;

  constructor(scene: Phaser.Scene, f: FishRow, now: number) {
    this.look = f.look;
    this.view = new CreatureView(scene, f.x, f.y, parseLook(f.look));
    this.view.setDepth(DEPTH.player - 1);
    this.label = scene.add
      .text(f.x, f.y - 60, f.name, { fontFamily: FONT, fontSize: '17px', color: '#f0e6d2', stroke: '#0a0907', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.text - 1)
      .setAlpha(0.85);
    this.push(f, now);
  }

  /** tot oder gerade ohne Verbindung (für die Tiere kein Ziel) */
  get dead() {
    return this.anim === ANIM.dead;
  }

  get gone() {
    return this.away;
  }

  /** schnell unterwegs (Spurt, Stoß) – fällt auf */
  get fast() {
    return this.anim === ANIM.dash || this.anim === ANIM.ram || this.speed01 > 0.85;
  }

  get facingDir() {
    return this.facing;
  }

  /** wo er gerade gezeigt wird */
  get x() {
    return this.view.x;
  }

  get y() {
    return this.view.y;
  }

  /** Eine neue Meldung vom Server. */
  push(f: FishRow, now: number) {
    // ein älterer Server meldet keine Uhrzeit: dann die Ankunft
    this.path.push(f.t || now, f.x, f.y, now);
    if (f.look !== this.look && f.look) {
      this.look = f.look;
      this.view.build(parseLook(f.look));
    }
    if (f.anim !== this.anim && (f.anim === ANIM.bite || f.anim === ANIM.ram)) this.view.bite(this.view.holdOpen>0);
    this.anim = f.anim;
    this.identity=f.identity??'';this.observer=!!f.observer;this.view.setVisible(!this.observer);this.label.setVisible(!this.observer);
    this.view.holdOpen=(f.mouth??0)/100;this.charge=f.charge??0;
    this.facing = f.facing < 0 ? -1 : 1;
    this.away = f.away;
    this.name = f.name;
    if (this.label.text !== f.name) this.label.setText(f.name);
  }

  update(now: number, dt: number) {
    const p = this.path.at(now, dt);
    // Sprünge (nach einer Pause im Netz, einer Korrektur des Servers) weich aufholen – sonst genau auf der Bahn
    const k = Math.hypot(p.x - this.view.x, p.y - this.view.y) > 60 ? Math.min(1, dt * 12) : 1;
    const x = this.view.x + (p.x - this.view.x) * k, y = this.view.y + (p.y - this.view.y) * k;
    const v = Math.hypot(x - this.view.x, y - this.view.y) / Math.max(0.001, dt);
    this.speed01 += (clamp(v / 260, 0, 1) - this.speed01) * Math.min(1, dt * 6);
    this.view.setPosition(x, y);
    this.view.setFacing(this.facing);
    const dead = this.anim === ANIM.dead;
    this.view.headTilt = this.anim === ANIM.ram ? 0.62 : this.charge===2?.3:0;
    this.view.squint(this.anim === ANIM.ram || this.charge>0 ? 0.8 : this.anim === ANIM.bite ? 0.95 : 0);
    this.view.animate(dt, this.speed01 > 0.12 ? 'swim' : 'idle', dead ? 0 : this.speed01);
    this.view.setAlpha(this.away ? 0.45 : dead ? 0.6 : 1);
    this.label.setPosition(x, y + (this.view.L?.topY ?? -24) - 8);
  }

  destroy() {
    this.view.destroy();
    this.label.destroy();
  }
}
