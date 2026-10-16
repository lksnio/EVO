// Alle Gegner. "art" beschreibt, wie der Gegner gezeichnet wird (siehe art/enemyArt.ts).

export type Move =
  | 'patrol' | 'chase' | 'hop' | 'charge' | 'shoot'
  | 'fly' | 'swoop' | 'float'
  | 'swim' | 'swimChase' | 'drift' | 'crawl'
  | 'boss';

export type Art =
  | { t: 'fish'; len: number; h: number; c: number; belly: number; fin: number; teeth?: boolean; armor?: boolean }
  | { t: 'jelly'; r: number; c: number }
  | { t: 'trilo'; len: number; c: number }
  | { t: 'shell'; r: number; c: number }
  | {
      t: 'bug'; len: number; h: number; segs: number; c: number; legs: number;
      wings?: boolean; pincers?: boolean; stinger?: 'up' | 'straight'; antenna?: boolean; crystal?: boolean; paddles?: boolean;
    }
  | { t: 'frog'; w: number; h: number; c: number; belly: number; sac?: number }
  | {
      t: 'quad'; len: number; bh: number; leg: number; head: number; headH: number; tail: number; tailW?: number;
      c: number; belly: number; biped?: boolean; stripes?: boolean; spots?: boolean; plates?: boolean; spikes?: boolean;
      club?: boolean; frill?: boolean; crest?: boolean; horn?: 'rhino'; fangs?: boolean; sabre?: boolean; tusks?: boolean;
      trunk?: boolean; ears?: boolean; fur?: boolean; arms?: boolean; stone?: boolean; glow?: number;
    }
  | { t: 'bird'; span: number; c: number; belly: number; ptero?: boolean; crest?: boolean }
  | { t: 'shade'; r: number; c: number; glow: number }
  | { t: 'crystal'; w: number; h: number; c: number; glow: number; eye?: boolean };

export interface EnemyDef {
  id: string;
  name: string;
  art: Art;
  hp: number;
  dmg: number;
  speed: number;
  /** EVO-Punkte, die das Fleisch dieses Gegners bringt. */
  evo: number;
  move: Move;
  /** Fliegt/schwebt: keine Schwerkraft, keine Kollision mit dem Boden. */
  air?: boolean;
  /** Hitbox als Anteil der Bildgröße. */
  hit?: [number, number];
  shot?: { tex: string; speed: number; dmg: number; every: number; arc?: boolean };
  boss?: boolean;
}

const E = (d: EnemyDef) => d;

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
  [
    // ---------- Urozean ----------
    E({ id: 'kleinfisch', name: 'Kleinfisch', art: { t: 'fish', len: 30, h: 14, c: 0x9fc3d8, belly: 0xeef6fb, fin: 0x6d9cbf }, hp: 3, dmg: 2, speed: 70, evo: 3, move: 'swim' }),
    E({ id: 'qualle', name: 'Qualle', art: { t: 'jelly', r: 15, c: 0xff8fd0 }, hp: 4, dmg: 3, speed: 30, evo: 4, move: 'drift', hit: [0.7, 0.7] }),
    E({ id: 'trilobit', name: 'Trilobit', art: { t: 'trilo', len: 38, c: 0x8a6a48 }, hp: 5, dmg: 2, speed: 40, evo: 4, move: 'crawl' }),
    E({ id: 'ammonit', name: 'Ammonit', art: { t: 'shell', r: 16, c: 0xe08a3a }, hp: 6, dmg: 3, speed: 55, evo: 5, move: 'swimChase' }),
    E({ id: 'raubfisch', name: 'Raubfisch', art: { t: 'fish', len: 46, h: 20, c: 0x5f8f5a, belly: 0xd8e8c0, fin: 0x3f6f3a, teeth: true }, hp: 9, dmg: 4, speed: 95, evo: 7, move: 'swimChase' }),
    E({ id: 'seeskorpion', name: 'Seeskorpion', art: { t: 'bug', len: 60, h: 16, segs: 7, c: 0x8a3a2a, legs: 3, pincers: true, paddles: true, stinger: 'straight' }, hp: 11, dmg: 4, speed: 70, evo: 8, move: 'swimChase' }),
    E({ id: 'panzerfisch', name: 'Panzerfisch', art: { t: 'fish', len: 210, h: 96, c: 0x5a6f7a, belly: 0xc9d2d0, fin: 0x3e4f58, armor: true, teeth: true }, hp: 120, dmg: 6, speed: 90, evo: 60, move: 'boss', boss: true, hit: [0.8, 0.7] }),

    // ---------- Sümpfe ----------
    E({ id: 'libelle', name: 'Urlibelle', art: { t: 'bug', len: 52, h: 8, segs: 9, c: 0x2fb5a8, legs: 3, wings: true }, hp: 8, dmg: 5, speed: 90, evo: 7, move: 'fly', air: true, hit: [0.7, 0.5] }),
    E({ id: 'tausendfuessler', name: 'Tausendfüßler', art: { t: 'bug', len: 84, h: 16, segs: 11, c: 0x7a4a2a, legs: 10, antenna: true }, hp: 14, dmg: 5, speed: 55, evo: 9, move: 'patrol' }),
    E({ id: 'kroete', name: 'Krötenmolch', art: { t: 'frog', w: 40, h: 28, c: 0x7a8a3a, belly: 0xd8d89a }, hp: 10, dmg: 6, speed: 110, evo: 8, move: 'hop' }),
    E({ id: 'skorpion', name: 'Riesenskorpion', art: { t: 'bug', len: 60, h: 18, segs: 6, c: 0x4a2f2a, legs: 4, pincers: true, stinger: 'up' }, hp: 16, dmg: 7, speed: 75, evo: 12, move: 'chase' }),
    E({ id: 'spucklurch', name: 'Spucklurch', art: { t: 'frog', w: 44, h: 30, c: 0x7a4a9a, belly: 0xe0c8f0, sac: 0xd05ad0 }, hp: 12, dmg: 6, speed: 40, evo: 11, move: 'shoot', shot: { tex: 'pr_slime', speed: 300, dmg: 6, every: 2300, arc: true } }),
    E({ id: 'riesenlibelle', name: 'Riesenlibelle', art: { t: 'bug', len: 220, h: 30, segs: 10, c: 0x1f9aa0, legs: 3, wings: true }, hp: 220, dmg: 10, speed: 120, evo: 120, move: 'boss', boss: true, air: true, hit: [0.6, 0.45] }),

    // ---------- Zeitalter der Reptilien ----------
    E({ id: 'raptor', name: 'Kleiner Raptor', art: { t: 'quad', len: 40, bh: 22, leg: 30, biped: true, head: 26, headH: 14, tail: 44, c: 0x6f8f3a, belly: 0xd8e0a0, stripes: true, arms: true, fangs: true }, hp: 22, dmg: 11, speed: 150, evo: 14, move: 'chase', hit: [0.55, 0.8] }),
    E({ id: 'flugsaurier', name: 'Flugsaurier', art: { t: 'bird', span: 110, c: 0xc0805a, belly: 0xf0d0b0, ptero: true, crest: true }, hp: 18, dmg: 10, speed: 110, evo: 13, move: 'swoop', air: true, hit: [0.5, 0.6] }),
    E({ id: 'panzerechse', name: 'Panzerechse', art: { t: 'quad', len: 64, bh: 26, leg: 14, head: 20, headH: 14, tail: 40, c: 0x8a7a5a, belly: 0xc0b090, plates: true, club: true }, hp: 44, dmg: 11, speed: 40, evo: 20, move: 'patrol', hit: [0.7, 0.8] }),
    E({ id: 'spuckechse', name: 'Spuckechse', art: { t: 'quad', len: 38, bh: 22, leg: 28, biped: true, head: 24, headH: 14, tail: 40, c: 0x9ab040, belly: 0xe8f0a0, frill: true, crest: true, arms: true }, hp: 24, dmg: 10, speed: 60, evo: 16, move: 'shoot', hit: [0.55, 0.8], shot: { tex: 'pr_acid', speed: 330, dmg: 10, every: 2100, arc: true } }),
    E({ id: 'stachelechse', name: 'Stachelechse', art: { t: 'quad', len: 54, bh: 24, leg: 16, head: 22, headH: 15, tail: 36, c: 0xb04a3a, belly: 0xf0b090, spikes: true }, hp: 30, dmg: 13, speed: 70, evo: 18, move: 'charge', hit: [0.7, 0.8] }),
    E({ id: 'trex', name: 'Tyrannosaurus', art: { t: 'quad', len: 150, bh: 80, leg: 92, biped: true, head: 92, headH: 52, tail: 160, tailW: 50, c: 0x6a7a4a, belly: 0xc8c098, stripes: true, arms: true, fangs: true }, hp: 420, dmg: 18, speed: 80, evo: 220, move: 'boss', boss: true, hit: [0.5, 0.8] }),

    // ---------- Eiszeit ----------
    E({ id: 'eiswolf', name: 'Eiswolf', art: { t: 'quad', len: 50, bh: 24, leg: 26, head: 28, headH: 18, tail: 30, c: 0xb8c0cc, belly: 0xeef2f6, fur: true, ears: true, fangs: true }, hp: 38, dmg: 17, speed: 170, evo: 22, move: 'chase', hit: [0.65, 0.8] }),
    E({ id: 'hoehlenbaer', name: 'Höhlenbär', art: { t: 'quad', len: 72, bh: 42, leg: 26, head: 30, headH: 26, tail: 8, c: 0x6a4a32, belly: 0x9a7a5a, fur: true, ears: true }, hp: 75, dmg: 20, speed: 60, evo: 32, move: 'patrol', hit: [0.75, 0.85] }),
    E({ id: 'riesenvogel', name: 'Schneegeier', art: { t: 'bird', span: 120, c: 0xeef2f6, belly: 0xcfd8e2 }, hp: 32, dmg: 16, speed: 120, evo: 22, move: 'swoop', air: true, hit: [0.5, 0.6] }),
    E({ id: 'wollnashorn', name: 'Wollnashorn', art: { t: 'quad', len: 80, bh: 40, leg: 24, head: 36, headH: 24, tail: 12, c: 0x8a6a4a, belly: 0xb09070, fur: true, horn: 'rhino', ears: true }, hp: 85, dmg: 22, speed: 70, evo: 36, move: 'charge', hit: [0.75, 0.85] }),
    E({ id: 'mammut', name: 'Jungmammut', art: { t: 'quad', len: 90, bh: 56, leg: 34, head: 40, headH: 40, tail: 14, c: 0x7a4a2a, belly: 0xa06a42, fur: true, tusks: true, trunk: true, ears: true }, hp: 100, dmg: 22, speed: 45, evo: 40, move: 'patrol', hit: [0.7, 0.85] }),
    E({ id: 'saebelzahn', name: 'Säbelzahntiger', art: { t: 'quad', len: 150, bh: 64, leg: 66, head: 70, headH: 46, tail: 50, c: 0xd8a050, belly: 0xf6e2c0, sabre: true, ears: true, spots: true }, hp: 650, dmg: 26, speed: 120, evo: 350, move: 'boss', boss: true, hit: [0.65, 0.8] }),

    // ---------- Eden ----------
    E({ id: 'schatten', name: 'Schattenwesen', art: { t: 'shade', r: 22, c: 0x3a2a5a, glow: 0xc070ff }, hp: 48, dmg: 24, speed: 90, evo: 30, move: 'float', air: true, hit: [0.6, 0.6] }),
    E({ id: 'kristallkaefer', name: 'Kristallkäfer', art: { t: 'bug', len: 50, h: 22, segs: 3, c: 0x4a5a8a, legs: 3, crystal: true, antenna: true }, hp: 64, dmg: 24, speed: 70, evo: 32, move: 'patrol' }),
    E({ id: 'steinwaechter', name: 'Steinwächter', art: { t: 'quad', len: 58, bh: 40, leg: 26, head: 30, headH: 26, tail: 10, c: 0x8a8a90, belly: 0xb0b0b8, stone: true, glow: 0x60f0ff }, hp: 95, dmg: 28, speed: 90, evo: 45, move: 'hop', hit: [0.75, 0.85] }),
    E({ id: 'irrlicht', name: 'Irrlicht', art: { t: 'crystal', w: 26, h: 36, c: 0x8ae8ff, glow: 0x60d0ff }, hp: 42, dmg: 22, speed: 70, evo: 30, move: 'fly', air: true, shot: { tex: 'pr_shard', speed: 300, dmg: 22, every: 2600 } }),
    E({ id: 'kristall', name: 'Kristallwächter', art: { t: 'crystal', w: 150, h: 210, c: 0xa060ff, glow: 0xd090ff, eye: true }, hp: 1000, dmg: 32, speed: 100, evo: 500, move: 'boss', boss: true, air: true, hit: [0.55, 0.7] }),
  ].map((d) => [d.id, d]),
);
