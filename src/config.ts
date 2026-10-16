// Zentrale Spielwerte.
export const W = 1280;
export const H = 720;
export const TILE = 40;
export const GRAVITY = 1400;

/** Fließtext */
export const FONT = '"Alegreya Sans", "Trebuchet MS", Verdana, sans-serif';
/** Überschriften – wie in Stein gemeißelt */
export const TITLE_FONT = 'Cinzel, Georgia, "Times New Roman", serif';

/** Mit ?debug in der URL: Entwickler-Hilfen (verborgene Werte anzeigen, alle Karten offen …). */
export const DEBUG = new URLSearchParams(location.search).has('debug');

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
  moss: 0x3e4a2a,
};
