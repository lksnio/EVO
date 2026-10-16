// Alle Töne werden live mit der Web Audio API erzeugt – es gibt keine Audiodateien.

export type Sfx =
  | 'click' | 'select' | 'back' | 'bite' | 'hit' | 'enemyDie' | 'hurt' | 'eat' | 'crystal'
  | 'jump' | 'swim' | 'dash' | 'evolve' | 'fail' | 'victory' | 'death' | 'roar' | 'portal'
  | 'step' | 'unlock' | 'shoot' | 'boom' | 'splash' | 'buzz';

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
  drums?: { k: string; s: string; h: string; v: number };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const LYD = [0, 2, 4, 6, 7, 9, 11];
const _ = null;

const TRACKS: Record<string, TrackDef> = {
  title: {
    bpm: 78, root: 57, scale: MINOR, prog: [0, 5, 2, 6],
    pad: { type: 'triangle', v: 0.05, filter: 1300 },
    bass: { type: 'sine', v: 0.2, filter: 600, pat: 'x.......x...o...' },
    arp: { type: 'sine', v: 0.06, pat: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 4, 2, 1, 2, 1], oct: 1, rel: 0.5 },
    lead: { type: 'triangle', v: 0.07, oct: 1, filter: 2400, notes: [4, _, _, 3, 2, _, 0, _, 1, _, 2, _, 4, _, _, _, 7, _, _, 6, 4, _, 2, _, 3, _, 2, _, 1, _, _, _] },
  },
  map: {
    bpm: 104, root: 60, scale: MAJOR, prog: [0, 4, 5, 3],
    pad: { type: 'triangle', v: 0.035, filter: 1500 },
    bass: { type: 'triangle', v: 0.2, filter: 800, pat: 'x...x.x.x...x.o.' },
    arp: { type: 'square', v: 0.025, pat: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1], oct: 1, rel: 0.15, filter: 2200 },
    lead: { type: 'triangle', v: 0.07, oct: 1, filter: 3000, notes: [0, _, 2, _, 4, _, 2, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, 5, _, 4, _, 2, _, 1, _, _, _] },
    drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.', v: 0.5 },
  },
  ozean: {
    bpm: 66, root: 50, scale: DORIAN, prog: [0, 3, 4, 0],
    pad: { type: 'sine', v: 0.06, filter: 900 },
    bass: { type: 'sine', v: 0.18, filter: 500, pat: 'x...........o...' },
    arp: { type: 'sine', v: 0.06, pat: [0, -1, -1, 2, -1, -1, 4, -1, -1, 3, -1, -1, 1, -1, -1, -1], oct: 2, rel: 1.4 },
  },
  sumpf: {
    bpm: 92, root: 52, scale: PHRYG, prog: [0, 1, 0, 6],
    pad: { type: 'triangle', v: 0.035, filter: 900 },
    bass: { type: 'triangle', v: 0.22, filter: 500, pat: 'x..x..x.x..x..o.' },
    arp: { type: 'triangle', v: 0.06, pat: [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 4, 2, 1, 2], oct: 1, rel: 0.12 },
    drums: { k: 'x.....x...x.....', s: '................', h: '.x.x.x.x.x.x.x.x', v: 0.35 },
  },
  reptil: {
    bpm: 118, root: 55, scale: MINOR, prog: [0, 5, 6, 4],
    pad: { type: 'sawtooth', v: 0.018, filter: 900 },
    bass: { type: 'sawtooth', v: 0.12, filter: 600, pat: 'x.x.x..xx.x.x..o' },
    arp: { type: 'square', v: 0.022, pat: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 4, 3, 2, 1], oct: 1, rel: 0.1, filter: 1800 },
    lead: { type: 'triangle', v: 0.06, oct: 1, filter: 2400, notes: [0, _, _, 0, 2, _, 3, _, 4, _, _, _, 3, _, 2, _, 0, _, _, 0, 2, _, 3, _, 1, _, _, _, _, _, _, _] },
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.', v: 0.55 },
  },
  eis: {
    bpm: 80, root: 54, scale: MINOR, prog: [0, 5, 3, 4],
    pad: { type: 'sine', v: 0.06, filter: 1100 },
    bass: { type: 'sine', v: 0.17, filter: 500, pat: 'x.......x.......' },
    arp: { type: 'sine', v: 0.055, pat: [4, -1, 2, -1, 3, -1, 1, -1, 4, -1, 2, -1, 0, -1, -1, -1], oct: 2, rel: 1.0 },
    drums: { k: '................', s: '................', h: '....x.......x...', v: 0.25 },
  },
  eden: {
    bpm: 90, root: 62, scale: MAJOR, prog: [0, 4, 5, 3],
    pad: { type: 'triangle', v: 0.045, filter: 1600 },
    bass: { type: 'triangle', v: 0.18, filter: 700, pat: 'x.....x.x.......' },
    arp: { type: 'triangle', v: 0.05, pat: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1], oct: 1, rel: 0.4 },
    lead: { type: 'sine', v: 0.08, oct: 1, notes: [4, _, _, 2, 4, _, 7, _, 5, _, _, 4, 2, _, _, _, 4, _, _, 5, 7, _, 9, _, 7, _, 5, _, 4, _, _, _] },
    drums: { k: 'x.......x.......', s: '................', h: '....x.......x...', v: 0.3 },
  },
  boss: {
    bpm: 148, root: 48, scale: HARM, prog: [0, 0, 5, 4],
    pad: { type: 'sawtooth', v: 0.02, filter: 1000 },
    bass: { type: 'sawtooth', v: 0.14, filter: 700, pat: 'x.xxx.xxx.xxx.xo' },
    arp: { type: 'square', v: 0.03, pat: [0, -1, 2, -1, 0, -1, 3, -1, 0, -1, 2, -1, 4, -1, 3, -1], oct: 1, rel: 0.08, filter: 2000 },
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', v: 0.6 },
  },
  evolution: {
    bpm: 70, root: 60, scale: LYD, prog: [0, 1, 0, 4],
    pad: { type: 'sine', v: 0.06, filter: 1400 },
    bass: { type: 'sine', v: 0.14, filter: 500, pat: 'x...............' },
    arp: { type: 'sine', v: 0.05, pat: [0, 2, 4, 2, 3, 2, 4, 2, 0, 2, 4, 2, 3, 4, 2, 1], oct: 2, rel: 0.7 },
  },
  ending: {
    bpm: 76, root: 62, scale: MAJOR, prog: [0, 3, 4, 0, 5, 3, 4, 4],
    pad: { type: 'triangle', v: 0.05, filter: 1700 },
    bass: { type: 'triangle', v: 0.18, filter: 700, pat: 'x.......x...o...' },
    arp: { type: 'sine', v: 0.05, pat: [0, 1, 2, 4, 2, 1, 0, 1, 0, 1, 2, 4, 3, 2, 1, 2], oct: 1, rel: 0.6 },
    lead: { type: 'triangle', v: 0.08, oct: 1, notes: [4, _, _, _, 5, _, 4, _, 2, _, _, _, 0, _, _, _, 1, _, _, _, 2, _, 4, _, 2, _, _, _, _, _, _, _] },
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
      if (tr.drums.h[s16] === 'x') e.noise({ d: 0.04, v: 0.08 * v, filter: 7000, type: 'highpass', dest, t: dt });
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
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.d);
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
    bq.frequency.setValueAtTime(o.filter ?? 2000, t0);
    if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    bq.Q.value = o.q ?? 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.v ?? 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    src.connect(bq);
    bq.connect(g);
    g.connect(o.dest ?? this.sfxBus!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.d + 0.05);
  }

  sfx(name: Sfx) {
    if (!this.ctx || this.muted) return;
    // gleiche Töne nicht zu dicht hintereinander
    const now = performance.now();
    if (now - (this.lastSfx[name] ?? 0) < 35) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click':
        this.tone({ f: 880, d: 0.05, type: 'square', v: 0.06, filter: 3000 });
        break;
      case 'select':
        this.tone({ f: 660, f2: 990, d: 0.09, type: 'triangle', v: 0.14 });
        break;
      case 'back':
        this.tone({ f: 520, f2: 330, d: 0.1, type: 'triangle', v: 0.12 });
        break;
      case 'bite':
        this.noise({ d: 0.07, v: 0.35, filter: 1800, type: 'bandpass', q: 1.2 });
        this.tone({ f: 240, f2: 90, d: 0.09, type: 'square', v: 0.1, filter: 900 });
        break;
      case 'hit':
        this.tone({ f: 320, f2: 120, d: 0.1, type: 'square', v: 0.12, filter: 1500 });
        this.noise({ d: 0.06, v: 0.2, filter: 3000 });
        break;
      case 'enemyDie':
        this.tone({ f: 520, f2: 80, d: 0.28, type: 'sawtooth', v: 0.1, filter: 1300 });
        this.noise({ d: 0.22, v: 0.18, filter: 1200, f2: 300 });
        break;
      case 'hurt':
        this.tone({ f: 420, f2: 140, d: 0.28, type: 'sawtooth', v: 0.15, filter: 1600 });
        this.tone({ f: 400, f2: 130, d: 0.28, type: 'square', v: 0.06, filter: 1200, detune: 30 });
        break;
      case 'eat':
        this.tone({ f: 520, f2: 720, d: 0.07, type: 'triangle', v: 0.18 });
        this.tone({ f: 620, f2: 900, d: 0.09, type: 'triangle', v: 0.18, t: 0.09 });
        break;
      case 'crystal':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ f, d: 0.3, type: 'sine', v: 0.1, t: i * 0.05 }));
        break;
      case 'jump':
        this.tone({ f: 280, f2: 620, d: 0.14, type: 'triangle', v: 0.1 });
        break;
      case 'swim':
        this.tone({ f: 500, f2: 1100, d: 0.08, type: 'sine', v: 0.05 });
        break;
      case 'splash':
        this.noise({ d: 0.3, v: 0.15, filter: 1400, type: 'bandpass', f2: 500 });
        break;
      case 'dash':
        this.noise({ d: 0.25, v: 0.25, filter: 400, type: 'bandpass', f2: 2400, q: 1.5 });
        this.tone({ f: 150, f2: 320, d: 0.2, type: 'square', v: 0.06, filter: 900 });
        break;
      case 'evolve': {
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
          this.tone({ f, d: 0.6, type: i % 2 ? 'sine' : 'triangle', v: 0.12, t: i * 0.07 }),
        );
        this.noise({ d: 1.3, v: 0.05, filter: 6000, type: 'highpass', t: 0.1 });
        this.tone({ f: 131, d: 1.2, type: 'triangle', v: 0.15, a: 0.1 });
        break;
      }
      case 'fail':
        this.tone({ f: 200, d: 0.14, type: 'square', v: 0.08, filter: 1000 });
        this.tone({ f: 150, d: 0.2, type: 'square', v: 0.08, filter: 1000, t: 0.12 });
        break;
      case 'victory':
        [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, t], i) => {
          this.tone({ f, d: i === 3 ? 0.7 : 0.14, type: 'triangle', v: 0.15, t });
          this.tone({ f: f / 2, d: i === 3 ? 0.7 : 0.14, type: 'square', v: 0.04, t, filter: 1500 });
        });
        break;
      case 'death':
        this.tone({ f: 440, f2: 110, d: 1.0, type: 'triangle', v: 0.18 });
        this.tone({ f: 330, f2: 80, d: 1.1, type: 'sawtooth', v: 0.06, filter: 900, t: 0.1 });
        break;
      case 'roar':
        this.noise({ d: 1.2, v: 0.4, filter: 700, f2: 180 });
        this.tone({ f: 95, f2: 50, d: 1.1, type: 'sawtooth', v: 0.22, filter: 420 });
        break;
      case 'portal':
        this.tone({ f: 300, f2: 900, d: 0.6, type: 'sine', v: 0.14 });
        this.tone({ f: 450, f2: 1350, d: 0.6, type: 'sine', v: 0.08, t: 0.05 });
        break;
      case 'step':
        this.noise({ d: 0.04, v: 0.06, filter: 900 });
        break;
      case 'unlock':
        [784, 988, 1175].forEach((f, i) => this.tone({ f, d: 0.25, type: 'triangle', v: 0.12, t: i * 0.08 }));
        break;
      case 'shoot':
        this.tone({ f: 700, f2: 280, d: 0.12, type: 'square', v: 0.06, filter: 2000 });
        this.noise({ d: 0.06, v: 0.1, filter: 2500 });
        break;
      case 'boom':
        this.noise({ d: 0.5, v: 0.45, filter: 500, f2: 120 });
        this.tone({ f: 80, f2: 38, d: 0.45, type: 'sine', v: 0.4 });
        break;
      case 'buzz':
        this.tone({ f: 180, f2: 240, d: 0.5, type: 'sawtooth', v: 0.06, filter: 800 });
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
