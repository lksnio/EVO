import type { ClassId } from './classes';

export type EraId = 'ozean' | 'sumpf' | 'reptil' | 'eis' | 'eden';
export type Theme = EraId;

export interface NodeDef {
  id: string;
  name: string;
  desc: string;
  /** Position auf der Weltkarte (1280×720). */
  x: number;
  y: number;
  start?: boolean;
  /** Boss-Gegner dieses Ortes. */
  boss?: string;
  /** Länge in Kacheln. */
  len?: number;
  /** Schwierigkeit 0..1 innerhalb der Ära. */
  diff: number;
  /** Gegner mit Gewichtung. */
  pool?: Record<string, number>;
  cave?: boolean;
  dark?: boolean;
  kelp?: boolean;
  reef?: boolean;
}

export interface EraDef {
  id: EraId;
  name: string;
  sub: string;
  minClass: ClassId;
  maxClass?: ClassId;
  habitat: 'water' | 'land';
  music: string;
  /** Bonus-EVO beim ersten Abschluss eines Ortes. */
  bonus: number;
  /** Wert eines EVO-Kristalls. */
  crystal: number;
  /** Schaden durch Fallen (Dornen, Lava …). */
  hazardDmg: number;
  color: number;
  nodes: NodeDef[];
  edges: [string, string][];
}

export const ERAS: EraDef[] = [
  {
    id: 'ozean',
    name: 'Der Urozean',
    sub: 'vor 500 Millionen Jahren',
    minClass: 'fish',
    maxClass: 'fish',
    habitat: 'water',
    music: 'ozean',
    bonus: 15,
    crystal: 5,
    hazardDmg: 3,
    color: 0x2f8fd0,
    nodes: [
      { id: 'o1', name: 'Seichte Lagune', desc: 'Warmes, helles Wasser. Hier beginnt dein Abenteuer.', x: 190, y: 470, start: true, len: 85, diff: 0, pool: { kleinfisch: 5, qualle: 2, trilobit: 3 } },
      { id: 'o2', name: 'Kelpwald', desc: 'Ein Wald aus Riesentang. Zwischen den Stängeln lauern Ammoniten.', x: 420, y: 360, len: 105, diff: 0.3, kelp: true, pool: { kleinfisch: 4, qualle: 3, trilobit: 2, ammonit: 3 } },
      { id: 'o3', name: 'Korallenriff', desc: 'Bunte Korallen – und hungrige Raubfische.', x: 650, y: 490, len: 115, diff: 0.5, reef: true, pool: { kleinfisch: 3, ammonit: 3, raubfisch: 3, qualle: 2 } },
      { id: 'o4', name: 'Dunkle Tiefe', desc: 'Kaum Licht dringt hier herunter. Seeskorpionen jagen im Dunkeln.', x: 660, y: 220, len: 115, diff: 0.65, dark: true, pool: { seeskorpion: 3, qualle: 3, raubfisch: 2, ammonit: 2 } },
      { id: 'oB', name: 'Höhle des Panzerfischs', desc: 'Der gepanzerte König des Urozeans wartet hier. Besiege ihn, um an Land zu gehen!', x: 960, y: 350, boss: 'panzerfisch', diff: 1 },
    ],
    edges: [['o1', 'o2'], ['o2', 'o3'], ['o2', 'o4'], ['o3', 'oB'], ['o4', 'oB']],
  },
  {
    id: 'sumpf',
    name: 'Urzeitliche Sümpfe',
    sub: 'vor 350 Millionen Jahren',
    minClass: 'amphibian',
    habitat: 'land',
    music: 'sumpf',
    bonus: 30,
    crystal: 10,
    hazardDmg: 6,
    color: 0x5c8a3a,
    nodes: [
      { id: 's1', name: 'Schlammufer', desc: 'Deine ersten Schritte an Land. Vorsicht vor Krötenmolchen!', x: 170, y: 450, start: true, len: 95, diff: 0, pool: { kroete: 3, libelle: 3, tausendfuessler: 2 } },
      { id: 's2', name: 'Farnwald', desc: 'Riesige Farne und Schachtelhalme ragen in den Himmel.', x: 400, y: 290, len: 110, diff: 0.3, pool: { libelle: 3, tausendfuessler: 3, kroete: 2, spucklurch: 1 } },
      { id: 's3', name: 'Insektennest', desc: 'Eine feuchte Höhle voller Riesenskorpione.', x: 560, y: 500, len: 110, diff: 0.5, cave: true, pool: { skorpion: 3, tausendfuessler: 2, libelle: 2 } },
      { id: 's4', name: 'Moorsenke', desc: 'Ein giftiges Moor. Spucklurche zielen auf alles, was sich bewegt.', x: 800, y: 260, len: 120, diff: 0.7, pool: { spucklurch: 3, kroete: 2, skorpion: 2, libelle: 2 } },
      { id: 'sB', name: 'Revier der Riesenlibelle', desc: 'Die Herrscherin der Lüfte. Beiße zu, wenn sie tief fliegt!', x: 1060, y: 400, boss: 'riesenlibelle', diff: 1 },
    ],
    edges: [['s1', 's2'], ['s1', 's3'], ['s2', 's4'], ['s3', 's4'], ['s4', 'sB']],
  },
  {
    id: 'reptil',
    name: 'Zeitalter der Reptilien',
    sub: 'vor 150 Millionen Jahren',
    minClass: 'reptile',
    habitat: 'land',
    music: 'reptil',
    bonus: 50,
    crystal: 16,
    hazardDmg: 12,
    color: 0xd0703a,
    nodes: [
      { id: 'r1', name: 'Farnsteppe', desc: 'Weites Land. Kleine Raptoren jagen im Rudel.', x: 160, y: 420, start: true, len: 105, diff: 0, pool: { raptor: 2, flugsaurier: 2, panzerechse: 2 } },
      { id: 'r2', name: 'Vulkanhänge', desc: 'Heiße Lava fließt zwischen den Felsen. Nicht hineinfallen!', x: 400, y: 240, len: 115, diff: 0.35, pool: { stachelechse: 2, spuckechse: 2, flugsaurier: 2 } },
      { id: 'r3', name: 'Urwald', desc: 'Dichter Dschungel mit Palmfarnen und Spuckechsen.', x: 470, y: 510, len: 115, diff: 0.45, pool: { raptor: 3, spuckechse: 2, panzerechse: 2 } },
      { id: 'r4', name: 'Klippen der Flugsaurier', desc: 'Hoch oben nisten die Flugsaurier.', x: 770, y: 340, len: 125, diff: 0.75, pool: { flugsaurier: 4, raptor: 2, stachelechse: 2 } },
      { id: 'rB', name: 'Reich des Tyrannosaurus', desc: 'Der König der Echsen. Lass ihn gegen die Wand rennen!', x: 1060, y: 430, boss: 'trex', diff: 1 },
    ],
    edges: [['r1', 'r2'], ['r1', 'r3'], ['r2', 'r4'], ['r3', 'r4'], ['r4', 'rB']],
  },
  {
    id: 'eis',
    name: 'Die Eiszeit',
    sub: 'vor 2 Millionen Jahren',
    minClass: 'mammal',
    habitat: 'land',
    music: 'eis',
    bonus: 80,
    crystal: 24,
    hazardDmg: 18,
    color: 0x7fb8e0,
    nodes: [
      { id: 'e1', name: 'Gefrorene Tundra', desc: 'Eisiger Wind und hungrige Wölfe.', x: 180, y: 330, start: true, len: 110, diff: 0, pool: { eiswolf: 3, riesenvogel: 2 } },
      { id: 'e2', name: 'Eishöhle', desc: 'Eine dunkle Höhle – Heimat der Höhlenbären.', x: 400, y: 500, len: 115, diff: 0.4, cave: true, pool: { hoehlenbaer: 2, eiswolf: 3, riesenvogel: 1 } },
      { id: 'e3', name: 'Mammutsteppe', desc: 'Hier ziehen Mammuts und Wollnashörner umher.', x: 560, y: 240, len: 120, diff: 0.5, pool: { mammut: 2, wollnashorn: 2, eiswolf: 2 } },
      { id: 'e4', name: 'Gletscherspalten', desc: 'Tiefe Spalten im Eis und Geier am Himmel.', x: 800, y: 430, len: 125, diff: 0.75, pool: { wollnashorn: 2, riesenvogel: 3, hoehlenbaer: 1, eiswolf: 2 } },
      { id: 'eB', name: 'Höhle des Säbelzahntigers', desc: 'Der schnellste Jäger der Eiszeit. Er springt!', x: 1060, y: 300, boss: 'saebelzahn', diff: 1 },
    ],
    edges: [['e1', 'e2'], ['e1', 'e3'], ['e2', 'e4'], ['e3', 'e4'], ['e4', 'eB']],
  },
  {
    id: 'eden',
    name: 'Der Weg nach Eden',
    sub: 'das Ziel der Evolution',
    minClass: 'mammal',
    habitat: 'land',
    music: 'eden',
    bonus: 120,
    crystal: 32,
    hazardDmg: 22,
    color: 0xf0c050,
    nodes: [
      { id: 'd1', name: 'Lichtwiese', desc: 'Ein Garten voller Blumen. Doch Schatten lauern.', x: 200, y: 430, start: true, len: 110, diff: 0.2, pool: { schatten: 2, kristallkaefer: 3 } },
      { id: 'd2', name: 'Kristallwald', desc: 'Leuchtende Kristalle wachsen wie Bäume.', x: 470, y: 290, len: 120, diff: 0.5, pool: { kristallkaefer: 2, irrlicht: 2, steinwaechter: 2 } },
      { id: 'd3', name: 'Pfad der Prüfung', desc: 'Nur die Stärksten erreichen das Tor.', x: 760, y: 440, len: 130, diff: 0.8, pool: { steinwaechter: 2, schatten: 2, irrlicht: 2, kristallkaefer: 1 } },
      { id: 'dB', name: 'Tor zu Eden', desc: 'Der Kristallwächter bewacht das Paradies. Besiege ihn!', x: 1050, y: 300, boss: 'kristall', diff: 1 },
    ],
    edges: [['d1', 'd2'], ['d2', 'd3'], ['d3', 'dB']],
  },
];

export const eraById = (id: string) => ERAS.find((e) => e.id === id)!;
export const eraIndex = (id: string) => ERAS.findIndex((e) => e.id === id);

export function neighbors(era: EraDef, nodeId: string): string[] {
  const out: string[] = [];
  for (const [a, b] of era.edges) {
    if (a === nodeId) out.push(b);
    else if (b === nodeId) out.push(a);
  }
  return out;
}
