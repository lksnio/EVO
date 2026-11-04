import { CAMERA } from '../config';

/**
 * Wie nah die Kamera am eigenen Tier ist (Zoom), nach seiner Körperbreite (Bildpunkte der Welt). Ein ausgewachsenes Starttier
 * bekommt `CAMERA.adult`; kleinere Tiere rückt sie näher heran, größere lässt sie mehr Raum – gedämpft, damit Wachsen und
 * große Gestalten spürbar bleiben.
 */
export function frameZoom(width: number, c: typeof CAMERA = CAMERA) {
  const w = Math.max(1, width);
  return Math.min(c.max, Math.max(c.min, c.adult * (c.ref / w) ** c.follow));
}

/**
 * Wohin die Kamera vorausschaut (Anteil der Bildbreite bzw. -höhe, Vorzeichen = Richtung): in Blickrichtung etwas, in voller
 * Fahrt mehr; beim Steigen und Sinken ein Stück nach oben bzw. unten. speed01: 0 im Stand … 1 volle Fahrt (darüber: Sprint);
 * climb: senkrechte Fahrt, −1 (steigt) … 1 (sinkt).
 */
export function leadOf(facing: number, speed01: number, climb: number, c: typeof CAMERA = CAMERA) {
  const s = Math.min(1, Math.max(0, speed01));
  const y = Math.min(1, Math.max(-1, climb));
  return { x: Math.sign(facing || 1) * (c.idle + (c.lead - c.idle) * s), y: y * c.leadY };
}
