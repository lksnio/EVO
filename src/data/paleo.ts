import raw from './paleo.json';

// ---------------------------------------------------------------------------
// Die Urzeit-Karten. Frei nach der echten Paläogeografie (Gondwana im Süden, Laurentia/Laurussia am Äquator, Sibiria
// im Norden, dazwischen Iapetus-/Rheischer Ozean und ringsum Panthalassa) – stark vereinfacht, die Umrisse sind
// gezeichnet, nicht vermessen. Koordinaten 0..1 (links→rechts, oben→unten; unten ist Süden).
// ---------------------------------------------------------------------------

export type Pt = [number, number];

export interface PaleoContinent {
  name: string;
  /** Lage der Beschriftung */
  label: Pt;
  pts: Pt[];
}

export interface PaleoOcean {
  name: string;
  x: number;
  y: number;
}

export interface PaleoMap {
  continents: PaleoContinent[];
  /** Land außerhalb des Gebiets der Orte (Koordinaten auch unter 0 und über 1): nur Kulisse der weit herausgezoomten Karte */
  far: PaleoContinent[];
  oceans: PaleoOcean[];
  /** Lage der Orte (nach ihrer Rolle: start, lush1 …) */
  nodes: Record<string, Pt>;
}

export const PALEO = raw as unknown as Record<string, PaleoMap>;
