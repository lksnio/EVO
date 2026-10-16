import Phaser from 'phaser';

const reported = new Set<string>();

/** Einen Fehler melden (jede Meldung nur einmal), ohne das Spiel anzuhalten. */
export function reportError(where: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const key = where + ': ' + msg;
  if (reported.has(key)) return;
  reported.add(key);
  console.error(`[EVO] Fehler (${where}) – das Spiel läuft weiter.`, e);
}

/**
 * Phaser fordert das nächste Bild erst an, nachdem das aktuelle fertig ist. Bricht ein Bild mit
 * einem Fehler ab, kommt nie wieder eins – das Spiel friert ein. Deshalb wird jedes Bild abgesichert:
 * Ein Fehler wird gemeldet, und das nächste Bild läuft ganz normal.
 */
export function keepAlive(g: Phaser.Game) {
  g.events.once(Phaser.Core.Events.POST_STEP, () => {
    const loop = g.loop;
    const step = loop.callback;
    loop.callback = (time: number, delta: number) => {
      try {
        step(time, delta);
      } catch (e) {
        reportError('Bild', e);
      }
    };
  });
}
