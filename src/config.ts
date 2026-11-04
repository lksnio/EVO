// Zentrale Spielwerte.
export const W = 1280;
export const H = 720;
export const TILE = 40;
/**
 * Kamera im Level: nah am eigenen Tier. Sie richtet sich nach seiner Körperbreite – ein ausgewachsenes Starttier (Breite `ref`,
 * Bildpunkte der Welt) sieht man mit dem Zoom `adult`. Kleinere Tiere holt sie näher heran, größeren lässt sie mehr Raum,
 * aber gedämpft (`follow`: 0 = immer gleicher Zoom, 1 = das Tier ist immer gleich groß im Bild) – so bleibt das Wachsen
 * spürbar, und es passt auch für die späteren, ganz anders gebauten Tiere. `min`/`max` begrenzen den Zoom; `ease`: wie
 * schnell sie einer neuen Größe folgt (je Sekunde). `lead`: so weit (Anteil der Bildbreite) schaut sie in Schwimmrichtung
 * voraus – im Stand `idle`, in voller Fahrt `lead`; `leadY` nach oben/unten beim Steigen und Sinken; `leadEase` je Sekunde.
 */
export const CAMERA = { adult: 1.22, ref: 45, follow: 0.45, min: 0.85, max: 1.9, ease: 1.4, idle: 0.07, lead: 0.15, leadY: 0.09, leadEase: 1.3 };
/** der weiteste Zoom im Level: Bildschirmfeste Ebenen sind so groß, dass sie dann noch das ganze Bild füllen */
export const LEVEL_ZOOM = CAMERA.min;
/**
 * So viel Welt gilt für die Spielregeln als „im Bild“ (Sichtweite, Entkommen, Nachschub) – unabhängig davon, wie nah die
 * Kamera ist. Das ist das frühere Bild bei Zoom 0,72: Die nähere Kamera ändert nichts an Jagd und Flucht.
 */
export const PLAY_VIEW = { w: W / 0.72, h: H / 0.72 };
export const GRAVITY = 1400;

/** Fließtext */
export const FONT = '"Alegreya Sans", "Trebuchet MS", Verdana, sans-serif';
/** Überschriften – wie in Stein gemeißelt */
export const TITLE_FONT = 'Cinzel, Georgia, "Times New Roman", serif';

/** Mit ?debug in der URL: Entwickler-Hilfen (verborgene Werte anzeigen, alle Karten offen …). */
// (auf dem Server und in Tests gibt es keine Adresszeile)
const search = (globalThis as { location?: { search: string } }).location?.search ?? '';
export const DEBUG = new URLSearchParams(search).has('debug');

export const DEPTH = {
  bg: -100,
  decoBack: -10,
  plants: -5,
  terrain: 0,
  carcass: 4,
  pickups: 5,
  enemies: 10,
  player: 20,
  fx: 30,
  cover: 40,
  decoFront: 42,
  dark: 50,
  text: 60,
};

/** Farben der Benutzeroberfläche: Knochen, Ocker, Stein. */
export const UI = {
  bone: '#e6dcc4',
  boneDim: '#a89c84',
  ochre: '#c8913c',
  blood: '#a4322a',
  ink: '#0b0c0d',
  panel: 0x121110,
  panelEdge: 0x6a5638,
  stone: 0x2a2622,
  ochreN: 0x8a5a24,
  bloodN: 0x7a2420,
  moss: 0x3e4a2a,
};
