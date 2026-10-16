import type { ClassId, Stats } from './classes';
import { PALETTES } from '../art/palettes';

export type PartId = 'kiefer' | 'horn' | 'koerper' | 'haut' | 'schwanz' | 'beine' | 'farbe';

export interface PartOption {
  name: string;
  /** Anderer Name an Land (z. B. Flosse → Schwanz). */
  landName?: string;
  cost: number;
  minClass: ClassId;
  desc: string;
  mods?: Partial<Stats>;
  speedMul?: number;
}

export interface PartCategory {
  id: PartId;
  name: string;
  waterName?: string;
  /** Nur für Landtiere (z. B. Beine). */
  landOnly?: boolean;
  options: PartOption[];
}

export const PART_ORDER: PartId[] = ['kiefer', 'horn', 'koerper', 'haut', 'schwanz', 'beine', 'farbe'];

export const PARTS: Record<PartId, PartCategory> = {
  kiefer: {
    id: 'kiefer',
    name: 'Kiefer',
    options: [
      { name: 'Kleines Maul', cost: 0, minClass: 'fish', desc: 'Ein winziges Maul für Plankton und kleine Beute.' },
      { name: 'Spitze Zähne', cost: 25, minClass: 'fish', mods: { bite: 3 }, desc: 'Spitze Zähne beißen deutlich fester zu.' },
      { name: 'Knackkiefer', cost: 70, minClass: 'fish', mods: { bite: 6 }, desc: 'Kräftige Kiefermuskeln knacken sogar Panzer.' },
      { name: 'Fangzähne', cost: 170, minClass: 'amphibian', mods: { bite: 10 }, desc: 'Lange Fangzähne halten jede Beute fest.' },
      { name: 'Reißzähne', cost: 340, minClass: 'reptile', mods: { bite: 17 }, desc: 'Gezackte Reißzähne wie bei einem Raubsaurier.' },
      { name: 'Säbelzähne', cost: 620, minClass: 'mammal', mods: { bite: 26 }, desc: 'Riesige Säbelzähne – der gefährlichste Biss der Eiszeit.' },
    ],
  },
  horn: {
    id: 'horn',
    name: 'Horn',
    options: [
      { name: 'Kein Horn', cost: 0, minClass: 'fish', desc: 'Ohne Horn gibt es keinen Hornstoß.' },
      { name: 'Stirnbeule', cost: 30, minClass: 'fish', mods: { horn: 5 }, desc: 'Eine harte Beule. Schaltet den Hornstoß frei (Taste K).' },
      { name: 'Spitzes Horn', cost: 95, minClass: 'fish', mods: { horn: 9 }, desc: 'Ein spitzes Stirnhorn für kräftige Rammstöße.' },
      { name: 'Nasenhorn', cost: 210, minClass: 'amphibian', mods: { horn: 15 }, desc: 'Ein großes Horn auf der Nase, wie bei einem Nashorn.' },
      { name: 'Doppelhorn', cost: 390, minClass: 'reptile', mods: { horn: 23, def: 1 }, desc: 'Zwei lange Hörner und ein schützender Nackenschild.' },
      { name: 'Kronenhorn', cost: 680, minClass: 'mammal', mods: { horn: 34 }, desc: 'Eine goldene Krone aus Hörnern. Nichts hält dich auf!' },
    ],
  },
  koerper: {
    id: 'koerper',
    name: 'Körper',
    options: [
      { name: 'Schlank', cost: 0, minClass: 'fish', speedMul: 1.08, desc: 'Leicht und flink, aber wenig Lebenspunkte.' },
      { name: 'Kräftig', cost: 40, minClass: 'fish', mods: { hp: 8, def: 1 }, desc: 'Ein kräftiger Körper hält mehr aus.' },
      { name: 'Massig', cost: 130, minClass: 'amphibian', mods: { hp: 20, def: 2 }, speedMul: 0.96, desc: 'Viel Masse, viele Lebenspunkte – etwas langsamer.' },
      { name: 'Riesig', cost: 300, minClass: 'reptile', mods: { hp: 38, def: 3 }, speedMul: 0.92, desc: 'Ein riesiger Körper wie bei den großen Sauriern.' },
      { name: 'Koloss', cost: 560, minClass: 'mammal', mods: { hp: 65, def: 5 }, speedMul: 0.9, desc: 'Ein gewaltiger Koloss, so groß wie ein Mammut.' },
    ],
  },
  haut: {
    id: 'haut',
    name: 'Haut',
    options: [
      { name: 'Glatte Haut', cost: 0, minClass: 'fish', desc: 'Weiche, ungeschützte Haut.' },
      { name: 'Schuppen', cost: 35, minClass: 'fish', mods: { def: 1 }, desc: 'Feine Schuppen schützen vor Bissen.' },
      { name: 'Knochenplatten', cost: 110, minClass: 'fish', mods: { def: 3, hp: 4 }, desc: 'Harte Knochenplatten wie bei den Panzerfischen.' },
      { name: 'Hornschuppen', cost: 230, minClass: 'reptile', mods: { def: 5 }, desc: 'Dicke Hornschuppen und ein Rückenkamm.' },
      { name: 'Stachelpanzer', cost: 420, minClass: 'reptile', mods: { def: 7 }, desc: 'Ein Panzer mit spitzen Rückenstacheln.' },
      { name: 'Dichter Pelz', cost: 460, minClass: 'mammal', mods: { def: 7, hp: 20 }, desc: 'Warmes, dichtes Fell – perfekt für die Eiszeit.' },
    ],
  },
  schwanz: {
    id: 'schwanz',
    name: 'Schwanz',
    waterName: 'Flosse',
    options: [
      { name: 'Kleine Flosse', landName: 'Kurzer Schwanz', cost: 0, minClass: 'fish', desc: 'Klein und einfach.' },
      { name: 'Breite Flosse', landName: 'Langer Schwanz', cost: 30, minClass: 'fish', mods: { speed: 20 }, desc: 'Mehr Schub – du wirst schneller.' },
      { name: 'Sichelflosse', landName: 'Ruderschwanz', cost: 95, minClass: 'fish', mods: { speed: 40 }, desc: 'Eine elegante Form für hohes Tempo.' },
      { name: 'Keulenschwanz', cost: 260, minClass: 'reptile', mods: { speed: 25, def: 2 }, desc: 'Eine Knochenkeule am Schwanzende.' },
      { name: 'Buschschwanz', cost: 420, minClass: 'mammal', mods: { speed: 50, jump: 20 }, desc: 'Ein buschiger Schwanz für Balance und Tempo.' },
    ],
  },
  beine: {
    id: 'beine',
    name: 'Beine',
    landOnly: true,
    options: [
      { name: 'Stummelbeine', cost: 0, minClass: 'amphibian', desc: 'Kurze Beine – zum Laufen reicht es gerade so.' },
      { name: 'Laufbeine', cost: 80, minClass: 'amphibian', mods: { speed: 30 }, desc: 'Längere Beine machen dich schneller.' },
      { name: 'Sprungbeine', cost: 150, minClass: 'amphibian', mods: { jump: 70 }, desc: 'Muskulöse Hinterbeine für hohe Sprünge.' },
      { name: 'Krallenfüße', cost: 290, minClass: 'reptile', mods: { speed: 25, jump: 40, bite: 2 }, desc: 'Scharfe Krallen geben Halt und Kraft.' },
      { name: 'Lange Läufe', cost: 480, minClass: 'mammal', mods: { speed: 55, jump: 90 }, desc: 'Lange, federnde Beine – schnell wie der Wind.' },
    ],
  },
  farbe: {
    id: 'farbe',
    name: 'Farbe',
    options: PALETTES.map((p, i) => ({
      name: p.name,
      cost: i === 0 ? 0 : p.name === 'Gold' ? 150 : 10,
      minClass: 'fish' as ClassId,
      desc: p.name === 'Gold' ? 'Ein glänzendes Goldkleid. Teuer, aber prächtig!' : 'Eine neue Farbe für deine Haut.',
    })),
  },
};

export function optionName(cat: PartId, idx: number, cls: ClassId) {
  const o = PARTS[cat].options[idx];
  return cls !== 'fish' && o.landName ? o.landName : o.name;
}

export function categoryName(cat: PartId, cls: ClassId) {
  const c = PARTS[cat];
  return cls === 'fish' && c.waterName ? c.waterName : c.name;
}
