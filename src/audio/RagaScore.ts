// ---------------------------------------------------------------------------
// Die Musik des Laichflusses: eine Alapana im Raga Neelambari – dem Schlaflied-Raga der karnatischen (südindischen,
// tamilischen) Musik. Eine Alapana ist der Anfang jeder karnatischen Darbietung: Der Raga wird frei, ohne Takt und ohne
// Trommeln erkundet, Ton für Ton, mit langen Pausen – vom tiefen Grundton langsam hinauf bis zum hohen Sa und wieder zur Ruhe.
//
// Drei Stimmen, alles im Browser erzeugt (keine Aufnahmen, keine fremden Melodien – Ragas gehören niemandem):
//   – die Tanpura: vier gezupfte Saiten (Pa, Sa, Sa, tiefes Sa), immer im selben Kreis, ein schwebender Grund, der nie
//     aufhört. Ihr Schnarren (Jivari) ist ein Klangfleck, der nach jedem Zupfen von hell nach dunkel durch die Obertöne wandert.
//   – die Flöte (Venu): eine Phrase ist ein einziger Atem – die Töne gleiten ineinander, mit den Verzierungen (Gamakas), die
//     den Raga ausmachen: Kampita (der Ton schwingt zum oberen Nachbarn), Nokku (ein Ton wird von oben angestoßen) und Jaru
//     (ein langsames Gleiten von Ton zu Ton).
//   – das Klavier: wenige tiefe Töne, wie Steine, die ins Wasser fallen – und selten ein einzelner heller Tropfen.
//
// Sa (der Grundton) ist D – wie das Meeresstück (OceanScore), damit der Wechsel zwischen den Orten nicht schmerzt.
// ---------------------------------------------------------------------------

import type { ScoreMode, ScoreMood } from './OceanScore';

/** Grundton der Flöte (MIDI): D4. Die Tanpura liegt eine und zwei Oktaven tiefer. */
const SA = 62;
/** Neelambari (aus dem Dur-Raga Sankarabharanam): Sa Ri2 Ga3 Ma1 Pa Dha2 Ni3 – Abstände zum Sa in Halbtönen */
export const SWARA: Record<string, number> = { S: 0, R: 2, G: 4, M: 5, P: 7, D: 9, N: 11 };
const ORDER = ['S', 'R', 'G', 'M', 'P', 'D', 'N'];
/** so lang ist ein Schlag der freien Zeit (Sekunden) – jeder Ton weicht davon etwas ab */
const BEAT = 0.6;
/**
 * Wie viel Atem in der Flöte liegt (0 = reiner Ton). Er klingt nur in einem engen Band um den gespielten Ton – kein Rauschen
 * im Hintergrund – und beim Anblasen etwas mehr.
 */
const BREATH = 1;
/** Verstärkung des schmalen Atembands (es ist von sich aus sehr leise): im Ton und beim Anblasen */
const AIR = 9, AIR_ONSET = 26;

type Gamaka = 'plain' | 'kampita' | 'nokku' | 'jaru';
export interface Tone { semi: number; beats: number; gamaka: Gamaka }
export interface Phrase { tones: (Tone | { rest: number })[]; /** tiefer Klavierton zum Beginn (Halbtöne zum tiefen Sa), wenn gesetzt */ root?: number }

/**
 * Eine Phrase in Swara-Schrift: „S R ~G:3 R S:4“. Ton S R G M P D N, danach ^ (eine Oktave höher) oder _ (tiefer), nach dem
 * Doppelpunkt die Schläge. Davor: ~ Kampita, * Nokku, / Jaru (langsames Gleiten zu diesem Ton). „-:2“ ist eine Atempause.
 */
export function parse(src: string, root?: number): Phrase {
  const tones: Phrase['tones'] = [];
  for (const tok of src.trim().split(/\s+/)) {
    const [head, b] = tok.split(':');
    const beats = b ? Number(b) : 1;
    if (head === '-') { tones.push({ rest: beats }); continue; }
    const m = /^([~*/]?)([SRGMPDN])([\^_]*)$/.exec(head);
    if (!m) throw new Error('Swara? ' + tok);
    const oct = [...m[3]].reduce((o, c) => o + (c === '^' ? 12 : -12), 0);
    const gamaka: Gamaka = m[1] === '~' ? 'kampita' : m[1] === '*' ? 'nokku' : m[1] === '/' ? 'jaru' : 'plain';
    tones.push({ semi: SWARA[m[2]] + oct, beats, gamaka });
  }
  return { tones, root };
}

/** Der obere Nachbar im Raga (für Kampita und Nokku). */
export function upper(semi: number) {
  const oct = Math.floor(semi / 12), within = semi - oct * 12;
  const i = ORDER.findIndex(s => SWARA[s] > within);
  return i < 0 ? (oct + 1) * 12 : oct * 12 + SWARA[ORDER[i]];
}

// Die Alapana in vier Teilen. Jeder Durchgang wählt je Teil einige Phrasen (nie dieselbe zweimal hintereinander), so
// klingt es jedes Mal etwas anders und doch vertraut. Neelambari lebt vom wiegenden Ga und Ni, Dha nur im Umweg P-D-P.
export const SECTIONS: { phrases: Phrase[]; count: [number, number] }[] = [
  // Mandra: um den Grundton, tief und tastend
  {
    count: [2, 3],
    phrases: [
      parse('S:4 -:1 N_ ~S:4', 0),
      parse('S:2 P_:2 ~N_:3 S:5', 0),
      parse('S R ~G:3 R S:4', 0),
      parse('N_ S R S N_ P_:2 /N_:2 S:4', 7),
    ],
  },
  // Madhya: das wiegende Herz des Ragas – Ga und Ma, das Schlaflied
  {
    count: [2, 4],
    phrases: [
      parse('G M ~G:3 R S:2 N_ S:4', 0),
      parse('M P:2 ~M G:3 R S:3', 5),
      parse('P:2 M G ~M:2 P:4', 7),
      parse('S G M P M ~G:4 R S:3', 0),
      parse('G M P D P M:2 ~G:3', 5),
    ],
  },
  // Tara: hinauf zum hohen Sa – der weiteste Atem
  {
    count: [2, 3],
    phrases: [
      parse('P N ~S^:4 N P:2 M ~G:3', 7),
      parse('G M P ~N:2 /S^:4 R^ S^:2 N P:3', 7),
      parse('S^:2 ~N:2 P D P:2 M G:2 R S:3', 0),
      parse('M P N S^ *R^:2 S^:3 ~N:2 P:3', 7),
    ],
  },
  // Rückkehr: hinab und zur Ruhe – wie ein Kind, das einschläft
  {
    count: [1, 2],
    phrases: [
      parse('M G:2 ~R S:2 N_ ~S:6', 0),
      parse('P M ~G:2 R:2 /S:6', 0),
      parse('G R S N_ P_:2 /S:6', 0),
    ],
  },
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** ein kleiner fester Zufall (pro Durchgang gleich – zum Prüfen wiederholbar) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}

interface Str { osc: OscillatorNode; body: GainNode; buzz: GainNode; sweep: BiquadFilterNode; f: number }

/** Die Alapana des Laichflusses. Gleiche Schnittstelle wie OceanScore (Audio.ts wählt je Ort). */
export class RagaScore {
  readonly out: GainNode;
  private duck: GainNode;
  private tone: BiquadFilterNode;
  private input: GainNode;
  private fluteBus: GainNode;
  private droneBus: GainNode;
  private strings: Str[] = [];
  private nodes = new Set<AudioScheduledSourceNode>();
  private noise: AudioBuffer;
  private depthTo = 0;
  private threatTo = 0;
  depth = 0;
  threat = 0;
  private lastT: number;
  private modeName: ScoreMode = 'level';
  private lossUntil = -1;
  private stopped = false;
  /** die Tanpura: nächster Zupfer und welche Saite */
  private pluckAt: number;
  private pluckIndex = 0;
  /** die Alapana: Plan dieses Durchgangs, nächste Phrase und wann */
  private plan: Phrase[] = [];
  private planIndex = 0;
  private cycle = 0;
  private phraseAt: number;
  private random = rng(9);
  /** für Prüfungen: was geplant wurde */
  readonly log: { t: number; kind: 'flute' | 'piano' | 'pluck'; midi: number }[] = [];
  private note(t: number, kind: 'flute' | 'piano' | 'pluck', midi: number) {
    if (this.log.length > 3000) this.log.splice(0, 1500);
    this.log.push({ t, kind, midi });
  }

  constructor(private ctx: BaseAudioContext, dest: AudioNode, t0 = ctx.currentTime) {
    this.lastT = t0;
    this.out = this.gain(0, dest);
    this.duck = this.gain(1, this.out);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.frequency.value = 5200; this.tone.Q.value = 0.35;
    this.tone.connect(this.duck);
    // Raum: einige leise, verschieden weit entfernte Antworten, nach außen dunkler und abwechselnd links und rechts –
    // ein Wassergewölbe ohne Hallrauschen und ohne Rückkopplung
    this.input = this.gain(0.9, this.tone);
    for (const [seconds, wet, pan, cut] of [[0.13, 0.12, -0.35, 3800], [0.29, 0.1, 0.4, 3000], [0.47, 0.075, -0.2, 2300], [0.71, 0.05, 0.3, 1700], [1.04, 0.03, 0, 1200]]) {
      const delay = ctx.createDelay(1.5); delay.delayTime.value = seconds;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      this.input.connect(delay); delay.connect(lp); lp.connect(p); p.connect(this.gain(wet, this.tone));
    }
    this.fluteBus = this.gain(1, this.input);
    this.droneBus = this.gain(0, this.tone);
    this.droneBus.gain.setTargetAtTime(1, t0, 1.2);
    // Atem der Flöte: ein kurzes Stück weiches Rauschen, einmal erzeugt (es klingt nur durch ein enges Band um den Ton)
    const len = Math.floor(ctx.sampleRate * 2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = b; }
    this.buildTanpura(t0);
    this.pluckAt = t0 + 0.4;
    this.phraseAt = t0 + 5.5;
    this.out.gain.setTargetAtTime(0.8, t0, 1.8);
  }

  private gain(value: number, dest: AudioNode | AudioParam) {
    const g = this.ctx.createGain(); g.gain.value = value;
    if (dest instanceof AudioParam) g.connect(dest); else g.connect(dest);
    return g;
  }

  // ------------------------------------------------------------- Tanpura

  /** Vier Saiten mit obertonreichem Klang; jede klingt durch einen tiefen Körper und ein wanderndes Schnarren. */
  private buildTanpura(t0: number) {
    const ctx = this.ctx, n = 24;
    const real = new Float32Array(n), imag = new Float32Array(n);
    // viele Obertöne, langsam schwächer – darunter einige stärker (die Saite schnarrt am Steg)
    for (let k = 1; k < n; k++) imag[k] = (1 / Math.pow(k, 0.85)) * (k % 2 ? 1 : 0.8);
    const wave = ctx.createPeriodicWave(real, imag);
    // Pa (tief), Sa, Sa (minimal verstimmt – die beiden schweben gegeneinander), tiefes Sa
    const notes = [[SA - 17, 0], [SA - 12, 0], [SA - 12, 0.0016], [SA - 24, 0]];
    for (const [midi, detune] of notes) {
      const f = mtof(midi) * (1 + detune);
      const osc = ctx.createOscillator(); osc.setPeriodicWave(wave); osc.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 3.2; lp.Q.value = 0.5;
      const sweep = ctx.createBiquadFilter(); sweep.type = 'bandpass'; sweep.frequency.value = f * 4; sweep.Q.value = 4.5;
      const body = this.ctx.createGain(); body.gain.value = 0;
      const buzz = this.ctx.createGain(); buzz.gain.value = 0;
      const pan = ctx.createStereoPanner(); pan.pan.value = (this.strings.length - 1.5) * 0.12;
      osc.connect(lp); lp.connect(body); body.connect(pan);
      osc.connect(sweep); sweep.connect(buzz); buzz.connect(pan);
      pan.connect(this.droneBus);
      osc.start(t0);
      this.nodes.add(osc);
      osc.onended = () => {
        for (const n of [osc, lp, sweep, body, buzz, pan] as AudioNode[]) n.disconnect();
        this.nodes.delete(osc);
        if (this.stopped && this.nodes.size === 0) this.out.disconnect();
      };
      this.strings.push({ osc, body, buzz, sweep, f });
    }
  }

  /** Eine Saite zupfen: kurzer Anschlag, der Körper klingt lange; das Schnarren blüht auf und wandert nach unten. */
  private pluck(s: Str, t: number, level: number) {
    const b = s.body.gain, z = s.buzz.gain, f = s.sweep.frequency;
    b.setTargetAtTime(level, t, 0.012);
    b.setTargetAtTime(level * 0.32, t + 0.05, 1.6);
    z.setTargetAtTime(level * 0.25, t, 0.02);
    z.setTargetAtTime(level * 0.75, t + 0.04, 0.22);
    z.setTargetAtTime(level * 0.12, t + 0.7, 1.1);
    f.setTargetAtTime(s.f * 11, t, 0.01);
    f.setTargetAtTime(s.f * 2.6, t + 0.03, 0.9);
    this.note(t, 'pluck', 12 * Math.log2(s.f / 440) + 69);
  }

  // ------------------------------------------------------------- Flöte

  /** Eine ganze Phrase in einem Atem: eine Tonhöhe, die gleitet, schwingt und angestoßen wird; dazu Lautstärke und Atem. */
  private flute(t0: number, phrase: Phrase, transpose: number): number {
    const ctx = this.ctx, r = this.random;
    // Zeitplan: frei, jeder Ton etwas anders lang; das Ende der Phrase wird breiter
    const tones = phrase.tones;
    let t = t0;
    const times: { at: number; dur: number; tone?: Tone }[] = [];
    tones.forEach((tn, i) => {
      const last = i === tones.length - 1;
      const dur = ('rest' in tn ? tn.rest : tn.beats) * BEAT * (0.88 + r() * 0.24) * (last ? 1.35 : 1);
      times.push({ at: t, dur, tone: 'rest' in tn ? undefined : tn });
      t += dur;
    });
    const end = t;
    const pitch = ctx.createConstantSource();
    const first = times.find(x => x.tone)!.tone!;
    const f0 = mtof(SA + first.semi + transpose);
    pitch.offset.setValueAtTime(f0 * 0.985, t0);
    const fund = ctx.createOscillator(), second = ctx.createOscillator(), third = ctx.createOscillator();
    for (const o of [fund, second, third]) o.frequency.value = 0;
    const x2 = this.gain(2, second.frequency), x3 = this.gain(3, third.frequency);
    pitch.connect(fund.frequency); pitch.connect(x2); pitch.connect(x3);
    third.type = 'triangle';
    // Vibrato: setzt erst bei langen Tönen ein, leicht und langsam
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6 + r() * 0.8;
    const vib = this.gain(0, pitch.offset); lfo.connect(vib);
    const amp = ctx.createGain(); amp.gain.value = 0;
    const g1 = this.gain(1, amp), g2 = this.gain(0.16, amp), g3 = this.gain(0.035, amp);
    fund.connect(g1); second.connect(g2); third.connect(g3);
    // Atem: das Rauschen durch ein enges Band, das der Tonhöhe folgt – und ein Hauch beim Anblasen
    const air = ctx.createBufferSource(); air.buffer = this.noise; air.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 14; band.frequency.value = 0;
    pitch.connect(this.gain(1, band.frequency));
    const airAmp = ctx.createGain(); airAmp.gain.value = 0;
    air.connect(band); band.connect(airAmp); airAmp.connect(amp);
    const pan = ctx.createStereoPanner(); pan.pan.value = (r() - 0.5) * 0.3;
    const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = transpose < 0 ? 2200 : 3400;
    amp.connect(lowpass); lowpass.connect(pan); pan.connect(this.fluteBus);

    const level = 0.05 * (this.modeName === 'still' ? 0.7 : 1);
    const p = pitch.offset, a = amp.gain, br = airAmp.gain;
    // Anblasen: weich, mit etwas mehr Luft
    a.setValueAtTime(0, t0);
    a.setTargetAtTime(level, t0, 0.09);
    br.setValueAtTime(0, t0);
    br.setTargetAtTime(BREATH * AIR_ONSET, t0, 0.03);
    br.setTargetAtTime(BREATH * AIR, t0 + 0.12, 0.25);
    let prev: number | undefined;
    for (const { at, dur, tone } of times) {
      if (!tone) {
        // eine kurze Atempause mitten in der Phrase
        a.setTargetAtTime(0, at, 0.06);
        br.setTargetAtTime(0, at, 0.05);
        a.setTargetAtTime(level, at + dur - 0.05, 0.08);
        br.setTargetAtTime(BREATH * AIR_ONSET * 0.7, at + dur - 0.05, 0.03);
        br.setTargetAtTime(BREATH * AIR, at + dur + 0.1, 0.25);
        prev = undefined;
        continue;
      }
      const f = mtof(SA + tone.semi + transpose), up = mtof(SA + upper(tone.semi) + transpose);
      // jeder Ton wird etwas betont und atmet dann
      if (prev !== undefined) a.setTargetAtTime(level * (1.05 + r() * 0.12), at, 0.07);
      a.setTargetAtTime(level * 0.86, at + Math.min(0.5, dur * 0.4), Math.max(0.2, dur * 0.5));
      if (tone.gamaka === 'nokku') {
        // von oben angestoßen
        p.setTargetAtTime(up, at, 0.018);
        p.setTargetAtTime(f, at + 0.1, 0.03);
      } else if (tone.gamaka === 'jaru') {
        // langsam hinübergleiten
        p.setTargetAtTime(f, at, 0.16);
      } else {
        // gewöhnlich: kurz und weich legato
        p.setTargetAtTime(f, at, prev === undefined ? 0.01 : 0.035);
      }
      if (tone.gamaka === 'kampita') {
        // der Ton schwingt zum oberen Nachbarn und zurück – erst ruhig, dann einige Male, zum Schluss bleibt er stehen
        const swing = 0.17 + r() * 0.05;
        let s = at + Math.min(0.35, dur * 0.25), k = 0;
        while (s + swing < at + dur * 0.82) {
          p.setTargetAtTime(k % 2 === 0 ? f + (up - f) * 0.85 : f, s, swing * 0.28);
          s += swing; k++;
        }
        p.setTargetAtTime(f, s, 0.05);
      }
      // langes Halten: Vibrato setzt spät und leise ein
      const vg = vib.gain;
      vg.setTargetAtTime(0, at, 0.05);
      if (dur > 1.1 && tone.gamaka !== 'kampita') vg.setTargetAtTime(f * 0.0055, at + 0.55, 0.4);
      prev = f;
      this.note(at, 'flute', SA + tone.semi + transpose);
    }
    // ausatmen: Ton und Luft vergehen gemeinsam
    a.setTargetAtTime(0, end - 0.1, 0.22);
    br.setTargetAtTime(0, end - 0.15, 0.15);
    const stop = end + 1.6;
    for (const src of [pitch, fund, second, third, lfo, air] as AudioScheduledSourceNode[]) {
      src.start(t0);
      src.stop(stop);
      this.nodes.add(src);
    }
    fund.onended = () => {
      for (const n of [pitch, fund, second, third, lfo, air, vib, amp, g1, g2, g3, x2, x3, band, airAmp, lowpass, pan] as AudioNode[]) n.disconnect();
      for (const n of [pitch, fund, second, third, lfo, air]) this.nodes.delete(n);
      if (this.stopped && this.nodes.size === 0) this.out.disconnect();
    };
    return end;
  }

  // ------------------------------------------------------------- Klavier

  /** Ein tiefer, weicher Klavierton – wie ein Stein, der ins Wasser fällt: kurzer Anschlag, langer, dunkler Nachklang. */
  private piano(t: number, midi: number, velocity: number) {
    const f = mtof(midi);
    const stereo = this.ctx.createStereoPanner(); stereo.pan.value = Math.max(-0.3, Math.min(0.3, (midi - 50) * 0.02));
    stereo.connect(this.input);
    const weights = [0.85, 0.34, 0.14, 0.07, 0.03, 0.012];
    const durations = [9, 5.4, 3.2, 2.1, 1.3, 0.9];
    let remaining = weights.length;
    weights.forEach((weight, i) => {
      const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
      const partial = i + 1, duration = durations[i] * (midi < 48 ? 1.2 : 1);
      osc.frequency.value = f * partial * Math.sqrt(1 + 0.00005 * partial * partial);
      const peak = velocity * weight;
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(peak, t + 0.009);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.000001, peak * 0.5), t + 0.3 / (1 + i * 0.3));
      amp.gain.exponentialRampToValueAtTime(Math.max(0.000001, peak * 0.06), t + duration * 0.5);
      amp.gain.exponentialRampToValueAtTime(0.000001, t + duration);
      amp.gain.linearRampToValueAtTime(0, t + duration + 0.03);
      osc.connect(amp); amp.connect(stereo); this.nodes.add(osc);
      osc.onended = () => {
        osc.disconnect(); amp.disconnect(); this.nodes.delete(osc);
        if (--remaining === 0) stereo.disconnect();
        if (this.stopped && this.nodes.size === 0) this.out.disconnect();
      };
      osc.start(t); osc.stop(t + duration + 0.05);
    });
    this.note(t, 'piano', midi);
  }

  // ------------------------------------------------------------- Ablauf

  /** Der Plan eines Durchgangs: aus jedem Teil einige Phrasen, nie dieselbe zweimal hintereinander. */
  private newPlan() {
    const r = this.random, plan: Phrase[] = [];
    let last: Phrase | undefined;
    for (const sec of SECTIONS) {
      const n = sec.count[0] + Math.floor(r() * (sec.count[1] - sec.count[0] + 1));
      for (let i = 0; i < n; i++) {
        let pick = sec.phrases[Math.floor(r() * sec.phrases.length)];
        if (pick === last) pick = sec.phrases[(sec.phrases.indexOf(pick) + 1) % sec.phrases.length];
        plan.push(pick);
        last = pick;
      }
    }
    this.plan = plan;
    this.planIndex = 0;
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
    this.duck.gain.setTargetAtTime(0.25, t, 0.2);
    this.duck.gain.setTargetAtTime(1, t + 3, 1.5);
  }

  /** Plant bis zur Audiozeit t voraus. Überfälliges wird ausgelassen und nicht nachgeholt. */
  tick(t: number) {
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    const dt = Math.max(0, Math.min(2, t - this.lastT)); this.lastT = t;
    this.depth += (this.depthTo - this.depth) * (1 - Math.exp(-dt / 3));
    this.threat += (this.threatTo - this.threat) * (1 - Math.exp(-dt / 6));
    // tiefer im Wasser wird es dunkler; naht Gefahr, tritt die Flöte zurück (die Tanpura bleibt – der Grund trägt)
    this.tone.frequency.setTargetAtTime(1100 + 4100 * (1 - this.depth) ** 2, t, 1.2);
    this.fluteBus.gain.setTargetAtTime(1 - 0.75 * this.threat, t, 0.8);
    // nach langer Unterbrechung (verborgener Tab) nicht nachholen, sondern von jetzt an weiter
    if (this.pluckAt < now) this.pluckAt = now + 0.05;
    if (this.phraseAt < now - 0.5) this.phraseAt = now + 1.5;
    // die Tanpura: Pa – Sa – Sa – tiefes Sa, immer weiter, ganz leicht ungleichmäßig wie von Hand
    while (this.pluckAt <= t) {
      const i = this.pluckIndex % 4;
      this.pluck(this.strings[i], this.pluckAt, [0.024, 0.02, 0.02, 0.028][i]);
      this.pluckIndex++;
      this.pluckAt += (i === 3 ? 1.75 : 1.12) + (this.random() - 0.5) * 0.06;
    }
    // die Alapana
    while (this.phraseAt <= t) {
      if (this.planIndex >= this.plan.length) {
        this.newPlan();
        // nach einem ganzen Durchgang eine lange Stille, in der nur die Tanpura klingt
        if (this.cycle++ > 0) { this.phraseAt += 14; continue; }
      }
      const phrase = this.plan[this.planIndex++];
      const at = this.phraseAt;
      if (at < this.lossUntil) { this.phraseAt = this.lossUntil + 1; continue; }
      // in der Tiefe spielt die Flöte eine Oktave tiefer – dunkler, näher am Grund
      const transpose = this.depth > 0.58 ? -12 : 0;
      // ein tiefer Klavierton vorweg: der Grund der Phrase
      if (phrase.root !== undefined && this.random() < 0.8) {
        this.piano(at, SA - 24 + phrase.root, 0.06);
        // manchmal antwortet ein zweiter Ton darüber (Quinte bzw. Sa)
        if (this.random() < 0.45) this.piano(at + 0.9 + this.random() * 0.4, phrase.root === 7 ? SA - 12 : SA - 12 + phrase.root + 7, 0.032);
      }
      const end = this.flute(at + 1.1, phrase, transpose);
      // selten ein heller Tropfen nach der Phrase, in der Stille
      if (this.random() < 0.3) this.piano(end + 0.8 + this.random() * 0.8, SA + 12 + [0, 4, 7, 11][Math.floor(this.random() * 4)], 0.014);
      // Atem zwischen den Phrasen – in der Tiefe und in Gefahr länger
      this.phraseAt = end + 2.4 + this.random() * 2.6 + this.depth * 2 + this.threat * 3;
    }
  }

  stop(t: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.6);
    for (const n of this.nodes) { try { n.stop(t + 3); } catch { /* schon beendet */ } }
    if (this.nodes.size === 0) this.out.disconnect();
  }
}
