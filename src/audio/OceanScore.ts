// Ein eigenes, ruhiges Klavierstück: einfache Moll-Harmonik, wenige Melodietöne und lange Atempausen.
// Keine Drums, kein Swing und kein Rauschen in der Musik. Die Wasseratmosphäre hat eine eigene Spur.

export interface ScoreMood { depth?: number; threat?: number }
export type ScoreMode = 'level' | 'title' | 'still';
interface Note { at: number; midi: number; velocity: number }

// Acht zusammenhängende Phrasen über D-Moll, B-Dur, F-Dur und C-Dur. Keine Jazz-Erweiterungen.
// Begleitung und Melodie antworten einander; die letzte Phrase lässt die Melodie auf D zur Ruhe kommen.
const PHRASES = [
  { bass: [50, 57], melody: [69, 65, 64, 62] },
  { bass: [46, 53], melody: [65, 69, 67, 65] },
  { bass: [53, 60], melody: [69, 72, 69, 67] },
  { bass: [48, 55], melody: [67, 64, 62, 64] },
  { bass: [50, 57], melody: [65, 69, 74, 72] },
  { bass: [46, 53], melody: [70, 69, 67, 65] },
  { bass: [48, 55], melody: [64, 67, 65, 64] },
  { bass: [50, 57], melody: [65, 64, 62, 62] },
];
const PIECE: Note[] = PHRASES.flatMap((phrase, i) => [
  { at: i * 20, midi: phrase.bass[0], velocity: 0.038 },
  { at: i * 20 + 0.85, midi: phrase.bass[1], velocity: 0.021 },
  ...phrase.melody.map((midi, j) => ({ at: i * 20 + [3.1, 7.5, 12.6, 16.2][j], midi, velocity: [0.055, 0.044, 0.05, 0.036][j] })),
]);
const LENGTH = 168;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class OceanScore {
  readonly out: GainNode;
  private duck: GainNode;
  private tone: BiquadFilterNode;
  private input: GainNode;
  private voices = new Set<OscillatorNode>();
  private depthTo = 0;
  private threatTo = 0;
  depth = 0;
  threat = 0;
  private lastT: number;
  private origin: number;
  private index = 0;
  private cycle = 0;
  private modeName: ScoreMode = 'level';
  private lossUntil = -1;
  private stopped = false;

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.lastT = t0;
    this.origin = t0 + 0.25;
    this.out = this.gain(0, dest);
    this.duck = this.gain(1, this.out);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';this.tone.frequency.value = 4200;this.tone.Q.value = 0.4;
    this.tone.connect(this.duck);
    this.input = this.gain(0.92, this.tone);
    // Zwei sehr leise Raumantworten, ohne Rauschimpuls und ohne rückgekoppelte Echo-Schleife.
    for (const [seconds, wet] of [[0.29, 0.09], [0.61, 0.035]]) {
      const delay = ctx.createDelay(1);delay.delayTime.value = seconds;
      this.input.connect(delay);delay.connect(this.gain(wet, this.tone));
    }
    this.out.gain.setTargetAtTime(0.76, t0, 1.6);
  }

  private gain(value: number, dest: AudioNode) {
    const g = this.ctx.createGain();g.gain.value = value;g.connect(dest);return g;
  }

  /** Klavierartige Saiten: kurzer weicher Anschlag, rasch abklingende Obertöne, länger tragender Grundton. */
  private piano(t: number, midi: number, velocity: number) {
    const deep = this.depth;
    const note = midi - (deep > 0.58 ? 12 : 0);
    const f = 440 * Math.pow(2, (note - 69) / 12);
    const stereo = this.ctx.createStereoPanner();stereo.pan.value = Math.max(-0.2, Math.min(0.2, (note - 60) * 0.012));
    stereo.connect(this.input);
    const quiet = this.modeName === 'still' ? 0.7 : 1;
    const weights = [0.8, 0.29, 0.11, 0.045, 0.018, 0.007];
    const durations = [6.8, 4.2, 2.5, 1.7, 1.1, 0.75];
    let remaining = weights.length;
    weights.forEach((weight, i) => {
      const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
      const partial = i + 1, duration = durations[i] * (deep > 0.58 ? 1.12 : 1);
      osc.frequency.value = f * partial * Math.sqrt(1 + 0.000045 * partial * partial);
      const peak = velocity * weight * quiet * (1 - deep * i * 0.07);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + 0.007);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.000001, peak * 0.52), t + 0.24 / (1 + i * 0.3));
      amp.gain.exponentialRampToValueAtTime(Math.max(0.000001, peak * 0.07), t + duration * 0.47);
      amp.gain.exponentialRampToValueAtTime(0.000001, t + duration);
      amp.gain.linearRampToValueAtTime(0, t + duration + 0.025);
      osc.connect(amp);amp.connect(stereo);this.voices.add(osc);
      osc.onended = () => {
        osc.disconnect();amp.disconnect();this.voices.delete(osc);
        if (--remaining === 0) stereo.disconnect();
        if (this.stopped && this.voices.size === 0) this.out.disconnect();
      };
      osc.start(t);osc.stop(t + duration + 0.04);
    });
  }

  set(m: ScoreMood) {
    if (m.depth !== undefined) this.depthTo = clamp01(m.depth);
    if (m.threat !== undefined) this.threatTo = clamp01(m.threat);
  }
  mode(m: ScoreMode) {
    this.modeName = m;
    if (m !== 'level') this.set({ depth: m === 'still' ? 0.15 : 0.05, threat: 0 });
  }
  loss(t: number) {
    if (this.stopped || t < this.lossUntil) return;
    this.lossUntil = t + 7;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.22, t, 0.2);
    this.duck.gain.setTargetAtTime(1, t + 3, 1.5);
  }

  /** Plant bis zur Audiozeit t voraus. Überfällige Töne werden ausgelassen, niemals gebündelt nachgeholt. */
  tick(t: number) {
    if (this.stopped) return;
    const dt = Math.max(0, Math.min(2, t - this.lastT));this.lastT = t;
    this.depth += (this.depthTo - this.depth) * (1 - Math.exp(-dt / 3));
    this.threat += (this.threatTo - this.threat) * (1 - Math.exp(-dt / 6));
    this.tone.frequency.setTargetAtTime(1050 + 3150 * (1 - this.depth) ** 2, t, 1.2);
    // Nach langen Unterbrechungen direkt zur aktuellen Runde springen, ohne eine Ereignisschleife nachzuarbeiten.
    const round = Math.max(0, Math.floor((this.ctx.currentTime - this.origin) / LENGTH));
    if (round > this.cycle) { this.cycle = round;this.index = 0; }
    for (;;) {
      const event = PIECE[this.index], at = this.origin + this.cycle * LENGTH + event.at;
      if (at > t) break;
      if (at >= this.ctx.currentTime + 0.015 && at >= this.lossUntil) this.piano(at, event.midi, event.velocity);
      if (++this.index === PIECE.length) { this.index = 0;this.cycle++; }
    }
  }

  stop(t: number) {
    if (this.stopped) return;
    this.stopped = true;this.out.gain.cancelScheduledValues(t);this.out.gain.setTargetAtTime(0, t, 0.35);
    for (const voice of this.voices) voice.stop(t + 2);
    if (this.voices.size === 0) this.out.disconnect();
  }
}
