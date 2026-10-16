// Zentrale Spielwerte – hier lässt sich das Spielgefühl tunen.
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const TILE = 32;

export const PLAYER = {
  speed: 220,
  jumpVelocity: 480,
  gravity: 1200,
  coyoteTimeMs: 100, // Springen kurz nach Verlassen der Kante noch erlaubt
  jumpBufferMs: 120, // Sprungtaste kurz vor der Landung wird gemerkt
};
