export type ClassId = 'fish' | 'amphibian' | 'reptile' | 'mammal';

export const CLASS_ORDER: ClassId[] = ['fish', 'amphibian', 'reptile', 'mammal'];

export interface Stats {
  hp: number;
  bite: number;
  horn: number;
  def: number;
  speed: number;
  jump: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  habitat: 'water' | 'land';
  base: Stats;
  /** EVO-Punkte, die der Wechsel in diese Klasse kostet. */
  cost: number;
  /** Diese Ära muss (durch ihren Boss) abgeschlossen sein. */
  requiresEra?: string;
  desc: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fish: {
    id: 'fish',
    name: 'Fisch',
    habitat: 'water',
    base: { hp: 20, bite: 3, horn: 0, def: 0, speed: 200, jump: 0 },
    cost: 0,
    desc: 'Ein kleiner Urfisch. Er kann nur im Wasser leben.',
  },
  amphibian: {
    id: 'amphibian',
    name: 'Amphibie',
    habitat: 'land',
    base: { hp: 36, bite: 6, horn: 0, def: 1, speed: 190, jump: 540 },
    cost: 100,
    requiresEra: 'ozean',
    desc: 'Mit Beinen und Lungen wagst du dich zum ersten Mal an Land.',
  },
  reptile: {
    id: 'reptile',
    name: 'Reptil',
    habitat: 'land',
    base: { hp: 64, bite: 11, horn: 0, def: 3, speed: 205, jump: 570 },
    cost: 280,
    requiresEra: 'sumpf',
    desc: 'Schuppige Haut und kräftige Beine – bereit für das Zeitalter der Reptilien.',
  },
  mammal: {
    id: 'mammal',
    name: 'Säugetier',
    habitat: 'land',
    base: { hp: 105, bite: 18, horn: 0, def: 6, speed: 225, jump: 610 },
    cost: 560,
    requiresEra: 'reptil',
    desc: 'Warmes Blut und Fell trotzen sogar der Eiszeit.',
  },
};

export const classIndex = (c: ClassId) => CLASS_ORDER.indexOf(c);
