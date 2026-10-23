import { unit } from './scoreMusic';

const BANK = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
const ANCHORS = [33, 40, 47, 54, 61, 68, 75, 82, 89, 96];
export const PIANO_VOICES = 32;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Struck, slightly inharmonic piano strings. Each register is synthesized once, then reused as a sample. */
function pianoSample(ctx: BaseAudioContext, midi: number): AudioBuffer {
  let bank = BANK.get(ctx);
  if (!bank) BANK.set(ctx, bank = new Map());
  const cached = bank.get(midi);
  if (cached) return cached;
  const rate = 22050, seconds = 4.8 - unit((midi - 36) / 60) * 1.6;
  const buffer = ctx.createBuffer(1, Math.ceil(rate * seconds), rate);
  const data = buffer.getChannelData(0), fundamental = hz(midi);
  for (let harmonic = 1; harmonic <= 22; harmonic++) {
    const frequency = fundamental * harmonic * Math.sqrt(1 + 0.000035 * harmonic * harmonic);
    if (frequency > rate * 0.43) break;
    const weight = (harmonic === 2 ? 1.35 : 1) / harmonic ** 1.4;
    const tau = (3.7 - unit((midi - 36) / 60) * 1.9) / (1 + 0.2 * harmonic ** 1.4);
    // Recurrences avoid millions of sine/exp calls during a live scene transition.
    for (const cents of [-1.6, 1.6]) {
      const angle = 2 * Math.PI * frequency * 2 ** (cents / 1200) / rate;
      const cs = Math.cos(angle), sn = Math.sin(angle), decay = Math.exp(-1 / (rate * tau));
      let s = 0, c = 1, amp = weight * 0.5;
      for (let i = 0; i < data.length; i++) {
        data[i] += s * amp;
        const next = s * cs + c * sn;
        c = c * cs - s * sn; s = next; amp *= decay;
      }
    }
  }
  let seed = midi * 14741, peak = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const attack = 1 - Math.exp(-i / (rate * 0.0025));
    const hammer = (seed / 2147483648) * 0.035 * Math.exp(-i / (rate * 0.009));
    data[i] = (data[i] + hammer) * attack;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] *= 0.85 / Math.max(0.01, peak);
  bank.set(midi, buffer);
  return buffer;
}

function room(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate, buffer = ctx.createBuffer(2, Math.ceil(rate * 2.5), rate);
  let seed = 314159;
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < d.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      low = low * 0.65 + (seed / 2147483648) * 0.35;
      d[i] = low * (1 - i / d.length) ** 3 * Math.min(1, i / (rate * 0.015));
    }
  }
  return buffer;
}

interface Voice { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; end: number }
export interface PianoColour { depth: number; tension: number }

export class Piano {
  readonly tone: BiquadFilterNode;
  private mix: GainNode;
  private wet: GainNode;
  private verb: ConvolverNode;
  private voices = new Set<Voice>();
  private stopped = false;
  private serial = 0;

  constructor(private ctx: BaseAudioContext, destination: AudioNode) {
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.frequency.value = 5600; this.tone.Q.value = 0.5;
    this.tone.connect(destination);
    this.mix = ctx.createGain(); this.mix.connect(this.tone);
    this.verb = ctx.createConvolver(); this.verb.buffer = room(ctx); this.verb.connect(this.tone);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.18; this.wet.connect(this.verb);
    this.mix.connect(this.wet);
  }

  colour(depth: number, tension: number, time: number) {
    this.tone.frequency.setTargetAtTime(1100 + 4500 * (1 - unit(depth)) ** 1.5 + 400 * unit(tension), time, 1.1);
    this.wet.gain.setTargetAtTime(0.18 + 0.17 * unit(depth), time, 1.5);
  }

  play(midi: number, time: number, velocity: number, hold = 2.6, colour: PianoColour = { depth: 0, tension: 0 }, wrong = false) {
    if (this.stopped) return;
    const ctx = this.ctx, t = Math.max(ctx.currentTime, time);
    midi = Math.max(24, Math.min(96, midi));
    const anchor = ANCHORS.reduce((a, b) => Math.abs(b - midi) < Math.abs(a - midi) ? b : a);
    const buffer = pianoSample(ctx, anchor);
    // Offline renders plan many seconds ahead before onended can run; finished-in-score voices need no voice stealing.
    for (const voice of this.voices) if (voice.end <= t) this.voices.delete(voice);
    if (this.voices.size >= PIANO_VOICES) {
      const oldest = this.voices.values().next().value as Voice;
      oldest.gain.gain.cancelAndHoldAtTime(t);
      oldest.gain.gain.setTargetAtTime(0.0001, t, 0.012);
      oldest.source.stop(t + 0.06);
      this.voices.delete(oldest);
    }
    const source = ctx.createBufferSource(); source.buffer = buffer;
    source.playbackRate.value = 2 ** ((midi - anchor) / 12);
    const tension = unit(colour.tension), sign = this.serial++ % 2 ? -1 : 1;
    source.detune.value = sign * tension * (wrong ? 35 : 22);
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-0.45, Math.min(0.45, (midi - 62) / 70));
    const gain = ctx.createGain();
    const peak = Math.max(0.001, unit(velocity) * 0.27 * (1 - 0.18 * unit(colour.depth)));
    const release = Math.max(0.18, Math.min(hold, buffer.duration / source.playbackRate.value - 0.1));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    gain.gain.setValueAtTime(peak, t + Math.max(0.02, release - 0.16));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + release + 0.3);
    source.connect(gain); gain.connect(pan); pan.connect(this.mix);
    const voice = { source, gain, pan, end: t + release + 0.35 };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); pan.disconnect(); this.voices.delete(voice);
      if (this.stopped && !this.voices.size) this.disconnect();
    };
    source.start(t); source.stop(voice.end);
  }

  stop(time: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.mix.gain.cancelScheduledValues(time);
    this.mix.gain.setTargetAtTime(0.0001, time, 0.15);
    for (const v of this.voices) v.source.stop(Math.min(v.end, time + 0.8));
    if (!this.voices.size) this.disconnect();
  }

  private disconnect() {
    this.mix.disconnect(); this.wet.disconnect(); this.verb.disconnect(); this.tone.disconnect();
  }
}
