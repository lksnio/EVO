# Der Laichfluss: eine lebendige Lagune

Frühere Designfassung. Im Spiel durch die ruhigere, an den vorhandenen Spielgrafiken orientierte [Version 2](../EVO_nursery_lagoon_v2/README.md) ersetzt. Die folgenden Angaben und Aufnahmen dokumentieren die erste Fassung.

Drei neue, separat gemalte Bildebenen für das Devon: eine lichtdurchflutete Unterwasserlandschaft, eine ferne Küste mit frühen Bäumen und eine freigestellte Seeliliengruppe. Die Originale liegen in `source/`, die komprimierten Spielbilder in `src/assets/lagoon/`.

Die Gestaltung orientiert sich am späten Devon: frühe, fein gefiederte Bäume nach Archaeopteris und Cladoxylopsiden an Land; unter Wasser geschichteter Sandstein, Stromatoporen, kleine Korallen, Brachiopoden und Seelilien. Die beinahe magische Stimmung entsteht durch goldgrünes Streiflicht, Wassertrübung und räumliche Staffelung. Es handelt sich um stilisierte Paleoillustrationen, keine Rekonstruktion eines bestimmten Fossilfundorts.

`NurseryBackdrop` verwendet die Malereien als unabhängige Ebenen:

- Die Unterwasserlandschaft und die ferne Küste haben unterschiedliche Parallaxe. Benachbarte Bildinstanzen werden gespiegelt; sie teilen dieselbe GPU-Textur.
- Seelilien sind am Boden verwurzelt. Ihre oberen Arme und Stiele wiegen sich auf kleinen verformbaren Netzen mit der gemeinsamen Wasserströmung. Außerhalb des Bilds ruhen diese Aktualisierungen. Ohne WebGL wird das gemalte Bild leicht geneigt.
- Sechs weiche Lichtbahnen wandern und ändern langsam ihre Helligkeit; Wolken und Wetter dämpfen das Licht.
- Die vorhandenen Wellen, Lichtbrechungen, Schwebeteilchen und Hintergrundfische laufen weiter. Eine zusätzliche, genau registrierte transparente Wellenkante verdeckt den unteren Küstenrand; die Himmelsfüllung schneidet dadurch keinen Streifen durch die Bäume.

Die Illustration wird im Laichfluss eingesetzt. Höhle, Laich, Gelände und Trefferflächen bleiben eigenständige Spielobjekte. `?oldlagoon` zeigt den bisherigen Hintergrund zum Vergleich. Im Korallengarten und Tiefental bleibt deren jeweilige Gestaltung aktiv.

## Aufnahmen und Prüfung

- [Küste und Lagune](captures/lagoon-overview.png)
- [Unter Wasser bei Spielzoom](captures/lagoon-underwater.png)
- [Browser-Prüfbericht](captures/browser-check.json)

Die Aufnahmen stammen aus dem Spiel mit Chromium und Software-WebGL. Die Browserprüfung kontrolliert sichtbare Netzbewegung bei festem Wurzelpunkt, konstante Textur- und Objektzahlen nach dem Aufbau sowie das Aufräumen beim Szenenwechsel. Sie ist keine Bildratenmessung auf einer realen Grafikkarte.

Vite starten, dann mit optional installiertem `playwright-core` ausführen:

```sh
NODE_PATH=/tmp/evo-browser/node_modules EVO_BASE_URL=http://127.0.0.1:8080 node tools/check_lagoon.cjs
```

Die drei WebP-Bilder benötigen zusammen etwa 1,3 MB Download und 13 MB unkomprimierten Texturspeicher. Es entstehen keine neuen Malerei-Texturen pro Bild; alle Landschafts- und Seelilieninstanzen verwenden diese drei Bilder gemeinsam.
