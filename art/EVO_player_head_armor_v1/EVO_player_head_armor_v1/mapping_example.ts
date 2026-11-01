/**
 * Beispiel einer ersten, augenzentrierten Registrierung der Panzerbasis.
 * Koordinaten sind g-Einheiten im Körperrahmen des Fisches.
 * Vor der Verwendung im Rig Krone, Hinterkante und Schnauze visuell abstimmen.
 * Augenöffnung und Kopf-/Körpermaske werden getrennt durch den Importer gesetzt.
 */
export interface HeadArmorAnatomy {
  hg: { L: number; H: number };
  eye: { x: number; y: number };
}

export const HEAD_ARMOR_REFERENCE = {
  imageWidth: 1334,
  imageHeight: 1179,
  eyePixelX: 710.522233565205,
  eyePixelY: 638.4097006243917,
  gUnitsPerPixel: 0.040158598934182554,
  headLength: 28.4,
  headHeight: 39.192,
} as const;

export function headArmorRect(A: HeadArmorAnatomy) {
  const r = HEAD_ARMOR_REFERENCE;
  const sx = r.gUnitsPerPixel * A.hg.L / r.headLength;
  const sy = r.gUnitsPerPixel * A.hg.H / r.headHeight;
  return {
    x: A.eye.x - r.eyePixelX * sx,
    y: A.eye.y - r.eyePixelY * sy,
    width: r.imageWidth * sx,
    height: r.imageHeight * sy,
  };
}

// Im vorbereiteten Körper-Zeichenkontext beispielsweise:
// const r = headArmorRect(A);
// ctx.drawImage(armorImage, r.x, r.y, r.width, r.height);
// Anschließend Panzer-Kopfmaske und dynamische Augenöffnung berücksichtigen.
