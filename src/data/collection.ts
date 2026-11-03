/** Seven permanent discoveries of each kind. Order is the order around the star. */
export const COLLECTION_SHELLS = [
  { id: 'abyss', name: 'Muschel der Tiefe' },
  { id: 'tide', name: 'Muschel der Gezeiten' },
  { id: 'fern', name: 'Muschel im Farnstein' },
  { id: 'amber', name: 'Muschel im Bernsteinsand' },
  { id: 'rift', name: 'Muschel der Felsspalte' },
  { id: 'chalk', name: 'Muschel im Kreidestein' },
  { id: 'dawn', name: 'Muschel des frühen Ufers' },
] as const;

export const COLLECTION_FOSSILS = [
  { id: 'dunkleosteus', name: 'Dunkleosteus', epoch: 'Devon', shape: 'armoured-fish' },
  { id: 'anthracosaurus', name: 'Anthracosaurus', epoch: 'Karbon', shape: 'amphibian' },
  { id: 'inostrancevia', name: 'Inostrancevia', epoch: 'Perm', shape: 'sabre' },
  { id: 'postosuchus', name: 'Postosuchus', epoch: 'Trias', shape: 'archosaur' },
  { id: 'liopleurodon', name: 'Liopleurodon', epoch: 'Jura', shape: 'pliosaur' },
  { id: 'mosasaurus', name: 'Mosasaurus', epoch: 'Kreidezeit', shape: 'mosasaur' },
  { id: 'hyaenodon', name: 'Hyaenodon', epoch: 'Paläogen', shape: 'mammal' },
] as const;

export type ShellId = typeof COLLECTION_SHELLS[number]['id'];
export type FossilId = typeof COLLECTION_FOSSILS[number]['id'];
export type CollectionId = `shell:${ShellId}` | `fossil:${FossilId}`;

/** Placeholder riddles; one new verse for each distinct discovered shell. */
export const SHELL_WISDOM = [
  '... die erste Spur ... flüstert von einem zweiten Anfang ...',
  '... sieben kleine Häuser ... bewahren ein Leben, das du noch nicht kennst ...',
  '... nicht alles, was weiterzieht ... braucht einen schlagenden Schwanz ...',
  '... kriechend am Meeresboden ... beginnt ein anderer Weg ...',
  '... ein fremder Atem ... ohne die Kiemen deiner Vorfahren ...',
  '... wo Wasser und Erde einander berühren ... wartet ein ungeschlüpftes Leben ...',
  '... sieben Spuren werden eins ... doch jeder Anfang braucht seinen eigenen Ort ...',
] as const;

/** The other six fixed finds will be authored with their future maps. */
export const SHELL_PLACEMENTS: readonly { id: ShellId; epoch: string; place: string; anchor: 'deepest-floor' }[] = [
  { id: 'abyss', epoch: 'devon', place: 'wand', anchor: 'deepest-floor' },
];
