import { Piano } from './Piano';
import { followMood, musicalTension, pianoPhrase, unit, type MusicState, type ScoreMode, type ScoreMood } from './scoreMusic';
export type { ScoreMode, ScoreMood } from './scoreMusic';

/** Existing ocean themes, played as melodic solo piano with dark, modal folk harmonies. */
export class OceanScore {
  readonly out: GainNode;
  readonly piano: Piano;
  private duck: GainNode;
  private state: MusicState = { depth: 0, threat: 0, injury: 0 };
  private target: MusicState = { depth: 0, threat: 0, injury: 0 };
  private modeName: ScoreMode = 'level';
  private lastT: number;
  private next: number;
  private step = 0;
  private stopped = false;
  private lossUntil = -Infinity;

  get depth() { return this.state.depth; }
  get threat() { return this.state.threat; }
  get injury() { return this.state.injury; }
  get tension() { return musicalTension(this.state); }

  constructor(private ctx: BaseAudioContext, destination: AudioNode, t0 = ctx.currentTime) {
    this.lastT = t0;
    this.next = t0 + 0.08;
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(destination);
    this.duck = ctx.createGain(); this.duck.connect(this.out);
    this.piano = new Piano(ctx, this.duck);
    this.out.gain.setTargetAtTime(1, t0, 1.2);
  }

  set(m: ScoreMood) {
    if (m.depth !== undefined) this.target.depth = unit(m.depth);
    if (m.threat !== undefined) this.target.threat = unit(m.threat);
    if (m.injury !== undefined) this.target.injury = unit(m.injury);
  }

  mode(mode: ScoreMode) {
    this.modeName = mode;
    if (mode !== 'level') {
      this.target = { depth: mode === 'still' ? 0.18 : 0.04, threat: 0, injury: 0 };
      this.state.threat = this.state.injury = 0;
    }
  }

  /** A broken cadence for a lost companion; the current piece continues afterwards. */
  loss(time: number) {
    if (this.stopped || time < this.lossUntil - 2) return;
    this.lossUntil = time + 6;
    this.duck.gain.cancelScheduledValues(time);
    this.duck.gain.setTargetAtTime(0.15, time, 0.15);
    this.duck.gain.setTargetAtTime(1, time + 3.5, 1.5);
    this.piano.play(50, time + 0.1, 0.6, 4.2);
    this.piano.play(69, time + 0.65, 0.55, 3.4, { depth: this.depth, tension: 0.55 }, true);
    this.piano.play(72, time + 2.2, 0.4, 3.4);
  }

  /** Plan to an absolute audio-clock horizon, in live play and OfflineAudioContext previews alike. */
  tick(time: number) {
    if (this.stopped) return;
    const dt = Math.max(0, Math.min(2, time - this.lastT)); this.lastT = time;
    this.state = followMood(this.state, this.target, dt);
    const depth = this.depth, tension = this.modeName === 'level' ? this.tension : 0;
    this.piano.colour(depth, tension, Math.max(this.ctx.currentTime, time - 0.35));
    // A throttled tab never replays a backlog of missed bars in one loud burst.
    if (this.next < this.ctx.currentTime - 0.5) this.next = this.ctx.currentTime + 0.05;
    let scheduled = 0;
    while (this.next <= time && scheduled++ < 24) {
      const bar = Math.floor(this.step / 8), position = this.step % 8;
      const bpm = (this.modeName === 'still' ? 58 : 68) - depth * 9 + tension * 7;
      if (this.next >= this.lossUntil) {
        for (const note of pianoPhrase(bar, position, depth, this.modeName)) {
          const human = ((this.step * 7 + note.midi) % 9 - 4) * 0.002;
          this.piano.play(note.midi, this.next + Math.max(0, human), note.velocity, note.hold, { depth, tension });
          // Danger changes this melody's tuning/voicing; it does not add a heartbeat or a separate chase track.
          if (tension > 0.2 && note.voice === 'melody' && (bar + position) % 3 === 0) {
            this.piano.play(note.midi + 1, this.next + 0.045, note.velocity * tension * 0.55, note.hold * 0.65, { depth, tension }, true);
          }
        }
      }
      this.next += 30 / bpm;
      this.step++;
    }
  }

  stop(time: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.out.gain.cancelScheduledValues(time);
    this.out.gain.setTargetAtTime(0.0001, time, 0.22);
    this.piano.stop(time);
  }
}
