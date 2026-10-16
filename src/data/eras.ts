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
  /** Spitzenräuber, der hier sein Revier hat. */
  boss?: string;
  /** Länge in Kacheln. */
  len?: number;
  /** Tiere: Art und Anzahl der Gruppen. */
  fauna: [string, number][];
  /** Wie viele fressbare Pflanzen (0..1). */
  plants: number;
  /** Wie viel dichtes Gestrüpp zum Verstecken (0..1). */
  cover: number;
  cave?: boolean;
  dark?: boolean;
  kelp?: boolean;
  reef?: boolean;
}

export interface EraDef {
  id: EraId;
  name: string;
  sub: string;
  /** Die Körperform, die in diesem Zeitalter lebt. */
  cls: ClassId;
  habitat: 'water' | 'land';
  music: string;
  /** Schaden durch Fallen und Stürze. */
  hazardDmg: number;
  color: number;
  nodes: NodeDef[];
  edges: [string, string][];
}

export const ERAS: EraDef[] = [
  {
    id: 'ozean',
    name: 'Der Urozean',
    sub: 'vor 450 Millionen Jahren',
    cls: 'fish',
    habitat: 'water',
    music: 'ozean',
    hazardDmg: 3,
    color: 0x2a5a66,
    nodes: [
      { id: 'o1', name: 'Seichte Lagune', desc: 'Lauwarmes, trübes Wasser. Hier bist du geschlüpft.', x: 190, y: 470, start: true, len: 85, plants: 0.85, cover: 0.45, fauna: [['kieferlos', 3], ['trilobit', 3], ['qualle', 1], ['orthoceras', 1]] },
      { id: 'o2', name: 'Kelpwald', desc: 'Ein Wald aus Riesentang. Was sich darin verbirgt, sieht man kaum.', x: 420, y: 360, len: 105, plants: 0.6, cover: 0.95, kelp: true, fauna: [['kieferlos', 3], ['trilobit', 2], ['qualle', 2], ['orthoceras', 2]] },
      { id: 'o3', name: 'Schwammriff', desc: 'Ein Riff voller Leben – und voller Jäger.', x: 650, y: 490, len: 110, plants: 0.7, cover: 0.5, reef: true, fauna: [['kieferlos', 4], ['trilobit', 2], ['orthoceras', 2], ['seeskorpion', 1]] },
      { id: 'o4', name: 'Dunkle Tiefe', desc: 'Kaum ein Lichtstrahl erreicht diesen Grund.', x: 660, y: 220, len: 110, plants: 0.3, cover: 0.3, dark: true, fauna: [['trilobit', 2], ['qualle', 3], ['seeskorpion', 2], ['orthoceras', 1]] },
      { id: 'oB', name: 'Die Panzerschlucht', desc: 'Etwas Großes zieht hier seine Kreise.', x: 960, y: 350, boss: 'dunkleosteus', len: 80, plants: 0.5, cover: 0.6, fauna: [['kieferlos', 3], ['trilobit', 2]] },
    ],
    edges: [['o1', 'o2'], ['o2', 'o3'], ['o2', 'o4'], ['o3', 'oB'], ['o4', 'oB']],
  },
  {
    id: 'sumpf',
    name: 'Urzeitliche Sümpfe',
    sub: 'vor 350 Millionen Jahren',
    cls: 'amphibian',
    habitat: 'land',
    music: 'sumpf',
    hazardDmg: 6,
    color: 0x3e4a2a,
    nodes: [
      { id: 's1', name: 'Schlammufer', desc: 'Der Boden schmatzt unter jedem Schritt.', x: 170, y: 450, start: true, len: 95, plants: 0.85, cover: 0.5, fauna: [['kleinlurch', 3], ['tausendfuessler', 2], ['libelle', 2], ['skorpion', 1]] },
      { id: 's2', name: 'Farnwald', desc: 'Riesige Farne verschlucken das Licht.', x: 400, y: 290, len: 110, plants: 0.7, cover: 0.85, fauna: [['libelle', 3], ['tausendfuessler', 3], ['kleinlurch', 2], ['eryops', 1], ['skorpion', 1]] },
      { id: 's3', name: 'Insektennest', desc: 'Eine feuchte Höhle. Es raschelt überall.', x: 560, y: 500, len: 105, plants: 0.4, cover: 0.3, cave: true, fauna: [['tausendfuessler', 2], ['skorpion', 3]] },
      { id: 's4', name: 'Moorsenke', desc: 'Nebel liegt über dem schwarzen Wasser.', x: 800, y: 260, len: 115, plants: 0.6, cover: 0.6, fauna: [['kleinlurch', 3], ['eryops', 2], ['libelle', 2], ['skorpion', 1]] },
      { id: 'sB', name: 'Das Summen', desc: 'Ein tiefes Brummen erfüllt die Luft.', x: 1060, y: 400, boss: 'meganeura', len: 85, plants: 0.6, cover: 0.75, fauna: [['libelle', 3], ['kleinlurch', 2]] },
    ],
    edges: [['s1', 's2'], ['s1', 's3'], ['s2', 's4'], ['s3', 's4'], ['s4', 'sB']],
  },
  {
    id: 'reptil',
    name: 'Zeitalter der Echsen',
    sub: 'vor 150 Millionen Jahren',
    cls: 'reptile',
    habitat: 'land',
    music: 'reptil',
    hazardDmg: 12,
    color: 0x6a3420,
    nodes: [
      { id: 'r1', name: 'Farnsteppe', desc: 'Weites Land. Kein Ort, um sich zu verstecken – fast.', x: 160, y: 420, start: true, len: 105, plants: 0.8, cover: 0.55, fauna: [['ornithopode', 2], ['kleinechse', 3], ['raptor', 1]] },
      { id: 'r2', name: 'Vulkanhänge', desc: 'Die Erde ist heiß. Asche fällt wie Schnee.', x: 400, y: 240, len: 110, plants: 0.45, cover: 0.3, fauna: [['kleinechse', 3], ['flugsaurier', 2], ['ankylosaurus', 1]] },
      { id: 'r3', name: 'Urwald', desc: 'Dichtes Grün, dumpfe Schritte in der Ferne.', x: 470, y: 510, len: 115, plants: 0.7, cover: 0.9, fauna: [['ornithopode', 2], ['kleinechse', 2], ['raptor', 2], ['ankylosaurus', 1]] },
      { id: 'r4', name: 'Hohe Klippen', desc: 'Schatten kreisen über den Felsen.', x: 770, y: 340, len: 120, plants: 0.5, cover: 0.4, fauna: [['flugsaurier', 3], ['kleinechse', 2], ['ornithopode', 1], ['raptor', 1]] },
      { id: 'rB', name: 'Das Beben', desc: 'Der Boden zittert in regelmäßigen Abständen.', x: 1060, y: 430, boss: 'trex', len: 90, plants: 0.6, cover: 0.7, fauna: [['ornithopode', 2], ['ankylosaurus', 1]] },
    ],
    edges: [['r1', 'r2'], ['r1', 'r3'], ['r2', 'r4'], ['r3', 'r4'], ['r4', 'rB']],
  },
  {
    id: 'eis',
    name: 'Die Eiszeit',
    sub: 'vor 2 Millionen Jahren',
    cls: 'mammal',
    habitat: 'land',
    music: 'eis',
    hazardDmg: 18,
    color: 0x3a5a76,
    nodes: [
      { id: 'e1', name: 'Gefrorene Tundra', desc: 'Eisiger Wind. Spuren im Schnee.', x: 180, y: 330, start: true, len: 105, plants: 0.6, cover: 0.5, fauna: [['schneehase', 3], ['riesenhirsch', 1], ['eiswolf', 1]] },
      { id: 'e2', name: 'Eishöhle', desc: 'Dunkel und still. Zu still.', x: 400, y: 500, len: 105, plants: 0.3, cover: 0.3, cave: true, fauna: [['hoehlenbaer', 1], ['schneehase', 2], ['eiswolf', 1]] },
      { id: 'e3', name: 'Mammutsteppe', desc: 'Riesen ziehen durch das Grasland.', x: 560, y: 240, len: 115, plants: 0.75, cover: 0.4, fauna: [['mammut', 2], ['riesenhirsch', 2], ['schneehase', 2], ['eiswolf', 1]] },
      { id: 'e4', name: 'Gletscherspalten', desc: 'Ein falscher Schritt, und das Eis verschluckt dich.', x: 800, y: 430, len: 120, plants: 0.45, cover: 0.5, fauna: [['eiswolf', 2], ['schneehase', 2], ['riesenhirsch', 1], ['hoehlenbaer', 1]] },
      { id: 'eB', name: 'Die Zahnhöhle', desc: 'Knochen liegen vor dem Eingang.', x: 1060, y: 300, boss: 'saebelzahn', len: 90, plants: 0.5, cover: 0.7, fauna: [['riesenhirsch', 2], ['schneehase', 2]] },
    ],
    edges: [['e1', 'e2'], ['e1', 'e3'], ['e2', 'e4'], ['e3', 'e4'], ['e4', 'eB']],
  },
  {
    id: 'eden',
    name: 'Der Weg nach Eden',
    sub: 'das Ende der langen Reise',
    cls: 'mammal',
    habitat: 'land',
    music: 'eden',
    hazardDmg: 22,
    color: 0x6a5a2a,
    nodes: [
      { id: 'd1', name: 'Dämmerwiese', desc: 'Warmes Licht – zum ersten Mal seit Langem.', x: 200, y: 430, start: true, len: 110, plants: 0.85, cover: 0.6, fauna: [['urpferd', 3], ['hyaenodon', 1]] },
      { id: 'd2', name: 'Uralter Wald', desc: 'Bäume, älter als jede Erinnerung.', x: 470, y: 290, len: 120, plants: 0.7, cover: 0.9, fauna: [['urpferd', 2], ['riesenfaultier', 1], ['terrorvogel', 1], ['hyaenodon', 1]] },
      { id: 'd3', name: 'Pfad der Knochen', desc: 'Viele sind hier gescheitert.', x: 760, y: 440, len: 125, plants: 0.5, cover: 0.6, fauna: [['terrorvogel', 2], ['hyaenodon', 2], ['urpferd', 2], ['riesenfaultier', 1]] },
      { id: 'dB', name: 'Das Tor', desc: 'Dahinter liegt Eden. Etwas wacht davor.', x: 1050, y: 300, boss: 'andrewsarchus', len: 95, plants: 0.6, cover: 0.7, fauna: [['urpferd', 2]] },
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
