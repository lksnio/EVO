import Phaser from 'phaser';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/alegreya-sans/latin-400-italic.css';
import { W, H, DEBUG } from './config';
import { audio } from './audio/Audio';
import { game } from './state/GameState';
import { setMuteHandler, toggleMute } from './ui/ui';
import { keepAlive } from './util/guard';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { LevelScene } from './scenes/LevelScene';
import { MapScene } from './scenes/MapScene';
import { HudScene } from './scenes/HudScene';
import { GenerationScene } from './scenes/GenerationScene';
import { TreeScene } from './scenes/TreeScene';
import { EndingScene } from './scenes/EndingScene';
import { GalleryScene } from './scenes/GalleryScene';
import { AquapendiumScene } from './scenes/AquapendiumScene';

async function start() {
  // Schriften laden, bevor Texte gezeichnet werden (max. 2 Sekunden warten)
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 20px Cinzel'),
        document.fonts.load('500 20px "Alegreya Sans"'),
        document.fonts.load('700 20px "Alegreya Sans"'),
        document.fonts.load('italic 400 20px "Alegreya Sans"'),
      ]),
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
    backgroundColor: '#030405',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    // Nur eine Textur pro Zeichenaufruf: Phaser 4 wählt bei mehreren Texturen im Shader per exaktem
    // Float-Vergleich aus – auf manchen Grafiktreibern verschwinden dadurch zufällig Körperteile.
    render: { maxTextures: 1 },
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, IntroScene, LevelScene, MapScene, HudScene, GenerationScene, TreeScene, AquapendiumScene, EndingScene, GalleryScene],
  });

  // Ein Fehler in einem einzelnen Bild darf nie das ganze Spiel einfrieren
  keepAlive(g);

  // Für Tests und Entwickler-Konsole
  (window as unknown as Record<string, unknown>).__evo = { game: g, state: game, audio, debug: DEBUG };
}

start();
