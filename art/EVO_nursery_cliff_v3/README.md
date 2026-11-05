# Der Laichfluss am Fuß einer Klippe

Die dritte Fassung baut die Kulisse räumlich neu auf. Links am Weltrand steht eine einzelne zusammenhängende Klippe. Dieselbe Zeichnung setzt sich über und unter der Wasserlinie fort und läuft unter den Boden der Laichhöhle. Der Fels ist an der Welt verankert: Wer wegschwimmt, lässt ihn zurück. In der Wasserferne gibt es keine weiteren gespiegelten Klippen.

## Bildebenen

- `cliff.png`: eine durchgehende Felszeichnung. Wasserlinie in Quellzeile 360, Spielmaßstab 1,1, Weltposition x = −40. Zwei deckungsgleiche Bildinstanzen teilen die Textur: Der obere Ausschnitt liegt vor dem Himmel, der untere Teil hinter Tieren und Gelände. Unter Wasser wird der Fels kühler getönt. Die vorhandenen Wellen verdecken den Übergang.
- `water.png`: ruhiges fernes Wasser ohne eingemalte Felswand oder nahe Gegenstände.
- `coast.png`: eine einzige entfernte Küste ohne Bäume. Sie umfasst den gesamten Kamerabereich und wird weder gekachelt noch gespiegelt. Ein kurzer Streifen fernes Oberflächenwasser verbindet ihre Küstenlinie mit den nahen Wellen.
- `trees.png`: vier unterschiedliche einzelne Bäume. Im Spiel verwendet der Renderer registrierte Ausschnitte dieser Zeichnung. Ihre Größe ist unabhängig von der Breite des Landbilds; sie bleiben etwa 20–50 Weltpixel groß. Abstände, Umrisse und Größen sind unregelmäßig. Die Bäume teilen die langsame Parallaxe der Küste.

`src/objects/NurseryBackdrop.ts` setzt diese Ebenen zusammen. Die vorherige reduzierte Dekoration und das gedämpfte Wasserlicht bleiben im Laichfluss aktiv. Gelände, Kollisionen, Höhle, Laich und Nahrung werden durch die neue Kulisse nicht verändert. Die Originale liegen in `source/`, die WebP-Spielbilder in `src/assets/lagoon/`. Die Baumtextur wird für das Spiel mit halber Auflösung geladen; alle vier Ausschnitte teilen dieselbe Textur.

## Spielaufnahmen

- [Nahansicht an der Wasserlinie](captures/lagoon-overview.png)
- [Unter Wasser am Klippenfuß](captures/lagoon-underwater.png)
- [Weiter draußen im Wasser](captures/lagoon-away.png)
- [Übersicht über Ufer und Klippe](captures/lagoon-context.png)
- [Browser-Prüfbericht](captures/browser-check.json)

Die Aufnahmen stammen aus Chromium mit Software-WebGL. Die Browserprüfung kontrolliert die genaue Ausrichtung beider Felsansichten, die feste Weltposition beim Verschieben der Kamera, die Einzelbäume mit begrenzter Größe, die Wasserlinie, unveränderte Spielgeometrie, stabile Textur- und Objektzahlen sowie Szenenwechsel und Aufräumen. Die Nahansichten verwenden Zoom 1,22, die Übersicht Zoom 0,85; für die Aufnahmen sind Tierphysik und automatische Kameraführung angehalten. Die Wasseranimation läuft weiter.

Mit laufendem Vite und optional installiertem `playwright-core`:

```sh
NODE_PATH=/tmp/evo-browser/node_modules EVO_BASE_URL=http://127.0.0.1:8080 node tools/check_lagoon.cjs
```
