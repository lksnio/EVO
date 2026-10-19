// Alle Tiere der Urzeit. Jede Art hat eine Rolle im Ökosystem:
//   prey      – frisst Pflanzen, flieht vor Gefahr
//   predator  – jagt, wenn sie hungrig ist und sich überlegen fühlt
//   defender  – friedlich, verteidigt sich aber heftig
//   hazard    – treibt umher, ist nur bei Berührung gefährlich
//   apex      – Spitzenräuber, zieht (als Ereignis) durch den Lebensraum
// "art" beschreibt, wie das Tier gezeichnet wird (siehe art/speciesArt.ts).

import type { PlaceKind } from './world';

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
      /** kräftige Flossenstacheln (Cheiracanthus, ein "Stachelhai") */
      spiny?: boolean;
      /** langer, spitzer Schnauzenfortsatz aus Knochen (Rolfosteus); Länge in Bruchteilen der halben Körperlänge */
      snout?: number;
      /** Fleischflosser: fleischige Flossenstiele, zwei Rückenflossen, spitz auslaufender Schwanz (Eusthenopteron) */
      lobed?: boolean;
      /** aalartig: lang, dünn, durchgehender Flossensaum (Jamoytius, Conodont) */
      eel?: boolean;
      /** Hai mit "Amboss" auf dem Rücken (Stethacanthus) */
      anvil?: boolean;
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
  /** Tempo bei Angriffen (Ausholen, Zustoßen, Ansturm) – ohne Angabe wie speed */
  atkSpeed?: number;
  /** so viel Nahrung gibt ein erlegtes Tier dieser Art (bei Größe 1) – ohne Angabe nach seiner Lebenskraft (meatOf) */
  food?: number;
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
  /** Wasserschicht, in der die Art lebt: Boden, mittlere Schichten oder offenes Wasser (sonst überall) */
  layer?: 'floor' | 'mid' | 'open';
  /** wo die Art häufiger bzw. seltener vorkommt (Faktor je Art des Ortes) */
  where?: Partial<Record<PlaceKind, number>>;
}

const S = (d: SpeciesDef) => d;

/**
 * Alle Tiere schwimmen etwas gemächlicher als früher (das eigene Tier noch etwas mehr, siehe data/classes.ts) – nur ihre
 * Angriffe sind so schnell wie eh und je.
 */
const PACE = 0.9;
const paced = (d: SpeciesDef): SpeciesDef => ({ ...d, atkSpeed: d.atkSpeed ?? d.speed, speed: Math.round(d.speed * PACE) });

/** Jäger, Verteidiger und Riesen halten so viel mehr aus als früher (Kämpfe mit ihnen dauern länger) */
const STURDY = 1.25;
/** kleine Beutefische (ab 6 Lebenskraft) halten so viel mehr aus: drei Bisse und mehr – nur die kleinsten sind mit zwei erledigt */
const PREY_HP = 1.2;

/**
 * Je stärker ein Tier, desto stärker wird es noch einmal: Jäger, Verteidiger und vor allem die Riesen haben
 * deutlich mehr Leben und beißen viel härter zu. Kleine Beute bleibt, wie sie ist (die kleinsten sind mit zwei Bissen
 * erledigt, kleine Fische brauchen drei und mehr).
 */
function toughen(d: SpeciesDef): SpeciesDef {
  if (d.role === 'prey') return d.hp >= 6 ? { ...d, hp: Math.round(d.hp * PREY_HP) } : d;
  if (!(d.role === 'predator' || d.role === 'apex' || d.role === 'defender')) return d;
  const f = 1 + Math.min(1.3, d.power / 17);
  return {
    ...d,
    hp: Math.round(d.hp * (0.8 + 0.8 * f) * STURDY),
    dmg: +(d.dmg * (0.85 + 0.55 * f)).toFixed(1),
    power: +(d.power * (1 + 0.5 * (f - 1))).toFixed(1),
  };
}

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(
  [
    // ---------------------------------------------------------------- Urozean
    S({ id: 'kieferlos', name: 'Kieferloser Fisch', art: { t: 'fish', len: 34, h: 13, c: 0x6e7a6c, belly: 0xb8bca4, fin: 0x4e5a50, jawless: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.5, speed: 95, sense: 230, meat: 2, herd: [5, 9], sprint: 1.7 }),
    // weitere Fische ihrer Zeit
    S({ id: 'sacabambaspis', name: 'Sacabambaspis', art: { t: 'fish', len: 40, h: 16, c: 0x7a6a50, belly: 0xc8b890, fin: 0x5a4c38, jawless: true, armor: true, eyesFront: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.6, speed: 72, sense: 200, meat: 2, herd: [4, 8], sprint: 1.5 }),
    S({ id: 'birkenia', name: 'Birkenia', art: { t: 'fish', len: 26, h: 8, c: 0x4e6262, belly: 0xb0bca8, fin: 0x34443e, jawless: true, spines: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 4, dmg: 0, power: 1, speed: 125, sense: 240, meat: 1, herd: [8, 14], sprint: 1.8 }),
    S({ id: 'cephalaspis', name: 'Cephalaspis', art: { t: 'fish', len: 46, h: 13, c: 0x6a5c44, belly: 0xa89c78, fin: 0x4a4030, jawless: true, shield: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 10, dmg: 0, power: 2, speed: 62, sense: 180, meat: 2, herd: [3, 6], sprint: 1.4,
      layer: 'floor', where: { start: 1.2, lush: 1.6, murky: 1.3, deep: 0.25, abyss: 0 } }),
    // Cheiracanthus (Devon): ein kleiner "Stachelhai" der mittleren Wasserschichten – häufige Beute und Futterkonkurrent
    S({ id: 'cheiracanthus', name: 'Cheiracanthus', art: { t: 'fish', len: 36, h: 11, c: 0x70804e, belly: 0xc8caa2, fin: 0x4c5842, spiny: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.8, speed: 112, sense: 240, meat: 2, herd: [5, 9], sprint: 1.8,
      layer: 'mid', where: { lush: 1.3, deep: 0.7, abyss: 0.2 } }),
    // Bothriolepis: stark gepanzert, langsam, am Boden – setzt auf Schutz statt Tempo und rammt, wenn man ihm zu nahe kommt
    S({ id: 'bothriolepis', name: 'Bothriolepis', art: { t: 'fish', len: 50, h: 22, c: 0x6e6650, belly: 0xb8ae8c, fin: 0x4e4836, armor: true, arms: true }, role: 'defender', diet: 'plant', habitat: 'water', hp: 34, dmg: 4, power: 6, speed: 50, sense: 200, meat: 3, herd: [3, 5],
      layer: 'floor', where: { start: 1, lush: 1.2, murky: 1.6, deep: 0.4, abyss: 0 } }),
    // Cladoselache: früher Hai – schnell, stromlinienförmig, jagt andere Fische quer durch das offene Wasser
    S({ id: 'cladoselache', name: 'Cladoselache', art: { t: 'fish', len: 112, h: 30, c: 0x46525c, belly: 0xc4ccc8, fin: 0x323c44, shark: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 45, dmg: 8, power: 11, speed: 168, sense: 360, meat: 5, herd: [2, 3], roam: true, sprint: 1.45, hit: [0.8, 0.6],
      layer: 'open', where: { start: 1, lush: 0.3, murky: 0.5, deep: 1.4, abyss: 0.8 } }),
    // Rolfosteus (Devon): Panzerfisch mit langem, spitzem Schnauzenfortsatz – ein Jäger des Bodens, der aus der Deckung vorschnellt
    S({ id: 'rolfosteus', name: 'Rolfosteus', art: { t: 'fish', len: 118, h: 28, c: 0x5e5a46, belly: 0xa8a280, fin: 0x403e30, armor: true, snout: 0.5 }, role: 'predator', diet: 'meat', habitat: 'water', hp: 58, dmg: 11, power: 14, speed: 98, sense: 270, meat: 5, sprint: 1.7, hit: [0.8, 0.6],
      layer: 'floor', where: { start: 0.7, lush: 0.2, murky: 1.3, deep: 1.6, abyss: 1.2 } }),
    // Eusthenopteron (Devon): kräftiger Fleischflosser – ein großer Räuber und ein Vorgriff auf die späteren Landwirbeltiere
    S({ id: 'eusthenopteron', name: 'Eusthenopteron', art: { t: 'fish', len: 150, h: 36, c: 0x56603c, belly: 0xb9b27c, fin: 0x6a5230, teeth: true, lobed: true, spots: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 90, dmg: 14, power: 19, speed: 112, sense: 330, meat: 7, herd: [1, 2], roam: true, hit: [0.8, 0.6],
      where: { start: 0.7, lush: 0.3, murky: 0.6, deep: 1.3, abyss: 1.5 } }),
    // ---------------------------------------------------------------- Ordovizium: erste Wirbeltiere und ihre Nachbarn
    // Arandaspis: schlanker, gepanzerter Kieferloser aus dem Mittelwasser
    S({ id: 'arandaspis', name: 'Arandaspis', art: { t: 'fish', len: 42, h: 12, c: 0x5c6a62, belly: 0xb4bca8, fin: 0x3e4a44, jawless: true, armor: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.7, speed: 84, sense: 220, meat: 2, herd: [5, 9], sprint: 1.55,
      layer: 'mid', where: { start: 1.1, lush: 1.2, murky: 1, deep: 0.3, abyss: 0 } }),
    // Astraspis: gedrungen, mit gehöckertem Panzer – grast dicht am Grund
    S({ id: 'astraspis', name: 'Astraspis', art: { t: 'fish', len: 30, h: 17, c: 0x54606e, belly: 0xa6aeb0, fin: 0x38424e, jawless: true, armor: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 7, dmg: 0, power: 1.5, speed: 70, sense: 200, meat: 2, herd: [4, 8], sprint: 1.5,
      layer: 'floor', where: { start: 1, lush: 1.4, murky: 1.3, deep: 0.25, abyss: 0 } }),
    // Eriptychius: größer, rostbrauner Panzer
    S({ id: 'eriptychius', name: 'Eriptychius', art: { t: 'fish', len: 48, h: 15, c: 0x8a5e46, belly: 0xc8aa88, fin: 0x5e3e2e, jawless: true, armor: true, spots: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 10, dmg: 0, power: 2, speed: 60, sense: 190, meat: 2, herd: [3, 5], sprint: 1.4,
      layer: 'floor', where: { start: 0.9, lush: 1.1, murky: 1.5, deep: 0.3, abyss: 0 } }),
    // Conodont: aalartiges Räubertier mit großen Augen und Zahnreihen – jagt die kleinsten Fische
    S({ id: 'conodont', name: 'Conodont', art: { t: 'fish', len: 56, h: 7, c: 0x7a7060, belly: 0xc0b6a0, fin: 0x4e463a, eel: true, teeth: true, stripes: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 12, dmg: 2, power: 3, speed: 135, sense: 280, meat: 2, herd: [2, 3], sprint: 1.4, hit: [0.8, 0.6],
      layer: 'open', where: { start: 1, lush: 0.7, murky: 1.3, deep: 1.2, abyss: 0.4 } }),
    S({ id: 'isotelus', name: 'Isotelus', art: { t: 'trilo', len: 58, c: 0x6a5a46 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 14, dmg: 0, power: 2.4, speed: 30, sense: 120, meat: 3, herd: [2, 4], crawl: true, sprint: 1.3,
      where: { start: 1, lush: 1, murky: 1.4, deep: 0.5, abyss: 0.1 } }),
    // ---------------------------------------------------------------- Silur: Panzer, Stacheln und die ersten Kiefer
    // Pteraspis: Panzerkopf mit langem Schnabel
    S({ id: 'pteraspis', name: 'Pteraspis', art: { t: 'fish', len: 40, h: 14, c: 0x62705a, belly: 0xb4bc98, fin: 0x424e3c, jawless: true, armor: true, snout: 0.3 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 9, dmg: 0, power: 1.9, speed: 88, sense: 220, meat: 2, herd: [5, 9], sprint: 1.55,
      layer: 'open', where: { start: 1.1, lush: 1.3, murky: 1, deep: 0.35, abyss: 0 } }),
    // Thelodus: winziger, beschuppter Schwarmfisch
    S({ id: 'thelodus', name: 'Thelodus', art: { t: 'fish', len: 26, h: 9, c: 0x8c5e48, belly: 0xd0b498, fin: 0x5e3c2e, jawless: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 5, dmg: 0, power: 1.1, speed: 120, sense: 240, meat: 1, herd: [8, 14], sprint: 1.85,
      layer: 'mid', where: { start: 1.3, lush: 1.2, murky: 1, deep: 0.2, abyss: 0 } }),
    // Jamoytius: ein langer, aalartiger Kieferloser, der sich durch das Mittelwasser schlängelt
    S({ id: 'jamoytius', name: 'Jamoytius', art: { t: 'fish', len: 64, h: 8, c: 0x6a7456, belly: 0xb8c0a0, fin: 0x484e3a, jawless: true, eel: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.3, speed: 100, sense: 230, meat: 2, herd: [3, 5], sprint: 1.6,
      layer: 'mid', where: { start: 1, lush: 1, murky: 1.4, deep: 0.5, abyss: 0.1 } }),
    // Lasanius: hochrückig, rötlich, ein flinker Schwarmfisch
    S({ id: 'lasanius', name: 'Lasanius', art: { t: 'fish', len: 30, h: 14, c: 0x9a6a50, belly: 0xe0c8a4, fin: 0x6a4434, jawless: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 5, dmg: 0, power: 1.2, speed: 115, sense: 240, meat: 1, herd: [7, 12], sprint: 1.85,
      layer: 'open', where: { start: 1.2, lush: 1.3, murky: 0.9, deep: 0.2, abyss: 0 } }),
    // Climatius: kleiner Stachelhai mit Stachelreihen an Bauch und Rücken – friedlich, aber wehrhaft
    S({ id: 'climatius', name: 'Climatius', art: { t: 'fish', len: 36, h: 12, c: 0x5a7a6e, belly: 0xc0d0b8, fin: 0x3e5a50, spiny: true, stripes: true }, role: 'defender', diet: 'plant', habitat: 'water', hp: 18, dmg: 3, power: 4, speed: 100, sense: 230, meat: 3, herd: [3, 5],
      layer: 'mid', where: { start: 0.8, lush: 1.4, murky: 1.2, deep: 0.5, abyss: 0 } }),
    // Entelognathus: einer der ersten Kieferfische – ein gepanzerter Jäger mit Knochenklingen
    S({ id: 'entelognathus', name: 'Entelognathus', art: { t: 'fish', len: 66, h: 19, c: 0x6a6a50, belly: 0xb0aa86, fin: 0x484834, armor: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 28, dmg: 5, power: 7, speed: 118, sense: 280, meat: 3, herd: [2, 3], hit: [0.8, 0.6],
      layer: 'floor', where: { start: 0.5, lush: 0.4, murky: 1.4, deep: 1.3, abyss: 0.8 } }),
    S({ id: 'dalmanites', name: 'Dalmanites', art: { t: 'trilo', len: 42, c: 0x4e5e58 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 9, dmg: 0, power: 1.4, speed: 34, sense: 120, meat: 2, herd: [2, 4], crawl: true, sprint: 1.4,
      where: { start: 1, lush: 1.2, murky: 1.2, deep: 0.5, abyss: 0.1 } }),
    // ---------------------------------------------------------------- Devon: das Zeitalter der Fische
    // Coccosteus: mittelgroßer Panzerfisch mit scherenartigem Maul
    S({ id: 'coccosteus', name: 'Coccosteus', art: { t: 'fish', len: 58, h: 20, c: 0x5c6a4c, belly: 0xb4b490, fin: 0x3e4a34, armor: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 32, dmg: 6, power: 8.5, speed: 125, sense: 280, meat: 4, herd: [2, 3], hit: [0.8, 0.6],
      layer: 'mid', where: { start: 0.7, lush: 0.6, murky: 1.2, deep: 1.3, abyss: 0.6 } }),
    // Pterichthyodes: ein "Flügelfisch" mit Ruderarmen – gepanzert und wehrhaft
    S({ id: 'pterichthyodes', name: 'Pterichthyodes', art: { t: 'fish', len: 34, h: 17, c: 0x7a6a50, belly: 0xc4b48e, fin: 0x54482f, armor: true, arms: true }, role: 'defender', diet: 'plant', habitat: 'water', hp: 18, dmg: 3, power: 4, speed: 58, sense: 200, meat: 3, herd: [3, 5],
      layer: 'floor', where: { start: 1, lush: 1.4, murky: 1.3, deep: 0.3, abyss: 0 } }),
    // Dipterus: ein Lungenfisch mit fleischigen Flossen – wühlt am Boden
    S({ id: 'dipterus', name: 'Dipterus', art: { t: 'fish', len: 46, h: 13, c: 0x7c7a4c, belly: 0xc6c294, fin: 0x504e30, lobed: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 9, dmg: 0, power: 2, speed: 72, sense: 220, meat: 3, herd: [3, 5], sprint: 1.5,
      layer: 'floor', where: { start: 1, lush: 1.5, murky: 1.4, deep: 0.3, abyss: 0 } }),
    // Osteolepis: ein kleiner Fleischflosser und flinker Räuber der mittleren Schichten
    S({ id: 'osteolepis', name: 'Osteolepis', art: { t: 'fish', len: 56, h: 15, c: 0x5a7052, belly: 0xb8c49a, fin: 0x3e5238, lobed: true, spots: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 20, dmg: 4, power: 5, speed: 122, sense: 270, meat: 3, herd: [2, 3], hit: [0.8, 0.6],
      layer: 'mid', where: { start: 0.8, lush: 0.9, murky: 1.2, deep: 0.8, abyss: 0.3 } }),
    // Cheirolepis: schlanker, schneller Strahlenflosser – jagt im offenen Wasser
    S({ id: 'cheirolepis', name: 'Cheirolepis', art: { t: 'fish', len: 64, h: 14, c: 0x8c7a3c, belly: 0xe0d09a, fin: 0x5e4e22, teeth: true, stripes: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 24, dmg: 5, power: 6.5, speed: 160, sense: 300, meat: 3, herd: [2, 4], roam: true, sprint: 1.5, hit: [0.8, 0.6],
      layer: 'open', where: { start: 1, lush: 0.5, murky: 0.8, deep: 1.3, abyss: 0.6 } }),
    // Moythomasia: kleiner, glänzender Schwarmfisch
    S({ id: 'moythomasia', name: 'Moythomasia', art: { t: 'fish', len: 26, h: 8, c: 0x9c8a52, belly: 0xe8dcaa, fin: 0x6a5c30, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 4, dmg: 0, power: 1, speed: 135, sense: 250, meat: 1, herd: [9, 16], sprint: 1.9,
      layer: 'open', where: { start: 1.3, lush: 1.2, murky: 1, deep: 0.2, abyss: 0 } }),
    // Stethacanthus: ein Hai mit einem "Amboss" auf dem Rücken
    S({ id: 'stethacanthus', name: 'Stethacanthus', art: { t: 'fish', len: 88, h: 20, c: 0x3e4a54, belly: 0xb4bcc0, fin: 0x2a343c, shark: true, anvil: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 40, dmg: 7, power: 10, speed: 150, sense: 340, meat: 5, herd: [2, 3], roam: true, sprint: 1.45, hit: [0.8, 0.6],
      layer: 'open', where: { start: 0.7, lush: 0.3, murky: 0.6, deep: 1.4, abyss: 1 } }),
    // Tiktaalik: ein Flachwasserjäger mit Gliedmaßen – ein Schritt Richtung Land
    S({ id: 'tiktaalik', name: 'Tiktaalik', art: { t: 'fish', len: 172, h: 34, c: 0x6a6a3c, belly: 0xbab27a, fin: 0x4e4a2a, lobed: true, spots: true, teeth: true, snout: 0.12 }, role: 'predator', diet: 'meat', habitat: 'water', hp: 100, dmg: 12, power: 17, speed: 96, sense: 320, meat: 7, hit: [0.8, 0.6],
      layer: 'floor', where: { start: 0.6, lush: 1.4, murky: 1.6, deep: 0.2, abyss: 0 } }),
    // Drepanaspis: ein flacher Kieferloser mit Maul nach vorn – siebt den Boden
    S({ id: 'drepanaspis', name: 'Drepanaspis', art: { t: 'fish', len: 40, h: 13, c: 0x7a7860, belly: 0xbebaa0, fin: 0x54523f, jawless: true, armor: true, eyesFront: true, spots: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 9, dmg: 0, power: 1.8, speed: 60, sense: 190, meat: 2, herd: [4, 7], sprint: 1.45,
      layer: 'floor', where: { start: 1, lush: 1.3, murky: 1.5, deep: 0.3, abyss: 0 } }),
    // Holoptychius: ein mächtiger Fleischflosser der Tiefe
    S({ id: 'holoptychius', name: 'Holoptychius', art: { t: 'fish', len: 124, h: 32, c: 0x6a4e34, belly: 0xc0a478, fin: 0x483422, lobed: true, spots: true, stripes: true, teeth: true }, role: 'predator', diet: 'meat', habitat: 'water', hp: 70, dmg: 10, power: 15, speed: 108, sense: 320, meat: 6, herd: [1, 2], roam: true, hit: [0.8, 0.6],
      where: { start: 0.5, lush: 0.3, murky: 1.1, deep: 1.4, abyss: 1.4 } }),
    // Acanthodes: zahnloser Stachelhai – zieht in silbrigen Schwärmen durch das offene Wasser
    S({ id: 'acanthodes', name: 'Acanthodes', art: { t: 'fish', len: 38, h: 9, c: 0x8a9a94, belly: 0xdce6e0, fin: 0x5a6a66, spines: true, stripes: true }, role: 'prey', diet: 'plant', habitat: 'water', hp: 6, dmg: 0, power: 1.4, speed: 122, sense: 250, meat: 2, herd: [8, 14], sprint: 1.85,
      layer: 'open', where: { start: 1.2, lush: 1.2, murky: 0.9, deep: 0.3, abyss: 0 } }),
    S({ id: 'trilobit', name: 'Trilobit', art: { t: 'trilo', len: 34, c: 0x5e4c38 }, role: 'prey', diet: 'plant', habitat: 'water', hp: 8, dmg: 0, power: 1.2, speed: 34, sense: 120, meat: 2, herd: [3, 6], crawl: true, sprint: 1.4 }),
    S({ id: 'qualle', name: 'Qualle', art: { t: 'jelly', r: 16, c: 0x7a5a96 }, role: 'hazard', diet: 'none', habitat: 'water', hp: 5, dmg: 4, power: 2, speed: 24, sense: 0, meat: 1, herd: [2, 4], hit: [0.7, 0.7] }),
    S({ id: 'orthoceras', name: 'Orthoceras', art: { t: 'cone', len: 74, c: 0x7a6248 }, role: 'predator', diet: 'meat', habitat: 'water', hp: 22, dmg: 5, power: 6, speed: 118, sense: 300, meat: 3, herd: [2, 4], hit: [0.75, 0.6] }),
    S({ id: 'cameroceras', name: 'Riesenkopffüßer', art: { t: 'cone', len: 250, c: 0x5e4a3a }, role: 'apex', diet: 'meat', habitat: 'water', hp: 140, dmg: 8, power: 18, speed: 82, sense: 380, meat: 8, boss: true, hit: [0.75, 0.5] }),
    S({ id: 'seeskorpion', name: 'Seeskorpion', art: { t: 'bug', len: 72, h: 18, segs: 8, c: 0x4e3228, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, role: 'predator', diet: 'meat', habitat: 'water', hp: 30, dmg: 6, power: 8, speed: 104, sense: 260, meat: 4, herd: [2, 3] }),
    // Dunkleosteus (Devon, ~380 Mio. Jahre): bis zu 8 m, gepanzert, statt Zähnen Knochenklingen – gewaltige Bisskraft
    S({ id: 'dunkleosteus', name: 'Dunkleosteus', art: { t: 'fish', len: 250, h: 108, c: 0x39444a, belly: 0x7e8a86, fin: 0x252c32, armor: true, teeth: true }, role: 'apex', diet: 'meat', habitat: 'water', hp: 220, dmg: 16, power: 28, speed: 105, sense: 430, meat: 12, boss: true, hit: [0.8, 0.7] }),
    // seltene große Herumtreiber: am Anfang besser meiden – oder mit viel Geschick besiegen
    S({ id: 'megalograptus', name: 'Megalograptus', art: { t: 'bug', len: 120, h: 26, segs: 9, c: 0x5a3a26, legs: 4, pincers: false, paddles: true, stinger: 'straight' }, role: 'predator', diet: 'meat', habitat: 'water', hp: 60, dmg: 9, power: 12, speed: 112, sense: 300, meat: 5, roam: true, hit: [0.8, 0.6] }),
    S({ id: 'pterygotus', name: 'Pterygotus', art: { t: 'bug', len: 210, h: 46, segs: 10, c: 0x4a2c1e, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, role: 'apex', diet: 'meat', habitat: 'water', hp: 150, dmg: 11, power: 20, speed: 118, sense: 380, meat: 8, boss: true, roam: true, hit: [0.8, 0.6] }),
    S({ id: 'hyneria', name: 'Hyneria', art: { t: 'fish', len: 210, h: 66, c: 0x4a4a30, belly: 0x9a9268, fin: 0x34341e, teeth: true }, role: 'apex', diet: 'meat', habitat: 'water', hp: 180, dmg: 12, power: 24, speed: 112, sense: 400, meat: 10, boss: true, roam: true, hit: [0.8, 0.65] }),
  ].map((d) => [d.id, toughen(paced(d))]),
);
