import { smoothstep } from './anatomy';

// ---------------------------------------------------------------------------
// Die Wirbelsäule des Fisches als reine Rechnung (ohne Phaser): Aus den Gelenkspalten (x in Ruhe) und den Pose-Werten entstehen
// Position und Winkel jeder Spalte. Jede Pose wird neu aus der Ruheform berechnet – nichts summiert sich über die Zeit auf – und
// die Länge der Wirbelsäule bleibt erhalten (der Fisch wird nicht gummiartig gedehnt).
// ---------------------------------------------------------------------------

export interface SpineIn {
  /** Ruhe-x der Spalten, aufsteigend (Schwanz … Schnauze) */
  colX: ArrayLike<number>;
  /** Drehpunkt: Dort bleibt der Rumpf in Ruhe */
  xa: number;
  /** Länge von Drehpunkt bis Schwanzspitze (Zeicheneinheiten) */
  Ls: number;
  /** Ausschlag der Welle an der Schwanzspitze, Wellenzahl, Phase (Bogenmaß), Anstieg der Hüllkurve */
  amp: number;
  kw: number;
  ph: number;
  pw: number;
  /** Körperlänge (zur Skalierung der Krümmung beim Ausholen) und Krümmung (0 … 1) */
  bw: number;
  coil: number;
  /** Neigung des Kopfes (Bogenmaß), Ende der Halszone und Vorstoß des Kopfes (Zeicheneinheiten) */
  pitch: number;
  neckEnd: number;
  lungeDx: number;
  /** Verschiebung des ganzen Tiers nach unten */
  bob: number;
}

/** Lage der Welle (seitliche Auslenkung) im Abstand s hinter dem Drehpunkt. */
export function wave(i: SpineIn, s: number) {
  const u = Math.max(0, Math.min(1.4, s / i.Ls));
  const env = Math.pow(u, i.pw);
  // Das Ausholen vor dem Biss krümmt den Schwanz seitlich (S-Form): statische Krümmung, die zur Spitze hin anwächst
  return i.amp * env * Math.sin(i.kw * s - i.ph) + i.coil * i.bw * 0.075 * Math.pow(u, 1.8);
}

export function solveSpine(i: SpineIn, sx: Float32Array, sy: Float32Array, sb: Float32Array) {
  const n = i.colX.length;
  // Spalte des Drehpunkts
  let ia = 0;
  for (let k = 0; k < n; k++) if (Math.abs(i.colX[k] - i.xa) < Math.abs(i.colX[ia] - i.xa)) ia = k;
  const xa = i.colX[ia];
  // Winkel: hinten aus der Welle (Tangente), vorn aus der Kopfneigung
  for (let k = 0; k < n; k++) {
    const x = i.colX[k];
    if (x <= xa) {
      const s = xa - x, d = 0.5, s0 = Math.max(0, s - d);
      sb[k] = -Math.atan((wave(i, s + d) - wave(i, s0)) / (s + d - s0));
    } else sb[k] = i.pitch * smoothstep(xa, i.neckEnd, x);
  }
  sx[ia] = xa;
  sy[ia] = i.bob;
  // von dort aus: Gelenk für Gelenk, mit gleichbleibendem Abstand (die Länge bleibt erhalten)
  for (let k = ia - 1; k >= 0; k--) {
    const d = i.colX[k + 1] - i.colX[k];
    const a = (sb[k] + sb[k + 1]) * 0.5;
    sx[k] = sx[k + 1] - d * Math.cos(a);
    sy[k] = sy[k + 1] - d * Math.sin(a);
  }
  for (let k = ia + 1; k < n; k++) {
    const d = i.colX[k] - i.colX[k - 1];
    const a = (sb[k] + sb[k - 1]) * 0.5;
    sx[k] = sx[k - 1] + d * Math.cos(a);
    sy[k] = sy[k - 1] + d * Math.sin(a);
  }
  // Vorstoß beim Biss: Der Kopf wandert nach vorn, der Hals streckt sich (die Spalten dazwischen folgen weich)
  for (let k = ia + 1; k < n; k++) sx[k] += i.lungeDx * smoothstep(xa, i.neckEnd, i.colX[k]);
  return ia;
}
