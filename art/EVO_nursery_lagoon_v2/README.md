# Laichfluss: ruhige Kulisse im Spielstil

Frühere Designfassung. Die räumlich getrennte Unterwasserklippe und Baumküste sind inzwischen durch die zusammenhängende [Klippe mit fernem Land in Version 3](../EVO_nursery_cliff_v3/README.md) ersetzt. Die folgenden Angaben und Aufnahmen dokumentieren Version 2.

Die zweite Fassung ersetzt den detaillierten, goldgrünen Illustrationshintergrund durch eine schlichte blaugrüne Felskulisse. Die vorhandenen Stein- und Höhlenbilder dienten als Stilreferenzen: große Felsflächen, erkennbare Konturen und wenige Farbstufen. Der offene Schwimmraum bleibt ruhig; Fossilien, Korallenbeete und ausgearbeitete Lichtstrahlen sind aus der Hintergrundmalerei entfernt.

Die entfernte Küste besteht aus kleinen, locker verteilten Gruppen früher baumartiger Pflanzen, in derselben gedämpften Farbwelt. Die Bäume sind etwa 100 Weltpixel hoch. Ihre Küstenlinie wird anhand der gemalten Grundlinie registriert, unabhängig vom transparenten Rand der Leinwand. Die Wellen liegen davor.

`NurseryBackdrop` verwendet nur zwei Bildebenen mit unterschiedlicher Parallaxe. Wellen, Wasserlicht und Schwebeteilchen des Spiels bewegen sich weiter; die Lichtstreifen und Schlieren sind im Laichfluss auf 40 Prozent ihrer bisherigen Stärke gedämpft. Zusätzliche Seeliliennetze und Lichtbahnen der ersten Fassung entfallen. Im Laichfluss setzt `ReefScenery` nur noch wenige kleinere Pflanzen; die großen Korallenvignetten und Vordergrundbüschel bleiben dem Korallengarten vorbehalten. Nahrungspflanzen und Spielgeometrie werden davon nicht verändert.

Die Originale liegen in `source/`, die WebP-Bilder in `src/assets/lagoon/`. Beide Spielbilder zusammen benötigen etwa 150 KB Download und 12 MB unkomprimierten Texturspeicher. Gespiegelte Landschaftsinstanzen teilen diese Texturen. Die Master der ersten Fassung bleiben als Designhistorie erhalten und werden vom Spiel nicht geladen.

- [Küste, Fisch und Wasser](captures/lagoon-overview.png)
- [Fisch und Gelände unter Wasser](captures/lagoon-underwater.png)
- [Browser-Prüfbericht](captures/browser-check.json)

Die Aufnahmen stammen aus dem Spiel bei Zoom 1,22 mit Chromium/Software-WebGL. Die Browserprüfung kontrolliert die bewegte Wasserlinie, den reduzierten Bewuchs, konstante Textur- und Objektzahlen nach dem Aufbau, das Aufräumen der Landschaftsinstanzen und den Wechsel in den Korallengarten und zurück. Der Korallengarten behält seine reichere Gestaltung. Es handelt sich nicht um eine Bildratenmessung auf einer realen Grafikkarte.

Mit laufendem Vite und optional installiertem `playwright-core`:

```sh
NODE_PATH=/tmp/evo-browser/node_modules EVO_BASE_URL=http://127.0.0.1:8080 node tools/check_lagoon.cjs
```

`?oldlagoon` zeigt weiterhin den ursprünglichen, im Code gezeichneten Hintergrund zum Vergleich.
