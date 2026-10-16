// Alle Tiere der Urzeit. Jede Art hat eine Rolle im Ökosystem:
//   prey      – frisst Pflanzen, flieht vor Gefahr
//   predator  – jagt, wenn sie hungrig ist und sich überlegen fühlt
//   defender  – friedlich, verteidigt sich aber heftig
//   hazard    – treibt umher, ist nur bei Berührung gefährlich
//   apex      – Spitzenräuber, zieht (als Ereignis) durch den Lebensraum
// "art" beschreibt, wie das Tier gezeichnet wird (siehe art/speciesArt.ts).

export type Role = 'prey' | 'predator' | 'defender' | 'hazard' | 'apex';
export type Habitat = 'water' | 'land' | 'air';

export type Art =
  | { t: 'fish'; len: number; h: number; c: number; belly: number; fin: number; teeth?: boolean; armor?: boolean; jawless?: boolean }
  | { t: 'jelly'; r: number; c: number }
  | { t: 'trilo'; len: number; c: number }
  | { t: 'cone'; len: number; c: number }
  | {
      t: 'bug'; len: number; h: number; segs: number; c: number; legs: number;
      pincers?: boolean; stinger?: 'up' | 'straight'; antenna?: boolean; paddles?: boolean;
    }
  | { t: 'dragonfly'; len: number; c: number }
  | {
      t: 'quad'; len: number; bh: number; leg: number; head: number; headH: number; tail: number; tailW?: number;
      c: number; belly: number; biped?: boolean; sprawl?: boolean; stripes?: boolean; spots?: boolean; plates?: boolean;
      spikes?: boolean; club?: boolean; frill?: boolean; crest?: boolean; horn?: 'rhino'; fangs?: boolean; sabre?: boolean;
      tusks?: boolean; trunk?: boolean; ears?: 'pointy' | 'round' | 'long'; fur?: boolean; arms?: boolean; antlers?: boolean;
      beak?: boolean; claws?: boolean; mane?: boolean; hump?: boolean;
    }
  | { t: 'bird'; span: number; c: number; belly: number; ptero?: boolean; crest?: boolean };

export interface SpeciesDef {
  id: string;
  name: string;
  art: Art;
  role: Role;
  diet: 'plant' | 'meat' | 'none';
  habitat: Habitat;
  hp: number;
  /** Bissschaden */
  dmg: number;
  /** Stärke: Damit vergleichen Tiere sich untereinander und mit dir. */
  power: number;
  speed: number;
  /** Wahrnehmung in Pixeln */
  sense: number;
  /** Fleischportionen, wenn das Tier stirbt */
  meat: number;
  /** Gruppengröße */
  herd?: [number, number];
  /** Tempo-Faktor auf der Flucht */
  sprint?: number;
  /** Bewegt sich am Boden (Wasser: krabbelt) */
  crawl?: boolean;
  hit?: [number, number];
  boss?: boolean;
}

const S = (d: SpeciesDef) => d;

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(
  [
    // ---------------------------------------------------------------- Urozean
    S({ id: 'kieferlos', name: 'Kieferloser Fisch', art: { t: 'fish', len: 34, h: 13, c: 0x6e7a6c, belly: 0xb8bca4, fin: 0x4e5a50, jawless: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.5, speed: 95, sense: 230, meat: 2, herd: [3, 5], sprint: 1.7 }),
    S({ id: 'trilobit', name: 'Trilobit', art: { t: 'trilo', len: 34, c: 0x5e4c38 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.2, speed: 34, sense: 120, meat: 2, herd: [1, 3], crawl: true, sprint: 1.4 }),
    S({ id: 'qualle', name: 'Qualle', art: { t: 'jelly', r: 16, c: 0x7a5a96 }, role: 'hazard', diet: 'none', habitat: 'water', hp: 5, dmg: 4, power: 2, speed: 24, sense: 0, meat: 1, hit: [0.7, 0.7] }),
    S({ id: 'orthoceras', name: 'Orthoceras', art: { t: 'cone', len: 74, c: 0x7a6248 }, role: 'predator', diet: 'meat', habitat: 'water', hp: 22, dmg: 5, power: 6, speed: 118, sense: 300, meat: 3, hit: [0.75, 0.6] }),
    S({ id: 'cameroceras', name: 'Riesenkopffüßer', art: { t: 'cone', len: 250, c: 0x5e4a3a }, role: 'apex', diet: 'meat', habitat: 'water', hp: 140, dmg: 8, power: 18, speed: 82, sense: 380, meat: 8, boss: true, hit: [0.75, 0.5] }),
    S({ id: 'seeskorpion', name: 'Seeskorpion', art: { t: 'bug', len: 72, h: 18, segs: 8, c: 0x4e3228, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, role: 'predator', diet: 'meat', habitat: 'water', hp: 30, dmg: 6, power: 8, speed: 104, sense: 260, meat: 4 }),
    S({ id: 'dunkleosteus', name: 'Panzerfisch', art: { t: 'fish', len: 230, h: 100, c: 0x39444a, belly: 0x7e8a86, fin: 0x252c32, armor: true, teeth: true }, role: 'apex', diet: 'meat', habitat: 'water', hp: 170, dmg: 9, power: 22, speed: 100, sense: 430, meat: 10, boss: true, hit: [0.8, 0.7] }),

    // ---------------------------------------------------------------- Sümpfe
    S({ id: 'tausendfuessler', name: 'Tausendfüßler', art: { t: 'bug', len: 72, h: 14, segs: 11, c: 0x3e2c20, legs: 10, antenna: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 10, dmg: 0, power: 2, speed: 48, sense: 140, meat: 2, herd: [1, 2], sprint: 1.3 }),
    S({ id: 'libelle', name: 'Libelle', art: { t: 'dragonfly', len: 46, c: 0x2a5a5a }, role: 'prey', diet: 'plant', habitat: 'air', hp: 4, dmg: 0, power: 1, speed: 110, sense: 200, meat: 1, herd: [1, 3], sprint: 1.5, hit: [0.7, 0.5] }),
    S({ id: 'kleinlurch', name: 'Kleiner Lurch', art: { t: 'quad', len: 30, bh: 12, leg: 8, head: 15, headH: 9, tail: 26, c: 0x4e5034, belly: 0x989470, sprawl: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 9, dmg: 0, power: 2, speed: 82, sense: 200, meat: 2, herd: [2, 4], sprint: 1.5 }),
    S({ id: 'skorpion', name: 'Riesenskorpion', art: { t: 'bug', len: 64, h: 18, segs: 6, c: 0x2a201c, legs: 4, pincers: true, stinger: 'up' }, role: 'predator', diet: 'meat', habitat: 'land', hp: 34, dmg: 8, power: 10, speed: 84, sense: 240, meat: 3 }),
    S({ id: 'eryops', name: 'Eryops', art: { t: 'quad', len: 72, bh: 22, leg: 14, head: 42, headH: 18, tail: 52, c: 0x363c2a, belly: 0x6e6e52, sprawl: true, fangs: true, spots: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 52, dmg: 10, power: 13, speed: 72, sense: 260, meat: 5, hit: [0.7, 0.8] }),
    S({ id: 'meganeura', name: 'Riesenlibelle', art: { t: 'dragonfly', len: 240, c: 0x1c4040 }, role: 'apex', diet: 'meat', habitat: 'air', hp: 240, dmg: 13, power: 30, speed: 130, sense: 480, meat: 6, boss: true, hit: [0.6, 0.45] }),

    // ---------------------------------------------------------------- Reptilien
    S({ id: 'kleinechse', name: 'Kleine Echse', art: { t: 'quad', len: 28, bh: 10, leg: 9, head: 15, headH: 8, tail: 36, c: 0x5e5a34, belly: 0xa49a70, sprawl: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 10, dmg: 0, power: 2, speed: 120, sense: 220, meat: 2, herd: [1, 3], sprint: 1.6 }),
    S({ id: 'ornithopode', name: 'Kleiner Pflanzenfresser', art: { t: 'quad', len: 40, bh: 22, leg: 34, head: 22, headH: 13, tail: 46, c: 0x6a5a3e, belly: 0xb4a482, biped: true, stripes: true, arms: true, beak: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 30, dmg: 0, power: 4, speed: 140, sense: 300, meat: 4, herd: [3, 5], sprint: 1.5, hit: [0.55, 0.8] }),
    S({ id: 'ankylosaurus', name: 'Panzerechse', art: { t: 'quad', len: 84, bh: 30, leg: 16, head: 22, headH: 16, tail: 52, c: 0x4e4636, belly: 0x8a7c60, plates: true, club: true }, role: 'defender', diet: 'plant', habitat: 'land', hp: 130, dmg: 16, power: 18, speed: 46, sense: 200, meat: 8, hit: [0.7, 0.8] }),
    S({ id: 'raptor', name: 'Raptor', art: { t: 'quad', len: 40, bh: 20, leg: 32, head: 26, headH: 13, tail: 48, c: 0x40402c, belly: 0x948c6a, biped: true, stripes: true, arms: true, fangs: true, crest: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 45, dmg: 12, power: 15, speed: 175, sense: 340, meat: 4, herd: [2, 3], hit: [0.55, 0.8] }),
    S({ id: 'flugsaurier', name: 'Flugsaurier', art: { t: 'bird', span: 124, c: 0x5a4434, belly: 0xa08a6a, ptero: true, crest: true }, role: 'predator', diet: 'meat', habitat: 'air', hp: 35, dmg: 10, power: 12, speed: 120, sense: 360, meat: 3, hit: [0.5, 0.6] }),
    S({ id: 'trex', name: 'Tyrannosaurus', art: { t: 'quad', len: 150, bh: 80, leg: 92, head: 92, headH: 52, tail: 160, tailW: 50, c: 0x3e3e2a, belly: 0x847c5c, biped: true, stripes: true, arms: true, fangs: true }, role: 'apex', diet: 'meat', habitat: 'land', hp: 520, dmg: 26, power: 55, speed: 96, sense: 480, meat: 14, boss: true, hit: [0.5, 0.8] }),

    // ---------------------------------------------------------------- Eiszeit
    S({ id: 'schneehase', name: 'Schneehase', art: { t: 'quad', len: 24, bh: 16, leg: 12, head: 14, headH: 12, tail: 6, c: 0xc8c6bc, belly: 0xe8e6dc, ears: 'long', fur: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 10, dmg: 0, power: 2, speed: 170, sense: 300, meat: 2, herd: [1, 3], sprint: 1.7 }),
    S({ id: 'riesenhirsch', name: 'Riesenhirsch', art: { t: 'quad', len: 64, bh: 30, leg: 46, head: 26, headH: 16, tail: 8, c: 0x5a4430, belly: 0x9e8264, antlers: true, ears: 'pointy', mane: true }, role: 'prey', diet: 'plant', habitat: 'land', hp: 70, dmg: 12, power: 8, speed: 170, sense: 360, meat: 7, herd: [2, 4], sprint: 1.4, hit: [0.6, 0.85] }),
    S({ id: 'mammut', name: 'Mammut', art: { t: 'quad', len: 96, bh: 60, leg: 36, head: 42, headH: 42, tail: 14, c: 0x4e3424, belly: 0x6e4c34, fur: true, tusks: true, trunk: true, ears: 'round', hump: true }, role: 'defender', diet: 'plant', habitat: 'land', hp: 260, dmg: 30, power: 35, speed: 52, sense: 220, meat: 14, hit: [0.7, 0.85] }),
    S({ id: 'eiswolf', name: 'Eiswolf', art: { t: 'quad', len: 52, bh: 24, leg: 28, head: 28, headH: 18, tail: 32, c: 0x76787e, belly: 0xb4b6b8, fur: true, ears: 'pointy', fangs: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 70, dmg: 18, power: 20, speed: 195, sense: 380, meat: 5, herd: [2, 3], hit: [0.65, 0.8] }),
    S({ id: 'hoehlenbaer', name: 'Höhlenbär', art: { t: 'quad', len: 74, bh: 44, leg: 28, head: 30, headH: 26, tail: 8, c: 0x3e2c20, belly: 0x5e4634, fur: true, ears: 'round', hump: true, claws: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 140, dmg: 26, power: 30, speed: 92, sense: 260, meat: 10, hit: [0.75, 0.85] }),
    S({ id: 'saebelzahn', name: 'Säbelzahnkatze', art: { t: 'quad', len: 150, bh: 64, leg: 66, head: 70, headH: 46, tail: 50, c: 0x86603a, belly: 0xc8ac84, sabre: true, ears: 'round', spots: true, fur: true }, role: 'apex', diet: 'meat', habitat: 'land', hp: 820, dmg: 36, power: 70, speed: 160, sense: 480, meat: 16, boss: true, hit: [0.65, 0.8] }),

    // ---------------------------------------------------------------- Eden
    S({ id: 'urpferd', name: 'Urpferd', art: { t: 'quad', len: 48, bh: 24, leg: 36, head: 26, headH: 15, tail: 20, c: 0x6a4c32, belly: 0xb09070, stripes: true, mane: true, ears: 'pointy' }, role: 'prey', diet: 'plant', habitat: 'land', hp: 50, dmg: 0, power: 8, speed: 182, sense: 340, meat: 6, herd: [3, 5], sprint: 1.5, hit: [0.6, 0.85] }),
    S({ id: 'riesenfaultier', name: 'Riesenfaultier', art: { t: 'quad', len: 82, bh: 52, leg: 30, head: 26, headH: 22, tail: 22, c: 0x4e4234, belly: 0x7a6c5a, fur: true, claws: true, hump: true, ears: 'round' }, role: 'defender', diet: 'plant', habitat: 'land', hp: 300, dmg: 34, power: 35, speed: 46, sense: 220, meat: 14, hit: [0.7, 0.85] }),
    S({ id: 'terrorvogel', name: 'Terrorvogel', art: { t: 'quad', len: 34, bh: 30, leg: 48, head: 36, headH: 26, tail: 24, c: 0x34302c, belly: 0x6e6254, biped: true, beak: true, crest: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 110, dmg: 30, power: 32, speed: 200, sense: 380, meat: 6, hit: [0.55, 0.85] }),
    S({ id: 'hyaenodon', name: 'Hyaenodon', art: { t: 'quad', len: 56, bh: 26, leg: 28, head: 34, headH: 18, tail: 30, c: 0x4e4234, belly: 0x8a7a64, fangs: true, ears: 'pointy', spots: true, fur: true }, role: 'predator', diet: 'meat', habitat: 'land', hp: 100, dmg: 26, power: 28, speed: 180, sense: 360, meat: 6, herd: [1, 2], hit: [0.65, 0.8] }),
    S({ id: 'andrewsarchus', name: 'Der Alte', art: { t: 'quad', len: 170, bh: 80, leg: 70, head: 112, headH: 64, tail: 50, c: 0x2a2420, belly: 0x544638, fangs: true, fur: true, ears: 'pointy', hump: true }, role: 'apex', diet: 'meat', habitat: 'land', hp: 1100, dmg: 44, power: 90, speed: 140, sense: 520, meat: 20, boss: true, hit: [0.6, 0.8] }),
  ].map((d) => [d.id, d]),
);
