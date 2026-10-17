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
  | {
      t: 'fish'; len: number; h: number; c: number; belly: number; fin: number; teeth?: boolean; armor?: boolean; jawless?: boolean;
      /** Hai: spitze Schnauze, ungleiche Schwanzflosse, Flossenstachel */
      shark?: boolean;
      /** Kopfschild wie ein Hufeisen (Cephalaspis) */
      shield?: boolean;
      /** gepanzerte Ruderarme (Bothriolepis) */
      arms?: boolean;
      /** Stachelreihe auf dem Rücken */
      spines?: boolean;
      /** Augen ganz vorn (Sacabambaspis) */
      eyesFront?: boolean;
      /** Muster */
      spots?: boolean;
      stripes?: boolean;
    }
  | { t: 'jelly'; r: number; c: number }
  | { t: 'trilo'; len: number; c: number }
  | { t: 'cone'; len: number; c: number }
  | {
      t: 'bug'; len: number; h: number; segs: number; c: number; legs: number;
      pincers?: boolean; stinger?: 'up' | 'straight'; antenna?: boolean; paddles?: boolean;
    };

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
  /** streift weit umher statt in der Nähe seines Reviers zu bleiben */
  roam?: boolean;
}

const S = (d: SpeciesDef) => d;

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(
  [
    // ---------------------------------------------------------------- Urozean
    S({ id: 'kieferlos', name: 'Kieferloser Fisch', art: { t: 'fish', len: 34, h: 13, c: 0x6e7a6c, belly: 0xb8bca4, fin: 0x4e5a50, jawless: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.5, speed: 95, sense: 230, meat: 2, herd: [3, 5], sprint: 1.7 }),
    // weitere Fische ihrer Zeit
    S({ id: 'sacabambaspis', name: 'Sacabambaspis', art: { t: 'fish', len: 40, h: 16, c: 0x7a6a50, belly: 0xc8b890, fin: 0x5a4c38, jawless: true, armor: true, eyesFront: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.6, speed: 72, sense: 200, meat: 2, herd: [2, 4], sprint: 1.5 }),
    S({ id: 'birkenia', name: 'Birkenia', art: { t: 'fish', len: 26, h: 8, c: 0x4e6262, belly: 0xb0bca8, fin: 0x34443e, jawless: true, spines: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 4, dmg: 0, power: 1, speed: 125, sense: 240, meat: 1, herd: [5, 8], sprint: 1.8 }),
    S({ id: 'cephalaspis', name: 'Cephalaspis', art: { t: 'fish', len: 46, h: 13, c: 0x6a5c44, belly: 0xa89c78, fin: 0x4a4030, jawless: true, shield: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 10, dmg: 0, power: 2, speed: 62, sense: 180, meat: 2, herd: [1, 3], sprint: 1.4 }),
    S({ id: 'bothriolepis', name: 'Bothriolepis', art: { t: 'fish', len: 50, h: 22, c: 0x6e6650, belly: 0xb8ae8c, fin: 0x4e4836, armor: true, arms: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 16, dmg: 0, power: 3, speed: 56, sense: 200, meat: 3, herd: [2, 4], sprint: 1.4 }),
    S({ id: 'cladoselache', name: 'Cladoselache', art: { t: 'fish', len: 112, h: 30, c: 0x46525c, belly: 0xc4ccc8, fin: 0x323c44, shark: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 45, dmg: 8, power: 11, speed: 145, sense: 320, meat: 5, roam: true, hit: [0.8, 0.6] }),
    S({ id: 'trilobit', name: 'Trilobit', art: { t: 'trilo', len: 34, c: 0x5e4c38 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.2, speed: 34, sense: 120, meat: 2, herd: [1, 3], crawl: true, sprint: 1.4 }),
    S({ id: 'qualle', name: 'Qualle', art: { t: 'jelly', r: 16, c: 0x7a5a96 }, role: 'hazard', diet: 'none', habitat: 'water', hp: 5, dmg: 4, power: 2, speed: 24, sense: 0, meat: 1, hit: [0.7, 0.7] }),
    S({ id: 'orthoceras', name: 'Orthoceras', art: { t: 'cone', len: 74, c: 0x7a6248 }, role: 'predator', diet: 'meat', habitat: 'water', hp: 22, dmg: 5, power: 6, speed: 118, sense: 300, meat: 3, hit: [0.75, 0.6] }),
    S({ id: 'cameroceras', name: 'Riesenkopffüßer', art: { t: 'cone', len: 250, c: 0x5e4a3a }, role: 'apex', diet: 'meat', habitat: 'water', hp: 140, dmg: 8, power: 18, speed: 82, sense: 380, meat: 8, boss: true, hit: [0.75, 0.5] }),
    S({ id: 'seeskorpion', name: 'Seeskorpion', art: { t: 'bug', len: 72, h: 18, segs: 8, c: 0x4e3228, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, role: 'predator', diet: 'meat', habitat: 'water', hp: 30, dmg: 6, power: 8, speed: 104, sense: 260, meat: 4 }),
    // Dunkleosteus (Devon, ~380 Mio. Jahre): bis zu 8 m, gepanzert, statt Zähnen Knochenklingen – gewaltige Bisskraft
    S({ id: 'dunkleosteus', name: 'Dunkleosteus', art: { t: 'fish', len: 250, h: 108, c: 0x39444a, belly: 0x7e8a86, fin: 0x252c32, armor: true, teeth: true }, role: 'apex', diet: 'meat', habitat: 'water', hp: 220, dmg: 16, power: 28, speed: 105, sense: 430, meat: 12, boss: true, hit: [0.8, 0.7] }),
    // seltene große Herumtreiber: am Anfang besser meiden – oder mit viel Geschick besiegen
    S({ id: 'megalograptus', name: 'Megalograptus', art: { t: 'bug', len: 120, h: 26, segs: 9, c: 0x5a3a26, legs: 4, pincers: false, paddles: true, stinger: 'straight' }, role: 'predator', diet: 'meat', habitat: 'water', hp: 60, dmg: 9, power: 12, speed: 112, sense: 300, meat: 5, roam: true, hit: [0.8, 0.6] }),
    S({ id: 'pterygotus', name: 'Pterygotus', art: { t: 'bug', len: 210, h: 46, segs: 10, c: 0x4a2c1e, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, role: 'apex', diet: 'meat', habitat: 'water', hp: 150, dmg: 11, power: 20, speed: 118, sense: 380, meat: 8, boss: true, roam: true, hit: [0.8, 0.6] }),
    S({ id: 'hyneria', name: 'Hyneria', art: { t: 'fish', len: 210, h: 66, c: 0x4a4a30, belly: 0x9a9268, fin: 0x34341e, teeth: true }, role: 'apex', diet: 'meat', habitat: 'water', hp: 180, dmg: 12, power: 24, speed: 112, sense: 400, meat: 10, boss: true, roam: true, hit: [0.8, 0.65] }),
  ].map((d) => [d.id, d]),
);
