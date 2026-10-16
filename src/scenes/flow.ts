import type Phaser from 'phaser';
import { game } from '../state/GameState';
import { fadeTo } from '../ui/ui';

/** Ein neues Leben beginnt: Urfisch an der Wurzel des Stammbaums. */
export function startNewLife(scene: Phaser.Scene) {
  // Ein noch laufendes Leben endet dabei – die Linie gilt als verschollen.
  if (game.hasRun()) game.extinct(0, 'Verschollen');
  game.newRun();
  if (!game.data.seenIntro) fadeTo(scene, 'Intro', {}, 800);
  else fadeTo(scene, 'Level', { epoch: 0 }, 900);
}

/** Das laufende Leben fortsetzen – zu Beginn des aktuellen Zeitalters. */
export function continueLife(scene: Phaser.Scene) {
  if (!game.run) return startNewLife(scene);
  fadeTo(scene, 'Level', { epoch: game.run.epoch }, 900);
}
