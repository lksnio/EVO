/** Seven permanent discoveries of each kind. Order is the order around the star. */
export const COLLECTION_SHELLS = [
  { id: 'abyss', name: 'Shell of the Depths' },
  { id: 'tide', name: 'Shell of the Tides' },
  { id: 'fern', name: 'Shell in Fernstone' },
  { id: 'amber', name: 'Shell in Amber Sand' },
  { id: 'rift', name: 'Shell of the Rock Crevice' },
  { id: 'chalk', name: 'Shell in Chalkstone' },
  { id: 'dawn', name: 'Shell of the Early Shore' },
] as const;

export const COLLECTION_FOSSILS = [
  { id: 'dunkleosteus', name: 'Dunkleosteus', epoch: 'Devonian', shape: 'armoured-fish' },
  { id: 'anthracosaurus', name: 'Anthracosaurus', epoch: 'Carboniferous', shape: 'amphibian' },
  { id: 'inostrancevia', name: 'Inostrancevia', epoch: 'Permian', shape: 'sabre' },
  { id: 'postosuchus', name: 'Postosuchus', epoch: 'Triassic', shape: 'archosaur' },
  { id: 'liopleurodon', name: 'Liopleurodon', epoch: 'Jurassic', shape: 'pliosaur' },
  { id: 'mosasaurus', name: 'Mosasaurus', epoch: 'Cretaceous', shape: 'mosasaur' },
  { id: 'hyaenodon', name: 'Hyaenodon', epoch: 'Paleogene', shape: 'mammal' },
] as const;

export type ShellId = typeof COLLECTION_SHELLS[number]['id'];
export type FossilId = typeof COLLECTION_FOSSILS[number]['id'];
export type CollectionId = `shell:${ShellId}` | `fossil:${FossilId}`;

/** Placeholder riddles; one new verse for each distinct discovered shell. */
export const SHELL_WISDOM = [
  '... the first trace ... whispers of a second beginning ...',
  '... seven little homes ... shelter a life you do not yet know ...',
  '... not everything that journeys on ... needs a beating tail ...',
  '... crawling along the seabed ... another path begins ...',
  '... an unfamiliar breath ... without your ancestors\' gills ...',
  '... where water meets land ... an unhatched life awaits ...',
  '... seven traces become one ... yet every beginning needs a place of its own ...',
] as const;

/** The other six fixed finds will be authored with their future maps. */
export const SHELL_PLACEMENTS: readonly { id: ShellId; epoch: string; place: string; anchor: 'deepest-floor' }[] = [
  { id: 'abyss', epoch: 'devon', place: 'wand', anchor: 'deepest-floor' },
];
