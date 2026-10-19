import { EXTRAPOLATE_MS, INTERP_MAX_MS } from './protocol';

interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * Die geglättete Bahn eines Fisches oder Tiers, dessen Lage nur ab und zu über das Netz kommt.
 *   – Jede Meldung trägt die Uhrzeit des Absenders (sent). Wann sie hier „eigentlich“ gilt, wird daraus geschätzt: mit dem
 *     kürzesten Weg, den eine Meldung bisher brauchte (offset). So stört das Zittern des Netzes die Abstände nicht.
 *   – Gezeigt wird um eine Verzögerung zurück, die sich dem Netz anpasst: so knapp wie möglich (base), wenigstens etwas
 *     mehr als der übliche Abstand der Meldungen (ein langsamer Rechner meldet seltener), dazu so viel, wie Meldungen
 *     zuletzt verspätet waren (jitter) – höchstens INTERP_MAX_MS.
 *   – Bleibt eine Meldung aus, schwimmt es kurz in seiner Richtung weiter (EXTRAPOLATE_MS), statt stehen zu bleiben.
 */
export class Interp {
  private s: Sample[] = [];
  /** Ortszeit minus Absenderzeit auf dem schnellsten Weg (NaN: noch unbekannt) */
  private offset = NaN;
  /** wie verspätet Meldungen zuletzt kamen (ms, Spitzenwert, klingt langsam ab) */
  private jitter = 0;
  private lastSent = NaN;
  private lastPush = 0;
  /** üblicher Abstand der Meldungen beim Absender (ms, 0 = noch unbekannt) */
  private gap = 0;
  /** die Verzögerung, mit der gerade gezeigt wird (ms) */
  delay: number;

  constructor(private base: number) {
    this.delay = base;
  }

  /** Eine Meldung, die der Absender zu seiner Zeit sent (ms) schickte und die jetzt (now, Ortszeit) ankam. */
  push(sent: number, x: number, y: number, now: number) {
    if (sent === this.lastSent) return;
    const o = now - sent;
    // neue Uhr (anderer Absender, Neustart) oder Unsinn: von vorn
    if (Number.isNaN(this.offset) || sent < this.lastSent || Math.abs(o - this.offset) > 3000) {
      this.offset = o;
      this.jitter = 0;
      this.gap = 0;
      this.s = [];
    }
    // wie oft gemeldet wird, solange es sich bewegt (lange Pausen zählen nicht: Es stand still)
    const gap = sent - this.lastSent;
    if (gap > 0 && gap < 500) this.gap = this.gap ? this.gap + (gap - this.gap) * 0.1 : gap;
    // der kürzeste Weg darf langsam länger werden (andere Route, abweichende Uhren)
    this.offset = Math.min(o, this.offset + (now - this.lastPush) * 0.002);
    this.jitter = Math.max(o - this.offset, this.jitter - (now - this.lastPush) * 0.02);
    const prev = this.s[this.s.length - 1];
    // lange nichts gehört (es stand still): Bis kurz vorher stand es noch dort – sonst schliche es die ganze Pause hindurch
    if (prev && sent - this.lastSent > 400) this.s.push({ t: sent + this.offset - 100, x: prev.x, y: prev.y });
    this.lastSent = sent;
    this.lastPush = now;
    this.s.push({ t: sent + this.offset, x, y });
    while (this.s.length > 2 && now - this.s[0].t > 1500) this.s.shift();
  }

  get empty() {
    return !this.s.length;
  }

  /** Wo es jetzt (now, Ortszeit) zu zeigen ist. dt: Sekunden seit dem letzten Bild (die Verzögerung gleitet nach). */
  at(now: number, dt: number): { x: number; y: number } {
    const s = this.s;
    const want = Math.min(INTERP_MAX_MS, Math.max(this.base, this.gap * 1.25 + 15) + this.jitter * 1.2);
    this.delay += (want - this.delay) * Math.min(1, dt * (want > this.delay ? 4 : 0.7));
    const t = now - this.delay;
    const last = s[s.length - 1];
    if (!last) return { x: 0, y: 0 };
    if (t >= last.t) {
      // keine neuere Meldung: kurz in der letzten Richtung weiter
      const prev = s[s.length - 2];
      if (!prev) return { x: last.x, y: last.y };
      const ahead = Math.min(t - last.t, EXTRAPOLATE_MS);
      const k = ahead / Math.max(1, last.t - prev.t);
      return { x: last.x + (last.x - prev.x) * k, y: last.y + (last.y - prev.y) * k };
    }
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1], b = s[i];
      if (a.t <= t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: s[0].x, y: s[0].y };
  }
}
