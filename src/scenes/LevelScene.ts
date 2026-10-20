import Phaser from 'phaser';
import { W, H, DEPTH, GRAVITY, DEBUG, TILE, LEVEL_ZOOM } from '../config';
import { audio } from '../audio/Audio';
import { bus, FOOD, game, kcalOf, meatChunks, meatOf, newStyle, noteBest, shellChance, type Member, type PlayStyle, type UpKey } from '../state/GameState';
import { EPOCHS, type EpochDef, type EventDef, type Theme } from '../data/epochs';
import { SPECIES, type SpeciesDef } from '../data/species';
import { CAVE_WALL, edgeNeighbor, placeOf, type PlaceDef } from '../data/world';
import { LIFE, MISC, STAMINA, WORLD } from '../data/life';
import { cyclePhase, diesOfAge, phases, STAGE_NAME, stageOf, worldYears, type Stage } from '../sim/life';
import { CLASSES } from '../data/classes';
import { generateLevel, type CaveWall, type LevelData, type Zone } from '../level/LevelGen';
import { groundAt, zoneAt as matAt } from '../level/terrain';
import { coverTextures, foodKey, groundTextures, levelBackgrounds, murkTexture, plantTextures, roeTextures, SILHOUETTE, SWAYS, THEME_TINT } from '../art/worldArt';
import { caveShade, rubbleArt, terrainArt } from '../art/terrainArt';
import { LIFE_KEYS, LIFE_SWAY } from '../art/lifeArt';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { Controls, touch } from '../objects/Controls';
import { Player, SLEEP_S } from '../objects/Player';
import { BackSea } from '../objects/BackSea';
import { Drift, driftCounts } from '../objects/Drift';
import { Animal } from '../objects/Animal';
import { Kin, type KinWorld } from '../objects/Kin';
import type { PlayerLike } from '../objects/Animal';
import { Quest } from '../objects/Quest';
import { HuntQuest } from '../objects/HuntQuest';
import { SwarmCtl } from '../objects/Swarm';
import { SpawnCtl } from '../objects/Spawning';
import { NetSync, netWanted } from '../net/NetSync';
import { Kill, Meat, Plant, Roe, Shell } from '../objects/Food';
import { Shrine } from '../objects/Shrine';
import { Sight } from '../objects/Sight';
import { SIGHT } from '../sim/sight';
import { fadeIn, fadeTo, text } from '../ui/ui';
import { clamp, overlaps, pick, type Rect } from '../util/math';
import { reportError } from '../util/guard';
import { mix as mixColor } from '../util/color';
import { rrect, tex } from '../util/canvas';

type PImg = Phaser.Physics.Arcade.Image;

const DUST: Record<Theme, number> = { ozean: 0xcfe0dc, sumpf: 0x5a4a32, reptil: 0x6a4a34, eis: 0xdfe6ec, eden: 0x6a5a3a };


/** Bildschirmfeste Ebenen müssen beim Herauszoomen größer sein, damit sie das ganze Bild füllen. */
/** so viele Sekunden dauert es, bis man aus dem Spiel ins Hauptmenü kommt */
const QUIT_SECONDS = 5;
const Z = LEVEL_ZOOM;
const VW = W / Z, VH = H / Z, VX = (W - VW) / 2, VY = (H - VH) / 2;
/** So viel näher ist die Kamera beim frisch geschlüpften Jungtier (mit dem Wachsen zieht sie zurück) */
const GROW_ZOOM = 0.45;
/** Beim Einschlafen und Aufwachen kommt die Kamera so viel näher heran */
const WAKE_ZOOM = 3;

/** Daten für den Einschnitt zwischen zwei Leben (GenerationScene). */
export interface SuccessionData {
  epoch: number;
  /** woran das Tier starb (bzw. dass es sein Leben weitergab) */
  cause: string;
  /** die Generation, die gerade zu Ende ging */
  gen: number;
  /** Weltzeit (Jahre vor heute) */
  years: number;
  /** kein Generationswechsel: Das Tier starb vor dem Laichen, ein Geschwister aus seinem Gelege schlüpft */
  sibling?: boolean;
}

/** Geröll vor einer Höhle im Level: Bild, Risse, Hitbox – und wann es zuletzt getroffen wurde. */
interface Rubble {
  w: CaveWall;
  id: string;
  img: Phaser.GameObjects.Image;
  cracks: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Rectangle;
  dmg: number;
  hitAt: number;
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
  /** Fischlaich am Boden (Eltern wachen darüber) */
  roes: Roe[] = [];
  private hatchAt = 0;
  meats: Meat[] = [];
  cover: Rect[] = [];
  ended = false;
  /** gelebte Sekunden in diesem Zeitalter */
  /** wie weit der wiederkehrende Ablauf des Zeitalters (Ereignisse) schon war, als zuletzt geschaut wurde (0 … 1) */
  private phase = 0;
  /** Lebensabschnitt beim letzten Blick (für die Meldung, wenn ein neuer beginnt) */
  private stage: Stage = 'jung';
  private oldWarned = false;
  /** das Bild ist schon dunkel (eingeschlafen) – der Szenenwechsel braucht kein Abblenden mehr */
  private dark = false;
  /** beim Aufwachen ist die Kamera ganz nah am Tier (so sieht man die Augen) und zieht dann langsam zurück */
  private near = { k: 1 };
  /** Laichen im Laichfluss */
  spawning?: SpawnCtl;
  /** Mehrspieler: die anderen Spieler an diesem Ort (solange ein Server erreichbar ist) */
  private net?: NetSync;
  /** Mehrspieler: um welchen Spieler sich ein Tier gerade kümmert (für eine Weile gemerkt, damit es nicht hin und her springt) */
  private focus = new WeakMap<Animal, { p: PlayerLike; until: number }>();
  controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  /** alle festen Körper, nach 40-Pixel-Streifen geordnet (für solidAt) */
  private solidIndex = new Map<number, Rect[]>();
  private terrainKeys: string[] = [];
  private platRects: Rect[] = [];
  private hazards: Rect[] = [];
  private lava: Phaser.GameObjects.TileSprite[] = [];
  private shots: PImg[] = [];
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  /** das Meer hinter dem Spielfeld: ferne Fische, nur Kulisse */
  private backSea?: BackSea;
  /** Plankton, Meeresschnee und treibende Kolonien */
  private drift?: Drift;
  private fog!: Phaser.GameObjects.TileSprite;
  private darkness?: Phaser.GameObjects.Image;
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** aufgewirbeltes Sediment (Sand, Fels- oder Schlammstaub) */
  private silt?: Phaser.GameObjects.Particles.ParticleEmitter;
  private siltAt = 0;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ramHit = new Map<Animal, number>();
  private vitalsAt = 0;
  private lookAt = 0;
  private hideTick = 0;
  private wasInCover = false;
  private coverFront: Phaser.GameObjects.Image[][] = [];
  private curCover = -1;
  private timeline: EventDef[] = [];
  /** wann das nächste größere Tier durchs Bild zieht */
  private nextPasser = 0;
  private kinDef!: SpeciesDef;
  private faunaCount = 0;
  private nextMigrate = 0;
  private bloomUntil = 0;
  private stormUntil = 0;
  private stormK = 0;
  private stormFx?: { veil: Phaser.GameObjects.Image; p: Phaser.GameObjects.Particles.ParticleEmitter };
  private huntMusic = 0;
  /** wann die Musik zuletzt erfuhr, wie tief du bist und wie nah die Gefahr ist */
  private moodAt = 0;
  private huntLost = 0;
  private bloodClouds?: Phaser.GameObjects.Particles.ParticleEmitter;
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number; a: number }[] = [];
  private glints = new Map<object, Phaser.GameObjects.Image>();
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
  /** Muscheln, die von erlegter Beute gefallen sind (sie bleiben, bis man den Ort verlässt) */
  private shells: Shell[] = [];
  private dropN = 0;
  /** die große Muschel (nur im Laichfluss) – und bis wann gerade gebetet wird */
  shrine?: Shrine;
  private prayUntil = 0;
  /** zum Hauptmenü: so viele Sekunden noch (< 0: niemand will gehen) */
  private quitLeft = -1;
  private shrineNear = false;
  /** Dunkelheit in der Tiefe: Je weiter man hinabschwimmt, desto weniger sieht man */
  private deepDark?: Phaser.GameObjects.Image;
  /** die Sicht unter Wasser: trübes Wasser überall, wohin der Fisch nicht blickt (siehe objects/Sight.ts) */
  private sight?: Sight;
  /** wann das Herz das nächste Mal schlägt (es schlägt nur, wenn dich etwas jagt) */
  private beatAt = 0;
  private deepK = 0;
  private deepBeatAt = 0;
  private deepRumbleAt = 0;
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
  /** der Endgegner dieser Region (falls er schon da ist) */
  private bossA?: Animal;
  /** bis dahin gilt ein Angriff als Überraschungsangriff (aus dem Versteck heraus) */
  private ambushUntil = 0;
  /** Teemo-Prinzip: Wer in seinem Versteck (Gras bei grüner, Dunkelheit bei schwarzer Farbe) 1,5 s still hält, ist bereit */
  private primedUntil = 0;
  /** Zeitpunkt, seit dem man still im Versteck ist (0 = nicht still) */
  private stillT = 0;
  private spotAt = 0;
  /** entkommene Beute, die später (außerhalb des Bildes) wieder auftaucht */
  private returning: { id: string; x: number; y: number; herd?: number; at: number }[] = [];
  private restockAt = 0;
  /** kleine Kraftanzeige am Fisch – nur zu sehen, solange er nicht frisch ist */
  private stamG!: Phaser.GameObjects.Graphics;
  private stamA = 0;
  /** der Kreis, wie er gerade gezeigt wird (wächst nach einem Segen), seit wann er voll ist, sein Aufleuchten */
  private stamMax = 1;
  private stamFull = 99;
  private stamPulse = 0;
  private stamHold = 0;
  /** Gespräch: bis dahin (und um diese Stelle herum) greift niemand an */
  private truceUntil = 0;
  private truceSpot = { x: 0, y: 0 };
  /** Höhle, in der man gerade schwimmt (-1 = keine), von welcher Seite man hineingekommen ist und ob man bis hinten war */
  private curCave = -1;
  private caveSide = 0;
  private caveDeep = false;
  /** Geröll vor den Höhlen: Bild, Risse, Hitbox – und wann es zuletzt getroffen wurde */
  private walls: Rubble[] = [];
  private caveFx: { c: LevelData['caves'][number]; pe: Phaser.GameObjects.Particles.ParticleEmitter; on: boolean }[] = [];
  /** dunkle Vorahnung: ein Riese ist in der Nähe */
  private dread!: Phaser.GameObjects.Rectangle;
  private dreadK = 0;
  private dreadAt = -1e9;
  /** Strömungen (mit ihren Schlieren) */
  private flows: { r: Rect & { dir: number }; pe: Phaser.GameObjects.Particles.ParticleEmitter; on: boolean }[] = [];
  /** Kino-Moment (läuft in echter Zeit, das Spiel derweil in Zeitlupe) */
  private cine?: { t: number; img: Phaser.GameObjects.Image; dir: number; y: number; rumbled: boolean; released: boolean };
  private cineWanted = false;
  /** Aufträge der Artgenossen: Gespräche und ihre Szenen */
  quest?: Quest;
  /** der Auftrag „Die gemeinsame Jagd“ */
  hunt?: HuntQuest;
  /** deine Gruppe: rufen, begleiten, fortschicken */
  swarm?: SwarmCtl;
  /** Zeitlupe: 1 = normal */
  private slow = 1;
  /** Was du in diesem Zeitalter getan hast – daraus wird beim Generationswechsel die nächste Generation */
  train: PlayStyle = newStyle();
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
    this.roes = [];
    this.hatchAt = 0;
    this.meats = [];
    this.cover = [];
    this.solidIndex = new Map();
    this.terrainKeys = [];
    this.platRects = [];
    this.hazards = [];
    this.lava = [];
    this.shots = [];
    this.ended = false;
    this.darkness = undefined;
    this.ramHit = new Map();
    this.dbg = undefined;
    this.t = 0;
    this.wasInCover = false;
    this.coverFront = [];
    this.curCover = -1;
    // Die Ereignisse des Zeitalters kehren in der Weltzeit immer wieder – für alle zugleich (der Endgegner nicht)
    this.timeline = this.ep.events.filter((e) => e.kind !== 'boss');
    this.phase = cyclePhase(this.ep.seconds);
    this.stage = stageOf(game.life.age, game.life.gen);
    this.oldWarned = game.life.age > phases(game.life.gen).span - 60;
    this.nextPasser = 0;
    this.bloomUntil = this.stormUntil = 0;
    this.stormK = 0;
    this.stormFx = undefined;
    this.huntMusic = this.huntLost = 0;
    this.moodAt = 0;
    this.nextMigrate = 0;
    this.glints = new Map();
    this.bloodClouds = undefined;
    this.caustics = [];
    this.splats = [];
    this.fightAt = -1e9;
    this.redrawAt = 0;
    this.surfGlow = undefined;
    this.shells = [];
    this.shrine = undefined;
    this.prayUntil = 0;
    this.shrineNear = false;
    this.deepDark = undefined;
    this.deepK = 0;
    this.deepBeatAt = this.deepRumbleAt = 0;
    this.murk = 0;
    this.zoneLight = 1;
    this.cullList = [];
    this.cullAt = 0;
    this.swayList = [];
    this.eatenMeat = prog.eaten.meat;
    this.eatenPlant = prog.eaten.plant;
    this.bossA = undefined;
    this.ambushUntil = 0;
    this.primedUntil = 0;
    this.stillT = 0;
    this.spotAt = 0;
    this.returning = [];
    this.restockAt = 0;
    this.curCave = -1;
    this.caveSide = 0;
    this.caveDeep = false;
    this.truceUntil = 0;
    this.walls = [];
    this.caveFx = [];
    this.dreadK = 0;
    this.dreadAt = -1e9;
    this.flows = [];
    this.cine = undefined;
    this.cineWanted = false;
    this.slow = 1;
    this.near = { k: 1 };
    this.train = { ...newStyle(), ...prog.train, hab: { ...prog.train.hab }, best: { ...prog.train.best } };
    this.lastBitten = null;

  }

  create() {
    // wer gerade schlüpft, wacht langsam auf (siehe unten); sonst geht es zügig los
    const waking = !!game.prog.at;
    fadeIn(this, waking ? 2600 : 900);
    this.dark = false;
    game.beginLife();
    const ep = this.ep;
    // Die Welt ist für alle Spieler und in jedem Leben dieselbe (feste Saat)
    const L = (this.L = generateLevel(ep, WORLD.seed, this.place, game.prog.edge));
    this.water = L.mode === 'water';
    this.surfaceY = L.surfaceY;
    this.cover = L.cover;
    const world = this.physics.world;
    world.gravity.y = this.water ? 0 : GRAVITY;
    if (this.water) world.setBounds(0, L.surfaceY, L.width, L.height - L.surfaceY);
    else world.setBounds(0, -600, L.width, L.height + 1200);
    // im Wasser gibt es an den Rändern keine Wand: Wer hinausschwimmt, kommt in den Nachbarort
    // (nur der Startfluss ist links zu: Dort liegt die Quelle, es gibt keinen Weg hinaus)
    world.setBoundsCollision(!this.water || this.place.kind === 'start', !this.water, true, this.water);
    // Der Boden besteht aus schmalen Säulen: Wer am Grund entlangschwimmt, soll kleine Stufen (bis etwa 22 Bildpunkte) hinaufgleiten
    // statt an jeder Kante hängenzubleiben – dafür gilt eine Überlappung bis dahin als Auflage, nicht als Wand.
    if (this.water) world.OVERLAP_BIAS = 22;
    this.cameras.main.setBackgroundColor('#020304');

    // Hintergrund mit Nebel
    const [far, mid, fog] = levelBackgrounds(this, L.theme, L.variant);
    this.bgFar = this.add.tileSprite(VX, VY, VW, VH, far).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setTileScale(1 / Z);
    this.bgMid = this.add.tileSprite(VX, VY, VW, VH, mid).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1).setTileScale(1 / Z);
    this.fog = this.add.tileSprite(VX, VY + VH * 0.35, VW, VH * 0.65, fog).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 2).setAlpha(0.35).setTileScale(1 / Z);

    // Gelände: ein glatter Boden aus Sand, Fels und Schlamm, dazu Felsen und Kiesel
    this.solids = this.physics.add.staticGroup();
    this.buildTerrain();
    if (L.platforms.length || L.hazards.length) {
      const gts = [0, 1, 2].map((v) => groundTextures(this, L.theme, v));
      for (const r of L.platforms) this.addPlatform(r, (gts[this.zoneAt(r.x + r.w / 2).def.ground] ?? gts[0]).plat);
      for (const r of L.hazards) this.addHazard(r, gts[0].hz);
    }
    this.buildDecor();
    this.drift = this.water ? new Drift(this, L, driftCounts(this.place.kind, ep.id), this.place.kind === 'deep' || this.place.kind === 'abyss') : undefined;
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
    this.backSea = this.water && L.surfaceY > 0 ? new BackSea(this, { x: VX, y: VY, w: VW, h: VH }, ep, this.place.id, this.place.kind, L.surfaceY, L.variant !== 'normal', !!this.place.safe) : undefined;
    for (const p of L.plants) {
      // fest auf den Boden setzen (nicht über eine Kante ragen lassen)
      const hw = (this.textures.get(foodKey(L.theme, 0, p.v)).getSourceImage().width as number) / 2;
      const at = this.settle(p.x, p.y, hw) ?? { x: p.x, y: p.y - 4 };
      const pl = new Plant(this, at.x, at.y + 4, L.theme, 3, p.v);
      this.plants.push(pl);
      this.cullAdd(pl.img, at.x - hw, at.x + hw);
    }
    // Fischlaich: am Start deine eigene Brut, im Meer die Gelege der Bewohner
    roeTextures(this);
    for (const s of L.roe) {
      const roe = new Roe(this, s.x, s.y, s.species, s.tone, 4, s.own);
      // Laich deiner Art ist kein Futter – zur Laichzeit befruchtest du ihn (objects/Spawning.ts)
      roe.spared = s.own;
      // nur Pflanzen- und Allesfresser-Gelege schlüpfen (die Jungen der Jäger bleiben Eier); eigene Brut schlüpft nicht
      const hatches = !s.own && SPECIES[s.species]?.role !== 'predator';
      roe.hatchAt = hatches ? this.time.now + 90000 + Math.random() * 70000 : Infinity;
      this.roes.push(roe);
      this.cullAdd(roe.img, s.x - 40, s.x + 40);
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
    // ein neues Leben beginnt dort, wo sein Gelege liegt (einmalig)
    const born = game.prog.at;
    if (born) game.prog.at = undefined;
    // … und wer zum Hauptmenü gegangen war, kommt genau dort wieder an, wo er war (einmalig)
    const back = born ? undefined : game.prog.resume;
    game.prog.resume = undefined;
    this.player = new Player(this, born ? born.x : back ? back.x : L.start.x, born ? born.y - 40 : back ? back.y : L.start.y, this.water);
    // über allem im Bild (auch über der Dunkelheit der Tiefe), wie eine Anzeige
    this.stamG = this.add.graphics().setDepth(DEPTH.text - 1);
    this.stamA = 0;
    this.stamMax = game.staminaMax;
    this.stamFull = 99;
    this.stamPulse = 0;
    this.stamHold = 0;
    // von einem Ort zum nächsten bleibt man, wie man war: Kraft und Artgenossen
    const pr = game.prog;
    if (pr.hp !== undefined) this.player.hp = clamp(pr.hp, 1, this.player.stats.maxHp);
    this.spawnKin();
    // Artgenossen sind selten und geben Aufträge: Wer einen hat, wartet an seiner Stelle (siehe objects/Quest.ts)
    this.quest = new Quest(this);
    // deine Gruppe (wer gerufen war, kommt mit) und die gemeinsame Jagd
    this.swarm = new SwarmCtl(this);
    this.hunt = new HuntQuest(this);
    for (const s of L.spawns) {
      const a = this.spawnAnimal(s.id, s.x, s.y, s.herd);
      // Eltern wachen über ihr Gelege
      const roe = s.guard !== undefined ? this.roes[s.guard] : undefined;
      if (roe) {
        roe.guards.push(a);
        a.guardPost = { x: roe.x, y: roe.y - 60 };
        a.home = { x: roe.x, y: roe.y - 60 };
      }
    }
    this.faunaCount = L.spawns.length;
    // Laichen (im Laichfluss)
    this.spawning = new SpawnCtl(this);
    // die große Muschel: Hier betet man um mehr Ausdauer
    if (L.shrine) this.shrine = new Shrine(this, L.shrine.x, L.shrine.y, this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch'));
    // eine neue Linie: Deine Muscheln (sie bleiben dir) warten darauf, an der großen Muschel neu verteilt zu werden
    if (this.shrine && game.canUp() && game.upCount === 0 && game.run && !game.run.upHint) {
      game.run.upHint = true;
      const free = game.shellsFree;
      this.time.delayedCall(waking ? 9000 : 2500, () => !this.ended && bus.emit('notice', 'DIE GROSSE MUSCHEL', `${free} ${free === 1 ? 'Muschel wartet' : 'Muscheln warten'} darauf, verteilt zu werden.`));
    }

    // Kollisionen
    this.physics.add.collider(this.player.rect, this.solids);
    this.physics.add.collider(this.animals, this.solids, undefined, (a) => (a as Animal).def.habitat !== 'air');
    this.physics.add.collider(this.shots, this.solids, (s) => this.popShot(s as PImg), (s) => !(s as PImg).getData('wave'));

    // Effekte
    this.puffer = this.add.particles(0, 0, this.water ? 'p_bubble' : 'p_dot', {
      speed: { min: 20, max: 80 }, lifespan: this.water ? 1300 : 500, scale: { start: 0.8, end: 0.1 },
      alpha: { start: 0.6, end: 0 }, gravityY: this.water ? -60 : -20, tint: DUST[L.theme], emitting: false,
    }).setDepth(DEPTH.fx);
    if (this.water) {
      this.silt = this.add.particles(0, 0, 'p_dot', {
        speed: { min: 8, max: 34 }, angle: { min: 195, max: 345 }, lifespan: { min: 1500, max: 2800 },
        scale: { start: 1.1, end: 3.8 }, alpha: { start: 0.55, end: 0 }, gravityY: 6, emitting: false,
      }).setDepth(DEPTH.terrain + 3);
    }
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
    // Sicht: Unter Wasser sieht man vor allem nach vorn – überall sonst ist nur Wasser (über den Tieren und dem Dickicht,
    // unter den Schattenrissen ganz vorn)
    this.sight = this.water ? new Sight(this, murkTexture(this, L.theme, L.variant, SIGHT.murk), { x: VX, y: VY, w: VW, h: VH }, DEPTH.cover + 1, VW / 2) : undefined;
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(VW, VH).setDepth(DEPTH.dark + 1).setAlpha(0.55);
    // Schleier der Gebiete: links trüb, rechts dunkel – geht fließend ineinander über
    this.veil = this.add.rectangle(VX, VY, VW, VH, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.decoFront + 2);
    // Ein Riese naht: das Bild wird dunkler und kälter
    this.dread = this.add.rectangle(VX, VY, VW, VH, 0x02081a, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.decoFront + 3);

    // Kamera: etwas herausgezoomt; an Land reicht der Blick auch über den oberen Levelrand in den Himmel
    const cam = this.cameras.main;
    cam.setZoom(this.camZoom);
    const bottom = this.water ? L.height : L.height - 70;
    const camH = Math.max(bottom, VH + 40);
    cam.setBounds(0, bottom - camH, L.width, camH);
    cam.startFollow(this.player.rect, true, 0.1, 0.1);
    cam.setDeadzone(90, 70);

    this.scene.launch('Hud', { epoch: this.epochIdx, place: this.place.name, wake: !!born });
    // Schlüpfen ist Aufwachen: Die Augen sind noch zu und öffnen sich, während das Bild hell wird – dann schwärmen die
    // Geschwister aus
    if (born) {
      const v = this.player.view;
      v.eyes(1);
      const o = { k: 1 };
      this.tweens.add({ targets: o, k: 0, delay: 1300, duration: 1600, ease: 'Sine.inOut', onUpdate: () => v.eyes(o.k) });
      this.time.delayedCall(2600, () => !this.ended && this.spawning?.hatched());
      this.near.k = WAKE_ZOOM;
      cam.setDeadzone();
      cam.setZoom(this.camZoom);
      cam.centerOn(this.player.x, this.player.y);
      this.tweens.add({ targets: this.near, k: 1, delay: 1800, duration: 4200, ease: 'Sine.inOut', onComplete: () => cam.setDeadzone(90, 70) });
    }
    // Mehrspieler: diesen Ort auf dem Server betreten – die anderen Spieler hier erscheinen
    this.net = netWanted() ? new NetSync(this) : undefined;
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
      // die großen Bodenbilder und Felsen nicht im Speicher liegen lassen
      for (const k of this.terrainKeys) if (this.textures.exists(k)) this.textures.remove(k);
      this.terrainKeys = [];
    });

    if (DEBUG) {
      this.dbg = this.add.text(VX + 12, VY + VH - 160, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9f9', backgroundColor: 'rgba(0,0,0,.6)' })
        .setScrollFactor(0).setDepth(DEPTH.text + 10);
      // zum Ausprobieren von Laichen und Generationswechsel: T lässt das eigene Tier eine Minute älter werden
      this.input.keyboard?.on('keydown-T', () => !this.ended && !this.player.dead && game.ageBy(60));
    }

    // Ein Endgegner, der noch lebt, folgt dir von Ort zu Ort
    const bossEv = ep.events.find((e) => e.kind === 'boss');
    if (bossEv && pr.boss === 1 && !this.place.safe) this.time.delayedCall(2600, () => !this.ended && this.spawnBoss(bossEv.species!));

    const onAbort = () => this.abort();
    bus.on('abortLevel', onAbort);
    // das Leben an die Nachkommen weitergeben (aus der Rast; nur mit einem befruchteten Gelege)
    const onHandOver = () => !this.ended && game.heir() && this.passAway('Lebensende – an die Nachkommen weitergegeben');
    bus.on('handOver', onHandOver);
    // zum Hauptmenü (aus der Rast): erst nach fünf Sekunden – so entkommt niemand einer brenzligen Lage
    this.quitLeft = -1;
    const onQuit = () => {
      if (this.ended || this.player.dead) return;
      this.quitLeft = QUIT_SECONDS;
      bus.emit('quitCount', QUIT_SECONDS);
    };
    const onQuitCancel = () => {
      if (this.quitLeft < 0) return;
      this.quitLeft = -1;
      bus.emit('quitCount', -1);
    };
    bus.on('quit', onQuit);
    bus.on('quitCancel', onQuitCancel);
    // an der großen Muschel gewählt (HUD): Sie segnet in dieser Richtung
    const onBless = (k: UpKey) => this.bless(k);
    bus.on('shrineBless', onBless);
    this.events.on('player-dead', () => this.onDeath());
    this.events.once('shutdown', () => {
      bus.off('abortLevel', onAbort);
      bus.off('handOver', onHandOver);
      bus.off('quit', onQuit);
      bus.off('quitCancel', onQuitCancel);
      bus.off('shrineBless', onBless);
      this.events.off('player-dead');
    });
  }

  // ---------------------------------------------------------------- Aufbau

  /**
   * Der Boden: gemalte Stücke entlang der glatten Höhenlinie (darunter eine einfarbige Fläche), die Felsen als eigene Bilder –
   * die großen dunklen im Vordergrund. Die Hitboxen sind Rechtecke (Säulen des Bodens, Scheiben der Felsen).
   */
  private buildTerrain() {
    const L = this.L;
    const art = terrainArt(this, L, L.theme, this.zoneAt(0).def.ground);
    this.terrainKeys = art.keys;
    for (const c of art.chunks) {
      const img = this.add.image(c.x, c.y, c.key).setOrigin(0).setDisplaySize(c.w, c.h).setDepth(DEPTH.terrain);
      const fill = this.add.rectangle(c.x, c.deepY - 1, c.w, L.height + 400 - c.deepY, art.deep).setOrigin(0).setDepth(DEPTH.terrain - 0.1);
      this.cullAdd(img, c.x, c.x + c.w);
      this.cullAdd(fill, c.x, c.x + c.w);
    }
    for (const k of art.rocks) {
      const img = this.add.image(k.x, k.y, k.key).setOrigin(0).setDisplaySize(k.w, k.h).setDepth(DEPTH.terrain + 0.5);
      this.cullAdd(img, k.x, k.x + k.w);
    }
    for (const k of art.fore) {
      const img = this.add.image(k.x, k.y, k.key).setOrigin(0).setDisplaySize(k.w, k.h).setDepth(DEPTH.decoFront);
      this.cullAdd(img, k.x, k.x + k.w);
    }
    // am Rand weiter als das Bild: Wer über den Rand schwimmt, soll nicht plötzlich im freien Fall unter dem Boden sein
    const gr = L.groundRects.map((r) => ({ ...r }));
    if (gr.length) {
      gr[0].x -= 400;
      gr[0].w += 400;
      gr[gr.length - 1].w += 400;
    }
    for (const r of gr) this.addBody(r);
    for (const r of L.solids) this.addBody(r);
  }

  private addBody(r: Rect) {
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setVisible(false);
    this.solids.add(rect);
    for (let b = Math.floor(r.x / 40); b <= Math.floor((r.x + r.w) / 40); b++) {
      const list = this.solidIndex.get(b);
      if (list) list.push(r);
      else this.solidIndex.set(b, [r]);
    }
    return rect;
  }

  /** Eine Hitbox wieder entfernen (aufgebrochenes Geröll). */
  private removeBody(rect: Phaser.GameObjects.Rectangle, r: Rect) {
    rect.destroy();
    for (let b = Math.floor(r.x / 40); b <= Math.floor((r.x + r.w) / 40); b++) {
      const list = this.solidIndex.get(b);
      if (list) this.solidIndex.set(b, list.filter((q) => q !== r));
    }
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
          const gy = Math.min(c.y + c.h, groundAt(this.L.terrain.hp, x)) + 4;
          const img = this.add.image(x + (layer ? 0 : 14), gy, key).setOrigin(0.5, 1);
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
   * Höhlen: dunkle Rückwand, drinnen sieht man nur noch die Augen. Vor der Öffnung treibt etwas von der Farbe der Höhle ins
   * Wasser – grünliche Schlieren bei der grünen, schwarze Schwaden bei der schwarzen. Die Öffnung ist mit Geröll verschüttet.
   */
  private buildCaves() {
    this.L.caves.forEach((c) => {
      let x0 = Infinity, x1 = -Infinity;
      for (const [x] of c.hollow) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      const back = this.add.tileSprite(x0 - 4, c.y - 4, x1 - x0 + 8, c.h + 8, 'cave_back').setOrigin(0).setDepth(DEPTH.decoBack + 3);
      this.cullAdd(back, x0 - 60, x1 + 60);
      // Innenraum: hinten ganz dunkel, zur Öffnung hin heller – in der Form des Hohlraums
      const sh = caveShade(this, c, this.terrainKeys);
      const shade = this.add.image(sh.x, sh.y, sh.key).setOrigin(0).setDisplaySize(sh.w, sh.h).setDepth(DEPTH.cover);
      this.cullAdd(shade, sh.x - 20, sh.x + sh.w + 20);
      const green = c.coat === 1;
      const mx = c.side > 0 ? x1 : x0;
      const pe = this.add.particles(0, 0, 'p_dot', {
        x: { min: mx - 90, max: mx + 90 }, y: { min: c.y - 20, max: c.y + c.h + 20 },
        speedX: { min: -12, max: 12 }, speedY: { min: -14, max: 6 }, lifespan: { min: 2400, max: 4200 }, frequency: green ? 220 : 170,
        scale: { start: green ? 1.1 : 1.8, end: 0.2 }, alpha: { start: green ? 0.5 : 0.55, end: 0 }, tint: green ? [0x7fd06a, 0x4fa04a, 0xa6e08a] : [0x07080a, 0x14181c],
        blendMode: green ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      }).setDepth(DEPTH.cover + 1);
      this.caveFx.push({ c, pe, on: true });
    });
    this.buildWalls();
  }

  /** Das Geröll vor den Höhlen (was in diesem Leben schon aufgebrochen wurde, bleibt offen). */
  private buildWalls() {
    const run = game.run;
    this.L.walls.forEach((w, i) => {
      const id = `${this.ep.id}:${this.place.id}:${i}`;
      if (run?.walls?.includes(id)) return;
      const art = rubbleArt(this, w, this.L.theme, this.zoneAt(0).def.ground, this.terrainKeys);
      const img = this.add.image(art.wall.x, art.wall.y, art.wall.key).setOrigin(0).setDisplaySize(art.wall.w, art.wall.h).setDepth(DEPTH.terrain + 0.6);
      const cracks = this.add.image(art.cracks.x, art.cracks.y, art.cracks.key).setOrigin(0).setDisplaySize(art.cracks.w, art.cracks.h).setDepth(DEPTH.terrain + 0.7).setAlpha(0);
      this.cullAdd(img, art.wall.x, art.wall.x + art.wall.w);
      this.cullAdd(cracks, art.wall.x, art.wall.x + art.wall.w);
      this.walls.push({ w, id, img, cracks, body: this.addBody(w), dmg: 0, hitAt: -1e9 });
    });
  }

  /**
   * Ein Stoß gegen das Geröll: Bricht es auf? Das gelingt mit einem harten Kopf (Stoßfisch) bzw. viel Körpermasse – oder im
   * Schwarm: Jeder Artgenosse, der dich gerade begleitet und in der Nähe ist, stößt mit (CAVE_WALL). Sonst bekommt es Risse.
   */
  private wallStep(time: number) {
    const p = this.player;
    if (!this.walls.length || !p.isRamming || p.dead) return;
    const pr = p.hitRect();
    const reach = { x: pr.x - 14, y: pr.y - 6, w: pr.w + 28, h: pr.h + 12 };
    for (const wl of this.walls) {
      if (time - wl.hitAt < 600 || !overlaps(reach, wl.w)) continue;
      wl.hitAt = time;
      const w = wl.w, cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      // wer dich begleitet und nah bei dir ist, stößt mit
      const near = (this.swarm?.escorts ?? []).filter((k) => Math.hypot(k.x - p.x, k.y - p.y) < CAVE_WALL.near);
      for (const k of near) {
        const d = Math.hypot(cx - k.x, cy - k.y) || 1;
        k.b.setVelocity(((cx - k.x) / d) * k.def.speed * 2.2, ((cy - k.y) / d) * k.def.speed * 2.2);
      }
      const sf = clamp(p.speed01 / 1.65, 0.6, 1.4);
      const force = p.stats.ram * sf * (1 + CAVE_WALL.perKin * near.length);
      const need = CLASSES[game.cls].base.ram * CAVE_WALL.need;
      if (DEBUG) console.log('Geröll', { force: force.toFixed(2), need: need.toFixed(2), helpers: near.length });
      if (force >= need) return this.breakWall(wl);
      // zu schwach: es knirscht, Staub rieselt, du prallst ab – die Risse zeigen, wie viel noch fehlt
      wl.dmg = Math.max(wl.dmg, force / need);
      this.tweens.add({ targets: wl.cracks, alpha: clamp((wl.dmg - 0.35) / 0.55, 0.15, 0.85), duration: 200 });
      this.tweens.add({ targets: wl.img, x: wl.img.x + 2, yoyo: true, repeat: 2, duration: 40 });
      p.recoil(cx, p.stats.ramSelf * 0.25, 0.7);
      audio.sfx('thud');
      this.cameras.main.shake(140, 0.006);
      this.puff(cx - w.side * 4, cy + 10, 8, 0x9a9282);
      this.fightAt = time;
    }
  }

  /** Das Geröll bricht auf: Steine fliegen, Staub wirbelt – die Höhle ist offen (für den Rest dieses Lebens). */
  private breakWall(wl: Rubble) {
    const w = wl.w, cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    this.walls = this.walls.filter((o) => o !== wl);
    this.removeBody(wl.body, w);
    const run = game.run;
    if (run) {
      run.walls = [...(run.walls ?? []), wl.id];
      game.save();
    }
    // Steine fliegen in die Höhle hinein und sinken zu Boden
    const tint = [0x8c8574, 0x6f6b60, 0xa59c86];
    const rocks = this.add.particles(0, 0, 'p_dot', {
      x: { min: w.x, max: w.x + w.w }, y: { min: w.y, max: w.y + w.h },
      speedX: { min: -w.side * 40, max: -w.side * 260 }, speedY: { min: -160, max: 40 }, gravityY: this.water ? 260 : 700,
      lifespan: { min: 700, max: 1500 }, scale: { start: 1.9, end: 1.1 }, alpha: { start: 1, end: 0 }, tint, emitting: false,
    }).setDepth(DEPTH.terrain + 0.8);
    rocks.explode(46);
    this.time.delayedCall(1700, () => rocks.destroy());
    this.puff(cx, cy, 22, 0x9a9282);
    if (this.water) this.silt?.explode(14, cx, w.y + w.h - 6);
    this.tweens.add({ targets: [wl.img, wl.cracks], alpha: 0, scaleY: 0.4, y: `+=${w.h * 0.5}`, duration: 380, ease: 'Quad.in', onComplete: () => {
      wl.img.destroy();
      wl.cracks.destroy();
    } });
    this.player.recoil(cx, 0, 0.35);
    audio.sfx('crumble');
    this.cameras.main.shake(320, 0.014);
    this.fightAt = this.time.now;
  }

  /**
   * Aus einer Höhle herausgeschwommen: Die Farbe der Höhle geht an die Nachkommen – nur ein einziges Mal pro Lauf. Das Tier
   * selbst bleibt, wie es ist; nur ein leiser Schimmer zeigt, dass etwas geschehen ist.
   */
  private paintCoat(coat: number) {
    const p = this.player;
    const run = game.run;
    if (!run || run.coatSet || run.life.coat !== undefined || game.traits.coat === coat) return;
    game.setCoat(coat);
    this.sparkle.explode(5, p.x, p.y);
  }

  /** Felsspalten: drinnen ist es dunkel – ein gutes Versteck, aber nur für Schlanke. */
  private buildCrevices() {
    for (const c of this.L.crevices) {
      const dark = tex(this, `crev_dark_${Math.round(c.w)}x${Math.round(c.h)}`, c.w, c.h, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        for (const [o, a] of [[0, 0.25], [0.1, 0.62], [0.9, 0.62], [1, 0.25]]) g.addColorStop(o, `rgba(2,4,4,${a})`);
        ctx.fillStyle = g;
        rrect(ctx, 0, 0, w, h, 10);
        ctx.fill();
      }, 0.5);
      const shade = this.add.image(c.x, c.y, dark).setOrigin(0).setDisplaySize(c.w, c.h).setDepth(DEPTH.cover);
      this.cullAdd(shade, c.x - 20, c.x + c.w + 20);
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
    const unset = !game.run?.coatSet && game.run?.life.coat === undefined;
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
      // gegen die Strömung anschwimmen zählt als Strecke doppelt
      if (p.body.velocity.x * pf.r.dir < -40 && !p.bottomWalk) this.train.swim += dt * 0.5;
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
    for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 650, () => !this.ended && audio.sfx('heart', 0.8));
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

  /** Ein Angriff aus dem Versteck heraus: mehrfacher Schaden, das Opfer ist kurz betäubt. */
  private surprise(a: Animal) {
    a.stun(1300);
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
  groundTop(x: number, y: number, range = 50) {
    let best = Infinity;
    let bd = range;
    for (const list of [this.solidIndex.get(Math.floor(x / 40)) ?? [], this.platRects]) {
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
      if (SWAYS.has(k)) this.swayList.push({ o: img, amp: ((this.water ? 3 : 1.6) + rnd() * (this.water ? 4 : 2)) * (k in LIFE_SWAY ? LIFE_SWAY[k] * 0.6 : 1), sp: 0.5 + rnd() * 0.9, ph: rnd() * 6 });
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
      // Die neuen Meeresbewohner (Schwämme, Korallen, Seelilien …) stehen für sich; Tang und Gras wächst oft in Büscheln
      const life = LIFE_KEYS.has(d.k);
      const plant = !life && (SWAYS.has(d.k) || d.k === 'coral' || d.k === 'sponge' || d.k === 'cycad' || d.k === 'bush' || d.k === 'mushroom');
      const sc = life ? 1 + rnd() * 0.5 : plant ? 0.75 + rnd() * 0.6 : 0.8 + rnd() * 0.45;
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
        if (L.ground[col] >= L.height || L.fore.some((f) => Math.abs(x - f.x) < f.rx + 50)) continue;
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
    // Artgenossen sind ausgewachsen – auch wenn das eigene Tier noch ein Jungtier ist
    const st = game.stats(game.cls, game.traits);
    const d = game.traits.diet;
    const diet = d > 0.3 ? 'meat' : 'plant';
    this.kinDef = {
      id: 'kin', name: 'Artgenosse', art: { t: 'jelly', r: 1, c: 0 }, role: 'prey', diet,
      habitat: this.water ? 'water' : 'land',
      // so viel Lebenskraft wie du – aber schwächer im Angriff (siehe SWARM)
      hp: Math.max(8, st.maxHp), dmg: Math.max(1, st.bite * game.swarmStrength()), power: st.power * game.swarmStrength(),
      speed: st.speed * 0.95, sense: 280, meat: 2, sprint: 1.35,
    };
    // Je mehr Rudeltier, desto mehr Artgenossen leben in der Gegend
    // Artgenossen sind jetzt sehr selten: Man ist meist allein. Wer einem begegnet, trifft ihn bei einem Auftrag (objects/Quest.ts).
    const n = 0;
    const s = this.L.start;
    for (let i = 0; i < n; i++) {
      // Artgenossen leben verstreut in der Gegend, jeder in seinem Revier – kein Schwarm um dich herum
      const side = i % 2 ? 1 : -1;
      let x = clamp(s.x + side * (170 + Math.floor(i / 2) * 260 + Math.random() * 120), 60, this.L.width - 60);
      // im stillen Fluss am Start ist man allein – die anderen schwimmen weiter draußen in der Mündung
      if (this.L.riverEnd) x = Math.max(x, this.L.riverEnd + 300 + i * 120);
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

  /** Ein Artgenosse deiner Gruppe erscheint – mit dem Aussehen, das zu seiner Nummer gehört, und der Lebenskraft, die er noch hat. */
  spawnMember(m: Member, x: number, y: number): Kin {
    const genes = game.kinTraits(m.id);
    const d = game.traits.diet;
    const k = new Kin(this, this.kinDef, x, y, game.morph({ traits: genes.traits, fierce: 0, seed: genes.seed, sex: genes.sex }), (game.run?.social ?? 0.55) + (Math.random() - 0.5) * 0.12);
    k.genes = genes;
    k.memberId = m.id;
    k.omni = d >= -0.3 && d <= 0.3;
    k.hp = Math.max(1, Math.round(k.maxHp * m.hp));
    this.animals.push(k);
    return k;
  }

  /** Ein Tier schließt sich einer Gruppe an (Schwarm, Rudel) bzw. verlässt sie. */
  joinHerd(a: Animal, id: number) {
    this.leaveHerd(a);
    a.herdId = id;
    const list = this.herds.get(id);
    if (list) list.push(a);
    else this.herds.set(id, [a]);
  }

  leaveHerd(a: Animal) {
    const list = this.herds.get(a.herdId);
    if (list) this.herds.set(a.herdId, list.filter((m) => m !== a));
    a.herdId = -1;
  }

  /** Ein freier Platz für einen Artgenossen: im Wasser irgendwo frei, an Land auf dem Boden. */
  kinSpot(x: number, y: number): { x: number; y: number } | null {
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
    const list = this.solidIndex.get(Math.floor(x / 40));
    if (list) for (const r of list) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
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

  /** Wer dicht über dem Grund schwimmt oder dort entlangläuft, wirbelt eine Wolke aus Sediment auf: Sand, Gesteinsstaub oder Schlamm. */
  private siltStep(time: number) {
    const silt = this.silt;
    if (!silt || time < this.siltAt) return;
    this.siltAt = time + 110;
    const L = this.L;
    const kick = (x: number, bottom: number, vx: number, strength: number) => {
      const gap = groundAt(L.terrain.hp, x) - bottom;
      if (gap > 34 || gap < -30) return;
      const m = matAt(L.terrain.zones, x);
      silt.setParticleTint(m === 'sand' ? 0xe4d6a8 : m === 'rock' ? 0xb6b8ae : 0xa09274);
      silt.explode(Math.max(1, Math.round(strength * (1 - Math.max(0, gap) / 40))), x - Math.sign(vx || 1) * 10, groundAt(L.terrain.hp, x) - 3);
    };
    const p = this.player;
    if (p.speed01 > 0.28) kick(p.x, p.body.bottom, p.body.velocity.x, p.bottomWalk ? 2 : 1.4);
    const v = this.cameras.main.worldView;
    let budget = 5;
    for (const a of this.animals) {
      if (budget <= 0) break;
      if (a.dead || !a.body || a.def.habitat === 'air' || a.x < v.x - 50 || a.x > v.right + 50) continue;
      if (Math.hypot(a.body.velocity.x, a.body.velocity.y) < 70) continue;
      kick(a.x, a.body.bottom, a.body.velocity.x, a.displayWidth > 120 ? 2.4 : 1);
      budget--;
    }
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
    // ein anderer Spieler: so gut zu sehen wie jedes Tier (Verstecke und Tarnung rechnet sein Spiel nicht mit)
    if (this.net && this.focusFor(a) !== this.player) return 1;
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

  /**
   * Wie sehr ein Tier den Spieler fürchtet (0 … gut 1). Es kommt auf die Körpergröße an – wer klein ist, wirkt harmlos,
   * auch wenn er kräftig zubeißt – und etwas auf die Stärke im Vergleich zum Tier.
   */
  fearOf(a: Animal) {
    if (this.net && this.focusFor(a) !== this.player) return 0.5;
    const ratio = this.player.bodyLen / Math.max(20, a.displayWidth);
    const size = clamp((ratio - 0.45) / 1.05, 0, 1.15);
    const power = clamp(this.playerThreat() / Math.max(0.6, a.def.power * a.sz) / 1.3, 0.45, 1.2);
    return size * (0.55 + 0.45 * power);
  }

  /** Ein Tier ist erschöpft: Es schnappt nach Luft – ein paar Blasen steigen vom Maul auf. */
  tired(a: Animal) {
    if (a.kin) return;
    this.puff(a.x + a.dir * a.displayWidth * 0.4, a.y - a.displayHeight * 0.2, 4, 0xe8f4f0);
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
    // ein Artgenosse deiner Gruppe ist lebend fortgeschwommen (fortgeschickt): Er bleibt in der Gruppe
    if (a instanceof Kin) this.swarm?.gone(a);
    // Beute, die über den Rand hinaus geflohen ist, kommt später wieder
    else if (a.runningFor(this.time.now) > 0 && !a.bound) {
      this.returning.push({ id: a.def.id, x: a.home.x, y: a.home.y, herd: a.herdId >= 0 ? a.herdId : undefined, at: this.time.now + 30000 + Math.random() * 30000 });
    }
    this.removeAnimal(a);
  }

  kinSnubbed(k: Kin, _bit: boolean) {
    audio.sfx('snub');
    this.puff(k.x, k.y - 6, 3);
  }

  /** Verärgert davongezogen: Wer zu deiner Gruppe gehörte, hat sie verlassen. */
  kinLeaving(k: Kin) {
    this.swarm?.quit(k);
  }

  kinShared(k: Kin, c: Meat) {
    this.sparkle.explode(6, k.x, k.y - 8);
    // gemeinsam gefressen: Das zählt für den Schwarmfisch – und lockt mit der Zeit weitere Artgenossen an
    this.swarm?.shared(k, c);
  }

  /**
   * Du greifst etwas an: Artgenossen in der Nähe helfen vielleicht mit – je mehr Zusammenhalt deine Art hat und je mehr
   * sie dir vertrauen, desto eher. Wer dich begleitet (gerufen), hilft immer.
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
      const brave = a.def.power <= groupPower * 1.2 || k.loyalty > 0.75 || k.escort;
      if (!brave) continue;
      k.offerHunt(a, now + 7000, k.escort ? 1 : clamp(0.12 + 0.75 * pack + 0.35 * (k.loyalty - 0.5), 0.05, 0.95));
    }
  }

  /** Aus der Liste nehmen – ohne die Liste zu ersetzen (die Kollision hängt an genau diesem Array). */
  /** Tiere, denen man nahe kommt, bekommen ihre Seite in der Chronik des Lebens. */
  private spotStep(time: number) {
    if (time < this.spotAt) return;
    this.spotAt = time + 500;
    const p = this.player;
    const fresh: string[] = [];
    for (const a of this.animals) {
      if (a.dead || a.kin) continue;
      const id = a.def.id;
      if (game.hasSeen(id)) continue;
      // erst wer nahe genug herangeschwommen ist, bekommt einen Eintrag – große Tiere bemerkt man schon etwas früher
      const len = (a.def.art as { len?: number }).len ?? 40;
      if (Math.hypot(a.x - p.x, a.y - p.y) > Math.min(460, 240 + len * 0.9)) continue;
      if (game.markSeen(id)) fresh.push(id);
    }
    if (fresh.length) bus.emit('dex', fresh);
  }

  /** Liegt der Punkt außerhalb des Bildes (mit Rand)? */
  private offScreen(x: number, y: number, m: number) {
    return this.views().every((v) => x < v.x - m || x > v.right + m || y < v.y - m || y > v.bottom + m);
  }

  /**
   * Was die Spieler am Ort gerade sehen: dein Bild – und im Mehrspieler etwa so viel um jeden anderen Spieler herum. So
   * verschwindet kein Tier vor den Augen eines anderen, und keines taucht vor ihnen aus dem Nichts auf.
   */
  private views(): { x: number; y: number; right: number; bottom: number }[] {
    const v = this.cameras.main.worldView;
    const ts = this.net?.world.targets;
    if (!ts || !ts.size) return [v];
    const out = [{ x: v.x, y: v.y, right: v.right, bottom: v.bottom }];
    const hw = v.width / 2, hh = v.height / 2;
    for (const t of ts.values()) if (!t.dead) out.push({ x: t.x - hw, y: t.y - hh, right: t.x + hw, bottom: t.y + hh });
    return out;
  }

  /** Beute, die schon eine Weile flieht, entkommt: aus dem Bild – oder am Rand des Ortes, wo es nicht mehr weitergeht. */
  private escaped(a: Animal, time: number) {
    if (a.runningFor(time) < 1500) return false;
    // entkommen ist nur, wer nicht mehr zu sehen ist – mit seiner ganzen Größe, nicht nur der Mitte (große Tiere
    // verschwanden sonst halb im Bild). Am Rand des Ortes schwimmt es einfach weiter hinaus.
    return !this.seen(a, 140);
  }

  /** Ist das Tier (seine ganze Gestalt) im Bild bzw. höchstens margin davon entfernt? */
  private seen(a: Animal, margin: number) {
    const hw = Math.max(a.displayWidth, a.body?.width ?? 0) / 2 + margin, hh = Math.max(a.displayHeight, a.body?.height ?? 0) / 2 + margin;
    return this.views().some((v) => a.x + hw > v.x && a.x - hw < v.right && a.y + hh > v.y && a.y - hh < v.bottom);
  }

  inView(a: Animal) {
    return this.seen(a, 40);
  }

  /** Entkommene Tiere kommen nach einer Weile wieder – andere Fische ziehen an ihrer Stelle ein, außerhalb des Bildes. */
  private restock(time: number) {
    if (time < this.restockAt || !this.returning.length || !this.authority) return;
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

  /** Wird hier gerade gesprochen (oder eben noch)? Dann greift in der Nähe niemand an. */
  truce(x: number, y: number) {
    return this.time.now < this.truceUntil && Math.hypot(x - this.truceSpot.x, y - this.truceSpot.y) < 1700;
  }

  /** Läuft gerade der Kino-Moment mit dem Riesen im Hintergrund? */
  get cineActive() {
    return !!this.cine;
  }

  /** Ein Tier aus der Liste der Tiere nehmen (es wird nicht mehr bedacht). */
  dropAnimal(a: Animal) {
    this.removeAnimal(a);
  }

  /**
   * Mehrspieler: Rechnet dieses Spiel die Tiere des Ortes? Allein immer; mit anderen nur der Ortswächter – die anderen
   * sehen seine Tiere, und nur bei ihm kommen neue hinzu (Durchzügler, Rückkehrer, Schlüpflinge).
   */
  get authority() {
    return !this.net || this.net.world.authority;
  }

  /**
   * Mehrspieler: Der Spieler, um den sich ein Tier gerade kümmert – der nächste (du oder ein anderer). Ein Wechsel braucht
   * einen deutlichen Unterschied, sonst bliebe ein Tier zwischen zwei Spielern unentschlossen.
   */
  focusFor(a: Animal): PlayerLike {
    const ts = this.net?.world.targets;
    if (!ts || !ts.size || a.kin || a.personal) return this.player;
    const now = this.time.now;
    const c = this.focus.get(a);
    if (c && now < c.until && !c.p.dead) return c.p;
    const dist = (p: PlayerLike) => (p.dead ? Infinity : Math.hypot(p.x - a.x, p.y - a.y));
    let best: PlayerLike = this.player, bd = dist(this.player);
    for (const t of ts.values()) {
      const d = dist(t);
      if (d < bd) {
        best = t;
        bd = d;
      }
    }
    if (c && !c.p.dead && dist(c.p) < bd * 1.3) best = c.p;
    this.focus.set(a, { p: best, until: now + 400 });
    return best;
  }

  /** Mehrspieler, als Gast: Die eigenen Tiere und das Fleisch dieses Ortes gehen – es gelten die des Ortswächters. */
  dropShared() {
    for (const a of [...this.animals]) {
      if (a.kin || a.personal || (a as { ghost?: boolean }).ghost) continue;
      a.dead = true;
      this.removeAnimal(a);
      a.destroy();
    }
    for (const m of this.meats) if (!m.net) m.remove();
    this.meats = this.meats.filter((m) => !m.gone);
    this.returning = [];
    this.bossA = undefined;
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
      // ein Artgenosse stirbt: Für einen Moment bricht die Klanglandschaft fast ganz zusammen
      audio.loss();
      if (byPlayer) game.addAggression(0.2);
      // ein Artgenosse deiner Gruppe ist gestorben: Er fehlt fortan
      if (a instanceof Kin) this.swarm?.died(a);
      return;
    }
    this.hunt?.died(a, byPlayer);
    // Beute, an der du beteiligt warst, gilt als deine
    const ours = byPlayer || this.time.now - a.hitByPlayerAt < 8000;
    // selten bleibt eine Muschel zurück – eher bei Tieren, die stark sind im Vergleich zu dir (SHELLS)
    if (ours && !this.ended && Math.random() < shellChance((a.def.power * a.sz) / Math.max(1, this.player.stats.power))) this.dropShell(a.x, a.y);
    const kill = new Kill(ours, a.def.id);
    for (const k of a.helpers) if (k instanceof Kin && !k.dead) kill.helpers.add(k);
    // gemeinsam erlegt: zählt für den Schwarmfisch (gegen Starke mehr)
    if (ours && kill.helpers.size) {
      this.train.pack += 0.5 + this.challenge(a);
      noteBest(this.train, 'pack', this.strength(a));
    }
    // Wie in E.V.O.: Aus dem erlegten Tier wird saftiges Fleisch – so viel, wie es stark und groß war (meatOf, nach der
    // Lebenskraft der Art und der Größe des Tiers), in Brocken: große Keulen (je FOOD.chunk) und kleine Stücke (je 1)
    const killer = a.lastAttacker;
    const total = a.def.food !== undefined ? a.def.food * a.sz : meatOf(a.def.hp * a.sz);
    const chunks = meatChunks(total);
    const n = chunks.length;
    const fresh: Meat[] = [];
    chunks.forEach((value, i) => {
      const spread = (i - (n - 1) / 2) * (n > 6 ? 36 : 60) + (Math.random() - 0.5) * 30;
      const vy = this.water ? -40 - Math.random() * 60 : -220 - Math.random() * 120;
      const m = new Meat(this, this, a.x, a.y, value, this.time.now, kill, spread, vy);
      this.meats.push(m);
      fresh.push(m);
    });
    // Wer das Tier erlegt hat, frisst es – mit der passenden Fress-Haltung, statt gleich weiterzuziehen
    if (killer instanceof Animal && !killer.dead && !killer.kin && killer.def.diet === 'meat' && fresh.length) killer.startFeast(fresh[Math.floor(fresh.length / 2)], this.time.now);
    this.puff(a.x, a.y, 6, 0xffe0c0);
    if (byPlayer) {
      game.addAggression(a.role === 'prey' ? 0.1 : 0.06);
      audio.sfx('tear');
    }
    this.bleed(a.x, a.y, 10);
    if (a.visitor) {
      this.cameras.main.shake(600, 0.012);
      audio.sfx('boom');
    }
    if (a === this.bossA && !this.ended) {
      game.prog.boss = 2;
      bus.emit('boss', a.def.name, 0);
      this.cameras.main.flash(700, 255, 230, 180);
      audio.sfx('victory');
    }
  }

  // ---------------------------------------------------------------- Spieler-Aktionen

  /**
   * Wie viel ein Erfolg gegen dieses Tier für die Evolutionsplatten zählt: kleine Beute kaum, ebenbürtige Gegner voll,
   * deutlich stärkere mehrfach. Artgenossen und Nesseltiere zählen nicht.
   */
  private challenge(a: Animal) {
    if (a.kin || a.role === 'hazard') return 0;
    const r = (a.def.power * a.sz) / Math.max(1, this.player.stats.power);
    return clamp(0.1 + 0.9 * r, 0.1, 2.6);
  }

  /**
   * Wie stark ein Gegner im Verhältnis zu deiner Art ist (zum ausgewachsenen eigenen Tier, nicht zum Jungtier – sonst
   * zählte jede Beute aus der Jugend als stark). Daraus wird, wie weit dich das Training trägt (GameState, plateCeil).
   */
  private strength(a: Animal) {
    if (a.kin || a.role === 'hazard') return 0;
    return (a.def.power * a.sz) / Math.max(1, game.stats(game.cls, game.traits).power);
  }

  /**
   * Eine geglückte Verfolgung: Getroffen wurde Beute, die schon eine Weile davonrannte – je länger sie floh und je schneller
   * sie (im Vergleich zu dir) ist, desto mehr zählt es. ranMs: so lange rannte sie vor dem Treffer schon.
   */
  private pursuit(a: Animal, ranMs: number) {
    if (ranMs < 600) return 0;
    const fast = clamp(a.fleeSpeed() / Math.max(1, this.player.stats.speed), 0.5, 2);
    return (0.5 + 0.5 * Math.min(4, ranMs / 1000)) * fast;
  }

  /**
   * Die Nutzung dieses Ortes mitzählen (aktive Sekunden, dazu Fressen und Kämpfen) – daraus wird die Körpergröße der
   * Nachkommen. In tiefen Orten zählt nur, wer auch hinabschwimmt: Oben im noch hellen Wasser gilt es eine Stufe flacher.
   */
  private useHere(w: number) {
    let kind = this.place.kind;
    if (this.deepK < 0.15) kind = kind === 'abyss' ? 'deep' : kind === 'deep' ? 'murky' : kind;
    this.train.hab[kind] = (this.train.hab[kind] ?? 0) + w;
  }

  /** Ein Erfolg (Stoß bzw. Biss) für die Platten: erlegte Gegner zählen dreifach, eingeholte Flüchtende zusätzlich als Verfolgung. */
  private scoreHit(kind: 'ram' | 'hunt', a: Animal, ranMs: number, k = 1) {
    const kill = a.dead ? 3 : 1;
    this.train[kind] += this.challenge(a) * kill * k;
    const chase = this.pursuit(a, ranMs);
    this.train.chase += chase * kill;
    // die stärksten bezwungenen Gegner (erlegt zählt ganz, ein Treffer halb) – sie bestimmen, wie weit das Training trägt
    const won = a.dead ? 1 : 0.5;
    noteBest(this.train, kind, this.strength(a) * won);
    if (chase > 0) noteBest(this.train, 'chase', (a.fleeSpeed() / Math.max(1, game.stats(game.cls, game.traits).speed)) * won);
    this.useHere(0.6);
    this.hunt?.hit(a);
  }

  playerBite(rect: Rect, momentum = 0) {
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
      const ran = a.runningFor(now);
      a.hurt(st.bite * (sneak ? 2 + Math.min(1, game.traits.stealth * 2) : 1) * (held ? 1.25 : 1) * (1 + 0.6 * momentum), p, 'bite');
      if (sneak) this.surprise(a);
      if (held && !a.dead) a.stun(550);
      // Bisse zählen für die Platte „Beißen“ – gegen Starke viel, gegen kleine Beute kaum
      this.scoreHit('hunt', a, ran, held ? 1.5 : 1);
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
      // ein Brocken – immer ganz, mit einem Bissen
      const got = m.bite(m.value);
      if (!p.eat(got * dig, 'meat')) return;
      this.floatNum(m.x, m.y - 16, got * dig, 'meat');
      this.ate('meat', got * FOOD.meat.kcal * dig);
      m.playerBites++;
      // ein Tier zählt in der Beute-Statistik einmal – gleich, wie viele Brocken man davon frisst
      if (!m.kill.playerAte && m.kill.species) game.noteEaten(m.kill.species);
      m.kill.playerAte = true;
      this.checkShare(m.kill);
      return;
    }
    for (const rr of this.roes) {
      if (rr.units <= 0 || rr.hatched || rr.spared || !overlaps(rect, rr.rect)) continue;
      const gain = FOOD.roe.sat * st.digestMeat;
      if (p.eat(gain, 'meat')) {
        this.floatNum(rr.x, rr.y - 48, gain, 'roe');
        this.ate('meat', FOOD.roe.kcal * st.digestMeat);
        rr.take();
        this.puff(rr.x, rr.y - 22, 4, 0xf0d890);
        this.roeBitten(rr);
      }
      return;
    }
    for (const pl of this.plants) {
      if (pl.units <= 0 || !overlaps(rect, pl.rect)) continue;
      const food = pl.toxic ? FOOD.toxic : FOOD.plant;
      const gain = food.sat * st.digestPlant;
      if (p.eat(gain, 'plant')) {
        this.floatNum(pl.x, pl.y - 44, gain, pl.toxic ? 'toxic' : 'plant');
        this.ate('plant', food.kcal * st.digestPlant);
        // die ganze Pflanze mit einem Bissen – sie wächst nach
        pl.eatAll(now);
        if (pl.toxic) this.poisoned();
        else if (pl.heals) this.healed(pl);
        game.grow('stealth', 0.012);
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
  floatNum(x: number, y: number, n: number, kind: 'meat' | 'plant' | 'toxic' | 'roe') {
    const v = Math.round(n);
    if (v < 1) return;
    // dezent: klein, gedämpfte Farben, steigt kurz auf und vergeht
    const col = kind === 'meat' ? '#e0806c' : kind === 'toxic' ? '#b49ad0' : kind === 'roe' ? '#e8c890' : '#a8d088';
    const t = text(this, x, y, `+${v}`, Math.round(19 / Z), col, { fontStyle: '600', stroke: '#0a0605', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(DEPTH.text).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 0.8, duration: 200 });
    this.tweens.add({ targets: t, y: y - 40, duration: 1300, ease: 'Sine.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 500, onComplete: () => t.destroy() });
  }

  /**
   * Der Ausdauerkreis – wie in Breath of the Wild: ein grüner Kreis rechts neben dem Tier. Er erscheint, sobald Ausdauer
   * verbraucht wird, leert sich im Uhrzeigersinn (von zwölf Uhr aus) und füllt sich wieder; ist er voll, leuchtet er kurz auf
   * und blendet aus. Mehr Ausdauer (Segen der großen Muschel) liegt als weitere Ringe außen herum – sie leeren sich zuerst.
   * Ganz leer ist das Tier erschöpft: Der Kreis wird rot und füllt sich rot, bis er voll ist. Wird es knapp, blinkt er.
   */
  private drawStamina(p: Player, dt: number) {
    const max = p.staminaMax, v = clamp(p.stamina, 0, max);
    const now = this.time.now;
    // der Kreis wächst nach einem Segen sichtbar um sein neues Stück
    const growing = now - p.grewAt < 1800;
    // (während gebetet wird, bleibt er, wie er war – er wächst erst, wenn das Licht im Tier angekommen ist)
    if (now >= this.stamHold) this.stamMax = growing ? Math.min(max, this.stamMax + dt * 0.5) : max;
    const full = v >= max - 0.001 && !p.exhausted && !growing;
    if (full && this.stamFull < 0) {
      // eben voll geworden: ein kurzes Aufleuchten
      this.stamFull = 0;
      if (this.stamA > 0.2) this.stamPulse = 1;
    }
    if (!full) this.stamFull = -1;
    else this.stamFull += dt;
    const show = !p.dead && !this.ended && (!full || this.stamFull < 0.7);
    this.stamA = clamp(this.stamA + (show ? dt * 6 : -dt * 2.6), 0, 1);
    this.stamPulse = Math.max(0, this.stamPulse - dt * 2.2);
    const g = this.stamG;
    g.clear();
    if (this.stamA < 0.02) return;
    // gleich groß auf dem Bildschirm, egal wie nah die Kamera ist
    const z = this.cameras.main.zoom;
    // klein und dezent: ein schmaler Ring, etwas durchscheinend
    const R = 8.5 / z, T = 3.4 / z, gap = 2 / z;
    const cx = p.x + p.rect.width / 2 + 16 / z, cy = p.y - p.rect.height / 2 - 10 / z;
    const a = this.stamA * 0.85, top = -Math.PI / 2;
    const low = !p.exhausted && v / max < 0.25;
    const blink = low && Math.floor(now / 160) % 2 === 0;
    const col = p.exhausted ? 0xcf4a36 : blink ? 0xe2604a : 0x84d465;
    const lite = p.exhausted ? 0xff9a7e : 0xd6ffbc;
    const arc = (r: number, f: number, w: number, c: number, al: number) => {
      if (f <= 0.001) return;
      g.lineStyle(w, c, al);
      g.beginPath();
      g.arc(cx, cy, r, top, top + Math.PI * 2 * Math.min(1, f), false);
      g.strokePath();
    };
    const pulse = 1 + this.stamPulse * 0.18;
    for (let k = 0; k < 3; k++) {
      const cap = clamp(this.stamMax - k, 0, 1);
      if (cap <= 0) break;
      const r = (R + k * (T + gap)) * (k === 0 ? pulse : 1);
      const f = clamp(v - k, 0, cap);
      // die Spur: dunkel, mit feinem Rand
      arc(r, cap, T + 1.6 / z, 0x050806, 0.45 * a);
      arc(r, cap, T, 0x1c2a1a, 0.4 * a);
      // die Füllung, innen ein feiner heller Glanz
      arc(r, f, T, col, 0.85 * a);
      arc(r - T * 0.2, f, T * 0.25, lite, 0.3 * a);
      // außen: die Stücke der Segen als feine Kerben
      if (k > 0) {
        for (let s = STAMINA.perBlessing; s < cap - 0.01; s += STAMINA.perBlessing) {
          const ang = top + Math.PI * 2 * s;
          g.lineStyle(1.2 / z, 0x050806, 0.7 * a);
          g.lineBetween(cx + Math.cos(ang) * (r - T / 2), cy + Math.sin(ang) * (r - T / 2), cx + Math.cos(ang) * (r + T / 2), cy + Math.sin(ang) * (r + T / 2));
        }
      }
    }
    // eben voll geworden: ein heller Ring, der kurz aufleuchtet
    if (this.stamPulse > 0) arc(R * pulse, 1, T * 0.6, 0xf2ffe0, this.stamPulse * 0.6 * a);
  }

  /** Jemand frisst am Gelege: Eltern, die es mitbekommen, greifen an. */
  private roeBitten(rr: Roe) {
    if (rr.own) return;
    const p = this.player;
    const now = this.time.now;
    for (const g of rr.guards) {
      if (g.dead) continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      // sie müssen es mitbekommen: in Sichtweite – und wer sich versteckt, fällt nur aus nächster Nähe auf
      if (d < g.def.sense * 0.95 && (!p.hidden || d < 120)) g.rage(p, now);
    }
  }

  /** Das Gelege schlüpft: ein paar kleine Junge, die sich bald auf den Weg machen. */
  private hatch(rr: Roe) {
    // im Mehrspieler schlüpft nur beim Ortswächter etwas (dessen Tiere sehen alle)
    if (!this.authority) return;
    const n = Math.max(2, Math.ceil(rr.units * 0.8));
    for (let i = 0; i < n; i++) {
      const a = this.spawnAnimal(rr.species, rr.x + (Math.random() - 0.5) * 50, rr.y - 26 - Math.random() * 20);
      a.sz *= 0.55;
      a.setScale(a.sz);
      a.hp = a.maxHp = Math.max(2, Math.round(a.maxHp * 0.5));
    }
    this.puff(rr.x, rr.y - 20, 8, 0xf0e0b0);
    rr.vanish();
  }

  /** Heilkraut: die Wunden schließen sich, die Kraft kehrt zurück. */
  private healed(pl: Plant) {
    const p = this.player;
    p.heal(MISC.healBite);
    p.stamina = Math.min(p.staminaMax, p.stamina + 0.3);
    p.view.flash(0xffc8e0);
    this.time.delayedCall(160, () => p.view.flash(null));
    this.puff(pl.x, pl.y - 24, 6, 0xffb0d0);
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
  }

  /** Mitzählen, was gefressen wurde (aufgenommene Energie – sie bestimmt die Ernährung der nächsten Generation). */
  private ate(kind: 'meat' | 'plant', units: number) {
    if (kind === 'meat') this.eatenMeat += units;
    else this.eatenPlant += units;
    game.addEaten(kind, units);
    this.useHere(0.4);
  }

  /** Kalorien (für die Anzeige) */
  kcal(units: number) {
    return kcalOf(units, game.cls, this.player.stats.size);
  }

  /**
   * Stoß: Wer mit Schwung in ein Tier stößt, betäubt kleine und mittelgroße Tiere einen Moment lang –
   * Zeit für ein, zwei Bisse, bevor sie fliehen oder zurückbeißen. Schaden macht er anfangs kaum; wer oft
   * (und erfolgreich) stößt, dessen Stoßfisch-Platte prägt sich stärker aus: ein harter Kopf mit Kopfplatte. Große
   * Tiere taumeln nur kurz, und wer gegen etwas viel Größeres stößt, tut sich selbst weh.
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
    const dealt = st.ram * 0.5 * sf;
    const small = a.def.power <= st.power * 3;
    const ran = a.runningFor(this.time.now);
    a.hurt(dealt * (sneak ? 2.5 : 1), p, 'ram');
    if (!a.dead) a.stun(small ? 1150 : a.role === 'apex' ? 220 : 500);
    if (sneak) {
      this.surprise(a);
      this.consumeAmbush();
    }
    // Ein Stoß tut auch dem eigenen Kopf ein wenig weh (ein harter Schädel schützt); gegen etwas viel Größeres erst recht
    const bump = st.ramSelf * 0.2 * sf;
    const back = bump + Math.max(0, a.def.power - st.power * 1.5) * 0.12 * (1 - 0.65 * t.skull) * (1 - 0.5 * plates);
    const k = clamp(a.def.power / (st.power + 1), 0, 1);
    p.recoil(a.x, back, k * 0.6);
    // Stöße zählen für die Platte „Stoßen“ – erst recht, wenn damit (starke) Gegner erlegt werden
    this.scoreHit('ram', a, ran, sf);
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
    if (this.cineWanted && !this.cine && !this.ended && !p.dead && !this.quest?.busy && !this.hunt?.busy) this.tryCine();
    if (this.cine) this.cineStep(delta);
    const dt = Math.min(0.05, delta / 1000) * this.slow;
    this.t += dt;
    const L = this.L;
    if (!this.ended && !(this.cine && !this.cine.released) && !this.quest?.busy && !this.hunt?.busy && time > this.prayUntil) this.controls.update();
    else this.controls.clear();
    p.update(time, dt, this.controls);
    // Gespräch: Solange es läuft und noch einen Augenblick danach, lässt man dich und deinen Gesprächspartner in Ruhe
    if (this.quest?.busy || this.hunt?.busy) {
      this.truceUntil = time + 2500;
      this.truceSpot = { x: p.x, y: p.y };
    }
    this.wallStep(time);
    this.quest?.update(time, delta);
    this.hunt?.update(time, delta);
    this.shrineStep(time, dt);
    this.quitStep(dt);
    this.swarm?.update(time);
    if (this.controls.pressed.call) this.swarm?.toggle();
    this.spawning?.update(time, dt);
    this.net?.update();
    this.drawStamina(p, dt);
    this.sightStep(dt);
    this.heartStep(time);
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
      } else if (!a.dead && !a.bound && this.escaped(a, time)) {
        // Wer lange davonrennt und nicht mehr zu sehen ist, ist entkommen – und weg (er kommt später wieder)
        this.returning.push({ id: a.def.id, x: a.home.x, y: a.home.y, herd: a.herdId >= 0 ? a.herdId : undefined, at: time + 30000 + Math.random() * 30000 });
        this.removeAnimal(a);
        a.vanish();
      } else if (a.leaveDir && !a.dead && (a.leaveDir > 0 ? a.body!.right >= L.width - 6 : a.body!.left <= 6) && !this.seen(a, 60)) {
        // am Rand angekommen und aus dem Bild: zieht in andere Gewässer weiter
        this.removeAnimal(a);
        a.vanish();
      }
    }
    const bloom = time < this.bloomUntil;
    for (const pl of this.plants) pl.update(time, bloom);
    if (time > this.hatchAt) {
      this.hatchAt = time + 1000;
      for (const roe of this.roes) if (!roe.hatched && roe.units > 0 && time > roe.hatchAt) this.hatch(roe);
    }
    for (const c of this.meats) c.update(time, dt);
    this.meats = this.meats.filter((c) => !c.gone);

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.08;
    this.bgMid.tilePositionX = cam.scrollX * 0.28;
    this.fog.tilePositionX = cam.scrollX * 0.5 + this.t * 12;
    // im Fluss am Start ist es still: die Fische in der Ferne tauchen erst zur Mündung hin auf
    const re = this.L.riverEnd ?? 0;
    const quiet = re ? clamp(1 - (p.x - (re - 500)) / 800, 0, 1) : 0;
    this.backSea?.update(time, dt, this.deepK, quiet);
    this.drift?.update(time, dt);
    if (!p.dead && !this.ended) this.siltStep(time);
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
      // das eigene Tier lebt: Es wächst heran und altert (nur, solange man spielt)
      game.ageBy(dt);
      this.lifeStep();
      this.clock(time);
      this.interact(time, dt);
      this.shellStep(time);
      this.edgeStep();
      this.weather(time, dt);
      this.migrate(time);
      this.spotStep(time);
      this.restock(time);
      this.huntMood(time);
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
      // links unten im Bild – auch wenn die Kamera beim Jungtier näher heranzoomt
      const z = this.cameras.main.zoom;
      this.dbg.setPosition(W / 2 + (12 - W / 2) / z, H / 2 + (H - 175 - H / 2) / z).setScale(1 / z);
      this.dbg.setText(
        `LP ${p.hp.toFixed(0)}/${p.stats.maxHp}  Ausd ${(p.stamina * 100).toFixed(0)}  Versteckt ${p.hidden}  Alter ${game.life.age.toFixed(0)}/${phases(game.life.gen).span.toFixed(0)} (${STAGE_NAME[stageOf(game.life.age, game.life.gen)]})  Gen ${game.life.gen}  Nahrung ${game.life.fed.toFixed(0)}/${game.broodBase}  Geschw ${game.run?.siblings?.n ?? 0}\n` +
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

  /**
   * Was zu welcher Zeit geschieht: Die Ereignisse des Zeitalters (Durchzügler, Blüte …) kehren in der Weltzeit immer wieder
   * (alle ep.seconds Sekunden) – für alle Spieler zugleich. Die Jahre stehen oben im Bild (HUD).
   */
  private clock(_time: number) {
    const ph = cyclePhase(this.ep.seconds);
    const last = this.phase;
    this.phase = ph;
    // so viel Weltzeit seit dem letzten Blick (über den Beginn eines neuen Durchgangs hinweg). Mehr als ein paar Sekunden:
    // Das Spiel stand (Rast, Übersicht, anderer Tab) oder die Uhr sprang (Serveruhr) – dann wird nichts nachgeholt.
    const step = (ph - last + 1) % 1;
    const fresh = step * this.ep.seconds < 3;
    // überschritten seit dem letzten Blick
    const passed = (at: number) => fresh && (ph >= last ? at > last && at <= ph : at > last || at <= ph);
    const safe = !!this.place.safe;
    for (const e of this.timeline) {
      if (!passed(e.at)) continue;
      // im sicheren Startgebiet (und im stillen Fluss) tauchen keine Durchzügler auf
      if (e.kind === 'predator' && (safe || (this.L.riverEnd && this.player.x < this.L.riverEnd + 800))) continue;
      this.trigger(e);
    }
    // Immer wieder zieht ein größerer Fisch durchs Bild (nicht im sicheren Startgebiet und nicht im stillen Fluss)
    const out = !safe && (!this.L.riverEnd || this.player.x > this.L.riverEnd + 800);
    if (out && !this.player.dead) {
      if (!this.nextPasser) this.nextPasser = this.time.now + 9000 + Math.random() * 8000;
      else if (this.time.now > this.nextPasser) {
        this.nextPasser = this.time.now + 26000 + Math.random() * 28000;
        if (this.animals.filter((a) => !a.dead && a.visitor).length < 2) this.spawnPasser();
      }
    }
  }

  private trigger(ev: EventDef) {
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
    if (cyclePhase(this.ep.seconds) > 0.55) {
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
    this.cameras.main.setZoom(this.camZoom * (1 + 0.32 * k));
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
    this.cameras.main.setZoom(this.camZoom);
    this.player.shielded = false;
  }

  /** Große Räuber ziehen durch – von der Seite, die weiter weg ist, zur anderen. */
  /** Ein größeres Tier zieht durchs Bild – ohne Ankündigung, es sei denn, es ist ein Riese. */
  private spawnPasser() {
    const pool = this.ep.passers;
    if (!pool?.length) return;
    let x = Math.random() * pool.reduce((n, [, w]) => n + w, 0);
    let id = pool[0][0];
    for (const [i, w] of pool) {
      x -= w;
      if (x <= 0) {
        id = i;
        break;
      }
    }
    const d = SPECIES[id];
    const n = d?.herd ? Math.min(3, 1 + Math.floor(Math.random() * d.herd[1])) : 1;
    this.spawnVisitors(id, n, false, true);
  }

  private spawnVisitors(id: string, count: number, fast = false, ambient = false) {
    const def = SPECIES[id];
    if (!def || !this.authority) return;
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
    else if (!ambient) audio.sfx('rumble');
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
    if (!def || this.bossA || !this.authority) return;
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
  }

  /** Neue Tiere wandern ein, wenn der Lebensraum leerer wird. */
  private migrate(time: number) {
    // ins sichere Startgebiet wandert niemand ein
    if (time < this.nextMigrate || !this.authority || this.place.safe) return;
    this.nextMigrate = time + 15000;
    const resident = this.animals.filter((a) => !a.dead && !a.kin && !a.visitor).length;
    // Auch die Tiere hier ziehen weiter: Manche schwimmen zum Rand und verlassen das Gewässer
    if (Math.random() < 0.55) {
      const p = this.player;
      const goers = this.animals.filter((a) => !a.dead && !a.kin && !a.ally && !a.visitor && !a.boss && !a.leaveDir && a.role !== 'hazard' && a.role !== 'apex'
        && !a.bound && Math.abs(a.x - p.x) > 700 && !a.target);
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

  /**
   * Die Musik hört mit (audio/OceanScore.ts): wie tief du bist und wie nah ein großer Räuber ist – erst recht einer, der
   * dich jagt. Einen Wechsel zu Jagdmusik gibt es nicht: Die Spannung wächst in der Klanglandschaft selbst und vergeht
   * langsam wieder, wenn die Gefahr vorüber ist.
   */
  private huntMood(time: number) {
    const hunter = this.animals.find((a) => !a.dead && a.huntingPlayer && (a.visitor || a.role === 'apex'));
    if (hunter) {
      this.huntLost = 0;
      if (!this.huntMusic) this.huntMusic = time;
    } else if (this.huntMusic) {
      if (!this.huntLost) this.huntLost = time;
      else if (time - this.huntLost > 5000) this.huntMusic = this.huntLost = 0;
    }
    if (time < this.moodAt) return;
    this.moodAt = time + 250;
    const p = this.player, L = this.L;
    const mine = Math.max(1, p.stats.power);
    let threat = this.cine ? 0.55 : 0;
    for (const a of this.animals) {
      if (a.dead || a.kin || a.ally || a.role === 'prey' || a.role === 'hazard') continue;
      const big = a.def.power * a.sz;
      if (!(a.role === 'apex' || a.visitor || a.boss || big >= mine * 1.4)) continue;
      const near = clamp(1 - (Math.hypot(a.x - p.x, a.y - p.y) - 280) / 1200, 0, 1);
      if (!near) continue;
      const chasing = a.huntingPlayer || a.target === p || a.attacking ? 1 : 0.5;
      threat = Math.max(threat, near * clamp(big / (mine * 2), 0.45, 1) * chasing);
    }
    const frac = clamp((p.y - L.surfaceY) / Math.max(300, L.height - L.surfaceY), 0, 1);
    audio.mood({ depth: Math.max(this.deepK, clamp((frac - 0.2) / 0.8, 0, 1) * 0.55), threat });
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
      }
      this.primedUntil = time + 1500;
    }
    p.ambush = time < this.primedUntil;
    if (p.ambush) this.ambushUntil = this.primedUntil;
    // Lebensraum (bestimmt die Körpergröße der Nachkommen): Es zählt, wer sich hier bewegt – bloßes Treiben kaum
    if (!p.dead) this.useHere(dt * (p.resting || p.drifting ? 0.05 : clamp(0.2 + p.speed01, 0.2, 1.2)));
    // In eine Höhle schwimmen: Wer bis ans hintere Ende kommt und wieder herausschwimmt, trägt die Farbe der Höhle
    if (tunnel !== this.curCave) {
      if (tunnel >= 0) {
        this.curCave = tunnel;
        this.caveSide = cx < L.caves[tunnel].x + L.caves[tunnel].w / 2 ? -1 : 1;
        this.caveDeep = false;
      } else {
        const c = L.caves[this.curCave];
        this.curCave = -1;
        if (c && (this.caveDeep || (cx < c.x + c.w / 2 ? -1 : 1) !== this.caveSide)) this.paintCoat(c.coat);
      }
    }
    if (this.curCave >= 0) {
      const c = L.caves[this.curCave];
      const back = c.side > 0 ? c.x : c.x + c.w;
      if (Math.abs(cx - back) < c.w * 0.3) this.caveDeep = true;
    }
    // Wer sich viel versteckt, nimmt die Farben seiner Verstecke an
    // Oben im Licht wird man heller, unten in der Tiefe (bzw. im Schatten) dunkler
    if (this.water) {
      const col = clamp(Math.floor(cx / TILE), 0, L.ground.length - 1);
      const depth = (cy - L.surfaceY) / Math.max(80, L.ground[col] - L.surfaceY);
      if (depth < 0.32) game.shiftLight(0.004 * dt);
      else if (depth > 0.72) game.shiftLight(-0.004 * dt);
      // Wer tief unten überlebt, bekommt starke Nerven (größer wird erst die nächste Generation – siehe useHere)
      const deep = this.deepK * (this.place.kind === 'abyss' ? 1.4 : 1);
      if (deep > 0.05) game.grow('nerve', 0.0008 * dt * deep);
    } else if (p.inCover || p.inCave) game.shiftLight(-0.003 * dt);
    else game.shiftLight(0.0015 * dt);
    // Strecke mit Tempo: zählt für die Platte „Verfolgung“
    if (p.speed01 > 0.7 && !p.bottomWalk) this.train.swim += dt * 0.25 * Math.min(1.5, p.speed01);
    // Bewegung merken: Was in diesem Zeitalter am meisten getan wird, formt bei der Verwandlung die Flossen
    if (this.water && !p.dead && !p.bottomWalk) {
      const v = p.body.velocity, sp = Math.max(1, p.stats.speed);
      if (v.y < -0.3 * sp) this.train.up += dt * Math.min(1.5, -v.y / sp);
      else if (v.y > 0.3 * sp) this.train.down += dt * Math.min(1.5, v.y / sp);
      const ax = Math.abs(v.x) / sp;
      if (ax > 0.45) this.train.fwd += dt * (ax > 1.05 ? 1.6 : 1);
      this.train.turns += p.takeTurns();
    }
    // Überstandene Treffer (schwere zählen mehr): Die Nachkommen bekommen robustere Schuppen
    this.train.hurt += p.takeEndured();
    // Bodenkontakt: Wer sich am Grund abstützt und dort entlangläuft, bekommt kräftige Stützflossen
    // (an Land: Wer viel läuft, statt zu springen, bekommt kräftigere Beine)
    if (p.bottomWalk) game.grow('limb', 0.0045 * dt);
    else if (!this.water && p.speed01 > 0.4 && (p.body.blocked.down || p.body.touching.down)) game.grow('limb', 0.0012 * dt);
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

    // Wer sich wenig oder gar nicht bewegt, kommt langsam wieder zu Kräften – wer sich treiben lässt, am schnellsten. Nicht
    // gleich nach einem Treffer, nicht im Spurt oder Stoß. Fleisch heilt nicht; schneller geht es mit einem Heilkraut.
    const cap = p.stats.maxHp * MISC.restHealCap;
    if (p.hp < cap && !p.sprinting && !p.isRamming && time - p.lastHurt > 2500) {
      const rate = p.resting ? MISC.regenRest : p.speed01 < 0.35 ? MISC.regenSlow : 0;
      if (rate > 0) p.hp = Math.min(cap, p.hp + p.stats.maxHp * rate * p.stats.recover * dt);
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
      bus.emit('vitals', p.hp / p.stats.maxHp, p.hidden);
      // oben: die Weltzeit (für alle gleich, Jahr für Jahr) und darunter die Lebenslinie des eigenen Tiers
      bus.emit('clock', worldYears(this.ep.from, this.ep.to), 1);
      bus.emit('life', game.life.age / phases(game.life.gen).span, stageOf(game.life.age, game.life.gen), !!game.heir());
      const bs = this.bossA;
      if (bs) bus.emit('boss', bs.def.name, bs.dead ? 0 : Math.max(0, bs.hp / bs.maxHp));
    }
  }

  // ---------------------------------------------------------------- Sicht

  /**
   * Was man sieht: Das Blickfeld folgt dem Fisch und schaut, wohin er schwimmt. Tiere im trüben Wasser sind nicht da, weiter
   * heran erscheinen sie als dunkler Umriss, und erst nah im Blick sieht man sie deutlich.
   */
  private sightStep(dt: number) {
    const sg = this.sight;
    if (!sg) return;
    const p = this.player;
    const rot = p.view.rotation;
    // in Szenen mit der Kamera lichtet sich das Wasser (dort soll man sehen, was geschieht)
    sg.update(dt, p.x, p.y, p.facing > 0 ? rot : Math.PI + rot, game.sight, !!this.cine && !this.cine.released);
    for (const a of this.animals) {
      if (a.dead) continue;
      const kin = a instanceof Kin;
      const obj: { setAlpha(v: number): unknown } = kin ? a.view : a;
      // wer gerade ein- oder ausgeblendet wird (Durchzügler, Sterbende), bleibt dabei
      if (this.tweens.isTweening(obj)) continue;
      const c = sg.clarityAt(p.x, p.y, a.x, a.y, Math.min(140, a.displayWidth * 0.35));
      a.vis = c;
      // ganz in der Trübe: nicht zu sehen; dann ein Umriss, der langsam deutlicher wird
      obj.setAlpha(clamp(c / 0.2, 0, 1));
      if (kin) continue;
      const sil = 1 - clamp((c - 0.15) / 0.55, 0, 1);
      if (sil > 0.02) {
        a.setTint(mixColor(0xffffff, 0x14262a, sil));
        a.fogTint = true;
      } else if (a.fogTint) {
        a.clearTint();
        a.fogTint = false;
      }
    }
  }

  /**
   * Herzklopfen: Es schlägt, solange dich ein Tier jagt – oft eines, das man im trüben Wasser gar nicht sieht. Je größer und
   * stärker der Jäger, desto lauter und schneller (ein kleiner Fisch macht kaum Angst), und je näher man dem Tod ist, desto
   * mehr. Am lautesten, wenn man fast tot ist und ein großer Fisch einen jagt.
   */
  private heartStep(time: number) {
    const p = this.player;
    if (p.dead || this.ended || time < this.beatAt) return;
    let fear = 0;
    const mine = Math.max(0.1, this.playerPower());
    for (const a of this.animals) {
      if (a.dead || a.kin || a.ally || a.target !== p) continue;
      if (!(a.st === 'hunt' || a.attacking || a.aggroUntil > time)) continue;
      if (Math.hypot(a.x - p.x, a.y - p.y) > 1500) continue;
      // wie stark der Jäger ist, im Vergleich zu dir: ebenbürtig macht schon Angst, doppelt so stark sehr
      const rel = (a.def.power * a.sz) / mine;
      fear = Math.max(fear, clamp(0.12 + 0.45 * rel, 0.12, 1));
    }
    if (fear <= 0) return;
    const low = 1 - clamp(p.hp / Math.max(1, p.stats.maxHp), 0, 1);
    const k = clamp(fear * (0.5 + 0.5 * low * low + 0.25 * low), 0, 1);
    this.beatAt = time + 980 - 520 * k;
    audio.sfx('heart', k);
    bus.emit('heartbeat', k);
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
      // die Musik nimmt die Tiefe selbst (huntMood) – hier rauscht nur das Meer lauter
      audio.sea(0.08 + 0.14 * k, 0.8);
    }
    if (k > 0.72 && time > this.deepRumbleAt) {
      this.deepRumbleAt = time + 14000 + Math.random() * 16000;
      audio.sfx('rumble');
    }
  }

  // ---------------------------------------------------------------- Ränder, Karte, Muscheln

  /**
   * Links und rechts gibt es keine Wand: Wer über den Rand hinausschwimmt, kommt (über die Karte) in den Nachbarort auf dieser
   * Seite – welcher es ist, entscheidet die Tiefe (siehe edgeNeighbor). Andere Wege gibt es nicht.
   */
  private edgeStep() {
    const p = this.player;
    if (!this.water || this.ended) return;
    const L = this.L;
    const side = p.x < -34 ? 'left' : p.x > L.width + 34 ? 'right' : null;
    if (!side) return;
    const col = clamp(Math.floor(p.x / TILE), 0, L.ground.length - 1);
    const frac = clamp((p.y - L.surfaceY) / Math.max(80, L.ground[col] - L.surfaceY), 0, 1);
    const to = edgeNeighbor(this.ep, this.place, side, frac);
    if (to) this.leave(to.id, { side, frac });
  }

  /**
   * Über den Rand hinaus: Der Stand wird gemerkt, der Weg zwischen den beiden Orten ist ab jetzt bekannt (er erscheint auf der
   * Karte), dann geht es über die Karte weiter – in den Nachbarort oder an einen anderen bekannten Ort.
   */
  private leave(to: string, edge: { side: 'left' | 'right'; frac: number }) {
    if (this.ended) return;
    this.ended = true;
    this.saveProgress();
    // neu: der Ort bzw. der Weg dorthin – die Karte lässt ihn erscheinen
    const newPlace = !game.isKnown(to), newLink = !game.hasLink(this.place.id, to);
    game.discoverLink(this.place.id, to);
    audio.sfx('travel');
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(900, 2, 3, 4);
    this.time.delayedCall(950, () => {
      this.scene.stop('Hud');
      this.scene.start('Map', { epoch: this.epochIdx, from: this.place.id, to, edge, newPlace, newLink });
    });
  }

  /** Der Countdown zum Hauptmenü läuft (nur solange gespielt wird – die Rast hält ihn an). */
  private quitStep(dt: number) {
    if (this.quitLeft < 0) return;
    if (this.ended || this.player.dead) {
      this.quitLeft = -1;
      bus.emit('quitCount', -1);
      return;
    }
    const before = Math.ceil(this.quitLeft);
    this.quitLeft -= dt;
    if (Math.ceil(this.quitLeft) !== before && this.quitLeft > 0) bus.emit('quitCount', Math.max(0, Math.ceil(this.quitLeft)));
    if (this.quitLeft <= 0) this.quitToTitle();
  }

  /** Zum Hauptmenü: Alles wird gemerkt – auch, wo man gerade ist; beim Weiterleben geht es genau dort weiter. */
  private quitToTitle() {
    if (this.ended) return;
    this.ended = true;
    this.quitLeft = -1;
    this.saveProgress();
    game.leavePlace({ resume: { x: Math.round(this.player.x), y: Math.round(this.player.y) } });
    this.player.body.setVelocity(0, 0);
    audio.music(null);
    this.scene.stop('Hud');
    fadeTo(this, 'Title', {}, 900);
  }

  /** Zustand für den nächsten Ort bzw. die Karte festhalten. */
  private saveProgress() {
    const p = this.player;
    // wer von deiner Gruppe bei dir ist, kommt mit – mit der Lebenskraft, die er gerade hat
    this.swarm?.storeAll();
    game.leavePlace({
      hp: p.hp,
      kin: this.animals.filter((a) => a instanceof Kin && !a.dead).length,
      eaten: { meat: this.eatenMeat, plant: this.eatenPlant },
      train: { ...this.train, hab: { ...this.train.hab } },
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
    const n = game.addShell();
    audio.sfx('shell');
    this.puff(sh.x, sh.y - 16, 6, 0xf0dccc);
    this.sparkle.explode(5, sh.x, sh.y - 20);
    bus.emit('shell', n);
    // die Muscheln bleiben dir (über alle Läufe); verteilt werden sie an der großen Muschel
    const free = game.shellsFree;
    bus.emit('notice', 'MUSCHEL GEFUNDEN', game.canUp() ? `${free} frei – genug für einen Segen der großen Muschel` : `${free} frei · der nächste Segen kostet ${game.upCost}`);
  }

  /** Eine Muschel fällt von erlegter Beute: Sie sinkt zu Boden und funkelt. */
  private dropShell(x: number, y: number) {
    const gy = groundAt(this.L.terrain.hp, x);
    if (!Number.isFinite(gy) || gy < y - 20) return;
    this.shells.push(new Shell(this, x, gy - 2, `drop:${++this.dropN}`, y));
    audio.sfx('drop');
    this.sparkle.explode(6, x, y);
  }

  // ---------------------------------------------------------------- die große Muschel

  /** Wer an der großen Muschel die Taste fürs Ansprechen drückt, tritt vor sie: Dort verteilt man seine Muscheln (im HUD). */
  private shrineStep(time: number, dt: number) {
    const sh = this.shrine;
    if (!sh) return;
    const p = this.player;
    const can = !p.dead && !this.ended && !this.cineActive && !this.quest?.near && !this.quest?.busy && time > this.prayUntil && this.quitLeft < 0;
    sh.update(dt, p.x, p.y, can, time);
    if (sh.near !== this.shrineNear) {
      this.shrineNear = sh.near;
      bus.emit('talk', sh.near, 'Beten');
    }
    if (sh.near && (this.controls.pressed.talk || touch.talk)) {
      this.controls.clear();
      p.facing = sh.x >= p.x ? 1 : -1;
      bus.emit('shrineOpen');
    }
  }

  /** Die große Muschel segnet deine Linie – in der Richtung, die du gewählt hast (Lebenskraft, Ausdauer oder Sicht). */
  private bless(k: UpKey) {
    const sh = this.shrine;
    const p = this.player;
    if (!sh || p.dead || this.ended || !game.buyUp(k)) {
      audio.sfx('silent');
      return;
    }
    const time = this.time.now;
    this.prayUntil = time + 3800;
    if (k === 'stam') this.stamHold = time + 2300;
    audio.sfx('pray');
    sh.pray(p.x, p.y, true);
    p.facing = sh.x >= p.x ? 1 : -1;
    // erst strömt das Licht in dein Tier – dann wächst es: der Körper, der Ausdauerkreis oder der Blick
    this.time.delayedCall(2300, () => {
      if (p.dead) return;
      p.blessed(k);
      this.cameras.main.flash(500, 255, 236, 200);
      bus.emit('notice', 'SEGEN DER GROSSEN MUSCHEL', k === 'hp' ? 'Deine Lebenskraft wächst.' : k === 'stam' ? 'Deine Ausdauer wächst.' : 'Dein Blick reicht weiter.');
    });
  }

  // ---------------------------------------------------------------- Ende

  /**
   * Der Lauf des Lebens: Beginnt ein neuer Abschnitt (heranwachsend, ausgewachsen, alt), gibt es eine kurze Meldung;
   * am Ende stirbt das Tier an Altersschwäche.
   */
  private lifeStep() {
    const age = game.life.age, gen = game.life.gen;
    const st = stageOf(age, gen);
    if (st !== this.stage) {
      const was = this.stage;
      this.stage = st;
      // nur die Laichzeit wird gemeldet (leise) – Heranwachsen und Altern merkt man am Tier
      if (st === 'adult' && was === 'heran') bus.emit('notice', 'Ausgewachsen', 'Laichzeit');
      // ein Jungtier wird größer: Werte gleich, Gestalt beim nächsten ruhigen Moment
      this.player.refresh(false, false);
    }
    if (!this.cine && !this.quest?.zooming && !this.hunt?.zooming) this.cameras.main.setZoom(this.camZoom);
    // am Ende wird das Tier spürbar langsamer
    const left = phases(gen).span - age;
    this.player.fade = left < LIFE.fadeSeconds ? LIFE.fadeTo + (1 - LIFE.fadeTo) * clamp(left / LIFE.fadeSeconds, 0, 1) : 1;
    if (!this.oldWarned && left < 60) {
      this.oldWarned = true;
      // nur wenn es darauf ankommt: Ohne befruchtetes Gelege endet hier die Linie (oder ein Geschwister schlüpft)
      if (!game.heir()) bus.emit('notice', 'Das Leben neigt sich dem Ende zu', 'Noch kein befruchtetes Gelege');
    }
    if (diesOfAge(age, gen)) this.passAway('Altersschwäche');
  }

  /** Ein Artgenosse (kein Mitglied deiner Gruppe) – z. B. ein Partner beim Laichen. */
  spawnKinAt(i: number, x: number, y: number): Kin {
    const genes = game.kinTraits(i);
    const d = game.traits.diet;
    const k = new Kin(this, this.kinDef, x, y, game.morph({ traits: genes.traits, fierce: 0, seed: genes.seed, sex: genes.sex }), game.run?.social ?? 0.55);
    k.genes = genes;
    k.omni = d >= -0.3 && d <= 0.3;
    this.animals.push(k);
    return k;
  }

  /**
   * Der Zoom der Kamera (ohne Kino-Momente): Ein Jungtier sieht man näher – mit dem Wachsen zieht die Kamera zurück, bis
   * zum gewohnten Bild beim ausgewachsenen Tier.
   */
  get camZoom() {
    return Z * (1 + GROW_ZOOM * clamp((1 - game.lifeK.grow) / (1 - LIFE.hatch), 0, 1)) * this.near.k;
  }

  /** E gedrückt: Ist Laichzeit und gerade die Gelegenheit, wird gelaicht statt gebissen (Spieler, Player.update). */
  spawnAct() {
    const sp = this.spawning;
    if (!sp || this.ended) return false;
    // ein Weibchen, das gerade vor etwas Fressbarem ist, frisst lieber
    return sp.act(this.foodAhead());
  }

  /** Liegt gerade etwas Fressbares (oder ein Tier) vor dem Maul? */
  foodAhead() {
    const r = this.player.biteRect();
    return this.plants.some((pl) => pl.units > 0 && overlaps(r, pl.rect)) || this.meats.some((m) => !m.gone && overlaps(r, m.rect))
      || this.animals.some((a) => !a.dead && !a.kin && overlaps(r, a.hitRect()));
  }

  /** Ein kurzes Funkeln. */
  glitter(x: number, y: number, n: number) {
    this.sparkle.explode(n, x, y);
  }

  /**
   * Das eigene Tier ist gestorben – nach dem Laichen ist das kein Ende: Aus dem jüngsten befruchteten Gelege schlüpft die
   * nächste Generation. Sie ist an die Spielweise angepasst (keine Wahl) und muss erst heranwachsen. Vor dem Laichen
   * schlüpft ein Geschwister aus dem eigenen Gelege, solange dort noch eines wartet.
   */
  private succession(cause: string, wait: number) {
    if (this.ended) return;
    // ein Männchen, das schon unterwegs war, befruchtet das Gelege noch
    this.spawning?.settle();
    const heir = game.heir();
    if (!heir) return game.run?.siblings?.n ? this.nextSibling(cause, wait) : this.endLine(cause, wait);
    this.ended = true;
    this.train.hurt += this.player.takeEndured();
    this.swarm?.storeAll();
    const h = game.inherit({ meat: this.eatenMeat, plant: this.eatenPlant }, this.train, heir.partner);
    const data: SuccessionData = { epoch: this.epochIdx, cause, gen: game.life.gen, years: worldYears(this.ep.from, this.ep.to) };
    game.succeed(heir, h);
    audio.music(null);
    this.time.delayedCall(wait, () => this.exitTo('Generation', data));
  }

  /** Weiter zur nächsten Szene – ist das Bild schon dunkel (eingeschlafen), ohne erneutes Abblenden. */
  private exitTo(key: string, data: object) {
    this.scene.stop('Hud');
    if (this.dark) this.scene.start(key, data);
    else fadeTo(this, key, data, 1200);
  }

  /**
   * Das Leben endet ohne Gewalt (Altersschwäche, das Leben weitergeben): kein Sturz, kein Laut – das Tier wird still, schließt
   * die Augen und sinkt langsam ab, die Anzeigen treten zurück, das Bild wird dunkel. Danach schlüpft die nächste Generation
   * (bzw. ein Geschwister) – oder die Linie endet.
   */
  private passAway(cause: string) {
    if (this.ended || this.player.dead) return;
    this.player.fallAsleep(cause);
    bus.emit('veil', true);
    audio.music(null);
    const cam = this.cameras.main;
    // die Kamera kommt ganz nah heran: Man sieht, wie die Augen zufallen
    cam.setDeadzone();
    cam.zoomTo(this.camZoom * WAKE_ZOOM, SLEEP_S * 750, Phaser.Math.Easing.Sine.InOut);
    // erst wenn die Augen fast zu sind, wird es dunkel
    this.time.delayedCall(SLEEP_S * 700, () => cam.fadeOut(SLEEP_S * 300 + 1600, 0, 0, 0));
    this.time.delayedCall(SLEEP_S * 1000 + 1600, () => {
      this.dark = true;
      this.succession(cause, 0);
    });
  }

  /** Gestorben, bevor es gelaicht hat: Das nächste Geschwister aus dem Gelege schlüpft – dieselbe Generation. */
  private nextSibling(cause: string, wait: number) {
    this.ended = true;
    this.swarm?.storeAll();
    const data: SuccessionData = { epoch: this.epochIdx, cause, gen: game.life.gen, years: worldYears(this.ep.from, this.ep.to), sibling: true };
    game.sibling();
    audio.music(null);
    this.time.delayedCall(wait, () => this.exitTo('Generation', data));
  }

  /** Das Tier ist tot. Wer ein befruchtetes Gelege hinterlässt, lebt darin weiter – sonst stirbt die Linie aus. */
  private onDeath() {
    if (this.ended) return;
    this.succession(this.player.lastCause, 2600);
  }

  private abort() {
    if (this.ended) return;
    this.endLine('Aufgegeben', 300);
  }

  private endLine(cause: string, wait: number) {
    this.ended = true;
    const years = worldYears(this.ep.from, this.ep.to);
    const frac = clamp((this.ep.from - years) / (this.ep.from - this.ep.to), 0, 1);
    const morph = this.player.morph();
    const leaf = game.extinct(frac, cause);
    audio.music(null);
    this.time.delayedCall(wait, () => this.exitTo('Tree', { mode: 'extinct', leaf, morph, epoch: this.epochIdx, cause, years }));
  }
}
