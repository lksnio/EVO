import type Phaser from 'phaser';
import { game } from '../state/GameState';
import { fadeTo } from '../ui/ui';

/** Ein neues Leben beginnt – im gewählten Zeitalter, als frisch geschlüpftes Tier an dessen Urahn. */
export function startNewLife(scene: Phaser.Scene, epoch = game.chosenEpoch) {
  game.enterEpoch(epoch);
  // Ein noch laufendes Leben dieses Zeitalters endet dabei – die Linie gilt als verschollen.
  if (game.hasRun()) game.extinct(0, 'Verschollen');
  const run = game.newRun(epoch);
  if (!game.data.seenIntro) fadeTo(scene, 'Intro', {}, 800);
  else fadeTo(scene, 'Level', { epoch: run.epoch }, 900);
}

/** Das laufende Leben eines Zeitalters fortsetzen (ohne Angabe: das gewählte). */
export function continueLife(scene: Phaser.Scene, epoch = game.chosenEpoch) {
  game.enterEpoch(epoch);
  if (!game.run) return startNewLife(scene, epoch);
  fadeTo(scene, 'Level', { epoch: game.run.epoch }, 900);
}
