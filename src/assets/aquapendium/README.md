# Bilder fürs Aquapendium

Hier liegen die Bilder der Tierseiten. Der Dateiname ist die Kennung der Art, z. B. `pteraspis.png`, `dunkleosteus.png`,
`kieferlos.png` (alle Kennungen: `src/data/species.ts`, die Nummer steht in `src/data/aquapendium.ts`).

- Format: PNG, WebP oder JPG – am besten **PNG mit transparentem Hintergrund** (das Tier freigestellt). Nicht gesehene Tiere
  werden als schwarzer Umriss gezeigt; das funktioniert nur mit Transparenz sauber.
- Größe: etwa 900 × 700 Pixel oder größer; das Bild wird in den Rahmen eingepasst (Seitenverhältnis bleibt erhalten).
- Fehlt eine Datei, zeigt das Buch als Platzhalter das Tier aus dem Spiel.
- Neue Dateien werden beim nächsten Bauen (`npm run build`) automatisch eingebunden – keine Liste nötig.
