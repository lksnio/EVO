// Die Musik des Ozeans: keine Stücke, die sich wiederholen, sondern eine Klanglandschaft, die live entsteht – tiefe
// Flächen, die langsam wandern, ferne Rufe, Blasen, körnige Spuren unsichtbaren Lebens. Darin taucht selten ein
// winziges Motiv aus vier Tönen auf (D – F – E – As: eine kleine Terz hinauf, einen Halbton zurück, einen Tritonus
// hinab – ohne Auflösung). Die Welt hört zu, ohne Anteil zu nehmen.
//
// Die Schichten lassen sich unabhängig voneinander hinzufügen und zurücknehmen, immer weich:
//   – Tiefe (depth 0 … 1): Höhen und Melodisches treten zurück, Druck, dumpfe Resonanzen und lange Stille treten hervor.
//   – Gefahr (threat 0 … 1): unregelmäßige tiefe Pulse, Dissonanzen, wachsende Anspannung – sie klingt langsam ab.
//   – Verlust (loss()): Fast alles bricht weg, nur ein Rest des Motivs hallt nach; dann kehrt die Welt zurück.
//
// Alles läuft über absolute Zeiten (tick(t)): live mit ein wenig Vorlauf, für eine Hörprobe auch in einem
// OfflineAudioContext.

export interface ScoreMood {
  depth?: number;
  threat?: number;
}

/** level: im Spiel; title: Titelbild (das Motiv etwas öfter); still: zwischen den Generationen (ruhig, ohne Gefahr) */
export type ScoreMode = 'level' | 'title' | 'still';

/** das Motiv – und wie es unter Bedrohung zusammengezogen klingt */
const MOTIF = [62, 65, 64, 56];
const MOTIF_DREAD = [62, 63, 62, 56];

/** Töne der wandernden Flächen: ohne klares Dur oder Moll – und unter Bedrohung ein Halbton daneben */
const FIELD = [38, 41, 45, 46, 48, 52, 53];
const FIELD_DREAD = [39, 44, 45, 51, 38];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ein Hallraum wie ein endloses, dunkles Wasser: lang, nach hinten immer dumpfer. */
function oceanIR(ctx: BaseAudioContext, sec = 7.5) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      // je später, desto dunkler (stärker geglättet)
      const k = 0.35 + 0.6 * x;
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = lp * Math.pow(1 - x, 2.6) * (i < sr * 0.03 ? i / (sr * 0.03) : 1);
    }
  }
  return buf;
}

export class OceanScore {
  /** Gesamtlautstärke (Ein- und Ausblenden) */
  readonly out: GainNode;
  private duck: GainNode;
  private tone: BiquadFilterNode;
  private mix: GainNode;
  private send: GainNode;
  private lossBus: GainNode;
  private lossSend: GainNode;
  private noise: AudioBuffer;
  private L: Record<'bed' | 'drift' | 'tex' | 'motif' | 'shimmer' | 'press' | 'tension' | 'thin', GainNode>;
  private drift: OscillatorNode[] = [];
  private clusterTone!: BiquadFilterNode;
  private running: AudioScheduledSourceNode[] = [];
  private next: Record<string, number> = {};
  private depthTo = 0;
  private threatTo = 0;
  depth = 0;
  threat = 0;
  private lastT: number;
  private lossUntil = -1;
  private modeName: ScoreMode = 'level';
  private stopped = false;

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.lastT = t0;
    const g = (v = 1, to?: AudioNode) => {
      const n = ctx.createGain();
      n.gain.value = v;
      if (to) n.connect(to);
      return n;
    };
    this.out = g(0.0001, dest);
    this.duck = g(1, this.out);
    // die Tiefe nimmt die Höhen: alles läuft durch dieses Filter
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 5200;
    this.tone.Q.value = 0.5;
    this.tone.connect(this.duck);
    this.mix = g(1, this.tone);
    // Hall: ein dunkler, langer Raum, dazu ein gedämpftes Echo wie von einer fernen Felswand
    const verb = ctx.createConvolver();
    verb.buffer = oceanIR(ctx);
    verb.connect(g(0.9, this.tone));
    this.send = g(1, verb);
    const echo = ctx.createDelay(2);
    echo.delayTime.value = 0.61;
    const fb = g(0.32);
    const eLp = ctx.createBiquadFilter();
    eLp.type = 'lowpass';
    eLp.frequency.value = 900;
    this.send.connect(echo);
    echo.connect(eLp);
    eLp.connect(fb);
    fb.connect(echo);
    eLp.connect(verb);
    // beim Verlust: was übrig bleibt, klingt am Zusammenbruch vorbei
    this.lossBus = g(1, this.out);
    const verb2 = ctx.createConvolver();
    verb2.buffer = verb.buffer;
    verb2.connect(g(1, this.lossBus));
    this.lossSend = g(1, verb2);

    // Rauschen für Atem, Körner und Druck (lang, damit man keine Wiederholung hört)
    const len = ctx.sampleRate * 9;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = b * 0.82 + (Math.random() * 2 - 1) * 0.18;
      nd[i] = b * 3.2;
    }

    this.L = {
      bed: g(1, this.mix),
      drift: g(1, this.mix),
      tex: g(1, this.mix),
      motif: g(1, this.mix),
      shimmer: g(1, this.mix),
      press: g(0, this.mix),
      tension: g(0, this.mix),
      thin: g(0, this.mix),
    };
    this.L.drift.connect(this.send);
    this.L.shimmer.connect(this.send);
    this.build(t0);
    for (const k of ['call', 'bubbles', 'grains', 'ping', 'resonance', 'creak', 'pulse', 'swell', 'retune', 'motif']) this.next[k] = t0 + rnd(2, 12);
    this.next.motif = t0 + rnd(25, 45);
    this.next.retune = t0 + rnd(8, 14);
    this.out.gain.setTargetAtTime(1, t0, 2.2);
  }

  // ---------------------------------------------------------------- dauernde Stimmen

  private osc(type: OscillatorType, f: number, to: AudioNode, t: number, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(to);
    o.start(t);
    this.running.push(o);
    return o;
  }

  /** ein langsames Schwanken (Hz) um ±depth auf einem Regler */
  private lfo(rate: number, depth: number, param: AudioParam, t: number) {
    const ctx = this.ctx;
    const amt = ctx.createGain();
    amt.gain.value = depth;
    amt.connect(param);
    this.osc('sine', rate, amt, t);
  }

  private filter(type: BiquadFilterType, f: number, q: number, to: AudioNode) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.connect(to);
    return n;
  }

  private gain(v: number, to: AudioNode) {
    const n = this.ctx.createGain();
    n.gain.value = v;
    n.connect(to);
    return n;
  }

  private build(t: number) {
    const L = this.L;
    // der Grund: ein Ton unterhalb des Hörens, der kaum merklich atmet
    const sub = this.gain(0.055, L.bed);
    this.osc('sine', hz(29), sub, t);
    this.lfo(0.019, 0.025, sub.gain, t);
    const root = this.gain(0.045, this.filter('lowpass', 240, 0.6, L.bed));
    this.osc('triangle', hz(38), root, t);
    this.osc('triangle', hz(38), root, t, 7);
    this.lfo(0.031, 0.02, root.gain, t);
    // Atem des Wassers: Rauschen, das langsam an- und abschwillt
    const br = this.gain(0.026, L.bed);
    const bsrc = this.noiseLoop(this.filter('bandpass', 210, 0.7, br), t);
    void bsrc;
    this.lfo(0.043, 0.02, br.gain, t);
    // zwei Stimmen, die über lange Zeit zwischen mehrdeutigen Tönen wandern
    for (let i = 0; i < 2; i++) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = i ? 0.35 : -0.35;
      pan.connect(L.drift);
      const vg = this.gain(0.024, this.filter('lowpass', 520, 0.7, pan));
      const o = this.osc('triangle', hz(FIELD[i + 1]), vg, t);
      this.lfo(0.11 + i * 0.04, 4, o.detune, t);
      this.lfo(0.023 + i * 0.011, 0.012, vg.gain, t);
      this.drift.push(o);
    }
    // Licht von oben: ein heller, fast unhörbarer Schimmer (nur nahe der Oberfläche)
    const sh = this.gain(0.006, L.shimmer);
    this.osc('sine', hz(86), sh, t);
    this.osc('sine', hz(93), sh, t, 3);
    this.lfo(0.07, 0.005, sh.gain, t);
    // Druck der Tiefe: ein Ton unter allem, tiefes Grollen
    const pr = this.gain(0.06, L.press);
    this.osc('sine', hz(25), pr, t);
    this.lfo(0.013, 0.025, pr.gain, t);
    const rum = this.gain(0.03, L.press);
    this.noiseLoop(this.filter('lowpass', 70, 0.8, rum), t);
    // Anspannung: ein dunkler, reibender Klang (kleine Sekunde, Tritonus), der langsam schwebt
    this.clusterTone = this.filter('lowpass', 260, 1.4, this.gain(0.05, L.tension));
    for (const [m, d] of [[39, 0], [44, 5], [38, -8]] as const) this.lfo(0.17 + m * 0.003, 6, this.osc('sawtooth', hz(m), this.clusterTone, t, d).detune, t);
    // … und hoch oben zwei Töne, die sich reiben (nur, solange man nicht tief ist)
    const th = this.gain(0.0022, L.thin);
    this.osc('sine', hz(91), th, t);
    this.osc('sine', hz(92), th, t);
  }

  private noiseLoop(to: AudioNode, t: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(to);
    s.start(t, Math.random() * 8);
    this.running.push(s);
    return s;
  }

  // ---------------------------------------------------------------- Steuerung

  /** Wie es dem Tier gerade geht: Tiefe und Gefahr (0 … 1). Wird weich übernommen. */
  set(m: ScoreMood) {
    if (m.depth !== undefined) this.depthTo = clamp01(m.depth);
    if (m.threat !== undefined) this.threatTo = clamp01(m.threat);
  }

  mode(m: ScoreMode) {
    this.modeName = m;
    if (m !== 'level') this.set({ threat: 0, depth: m === 'still' ? 0.15 : 0.08 });
  }

  /** Ein Artgenosse stirbt: Die Klanglandschaft bricht fast ganz zusammen – nur ein Rest des Motivs hallt nach. */
  loss(t: number) {
    if (t < this.lossUntil - 2) return;
    this.lossUntil = t + 7.5;
    const d = this.duck.gain;
    d.cancelScheduledValues(t);
    d.setTargetAtTime(0.04, t, 0.14);
    d.setTargetAtTime(1, t + 4.2, 3.6);
    // eine tiefe Resonanz, die lange nachklingt – und die ersten beiden Töne des Motivs, brüchig und etwas zu tief
    this.swellTone(t + 0.25, hz(38), 0.05, 1.6, 7, this.lossBus, this.lossSend, 0.6);
    const down = this.depth > 0.5 ? -12 : 0;
    this.bell(t + 1.1, MOTIF[0] + down, 0.034, { detune: -14, to: this.lossBus, send: this.lossSend, wet: 0.85, decay: 6 });
    this.bell(t + 3.9, MOTIF[1] + down, 0.026, { detune: -22, to: this.lossBus, send: this.lossSend, wet: 0.9, decay: 7.5 });
  }

  /** Den Ablauf bis zum Zeitpunkt t planen (live etwa viermal je Sekunde mit etwas Vorlauf). */
  tick(t: number) {
    if (this.stopped) return;
    const dt = Math.max(0, Math.min(2, t - this.lastT));
    this.lastT = t;
    // Gefahr kommt schneller, als sie geht; Tiefe folgt gemächlich
    const up = this.threatTo > this.threat;
    this.threat += (this.threatTo - this.threat) * (1 - Math.exp(-dt / (up ? 2.4 : 10)));
    this.depth += (this.depthTo - this.depth) * (1 - Math.exp(-dt / 3.5));
    this.apply(t);
    const quiet = t < this.lossUntil;
    const D = this.depth, T = this.threat;
    const due = (k: string) => t >= this.next[k];
    const later = (k: string, a: number, b: number) => (this.next[k] = t + rnd(a, b));

    if (due('retune')) {
      later('retune', 16, 38);
      const pool = T > 0.35 ? FIELD_DREAD : FIELD;
      for (const o of this.drift) o.frequency.setTargetAtTime(hz(pick(pool) + (Math.random() < 0.3 ? 12 : 0)), t, rnd(4, 9));
    }
    if (quiet) return;
    // ferne Rufe: in der Tiefe seltener und tiefer, unter Gefahr verstummen sie
    if (due('call')) {
      later('call', 24 * (1 + D), 62 * (1 + 1.4 * D));
      if (Math.random() > T * 0.8) this.call(t + 0.05, D);
    }
    if (due('bubbles')) {
      later('bubbles', 5, 17);
      if (Math.random() < 1 - D * 0.9) this.bubbles(t + 0.05);
    }
    if (due('grains')) {
      later('grains', 7, 21);
      if (Math.random() < 1 - D * 0.85) this.grains(t + 0.05);
    }
    if (due('ping')) {
      later('ping', 14, 40);
      if (Math.random() < 0.8 - D * 0.5) this.ping(t + 0.05);
    }
    if (due('resonance')) {
      later('resonance', 16, 38);
      if (D > 0.25) this.swellTone(t + 0.05, hz(pick([26, 29, 31, 33])), 0.11 * D, 3.2, 7.5, this.mix, this.send, 0.55);
    }
    if (due('creak')) {
      later('creak', 22, 55);
      if (D > 0.4) this.creak(t + 0.05, D);
    }
    if (due('pulse')) {
      // unregelmäßig wie ein fremdes Herz – je näher die Gefahr, desto dichter
      const gap = (2.7 - 1.95 * T) * rnd(0.7, 1.4);
      this.next.pulse = t + gap;
      if (T > 0.07) this.pulse(t + 0.05, T);
    }
    if (due('swell')) {
      later('swell', 8, 17);
      if (T > 0.3) this.dread(t + 0.05, T);
    }
    if (due('motif')) {
      const m = this.modeName;
      const [a, b] = m === 'title' ? [32, 64] : m === 'still' ? [26, 48] : [70, 150];
      later('motif', a * (1 + D), b * (1 + D));
      if (D < 0.85 || Math.random() < 0.3) this.motif(t + 0.4);
    }
  }

  /** Die Schichten nach Tiefe und Gefahr mischen (weich). */
  private apply(t: number) {
    const D = this.depth, T = this.threat, L = this.L;
    const set = (n: GainNode, v: number, tc = 1.2) => n.gain.setTargetAtTime(v, t, tc);
    set(L.bed, 1 - 0.5 * D);
    set(L.drift, (1 - 0.88 * D) * (1 - 0.35 * T));
    set(L.tex, 1 - 0.9 * D);
    set(L.motif, 1 - 0.55 * D);
    set(L.shimmer, (1 - D) * (1 - T) * (this.modeName === 'still' ? 1.4 : 1));
    set(L.press, D);
    set(L.tension, T);
    set(L.thin, T * (1 - D));
    this.tone.frequency.setTargetAtTime(380 + 5000 * Math.pow(1 - D, 2.2), t, 1.5);
    this.clusterTone.frequency.setTargetAtTime(180 + 520 * T * (1 - 0.6 * D), t, 1.5);
  }

  // ---------------------------------------------------------------- Ereignisse

  private env(g: AudioParam, t: number, peak: number, a: number, hold: number, r: number) {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    return t + a + hold + r + 0.05;
  }

  /** Ein Ton, der sich aufbaut und lange vergeht (für Rufe, Resonanzen). */
  private swellTone(t: number, f: number, v: number, a: number, r: number, to: AudioNode, send: AudioNode, wet: number) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.gain(1 - wet, to));
    g.connect(this.gain(wet, send));
    const end = this.env(g.gain, t, v, a, 0.3, r);
    for (const [k, w] of [[1, 1], [2, 0.25]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * k, t);
      o.frequency.exponentialRampToValueAtTime(f * k * 0.97, end);
      const og = this.gain(w, g);
      o.connect(og);
      o.start(t);
      o.stop(end);
    }
  }

  /** Ein ferner Ruf: ein gleitender, belebter Ton, weit weg im Raum (fast nur Hall). */
  private call(t: number, D: number) {
    const ctx = this.ctx;
    const base = pick([146.8, 164.8, 174.6, 196, 220]) * (D > 0.5 ? 0.5 : 1) * rnd(0.97, 1.03);
    const parts = Math.random() < 0.35 ? 2 : 1;
    for (let p = 0; p < parts; p++) {
      const t0 = t + p * rnd(2.6, 4.2);
      const dur = rnd(3.2, 6.5);
      const f = base * (p ? rnd(0.72, 0.85) : 1);
      const pan = ctx.createStereoPanner();
      pan.pan.value = rnd(-0.8, 0.8);
      pan.connect(this.gain(0.15, this.L.tex));
      pan.connect(this.gain(0.85, this.send));
      const g = ctx.createGain();
      const bp = this.filter('bandpass', f * 2.2, 1.6, g);
      g.connect(pan);
      const end = this.env(g.gain, t0, 0.05 * (1 - 0.4 * D), dur * 0.35, dur * 0.2, dur * 0.45);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * rnd(0.9, 1.25), t0 + dur * 0.45);
      o.frequency.exponentialRampToValueAtTime(f * rnd(0.68, 1.05), t0 + dur);
      // ein lebendiges Zittern in der Stimme
      const vib = ctx.createOscillator();
      vib.frequency.value = rnd(3.5, 6.5);
      const vg = ctx.createGain();
      vg.gain.value = f * 0.012;
      vg.connect(o.frequency);
      vib.connect(vg);
      o.connect(bp);
      o.start(t0);
      vib.start(t0);
      o.stop(end);
      vib.stop(end);
    }
  }

  /** Ein paar Blasen, die irgendwo aufsteigen. */
  private bubbles(t: number) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 5);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.9, 0.9);
    pan.connect(this.gain(0.7, this.L.tex));
    pan.connect(this.gain(0.3, this.send));
    let tt = t;
    for (let i = 0; i < n; i++) {
      tt += rnd(0.05, 0.32);
      const f0 = rnd(380, 950);
      const d = rnd(0.04, 0.09);
      const g = ctx.createGain();
      g.connect(pan);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.013, tt + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.7, 2.8), tt + d);
      o.connect(g);
      o.start(tt);
      o.stop(tt + d + 0.02);
    }
  }

  /** Körnige Spuren: kurze, gefilterte Splitter – wie ein Prozess, den man nicht kennt. */
  private grains(t: number) {
    const ctx = this.ctx;
    const n = 4 + Math.floor(Math.random() * 11);
    const span = rnd(0.7, 2.6);
    const fc = rnd(700, 3600);
    const pan0 = rnd(-0.8, 0.8);
    for (let i = 0; i < n; i++) {
      const tt = t + (i / n) * span + rnd(0, 0.08);
      const d = rnd(0.012, 0.045);
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, pan0 + rnd(-0.25, 0.25)));
      pan.connect(this.gain(0.55, this.L.tex));
      pan.connect(this.gain(0.45, this.send));
      const g = ctx.createGain();
      g.connect(pan);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.045, tt + d * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, tt + d);
      s.connect(this.filter('bandpass', fc * rnd(0.8, 1.25), rnd(6, 13), g));
      s.start(tt, Math.random() * 8, d + 0.01);
    }
  }

  /** Ein leiser, heller Ton im Dunkel – ein Leuchten, das man hört. */
  private ping(t: number) {
    const ctx = this.ctx;
    const f = rnd(900, 2300);
    const g = ctx.createGain();
    g.connect(this.gain(0.15, this.L.tex));
    g.connect(this.gain(0.85, this.send));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.009, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.55);
  }

  /** Der Druck der Tiefe: ein langsames Ächzen, als gäbe die Welt nach. */
  private creak(t: number, D: number) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const g = ctx.createGain();
    g.connect(this.gain(0.6, this.L.press));
    g.connect(this.gain(0.4, this.send));
    const bp = this.filter('bandpass', 150, 9, g);
    bp.frequency.setValueAtTime(rnd(130, 170), t);
    bp.frequency.exponentialRampToValueAtTime(rnd(70, 95), t + 2.4);
    this.env(g.gain, t, 0.07 * D, 0.6, 0.6, 1.4);
    s.connect(bp);
    s.start(t, Math.random() * 6, 2.8);
  }

  /** Ein tiefer Puls – manchmal doppelt, nie im Takt. */
  private pulse(t: number, T: number) {
    const ctx = this.ctx;
    const one = (tt: number, v: number) => {
      const g = ctx.createGain();
      g.connect(this.mix);
      g.connect(this.gain(0.25, this.send));
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(v, tt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.55);
      // der Grundton spürt man mehr, als man ihn hört – ein leiser Oberton macht ihn auch auf kleinen Lautsprechern wahr
      for (const [k, w] of [[1, 1], [2, 0.35]] as const) {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(62 * k, tt);
        o.frequency.exponentialRampToValueAtTime(33 * k, tt + 0.4);
        o.connect(this.gain(w, g));
        o.start(tt);
        o.stop(tt + 0.6);
      }
    };
    one(t, 0.26 * T);
    if (Math.random() < 0.35) one(t + rnd(0.16, 0.24), 0.14 * T);
  }

  /** Eine Dissonanz, die anschwillt und abbricht – nicht laut, nur falsch. */
  private dread(t: number, T: number) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.gain(0.6, this.L.tension));
    g.connect(this.gain(0.4, this.send));
    const dur = rnd(3, 5.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 * T, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    const root = pick([50, 51, 44]);
    for (const m of [root, root + 1, root + 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.detune.setValueAtTime(0, t);
      o.detune.linearRampToValueAtTime(rnd(-30, 30), t + dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }

  /**
   * Ein Ton des Motivs: hell und gläsern (ein unharmonischer Oberton), darunter ein Schatten eine Oktave tiefer, fast
   * nur Hall. In der Tiefe stumpf, unter Gefahr metallisch.
   */
  private bell(t: number, midi: number, v: number, o: { detune?: number; to?: AudioNode; send?: AudioNode; wet?: number; decay?: number; metal?: boolean; dull?: boolean } = {}) {
    const ctx = this.ctx;
    const f = hz(midi) * Math.pow(2, (o.detune ?? 0) / 1200);
    const wet = o.wet ?? 0.7;
    const g = ctx.createGain();
    const lp = this.filter('lowpass', o.dull ? 900 : 2600, 0.5, g);
    g.connect(this.gain(1 - wet, o.to ?? this.L.motif));
    g.connect(this.gain(wet, o.send ?? this.send));
    const decay = o.decay ?? 4.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const parts: [number, number, number][] = [[1, 1, 0], [0.5, 0.35, 0.3]];
    if (!o.dull) parts.push([o.metal ? 3.17 : 2.76, 0.16, 0]);
    for (const [k, w, delay] of parts) {
      const s = ctx.createOscillator();
      s.frequency.value = f * k;
      const sg = this.gain(w, lp);
      s.connect(sg);
      s.start(t + delay);
      s.stop(t + decay + 0.1);
    }
  }

  /** Das Motiv taucht aus den Flächen auf – oft nur ein Bruchstück. */
  private motif(t: number) {
    const D = this.depth, T = this.threat;
    const dread = T > 0.35;
    const notes = (dread ? MOTIF_DREAD : MOTIF).map((m) => m + (dread ? -6 : 0) + (D > 0.5 ? -12 : 0));
    const frag = Math.random() < (this.modeName === 'level' ? 0.4 : 0.15);
    const use = frag ? notes.slice(0, 2) : D > 0.75 ? [notes[0], notes[3]] : notes;
    // vorher gleitet eine der Flächen zum Grundton – das Motiv wächst aus ihr heraus
    this.drift[0]?.frequency.setTargetAtTime(hz(38 + (dread ? -6 : 0)), t - 0.3, 2);
    const v = 0.05 * (this.modeName === 'level' ? 1 : 1.3) * (dread ? 0.7 : 1);
    let tt = t;
    for (const m of use) {
      this.bell(tt, m, v, { metal: dread, dull: D > 0.5, decay: 4.2 + 2 * D });
      tt += rnd(1.55, 2.7) * (1 + 0.6 * D);
    }
  }

  // ---------------------------------------------------------------- Ende

  stop(t: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.9);
    for (const s of this.running) s.stop(t + 5);
    this.running = [];
  }
}
