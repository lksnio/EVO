// Eine eigene, leise Wasseratmosphäre: langsame Wasserbewegung, einzelne Blasen und kleine Krustentier-/Kiesgeräusche.
// Kein Rhythmus. Lange, überblendete Schleife statt eines kurzen, klickenden Rauschloops.
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class OceanAmbience {
  readonly out: GainNode;
  private bed: GainNode;
  private tone: BiquadFilterNode;
  private noise: AudioBuffer;
  private level = 0;
  private depth = 0;
  private waterAt: number;
  private critterAt: number;
  private loop: AudioBufferSourceNode;
  /** Regen: ein feines, helles Prasseln (eigene Schleife) und einzelne Tropfen, die unter Wasser „plinken“ */
  private rainBed?: GainNode;
  private rain = 0;
  private dropAt = 0;

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.out = ctx.createGain();this.out.gain.value = 0;this.out.connect(dest);
    this.bed = ctx.createGain();this.bed.gain.value = 0.62;this.bed.connect(this.out);
    this.tone = ctx.createBiquadFilter();this.tone.type = 'lowpass';this.tone.frequency.value = 720;this.tone.Q.value = 0.4;
    this.tone.connect(this.bed);
    // 12 kHz reichen für diese gedämpften Wasserklänge; die lange Schleife bleibt auch mobil günstig.
    const sr = 12000, length = sr * 26, cross = sr * 2;
    this.noise = ctx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = this.noise.getChannelData(ch);let a = 0, b = 0;
      for (let i = 0; i < length; i++) {
        a += (Math.random() * 2 - 1 - a) * 0.16;b += (a - b) * 0.035;
        data[i] = (a * 0.55 + b * 0.45) * 0.65;
      }
      // Das Ende geht in den Anfang über; loopStart setzt exakt hinter dem überblendeten Abschnitt fort.
      for (let i = 0; i < cross; i++) {
        const k = 0.5 - 0.5 * Math.cos(Math.PI * i / (cross - 1));
        data[length - cross + i] = data[length - cross + i] * (1 - k) + data[i] * k;
      }
    }
    this.loop = ctx.createBufferSource();this.loop.buffer = this.noise;this.loop.loop = true;
    this.loop.loopStart = cross / sr;this.loop.loopEnd = length / sr;this.loop.connect(this.tone);this.loop.start(t0, cross / sr);
    this.waterAt = t0 + 3.5;this.critterAt = t0 + 7;
  }

  setLevel(level: number, seconds = 1, at = this.ctx.currentTime) {
    const value = Math.max(0, Math.min(0.3, level));
    if (Math.abs(value - this.level) < 0.0001) return;
    this.level = value;
    this.out.gain.setTargetAtTime(this.level * 0.42, at, Math.max(0.08, seconds / 3));
  }
  setDepth(depth: number) { this.depth = Math.max(0, Math.min(1, depth)); }

  /**
   * Regen auf dem Wasser (0 … 1, schon nach der Nähe zur Oberfläche gewichtet). Unter Wasser klingt er als feines, helles
   * Prasseln; dazu schlägt mancher Tropfen eine winzige Luftblase ein, die kurz nach oben „plinkt“ – so klingt echter Regen
   * von unten.
   */
  setRain(level: number, at = this.ctx.currentTime) {
    const v = Math.max(0, Math.min(1, level));
    if (Math.abs(v - this.rain) < 0.01 && (v > 0 || this.rain === 0)) return;
    this.rain = v;
    if (!this.rainBed && v > 0) {
      const ctx = this.ctx;
      // helles Rauschen (eigene, kurze, nahtlose Schleife), schmal um das Prasseln gefiltert
      const sr = ctx.sampleRate, len = Math.floor(sr * 3), cross = Math.floor(sr * 0.25);
      const buf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.random() ** 6);
        for (let i = 0; i < cross; i++) {
          const k = 0.5 - 0.5 * Math.cos(Math.PI * i / (cross - 1));
          d[len - cross + i] = d[len - cross + i] * (1 - k) + d[i] * k;
        }
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = cross / sr; src.loopEnd = len / sr;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.4;
      this.rainBed = ctx.createGain(); this.rainBed.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(this.rainBed); this.rainBed.connect(this.out);
      src.start(at, cross / sr);
      this.dropAt = at + 0.3;
    }
    this.rainBed?.gain.setTargetAtTime(v * 0.6, at, 1.2);
  }

  tick(t: number) {
    if (this.level <= 0) return;
    const now = this.ctx.currentTime;
    // Regentropfen: je stärker der Regen, desto dichter (nie gleichmäßig)
    if (this.rain > 0.02) {
      if (this.dropAt < now) this.dropAt = now + 0.05;
      while (this.dropAt <= t) {
        this.plink(this.dropAt);
        this.dropAt += rnd(0.04, 0.5) / (0.25 + this.rain * 1.6);
      }
    }
    this.tone.frequency.setTargetAtTime(340 + 440 * (1 - this.depth), t, 1.5);
    this.bed.gain.setTargetAtTime(0.55 + Math.sin(t * 0.29) * 0.15 + Math.sin(t * 0.073) * 0.12, t, 0.8);
    if (this.waterAt < now) this.waterAt = now + rnd(2, 5);
    if (this.critterAt < now) this.critterAt = now + rnd(5, 9);
    if (this.waterAt <= t) { this.water(this.waterAt);this.waterAt += rnd(12, 23); }
    if (this.critterAt <= t) { this.critter(this.critterAt);this.critterAt += rnd(18, 34); }
  }

  private burst(t: number, duration: number, frequency: number, volume: number, pan: number) {
    const source = this.ctx.createBufferSource();source.buffer = this.noise;
    const tone = this.ctx.createBiquadFilter();tone.type = 'bandpass';tone.frequency.value = frequency;tone.Q.value = 0.65;
    const amp = this.ctx.createGain();amp.gain.setValueAtTime(0, t);amp.gain.linearRampToValueAtTime(volume, t + Math.min(0.045, duration * 0.15));
    amp.gain.exponentialRampToValueAtTime(0.000001, t + duration);amp.gain.linearRampToValueAtTime(0, t + duration + 0.02);
    const stereo = this.ctx.createStereoPanner();stereo.pan.value = pan;
    source.connect(tone);tone.connect(amp);amp.connect(stereo);stereo.connect(this.out);
    source.onended = () => { source.disconnect();tone.disconnect();amp.disconnect();stereo.disconnect(); };
    source.start(t, rnd(2, 20));source.stop(t + duration + 0.03);
  }

  private water(t: number) {
    const pan = rnd(-0.55, 0.55);
    this.burst(t, rnd(0.65, 1.3), 500 + 450 * (1 - this.depth), 0.65, pan);
    // Kleine aufsteigende Wasserblasen, kein musikalisch gestimmter Ton.
    for (let i = 0; i < 2; i++) {
      const at = t + 0.15 + i * 0.24, osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
      osc.frequency.setValueAtTime(rnd(170, 240), at);osc.frequency.exponentialRampToValueAtTime(rnd(330, 430), at + 0.11);
      amp.gain.setValueAtTime(0, at);amp.gain.linearRampToValueAtTime(0.045, at + 0.015);amp.gain.exponentialRampToValueAtTime(0.000001, at + 0.13);
      osc.connect(amp);amp.connect(this.out);osc.onended = () => { osc.disconnect();amp.disconnect(); };osc.start(at);osc.stop(at + 0.15);
    }
  }

  /** Ein Tropfen schlägt eine winzige Blase ein: ein kurzer, heller Ton, der schnell nach oben gleitet und verklingt. */
  private plink(t: number) {
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain(), stereo = this.ctx.createStereoPanner();
    const f = rnd(1300, 3600) * (1 - this.depth * 0.3), up = rnd(1.25, 1.7), d = rnd(0.035, 0.08);
    osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * up, t + d);
    const v = rnd(0.08, 0.24) * Math.min(1, 0.4 + this.rain);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(v, t + 0.003); amp.gain.exponentialRampToValueAtTime(0.000001, t + d);
    stereo.pan.value = rnd(-0.85, 0.85);
    osc.connect(amp); amp.connect(stereo); stereo.connect(this.out);
    osc.onended = () => { osc.disconnect(); amp.disconnect(); stereo.disconnect(); };
    osc.start(t); osc.stop(t + d + 0.02);
  }

  private critter(t: number) {
    const pan = rnd(-0.8, 0.8), count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) this.burst(t + i * rnd(0.055, 0.11), rnd(0.035, 0.07), rnd(900, 1800) * (1 - this.depth * 0.35), rnd(0.8, 1.2), pan);
  }
}
