// Regeln für den Grafikspeicher (siehe art/texBudget.ts) – ohne Phaser, damit sie sich prüfen lassen.

/** große Bilder, die nur zu einem Ort (bzw. seiner Stimmung) gehören */
const PLACE_FAMILIES = [/^inkbg_/, /^inkmurk_/, /^chasm_shade/, /^shade_gap_/];

export const placeBound = (key: string) => PLACE_FAMILIES.some(r => r.test(key));

/**
 * Bildfamilien, die sich gefahrlos freigeben lassen: Ihre Maler prüfen je Bild, ob es noch da ist, und malen es sonst neu;
 * niemand hält ihre Bilder anderswo fest. Nicht dabei sind die verformbaren Fischnetze (Spielerfisch, Artgenossen, gemalte
 * Fische – ihre Zwischenspeicher und Netze hängen an den Bildern), Bedienelemente und alles Unbekannte.
 */
const EVICTABLE = [
  ...PLACE_FAMILIES, /^depth_shade/,
  /^sp_/, /^sea_sil_/, /^food_/, /^ink_food_/, /^plankton$/, /^grapto$/,
  /^river_/, /^swell_/, /^rain_/, /^surface_loop_/, /^surface_clouds$/, /^surface_glint$/,
];
export const evictable = (key: string) => EVICTABLE.some(r => r.test(key));

/** Die Stämme sichtbarer Bilder: „wf_moythomasia_fb“ → „wf_moythomasia“. */
export function stemsOf(keys: Iterable<string>) {
  const stems = new Set<string>();
  for (const k of keys) { const i = k.lastIndexOf('_'); if (i > 1) stems.add(k.slice(0, i)); }
  return stems;
}

/**
 * Ist das Bild geschützt – selbst sichtbar oder ein Geschwister eines sichtbaren Bildes (gleicher Namensstamm: „…_fe“,
 * „…_fj“, Bewegungsphasen „…_0“, „…_1“)? Manche Ansichten wechseln ihre Bilder erst später.
 */
export function protectedKey(key: string, used: { keys: Set<string>; stems: Set<string> }) {
  if (used.keys.has(key) || used.stems.has(key)) return true;
  for (let i = key.indexOf('_'); i > 0; i = key.indexOf('_', i + 1)) if (used.stems.has(key.slice(0, i))) return true;
  return false;
}
