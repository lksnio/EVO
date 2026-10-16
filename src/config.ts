// Zentrale Spielwerte.
export const W = 1280;
export const H = 720;
export const TILE = 40;
export const GRAVITY = 1400;

export const FONT = 'Fredoka, "Trebuchet MS", Verdana, sans-serif';

/** Mit ?debug in der URL: Entwickler-Hilfen (EVO-Punkte, alle Karten offen …). */
export const DEBUG = new URLSearchParams(location.search).has('debug');

export const DEPTH = {
  bg: -100,
  decoBack: -10,
  terrain: 0,
  pickups: 5,
  enemies: 10,
  player: 20,
  fx: 30,
  decoFront: 40,
  dark: 50,
  text: 60,
};
