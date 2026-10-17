// Alle Töne werden live mit der Web Audio API erzeugt – es gibt keine Audiodateien.

export type Sfx =
  | 'click' | 'select' | 'back' | 'bite' | 'hit' | 'enemyDie' | 'hurt' | 'eat'
  | 'jump' | 'swim' | 'evolve' | 'fail' | 'victory' | 'death' | 'roar' | 'portal'
  | 'step' | 'unlock' | 'shoot' | 'boom' | 'splash' | 'buzz'
  | 'chew' | 'growl' | 'refuse' | 'ram' | 'warn' | 'scurry' | 'squeal' | 'snarl' | 'heart' | 'rustle'
  | 'call' | 'bond' | 'rumble' | 'extinct' | 'charge' | 'tear' | 'snub'
  | 'eatMeat' | 'eatPlant' | 'crunch';

interface ToneOpts {
  f: number;
  f2?: number;
  t?: number;
  d: number;
  type?: OscillatorType;
  v?: number;
  a?: number;
  filter?: number;
  q?: number;
  dest?: AudioNode;
  detune?: number;
}

interface NoiseOpts {
  t?: number;
  d: number;
  v?: number;
  /** Einschwingzeit (sonst setzt das Rauschen sofort ein) */
  a?: number;
  filter?: number;
  f2?: number;
  type?: BiquadFilterType;
  q?: number;
  dest?: AudioNode;
}

// ---------- Musik ----------

interface TrackDef {
  bpm: number;
  root: number; // MIDI-Note
  scale: number[];
  prog: number[]; // Stufe pro Takt
  pad?: { type: OscillatorType; v: number; filter: number };
  bass?: { type: OscillatorType; v: number; filter: number; pat: string };
  arp?: { type: OscillatorType; v: number; pat: number[]; oct: number; rel: number; filter?: number };
  lead?: { type: OscillatorType; v: number; notes: (number | null)[]; oct: number; filter?: number };
  drums?: { k: string; s: string; h: string; t?: string; v: number };
  /** Rauschen als Klangteppich (Wind, Wasser, Brodeln) – einmal pro Takt */
  air?: { v: number; filter: number; f2: number; q?: number };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const _ = null;

const TRACKS: Record<string, TrackDef> = {
  // Titel: tiefe Dröhnung, einzelne Töne wie aus der Tiefe
  title: {
    bpm: 62, root: 45, scale: PHRYG, prog: [0, 0, 1, 0],
    pad: { type: 'sawtooth', v: 0.03, filter: 520 },
    bass: { type: 'sine', v: 0.2, filter: 300, pat: 'x...............' },
    arp: { type: 'sine', v: 0.05, pat: [0, -1, -1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, -1, -1], oct: 2, rel: 2.2 },
    air: { v: 0.05, filter: 380, f2: 180, q: 1.2 },
  },
  // Karte: ruhig, gedämpft, wie ein Lagerfeuer in der Nacht
  map: {
    bpm: 70, root: 50, scale: DORIAN, prog: [0, 6, 5, 0],
    pad: { type: 'triangle', v: 0.04, filter: 900 },
    bass: { type: 'sine', v: 0.18, filter: 420, pat: 'x.......x.....o.' },
    arp: { type: 'triangle', v: 0.035, pat: [0, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, 3, -1, -1, 2, -1], oct: 1, rel: 0.9, filter: 1600 },
    drums: { k: 'x...............', s: '................', h: '................', t: '........x.......', v: 0.35 },
  },
  ozean: {
    bpm: 58, root: 43, scale: DORIAN, prog: [0, 3, 6, 0],
    pad: { type: 'sine', v: 0.06, filter: 650 },
    bass: { type: 'sine', v: 0.18, filter: 380, pat: 'x...........o...' },
    arp: { type: 'sine', v: 0.045, pat: [4, -1, -1, -1, 2, -1, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1], oct: 2, rel: 1.8 },
    air: { v: 0.06, filter: 300, f2: 140, q: 0.9 },
  },
  sumpf: {
    bpm: 78, root: 47, scale: PHRYG, prog: [0, 1, 0, 6],
    pad: { type: 'triangle', v: 0.035, filter: 700 },
    bass: { type: 'triangle', v: 0.2, filter: 420, pat: 'x..x......x..o..' },
    arp: { type: 'triangle', v: 0.04, pat: [0, -1, 1, -1, -1, -1, 0, -1, 2, -1, -1, -1, 1, -1, -1, -1], oct: 1, rel: 0.25, filter: 1400 },
    drums: { k: 'x.........x.....', s: '................', h: '.x...x...x...x.x', t: '......x.......x.', v: 0.3 },
    air: { v: 0.03, filter: 2600, f2: 4200, q: 3 },
  },
  reptil: {
    bpm: 92, root: 45, scale: MINOR, prog: [0, 5, 6, 0],
    pad: { type: 'sawtooth', v: 0.02, filter: 650 },
    bass: { type: 'sawtooth', v: 0.12, filter: 420, pat: 'x..x..x.x..x..o.' },
    arp: { type: 'square', v: 0.016, pat: [0, -1, 1, -1, 0, -1, 2, -1, 0, -1, 1, -1, 3, -1, 2, -1], oct: 1, rel: 0.12, filter: 1100 },
    drums: { k: 'x.....x...x.....', s: '................', h: '................', t: '...x.......x..x.', v: 0.55 },
    air: { v: 0.04, filter: 500, f2: 250, q: 1 },
  },
  eis: {
    bpm: 64, root: 46, scale: MINOR, prog: [0, 5, 3, 4],
    pad: { type: 'sine', v: 0.055, filter: 900 },
    bass: { type: 'sine', v: 0.16, filter: 380, pat: 'x...............' },
    arp: { type: 'sine', v: 0.04, pat: [4, -1, -1, 2, -1, -1, -1, -1, 3, -1, -1, 1, -1, -1, -1, -1], oct: 2, rel: 1.6 },
    air: { v: 0.08, filter: 900, f2: 2400, q: 0.8 },
  },
  eden: {
    bpm: 72, root: 50, scale: DORIAN, prog: [0, 3, 4, 0],
    pad: { type: 'triangle', v: 0.045, filter: 1200 },
    bass: { type: 'triangle', v: 0.16, filter: 520, pat: 'x.....x.........' },
    arp: { type: 'triangle', v: 0.04, pat: [0, -1, 2, -1, 4, -1, 2, -1, 1, -1, 3, -1, 2, -1, -1, -1], oct: 1, rel: 0.6 },
    air: { v: 0.03, filter: 1600, f2: 3000, q: 1 },
  },
  // Ein Spitzenräuber hat dich entdeckt
  apex: {
    bpm: 126, root: 40, scale: HARM, prog: [0, 0, 1, 0],
    pad: { type: 'sawtooth', v: 0.022, filter: 700 },
    bass: { type: 'sawtooth', v: 0.15, filter: 520, pat: 'x.x.x.xxx.x.x.xo' },
    arp: { type: 'square', v: 0.02, pat: [0, -1, 1, -1, 0, -1, 1, -1, 0, -1, 1, -1, 3, -1, 2, -1], oct: 1, rel: 0.08, filter: 1500 },
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: '..x...x...x...x.', t: '.............xxx', v: 0.6 },
  },
  // Zwischen den Generationen
  generation: {
    bpm: 60, root: 48, scale: DORIAN, prog: [0, 6, 3, 0],
    pad: { type: 'sine', v: 0.06, filter: 1000 },
    bass: { type: 'sine', v: 0.13, filter: 380, pat: 'x...............' },
    arp: { type: 'sine', v: 0.045, pat: [0, -1, 2, -1, 4, -1, 2, -1, 3, -1, 2, -1, 1, -1, -1, -1], oct: 2, rel: 1.2 },
    air: { v: 0.03, filter: 600, f2: 300, q: 1 },
  },
  ending: {
    bpm: 66, root: 50, scale: MAJOR, prog: [0, 3, 4, 0, 5, 3, 4, 4],
    pad: { type: 'triangle', v: 0.05, filter: 1500 },
    bass: { type: 'triangle', v: 0.16, filter: 600, pat: 'x.......x...o...' },
    arp: { type: 'sine', v: 0.045, pat: [0, 1, 2, 4, 2, 1, 0, 1, 0, 1, 2, 4, 3, 2, 1, 2], oct: 1, rel: 0.8 },
    lead: { type: 'triangle', v: 0.06, oct: 1, notes: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 0, _, _, _, 1, _, _, _, 2, _, 4, _, 2, _, _, _, _, _, _, _] },
  },
};

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function degMidi(root: number, scale: number[], deg: number) {
  const n = scale.length;
  const o = Math.floor(deg / n);
  return root + 12 * o + scale[((deg % n) + n) % n];
}

class Sequencer {
  private step = 0;
  private next = 0;
  private timer = 0;
  readonly out: GainNode;

  constructor(private eng: AudioEngine, private tr: TrackDef) {
    const ctx = eng.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(eng.musicBus!);
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
  }

  start() {
    this.next = this.eng.ctx!.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    window.clearInterval(this.timer);
    const ctx = this.eng.ctx!;
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    const o = this.out;
    window.setTimeout(() => o.disconnect(), 1500);
  }

  private tick() {
    const ctx = this.eng.ctx!;
    const stepDur = 60 / this.tr.bpm / 4;
    while (this.next < ctx.currentTime + 0.15) {
      this.schedule(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }

  private schedule(step: number, t: number, sd: number) {
    const tr = this.tr;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const deg = tr.prog[bar % tr.prog.length];
    const chord = [0, 2, 4, 7, 9].map((i) => degMidi(tr.root, tr.scale, deg + i));
    const e = this.eng;
    const dest = this.out;
    if (tr.pad && s16 === 0) {
      for (const m of chord.slice(0, 3)) {
        e.tone({ f: midiHz(m), d: sd * 16 + 0.3, type: tr.pad.type, v: tr.pad.v, a: 0.5, filter: tr.pad.filter, dest, t: t - e.ctx!.currentTime });
        e.tone({ f: midiHz(m), d: sd * 16 + 0.3, type: tr.pad.type, v: tr.pad.v * 0.6, a: 0.5, filter: tr.pad.filter, dest, detune: 9, t: t - e.ctx!.currentTime });
      }
    }
    if (tr.bass) {
      const c = tr.bass.pat[s16];
      if (c === 'x' || c === 'o') {
        const m = (c === 'x' ? chord[0] : chord[2]) - 12;
        e.tone({ f: midiHz(m), d: sd * 2.2, type: tr.bass.type, v: tr.bass.v, a: 0.01, filter: tr.bass.filter, dest, t: t - e.ctx!.currentTime });
      }
    }
    if (tr.arp) {
      const i = tr.arp.pat[s16];
      if (i >= 0) {
        const m = chord[i % chord.length] + 12 * tr.arp.oct;
        e.tone({ f: midiHz(m), d: tr.arp.rel, type: tr.arp.type, v: tr.arp.v, a: 0.005, filter: tr.arp.filter, dest, t: t - e.ctx!.currentTime });
      }
    }
    if (tr.lead && step % 2 === 0) {
      const idx = (step / 2) % tr.lead.notes.length;
      const n = tr.lead.notes[idx];
      if (n !== null && n !== undefined) {
        const m = degMidi(tr.root + 12 * tr.lead.oct, tr.scale, deg + n);
        e.tone({ f: midiHz(m), d: sd * 3.5, type: tr.lead.type, v: tr.lead.v, a: 0.02, filter: tr.lead.filter, dest, t: t - e.ctx!.currentTime });
      }
    }
    if (tr.drums) {
      const v = tr.drums.v;
      const dt = t - e.ctx!.currentTime;
      if (tr.drums.k[s16] === 'x') e.tone({ f: 120, f2: 40, d: 0.22, type: 'sine', v: 0.5 * v, a: 0.002, dest, t: dt });
      if (tr.drums.s[s16] === 'x') e.noise({ d: 0.14, v: 0.22 * v, filter: 1800, type: 'bandpass', q: 0.8, dest, t: dt });
      if (tr.drums.h[s16] === 'x') e.noise({ d: 0.04, v: 0.06 * v, filter: 7000, type: 'highpass', dest, t: dt });
      if (tr.drums.t?.[s16] === 'x') e.tone({ f: 150, f2: 70, d: 0.3, type: 'sine', v: 0.35 * v, a: 0.003, dest, t: dt });
    }
    if (tr.air && s16 === 0) {
      const bar = sd * 16;
      e.noise({ d: bar * 1.1, a: bar * 0.45, v: tr.air.v, filter: tr.air.filter, f2: tr.air.f2, type: 'bandpass', q: tr.air.q ?? 1, dest, t: t - e.ctx!.currentTime });
    }
  }
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private seq: Sequencer | null = null;
  private track: string | null = null;
  private wanted: string | null = null;
  muted = false;
  private lastSfx: Record<string, number> = {};
  /** Tonhöhe des gerade gespielten Effekts (leichte Variation, damit nichts gleich klingt) */
  private vary = 1;

  /** Muss nach einer Nutzeraktion (Klick/Taste) aufgerufen werden. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.75;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }
    const startWanted = () => {
      if (this.wanted && this.wanted !== this.track) this.music(this.wanted);
    };
    if (this.ctx.state === 'suspended') this.ctx.resume().then(startWanted, () => {});
    else startWanted();
  }

  /** Das Musikstück, das gerade läuft bzw. laufen soll. */
  get current() {
    return this.wanted;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  tone(o: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + Math.max(0, o.t ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    const vr = this.vary;
    osc.frequency.setValueAtTime(o.f * vr, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2 * vr), t0 + o.d);
    const g = ctx.createGain();
    const a = o.a ?? 0.005;
    const v = o.v ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + 0.01, o.d));
    let node: AudioNode = osc;
    if (o.filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = o.filter;
      bq.Q.value = o.q ?? 0.7;
      osc.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(o.dest ?? this.sfxBus!);
    osc.start(t0);
    osc.stop(t0 + o.d + 0.05);
  }

  noise(o: NoiseOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime + Math.max(0, o.t ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = o.type ?? 'lowpass';
    bq.frequency.setValueAtTime((o.filter ?? 2000) * this.vary, t0);
    if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2 * this.vary, t0 + o.d);
    bq.Q.value = o.q ?? 0.7;
    const g = ctx.createGain();
    if (o.a) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.v ?? 0.2, t0 + o.a);
    } else g.gain.setValueAtTime(o.v ?? 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(o.d, (o.a ?? 0) + 0.02));
    src.connect(bq);
    bq.connect(g);
    g.connect(o.dest ?? this.sfxBus!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.d + 0.05);
  }

  /** Ein Geräusch. k: Stärke (z. B. wie kräftig das Gebiss ist), 0..1 */
  sfx(name: Sfx, k = 0) {
    if (!this.ctx || this.muted) return;
    // gleiche Töne nicht zu dicht hintereinander
    const now = performance.now();
    if (now - (this.lastSfx[name] ?? 0) < 35) return;
    this.lastSfx[name] = now;
    // jedes Mal ein klein wenig anders (±6 % Tonhöhe), Bedienelemente bleiben gleich
    this.vary = name === 'click' || name === 'select' || name === 'back' ? 1 : 1 + (Math.random() - 0.5) * 0.12;
    try {
      this.play(name, k);
    } finally {
      this.vary = 1;
    }
  }

  private play(name: Sfx, k: number) {
    switch (name) {
      case 'click':
        this.noise({ d: 0.04, v: 0.12, filter: 1400, type: 'bandpass', q: 2 });
        break;
      case 'select':
        this.tone({ f: 220, f2: 330, d: 0.16, type: 'triangle', v: 0.12, filter: 1400 });
        this.noise({ d: 0.08, v: 0.1, filter: 900, type: 'bandpass', q: 1.5 });
        break;
      case 'back':
        this.tone({ f: 260, f2: 170, d: 0.14, type: 'triangle', v: 0.1, filter: 1200 });
        break;
      case 'bite':
        // Luft schnappen, dann klacken die Zähne aufeinander – tiefer und lauter mit starkem Gebiss
        this.noise({ d: 0.06, v: 0.12, filter: 700, f2: 1800, type: 'bandpass', q: 1 });
        this.noise({ t: 0.07, d: 0.035, v: 0.32 + 0.15 * k, filter: 3600 - 1400 * k, type: 'bandpass', q: 2.2 });
        this.tone({ t: 0.07, f: 260 - 90 * k, f2: 80 - 25 * k, d: 0.07 + 0.04 * k, type: 'square', v: 0.09 + 0.06 * k, filter: 900 });
        break;
      case 'crunch':
        // Zähne treffen Fleisch: dumpfer Schlag und Knacken
        this.tone({ f: 130 - 30 * k, f2: 55, d: 0.13, type: 'sine', v: 0.3 + 0.15 * k });
        this.noise({ d: 0.1, v: 0.28 + 0.12 * k, filter: 900, f2: 300, type: 'bandpass', q: 1.4 });
        this.noise({ t: 0.03, d: 0.05, v: 0.16, filter: 2600, type: 'bandpass', q: 3 });
        break;
      case 'eatMeat': {
        // saftiges Schmatzen und ein heller, wohliger Klang (Quinte oder Oktave nach oben)
        this.noise({ d: 0.09, v: 0.22, filter: 800, f2: 450, type: 'bandpass', q: 2.4 });
        const up = [1.5, 1.335, 2][Math.floor(Math.random() * 3)];
        this.tone({ t: 0.03, f: 784, d: 0.16, type: 'triangle', v: 0.08, a: 0.008 });
        this.tone({ t: 0.1, f: 784 * up, d: 0.34, type: 'sine', v: 0.075, a: 0.01 });
        this.tone({ t: 0.1, f: 784 * up * 2, d: 0.22, type: 'sine', v: 0.02, a: 0.01 });
        break;
      }
      case 'eatPlant':
        // knuspriges Abbeißen, dazu ein leiser, weicher Ton
        for (let i = 0; i < 3; i++) this.noise({ d: 0.04, v: 0.16 - i * 0.03, filter: 2600 + i * 500, type: 'bandpass', q: 3, t: i * 0.07 });
        this.tone({ t: 0.04, f: 523, d: 0.18, type: 'sine', v: 0.04, a: 0.01 });
        break;
      case 'hit':
        this.tone({ f: 240, f2: 90, d: 0.12, type: 'square', v: 0.12, filter: 1100 });
        this.noise({ d: 0.07, v: 0.22, filter: 2200 });
        break;
      case 'enemyDie':
        this.tone({ f: 300, f2: 60, d: 0.35, type: 'sawtooth', v: 0.1, filter: 900 });
        this.noise({ d: 0.3, v: 0.2, filter: 900, f2: 200 });
        break;
      case 'hurt':
        this.tone({ f: 330, f2: 110, d: 0.3, type: 'sawtooth', v: 0.15, filter: 1200 });
        this.noise({ d: 0.12, v: 0.25, filter: 1600, type: 'bandpass', q: 1 });
        break;
      case 'eat':
      case 'chew':
        for (let i = 0; i < 3; i++) this.noise({ d: 0.06, v: 0.22 - i * 0.04, filter: 900 + i * 200, type: 'bandpass', q: 2.5, t: i * 0.13 });
        this.tone({ f: 120, f2: 80, d: 0.08, type: 'sine', v: 0.08, t: 0.02 });
        break;
      case 'refuse':
        // ein unwilliges Schnauben
        this.noise({ d: 0.22, v: 0.2, filter: 700, f2: 300, type: 'bandpass', q: 1.2 });
        this.tone({ f: 160, f2: 110, d: 0.18, type: 'triangle', v: 0.06, filter: 600 });
        break;
      case 'growl':
        // knurrender Magen
        this.tone({ f: 72, f2: 54, d: 0.9, type: 'sawtooth', v: 0.1, a: 0.12, filter: 260, q: 4 });
        this.tone({ f: 60, f2: 80, d: 0.7, type: 'sawtooth', v: 0.07, a: 0.2, filter: 220, q: 3, t: 0.35 });
        break;
      case 'heart':
        this.tone({ f: 62, f2: 42, d: 0.14, type: 'sine', v: 0.45, a: 0.004 });
        this.tone({ f: 58, f2: 40, d: 0.14, type: 'sine', v: 0.3, a: 0.004, t: 0.2 });
        break;
      case 'rustle':
        this.noise({ d: 0.35, v: 0.09, a: 0.08, filter: 3200, f2: 1800, type: 'bandpass', q: 0.8 });
        break;
      case 'ram':
        this.tone({ f: 120, f2: 42, d: 0.3, type: 'sine', v: 0.5, a: 0.002 });
        this.noise({ d: 0.18, v: 0.35, filter: 900, f2: 200 });
        break;
      case 'warn':
        // drohendes Schnauben/Brüllen eines Verteidigers
        this.noise({ d: 0.6, v: 0.25, a: 0.08, filter: 500, f2: 900, type: 'bandpass', q: 2 });
        this.tone({ f: 110, f2: 140, d: 0.55, type: 'sawtooth', v: 0.08, a: 0.06, filter: 500 });
        break;
      case 'scurry':
        for (let i = 0; i < 4; i++) this.noise({ d: 0.03, v: 0.08, filter: 4200, type: 'bandpass', q: 2, t: i * 0.05 });
        break;
      case 'squeal':
        this.tone({ f: 900, f2: 1300, d: 0.08, type: 'triangle', v: 0.08 });
        this.tone({ f: 1250, f2: 700, d: 0.14, type: 'triangle', v: 0.07, t: 0.08 });
        break;
      case 'snarl':
        this.noise({ d: 0.4, v: 0.26, a: 0.04, filter: 420, type: 'bandpass', q: 4 });
        this.tone({ f: 95, f2: 75, d: 0.38, type: 'sawtooth', v: 0.1, a: 0.03, filter: 380 });
        break;
      case 'jump':
        this.noise({ d: 0.1, v: 0.08, filter: 900, f2: 1600, type: 'bandpass' });
        break;
      case 'swim':
        this.noise({ d: 0.18, v: 0.05, filter: 500, f2: 900, type: 'bandpass' });
        break;
      case 'splash':
        this.noise({ d: 0.3, v: 0.15, filter: 1400, type: 'bandpass', f2: 500 });
        break;
      case 'evolve': {
        // dunkler, aufsteigender Klang – die Zeit vergeht
        [0, 3, 7, 10, 12, 15].forEach((st, i) =>
          this.tone({ f: 110 * Math.pow(2, st / 12), d: 1.6 - i * 0.12, type: 'sine', v: 0.1, a: 0.15, t: i * 0.18 }),
        );
        this.noise({ d: 2.2, v: 0.06, a: 0.8, filter: 500, f2: 2600, type: 'bandpass' });
        this.tone({ f: 55, d: 2.2, type: 'sawtooth', v: 0.08, a: 0.4, filter: 300 });
        break;
      }
      case 'fail':
        this.tone({ f: 140, d: 0.16, type: 'square', v: 0.07, filter: 600 });
        this.tone({ f: 110, d: 0.2, type: 'square', v: 0.07, filter: 600, t: 0.12 });
        break;
      case 'victory':
        [[220, 0], [262, 0.18], [330, 0.36], [440, 0.54]].forEach(([f, t], i) => {
          this.tone({ f, d: i === 3 ? 1.4 : 0.3, type: 'triangle', v: 0.13, t, a: 0.02 });
          this.tone({ f: f / 2, d: i === 3 ? 1.4 : 0.3, type: 'sine', v: 0.08, t, a: 0.02 });
        });
        break;
      case 'death':
        this.tone({ f: 220, f2: 55, d: 1.6, type: 'triangle', v: 0.16 });
        this.tone({ f: 165, f2: 41, d: 1.8, type: 'sawtooth', v: 0.06, filter: 600, t: 0.1 });
        this.noise({ d: 1.2, v: 0.08, filter: 400, f2: 120, t: 0.05 });
        break;
      case 'roar':
        this.noise({ d: 1.4, v: 0.45, a: 0.08, filter: 600, f2: 150 });
        this.tone({ f: 85, f2: 42, d: 1.3, type: 'sawtooth', v: 0.24, a: 0.06, filter: 380 });
        this.tone({ f: 120, f2: 60, d: 1.1, type: 'sawtooth', v: 0.1, a: 0.06, filter: 500, detune: 20 });
        break;
      case 'portal':
        // Licht am Ende des Weges
        this.tone({ f: 196, f2: 392, d: 1.2, type: 'sine', v: 0.12, a: 0.2 });
        this.tone({ f: 294, f2: 588, d: 1.2, type: 'sine', v: 0.07, a: 0.3, t: 0.1 });
        this.noise({ d: 1.2, v: 0.04, a: 0.5, filter: 2400, type: 'bandpass' });
        break;
      case 'step':
        this.noise({ d: 0.05, v: 0.07, filter: 700 });
        break;
      case 'unlock':
        [196, 247, 294].forEach((f, i) => this.tone({ f, d: 0.8, type: 'triangle', v: 0.1, a: 0.04, t: i * 0.14 }));
        break;
      case 'shoot':
        this.noise({ d: 0.12, v: 0.12, filter: 1200, f2: 500 });
        break;
      case 'boom':
        this.noise({ d: 0.6, v: 0.5, filter: 450, f2: 100 });
        this.tone({ f: 70, f2: 32, d: 0.55, type: 'sine', v: 0.45 });
        break;
      case 'buzz':
        this.tone({ f: 130, f2: 170, d: 0.5, type: 'sawtooth', v: 0.06, filter: 700 });
        break;
      case 'charge':
        // Anlauf zum Rammstoß
        this.noise({ d: 0.3, v: 0.25, filter: 300, f2: 1600, type: 'bandpass', q: 1.3 });
        this.tone({ f: 90, f2: 160, d: 0.25, type: 'sawtooth', v: 0.08, filter: 600 });
        break;
      case 'tear':
        // Fleisch reißen
        this.noise({ d: 0.16, v: 0.3, filter: 900, f2: 400, type: 'bandpass', q: 2 });
        this.noise({ d: 0.1, v: 0.18, filter: 1600, type: 'bandpass', q: 3, t: 0.08 });
        break;
      case 'snub':
        // Artgenosse wendet sich ab
        this.tone({ f: 520, f2: 330, d: 0.18, type: 'triangle', v: 0.05, filter: 1500 });
        break;
      case 'call':
        // Warnruf der Artgenossen
        this.tone({ f: 620, f2: 880, d: 0.09, type: 'triangle', v: 0.07, filter: 2200 });
        this.tone({ f: 640, f2: 900, d: 0.09, type: 'triangle', v: 0.06, filter: 2200, t: 0.14 });
        break;
      case 'bond':
        // leises, warmes Brummen: Vertrauen
        [196, 247, 294].forEach((f, i) => this.tone({ f, d: 0.9, type: 'sine', v: 0.06, a: 0.15, t: i * 0.09 }));
        break;
      case 'rumble':
        // etwas Großes nähert sich
        this.noise({ d: 2.2, v: 0.22, a: 0.6, filter: 160, f2: 90, q: 0.8 });
        this.tone({ f: 46, f2: 38, d: 2, type: 'sine', v: 0.18, a: 0.5 });
        break;
      case 'extinct':
        [220, 196, 175, 147].forEach((f, i) => this.tone({ f, d: 1.4, type: 'triangle', v: 0.08, a: 0.1, t: i * 0.45 }));
        this.noise({ d: 2.6, v: 0.05, a: 1, filter: 400, f2: 120 });
        break;
    }
  }

  music(name: string | null) {
    this.wanted = name;
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (name === this.track) return;
    this.seq?.stop();
    this.seq = null;
    this.track = name;
    if (!name || !TRACKS[name]) return;
    this.seq = new Sequencer(this, TRACKS[name]);
    this.seq.start();
  }
}

export const audio = new AudioEngine();
