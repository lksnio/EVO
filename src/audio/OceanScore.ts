// Leichter Jazz-Hip-Hop für den Ozean: weiches Klavier, gedämpfte Drums und viel Luft.
// Die Instrumente entstehen einmal als kurze PCM-Klänge; keine Downloads oder Daueroszillatoren.
// In der Tiefe verstummen Klavier UND Klavierhall vollständig. Nur ein sparsames Drumset bleibt.

export interface ScoreMood {
  depth?: number;
  threat?: number;
}
export type ScoreMode = 'level' | 'title' | 'still';

const BPM = 74;
const STEP = 60 / BPM / 4;
// Dm9 – G13 – Cmaj9 – Am9, offene, weich verbundene Voicings ohne zusätzliche Bassspur.
const CHORDS = [[53, 60, 64, 69], [55, 59, 64, 69], [52, 59, 62, 67], [55, 60, 64, 71]];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
type Drum = 'kick' | 'rim' | 'hat' | 'tom';

/** Ein kurzer, dunkler Raum statt einer dauernden Hallfläche. */
function room(ctx: BaseAudioContext) {
  const len = Math.floor(ctx.sampleRate * 1.7), buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < len; i++) {
      low += (Math.random() * 2 - 1 - low) * 0.18;
      data[i] = low * Math.pow(1 - i / len, 3) * Math.min(1, i / (ctx.sampleRate * 0.018));
    }
  }
  return buffer;
}

export class OceanScore {
  readonly out: GainNode;
  private duck: GainNode;
  private pianoBus: GainNode;
  private pianoSend: GainNode;
  private pianoTone: BiquadFilterNode;
  private drumTone: BiquadFilterNode;
  private drums = new Map<Drum, AudioBuffer>();
  private notes = new Map<number, AudioBuffer>();
  private sources = new Set<AudioBufferSourceNode>();
  private depthTo = 0;
  private threatTo = 0;
  depth = 0;
  threat = 0;
  private lastT: number;
  private next: number;
  private step = 0;
  private modeName: ScoreMode = 'level';
  private lossUntil = -1;
  private stopped = false;

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.lastT = t0;
    this.next = t0 + 0.15;
    this.out = this.gain(0, dest);
    this.duck = this.gain(1, this.out);
    // Auch die Hallrückgabe liegt VOR dem Tiefenregler: unten bleibt kein melodischer Rest.
    this.pianoBus = this.gain(1, this.duck);
    this.pianoTone = this.filter(3400, this.pianoBus);
    const reverb = ctx.createConvolver();
    reverb.buffer = room(ctx);
    reverb.connect(this.gain(0.22, this.pianoBus));
    this.pianoSend = this.gain(0.28, reverb);
    this.drumTone = this.filter(3800, this.gain(0.78, this.duck));
    for (const kind of ['kick', 'rim', 'hat', 'tom'] as const) this.drums.set(kind, this.makeDrum(kind));
    this.out.gain.setTargetAtTime(0.68, t0, 2.5);
  }

  private gain(value: number, to: AudioNode) {
    const node = this.ctx.createGain();
    node.gain.value = value;
    node.connect(to);
    return node;
  }

  private filter(frequency: number, to: AudioNode) {
    const node = this.ctx.createBiquadFilter();
    node.type = 'lowpass';
    node.frequency.value = frequency;
    node.Q.value = 0.45;
    node.connect(to);
    return node;
  }

  /** Filziger Anschlag, leicht unharmonische Saiten, rasch verklingende Höhen und ein warmer Grundton. */
  private pianoSample(midi: number) {
    const cached = this.notes.get(midi);
    if (cached) return cached;
    const sr = this.ctx.sampleRate, seconds = 3.6;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sr * seconds), sr), data = buffer.getChannelData(0);
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    const weights = [1, 0.38, 0.16, 0.07, 0.035, 0.015];
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      let value = 0;
      for (let h = 0; h < weights.length; h++) {
        const n = h + 1, f = frequency * n * Math.sqrt(1 + 0.00012 * n * n);
        value += Math.sin(2 * Math.PI * f * t) * weights[h] * Math.exp(-t * (1.5 + h * 1.45));
      }
      const attack = 1 - Math.exp(-t / 0.004);
      data[i] = (value * attack + (Math.random() * 2 - 1) * 0.008 * Math.exp(-t / 0.009))
        * Math.min(1, (seconds - t) / 0.18);
      peak = Math.max(peak, Math.abs(data[i]));
    }
    for (let i = 0; i < data.length; i++) data[i] *= 0.82 / Math.max(0.01, peak);
    this.notes.set(midi, buffer);
    return buffer;
  }

  /** Eine runde Kick, leiser Rim-/Besenklang, geschlossene Hi-Hat und ein tiefer, kurzer Tom. */
  private makeDrum(kind: Drum) {
    const sr = this.ctx.sampleRate, seconds = kind === 'hat' ? 0.075 : kind === 'rim' ? 0.16 : 0.3;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sr * seconds), sr), data = buffer.getChannelData(0);
    let phase = 0, low = 0, body = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr, noise = Math.random() * 2 - 1;
      low += (noise - low) * 0.28;
      body += (low - body) * 0.035;
      if (kind === 'kick' || kind === 'tom') {
        const f = kind === 'kick' ? 46 + 68 * Math.exp(-t / 0.025) : 92 + 55 * Math.exp(-t / 0.045);
        phase += 2 * Math.PI * f / sr;
        data[i] = Math.sin(phase) * Math.exp(-t / (kind === 'kick' ? 0.075 : 0.095)) * 0.8;
      } else if (kind === 'rim') {
        data[i] = (low - body) * Math.exp(-t / 0.033) * 0.6
          + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.022) * 0.18;
      } else data[i] = (noise - low) * Math.exp(-t / 0.017) * 0.23;
      data[i] *= Math.min(1, t / 0.002) * Math.min(1, (seconds - t) / 0.012);
    }
    return buffer;
  }

  private play(buffer: AudioBuffer, t: number, velocity: number, to: AudioNode, pan = 0, send?: AudioNode) {
    if (velocity < 0.0001) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const amp = this.ctx.createGain();
    amp.gain.value = velocity;
    const stereo = this.ctx.createStereoPanner();
    stereo.pan.value = pan;
    source.connect(amp);amp.connect(stereo);stereo.connect(to);
    if (send) stereo.connect(send);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();amp.disconnect();stereo.disconnect();this.sources.delete(source);
      if (this.stopped && this.sources.size === 0) this.out.disconnect();
    };
    source.start(Math.max(t, this.ctx.currentTime + 0.005));
  }

  set(m: ScoreMood) {
    if (m.depth !== undefined) this.depthTo = clamp01(m.depth);
    if (m.threat !== undefined) this.threatTo = clamp01(m.threat);
  }

  mode(m: ScoreMode) {
    this.modeName = m;
    if (m !== 'level') this.set({ threat: 0, depth: m === 'still' ? 0.15 : 0.05 });
  }

  /** Beim Verlust nur kurz Platz lassen – kein zusätzlicher Ton und kein dramatischer Effekt. */
  loss(t: number) {
    if (this.stopped || t < this.lossUntil) return;
    this.lossUntil = t + 6;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.22, t, 0.18);
    this.duck.gain.setTargetAtTime(1, t + 2.8, 1.2);
  }

  /** Absolute Audiozeit: live mit Vorlauf, für Hörproben auch im OfflineAudioContext nutzbar. */
  tick(t: number) {
    if (this.stopped) return;
    const dt = Math.max(0, Math.min(2, t - this.lastT));
    this.lastT = t;
    this.depth += (this.depthTo - this.depth) * (1 - Math.exp(-dt / 3));
    this.threat += (this.threatTo - this.threat) * (1 - Math.exp(-dt / 5));
    const deep = smooth(0.3, 0.65, this.depth);
    this.pianoBus.gain.setTargetAtTime(1 - deep, t, 0.65);
    this.pianoTone.frequency.setTargetAtTime(1500 + 1900 * (1 - deep), t, 1);
    this.drumTone.frequency.setTargetAtTime(1700 + 2100 * (1 - deep), t, 1);
    // Nach einem ausgesetzten Browser-Tab keine versäumten Schläge nachholen.
    if (this.next < t - 0.5) {
      this.step += Math.ceil((t - this.next) / STEP);
      this.next = t + 0.04;
    }
    while (this.next <= t) {
      this.schedule(this.step, this.next, deep);
      this.next += STEP;
      this.step++;
    }
  }

  private schedule(step: number, at: number, deep: number) {
    const s = step % 16, bar = Math.floor(step / 16);
    const quiet = this.modeName === 'still' ? 0.65 : 1;
    const t = at + (s % 4 >= 2 ? 0.048 : 0) + rnd(0, 0.008);
    const drum = (kind: Drum, volume: number, depthMix: number) => {
      this.play(this.drums.get(kind)!, t + (kind === 'rim' ? 0.012 : 0), volume * depthMix * quiet * rnd(0.88, 1.04), this.drumTone, kind === 'hat' ? 0.16 : 0);
    };
    // Langsamer, lockerer Hip-Hop-Pocket mit wenigen Schlägen und ohne Fill-Dauerfeuer.
    if (s === 0 || s === 8) drum('kick', 0.072, 1 - deep);
    if (s === 4 || (s === 12 && bar % 4 !== 3)) drum('rim', 0.09, 1 - deep);
    if ([2, 6, 10, 14].includes(s) && (bar % 4 !== 3 || s === 6)) drum('hat', 0.042, 1 - deep);
    // Unten bleibt nur Schlagzeug: versetzte, gedämpfte Akzente mit langen Lücken dazwischen.
    if (bar % 2 === 0 && (s === 0 || s === 10)) drum('kick', 0.055, deep);
    if (bar % 2 === 1 && (s === 6 || s === 14)) drum('rim', 0.065, deep);
    if (s === 2 && bar % 2 === 1) drum('hat', 0.03, deep);
    if (s === 14 && bar % 4 === 3) drum('tom', 0.038 + 0.006 * this.threat, deep);

    if (deep >= 1 || t < this.lossUntil || bar % 10 >= 8) return;
    const chord = CHORDS[Math.floor((bar % 10) / 2)];
    const piano = (midi: number, delay: number, velocity: number) =>
      this.play(this.pianoSample(midi), t + delay, velocity * quiet, this.pianoTone, -0.12 + (midi - 60) * 0.012, this.pianoSend);
    // Ein Akkord alle zwei Takte; Anschläge sind weich versetzt. Zwei Takte pro Runde schweigen ganz.
    if (s === 0 && bar % 2 === 0) chord.slice(0, 3).forEach((midi, i) => piano(midi, i * 0.026, 0.038 - i * 0.004));
    // Eine kleine Antwort, dann wieder Luft. Kein durchgehendes Solo oder Arpeggio.
    if (s === 10 && bar % 4 === 1) piano(chord[3], 0.02, 0.024);
    if (s === 2 && bar % 4 === 2) piano(chord[2], 0.02, 0.021);
  }

  stop(t: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.45);
    for (const source of this.sources) source.stop(t + 2.5);
    if (this.sources.size === 0) this.out.disconnect();
  }
}
