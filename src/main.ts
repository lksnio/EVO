import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import { W, H, DEBUG } from './config';
import { audio } from './audio/Audio';
import { game } from './state/GameState';
import { setMuteHandler, toggleMute } from './ui/ui';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { EraSelectScene } from './scenes/EraSelectScene';
import { MapScene } from './scenes/MapScene';
import { LevelScene } from './scenes/LevelScene';
import { HudScene } from './scenes/HudScene';
import { EvolutionScene } from './scenes/EvolutionScene';
import { EndingScene } from './scenes/EndingScene';
import { GalleryScene } from './scenes/GalleryScene';

async function start() {
  // Schrift laden, bevor Texte gezeichnet werden (max. 2 Sekunden warten)
  try {
    await Promise.race([
      Promise.all([document.fonts.load('500 20px Fredoka'), document.fonts.load('700 20px Fredoka')]),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {
    /* ohne Schrift geht es auch */
  }

  game.load();
  audio.setMuted(game.data.muted);
  setMuteHandler((m) => {
    game.data.muted = m;
    game.save();
  });

  // Ton darf erst nach einer Nutzeraktion starten
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !e.repeat) toggleMute();
  });

  const g = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#08203c',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, IntroScene, EraSelectScene, MapScene, LevelScene, HudScene, EvolutionScene, EndingScene, GalleryScene],
  });

  // Für Tests und Entwickler-Konsole
  (window as unknown as Record<string, unknown>).__evo = { game: g, state: game, audio, debug: DEBUG };
}

start();
