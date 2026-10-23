/** Musical controls are independent from Phaser, so game signals and the arrangement can be tested directly. */
export interface ScoreMood { depth?: number; threat?: number; injury?: number }
export type ScoreMode = 'level' | 'title' | 'still';
export interface MusicState { depth: number; threat: number; injury: number }
export const unit = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

export function musicalTension(m: Pick<MusicState, 'threat' | 'injury'>): number {
  return 1 - (1 - unit(m.threat)) * (1 - unit(m.injury));
}

/** Warn promptly, then relax slowly, without switching the piece on/off between pursuit frames. */
export function followMood(current: MusicState, target: MusicState, seconds: number): MusicState {
  const follow = (a: number, b: number, rise: number, fall: number) => a + (b - a) * (1 - Math.exp(-Math.max(0, seconds) / (b > a ? rise : fall)));
  return {
    depth: follow(current.depth, unit(target.depth), 3, 3),
    threat: follow(current.threat, unit(target.threat), 0.8, 5),
    injury: follow(current.injury, unit(target.injury), 0.65, 4),
  };
}

interface Listener { x: number; y: number; hp: number; maxHp: number; power: number; underwater: boolean }
interface Hunter {
  x: number; y: number; dead: boolean; kin?: boolean; ally?: boolean; role: string;
  power: number; hunting: boolean; large?: boolean;
}

export function worldMusicMood(player: Listener, hunters: Iterable<Hunter>, surface: number, bottom: number): MusicState {
  const hp = unit(player.hp / Math.max(1, player.maxHp));
  const injury = unit((0.45 - hp) / 0.45);
  let threat = 0;
  for (const h of hunters) {
    if (h.dead || h.kin || h.ally || h.role === 'prey' || h.role === 'hazard') continue;
    const near = unit(1 - Math.max(0, Math.hypot(h.x - player.x, h.y - player.y) - 200) / 1300);
    const strength = Math.max(0.35, Math.min(1, h.power / Math.max(0.1, player.power * 1.5)));
    const danger = h.hunting ? 0.55 + 0.45 * strength : h.large ? 0.28 * strength : 0;
    threat = Math.max(threat, near * danger);
  }
  return { depth: player.underwater ? unit((player.y - surface) / Math.max(300, bottom - surface)) : 0, threat, injury };
}

/** Old ocean motifs, translated from the D overtone series onto piano keys; their contours remain recognizable. */
export const OCEAN_MOTIFS = [[69, 72, 70], [74, 79, 76, 72], [65, 64, 69], [70, 69, 74]] as const;

/** Dark modal folk harmony: D minor, open fifths, suspended/add9 voicings and a harmonic-minor cadence. */
export const PIANO_HARMONY = [
  { bass: 38, notes: [57, 62, 65, 69, 74] },
  { bass: 34, notes: [53, 58, 62, 65, 69] }, // Bbmaj7
  { bass: 41, notes: [57, 60, 65, 69, 72] },
  { bass: 36, notes: [55, 60, 64, 67, 74] }, // C(add9)
  { bass: 43, notes: [55, 58, 62, 65, 69] }, // Gm9
  { bass: 45, notes: [57, 62, 64, 69, 74] }, // Asus4
  { bass: 45, notes: [57, 61, 64, 67, 73] }, // A7: C# resolves to D
  { bass: 38, notes: [57, 62, 65, 69, 74] },
] as const;

export interface PianoEvent { midi: number; velocity: number; hold: number; voice: 'bass' | 'arp' | 'melody' }

/** One eighth-note of the inherited soundtrack, with left-hand broken chords and a distinct right-hand melody. */
export function pianoPhrase(bar: number, step: number, depth: number, mode: ScoreMode): PianoEvent[] {
  const chord = PIANO_HARMONY[bar % PIANO_HARMONY.length];
  const octave = depth > 0.68 ? -12 : 0;
  const result: PianoEvent[] = [];
  if (step === 0 || (step === 4 && mode !== 'still')) result.push({ midi: chord.bass, velocity: step === 0 ? 0.38 : 0.25, hold: 2.8, voice: 'bass' });
  if (mode !== 'still' || step % 2 === 0) {
    const pattern = bar % 4 === 3 ? [0, 2, 1, 3, 0, 1, 2, 4] : [0, 1, 2, 1, 0, 2, 3, 1];
    result.push({ midi: chord.notes[pattern[step]] + octave, velocity: step % 4 === 0 ? 0.31 : 0.24, hold: 1.7 + depth, voice: 'arp' });
  }
  const motif = OCEAN_MOTIFS[Math.floor(bar / 2) % OCEAN_MOTIFS.length];
  if (step % 2 === 0 && (bar % 2 === 0 || mode === 'title')) {
    const note = motif[step / 2];
    if (note !== undefined) result.push({ midi: note + octave, velocity: 0.57, hold: 2.6 + depth, voice: 'melody' });
  } else if (bar % 2 === 1 && step === 6) {
    result.push({ midi: chord.notes[3] + octave, velocity: 0.35, hold: 2.9, voice: 'melody' });
  }
  return result;
}
