export type ClassId = 'fish' | 'amphibian' | 'reptile' | 'mammal';

export const CLASS_ORDER: ClassId[] = ['fish', 'amphibian', 'reptile', 'mammal'];

/** Grundwerte einer Körperform, bevor die Anpassungen wirken. */
export interface BaseStats {
  hp: number;
  bite: number;
  ram: number;
  speed: number;
  jump: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  habitat: 'water' | 'land';
  base: BaseStats;
  /** Text beim Übergang in diese Form. */
  dawn: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fish: {
    id: 'fish',
    name: 'Early fish',
    habitat: 'water',
    // etwas gemächlicher als früher (215): Platz nach oben für schnellere Nachkommen; zäher als früher (30)
    base: { hp: 45, bite: 5, ram: 4, speed: 183, jump: 0 },
    dawn: 'Your life begins in the dark primeval ocean.',
  },
  amphibian: {
    id: 'amphibian',
    name: 'Pederpes',
    habitat: 'land',
    // ein früher Vierfüßer (Pederpes): kräftig im Wasser, an Land noch schwerfällig – kleine Sprünge aufs Ufer
    base: { hp: 52, bite: 7, ram: 6, speed: 190, jump: 430 },
    dawn: 'Your descendants crawl out of the water.\nFins have become legs.',
  },
  reptile: {
    id: 'reptile',
    name: 'Reptile',
    habitat: 'land',
    base: { hp: 85, bite: 12, ram: 12, speed: 215, jump: 590 },
    dawn: 'Scales now protect your skin.\nThe swamps dry out — a new age begins.',
  },
  mammal: {
    id: 'mammal',
    name: 'Mammal',
    habitat: 'land',
    base: { hp: 125, bite: 18, ram: 18, speed: 235, jump: 620 },
    dawn: 'Warm blood, thick fur.\nThe great reptiles are gone — the world grows cold.',
  },
};

export const classIndex = (c: ClassId) => CLASS_ORDER.indexOf(c);
