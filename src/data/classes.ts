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
    name: 'Urfisch',
    habitat: 'water',
    // etwas gemächlicher als früher (215): Platz nach oben für schnellere Nachkommen; zäher als früher (30)
    base: { hp: 45, bite: 4, ram: 4, speed: 183, jump: 0 },
    dawn: 'Im dunklen Urozean beginnt dein Leben.',
  },
  amphibian: {
    id: 'amphibian',
    name: 'Pederpes',
    habitat: 'land',
    // ein früher Vierfüßer (Pederpes): kräftig im Wasser, an Land noch schwerfällig – kleine Sprünge aufs Ufer
    base: { hp: 52, bite: 7, ram: 6, speed: 190, jump: 430 },
    dawn: 'Deine Nachfahren kriechen aus dem Wasser.\nDie Flossen sind zu Beinen geworden.',
  },
  reptile: {
    id: 'reptile',
    name: 'Echse',
    habitat: 'land',
    base: { hp: 85, bite: 12, ram: 12, speed: 215, jump: 590 },
    dawn: 'Schuppen schützen nun deine Haut.\nDie Sümpfe trocknen aus – eine neue Zeit beginnt.',
  },
  mammal: {
    id: 'mammal',
    name: 'Säuger',
    habitat: 'land',
    base: { hp: 125, bite: 18, ram: 18, speed: 235, jump: 620 },
    dawn: 'Warmes Blut, dichtes Fell.\nDie Großen Echsen sind verschwunden – die Welt wird kalt.',
  },
};

export const classIndex = (c: ClassId) => CLASS_ORDER.indexOf(c);
