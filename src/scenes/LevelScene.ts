import Phaser from 'phaser';
import { W, H, DEPTH, GRAVITY, DEBUG, TILE, LEVEL_ZOOM } from '../config';
import { audio } from '../audio/Audio';
import { bus, FOOD, fedRef, game, hungerRate, kcalOf, ZERO_TRAITS, type LineId, type Traits } from '../state/GameState';
import { EPOCHS, type EpochDef, type EventDef, type Theme } from '../data/epochs';
import { SPECIES, type SpeciesDef } from '../data/species';
import { placeOf, type PlaceDef } from '../data/world';
import { generateLevel, type Gate, type LevelData, type Zone } from '../level/LevelGen';
import { coverTextures, foodKey, groundDecals, groundTextures, levelBackgrounds, plantTextures, SILHOUETTE, SWAYS, THEME_TINT } from '../art/worldArt';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import type { Morph } from '../art/creatureArt';
import { Controls } from '../objects/Controls';
import { Player } from '../objects/Player';
import { BackSea } from '../objects/BackSea';
import { Animal } from '../objects/Animal';
import { Kin, type KinWorld } from '../objects/Kin';
import { Kill, Meat, Plant, Shell } from '../objects/Food';
import { fadeIn, fadeTo, text } from '../ui/ui';
import { clamp, overlaps, pick, type Rect } from '../util/math';
import { reportError } from '../util/guard';

type PImg = Phaser.Physics.Arcade.Image;

const UI_BONE = '#e6dcc4';

const DUST: Record<Theme, number> = { ozean: 0xcfe0dc, sumpf: 0x5a4a32, reptil: 0x6a4a34, eis: 0xdfe6ec, eden: 0x6a5a3a };


/** Daten für den Generationen-Bildschirm nach einem überlebten Zeitalter. */
/** Bildschirmfeste Ebenen müssen beim Herauszoomen größer sein, damit sie das ganze Bild füllen. */
const Z = LEVEL_ZOOM;
/** Beim Ausruhen heilt der Körper nur bis zu diesem Anteil der Lebenskraft */
const REST_HEAL_CAP = 0.75;
/** Ein Bissen Heilkraut gibt so viel Lebenskraft zurück (Anteil am Maximum) */
const HEAL_BITE = 0.17;
const VW = W / Z, VH = H / Z, VX = (W - VW) / 2, VY = (H - VH) / 2;

export interface SurvivedData {
  epoch: number;
  before: Traits;
  traits: Traits;
  cls: Morph['cls'];
  look: { hue: number; seed: number; sex: number };
  kinAlive: number;
  kinLooks: Morph[];
  transition?: { from: Morph['cls']; to: Morph['cls'] };
  /** Merkmale nach den Jahrmillionen bis zum nächsten Zeitalter */
  drifted?: Traits;
  /** zu welcher Linie dieses Zeitalter gezählt wurde (der Spielstil entscheidet, nicht der Spieler) */
  line?: LineId;
  /** in diesem Zeitalter gefressen (kcal) */
  eaten?: { meat: number; plant: number; need: number };
  /** Endgegner noch nicht besiegt: das Zeitalter wird wiederholt */
  repeat?: boolean;
  /** Name des Endgegners (falls es einen gab) */
  boss?: string;
  bossBeaten?: boolean;
  /** Jahre vor heute am Ende dieser Runde */
  years?: number;
  finished?: boolean;
  node: string;
}

/**
 * Ein Zeitalter. Die Uhr läuft von Beginn bis Ende des Zeitraums – wer bis dahin
 * überlebt, dessen Linie zieht weiter. Wie, ist egal: verstecken, kämpfen, teilen.
 * Wer stirbt, beendet das Spiel: Die Linie stirbt aus.
 */
export class LevelScene extends Phaser.Scene implements KinWorld {
  ep!: EpochDef;
  epochIdx = 0;
  L!: LevelData;
  player!: Player;
  water = false;
  surfaceY = 0;
  animals: Animal[] = [];
  /** Schwärme und Rudel: Gruppen-Nr. → Mitglieder */
  private herds = new Map<number, Animal[]>();
  plants: Plant[] = [];
  meats: Meat[] = [];
  cover: Rect[] = [];
  ended = false;
  /** gelebte Sekunden in diesem Zeitalter */
  elapsed = 0;
  private controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private hazards: Rect[] = [];
  private lava: Phaser.GameObjects.TileSprite[] = [];
  private shots: PImg[] = [];
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  /** das Meer hinter dem Spielfeld: ferne Fische, nur Kulisse */
  private backSea?: BackSea;
  private fog!: Phaser.GameObjects.TileSprite;
  private darkness?: Phaser.GameObjects.Image;
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ramHit = new Map<Animal, number>();
  private vitalsAt = 0;
  private lookAt = 0;
  private hideTick = 0;
  private growlAt = 0;
  private wasInCover = false;
  private coverFront: Phaser.GameObjects.Image[][] = [];
  private curCover = -1;
  private timeline: { def: EventDef; done: boolean; i: number }[] = [];
  private kinDef!: SpeciesDef;
  private faunaCount = 0;
  private nextMigrate = 0;
  private bloomUntil = 0;
  private stormUntil = 0;
  private stormK = 0;
  private stormFx?: { veil: Phaser.GameObjects.Image; p: Phaser.GameObjects.Particles.ParticleEmitter };
  private huntMusic = 0;
  private huntLost = 0;
  private announced = new Set<string>();
  private bloodClouds?: Phaser.GameObjects.Particles.ParticleEmitter;
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number; a: number }[] = [];
  private glints = new Map<object, Phaser.GameObjects.Image>();
  private leftNoted = false;
  /** Blutflecken am Boden – werden wiederverwendet statt immer neu erzeugt */
  private splats: Phaser.GameObjects.Image[] = [];
  /** zuletzt gekämpft (gebissen, gerammt, zusammengestoßen) */
  private fightAt = -1e9;
  /** frühestens dann das Aussehen wieder neu zeichnen */
  private redrawAt = 0;
  /** Schleier je Gebiet (Trübung, Dunst, Dunkelheit) */
  private veil!: Phaser.GameObjects.Rectangle;
  private surfGlow?: Phaser.GameObjects.TileSprite;
  /** der Ort, an dem man gerade ist */
  place!: PlaceDef;
  /** Muscheln auf dem Grund */
  private shells: Shell[] = [];
  /** wie lange man schon gegen den Rand schwimmt (dann geht es auf die Karte) */
  /** Durchgänge: Sichtbares je Tor (wird mit der Entfernung stärker), wie lange man schon darin schwimmt */
  private gateFx: { g: Gate; items: { o: Phaser.GameObjects.Image; a: number }[]; pe?: Phaser.GameObjects.Particles.ParticleEmitter }[] = [];
  private gateHold = 0;
  private gateNoted = false;
  /** Dunkelheit in der Tiefe: Je weiter man hinabschwimmt, desto weniger sieht man */
  private deepDark?: Phaser.GameObjects.Image;
  private deepK = 0;
  private deepBeatAt = 0;
  private deepRumbleAt = 0;
  private endNoted = false;
  /** Trübung am aktuellen Ort (0..1) – macht unauffälliger */
  private murk = 0;
  private zoneLight = 1;
  /** feste Dinge, die außerhalb des Bildes nicht gezeichnet werden */
  private cullList: { o: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible; x0: number; x1: number }[] = [];
  private cullAt = 0;
  /** Pflanzen, die sich in Strömung oder Wind wiegen */
  private swayList: { o: Phaser.GameObjects.Image; amp: number; sp: number; ph: number }[] = [];
  /** in diesem Zeitalter gefressen (Sättigungs-Einheiten) */
  eatenMeat = 0;
  eatenPlant = 0;
  /** so viel frisst ein Tier, das gut über die Runden kommt (Maß für die Vielfalt des Nachwuchses) */
  needUnits = 0;
  /** der Endgegner dieser Region (falls er schon da ist) */
  private bossA?: Animal;
  private bossBeaten = false;
  private span = { from: 0, to: 0 };
  /** bis dahin gilt ein Angriff als Überraschungsangriff (aus dem Versteck heraus) */
  private ambushUntil = 0;
  /** Teemo-Prinzip: Wer in seinem Versteck (Gras bei grüner, Dunkelheit bei schwarzer Farbe) 1,5 s still hält, ist bereit */
  private primedUntil = 0;
  /** Zeitpunkt, seit dem man still im Versteck ist (0 = nicht still) */
  private stillT = 0;
  private winded = false;
  /** entkommene Beute, die später (außerhalb des Bildes) wieder auftaucht */
  private returning: { id: string; x: number; y: number; herd?: number; at: number }[] = [];
  private restockAt = 0;
  /** kleine Kraftanzeige am Fisch – nur zu sehen, solange er nicht frisch ist */
  private stamG!: Phaser.GameObjects.Graphics;
  private stamA = 0;
  private healNoted = false;
  private primeNoted = false;
  /** Tunnel, in dem man gerade schwimmt (-1 = keiner) und von welcher Seite man hineingekommen ist */
  private curCave = -1;
  private caveSide = 0;
  private caveFx: { c: LevelData['caves'][number]; pe: Phaser.GameObjects.Particles.ParticleEmitter; on: boolean }[] = [];
  /** dunkle Vorahnung: ein Riese ist in der Nähe */
  private dread!: Phaser.GameObjects.Rectangle;
  private dreadK = 0;
  private dreadAt = -1e9;
  /** Strömungen (mit ihren Schlieren) */
  private flows: { r: Rect & { dir: number }; pe: Phaser.GameObjects.Particles.ParticleEmitter; on: boolean }[] = [];
  private flowNoted = false;
  private toxNoted = false;
  private shareNoted = false;
  private tiredNoted = false;
  /** Kino-Moment (läuft in echter Zeit, das Spiel derweil in Zeitlupe) */
  private cine?: { t: number; img: Phaser.GameObjects.Image; dir: number; y: number; rumbled: boolean; released: boolean };
  private cineWanted = false;
  /** Zeitlupe: 1 = normal */
  private slow = 1;
  private hurtSeen = -1e9;
  private grudgeNoted = false;
  /** Was du in diesem Zeitalter getan hast (für den Werte-Bildschirm): Beutejagd, Bodenkontakt, Rammen, Schwimmen */
  train = { hunt: 0, ground: 0, ram: 0, swim: 0, hide: 0, hurt: 0 };
  /** zuletzt gebissenes Tier (zweimal kurz hintereinander = gepackt und festgehalten) */
  private lastBitten: Animal | null = null;
  private lastBiteAt = -1e9;

  private dbg?: Phaser.GameObjects.Text;
  private t = 0;

  constructor() {
    super('Level');
  }

  init(d: { epoch?: number; place?: string }) {
    this.epochIdx = d?.epoch ?? game.epochIndex;
    this.ep = EPOCHS[this.epochIdx];
    const prog = game.prog;
    this.place = placeOf(this.ep, d?.place ?? prog.place);
    this.animals = [];
    this.herds = new Map();
    this.plants = [];
    this.meats = [];
    this.cover = [];
    this.solidRects = [];
    this.platRects = [];
    this.hazards = [];
    this.lava = [];
    this.shots = [];
    this.ended = false;
    this.elapsed = prog.elapsed;
    this.darkness = undefined;
    this.ramHit = new Map();
    this.dbg = undefined;
    this.t = 0;
    this.wasInCover = false;
    this.coverFront = [];
    this.curCover = -1;
    this.timeline = this.ep.events.map((def, i) => ({ def, done: prog.events.includes(i), i }));
    this.bloomUntil = this.stormUntil = 0;
    this.stormK = 0;
    this.stormFx = undefined;
    this.huntMusic = this.huntLost = 0;
    this.announced = new Set();
    this.nextMigrate = 0;
    this.glints = new Map();
    this.leftNoted = false;
    this.bloodClouds = undefined;
    this.caustics = [];
    this.splats = [];
    this.fightAt = -1e9;
    this.redrawAt = 0;
    this.surfGlow = undefined;
    this.shells = [];
    this.gateHold = 0;
    this.gateFx = [];
    this.deepDark = undefined;
    this.deepK = 0;
    this.deepBeatAt = this.deepRumbleAt = 0;
    this.endNoted = false;
    this.murk = 0;
    this.zoneLight = 1;
    this.cullList = [];
    this.cullAt = 0;
    this.swayList = [];
    this.eatenMeat = prog.eaten.meat;
    this.eatenPlant = prog.eaten.plant;
    this.needUnits = 0;
    this.bossA = undefined;
    this.bossBeaten = prog.boss === 2;
    this.ambushUntil = 0;
    this.primedUntil = 0;
    this.stillT = 0;
    this.winded = false;
    this.returning = [];
    this.restockAt = 0;
    this.healNoted = false;
    this.curCave = -1;
    this.caveSide = 0;
    this.caveFx = [];
    this.dreadK = 0;
    this.dreadAt = -1e9;
    this.flows = [];
    this.flowNoted = false;
    this.toxNoted = false;
    this.shareNoted = false;
    this.tiredNoted = false;
    this.cine = undefined;
    this.cineWanted = false;
    this.slow = 1;
    this.hurtSeen = -1e9;
    this.grudgeNoted = false;
    this.train = { hide: 0, hurt: 0, ...prog.train };
    this.lastBitten = null;

  }

  create() {
    fadeIn(this, 900);
    game.beginEpoch();
    const ep = this.ep;
    const L = (this.L = generateLevel(ep, game.run?.id ?? 0, this.place, game.prog.from));
    this.water = L.mode === 'water';
    this.surfaceY = L.surfaceY;
    this.cover = L.cover;
    const world = this.physics.world;
    world.gravity.y = this.water ? 0 : GRAVITY;
    if (this.water) world.setBounds(0, L.surfaceY, L.width, L.height - L.surfaceY);
    else world.setBounds(0, -600, L.width, L.height + 1200);
    world.setBoundsCollision(true, true, true, this.water);
    this.cameras.main.setBackgroundColor('#020304');

    // Hintergrund mit Nebel
    const [far, mid, fog] = levelBackgrounds(this, L.theme, L.variant);
    this.bgFar = this.add.tileSprite(VX, VY, VW, VH, far).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setTileScale(1 / Z);
    this.bgMid = this.add.tileSprite(VX, VY, VW, VH, mid).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1).setTileScale(1 / Z);
    this.fog = this.add.tileSprite(VX, VY + VH * 0.35, VW, VH * 0.65, fog).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 2).setAlpha(0.35).setTileScale(1 / Z);

    // Gelände – je Gebiet ein anderer Boden, dazu Steine, Risse und Bewuchs als Abwechslung
    const gts = [0, 1, 2].map((v) => groundTextures(this, L.theme, v));
    const decals = groundDecals(this, L.theme);
    this.solids = this.physics.add.staticGroup();
    for (const r of L.solids) {
      const gt = gts[this.zoneAt(r.x + r.w / 2).def.ground] ?? gts[0];
      this.addSolid(r, gt.gnd, gt.top, decals);
    }
    for (const r of L.platforms) this.addPlatform(r, (gts[this.zoneAt(r.x + r.w / 2).def.ground] ?? gts[0]).plat);
    for (const r of L.hazards) this.addHazard(r, gts[0].hz);
    this.buildDecor();
    if (this.water && L.surfaceY > 0) {
      const s = this.add.tileSprite(0, L.surfaceY - 14, L.width, 30, 'surface').setOrigin(0).setDepth(DEPTH.decoFront);
      this.tweens.add({ targets: s, tilePositionX: 160, repeat: -1, duration: 5000 });
    }
    plantTextures(this, L.theme);
    // Alle Tierarten dieses Zeitalters schon jetzt malen (auch die großen Durchzügler) –
    // sonst stockt das Spiel, wenn eines zum ersten Mal auftaucht.
    for (const [id] of ep.fauna) if (SPECIES[id]) makeSpeciesTextures(this, SPECIES[id]);
    for (const e of ep.events) if (e.species && SPECIES[e.species]) makeSpeciesTextures(this, SPECIES[e.species]);
    // Fische in der Ferne (in mehreren Tiefenstufen) – kein Teil des Spiels, nur das Bild eines Meeres
    this.backSea = this.water && L.surfaceY > 0 ? new BackSea(this, { x: VX, y: VY, w: VW, h: VH }, ep, this.place.id, this.place.kind, L.surfaceY, L.variant !== 'normal') : undefined;
    for (const p of L.plants) {
      // fest auf den Boden setzen (nicht über eine Kante ragen lassen)
      const hw = (this.textures.get(foodKey(L.theme, 0, p.v)).getSourceImage().width as number) / 2;
      const at = this.settle(p.x, p.y, hw) ?? { x: p.x, y: p.y - 4 };
      const pl = new Plant(this, at.x, at.y + 4, L.theme, 3, p.v);
      this.plants.push(pl);
      this.cullAdd(pl.img, at.x - hw, at.x + hw);
    }
    this.buildCover();
    this.buildCaves();
    this.buildCrevices();
    this.buildCurrents();
    // Artgenossen verstecken sich auch in Höhlen und Felsspalten
    this.cover = [...L.cover, ...L.caves, ...L.crevices];
    if (this.water && L.surfaceY > 0) {
      this.surfaceLight();
      this.depthShade();
    }
    else if (!this.water && L.variant === 'normal') this.landLight();

    // Spieler, Artgenossen, Tiere
    this.controls = new Controls(this);
    this.player = new Player(this, L.start.x, L.start.y, this.water);
    this.stamG = this.add.graphics().setDepth(DEPTH.fx + 2);
    this.stamA = 0;
    // von einem Ort zum nächsten bleibt man, wie man war: Kraft, Magen und Artgenossen
    const pr = game.prog;
    if (pr.hp !== undefined) this.player.hp = clamp(pr.hp, 1, this.player.stats.maxHp);
    if (pr.sat !== undefined) this.player.satiety = clamp(pr.sat, 0.01, this.player.maxSat);
    this.spawnKin();
    for (const s of L.spawns) this.spawnAnimal(s.id, s.x, s.y, s.herd);
    this.faunaCount = L.spawns.length;
    this.needUnits = fedRef(ep, this.player.stats.size);
    this.span = game.epochSpan(this.epochIdx);
    // Muscheln, die noch nicht gefunden sind
    for (const sh of L.shells) if (!game.hasShell(sh.id)) this.shells.push(new Shell(this, sh.x, sh.y, sh.id));
    this.buildGates();

    // Kollisionen
    this.physics.add.collider(this.player.rect, this.solids);
    this.physics.add.collider(this.animals, this.solids, undefined, (a) => (a as Animal).def.habitat !== 'air');
    this.physics.add.collider(this.shots, this.solids, (s) => this.popShot(s as PImg), (s) => !(s as PImg).getData('wave'));

    // Effekte
    this.puffer = this.add.particles(0, 0, this.water ? 'p_bubble' : 'p_dot', {
      speed: { min: 20, max: 80 }, lifespan: this.water ? 1300 : 500, scale: { start: 0.8, end: 0.1 },
      alpha: { start: 0.6, end: 0 }, gravityY: this.water ? -60 : -20, tint: DUST[L.theme], emitting: false,
    }).setDepth(DEPTH.fx);
    this.blood = this.add.particles(0, 0, 'p_blood', {
      speed: { min: 40, max: 160 }, lifespan: 700, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 },
      gravityY: this.water ? 30 : 500, emitting: false,
    }).setDepth(DEPTH.fx);
    if (this.water) {
      this.bloodClouds = this.add.particles(0, 0, 'blood_cloud', {
        speed: { min: 4, max: 26 }, lifespan: 2600, scale: { start: 0.35, end: 1.6 }, alpha: { start: 0.75, end: 0 },
        gravityY: -4, emitting: false,
      }).setDepth(DEPTH.fx - 2);
    }
    this.sparkle = this.add.particles(0, 0, 'p_dot', {
      speed: { min: 10, max: 50 }, lifespan: 1400, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
      gravityY: -30, tint: [0xffd890, 0xfff0c8], emitting: false, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.fx);
    this.ambient();
    if (L.variant !== 'normal') {
      this.darkness = this.add.image(0, 0, 'darkness').setScale((L.variant === 'dark' ? 3.4 : 4.2) / Z).setDepth(DEPTH.dark);
    }
    if (this.place.kind === 'deep' || this.place.kind === 'abyss') {
      this.deepDark = this.add.image(0, 0, 'deepdark').setDepth(DEPTH.dark).setAlpha(0).setScale(5 / Z);
    }
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(VW, VH).setDepth(DEPTH.dark + 1).setAlpha(0.55);
    // Schleier der Gebiete: links trüb, rechts dunkel – geht fließend ineinander über
    this.veil = this.add.rectangle(VX, VY, VW, VH, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.decoFront + 2);
    // Ein Riese naht: das Bild wird dunkler und kälter
    this.dread = this.add.rectangle(VX, VY, VW, VH, 0x02081a, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.decoFront + 3);

    // Kamera: etwas herausgezoomt; an Land reicht der Blick auch über den oberen Levelrand in den Himmel
    const cam = this.cameras.main;
    cam.setZoom(Z);
    const bottom = this.water ? L.height : L.height - 70;
    const camH = Math.max(bottom, VH + 40);
    cam.setBounds(0, bottom - camH, L.width, camH);
    cam.startFollow(this.player.rect, true, 0.1, 0.1);
    cam.setDeadzone(90, 70);

    this.scene.launch('Hud', { epoch: this.epochIdx, place: this.place.name, blurb: this.place.kind === 'start' ? '' : this.place.blurb, tutorial: this.shells.some((sh) => sh.id === 'ordovizium:lagune:0') });
    audio.music(ep.music);
    // im Wasser rauscht leise das Meer; Zeitlupe aus einem abgebrochenen Kino-Moment zurücksetzen
    audio.musicLevel(1, 0.3);
    audio.sea(this.water ? 0.08 : 0, 2);
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    this.events.once('shutdown', () => {
      audio.sea(0, 0.8);
      audio.musicLevel(1, 0.5);
      this.anims.globalTimeScale = 1;
    });

    if (DEBUG) {
      this.dbg = this.add.text(VX + 12, VY + VH - 160, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9f9', backgroundColor: 'rgba(0,0,0,.6)' })
        .setScrollFactor(0).setDepth(DEPTH.text + 10);
    }

    // Ein Endgegner, der noch lebt, folgt dir von Ort zu Ort
    const bossEv = ep.events.find((e) => e.kind === 'boss');
    if (bossEv && pr.boss === 1) this.time.delayedCall(2600, () => !this.ended && this.spawnBoss(bossEv.species!));
    // Der Weg über die Karte hat die letzten Sekunden gekostet
    if (this.elapsed >= ep.seconds) this.time.delayedCall(1600, () => !this.ended && this.complete());

    const onAbort = () => this.abort();
    bus.on('abortLevel', onAbort);
    this.events.on('player-dead', () => this.onDeath());
    this.events.once('shutdown', () => {
      bus.off('abortLevel', onAbort);
      this.events.off('player-dead');
    });
  }

  // ---------------------------------------------------------------- Aufbau

  private addSolid(r: Rect, gnd: string, top: string, decals: string[] = []) {
    // an der Welt ausgerichtet: Nachbarstücke gehen nahtlos ineinander über
    const t = this.add.tileSprite(r.x, r.y, r.w, r.h, gnd).setOrigin(0).setDepth(DEPTH.terrain).setTilePosition(r.x, r.y);
    this.cullAdd(t, r.x, r.x + r.w);
    if (r.y > 0) {
      for (const [x0, x1] of this.exposedTop(r)) {
        const s = this.add.tileSprite(x0 - 4, r.y - 10, x1 - x0 + 8, 30, top).setOrigin(0).setDepth(DEPTH.terrain + 1).setTilePosition(x0 - 4, 0);
        this.cullAdd(s, x0 - 4, x1 + 4);
      }
      // Steine, Risse, Bewuchs, Fossilien – damit der Boden nicht überall gleich aussieht
      const bottom = Math.min(r.y + r.h, this.L.height) - 18;
      if (decals.length && bottom - r.y > 50) {
        for (let x = r.x + 20 + Math.random() * 60; x < r.x + r.w - 24; x += 70 + Math.random() * 170) {
          const y = r.y + 26 + Math.random() * Math.min(260, bottom - r.y - 40);
          const d = this.add.image(x, y, pick(Math.random, decals)).setDepth(DEPTH.terrain + 0.5)
            .setAlpha(0.55 + Math.random() * 0.4).setScale(0.7 + Math.random() * 0.6).setFlipX(Math.random() < 0.5).setAngle((Math.random() - 0.5) * 30);
          this.cullAdd(d, x - 50, x + 50);
        }
      }
    } else this.add.rectangle(r.x, r.y + r.h - 8, r.w, 8, 0x000000, 0.4).setOrigin(0).setDepth(DEPTH.terrain + 1);
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setVisible(false);
    this.solids.add(rect);
    this.solidRects.push(r);
  }

  /** Die Abschnitte der Oberkante, auf denen kein anderer Fels liegt (dort wächst die Grasnarbe). */
  private exposedTop(r: Rect): [number, number][] {
    let segs: [number, number][] = [[r.x, r.x + r.w]];
    for (const s of this.L.solids) {
      if (s === r || s.y + s.h !== r.y || s.x >= r.x + r.w || s.x + s.w <= r.x) continue;
      const out: [number, number][] = [];
      for (const [a, b] of segs) {
        if (s.x > a) out.push([a, Math.min(b, s.x)]);
        if (s.x + s.w < b) out.push([Math.max(a, s.x + s.w), b]);
      }
      segs = out.filter(([a, b]) => b - a > 2);
    }
    return segs;
  }

  private addPlatform(r: Rect, plat: string) {
    const t = this.add.tileSprite(r.x, r.y - 2, r.w, 22, plat).setOrigin(0).setDepth(DEPTH.terrain + 1);
    this.cullAdd(t, r.x, r.x + r.w);
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + 8, r.w, 16).setVisible(false);
    this.solids.add(rect);
    const b = rect.body as Phaser.Physics.Arcade.StaticBody;
    b.checkCollision.down = false;
    b.checkCollision.left = false;
    b.checkCollision.right = false;
    this.platRects.push({ x: r.x, y: r.y, w: r.w, h: 16 });
  }

  private addHazard(r: Rect, hz: string) {
    if (r.h > 40) {
      const t = this.add.tileSprite(r.x, r.y - 6, r.w, 46, hz).setOrigin(0).setDepth(DEPTH.terrain + 2);
      if (this.L.theme === 'reptil') this.lava.push(t);
    } else {
      const key = this.L.theme === 'reptil' ? 'spk2_reptil' : hz;
      this.add.tileSprite(r.x, r.y + r.h - 40, r.w, 40, key).setOrigin(0).setDepth(DEPTH.terrain + 2);
    }
    this.hazards.push(r);
  }

  /** Dickicht: einzelne Büsche – dahinter dunkler, davor halbtransparent. */
  private buildCover() {
    const bushes = coverTextures(this, this.L.theme);
    let bi = 0;
    for (const c of this.L.cover) {
      const front: Phaser.GameObjects.Image[] = [];
      this.coverFront.push(front);
      const n = Math.max(2, Math.round(c.w / 55));
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < n; i++) {
          const key = bushes[(bi++ * 7 + i) % bushes.length];
          const x = c.x + ((i + 0.5) / n) * c.w + ((bi * 37) % 17) - 8;
          const hgt = (c.h + 24 + ((bi * 53) % 30)) * (layer ? 1 : 1.08);
          const img = this.add.image(x + (layer ? 0 : 14), c.y + c.h + 4, key).setOrigin(0.5, 1);
          img.setScale((((c.w / n) * 1.9) / 150) * (layer ? 1 : 1.1), hgt / 210);
          if ((bi + i) % 2) img.setFlipX(true);
          if (layer === 0) img.setDepth(DEPTH.decoBack + 1).setTint(0x5a5a5a);
          else {
            img.setDepth(DEPTH.cover).setAlpha(0.82);
            front.push(img);
          }
          this.cullAdd(img, img.x - img.displayWidth / 2, img.x + img.displayWidth / 2);
          if (this.water) this.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, yoyo: true, repeat: -1, duration: 2200 + ((bi * 131) % 900), ease: 'Sine.inOut' });
        }
      }
    }
  }

  /**
   * Höhlen sind Tunnel durch den Fels: dunkle Rückwand, drinnen sieht man nur noch die Augen. An den Enden treibt etwas
   * von der Farbe der Höhle ins Wasser – grünliche Schlieren bei der grünen, schwarze Schwaden bei der schwarzen.
   */
  private buildCaves() {
    this.L.caves.forEach((c) => {
      const back = this.add.tileSprite(c.x - 4, c.y - 4, c.w + 8, c.h + 8, 'cave_back').setOrigin(0).setDepth(DEPTH.decoBack + 3);
      this.cullAdd(back, c.x - 60, c.x + c.w + 60);
      // Innenraum: in der Mitte ganz dunkel, zu den offenen Enden hin heller
      const g = this.add.graphics().setDepth(DEPTH.cover);
      const n = Math.max(2, Math.round(c.w / 20));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const edge = Math.min(u, 1 - u) * 2;
        g.fillStyle(0x020404, 0.18 + 0.5 * Math.min(1, edge * 1.6));
        g.fillRect(c.x + (c.w * i) / n, c.y, c.w / n + 1, c.h);
      }
      this.cullAdd(g, c.x - 20, c.x + c.w + 20);
      const green = c.coat === 1;
      const pe = this.add.particles(0, 0, 'p_dot', {
        x: { min: c.x - 60, max: c.x + c.w + 60 }, y: { min: c.y - 20, max: c.y + c.h + 20 },
        speedX: { min: -12, max: 12 }, speedY: { min: -14, max: 6 }, lifespan: { min: 2400, max: 4200 }, frequency: green ? 160 : 120,
        scale: { start: green ? 1.1 : 1.8, end: 0.2 }, alpha: { start: green ? 0.5 : 0.55, end: 0 }, tint: green ? [0x7fd06a, 0x4fa04a, 0xa6e08a] : [0x07080a, 0x14181c],
        blendMode: green ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      }).setDepth(DEPTH.cover + 1);
      this.caveFx.push({ c, pe, on: true });
    });
  }

  /** Aus einem Tunnel herausgeschwommen: Der Körper nimmt die Farbe der Höhle an – aber nur ein einziges Mal pro Lauf. */
  private paintCoat(coat: number) {
    const p = this.player;
    const run = game.run;
    if (!run || run.coatSet) return;
    run.coatSet = true;
    if (game.traits.coat === coat) return;
    game.traits.coat = coat;
    p.refresh(false, true);
    this.puff(p.x, p.y, 14, coat === 1 ? 0x7fbf5a : 0x07080a);
    this.sparkle.explode(8, p.x, p.y);
    audio.sfx('evolve');
    this.cameras.main.flash(260, coat === 1 ? 120 : 10, coat === 1 ? 180 : 10, coat === 1 ? 90 : 12);
    bus.emit('story', coat === 1
      ? 'Du kommst grün aus der Höhle. Im Gras sieht dich nun kaum noch jemand.'
      : 'Du kommst schwarz aus der Höhle. In der Dunkelheit bist du kaum zu sehen.');
  }

  /** Felsspalten: drinnen ist es dunkel – ein gutes Versteck, aber nur für Schlanke. */
  private buildCrevices() {
    for (const c of this.L.crevices) {
      const g = this.add.graphics().setDepth(DEPTH.cover);
      g.fillStyle(0x020404, 0.62);
      g.fillRect(c.x + 14, c.y, c.w - 28, c.h);
      g.fillStyle(0x020404, 0.32);
      g.fillRect(c.x, c.y, 14, c.h);
      g.fillRect(c.x + c.w - 14, c.y, 14, c.h);
      this.cullAdd(g, c.x - 20, c.x + c.w + 20);
    }
  }

  /** Strömungen: helle Schlieren zeigen, wohin das Wasser zieht. */
  private buildCurrents() {
    for (const r of this.L.currents) {
      const pe = this.add.particles(0, 0, 'p_dot', {
        x: { min: r.x, max: r.x + r.w }, y: { min: r.y, max: r.y + r.h },
        speedX: { min: r.dir * 150, max: r.dir * 240 }, speedY: { min: -6, max: 6 },
        lifespan: { min: 900, max: 1700 }, frequency: 40, quantity: 1,
        scaleX: { start: 2.8, end: 0.6 }, scaleY: 0.22, alpha: { start: 0.32, end: 0 }, tint: 0xd8f0ea,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.decoBack + 2);
      this.flows.push({ r, pe, on: true });
    }
  }

  /** Strömung: schiebt alles mit – je massiger, desto weniger. Riesen bleiben unbeeindruckt. */
  private flowStep(dt: number) {
    const cv = this.cameras.main.worldView;
    const unset = !game.run?.coatSet;
    for (const f of this.caveFx) {
      const on = unset && f.c.x + f.c.w > cv.x - 100 && f.c.x < cv.right + 100;
      if (on !== f.on) {
        f.on = on;
        if (on) f.pe.start();
        else f.pe.stop();
      }
    }
    if (!this.flows.length) return;
    const v = this.cameras.main.worldView;
    for (const f of this.flows) {
      const on = f.r.x + f.r.w > v.x - 200 && f.r.x < v.right + 200;
      if (on !== f.on) {
        f.on = on;
        if (on) f.pe.start();
        else f.pe.stop();
      }
    }
    const inFlow = (x: number, y: number) => this.flows.find((f) => x > f.r.x && x < f.r.x + f.r.w && y > f.r.y && y < f.r.y + f.r.h);
    const p = this.player;
    const t = game.traits;
    const pm = 1 + 1.3 * Math.max(0, t.girth) + 0.6 * t.growth + 0.8 * Math.max(0, p.stats.size - 0.85);
    const pf = !p.dead ? inFlow(p.x, p.y) : undefined;
    if (pf) {
      // wer sich mit kräftigen Flossen am Grund festhält, wird kaum mitgerissen
      const grip = p.bottomWalk ? 1 + 2.5 * t.limb : 1;
      p.body.position.x += (pf.r.dir * 130 * dt) / pm / grip;
      // gegen die Strömung anschwimmen trainiert das Schwimmen besonders
      if (p.body.velocity.x * pf.r.dir < -40 && !p.bottomWalk) {
        game.shiftBody('swift', 0.004 * dt);
        game.shiftBody('len', 0.005 * dt);
        this.train.swim += dt * 0.5;
      }
      if (!this.flowNoted) {
        this.flowNoted = true;
        bus.emit('story', pm > 1.6 ? 'Eine Strömung – doch du bist schwer genug, um dagegen anzuschwimmen.' : 'Eine Strömung reißt dich mit. Massigere Tiere halten besser dagegen.');
      }
    }
    for (const a of this.animals) {
      if (a.dead || !a.body || a.role === 'apex' || a.visitor || a.def.boss) continue;
      const f = inFlow(a.x, a.y);
      if (f) a.b.position.x += (f.r.dir * 130 * dt) / (1 + a.def.power / 4);
    }
  }

  /**
   * Ein Riese naht: dumpfes Grollen, Herzklopfen, das Wasser wird dunkler – und die kleinen Fische
   * fliehen panisch. Das gibt ein paar Sekunden, um sich zu verstecken.
   */
  private warnGiant(g: { x: number; y: number }) {
    const now = this.time.now;
    if (now - this.dreadAt < 15000) return;
    this.dreadAt = now;
    this.dreadK = Math.max(this.dreadK, 0.6);
    audio.sfx('rumble');
    for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 650, () => !this.ended && audio.sfx('heart'));
    const p = this.player;
    for (const a of this.animals) {
      if (a.dead || a.kin || a.role !== 'prey') continue;
      if (Math.abs(a.x - p.x) < 1200) a.panic(g);
    }
  }

  /** Ist ein Riese in der Nähe? Dann bleibt das Bild dunkler. Kommt einer näher, wird gewarnt. */
  private dreadStep(dt: number) {
    const p = this.player;
    let near = 0;
    for (const a of this.animals) {
      if (a.dead || !(a.def.boss || a.role === 'apex')) continue;
      const d = Math.abs(a.x - p.x);
      if (d < 1300) near = Math.max(near, 1 - d / 1300);
      if (d < 1000 && d > 600 && !a.visitor) this.warnGiant(a);
    }
    this.dreadK += (Math.min(1, near * 1.6) - this.dreadK) * Math.min(1, dt * 1.2);
    this.dread.setFillStyle(0x02081a, 0.24 * this.dreadK);
  }

  /** Kurze Einblendung am Ort des Geschehens. */
  private pop(str: string, x: number, y: number, color: string = UI_BONE) {
    const t = this.add.text(x, y, str, { fontFamily: 'Alegreya Sans, sans-serif', fontSize: `${Math.round(20 / Z)}px`, fontStyle: '700', color, stroke: '#050403', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(DEPTH.text);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1300, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  /** Ein Angriff aus dem Versteck heraus: mehrfacher Schaden, das Opfer ist kurz betäubt. */
  private surprise(a: Animal) {
    a.stun(1300);
    this.pop('Überraschungsangriff!', a.x, a.y - a.displayHeight * 0.5 - 10, '#e0b060');
    game.grow('stealth', 0.015);
    this.cameras.main.shake(120, 0.006);
  }

  /**
   * Licht von oben: Lichtbahnen, Kaustik und ein heller Schein unter der Oberfläche. Breite, Neigung,
   * Helligkeit und Takt jeder Lichtbahn sind verschieden; am Grund liegen Lichtflecken. Im trüben bzw.
   * tiefen Gebiet ist es dunkler.
   */
  private surfaceLight() {
    const L = this.L;
    // etwas kürzer als die Textur – sonst schimmert unten deren helle Oberkante durch (Kachel-Wiederholung)
    this.surfGlow = this.add.tileSprite(0, L.surfaceY - 8, L.width, 218, 'surface_light').setOrigin(0).setDepth(DEPTH.fx + 1)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.34).setTileScale(1, 0.62);
    // zwei Lichtnetze in verschiedener Größe, die gegeneinander laufen – so wiederholt sich nichts sichtbar
    for (const [key, a, v, sc] of [['caustics', 0.34, 9, 1], ['caustics2', 0.26, -6, 1.37]] as const) {
      const s = this.add.tileSprite(0, L.surfaceY - 4, L.width, 194, key).setOrigin(0).setDepth(DEPTH.decoBack - 1)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTileScale(sc, sc);
      this.caustics.push({ s, v, a });
    }
    // Licht fällt nur an einigen Stellen ins Wasser; dazwischen liegt Schatten (Felsen, dichte Pflanzendecke)
    for (const lit of L.lit) {
      let x = lit.x0 + 40 + Math.random() * 90;
      while (x < lit.x1 - 30) {
        const light = this.zoneAt(x).def.light;
        const base = (0.12 + Math.random() * 0.26) * light;
        // das Licht reicht nur ein Stück ins Wasser – darunter wird es dämmrig
        const ray = this.add.image(x, L.surfaceY - 30, 'lightray').setOrigin(0.5, 0).setDepth(DEPTH.decoBack)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(base).setScale(0.45 + Math.random() * 1.25, 0.48 + Math.random() * 0.3);
        ray.setAngle(-16 + Math.random() * 12);
        this.tweens.add({ targets: ray, angle: ray.angle + 3 + Math.random() * 5, alpha: base * (0.35 + Math.random() * 0.3), yoyo: true, repeat: -1, duration: 3000 + Math.random() * 4500, ease: 'Sine.inOut', delay: Math.random() * 2000 });
        this.cullAdd(ray, x - 260, x + 160);
        // ein Lichtfleck am Grund unter der Bahn
        const reach = 560 * ray.scaleY;
        if (Math.random() < 0.6) {
          const gx = x - Math.tan((ray.angle * Math.PI) / 180) * reach * 0.8;
          const col = clamp(Math.floor(gx / TILE), 0, L.ground.length - 1);
          const gy = L.ground[col];
          // Lichtflecken nur dort, wo das Licht noch bis zum Grund reicht (auf hohen Felsen)
          if (gy < L.height && gy - L.surfaceY < reach) {
            const spot = this.add.image(gx, gy - 6, 'glow').setDepth(DEPTH.decoBack + 1).setBlendMode(Phaser.BlendModes.ADD)
              .setTint(0xbfe8e0).setScale(1 + Math.random() * 1.4, 0.3 + Math.random() * 0.12).setAlpha((0.07 + Math.random() * 0.1) * light);
            this.tweens.add({ targets: spot, alpha: spot.alpha * 0.4, yoyo: true, repeat: -1, duration: 2500 + Math.random() * 3000, ease: 'Sine.inOut' });
            this.cullAdd(spot, gx - 150, gx + 150);
          }
        }
        x += 110 + Math.random() * 380;
      }
      // ein warmer Schein dort, wo die Sonne durchkommt
      const pool = this.add.image((lit.x0 + lit.x1) / 2, L.surfaceY + 70, 'glow').setDisplaySize((lit.x1 - lit.x0) * 1.15, 340)
        .setTint(0xcfeee0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setDepth(DEPTH.fx + 1);
      this.tweens.add({ targets: pool, alpha: 0.12, yoyo: true, repeat: -1, duration: 3800 + Math.random() * 2400, ease: 'Sine.inOut' });
      this.cullAdd(pool, lit.x0 - 200, lit.x1 + 200);

    }
    // Schatten dazwischen: oben dunkel, nach unten hin auslaufend, an den Rändern weich
    const gaps: [number, number][] = [];
    let gx0 = 0;
    for (const lit of [...L.lit].sort((a, b) => a.x0 - b.x0)) {
      if (lit.x0 - gx0 > 3 * TILE) gaps.push([gx0, lit.x0]);
      gx0 = lit.x1;
    }
    if (L.width - gx0 > 3 * TILE) gaps.push([gx0, L.width]);
    for (const [g0, g1] of gaps) {
      const fade = 200;
      const w = Math.round(g1 - g0 + 2 * fade);
      const key = `shade_gap_${w}`;
      if (!this.textures.exists(key)) {
        const cw = Math.ceil(w / 2), ch = 260;
        const ct = this.textures.createCanvas(key, cw, ch)!;
        const ctx = ct.getContext();
        const vg = ctx.createLinearGradient(0, 0, 0, ch);
        vg.addColorStop(0, 'rgba(1,6,8,0.86)');
        vg.addColorStop(0.5, 'rgba(1,6,8,0.46)');
        vg.addColorStop(1, 'rgba(1,6,8,0)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'destination-in';
        const hg = ctx.createLinearGradient(0, 0, cw, 0);
        const f = fade / w;
        hg.addColorStop(0, 'rgba(0,0,0,0)');
        hg.addColorStop(f, 'rgba(0,0,0,1)');
        hg.addColorStop(1 - f, 'rgba(0,0,0,1)');
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, cw, ch);
        ct.refresh();
      }
      const sh = this.add.image(g0 - fade, L.surfaceY - 2, key).setOrigin(0).setDisplaySize(w, 640).setDepth(DEPTH.decoFront + 0.2);
      this.cullAdd(sh, g0 - fade, g1 + fade);
    }
  }

  /** Je tiefer, desto dunkler: Unten am Meeresgrund kommt kaum noch Licht an. */
  private depthShade() {
    const L = this.L;
    // Die Dunkelheit hängt an der Tiefe in Pixeln (nicht am Anteil des Levels): Je tiefer der Ort
    // reicht, desto schwärzer wird es ganz unten.
    const H0 = 3400;
    // In den Trichtern der Tiefe übernimmt der Lichtkreis um dich das Dunkel – der Grund selbst bleibt etwas heller
    const key = this.place.kind === 'deep' || this.place.kind === 'abyss' ? 'depth_shade3v' : 'depth_shade3';
    if (!this.textures.exists(key)) {
      const ct = this.textures.createCanvas(key, 4, H0)!;
      const ctx = ct.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, H0);
      const stops: [number, number][] = key === 'depth_shade3v'
        ? [[0, 0], [400, 0], [1000, 0.3], [1424, 0.4], [1900, 0.47], [2400, 0.52], [H0, 0.55]]
        : [[0, 0], [400, 0], [1000, 0.42], [1424, 0.64], [1900, 0.72], [2400, 0.77], [H0, 0.8]];
      for (const [y, a] of stops) g.addColorStop(y / H0, `rgba(1,5,9,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, H0);
      ct.refresh();
    }
    this.add.image(0, L.surfaceY, key).setOrigin(0).setDisplaySize(L.width, H0).setDepth(DEPTH.decoFront + 0.5);
    // tiefer als die Verlaufstextur: gleichmäßig dunkel weiter
    if (L.height - L.surfaceY > H0) {
      this.add.rectangle(0, L.surfaceY + H0 - 1, L.width, L.height - L.surfaceY - H0 + 400, 0x010509, key === 'depth_shade3v' ? 0.55 : 0.8)
        .setOrigin(0).setDepth(DEPTH.decoFront + 0.5);
    }
  }

  /** An Land: Sonnenstrahlen durch Blätterdach, Dunst oder Schneetreiben – je Gebiet anders hell. */
  private landLight() {
    const L = this.L;
    const tint = L.theme === 'eis' ? 0xd0e4ff : L.theme === 'sumpf' ? 0xd8e8b0 : 0xffe0a0;
    let x = 100 + Math.random() * 200;
    while (x < L.width) {
      const light = this.zoneAt(x).def.light;
      const base = (0.05 + Math.random() * 0.12) * light;
      const ray = this.add.image(x, -40, 'lightray').setOrigin(0.5, 0).setDepth(DEPTH.decoBack).setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(base).setScale(0.6 + Math.random() * 1.4, 1.3 + Math.random() * 0.4);
      ray.setAngle(-22 + Math.random() * 14);
      this.tweens.add({ targets: ray, alpha: base * 0.4, yoyo: true, repeat: -1, duration: 4000 + Math.random() * 5000, ease: 'Sine.inOut', delay: Math.random() * 3000 });
      this.cullAdd(ray, x - 400, x + 200);
      x += 260 + Math.random() * 640;
    }
  }

  // ---------------------------------------------------------------- Gebiete, Pflanzen, Sichtbarkeit

  /** Das Gebiet an einer Stelle. */
  zoneAt(_x?: number): Zone {
    return this.L.zones[0];
  }

  /** Oberkante des Bodens bei x in der Nähe der Höhe y (Infinity, wenn dort keiner ist). */
  private groundTop(x: number, y: number) {
    let best = Infinity;
    let bd = 50;
    for (const list of [this.solidRects, this.platRects]) {
      for (const r of list) {
        if (x < r.x || x > r.x + r.w) continue;
        const d = Math.abs(r.y - y);
        if (d < bd) {
          bd = d;
          best = r.y;
        }
      }
    }
    return best;
  }

  /** Einen Fuß der halben Breite hw auf festen Boden setzen – notfalls etwas zur Mitte rücken. */
  private settle(x: number, y: number, hw: number): { x: number; y: number } | null {
    const reach = Math.max(4, hw * 0.5);
    for (const dx of [0, -6, 6, -12, 12, -20, 20, -30, 30, -44, 44]) {
      const px = x + dx;
      const top = this.groundTop(px, y);
      if (!isFinite(top)) continue;
      if (this.solidAt(px - reach, top + 4) && this.solidAt(px + reach, top + 4) && !this.solidAt(px, top - 6)) return { x: px, y: top };
    }
    return null;
  }

  private cullAdd(o: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible, x0: number, x1: number) {
    this.cullList.push({ o, x0, x1 });
  }

  /** Was weit außerhalb des Bildes liegt, wird nicht gezeichnet. */
  private cullStep(time: number) {
    if (time < this.cullAt) return;
    this.cullAt = time + 150;
    const v = this.cameras.main.worldView;
    const a = v.x - 320, b = v.right + 320;
    for (const c of this.cullList) {
      const vis = c.x1 > a && c.x0 < b;
      if (c.o.visible !== vis) c.o.setVisible(vis);
    }
  }

  /**
   * Deko und Bewuchs: jedes Stück etwas anders groß, gedreht, gefärbt; Pflanzen wachsen in Grüppchen
   * und wiegen sich. Dahinter eine Schicht dunkler Pflanzen, davor vereinzelt Schattenrisse.
   */
  private buildDecor() {
    const L = this.L;
    const rnd = Math.random;
    const tintOf = (f: number) => {
      const c = Math.round(255 * f);
      return (c << 16) | (c << 8) | c;
    };
    const put = (key: string, x: number, y: number, sc: number, depth: number, tint: number, alpha = 1, sink = 5) => {
      const tx = this.textures.get(key);
      const hw = ((tx.getSourceImage().width as number) * sc) / 2;
      const at = this.settle(x, y - sink, hw);
      if (!at) return null;
      if (L.caves.some((c) => at.x > c.x - 10 && at.x < c.x + c.w + 10 && at.y > c.y - 4 && at.y <= c.y + c.h + 4)) return null;
      const k = key.slice(3);
      const img = this.add.image(at.x, at.y + sink, key).setOrigin(0.5, 1).setDepth(depth).setScale(sc).setTint(tint).setAlpha(alpha).setFlipX(rnd() < 0.5);
      this.cullAdd(img, at.x - hw - 20, at.x + hw + 20);
      if (SWAYS.has(k)) this.swayList.push({ o: img, amp: (this.water ? 3 : 1.6) + rnd() * (this.water ? 4 : 2), sp: 0.5 + rnd() * 0.9, ph: rnd() * 6 });
      return img;
    };
    for (const d of L.decor) {
      const key = 'd2_' + d.k;
      if (!this.textures.exists(key)) continue;
      if (d.hang) {
        const img = this.add.image(d.x, d.y, key).setOrigin(0.5, 0).setDepth(DEPTH.decoBack).setScale(0.8 + rnd() * 0.5);
        this.cullAdd(img, d.x - 40, d.x + 40);
        continue;
      }
      const plant = SWAYS.has(d.k) || d.k === 'coral' || d.k === 'sponge' || d.k === 'cycad' || d.k === 'bush' || d.k === 'mushroom';
      const sc = plant ? 0.75 + rnd() * 0.6 : 0.8 + rnd() * 0.45;
      put(key, d.x, d.y, sc, DEPTH.decoBack, tintOf(0.78 + rnd() * 0.22));
      // Pflanzen wachsen selten allein
      if (plant && rnd() < 0.55) {
        for (let i = 0, n = 1 + Math.floor(rnd() * 2); i < n; i++) {
          put(key, d.x + (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 16), d.y, sc * (0.55 + rnd() * 0.3), DEPTH.decoBack, tintOf(0.7 + rnd() * 0.25));
        }
      }
    }
    // Hintergrund: dunkle, größere Pflanzen hinter allem
    const sil = SILHOUETTE[L.theme].map((k) => 'd2_' + k).filter((k) => this.textures.exists(k));
    const backTint = this.water ? 0x1e3a36 : L.theme === 'eis' ? 0x3a4652 : 0x1c2414;
    const foreTint = this.water ? 0x040a09 : 0x040503;
    if (sil.length) {
      for (let x = 30 + rnd() * 80; x < L.width; x += 60 + rnd() * 130) {
        const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
        if (L.ground[col] >= L.height) continue;
        put(pick(rnd, sil), x, L.ground[col], 1.2 + rnd() * 1.1, DEPTH.decoBack - 4, backTint, 0.75);
      }
      // Vordergrund: vereinzelt niedrige Schattenrisse vor dem Geschehen
      const low = sil.filter((k) => !k.includes('kelp') && !k.includes('deadtree') && !k.includes('reed') && !k.includes('horsetail'));
      for (let x = 200 + rnd() * 300; x < L.width && low.length; x += 380 + rnd() * 520) {
        const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
        if (L.ground[col] >= L.height) continue;
        put(pick(rnd, low), x, L.ground[col], 1.5 + rnd() * 0.8, DEPTH.decoFront, foreTint, 0.88, -14);
      }
    }
  }

  /** Gebiet: Schleier, Nebel und Licht gehen beim Durchschwimmen fließend ineinander über. */
  private zoneFx(time: number) {
    const z = this.L.zones[0].def;
    this.veil.setFillStyle(z.veil, z.veilA);
    this.fog.setAlpha(Math.min(0.85, 0.35 * z.fog));
    this.zoneLight = z.light;
    // trübes Wasser macht unauffälliger
    this.murk = this.place.kind === 'murky' ? z.veilA : 0;
    this.surfGlow?.setAlpha(0.42 * this.zoneLight);
    for (const c of this.caustics) c.s.setAlpha(c.a * this.zoneLight);
    // Pflanzen wiegen sich (nur die sichtbaren)
    const t = time / 1000;
    for (const w of this.swayList) if (w.o.visible) w.o.setAngle(Math.sin(t * w.sp + w.ph) * w.amp);
  }

  /** Eine kleine Gruppe deiner eigenen Art – fast gleich, aber nicht ganz. */
  private spawnKin() {
    const st = game.stats();
    const d = game.traits.diet;
    const diet = d > 0.3 ? 'meat' : 'plant';
    this.kinDef = {
      id: 'kin', name: 'Artgenosse', art: { t: 'jelly', r: 1, c: 0 }, role: 'prey', diet,
      habitat: this.water ? 'water' : 'land',
      hp: Math.max(8, st.maxHp * 0.6), dmg: Math.max(1, st.bite * 0.6), power: st.power * 0.75,
      speed: st.speed * 0.95, sense: 280, meat: 2, sprint: 1.35,
    };
    // Je mehr Rudeltier, desto mehr Artgenossen leben in der Gegend
    const n = game.prog.kin ?? ((game.run?.kin ?? 4) + (game.traits.pack > 0.5 ? 1 : 0));
    const s = this.L.start;
    for (let i = 0; i < n; i++) {
      // Artgenossen leben verstreut in der Gegend, jeder in seinem Revier – kein Schwarm um dich herum
      const side = i % 2 ? 1 : -1;
      const x = clamp(s.x + side * (170 + Math.floor(i / 2) * 260 + Math.random() * 120), 60, this.L.width - 60);
      const at = this.kinSpot(x, s.y) ?? { x: clamp(s.x + side * 60, 60, this.L.width - 60), y: s.y };
      const social = game.run?.social ?? 0.55;
      const genes = game.kinTraits(i);
      const k = new Kin(this, this.kinDef, at.x, at.y, game.morph({ traits: genes.traits, fierce: 0, seed: genes.seed, sex: genes.sex }), social + (Math.random() - 0.5) * 0.12);
      k.genes = genes;
      k.omni = d >= -0.3 && d <= 0.3;
      k.dir = Math.random() < 0.5 ? -1 : 1;
      this.animals.push(k);
    }
  }

  /** Ein freier Platz für einen Artgenossen: im Wasser irgendwo frei, an Land auf dem Boden. */
  private kinSpot(x: number, y: number): { x: number; y: number } | null {
    if (this.water) {
      for (let k = 0; k < 8; k++) {
        const py = y + (Math.random() - 0.5) * 220;
        if (py > this.surfaceY + 40 && !this.solidAt(x, py) && !this.solidAt(x, py + 24)) return { x, y: py };
      }
      return null;
    }
    // von oben nach unten: die erste Stelle, unter der fester Boden liegt
    for (let py = Math.max(20, y - 420); py < y + 420; py += 8) {
      if (!this.solidAt(x, py) && this.solidAt(x, py + 10) && !this.solidAt(x, py - 40)) return { x, y: py - 24 };
    }
    return null;
  }

  private ambient() {
    const t = this.L.theme;
    const base = { x: { min: VX, max: VX + VW }, lifespan: 9000, frequency: 120, quantity: 1 };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    let key = 'p_dot';
    if (t === 'ozean') {
      key = 'p_bubble';
      cfg = { ...base, y: VY + VH + 10, lifespan: 12000, speedY: { min: -25, max: -60 }, speedX: { min: -8, max: 8 }, scale: { min: 0.3, max: 0.8 }, alpha: { start: 0.45, end: 0 } };
    } else if (t === 'eis') {
      key = 'p_snow';
      cfg = { ...base, y: VY - 10, lifespan: 12000, speedY: { min: 30, max: 80 }, speedX: { min: -40, max: 0 }, scale: { min: 0.3, max: 1 }, alpha: { start: 0.8, end: 0.2 }, frequency: 40 };
    } else {
      cfg = {
        ...base, y: { min: VY, max: VY + VH }, speedY: t === 'reptil' ? { min: -40, max: -10 } : { min: -10, max: 10 }, speedX: { min: -12, max: 12 },
        scale: { start: 0.4, end: 0.05 }, alpha: { start: 0, end: 0.7, ease: 'Sine.inOut' }, lifespan: 4500, frequency: 200, tint: THEME_TINT[t],
      };
    }
    this.add.particles(0, 0, key, cfg).setScrollFactor(0).setDepth(DEPTH.decoFront - 1);
  }

  // ---------------------------------------------------------------- Welt-Schnittstelle

  solidAt(x: number, y: number) {
    for (const r of this.solidRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    for (const r of this.platRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    return false;
  }

  openY(x: number) {
    const col = clamp(Math.floor(x / TILE), 0, this.L.ground.length - 1);
    const floor = this.L.ground[col] ?? this.L.height;
    return this.surfaceY + Math.max(90, (floor - this.surfaceY) * 0.38);
  }

  herdOf(id: number) {
    return this.herds.get(id) ?? [];
  }

  spawnAnimal(id: string, x: number, y: number, herd?: number) {
    const def = SPECIES[id];
    makeSpeciesTextures(this, def);
    const a = new Animal(this, def, x, y);
    if (herd !== undefined) {
      a.herdId = herd;
      const list = this.herds.get(herd);
      if (list) list.push(a);
      else this.herds.set(herd, [a]);
    }
    // Kleine Beutetiere sind zerbrechlich: Schon ein frisch geschlüpftes Tier braucht nur zwei Bisse
    if (def.role === 'prey' && def.power <= 2.2) {
      const fresh = game.stats(game.cls, { ...ZERO_TRAITS }).bite;
      a.hp = a.maxHp = Math.min(a.maxHp, Math.round(fresh * 1.9 * 10) / 10);
    }
    this.groundIt(a);
    this.animals.push(a);
    return a;
  }

  /** Landtiere mit den Füßen auf den Boden stellen (große Tiere steckten sonst im Fels). */
  private groundIt(a: Animal) {
    if (this.water || a.def.habitat === 'air') return;
    const L = this.L;
    let col = clamp(Math.floor(a.x / TILE), 0, L.ground.length - 1);
    for (let k = 1; k < 8 && L.ground[col] >= L.height; k++) {
      const c2 = clamp(col + (k % 2 ? k : -k), 0, L.ground.length - 1);
      if (L.ground[c2] < L.height) col = c2;
    }
    const gy = L.ground[col];
    if (gy >= L.height) return;
    a.b.reset((col + 0.5) * TILE, gy - a.displayHeight / 2 - 2);
  }

  shoot(x: number, y: number, vx: number, vy: number, tex: string, dmg: number, gravity: boolean) {
    const s = this.physics.add.image(x, y, tex).setDepth(DEPTH.fx - 1);
    s.setData('dmg', dmg);
    s.setData('wave', tex === 'pr_wave');
    s.setData('by', tex === 'pr_wave' ? 'Druckwelle' : tex === 'fireball' ? 'Feuerregen' : 'Steinschlag');
    s.setData('die', this.time.now + 4500);
    const b = s.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(gravity && !this.water);
    b.setSize(s.width * 0.7, s.height * 0.7);
    b.setVelocity(vx, vy);
    if (tex === 'pr_wave') s.setFlipX(vx < 0);
    this.shots.push(s);
  }

  private popShot(s: PImg) {
    this.puff(s.x, s.y, 4);
    if (s.texture.key === 'fireball') this.cameras.main.shake(120, 0.004);
    s.destroy();
  }

  puff(x: number, y: number, n: number, tint?: number) {
    if (tint !== undefined) this.puffer.setParticleTint(tint);
    this.puffer.explode(n, x, y);
    if (tint !== undefined) this.puffer.setParticleTint(DUST[this.L.theme]);
  }

  bleed(x: number, y: number, n: number) {
    this.blood.explode(Math.round(n * 2), x, y);
    if (this.water) this.bloodClouds?.explode(Math.max(1, Math.round(n / 3)), x, y);
    else if (n >= 5) this.splat(x, y);
  }

  /** Ein Blutfleck auf dem Boden unter der Stelle (höchstens 24 – die ältesten werden wiederverwendet). */
  private splat(x: number, y: number) {
    let gy = y;
    for (let k = 0; k < 40 && !this.solidAt(x, gy + 4); k++) gy += 8;
    if (!this.solidAt(x, gy + 4)) return;
    let s: Phaser.GameObjects.Image;
    if (this.splats.length < 24) s = this.add.image(0, 0, 'blood_splat').setDepth(DEPTH.terrain + 3);
    else {
      s = this.splats.shift()!;
      this.tweens.killTweensOf(s);
    }
    this.splats.push(s);
    s.setPosition(x + (Math.random() - 0.5) * 20, gy + 2).setScale(0.6 + Math.random() * 0.7, 0.8).setAlpha(0.9);
    this.tweens.add({ targets: s, alpha: 0, delay: 30000, duration: 4000 });
  }

  /** Der gestärkte erste Angriff ist verbraucht. */
  private consumeAmbush() {
    this.ambushUntil = 0;
    this.primedUntil = 0;
    this.stillT = 0;
  }

  /** In der Dunkelheit: tief unten, in einem Tunnel oder einer Spalte. */
  private inDark() {
    return this.player.inCave || this.deepK > 0.3 || this.L.variant !== 'normal';
  }

  detectFactor(a: Animal) {
    const p = this.player;
    const t = game.traits;
    const coat = t.coat | 0;
    let k = p.stats.detect;
    if (p.hidden && p.inCave) k *= 0.08;
    else if (p.hidden) k *= 0.16;
    else if (coat === 2 && this.inDark()) k *= 0.5;
    else if (coat === 2 && p.y < this.surfaceY + 420) k *= 1.2;
    else if (p.grounded) k *= 0.75 - 0.4 * t.sand;
    k *= 0.55 + 0.6 * Math.min(1, p.speed01);
    if (this.L.variant !== 'normal') k *= 0.7;
    // im trüben Wasser bzw. Dunst sieht man schlechter
    k *= 1 - 0.9 * this.murk;
    // starke Nerven: Jäger bemerken einen später
    if (a.role === 'predator' || a.role === 'apex') k *= 1 - 0.45 * game.traits.nerve;
    if (this.stormK > 0) k *= 1 - 0.45 * this.stormK;
    if (!a.alerted && Math.sign(p.x - a.x) !== a.dir) k *= 0.6;
    return k;
  }

  playerThreat() {
    const p = this.player;
    let t = game.threat() * (0.6 + 0.4 * (p.hp / p.stats.maxHp));
    // Wer nicht allein ist, wirkt gefährlicher
    for (const a of this.animals) {
      if (a.dead || !(a.ally || a.kin)) continue;
      if (Math.abs(a.x - p.x) < 260 && Math.abs(a.y - p.y) < 200) t += a.def.power * (a.ally ? 0.5 : 0.15);
    }
    return t;
  }

  playerFear() {
    return game.fear();
  }

  playerCalm() {
    const p = this.player;
    // ruhig = nicht sprinten, nicht stoßen, eine Weile nicht gekämpft (normales Schwimmen ist in Ordnung)
    return !p.dead && !p.sprinting && !p.isRamming && this.time.now - this.fightAt > 5000;
  }

  playerPower() {
    return this.player.stats.power;
  }

  tired(a: Animal) {
    if (a.kin) return;
    this.pop('erschöpft', a.x, a.y - a.displayHeight * 0.5 - 12, '#9fd0e0');
    if (!this.tiredNoted && (a.role === 'apex' || a.role === 'predator')) {
      this.tiredNoted = true;
      bus.emit('story', `${a.def.name} ist erschöpft – jetzt ist es verwundbar.`);
    }
  }

  playerEscaped(a: Animal) {
    if (this.ended || this.player.dead) return;
    // wer Jägern entkommt, wird vorsichtiger und unauffälliger
    game.grow('stealth', a.role === 'apex' ? 0.05 : 0.03);
  }

  bonded(a: Animal) {
    this.sparkle.explode(14, a.x, a.y - 10);
    audio.sfx('bond');
  }

  left(a: Animal) {
    this.removeAnimal(a);
  }

  kinSnubbed(k: Kin, bit: boolean) {
    audio.sfx('snub');
    this.puff(k.x, k.y - 6, 3);
    if (bit && !this.grudgeNoted) {
      this.grudgeNoted = true;
      bus.emit('story', 'Dein Artgenosse hat mitgekämpft und nichts abbekommen – er beißt zu und zieht verärgert ab.');
    }
  }

  kinLeaving(k: Kin) {
    void k;
    if (!this.leftNoted) {
      this.leftNoted = true;
      bus.emit('story', 'Einige deiner Art ziehen allein weiter.');
    }
  }

  kinShared(k: Kin) {
    this.sparkle.explode(6, k.x, k.y - 8);
    // gemeinsam gefressen: Deine Art wird mehr und mehr zum Rudeltier
    game.grow('pack', 0.02);
  }

  /**
   * Du greifst etwas an: Artgenossen in der Nähe helfen vielleicht mit – je mehr deine Art zum
   * Rudeltier geworden ist und je mehr sie dir vertrauen, desto eher.
   */
  private callHunt(a: Animal) {
    if (a.kin || a.ally || a.dead || a.role === 'hazard') return;
    const p = this.player;
    const now = this.time.now;
    const kin = this.animals.filter((k): k is Kin => k instanceof Kin && !k.dead);
    const near = kin.filter((k) => Math.hypot(k.x - p.x, k.y - p.y) < 480);
    if (!near.length) return;
    const groupPower = near.reduce((sum, k) => sum + k.def.power, p.stats.power);
    const pack = game.traits.pack;
    for (const k of near) {
      const brave = a.def.power <= groupPower * 1.2 || k.loyalty > 0.75;
      if (!brave) continue;
      k.offerHunt(a, now + 7000, clamp(0.12 + 0.75 * pack + 0.35 * (k.loyalty - 0.5), 0.05, 0.95));
    }
  }

  /** Aus der Liste nehmen – ohne die Liste zu ersetzen (die Kollision hängt an genau diesem Array). */
  /** Liegt der Punkt außerhalb des Bildes (mit Rand)? */
  private offScreen(x: number, y: number, m: number) {
    const v = this.cameras.main.worldView;
    return x < v.x - m || x > v.right + m || y < v.y - m || y > v.bottom + m;
  }

  /** Beute, die schon eine Weile flieht, entkommt: aus dem Bild – oder am Rand des Ortes, wo es nicht mehr weitergeht. */
  private escaped(a: Animal, time: number) {
    if (a.runningFor(time) < 1500) return false;
    const b = a.body as Phaser.Physics.Arcade.Body;
    return this.offScreen(a.x, a.y, 140) || b.left <= 40 || b.right >= this.L.width - 40;
  }

  /** Entkommene Tiere kommen nach einer Weile wieder – andere Fische ziehen an ihrer Stelle ein, außerhalb des Bildes. */
  private restock(time: number) {
    if (time < this.restockAt || !this.returning.length) return;
    this.restockAt = time + 1500;
    for (let i = this.returning.length - 1; i >= 0; i--) {
      const r = this.returning[i];
      if (time < r.at) continue;
      if (!this.offScreen(r.x, r.y, 300)) {
        r.at = time + 6000;
        continue;
      }
      this.returning.splice(i, 1);
      this.spawnAnimal(r.id, r.x, r.y, r.herd);
    }
  }

  private removeAnimal(a: Animal) {
    const i = this.animals.indexOf(a);
    if (i >= 0) this.animals.splice(i, 1);
    this.ramHit.delete(a);
    const g = this.glints.get(a);
    if (g) {
      g.destroy();
      this.glints.delete(a);
    }
  }

  animalDied(a: Animal, byPlayer: boolean) {
    this.removeAnimal(a);
    this.bleed(a.x, a.y, 14);
    if (a.kin) {
      audio.sfx('squeal');
      if (byPlayer) game.addAggression(0.2);
      return;
    }
    // Beute, an der du beteiligt warst, gilt als deine
    const ours = byPlayer || this.time.now - a.hitByPlayerAt < 8000;
    const kill = new Kill(ours);
    for (const k of a.helpers) if (k instanceof Kin && !k.dead) kill.helpers.add(k);
    if (ours && kill.helpers.size) {
      // gemeinsam erlegt: Deine Art wird mehr und mehr zum Rudeltier
      game.grow('pack', 0.05);
      if (!this.shareNoted) {
        this.shareNoted = true;
        bus.emit('story', 'Gemeinsam erlegt! Wer mitgekämpft hat, will jetzt auch mitfressen.');
      }
    }
    // Wie in E.V.O.: Aus dem erlegten Tier wird saftiges Fleisch – große Tiere geben mehrere Stücke
    const killer = a.lastAttacker;
    const giant = killer instanceof Animal && (killer.role === 'apex' || !!killer.visitor || !!killer.def.boss);
    const meat = Math.max(1, a.def.meat);
    const n = (meat <= 4 ? 1 : meat <= 8 ? 2 : 3) + (giant ? 1 : 0);
    const each = (1.7 * meat * a.sz) / (meat <= 4 ? 1 : meat <= 8 ? 2 : 3);
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 70 + (Math.random() - 0.5) * 30;
      const vy = this.water ? -40 - Math.random() * 40 : -220 - Math.random() * 120;
      this.meats.push(new Meat(this, this, a.x, a.y, each, this.time.now, kill, spread, vy));
    }
    this.puff(a.x, a.y, 6, 0xffe0c0);
    if (byPlayer) {
      game.addAggression(a.role === 'prey' ? 0.1 : 0.06);
      audio.sfx('tear');
      this.train.hunt += 2;
    }
    this.bleed(a.x, a.y, 10);
    if (a.visitor) {
      this.cameras.main.shake(600, 0.012);
      audio.sfx('boom');
    }
    if (a === this.bossA && !this.ended) {
      this.bossBeaten = true;
      game.prog.boss = 2;
      bus.emit('boss', a.def.name, 0);
      bus.emit('story', `${a.def.name} ist besiegt! Der Weg in eine neue Zeit ist frei.`);
      this.cameras.main.flash(700, 255, 230, 180);
      audio.sfx('victory');
      this.time.delayedCall(3200, () => !this.ended && !this.player.dead && this.complete());
    }
  }

  // ---------------------------------------------------------------- Spieler-Aktionen

  /** Wie viel ein Kampf gegen dieses Tier das Gebiss stärkt: Kleine bringen kaum etwas, Starke viel. */
  private foeWeight(a: Animal) {
    const r = a.def.power / Math.max(1, this.player.stats.power);
    return clamp(0.12 + r * 0.9, 0.15, 1.6);
  }

  /** Kleine, flinke Beute zu jagen macht selbst schneller und wendiger: länger gestreckt, schlanker, flinker. */
  private agile(k: number) {
    game.shiftBody('swift', 0.022 * k);
    game.shiftBody('len', 0.014 * k);
    game.shiftBody('girth', -0.012 * k);
    game.grow('stealth', 0.003 * k);
  }

  playerBite(rect: Rect) {
    const p = this.player;
    const st = p.stats;
    const now = this.time.now;
    let hit = false;
    for (const a of [...this.animals]) {
      if (a.dead || !overlaps(rect, a.hitRect())) continue;
      hit = true;
      const sneak = now < this.ambushUntil && !a.seesPlayer && a.role !== 'hazard';
      // Zweimal kurz hintereinander dasselbe Tier: gepackt und festgehalten (Kleinere zappeln nur noch)
      const held = a === this.lastBitten && now - this.lastBiteAt < 1300 && a.def.power < st.power * 1.1 && a.role !== 'hazard';
      this.lastBitten = a;
      this.lastBiteAt = now;
      // ausgehungert beißt man schwächer
      a.hurt(st.bite * (0.5 + 0.5 * p.hungerK) * (sneak ? 2 + Math.min(1, game.traits.stealth * 2) : 1) * (held ? 1.25 : 1), p, 'bite');
      if (sneak) this.surprise(a);
      if (held && !a.dead) a.stun(550);
      // Wer sich mit Starken anlegt, bekommt ein stärkeres Gebiss; kleine Fische jagen macht eher flink und wendig
      const mult = this.foeWeight(a);
      game.grow('jaw', (held ? 0.0024 : 0.0012) * mult);
      if (mult < 0.5 && a.role !== 'hazard') this.agile(held ? 0.5 : 0.35);
      this.train.hunt += held ? 1.5 : 1;
      if (!a.dead) this.callHunt(a);
      if (a.role === 'hazard') p.hurt(a.def.dmg * 0.6, a.x, a.def.name);
      else game.addAggression(a.kin ? 0.08 : a.role === 'prey' ? 0.04 : 0.025);
    }
    if (hit) {
      this.fightAt = now;
      this.consumeAmbush();
      audio.sfx('crunch', game.traits.jaw);
      this.cameras.main.shake(70 + 60 * game.traits.jaw, 0.004 + 0.004 * game.traits.jaw);
      return;
    }
    for (const m of this.meats) {
      if (m.gone || m.value <= 0 || !overlaps(rect, m.rect)) continue;
      const dig = st.digestMeat;
      const room = p.maxSat - p.satiety;
      // so viel, wie in den Magen passt – der Rest bleibt liegen
      const got = room > 0.5 ? m.bite(room / dig) : 0;
      if (!p.eat(got * dig, 'meat')) return;
      this.floatNum(m.x, m.y - 16, got * dig, 'meat');
      this.ate('meat', got * (FOOD.meat.kcal / FOOD.meat.sat) * dig);
      m.playerBites++;
      m.kill.playerAte = true;
      // Fleisch macht den Kiefer stark – und vorn wachsen Reißzähne
      const k = Math.min(2, got / FOOD.meat.sat);
      game.grow('jaw', 0.005 * k);
      game.grow('fang', 0.007 * k);
      game.grow('digM', 0.02 * k);
      game.shiftDiet(0.05 * k);
      game.grow('growth', 0.006 * k * dig);
      this.checkShare(m.kill);
      return;
    }
    for (const pl of this.plants) {
      if (pl.units <= 0 || !overlaps(rect, pl.rect)) continue;
      const food = pl.toxic ? FOOD.toxic : FOOD.plant;
      const gain = Math.min(food.sat * st.digestPlant, p.maxSat - p.satiety);
      // Ein Heilkraut hilft auch dem, der satt ist – dann wird es nur nicht verdaut
      if (pl.heals && gain < 0.5 && p.hp < p.stats.maxHp - 0.5) {
        pl.take(now);
        this.healed(pl);
        return;
      }
      if (p.eat(gain, 'plant')) {
        this.floatNum(pl.x, pl.y - 44, gain, pl.toxic ? 'toxic' : 'plant');
        this.ate('plant', food.kcal * st.digestPlant);
        pl.take(now);
        if (pl.toxic) this.poisoned();
        else if (pl.heals) this.healed(pl);
        else game.grow('digP', 0.012);
        game.grow('stealth', 0.012);
        game.shiftDiet(-0.05);
        game.grow('growth', 0.003 * st.digestPlant);
        this.puff(pl.x, pl.y - 20, 4, 0x6a7a3a);
      }
      return;
    }
  }

  /**
   * Hast du gemeinsame Beute allein gefressen? Wer mitgekämpft und nichts abbekommen hat, ist sauer:
   * Ist nichts mehr übrig, beißt er zu und zieht ab; steht er gerade daneben, ärgert er sich nur.
   */
  private checkShare(kill: Kill) {
    if (!kill.helpers.size) return;
    const left = kill.left;
    const p = this.player;
    for (const h of kill.helpers) {
      if (!(h instanceof Kin) || h.dead || kill.fed.has(h)) continue;
      if (!left) h.grudge(true);
      else if (Math.hypot(h.x - p.x, h.y - p.y) < 110) h.grudge(false);
    }
  }

  /** Eine Zahl, die kurz aufsteigt: wie viel ein Happen gebracht hat (rot Fleisch, grün Pflanzen). */
  floatNum(x: number, y: number, n: number, kind: 'meat' | 'plant' | 'toxic') {
    const v = Math.round(n);
    if (v < 1) return;
    const col = kind === 'meat' ? '#ff4a3c' : kind === 'toxic' ? '#c486f0' : '#7fdc5a';
    const t = text(this, x, y, `+${v}`, Math.round((kind === 'meat' ? 30 : 25) / Z), col, { fontStyle: 'bold', stroke: '#160806', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(DEPTH.text).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: t, y: y - 70, duration: 1500, ease: 'Sine.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 500, onComplete: () => t.destroy() });
  }

  /** Kraftbalken über dem Fisch: blendet sich ein, wenn die Kraft schwindet, und wieder aus, wenn sie zurück ist. */
  private drawStamina(p: Player, dt: number) {
    const show = !p.dead && (p.stamina < 0.97 || p.exhausted);
    this.stamA = clamp(this.stamA + (show ? dt * 5 : -dt * 1.6), 0, 1);
    const g = this.stamG;
    g.clear();
    if (this.stamA < 0.03) return;
    const w = 64, h = 5;
    const x = p.x - w / 2, y = p.y - p.rect.height / 2 - 26;
    g.fillStyle(0x050403, 0.5 * this.stamA);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    const f = clamp(p.stamina, 0, 1);
    const col = p.exhausted ? 0xd8803c : p.resting ? 0x8fe0c0 : 0x9ad0e8;
    g.fillStyle(col, 0.9 * this.stamA);
    g.fillRoundedRect(x, y, Math.max(2, w * f), h, 3);
  }

  /** Heilkraut: die Wunden schließen sich, die Kraft kehrt zurück. */
  private healed(pl: Plant) {
    const p = this.player;
    p.heal(HEAL_BITE);
    p.stamina = Math.min(1, p.stamina + 0.3);
    p.view.flash(0xffc8e0);
    this.time.delayedCall(160, () => p.view.flash(null));
    this.puff(pl.x, pl.y - 24, 6, 0xffb0d0);
    if (!this.healNoted) {
      this.healNoted = true;
      bus.emit('story', 'Dieses Kraut tut gut – die Wunden schließen sich.');
    }
  }

  /** Giftige Pflanze: brennt und schwächt – macht aber kurz hellwach und schnell. */
  private poisoned() {
    const p = this.player;
    const tox = game.traits.tox;
    p.hp = Math.max(1, p.hp - p.stats.maxHp * 0.12 * (1 - 0.85 * tox));
    p.lastHurt = this.time.now;
    p.view.flash(0xa060d0);
    this.time.delayedCall(140, () => p.view.flash(null));
    p.boost(7000);
    game.grow('tox', 0.08);
    if (!this.toxNoted) {
      this.toxNoted = true;
      bus.emit('story', 'Die Pflanze brennt im Maul – doch plötzlich bist du hellwach.');
    }
  }

  /** Mitzählen, was gefressen wurde (für die Statistik und die Vielfalt des Nachwuchses). */
  private ate(kind: 'meat' | 'plant', units: number) {
    if (kind === 'meat') this.eatenMeat += units;
    else this.eatenPlant += units;
    game.addEaten(kind, units);
  }

  /** Kalorien (für die Anzeige) */
  kcal(units: number) {
    return kcalOf(units, game.cls, this.player.stats.size);
  }

  /**
   * Stoß: Wer mit Schwung in ein Tier stößt, betäubt kleine und mittelgroße Tiere einen Moment lang –
   * Zeit für ein, zwei Bisse, bevor sie fliehen oder zurückbeißen. Schaden macht er anfangs kaum; wer oft
   * stößt, bekommt einen harten, später gepanzerten Kopf und stößt kräftiger. Große Tiere taumeln nur kurz,
   * und wer gegen etwas viel Größeres stößt, tut sich selbst weh.
   */
  private collide(a: Animal, approach: number) {
    const p = this.player;
    const st = p.stats;
    const t = game.traits;
    const sf = clamp(approach, 0.6, 1.4);
    this.ramHit.set(a, this.time.now);
    this.fightAt = this.time.now;
    const plates = Math.max(0, -t.spike) * t.skull;
    const sneak = this.time.now < this.ambushUntil && !a.seesPlayer;
    const dealt = st.ram * 0.5 * sf * (0.5 + 0.5 * p.hungerK);
    const small = a.def.power <= st.power * 3;
    a.hurt(dealt * (sneak ? 2.5 : 1), p, 'ram');
    if (!a.dead) a.stun(small ? 1150 : a.role === 'apex' ? 220 : 500);
    if (sneak) {
      this.surprise(a);
      this.consumeAmbush();
    }
    // gegen etwas viel Größeres zu stoßen, tut weh (ein harter Schädel schützt)
    const back = Math.max(0, a.def.power - st.power * 1.5) * 0.12 * (1 - 0.65 * t.skull) * (1 - 0.5 * plates);
    const k = clamp(a.def.power / (st.power + 1), 0, 1);
    p.recoil(a.x, back, k * 0.6);
    game.grow('skull', 0.007 * sf);
    // Ein viel benutzter Kopf wird zum Panzer – erst recht, wenn damit Tiere erlegt werden
    game.armorHead(a.dead ? 0.09 : 0.03);
    if (a.dead) game.grow('skull', 0.008);
    this.train.ram += a.dead ? 3 : 1;
    if (a.role !== 'hazard') game.addAggression(0.035);
    if (!a.dead) this.callHunt(a);
    audio.sfx('ram');
    this.cameras.main.shake(160, 0.009);
    this.puff((a.x + p.x) / 2, p.y, 6);
    this.bleed((a.x + p.x) / 2, (a.y + p.y) / 2, 5);
  }

  // ---------------------------------------------------------------- Ablauf

  update(time: number, delta: number) {
    const p = this.player;
    // Kino-Moment: läuft in echter Zeit, alles andere in Zeitlupe
    if (this.cineWanted && !this.cine && !this.ended && !p.dead) this.tryCine();
    if (this.cine) this.cineStep(delta);
    const dt = Math.min(0.05, delta / 1000) * this.slow;
    this.t += dt;
    const L = this.L;
    if (!this.ended && !(this.cine && !this.cine.released)) this.controls.update();
    else this.controls.clear();
    p.update(time, dt, this.controls);
    this.drawStamina(p, dt);
    for (const a of [...this.animals]) {
      try {
        a.tick(time, dt);
      } catch (e) {
        // Ein Fehler im Verhalten eines Tieres darf nicht das ganze Spiel anhalten
        reportError('Tier ' + a.def.id, e);
        this.removeAnimal(a);
        a.vanish();
        continue;
      }
      if (!a.dead && a.y > L.height + 200) {
        // aus der Welt gefallen: als fort markieren, damit niemand mehr danach greift
        this.removeAnimal(a);
        a.vanish();
      } else if (!a.dead && this.escaped(a, time)) {
        // Wer lange davonrennt und aus dem Bild ist (oder am Rand nicht weiterkommt), ist entkommen – und weg
        const off = this.offScreen(a.x, a.y, 140);
        this.returning.push({ id: a.def.id, x: a.home.x, y: a.home.y, herd: a.herdId >= 0 ? a.herdId : undefined, at: time + 30000 + Math.random() * 30000 });
        this.removeAnimal(a);
        if (off) a.vanish();
        else this.tweens.add({ targets: a, alpha: 0, duration: 450, onComplete: () => a.vanish() });
      } else if (a.leaveDir && !a.dead && (a.leaveDir > 0 ? a.body!.right >= L.width - 6 : a.body!.left <= 6)) {
        // am Rand angekommen: zieht in andere Gewässer weiter
        this.removeAnimal(a);
        this.tweens.add({ targets: a, alpha: 0, duration: 500, onComplete: () => a.vanish() });
      }
    }
    const bloom = time < this.bloomUntil;
    for (const pl of this.plants) pl.update(time, bloom);
    for (const c of this.meats) c.update(time, dt);
    this.meats = this.meats.filter((c) => !c.gone);

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.08;
    this.bgMid.tilePositionX = cam.scrollX * 0.28;
    this.fog.tilePositionX = cam.scrollX * 0.5 + this.t * 12;
    this.backSea?.update(time, dt, this.deepK);
    for (const t of this.lava) t.tilePositionX += dt * 25;
    for (const c of this.caustics) c.s.tilePositionX += dt * c.v;
    this.darkness?.setPosition(p.x, p.y);
    this.eyeGlints();
    this.zoneFx(time);
    this.cullStep(time);
    if (!this.ended) {
      this.flowStep(dt);
      this.dreadStep(dt);
      this.deepStep(time, dt);
    }

    if (!p.dead && !this.ended) {
      this.elapsed += dt;
      this.clock(time);
      this.interact(time, dt);
      this.shellStep(time);
      this.gateStep(time, dt);
      this.weather(time, dt);
      this.migrate(time);
      this.restock(time);
      this.huntMood(time);
      if (this.elapsed >= this.ep.seconds) this.complete();
    }

    // Geschosse (Druckwellen, Steinschlag, Feuerregen)
    for (const s of this.shots) {
      if (!s.active) continue;
      if (time > (s.getData('die') as number) || s.y > L.height + 100 || s.x < -50 || s.x > L.width + 50) {
        s.destroy();
        continue;
      }
      if (!p.dead && !this.ended && overlaps(p.hitRect(), { x: s.x - s.width * 0.3, y: s.y - s.height * 0.3, w: s.width * 0.6, h: s.height * 0.6 })) {
        p.hurt(s.getData('dmg') as number, s.x, s.getData('by') as string);
        if (!s.getData('wave')) this.popShot(s);
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (!this.shots[i].active) this.shots.splice(i, 1);

    if (this.dbg && time > this.lookAt - 300) {
      const t = game.traits;
      const kin = this.animals.filter((a) => a.kin).length;
      const allies = this.animals.filter((a) => a.ally).length;
      const vis = this.animals.filter((a) => a.visitor).length;
      this.dbg.setText(
        `LP ${p.hp.toFixed(0)}/${p.stats.maxHp}  Sätt ${p.satiety.toFixed(0)}  Ausd ${(p.stamina * 100).toFixed(0)}  Versteckt ${p.hidden}  Zeit ${this.elapsed.toFixed(0)}/${this.ep.seconds}\n` +
          `Kiefer ${t.jaw.toFixed(3)}  Schädel ${t.skull.toFixed(3)}  Tarnung ${t.stealth.toFixed(3)}  Wachstum ${t.growth.toFixed(3)}\n` +
          `Kost ${t.diet.toFixed(2)}  Narben ${t.scars}  Aggr ${game.run?.aggression.toFixed(2)}  Ruf ${game.run?.infamy.toFixed(2)}  Bedrohung ${this.playerThreat().toFixed(1)}\n` +
          `Biss ${p.stats.bite.toFixed(1)}  Ramme ${p.stats.ram.toFixed(1)}  Tempo ${p.stats.speed.toFixed(0)}  Tiere ${this.animals.length}  Artgenossen ${kin}  Verbündete ${allies}  Durchzügler ${vis}`,
      );
    }
  }

  /** In der Höhle sieht man von dir und deiner Art nur noch die Augen. */
  private eyeGlints() {
    if (!this.L.caves.length) return;
    // erst alle aus – so bleibt auch von Toten oder Fortgezogenen kein Leuchten zurück
    for (const g of this.glints.values()) g.setVisible(false);
    const inCave = (x: number, y: number) => this.L.caves.some((c) => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);
    const p = this.player;
    this.glint(p, p.view, !p.dead && p.inCave);
    for (const a of this.animals) if (a instanceof Kin) this.glint(a, a.view, !a.dead && inCave(a.x, a.y));
  }

  private glint(key: object, v: Player['view'], show: boolean) {
    if (!show) return;
    let g = this.glints.get(key);
    if (!g) {
      g = this.add.image(0, 0, 'eyeglint').setDepth(DEPTH.decoFront + 0.8).setBlendMode(Phaser.BlendModes.ADD).setData('ph', Math.random() * 4);
      this.glints.set(key, g);
    }
    const e = v.eyeWorld();
    // gelegentlich blinzeln
    const blink = (this.t + (g.getData('ph') as number)) % 4.3 < 0.12;
    const sc = Math.max(0.5, e.r / 5);
    g.setVisible(true).setPosition(e.x, e.y).setScale(sc, blink ? 0.08 : sc).setAlpha(0.9);
  }

  /** Die Uhr des Zeitalters – und was zu welcher Zeit geschieht. Sichtbar ist sie oben im Bild (HUD). */
  private clock(_time: number) {
    const prog = clamp(this.elapsed / this.ep.seconds, 0, 1);
    for (const e of this.timeline) {
      if (!e.done && prog >= e.def.at) {
        e.done = true;
        game.prog.events.push(e.i);
        this.trigger(e.def);
      }
    }
    // Es gibt keine sichtbare Uhr – ein leiser Hinweis, bevor die Zeit abläuft
    if (prog > 0.93 && !this.endNoted) {
      this.endNoted = true;
      bus.emit('story', 'Das Zeitalter neigt sich dem Ende.');
    }
  }

  private trigger(ev: EventDef) {
    if (ev.line) bus.emit('story', ev.line);
    const now = this.time.now;
    switch (ev.kind) {
      case 'predator':
        this.spawnVisitors(ev.species!, ev.count ?? 1, !!ev.fast);
        break;
      case 'boss':
        game.prog.boss = 1;
        this.spawnBoss(ev.species!);
        break;
      case 'bloom':
        this.bloomUntil = now + 20000;
        for (const pl of this.plants) {
          pl.refill();
          this.sparkle.explode(4, pl.x, pl.y - 24);
        }
        break;
      case 'storm':
        this.stormUntil = now + (ev.dur ?? 18) * 1000;
        this.startStormFx();
        break;
      case 'leviathan':
        this.cineWanted = true;
        break;
    }
  }

  /**
   * Kino-Moment: Das Spiel wird langsamer, die Kamera rückt an dein Tier heran, die Musik wird leise und
   * das Meer laut – du hältst inne. Im Hintergrund zieht ein riesiger Schatten vorbei. Dann geht es weiter.
   * Er beginnt erst, wenn dich gerade niemand jagt (sonst etwas später – oder gar nicht).
   */
  private tryCine() {
    const p = this.player;
    if (this.elapsed / this.ep.seconds > 0.55) {
      this.cineWanted = false;
      return;
    }
    if (this.animals.some((a) => !a.dead && a.target === p && Math.hypot(a.x - p.x, a.y - p.y) < 800)) return;
    this.cineWanted = false;
    const big = SPECIES.dunkleosteus;
    makeSpeciesTextures(this, big);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const img = this.add.image(0, 0, speciesKey(big.id, 0)).setScrollFactor(0).setDepth(DEPTH.bg + 1.5)
      .setTint(0x08161a).setAlpha(0).setScale(3.4).setFlipX(dir < 0);
    this.cine = { t: 0, img, dir, y: H * (0.34 + Math.random() * 0.12), rumbled: false, released: false };
    p.shielded = true;
    bus.emit('cine', true);
    audio.musicLevel(0.25, 1.8);
    audio.sea(0.6, 2);
    // die kleinen Fische ringsum suchen das Weite
    for (const a of this.animals) {
      if (!a.dead && !a.kin && a.role === 'prey' && Math.hypot(a.x - p.x, a.y - p.y) < 900) a.panic({ x: p.x - dir * 900, y: p.y });
    }
  }

  private cineStep(delta: number) {
    const c = this.cine!;
    c.t += delta;
    const IN = 1700, PASS = 7600, OUT = 1700;
    const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
    const k = c.t < IN ? ease(c.t / IN) : c.t < IN + PASS ? 1 : 1 - ease((c.t - IN - PASS) / OUT);
    this.slow = 1 - 0.68 * k;
    this.physics.world.timeScale = 1 / this.slow;
    this.tweens.timeScale = this.slow;
    this.anims.globalTimeScale = this.slow;
    this.cameras.main.setZoom(Z * (1 + 0.32 * k));
    // der Riese zieht weit hinten durchs Bild (vor dem fernen Hintergrund, hinter allem anderen)
    const u = clamp((c.t - IN * 0.5) / PASS, 0, 1);
    const x0 = c.dir > 0 ? VX - 800 : VX + VW + 800, x1 = c.dir > 0 ? VX + VW + 800 : VX - 800;
    c.img.setPosition(x0 + (x1 - x0) * ease(u * 0.9 + 0.05), c.y + Math.sin(u * Math.PI * 2) * 24);
    c.img.setAlpha(0.72 * Math.min(1, u * 6, (1 - u) * 6));
    c.img.setScale(3.4, 3.4 * (1 + 0.025 * Math.sin(c.t / 320)));
    c.img.setAngle(Math.sin(c.t / 1100) * 2.5);
    if (!c.rumbled && u > 0.12) {
      c.rumbled = true;
      audio.sfx('rumble');
    }
    if (!c.released && c.t >= IN + PASS) {
      c.released = true;
      this.player.shielded = false;
      bus.emit('cine', false);
      audio.musicLevel(1, 2);
      audio.sea(this.water ? 0.08 : 0, 2.5);
      bus.emit('story', 'Ein gewaltiger Schatten in der Tiefe … Was dort unten lebt, wird größer werden.');
    }
    if (c.t >= IN + PASS + OUT) this.endCine();
  }

  private endCine() {
    this.cine?.img.destroy();
    this.cine = undefined;
    this.slow = 1;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
    this.cameras.main.setZoom(Z);
    this.player.shielded = false;
  }

  /** Große Räuber ziehen durch – von der Seite, die weiter weg ist, zur anderen. */
  private spawnVisitors(id: string, count: number, fast = false) {
    const def = SPECIES[id];
    if (!def) return;
    makeSpeciesTextures(this, def);
    const L = this.L;
    const p = this.player;
    // Sie tauchen außerhalb des Bildes neben dir auf und ziehen an dir vorbei (der Lebensraum ist groß)
    let fromLeft = Math.random() < 0.5;
    if (p.x < 1100) fromLeft = false;
    if (p.x > L.width - 1100) fromLeft = true;
    const dir = fromLeft ? 1 : -1;
    const sx = clamp(p.x - dir * (fast ? 1150 : 1000), 50, L.width - 50);
    const endX = clamp(p.x + dir * (fast ? 2400 : 1600), 40, L.width - 40);
    if (def.boss || def.role === 'apex') this.warnGiant({ x: sx, y: p.y });
    else audio.sfx('rumble');
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 900, () => {
        if (this.ended) return;
        const x = clamp(sx - dir * i * 20, 50, L.width - 50);
        const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
        const ground = L.ground[col] < L.height ? L.ground[col] : L.start.y + 60;
        let y: number;
        let cruiseY: number;
        if (this.water) {
          cruiseY = clamp(p.y + (Math.random() - 0.5) * (fast ? 60 : 160) + i * 40, L.surfaceY + 90, ground - 90);
          y = cruiseY;
        } else if (def.habitat === 'air') {
          cruiseY = ground - 190 - Math.random() * 80;
          y = cruiseY;
        } else {
          y = ground - 90;
          cruiseY = y;
        }
        const a = new Animal(this, def, x, y);
        this.groundIt(a);
        a.visitor = { dir, endX, cruiseY, huntUntil: 0, boredUntil: 0, fast };
        a.dir = dir;
        a.setAlpha(0);
        this.tweens.add({ targets: a, alpha: 1, duration: 900 });
        this.animals.push(a);
      });
    }
  }

  /**
   * Der Endgegner der Region taucht auf und bleibt: Wer ihn besiegt, darf in die nächste Zeit.
   * Wer nur überlebt, bleibt eine weitere Generation in diesem Zeitalter.
   */
  private spawnBoss(id: string) {
    const def = SPECIES[id];
    if (!def || this.bossA) return;
    makeSpeciesTextures(this, def);
    const L = this.L;
    const p = this.player;
    const side = p.x > L.width - 1200 ? -1 : p.x < 1200 ? 1 : Math.random() < 0.5 ? -1 : 1;
    const x = clamp(p.x + side * 950, 60, L.width - 60);
    const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
    const y = this.water ? clamp(p.y, L.surfaceY + 120, L.ground[col] - 120) : L.ground[col] - 120;
    const a = new Animal(this, def, x, y);
    this.groundIt(a);
    a.boss = true;
    a.dir = -side;
    a.setAlpha(0);
    this.tweens.add({ targets: a, alpha: 1, duration: 900 });
    this.animals.push(a);
    this.bossA = a;
    this.warnGiant({ x, y });
    audio.music('apex');
  }

  /** Neue Tiere wandern ein, wenn der Lebensraum leerer wird. */
  private migrate(time: number) {
    if (time < this.nextMigrate) return;
    this.nextMigrate = time + 15000;
    const resident = this.animals.filter((a) => !a.dead && !a.kin && !a.visitor).length;
    // Auch die Tiere hier ziehen weiter: Manche schwimmen zum Rand und verlassen das Gewässer
    if (Math.random() < 0.55) {
      const p = this.player;
      const goers = this.animals.filter((a) => !a.dead && !a.kin && !a.ally && !a.visitor && !a.boss && !a.leaveDir && a.role !== 'hazard' && a.role !== 'apex'
        && Math.abs(a.x - p.x) > 700 && !a.target);
      const a = goers[Math.floor(Math.random() * goers.length)];
      if (a) a.leaveDir = a.x < this.L.width / 2 ? -1 : 1;
    }
    if (resident >= this.faunaCount) return;
    const pool = this.ep.fauna.map(([id]) => id).filter((id) => SPECIES[id].role !== 'hazard');
    if (!pool.length) return;
    const L = this.L;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = clamp(this.player.x + side * (1000 + Math.random() * 400), 70, L.width - 70);
    // im Jagdgebiet kommen eher Jäger, im ruhigen eher Beute
    const z = this.zoneAt(x).def;
    const weight = (id: string) => {
      const d = SPECIES[id];
      const r = d.role;
      return (r === 'predator' || r === 'apex' ? z.hunters : r === 'prey' ? z.prey : 1) * (d.where?.[this.place.kind] ?? 1);
    };
    let roll = Math.random() * pool.reduce((sum, id) => sum + weight(id), 0);
    const id = pool.find((pid) => (roll -= weight(pid)) <= 0) ?? pool[0];
    const def = SPECIES[id];
    const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
    const ground = L.ground[col];
    const depth = ground - L.surfaceY;
    const y = this.water
      ? (def.crawl ? ground - 24
        : def.layer === 'floor' ? ground - 70 - Math.random() * 150
          : def.layer === 'mid' ? L.surfaceY + depth * (0.3 + Math.random() * 0.35)
            : def.layer === 'open' ? L.surfaceY + depth * (0.12 + Math.random() * 0.5)
              : clamp(ground - 140 - Math.random() * 200, L.surfaceY + 60, ground - 40))
      : def.habitat === 'air' ? ground - 150 : ground - 50;
    const a = this.spawnAnimal(id, x, y);
    a.setAlpha(0);
    this.tweens.add({ targets: a, alpha: 1, duration: 800 });
  }

  /** Wetter: Sturm wühlt das Wasser auf. */
  private weather(time: number, dt: number) {
    const storm = time < this.stormUntil;
    this.stormK = clamp(this.stormK + (storm ? dt / 3 : -dt / 3), 0, 1);
    if (this.stormFx) {
      this.stormFx.veil.setAlpha(this.stormK * 0.55);
      if (!storm && this.stormK <= 0) {
        this.stormFx.p.stop();
        this.stormFx.veil.destroy();
        this.stormFx = undefined;
      }
    }
  }

  private startStormFx() {
    if (this.stormFx) return;
    // aufgewühltes, trübes Wasser: Schwebeteilchen und ein dunkler Schleier
    const veil = this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(VW * 1.4, VH * 1.4).setTint(0x1a3a30).setAlpha(0).setDepth(DEPTH.dark - 2);
    const pe = this.add.particles(0, 0, 'p_dot', {
      x: { min: VX, max: VX + VW }, y: { min: VY, max: VY + VH }, speedX: { min: -60, max: 60 }, speedY: { min: -20, max: 20 }, lifespan: 3000, frequency: 20,
      scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.5, end: 0 }, tint: 0x6a7a60,
    }).setScrollFactor(0).setDepth(DEPTH.decoFront);
    this.stormFx = { veil, p: pe };
  }

  /** Musik und Ankündigung, wenn ein großer Räuber Jagd auf dich macht. */
  private huntMood(time: number) {
    const hunter = this.animals.find((a) => !a.dead && a.huntingPlayer && (a.visitor || a.role === 'apex'));
    if (hunter) {
      this.huntLost = 0;
      if (!this.huntMusic) {
        this.huntMusic = time;
        audio.music('apex');
      }
      if (!this.announced.has(hunter.def.id)) {
        this.announced.add(hunter.def.id);
        bus.emit('apex', hunter.def.name);
      }
    } else if (this.huntMusic) {
      if (!this.huntLost) this.huntLost = time;
      else if (time - this.huntLost > 5000) {
        this.huntMusic = 0;
        this.huntLost = 0;
        audio.music(this.ep.music);
      }
    }
  }

  private interact(time: number, dt: number) {
    const L = this.L;
    const p = this.player;
    const pr = p.hitRect();
    const cx = p.x, cy = p.y;

    // Verstecken: nur mit der passenden Farbe. Grün verschwindet im Gras (Dickicht), Schwarz in der Dunkelheit;
    // Tunnel und Felsspalten sind für alle dunkel genug. Ohne Farbe sieht man dich im Gras.
    const coat = game.traits.coat | 0;
    const ci = L.cover.findIndex((c) => cx > c.x + 6 && cx < c.x + c.w - 6 && cy > c.y - 10 && cy < c.y + c.h + 10);
    const tunnel = L.caves.findIndex((c) => cx > c.x && cx < c.x + c.w && cy > c.y && cy < c.y + c.h);
    p.inCave = tunnel >= 0
      || L.crevices.some((c) => cx > c.x + 10 && cx < c.x + c.w - 10 && cy > c.y - 10 && cy < c.y + c.h + 10);
    const camo = (coat === 1 && ci >= 0) || (coat === 2 && this.inDark());
    p.inCover = p.inCave || (coat === 1 && ci >= 0);
    p.hidden = (p.inCave || camo) && p.speed01 < 0.55 && !p.sprinting;
    const b = p.body;
    p.grounded = !p.inCover && p.speed01 < 0.15 && (this.water ? this.solidAt(cx, b.bottom + 8) : b.blocked.down);
    p.view.setShade(p.inCave ? 0x2a2a2a : p.hidden ? 0x4e4e4e : null);
    // Hinterhalt wie bei Teemo: Wer in seinem Versteck 1,5 Sekunden still hält, ist bereit – der nächste Angriff
    // (auch gleich nach dem Hervorbrechen) trifft viel härter. Ohne passende Farbe gibt es keinen Überraschungsangriff.
    const still = p.speed01 < 0.12 && !p.sprinting && !p.isRamming;
    if (!(camo && still)) this.stillT = 0;
    else if (!this.stillT) this.stillT = time;
    if (this.stillT && time - this.stillT >= 1500) {
      if (time > this.primedUntil) {
        this.sparkle.explode(3, p.x, p.y - 6);
        if (!this.primeNoted) {
          this.primeNoted = true;
          bus.emit('story', 'Niemand sieht dich. Dein nächster Angriff trifft aus dem Hinterhalt.');
        }
      }
      this.primedUntil = time + 1500;
    }
    p.ambush = time < this.primedUntil;
    if (p.ambush) this.ambushUntil = this.primedUntil;
    if (p.hidden && p.speed01 < 0.2) this.train.hide += dt;
    // Durch einen Tunnel schwimmen: Wer auf der anderen Seite herauskommt, trägt die Farbe der Höhle
    if (tunnel !== this.curCave) {
      if (tunnel >= 0) {
        this.curCave = tunnel;
        this.caveSide = cx < L.caves[tunnel].x + L.caves[tunnel].w / 2 ? -1 : 1;
      } else {
        const c = L.caves[this.curCave];
        this.curCave = -1;
        if (c && (cx < c.x + c.w / 2 ? -1 : 1) !== this.caveSide) this.paintCoat(c.coat);
      }
    }
    // Wer sich viel versteckt, nimmt die Farben seiner Verstecke an
    // Oben im Licht wird man heller, unten in der Tiefe (bzw. im Schatten) dunkler
    if (this.water) {
      const col = clamp(Math.floor(cx / TILE), 0, L.ground.length - 1);
      const depth = (cy - L.surfaceY) / Math.max(80, L.ground[col] - L.surfaceY);
      if (depth < 0.32) game.shiftLight(0.004 * dt);
      else if (depth > 0.72) game.shiftLight(-0.004 * dt);
      // Wer die meiste Zeit tief unten überlebt, wird selbst größer, massiger und gefährlicher
      const deep = this.deepK * (this.place.kind === 'abyss' ? 1.4 : 1);
      if (deep > 0.05) {
        game.grow('growth', 0.0014 * dt * deep);
        game.shiftBody('girth', 0.0011 * dt * deep);
        game.grow('jaw', 0.0005 * dt * deep);
        game.grow('nerve', 0.0008 * dt * deep);
      }
    } else if (p.inCover || p.inCave) game.shiftLight(-0.003 * dt);
    else game.shiftLight(0.0015 * dt);
    // Wer viel und schnell schwimmt bzw. läuft, wird länglicher und flinker
    if (p.speed01 > 0.7 && !p.bottomWalk) {
      game.shiftBody('len', 0.0035 * dt * Math.min(1.5, p.speed01));
      // kräftiges Sprinten: ein breiterer, stärkerer Schwanz
      if (p.sprinting) {
        game.shiftBody('swift', 0.002 * dt);
        game.shiftBody('tail', 0.0025 * dt);
      }
      this.train.swim += dt * 0.25 * Math.min(1.5, p.speed01);
    }
    // Wer oft verletzt wird, bekommt eine wehrhaftere Rückenflosse bzw. einen höheren Kamm
    if (p.lastHurt !== this.hurtSeen) {
      this.hurtSeen = p.lastHurt;
      this.train.hurt += 1;
      game.shiftBody('crest', 0.025);
    }
    // Bodenkontakt: Wer sich am Grund abstützt und dort entlangläuft, bekommt kräftige Stützflossen
    // (an Land: Wer viel läuft, statt zu springen, bekommt kräftigere Beine)
    if (p.bottomWalk) {
      game.grow('limb', 0.0045 * dt);
      this.train.ground += dt * 0.35;
    } else if (!this.water && p.speed01 > 0.4 && (p.body.blocked.down || p.body.touching.down)) {
      game.grow('limb', 0.0012 * dt);
      this.train.ground += dt * 0.1;
    }
    if (p.hidden && ci >= 0) {
      // zwischen den Pflanzen: wendige Flossen und eine flache Rückenflosse
      game.shiftBody('fin', 0.002 * dt);
      game.shiftBody('crest', -0.0015 * dt);
    }
    else if (p.hidden && p.inCave) game.grow('sand', 0.005 * dt);
    else if (p.grounded) game.grow('sand', 0.004 * dt);
    if (p.inCover !== this.wasInCover) {
      this.wasInCover = p.inCover;
      if (p.inCover) audio.sfx('rustle');
    }
    if (ci !== this.curCover) {
      // das Gestrüpp, in dem man steckt, wird lichter – man sieht sich selbst noch schemenhaft
      if (this.curCover >= 0) this.tweens.add({ targets: this.coverFront[this.curCover], alpha: 0.82, duration: 300 });
      if (ci >= 0) this.tweens.add({ targets: this.coverFront[ci], alpha: 0.5, duration: 300 });
      this.curCover = ci;
    }

    // Tiere berühren: Zusammenstöße, Angriffe, Nesseln (Artgenossen und Verbündete stören nicht)
    for (const a of this.animals) {
      if (a.dead || a.kin || a.ally) continue;
      const ar = a.hitRect();
      if (!overlaps(pr, ar)) continue;
      const v = p.body.velocity;
      const dx = a.x - p.x, dy = this.water ? a.y - p.y : 0;
      const dl = Math.hypot(dx, dy) || 1;
      const approach = Math.max(0, (v.x * dx + v.y * dy) / dl) / Math.max(1, p.stats.speed);
      const since = time - (this.ramHit.get(a) ?? -1e9);
      // Nur ein Stoß greift an – bloßes Berühren tut niemandem etwas (außer Nesseltieren)
      if (p.isRamming && since > 400) {
        this.collide(a, approach);
        continue;
      }
      if (a.attacking || a.role === 'hazard') {
        p.hurt(a.def.dmg * (a.attacking ? 1.15 : 1), a.x, a.def.name);
        a.hitPlayerAt = time;
      }
    }

    // Fallen und Abgründe
    let fell = !this.water && p.y > L.height + 60;
    for (const h of this.hazards) {
      if (!overlaps(pr, h)) continue;
      if (h.h > 40) fell = true;
      else {
        p.hurt(this.ep.hazardDmg, p.x - p.facing * 10, this.L.theme === 'reptil' ? 'Glühende Felsen' : 'Dornen');
        if (!p.dead) p.body.setVelocityY(-420);
      }
      break;
    }
    if (fell) {
      p.hurt(this.ep.hazardDmg, p.x, this.L.theme === 'reptil' ? 'Lava' : 'Sturz in die Tiefe');
      if (!p.dead) {
        p.body.reset(p.lastSafe.x, p.lastSafe.y - 10);
        this.cameras.main.flash(260, 0, 0, 0);
      }
    }

    // Hunger: ohne Nahrung geht es bergab (Kälte zehrt mehr). Heilen tun nur Ruhe und Heilkräuter – Fleisch nicht.
    const cold = this.L.theme === 'eis' ? 1 + 0.4 * this.stormK : 1;
    // Am Grund entlangzulaufen kostet weniger Kraft als zu schwimmen
    // Je leerer der Magen, desto langsamer sinkt er (der Körper spart) – ganz leer wird er nie.
    // Wer sich versteckt und still hält, kann so lange durchhalten; geschwächt ist man trotzdem.
    const fill = p.satiety / Math.max(1, p.maxSat);
    const rate = hungerRate(p.stats.size, p.speed01) * cold * (p.bottomWalk ? 0.55 : 1) * Math.min(1, fill / 0.5);
    p.satiety = Math.max(0.01, p.satiety - rate * dt);
    // Wer sich treiben lässt, kommt wieder zu Kräften – die Lebenskraft aber nur bis etwa drei Viertel
    // (ausgehungert geht das nicht). Mehr braucht ein Heilkraut.
    if (p.resting && p.satiety > p.maxSat * 0.2 && p.hp < p.stats.maxHp * REST_HEAL_CAP) {
      p.hp = Math.min(p.stats.maxHp * REST_HEAL_CAP, p.hp + p.stats.maxHp * 0.02 * p.stats.recover * dt);
    }
    if (p.exhausted && !this.winded) {
      this.winded = true;
      bus.emit('story', 'Die Kraft ist weg. Lass dich treiben – dann kehrt sie zurück.');
    }
    if (p.satiety < p.maxSat * 0.18 && time > this.growlAt) {
      this.growlAt = time + 9000;
      audio.sfx('growl');
    }
    game.calm(dt);

    // Still im Dickicht, während ein Jäger in der Nähe ist → unauffälliger
    if (time > this.hideTick) {
      this.hideTick = time + 1000;
      if (p.hidden) {
        const near = this.animals.some((a) => !a.dead && !a.ally && (a.role === 'predator' || a.role === 'apex') && Math.hypot(a.x - p.x, a.y - p.y) < 320);
        if (near) game.grow('stealth', 0.008);
      }
      // Nah an einem Jäger bleiben, ohne dass er jagt: Die Nerven werden stärker (verborgen)
      const calmNear = this.animals.some((a) => !a.dead && !a.ally && (a.role === 'predator' || a.role === 'apex') && a.target !== p && Math.hypot(a.x - p.x, a.y - p.y) < 260);
      if (calmNear) game.grow('nerve', 0.012);
    }

    // Aussehen anpassen (Stück für Stück). Neu zeichnen kostet ein paar Millisekunden – deshalb
    // nicht mitten im Kampf und höchstens alle 3 Sekunden; die Werte selbst stimmen immer sofort.
    if (time > this.lookAt) {
      this.lookAt = time + 400;
      const calm = time - this.fightAt > 2500 && time - p.lastHurt > 2500 && !p.isRamming && !this.huntMusic;
      const redraw = calm && time > this.redrawAt;
      if (p.refresh(false, redraw)) this.redrawAt = time + 3000;
    }

    // Anzeige (ohne Zahlen)
    if (time > this.vitalsAt) {
      this.vitalsAt = time + 150;
      bus.emit('vitals', p.hp / p.stats.maxHp, p.satiety / p.maxSat, p.hidden);
      // die Uhr oben: die Jahre laufen mit der Zeit des Zeitalters rückwärts
      const frac = clamp(this.elapsed / this.ep.seconds, 0, 1);
      const spanY = this.span.from - this.span.to;
      bus.emit('clock', this.span.from - spanY * frac, frac, spanY / this.ep.seconds / 10);
      const bs = this.bossA;
      if (bs) bus.emit('boss', bs.def.name, bs.dead ? 0 : Math.max(0, bs.hp / bs.maxHp));
    }
  }

  // ---------------------------------------------------------------- Tiefe

  /**
   * In der Tiefe wird es dunkel und still: Der Lichtkreis um dich schrumpft, die Musik verklingt, das Meer
   * rauscht, das Herz schlägt, und manchmal grollt es in der Ferne.
   */
  private deepStep(time: number, dt: number) {
    if (!this.deepDark) return;
    const p = this.player;
    // die Dunkelheit wächst mit dem Anteil der Tiefe, den man schon hinabgeschwommen ist (die Orte sind verschieden tief)
    const frac = (p.y - this.L.surfaceY) / Math.max(400, this.L.height - this.L.surfaceY);
    const abyss = this.place.kind === 'abyss';
    const target = clamp((frac - (abyss ? 0.23 : 0.38)) / (abyss ? 0.58 : 0.62), 0, 1);
    this.deepK += (target - this.deepK) * Math.min(1, dt * 1.2);
    const k = this.deepK;
    this.deepDark.setPosition(p.x, p.y).setScale((5 - 2.6 * k) / Z).setAlpha(Math.min(0.96, k * 1.15));
    if (time > this.deepBeatAt) {
      this.deepBeatAt = time + 600;
      audio.musicLevel(1 - 0.8 * k, 0.8);
      audio.sea(0.08 + 0.14 * k, 0.8);
    }
    if (k > 0.72 && time > this.deepRumbleAt) {
      this.deepRumbleAt = time + 14000 + Math.random() * 16000;
      audio.sfx('rumble');
    }
  }

  // ---------------------------------------------------------------- Ränder, Karte, Muscheln

  /**
   * Durchgänge: Die Ränder des Ortes sind Felswand, nur an einigen Stellen öffnet sie sich. Dazu ein Loch im Boden und
   * Lichtöffnungen oben an der Oberfläche. Aus der Ferne sieht man sie kaum – erst wer in die Nähe kommt, sieht es schimmern.
   */
  private buildGates() {
    const L = this.L;
    const gt = groundTextures(this, L.theme, 0);
    // Felswand an beiden Rändern, nur an den Toren offen
    for (const side of ['left', 'right'] as const) {
      const x0 = side === 'left' ? 0 : L.width - 64;
      let y = L.surfaceY;
      const seg = (ya: number, yb: number) => {
        if (yb - ya < 4) return;
        const t = this.add.tileSprite(x0, ya, 64, yb - ya, gt.gnd).setOrigin(0).setDepth(DEPTH.terrain + 1).setTint(0x6c7a7c);
        this.cullAdd(t, x0 - 200, x0 + 300);
      };
      for (const g of L.gates.filter((q) => q.kind === side).sort((a, b) => a.y - b.y)) {
        seg(y, g.y);
        y = g.y + g.h;
      }
      seg(y, L.height);
    }
    for (const g of L.gates) {
      const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
      const items: { o: Phaser.GameObjects.Image; a: number }[] = [];
      const add = (o: Phaser.GameObjects.Image, a: number) => {
        o.setAlpha(0);
        items.push({ o, a });
      };
      let pe: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
      if (g.kind === 'left' || g.kind === 'right') {
        add(this.add.image(cx, cy, 'glow').setDisplaySize(520, 420).setTint(0xb4f0e2).setDepth(DEPTH.decoFront + 0.4).setBlendMode(Phaser.BlendModes.ADD), 0.5);
      } else if (g.kind === 'surface') {
        add(this.add.image(cx, L.surfaceY, 'lightray').setOrigin(0.5, 0).setScale(1.1, 1.2).setDepth(DEPTH.decoFront + 0.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8fff4), 0.55);
        add(this.add.image(cx, L.surfaceY + 60, 'glow').setDisplaySize(380, 300).setTint(0xd8fff0).setDepth(DEPTH.decoFront + 0.4).setBlendMode(Phaser.BlendModes.ADD), 0.4);
      } else {
        // ein dunkles Loch im Boden, aus dem kalte Blasen aufsteigen
        const floorY = g.y + 80;
        const hole = this.add.graphics().setDepth(DEPTH.terrain + 2);
        hole.fillStyle(0x010304, 0.95);
        hole.fillEllipse(cx, floorY + 4, g.w * 0.92, 30);
        hole.fillStyle(0x0a1a22, 0.9);
        hole.fillEllipse(cx, floorY + 2, g.w * 0.7, 18);
        this.cullAdd(hole, g.x - 100, g.x + g.w + 100);
        add(this.add.image(cx, floorY - 40, 'glow').setDisplaySize(300, 220).setTint(0x8fe0d0).setDepth(DEPTH.decoFront + 0.4).setBlendMode(Phaser.BlendModes.ADD), 0.4);
        pe = this.add.particles(0, 0, 'p_bubble', {
          x: { min: g.x + 20, max: g.x + g.w - 20 }, y: floorY, lifespan: 2600, frequency: 220, speedY: { min: -60, max: -26 }, speedX: { min: -10, max: 10 },
          scale: { start: 0.5, end: 0.9 }, alpha: { start: 0.5, end: 0 }, emitting: false,
        }).setDepth(DEPTH.fx);
      }
      this.gateFx.push({ g, items, pe });
    }
  }

  /** Die Durchgänge schimmern erst, wenn man nah genug ist; wer ganz hineinschwimmt, kommt im Nachbarort an. */
  private gateStep(time: number, dt: number) {
    const p = this.player;
    let inside = -1;
    this.gateFx.forEach((f, i) => {
      const g = f.g;
      const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
      const d = Math.hypot(p.x - cx, p.y - cy);
      const k = Math.pow(clamp(1 - (d - 450) / 1300, 0, 1), 1.3);
      const pulse = 0.85 + 0.15 * Math.sin(time / 600 + i);
      for (const it of f.items) it.o.setAlpha(it.a * k * pulse);
      if (f.pe) {
        if (k > 0.05 && !f.pe.emitting) f.pe.start();
        else if (k <= 0.05 && f.pe.emitting) f.pe.stop();
      }
      if (p.x > g.x && p.x < g.x + g.w && p.y > g.y && p.y < g.y + g.h) inside = i;
      if (d < 700 && !this.gateNoted) {
        this.gateNoted = true;
        bus.emit('story', 'Dort schimmert es. Ein Durchgang – wohin er wohl führt?');
      }
    });
    this.gateHold = inside >= 0 ? this.gateHold + dt : Math.max(0, this.gateHold - dt * 2);
    if (inside >= 0 && this.gateHold > 0.25) this.leave(this.gateFx[inside].g);
  }

  /** Durch den Durchgang: Der Stand wird gemerkt, dann geht es (über die Karte) in den Nachbarort. */
  private leave(g: Gate) {
    if (this.ended) return;
    this.ended = true;
    this.saveProgress();
    audio.sfx('travel');
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(900, 2, 3, 4);
    this.time.delayedCall(950, () => {
      this.scene.stop('Hud');
      this.scene.start('Map', { epoch: this.epochIdx, from: this.place.id, to: g.to });
    });
  }

  /** Zustand für den nächsten Ort bzw. die Karte festhalten. */
  private saveProgress() {
    const p = this.player;
    game.leavePlace({
      elapsed: this.elapsed,
      hp: p.hp,
      sat: p.satiety,
      kin: this.animals.filter((a) => a instanceof Kin && !a.dead).length,
      eaten: { meat: this.eatenMeat, plant: this.eatenPlant },
      train: { ...this.train },
    });
  }

  /** Muscheln werden beim Berühren aufgehoben. */
  private shellStep(_time: number) {
    if (!this.shells.length) return;
    const pr = this.player.hitRect();
    for (const sh of this.shells) if (!sh.taken && overlaps(pr, sh.rect)) this.pickShell(sh);
    this.shells = this.shells.filter((s) => !s.taken);
  }

  private pickShell(sh: Shell) {
    sh.take();
    const n = game.collectShell(sh.id);
    audio.sfx('shell');
    this.puff(sh.x, sh.y - 16, 6, 0xf0dccc);
    this.sparkle.explode(5, sh.x, sh.y - 20);
    bus.emit('shell', n);
  }

  // ---------------------------------------------------------------- Ende

  /** Die Zeit ist um, und du lebst noch. */
  private complete() {
    if (this.ended) return;
    this.ended = true;
    // Gibt es hier einen Endgegner, geht es nur weiter, wenn er besiegt ist
    const bossEv = this.ep.events.find((e) => e.kind === 'boss');
    const repeat = !!bossEv && !this.bossBeaten;
    const run = game.run!;
    const kin = this.animals.filter((a): a is Kin => a instanceof Kin && !a.dead);
    // Der Spielstil dieses Zeitalters entscheidet, wohin sich die Linie entwickelt – eine Wahl gibt es nicht
    const next = game.evolve({ meat: this.eatenMeat, plant: this.eatenPlant }, {
      ram: this.train.ram, hunt: this.train.hunt, swim: this.train.swim, ground: this.train.ground, hide: this.train.hide ?? 0, hurt: this.train.hurt ?? 0,
    }, !repeat);
    const data: SurvivedData = {
      epoch: this.epochIdx,
      before: game.startTraits(),
      traits: { ...game.traits },
      cls: game.cls,
      look: { hue: run.hue, seed: run.seed, sex: run.sex },
      kinAlive: kin.length,
      kinLooks: kin.slice(0, 3).map((k) => k.view.m),
      node: '',
    };
    const social = kin.length ? kin.reduce((sum, k) => sum + k.loyalty, 0) / kin.length : undefined;
    const eaten = { meat: this.kcal(this.eatenMeat), plant: this.kcal(this.eatenPlant), need: this.kcal(this.needUnits) };
    const res = game.surviveEpoch(kin.length, social, next, repeat);
    data.line = next.line;
    data.eaten = eaten;
    data.repeat = repeat;
    data.boss = bossEv ? SPECIES[bossEv.species!]?.name : undefined;
    data.bossBeaten = this.bossBeaten;
    data.years = this.span.to;
    data.transition = res.transition;
    if (res.drift && !res.finished) data.drifted = res.drift.after;
    data.finished = res.finished;
    data.node = res.node;
    audio.sfx('portal');
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(1800, 230, 214, 180);
    this.time.delayedCall(1900, () => {
      this.scene.stop('Hud');
      this.scene.start('Generation', data);
    });
  }

  /** Das Tier ist tot – das Spiel ist vorbei, die Linie stirbt aus. */
  private onDeath() {
    if (this.ended) return;
    this.endLine(this.player.lastCause, 2600);
  }

  private abort() {
    if (this.ended) return;
    this.endLine('Aufgegeben', 300);
  }

  private endLine(cause: string, wait: number) {
    this.ended = true;
    const frac = clamp(this.elapsed / this.ep.seconds, 0, 1);
    const years = this.span.from - (this.span.from - this.span.to) * frac;
    const morph = this.player.morph();
    const leaf = game.extinct(frac, cause);
    audio.music(null);
    this.time.delayedCall(wait, () => {
      this.scene.stop('Hud');
      fadeTo(this, 'Tree', { mode: 'extinct', leaf, morph, epoch: this.epochIdx, cause, years }, 1200);
    });
  }
}
