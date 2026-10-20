// Die Musik des Ozeans – ein Soundtrack, der live entsteht und nie aufhört (nahtlos, weil er sich nicht wiederholt).
//
// Minimalistische, organische elektronische Ambient-Musik für einen urzeitlichen, fremdartigen Ozean: weit, geheimnisvoll,
// lebendig, still schön – mit unterschwelliger Unruhe und dem Gefühl verletzlicher Existenz. Keine Stimmen, kein
// durchgehender Beat, keine heroischen Melodien, keine Trommeln, keine Schreckeffekte; viel Raum für die Geräusche des
// Wassers (die spielt das Spiel selbst).
//
// Das Tonmaterial ist die Obertonreihe eines tiefen D (36,7 Hz): Alle Töne sind Vielfache davon. So klingen Flächen und
// Glastöne wie natürliche Resonanzen eines Körpers – vertraut und doch fremd (die 7., 11. und 13. Teiltöne liegen zwischen
// den Tasten eines Klaviers).
//
// Die Schichten:
//   – der Grund: ein Ton, den man mehr spürt als hört, und der Atem des Wassers;
//   – Klangflächen: drei Stimmen, die sehr langsam zwischen Klängen aus der Obertonreihe wandern, jede atmet für sich;
//   – fließende Resonanzen: Rauschen, das in schmalen Bändern auf Obertönen „singt“ und langsam gleitet;
//   – ferne Glastöne: einzelne, helle, gläserne Töne weit weg im Raum;
//   – Motive: wenige prägnante Folgen aus drei, vier Tönen – selten, oft nur ein Bruchstück, nie aufgelöst;
//   – Pulse: weiche, unregelmäßige Stöße in der Tiefe, wie ein fremdes Herz.
// Es beginnt beinahe lautlos; die Schichten kommen eine nach der anderen. Bei Gefahr (threat) werden die Pulse dichter und
// regelmäßiger, ein gedämpftes Ostinato in ungeraden Gruppen kommt dazu, die Flächen beginnen zu zittern, ein dunkler,
// reibender Klang schwillt an – und wenn die Gefahr vorüber ist, gleitet alles langsam zurück in die Stille. In der Tiefe
// (depth) treten Höhen und Melodisches zurück, Druck und lange Stille treten hervor.
//
// Alles läuft über absolute Zeiten (tick(t)): live mit ein wenig Vorlauf – für eine Hörprobe auch in einem
// OfflineAudioContext (Stimmung setzen, dann tick in kleinen Schritten bis zum Ende, dann rendern).

export interface ScoreMood {
  depth?: number;
  threat?: number;
}

/** level: im Spiel; title: Titelbild (Motive etwas öfter); still: zwischen den Generationen (ruhig, ohne Gefahr) */
export type ScoreMode = 'level' | 'title' | 'still';

/** der Grundton: ein tiefes D – alle Töne sind seine Vielfachen (Teiltöne) */
const F0 = 36.71;
const P = (n: number) => F0 * n;

/**
 * Die Klänge der Flächen (Teiltöne für die drei Stimmen): offen, fremd, schwebend. Sie folgen einander in freier
 * Reihenfolge; unter Gefahr kommen die reibenden dazu.
 */
const FIELDS: number[][] = [
  [6, 9, 12], // A – E – A: offen, leer
  [7, 10, 12], // C(7) – F♯ – A: fremd, weich
  [8, 11, 15], // D – G(11, zwischen G und G♯) – C♯: schwebend
  [6, 8, 13], // A – D – B♭(13): dunkel
  [9, 12, 14], // E – A – C(7): fragend
  [5, 8, 12], // F♯ – D – A: warm, selten
];
const FIELDS_DREAD: number[][] = [
  [8, 15, 17], // D – C♯ – D♯(17): eng
  [7, 11, 13], // die „falschen“ Teiltöne zusammen
  [6, 13, 17],
];

/**
 * Motive aus drei, vier Tönen (Teiltöne): kleine Schritte, ein unerwarteter Sprung, keine Auflösung. Sie tauchen selten
 * auf, oft nur zur Hälfte, manchmal eine Oktave tiefer.
 */
const MOTIFS: number[][] = [
  [24, 28, 26], // A – C(7) – B♭(13): hinauf, ein Stück zurück
  [32, 42, 36, 28], // D – G(21) – E – C(7)
  [20, 18, 24], // F♯ – E – A
  [26, 24, 33], // B♭ – A – D♯ hinauf (11 × 3): ein Fragezeichen
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ein Hallraum wie ein endloses, dunkles Wasser: lang, nach hinten immer dumpfer. */
function oceanIR(ctx: BaseAudioContext, sec = 8.5) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      // je später, desto dunkler (stärker geglättet)
      const k = 0.3 + 0.65 * x;
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = lp * Math.pow(1 - x, 2.4) * (i < sr * 0.04 ? i / (sr * 0.04) : 1);
    }
  }
  return buf;
}

/** Eine Stimme der Klangflächen: zwei leicht verstimmte Oszillatoren, ein langsam atmendes Filter, eine eigene Lautstärke. */
interface PadVoice {
  oscs: OscillatorNode[];
  amp: GainNode;
  lp: BiquadFilterNode;
  base: number;
  next: number;
}

/** Ein singendes Band im Rauschen: zwei schmale Filter hintereinander auf einem Oberton. */
interface Reso {
  bp: BiquadFilterNode;
  bp2: BiquadFilterNode;
  amp: GainNode;
  next: number;
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
  private L: Record<'ground' | 'pad' | 'reso' | 'glass' | 'motif' | 'pulse' | 'press' | 'tension' | 'thin', GainNode>;
  private trem!: GainNode;
  private tremAmt!: GainNode;
  private tremLfo!: OscillatorNode;
  private tensionTone!: BiquadFilterNode;
  private pads: PadVoice[] = [];
  private resos: Reso[] = [];
  private running: AudioScheduledSourceNode[] = [];
  private next: Record<string, number> = {};
  private field: number[] = FIELDS[0];
  private depthTo = 0;
  private threatTo = 0;
  depth = 0;
  threat = 0;
  private lastT: number;
  private t0: number;
  private lossUntil = -1;
  private modeName: ScoreMode = 'level';
  private stopped = false;
  /** das gedämpfte Ostinato unter Gefahr: Schritt im Muster und wann der nächste fällig ist */
  private ost = { step: 0, at: 0 };

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.lastT = this.t0 = t0;
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
    this.tone.frequency.value = 6000;
    this.tone.Q.value = 0.5;
    this.tone.connect(this.duck);
    this.mix = g(1, this.tone);
    // Hall: ein dunkler, langer Raum, dazu ein gedämpftes Echo wie von einer fernen Felswand
    const verb = ctx.createConvolver();
    verb.buffer = oceanIR(ctx);
    verb.connect(g(0.85, this.tone));
    this.send = g(1, verb);
    const echo = ctx.createDelay(3);
    echo.delayTime.value = 0.83;
    const fb = g(0.36);
    const eLp = ctx.createBiquadFilter();
    eLp.type = 'lowpass';
    eLp.frequency.value = 1400;
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

    // Rauschen für Atem, Resonanzen und Druck (lang, damit man keine Wiederholung hört)
    const len = ctx.sampleRate * 11;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = b * 0.6 + (Math.random() * 2 - 1) * 0.4;
      nd[i] = b * 1.6;
    }

    this.L = {
      ground: g(0, this.mix),
      pad: g(0, this.mix),
      reso: g(0, this.mix),
      glass: g(0, this.mix),
      motif: g(1, this.mix),
      pulse: g(1, this.mix),
      press: g(0, this.mix),
      tension: g(0, this.mix),
      thin: g(0, this.mix),
    };
    this.build(t0);
    // es beginnt beinahe lautlos: erst der Grund, dann nach und nach die Flächen, die Resonanzen, das Glas – Motive erst
    // nach einer langen Weile
    this.next = {
      field: t0 + rnd(30, 45),
      glass: t0 + rnd(22, 34),
      motif: t0 + rnd(55, 80),
      pulse: t0 + rnd(14, 24),
      breath: t0 + rnd(4, 9),
      swell: t0 + rnd(8, 14),
      creak: t0 + rnd(20, 40),
      dread: t0 + 1e9,
    };
    this.out.gain.setTargetAtTime(1, t0, 6);
    this.L.ground.gain.setTargetAtTime(1, t0, 5);
    this.L.pad.gain.setTargetAtTime(1, t0 + 6, 9);
    this.L.reso.gain.setTargetAtTime(1, t0 + 14, 8);
    this.L.glass.gain.setTargetAtTime(1, t0 + 18, 6);
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
  private lfo(rate: number, depth: number, param: AudioParam, t: number, type: OscillatorType = 'sine') {
    const amt = this.ctx.createGain();
    amt.gain.value = depth;
    amt.connect(param);
    return { o: this.osc(type, rate, amt, t), amt };
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

  private pan(p: number, to: AudioNode) {
    const n = this.ctx.createStereoPanner();
    n.pan.value = p;
    n.connect(to);
    return n;
  }

  private noiseLoop(to: AudioNode, t: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(to);
    s.start(t, Math.random() * 10);
    this.running.push(s);
    return s;
  }

  private build(t: number) {
    const L = this.L;
    // der Grund: ein Ton unterhalb des Hörens, der kaum merklich atmet – und ein Oberton, damit man ihn auch auf kleinen
    // Lautsprechern ahnt
    const sub = this.gain(0.05, L.ground);
    this.osc('sine', P(1), sub, t);
    this.lfo(1 / 47, 0.022, sub.gain, t);
    const root = this.gain(0.028, this.filter('lowpass', 260, 0.6, L.ground));
    this.osc('triangle', P(2), root, t);
    this.osc('sine', P(2), root, t, 5);
    this.lfo(1 / 33, 0.014, root.gain, t);
    // der Atem des Wassers: Rauschen in einem tiefen Band, das langsam an- und abschwillt
    const br = this.gain(0.018, L.ground);
    const bf = this.filter('bandpass', 240, 0.8, br);
    this.noiseLoop(bf, t);
    this.lfo(1 / 23, 0.014, br.gain, t);
    this.lfo(1 / 61, 90, bf.frequency, t);

    // Klangflächen: drei Stimmen über ein gemeinsames Zittern (das nur unter Gefahr bebt)
    this.trem = this.gain(1, L.pad);
    const tl = this.lfo(3, 0, this.trem.gain, t, 'triangle');
    this.tremLfo = tl.o;
    this.tremAmt = tl.amt;
    this.trem.connect(this.send);
    this.field.forEach((n, i) => {
      const pan = this.pan([-0.45, 0.05, 0.45][i], this.trem);
      const amp = this.gain(0.0001, pan);
      const lp = this.filter('lowpass', 700, 0.9, amp);
      // jede Stimme hat ihren eigenen, sehr langsamen Atem im Filter
      this.lfo(1 / rnd(40, 90), rnd(220, 420), lp.frequency, t);
      const a = this.osc('triangle', P(n), lp, t, rnd(-4, 4));
      const b = this.osc('sine', P(n) * 1.003, lp, t);
      this.lfo(rnd(0.07, 0.15), 3, a.detune, t);
      this.pads.push({ oscs: [a, b], amp, lp, base: [0.03, 0.024, 0.017][i], next: t + 4 + i * rnd(6, 10) });
    });

    // fließende Resonanzen: Rauschen, das auf Obertönen singt (schmale Bänder, langsam gleitend)
    for (let i = 0; i < 3; i++) {
      const pan = this.pan(rnd(-0.7, 0.7), L.reso);
      pan.connect(this.gain(0.6, this.send));
      const amp = this.gain(0.0001, pan);
      const bp = this.filter('bandpass', P(pick([16, 18, 21, 24, 27, 32])), 38, amp);
      // ein zweites Filter macht das Band noch schmaler – es singt, statt zu rauschen
      const bp2 = this.filter('bandpass', bp.frequency.value, 30, bp);
      this.noiseLoop(bp2, t);
      this.resos.push({ bp, bp2, amp, next: t + rnd(8, 22) });
    }

    // Druck der Tiefe: ein Ton unter allem, tiefes Grollen
    const pr = this.gain(0.05, L.press);
    this.osc('sine', P(0.75), pr, t);
    this.lfo(1 / 71, 0.02, pr.gain, t);
    const rum = this.gain(0.035, L.press);
    this.noiseLoop(this.filter('lowpass', 65, 0.7, rum), t);

    // Anspannung: ein dunkler, reibender Klang (der Grundton und ein Halbton darüber), der langsam schwebt
    this.tensionTone = this.filter('lowpass', 220, 1.6, this.gain(0.045, L.tension));
    this.lfo(0.13, 5, this.osc('sawtooth', P(2), this.tensionTone, t).detune, t);
    this.lfo(0.17, 7, this.osc('sawtooth', P(2) * Math.pow(2, 1 / 12), this.tensionTone, t, 4).detune, t);
    this.lfo(0.09, 6, this.osc('sawtooth', P(3) * Math.pow(2, 1 / 12), this.tensionTone, t, -6).detune, t);
    // … und hoch oben zwei Teiltöne dicht nebeneinander (31 und 32), die sich reiben – nur, solange man nicht tief ist
    const th = this.gain(0.0018, L.thin);
    this.osc('sine', P(31), th, t);
    this.osc('sine', P(32), th, t);
  }

  // ---------------------------------------------------------------- Steuerung

  /** Wie es dem Tier gerade geht: Tiefe und Gefahr (0 … 1). Wird weich übernommen. */
  set(m: ScoreMood) {
    if (m.depth !== undefined) this.depthTo = clamp01(m.depth);
    if (m.threat !== undefined) this.threatTo = clamp01(m.threat);
  }

  mode(m: ScoreMode) {
    this.modeName = m;
    if (m !== 'level') this.set({ threat: 0, depth: m === 'still' ? 0.15 : 0.05 });
  }

  /** Ein Artgenosse stirbt: Die Klanglandschaft bricht fast ganz zusammen – nur ein Rest eines Motivs hallt nach. */
  loss(t: number) {
    if (t < this.lossUntil - 2) return;
    this.lossUntil = t + 8;
    const d = this.duck.gain;
    d.cancelScheduledValues(t);
    d.setTargetAtTime(0.03, t, 0.18);
    d.setTargetAtTime(1, t + 4.5, 4);
    // eine tiefe Resonanz, die lange nachklingt – und zwei Töne eines Motivs, brüchig und etwas zu tief
    this.swell(t + 0.25, P(2), 0.05, 1.8, 7, this.lossBus, this.lossSend, 0.6);
    const m = MOTIFS[0];
    this.glass(t + 1.2, P(m[0]) / 2, 0.03, { detune: -16, to: this.lossBus, send: this.lossSend, wet: 0.85, decay: 6.5 });
    this.glass(t + 4.1, P(m[1]) / 2, 0.022, { detune: -28, to: this.lossBus, send: this.lossSend, wet: 0.9, decay: 8 });
  }

  /** Den Ablauf bis zum Zeitpunkt t planen (live etwa viermal je Sekunde mit etwas Vorlauf). */
  tick(t: number) {
    if (this.stopped) return;
    const dt = Math.max(0, Math.min(2, t - this.lastT));
    this.lastT = t;
    // Gefahr kommt allmählich (nicht als Schreck) und geht noch langsamer; die Tiefe folgt gemächlich
    const up = this.threatTo > this.threat;
    this.threat += (this.threatTo - this.threat) * (1 - Math.exp(-dt / (up ? 3.5 : 12)));
    this.depth += (this.depthTo - this.depth) * (1 - Math.exp(-dt / 4));
    this.apply(t);
    this.padStep(t);
    this.resoStep(t);
    this.ostinato(t);
    const quiet = t < this.lossUntil;
    const D = this.depth, T = this.threat;
    const due = (k: string) => t >= this.next[k];
    const later = (k: string, a: number, b: number) => (this.next[k] = t + rnd(a, b));

    if (due('field')) {
      later('field', 26, 58);
      this.moveField(t, T);
    }
    if (quiet) return;
    if (due('glass')) {
      // ferne Glastöne: in der Tiefe seltener, dumpfer und tiefer; unter Gefahr kaum
      later('glass', 7 * (1 + D), 22 * (1 + 1.2 * D));
      if (Math.random() > T * 0.85) this.glassTone(t + 0.05, D);
    }
    if (due('motif')) {
      const m = this.modeName;
      const [a, b] = m === 'title' ? [28, 55] : m === 'still' ? [24, 48] : [60, 140];
      later('motif', a * (1 + D), b * (1 + D));
      if (T < 0.5 && (D < 0.85 || Math.random() < 0.3)) this.motif(t + 0.4, D);
    }
    if (due('pulse')) {
      // unregelmäßige, weiche Pulse – je näher die Gefahr, desto dichter und regelmäßiger
      const per = 2.8 - 2.3 * Math.pow(T, 0.8);
      const jitter = (1 - 0.85 * T) * rnd(-0.45, 0.6);
      this.next.pulse = t + Math.max(0.35, per * (1 + jitter));
      if (this.modeName === 'level' || Math.random() < 0.4) this.pulse(t + 0.05, T, D);
    }
    if (due('breath')) {
      later('breath', 9, 26);
      if (Math.random() < 0.7 - 0.4 * D) this.bubbleBreath(t + 0.05);
    }
    if (due('swell')) {
      later('swell', 14, 34);
      // eine tiefe Resonanz, die aufsteigt und vergeht (in der Tiefe öfter)
      if (Math.random() < 0.35 + 0.5 * D) this.swell(t + 0.05, P(pick([2, 3, 4])) * (D > 0.5 ? 0.5 : 1), 0.035 + 0.05 * D, 4, 9, this.mix, this.send, 0.6);
    }
    if (due('creak')) {
      later('creak', 24, 60);
      if (D > 0.45) this.creak(t + 0.05, D);
    }
    if (T > 0.3 && this.next.dread > t + 30) this.next.dread = t + rnd(2, 6);
    if (due('dread')) {
      later('dread', 9, 18);
      if (T > 0.3) this.dread(t + 0.05, T);
      else this.next.dread = t + 1e9;
    }
  }

  /** Die Schichten nach Tiefe und Gefahr mischen (weich). */
  private apply(t: number) {
    const D = this.depth, T = this.threat, L = this.L;
    const set = (n: GainNode, v: number, tc = 1.5) => n.gain.setTargetAtTime(v, t, tc);
    const warm = t > this.t0 + 20;
    // die Flächen werden unter Gefahr etwas leiser (Raum für die Pulse), in der Tiefe dumpfer
    if (warm) {
      set(L.pad, (1 - 0.45 * D) * (1 - 0.3 * T), 2.5);
      set(L.reso, (1 - 0.7 * D) * (1 - 0.5 * T), 2.5);
      set(L.glass, (1 - 0.6 * D) * (this.modeName === 'still' ? 1.3 : 1));
    }
    set(L.motif, 1 - 0.5 * D);
    set(L.press, 0.15 + D, 3);
    set(L.tension, Math.pow(T, 1.4), 2.5);
    set(L.thin, T * (1 - D) * 0.8, 2.5);
    // die Flächen beginnen unter Gefahr zu zittern – erst langsam, dann schneller
    this.tremAmt.gain.setTargetAtTime(0.32 * Math.pow(T, 1.2), t, 2);
    this.tremLfo.frequency.setTargetAtTime(1.6 + 4.2 * T, t, 2);
    this.tone.frequency.setTargetAtTime(420 + 5600 * Math.pow(1 - D, 2.1), t, 2);
    this.tensionTone.frequency.setTargetAtTime(170 + 620 * T * (1 - 0.5 * D), t, 2);
  }

  /** Die Stimmen der Flächen atmen für sich: Jede schwillt langsam an und ab, in ihrem eigenen Takt. */
  private padStep(t: number) {
    for (const v of this.pads) {
      if (t < v.next) continue;
      const dur = rnd(14, 34);
      v.next = t + dur;
      // manchmal fast still – so entsteht Raum
      const to = Math.random() < 0.22 ? 0.0001 : v.base * rnd(0.45, 1);
      v.amp.gain.setTargetAtTime(Math.max(0.0001, to), t, dur / 3);
    }
  }

  /** Die singenden Bänder gleiten langsam zu anderen Obertönen und schwellen an und ab. */
  private resoStep(t: number) {
    const D = this.depth;
    for (const r of this.resos) {
      if (t < r.next) continue;
      const dur = rnd(10, 28);
      r.next = t + dur;
      const n = pick(D > 0.5 ? [8, 9, 10, 12, 14] : [16, 18, 20, 21, 24, 27, 28, 32]);
      const f = P(n);
      r.bp.frequency.setTargetAtTime(f, t, dur / 3);
      r.bp2.frequency.setTargetAtTime(f, t, dur / 3);
      r.amp.gain.setTargetAtTime(Math.random() < 0.35 ? 0.0001 : rnd(0.35, 1.1), t, dur / 4);
    }
  }

  /** Die Flächen gleiten zu einem neuen Klang (unter Gefahr zu einem reibenden). */
  private moveField(t: number, T: number) {
    const pool = T > 0.4 ? FIELDS_DREAD : FIELDS;
    let f = pick(pool);
    for (let i = 0; i < 3 && f === this.field; i++) f = pick(pool);
    this.field = f;
    const slow = rnd(5, 11);
    this.pads.forEach((v, i) => {
      // eine Stimme bleibt manchmal liegen – das verbindet die Klänge
      if (i === 0 && Math.random() < 0.4) return;
      const oct = this.depth > 0.6 && i === 2 ? 0.5 : 1;
      v.oscs[0].frequency.setTargetAtTime(P(f[i]) * oct, t + i * rnd(0.5, 2.5), slow);
      v.oscs[1].frequency.setTargetAtTime(P(f[i]) * oct * 1.003, t + i * rnd(0.5, 2.5), slow);
    });
  }

  // ---------------------------------------------------------------- Ereignisse

  private env(g: AudioParam, t: number, peak: number, a: number, hold: number, r: number) {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    return t + a + hold + r + 0.05;
  }

  /** Ein Ton, der sich aufbaut und lange vergeht (tiefe Resonanzen). */
  private swell(t: number, f: number, v: number, a: number, r: number, to: AudioNode, send: AudioNode, wet: number) {
    const g = this.ctx.createGain();
    g.connect(this.gain(1 - wet, to));
    g.connect(this.gain(wet, send));
    const end = this.env(g.gain, t, v, a, 0.4, r);
    for (const [k, w] of [[1, 1], [2, 0.22], [3, 0.08]] as const) {
      const o = this.ctx.createOscillator();
      o.frequency.setValueAtTime(f * k, t);
      o.frequency.exponentialRampToValueAtTime(f * k * 0.985, end);
      o.connect(this.gain(w, g));
      o.start(t);
      o.stop(end);
    }
  }

  /**
   * Ein gläserner Ton: ein Sinus, den ein zweiter in einem unharmonischen Verhältnis kurz zum Klingen bringt (wie Glas, das
   * man anschlägt) – dann bleibt nur der reine Ton, der lange im Raum verklingt.
   */
  private glass(t: number, f: number, v: number, o: { detune?: number; to?: AudioNode; send?: AudioNode; wet?: number; decay?: number; dull?: boolean; pan?: number } = {}) {
    const ctx = this.ctx;
    const freq = f * Math.pow(2, (o.detune ?? 0) / 1200);
    const wet = o.wet ?? 0.75;
    const decay = o.decay ?? 5;
    // Ton → Filter → Hüllkurve → Lage im Raum → trocken und in den Hall
    const pan = ctx.createStereoPanner();
    pan.pan.value = o.pan ?? rnd(-0.6, 0.6);
    pan.connect(this.gain(1 - wet, o.to ?? this.L.glass));
    pan.connect(this.gain(wet, o.send ?? this.send));
    const g = this.gain(1, pan);
    const lp = this.filter('lowpass', o.dull ? 1100 : 4200, 0.4, g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const car = ctx.createOscillator();
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.frequency.value = freq * (o.dull ? 2 : 3.51);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * (o.dull ? 0.4 : 1.1), t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.01, t + 0.6);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(lp);
    // ein leiser Schatten eine Oktave tiefer, fast nur Hall
    const sh = ctx.createOscillator();
    sh.frequency.value = freq / 2;
    sh.connect(this.gain(0.25, lp));
    for (const s of [car, mod, sh]) {
      s.start(t);
      s.stop(t + decay + 0.1);
    }
  }

  /** Ein ferner Glaston: ein Oberton weit oben, einzeln – manchmal mit einem zweiten, kurz danach. */
  private glassTone(t: number, D: number) {
    const n = pick(D > 0.5 ? [12, 14, 16, 18, 20] : [16, 18, 20, 21, 24, 26, 28, 32, 36]);
    const v = 0.026 * (this.modeName === 'still' ? 1.3 : 1);
    this.glass(t, P(n), v, { dull: D > 0.55, decay: rnd(4, 7) + 3 * D, wet: rnd(0.7, 0.9) });
    if (Math.random() < 0.3) this.glass(t + rnd(0.7, 1.6), P(pick([n - 2, n + 2, n * 1.5])), v * 0.6, { dull: D > 0.55, decay: 5, wet: 0.88 });
  }

  /** Ein Motiv taucht auf – drei, vier Töne, oft nur ein Bruchstück, manchmal eine Oktave tiefer. Nie aufgelöst. */
  private motif(t: number, D: number) {
    const m = pick(MOTIFS);
    const frag = Math.random() < (this.modeName === 'level' ? 0.35 : 0.15);
    const notes = frag ? m.slice(0, 2) : m;
    const low = D > 0.5 || Math.random() < 0.25 ? 0.5 : 1;
    // vorher gleitet eine Stimme der Flächen zum ersten Ton – das Motiv wächst aus ihr heraus
    const v0 = this.pads[1];
    if (v0) v0.oscs[0].frequency.setTargetAtTime(P(notes[0]) / 4, t - 0.4, 2.5);
    const v = 0.04 * (this.modeName === 'level' ? 1 : 1.25);
    let tt = t;
    notes.forEach((n, i) => {
      this.glass(tt, P(n) * low, v * (i === notes.length - 1 ? 0.8 : 1), { to: this.L.motif, dull: D > 0.5, decay: 5 + 2 * D, wet: 0.65, pan: rnd(-0.3, 0.3) });
      // unregelmäßig, wie gesprochen: mal länger, mal kürzer
      tt += rnd(1.1, 2.4) * (1 + 0.5 * D);
    });
    // manchmal antwortet ein Echo der ersten beiden Töne, viel leiser, weit weg
    if (!frag && Math.random() < 0.35) {
      tt += rnd(3, 6);
      for (const n of notes.slice(0, 2)) {
        this.glass(tt, P(n) * low * 0.5, v * 0.4, { to: this.L.motif, dull: true, decay: 7, wet: 0.92 });
        tt += rnd(1.5, 2.6);
      }
    }
  }

  /** Ein weicher Puls in der Tiefe – wie ein fremdes Herz (manchmal doppelt, nie im Takt). */
  private pulse(t: number, T: number, D: number) {
    const ctx = this.ctx;
    const one = (tt: number, v: number) => {
      const g = ctx.createGain();
      g.connect(this.L.pulse);
      g.connect(this.gain(0.3, this.send));
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(v, tt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.7);
      for (const [k, w] of [[1, 1], [2, 0.3]] as const) {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(P(1.6) * k, tt);
        o.frequency.exponentialRampToValueAtTime(P(1.05) * k, tt + 0.45);
        o.connect(this.gain(w, g));
        o.start(tt);
        o.stop(tt + 0.75);
      }
    };
    // in Ruhe kaum zu hören – unter Gefahr deutlich, aber nie wuchtig
    const v = 0.035 + 0.17 * T + 0.03 * D;
    one(t, v);
    if (Math.random() < 0.25 + 0.3 * T) one(t + rnd(0.17, 0.26), v * 0.55);
  }

  /**
   * Unter Gefahr: ein gedämpftes Ostinato aus wenigen Tönen in ungeraden Gruppen (3 + 2 + 2) – erst vereinzelt, dann
   * immer dichter; es wird heller, je näher die Gefahr. Sinkt sie, lichtet es sich wieder, bis nur noch Stille ist.
   */
  private ostinato(t: number) {
    const T = this.threat;
    if (T < 0.22 || this.modeName !== 'level') {
      this.ost.at = Math.max(this.ost.at, t);
      return;
    }
    // die Zeit eines Schritts: langsam bei wenig Gefahr, zügig (aber nicht hektisch) bei viel
    const step = 0.36 - 0.17 * T;
    const pattern = [1, 0, 0, 1, 0, 1, 0];
    const notes = [6, 6, 7, 6, 8, 6, 7];
    while (this.ost.at < t + 0.3) {
      const i = this.ost.step % pattern.length;
      const at = this.ost.at + rnd(-0.012, 0.012);
      // der Schlag am Anfang jeder Gruppe fast immer, die übrigen erst bei viel Gefahr
      const p = pattern[i] ? 0.35 + T : (T - 0.45) * 1.2;
      if (Math.random() < p && at > t - 0.05) this.pluck(at, P(notes[(this.ost.step >> 1) % notes.length]) * (this.depth > 0.6 ? 0.5 : 1), T, !pattern[i]);
      this.ost.step++;
      this.ost.at += step * (pattern[i] ? 1.04 : 0.98);
    }
  }

  /** Ein gedämpfter, gezupfter Ton (weich angerissen, kurz) – der Stoff des Ostinatos. */
  private pluck(t: number, f: number, T: number, ghost: boolean) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.L.tension);
    g.connect(this.gain(0.35, this.send));
    const v = (ghost ? 0.4 : 1) * (0.05 + 0.1 * T);
    const end = t + 0.32 + 0.2 * (1 - T);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    const lp = this.filter('lowpass', 420 + 1300 * T, 3.5, g);
    lp.frequency.setValueAtTime(420 + 1500 * T, t);
    lp.frequency.exponentialRampToValueAtTime(260, end);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(end + 0.05);
  }

  /** Eine Dissonanz, die langsam anschwillt und wieder vergeht – nicht laut, nur eng. */
  private dread(t: number, T: number) {
    const g = this.ctx.createGain();
    g.connect(this.gain(0.55, this.L.tension));
    g.connect(this.gain(0.45, this.send));
    const dur = rnd(4, 7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025 * T, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const root = P(pick([4, 6, 8]));
    for (const k of [1, Math.pow(2, 1 / 12), 17 / 16 * 1.5]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = root * k;
      o.detune.setValueAtTime(0, t);
      o.detune.linearRampToValueAtTime(rnd(-25, 25), t + dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  /** Ein paar weiche Blasen, weit weg – als Klang, nicht als Geräusch (sehr leise, fast nur Hall). */
  private bubbleBreath(t: number) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 4);
    const pan = this.pan(rnd(-0.9, 0.9), this.gain(0.4, this.L.reso));
    pan.connect(this.gain(0.6, this.send));
    let tt = t;
    for (let i = 0; i < n; i++) {
      tt += rnd(0.08, 0.4);
      const f0 = P(pick([12, 14, 16, 18, 21]));
      const d = rnd(0.06, 0.12);
      const g = ctx.createGain();
      g.connect(pan);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.008, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.4, 1.9), tt + d);
      o.connect(g);
      o.start(tt);
      o.stop(tt + d + 0.02);
    }
  }

  /** Der Druck der Tiefe: ein langsames Ächzen, als gäbe die Welt nach. */
  private creak(t: number, D: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const g = this.ctx.createGain();
    g.connect(this.gain(0.6, this.L.press));
    g.connect(this.gain(0.4, this.send));
    const bp = this.filter('bandpass', 150, 10, g);
    bp.frequency.setValueAtTime(rnd(120, 160), t);
    bp.frequency.exponentialRampToValueAtTime(rnd(60, 85), t + 2.6);
    this.env(g.gain, t, 0.05 * D, 0.7, 0.6, 1.5);
    s.connect(bp);
    s.start(t, Math.random() * 8, 3);
  }

  // ---------------------------------------------------------------- Ende

  stop(t: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 1.2);
    for (const s of this.running) s.stop(t + 7);
    this.running = [];
  }
}
