import type { Rng } from '../util/math';
import type { Material } from '../level/terrain';

// Was am Meeresgrund lebt: Schwämme, Korallen, Moostierchen, Armfüßer, Seelilien, Cystoideen, Algen und Matten. Jede Form hat
// ein Gewicht je Ortsart (Fluss am Start, bewachsen, trüb, tief, Abgrund), je Zeitalter (Ordovizium, Silur, Devon) und je
// Untergrund (Sand, Fels, Schlamm) – so sieht jeder Ort anders aus, und mit den Zeitaltern ändert sich die Gesellschaft am Grund:
// Im Ordovizium blühen Cystoideen, Schwämme und Moostierchen, im Silur Seelilien und Riffbauer, im Devon die großen Riffe.

type W5 = [number, number, number, number, number];
type W3 = [number, number, number];

export interface Bio {
  /** Name der Deko (Bild d2_<key>) */
  key: string;
  /** Gewicht je Ortsart: Start (Fluss), bewachsen, trüb, tief, Abgrund */
  w: W5;
  /** Untergrund: Sand, Fels, Schlamm (Standard 1, 1, 1) */
  on?: W3;
  /** Zeitalter: Ordovizium, Silur, Devon (Standard 1, 1, 1) */
  ep?: W3;
  /** Riffbauer: wo es ein Riff gibt (Devon), mehr davon */
  reef?: boolean;
  /** Gruppengröße (min, max) */
  group?: [number, number];
}

export const BIOTA: Bio[] = [
  // Algen und weiche Pflanzen des flachen Wassers (die frühen Landpflanzen-Verwandten gibt es im Meer noch nicht)
  { key: 'seaweed', w: [1, 2, 1.1, 0.4, 0.05], on: [1, 0.5, 1.2], group: [1, 2] },
  { key: 'kelp', w: [0.1, 1.1, 0.3, 0.1, 0], on: [1, 0.4, 1.2] },
  { key: 'algae_sheet', w: [1.2, 1.6, 0.8, 0.15, 0], on: [1, 0.7, 1.1], group: [1, 3] },
  { key: 'algae_tuft', w: [1.3, 1.5, 0.9, 0.25, 0], on: [1, 0.8, 1.2], group: [2, 4] },
  { key: 'algae_tuft_r', w: [0.3, 0.6, 0.3, 0.1, 0], on: [0.8, 1.2, 1], group: [2, 3] },
  { key: 'algae_coralline', w: [0.3, 1, 0.5, 0.2, 0], on: [0.5, 2, 0.3], group: [1, 2] },
  { key: 'algae_dasyclad', w: [0.5, 1.2, 0.5, 0.1, 0], on: [1.2, 0.8, 1], ep: [1.6, 1, 0.4], group: [1, 3] },
  // Matten und Polster aus Mikroben
  { key: 'stromatolite', w: [0.7, 0.8, 0.9, 0.2, 0], on: [1.4, 0.4, 1.2], ep: [1.6, 0.9, 0.5], group: [1, 2] },
  // Schwämme
  { key: 'sponge_vase', w: [0.1, 0.9, 0.5, 0.7, 0.2], on: [0.8, 1.3, 0.6], group: [1, 2] },
  { key: 'sponge_vase_r', w: [0.05, 0.5, 0.3, 0.4, 0.1], on: [0.8, 1.3, 0.6] },
  { key: 'sponge_tubes', w: [0.1, 1, 0.6, 0.5, 0.1], on: [0.8, 1.3, 0.6] },
  { key: 'sponge_glass', w: [0, 0.1, 0.5, 1.4, 1], on: [0.6, 1.2, 1.3], ep: [1.2, 1, 1] },
  { key: 'sponge_crust', w: [0.1, 0.8, 0.8, 0.6, 0.2], on: [0.5, 2, 0.4], group: [1, 2] },
  { key: 'sponge_crust_y', w: [0.05, 0.5, 0.5, 0.3, 0.1], on: [0.5, 2, 0.4] },
  { key: 'sponge_ball', w: [0, 0.4, 0.4, 0.3, 0.1], on: [1, 1.2, 0.8] },
  // Korallen und Riffbauer
  { key: 'coral_tabulate', w: [0, 1.2, 0.4, 0.1, 0], on: [1, 1.3, 0.4], ep: [0.5, 1.2, 1.6], reef: true },
  { key: 'coral_tabulate_r', w: [0, 0.6, 0.2, 0.05, 0], on: [1, 1.3, 0.4], ep: [0.4, 1.2, 1.6], reef: true },
  { key: 'coral_horn', w: [0, 1, 0.4, 0.1, 0], on: [1, 1.3, 0.5], ep: [0.6, 1.2, 1.3], reef: true, group: [1, 3] },
  { key: 'coral_chain', w: [0, 0.8, 0.3, 0, 0], on: [1, 1.2, 0.5], ep: [0.6, 1.3, 0.4] },
  { key: 'coral_branch', w: [0, 1, 0.3, 0, 0], on: [1, 1.2, 0.5], ep: [0.3, 1, 1.6], reef: true },
  { key: 'stromatoporoid', w: [0, 0.9, 0.2, 0, 0], on: [1, 1.2, 0.4], ep: [0.4, 1.6, 1.7], reef: true },
  // Moostierchen
  { key: 'bryo_fan', w: [0, 0.8, 0.9, 0.6, 0.1], on: [0.9, 1.3, 0.8], group: [1, 2] },
  { key: 'bryo_fan_g', w: [0, 0.5, 0.5, 0.3, 0.05], on: [0.9, 1.3, 0.8] },
  { key: 'bryo_twig', w: [0.1, 0.8, 0.9, 0.4, 0.1], on: [0.9, 1.3, 0.8], group: [1, 3] },
  // Armfüßer
  { key: 'brachio_orthid', w: [0.2, 1.1, 0.9, 0.5, 0.1], on: [1.2, 1, 1.1], ep: [1.5, 1, 0.6], group: [1, 3] },
  { key: 'brachio_spirifer', w: [0.1, 0.9, 0.8, 0.5, 0.1], on: [1.2, 1, 1.1], ep: [0.3, 1, 1.7], group: [1, 2] },
  { key: 'brachio_cluster', w: [0.1, 1, 0.8, 0.4, 0.05], on: [1.3, 1, 1.1] },
  { key: 'brachio_pentamerus', w: [0, 0.4, 0.3, 0.1, 0], on: [1.2, 1, 1], ep: [0, 2, 0.2], group: [1, 2] },
  // Seelilien
  { key: 'crinoid_tall', w: [0, 0.9, 0.5, 0.5, 0.15], on: [1, 1.2, 0.8], ep: [0.7, 1.6, 1.3] },
  { key: 'crinoid_short', w: [0, 1, 0.7, 0.6, 0.15], on: [1, 1.2, 0.8], ep: [0.8, 1.4, 1.2], group: [1, 2] },
  { key: 'crinoid_cluster', w: [0, 0.8, 0.3, 0.2, 0.05], on: [1, 1.2, 0.7], ep: [0.6, 1.5, 1.2] },
  // Cystoideen
  { key: 'cystoid', w: [0.1, 0.6, 0.6, 0.4, 0.1], on: [1, 1.2, 1], ep: [1.6, 0.8, 0.1], group: [1, 3] },
  { key: 'cystoid_pair', w: [0, 0.5, 0.4, 0.3, 0.05], on: [1, 1.2, 1], ep: [1.6, 0.8, 0.1] },
  // festgewachsene Graptolithen
  { key: 'grapto_bush', w: [0, 0.2, 0.4, 0.5, 0.2], on: [1, 1.2, 1], ep: [1.5, 0.8, 0.1], group: [1, 2] },
  // Reste
  { key: 'shell', w: [0.6, 0.6, 0.6, 0.3, 0.1] },
  { key: 'bones', w: [0.2, 0.2, 0.3, 0.4, 0.5] },
  { key: 'anemone', w: [0.1, 0.6, 0.2, 0.2, 0], on: [1, 1.2, 0.6] },
  { key: 'seafan', w: [0, 0.4, 0.1, 0.1, 0], on: [1, 1.3, 0.5] },
];

const KINDS = ['start', 'lush', 'murky', 'deep', 'abyss'];
const EPOCHS = ['ordovizium', 'silur', 'devon'];
const MATS: Material[] = ['sand', 'rock', 'mud'];

/** Was wächst hier? Gewichtete Wahl nach Ortsart, Zeitalter und Untergrund. */
export function pickBio(r: Rng, kind: string, epochId: string, mat: Material, reef = false): Bio | null {
  const ki = Math.max(0, KINDS.indexOf(kind)), ei = Math.max(0, EPOCHS.indexOf(epochId)), mi = MATS.indexOf(mat);
  const ws = BIOTA.map((b) => b.w[ki] * (b.ep?.[ei] ?? 1) * (b.on?.[mi] ?? 1) * (reef && b.reef ? 1.6 : 1));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let q = r() * total;
  for (let i = 0; i < BIOTA.length; i++) {
    q -= ws[i];
    if (q <= 0) return BIOTA[i];
  }
  return BIOTA[BIOTA.length - 1];
}
