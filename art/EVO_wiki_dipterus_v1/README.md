# Erste Wiki-Illustration: Dipterus valenciennesi

Die erste Tierseite der Devon-Chronik ist Dipterus (die Seiten sind nach Rolle und biologischer Referenzgröße sortiert). Eine neue, deckende Lebensraumszene ersetzt sein Spielporträt, sobald er entdeckt wurde. Weitere Tierseiten verwenden weiter ihre bisherigen Bilder.

## Bild und Einbindung

- Original der Bildgenerierung: `source/dipterus.png`; genauer Auftrag: `prompt.txt`.
- Spielasset: `src/assets/aquapendium/dipterus.webp`, mit maximal 1024 Pixeln Kantenlänge, vollständigem Motiv und beibehaltenem Seitenverhältnis.
- Aufbereitung: `python tools/prepare_wiki_dipterus.py` (Pillow, nur Verkleinerung und WebP-Kodierung).
- Der vorhandene automatische Dateifund lädt das Asset erst beim Öffnen der entdeckten Tierseite. Es gibt keine Texturarbeit während des Spiels und keine zusätzliche Vorladung aller Wiki-Bilder.
- Vor der Entdeckung zeigt die Seite weiterhin den freigestellten Fischumriss. Eine schwarz eingefärbte deckende Landschaft würde nur ein Rechteck ergeben.
- Ladeereignisse gehören zur jeweiligen Buchseite. Auch bei Blättern während einer laufenden Bildanforderung ersetzt die aktive Seite ihren eigenen Platzhalter; zerstörte Seiten erhalten keine neuen Bildobjekte.

## Rekonstruktionsgrundlage

Dargestellt ist ein früher Lungenfisch des Mitteldevons, ungefähr zur in der Chronik angegebenen Zeit von 385 Millionen Jahren und Körperlänge von 35 cm. Das Motiv orientiert sich an den beschriebenen Merkmalen von Dipterus: kräftiger beschuppter Körper, knöcherner Kopf, paarige fleischige Flossen, zwei getrennte Rückenflossen und eine primitive asymmetrische Schwanzflosse. Das Tier schwimmt bodennah; Beine und Finger werden nicht dargestellt. Die im Spiel hinterlegte Erklärung zu Zahnplatten bleibt erhalten.

Als Lebensraum dient eine plausible devonische Süßwasser-Landschaft mit Schlamm, geschichtetem rötlichem Sandstein und sparsamer algenartiger Vegetation. Das Bild vermeidet Korallenriff-Bewohner und moderne Blütenpflanzen. Die Szene ist eine Interpretation und bildet keine nachgewiesene konkrete Fossilfundstelle ab.

Färbung, Weichgewebedetails, einzelne Flossenproportionen, Pflanzenanordnung und Beleuchtung sind künstlerisch rekonstruiert. Das generierte Bild ersetzt keine wissenschaftlich überprüfte anatomische Tafel. Grundlage sind die bestehenden Projektangaben und bekannte allgemeine Gattungsmerkmale; für diese Illustration wurde keine neue paläontologische Literaturauswertung durchgeführt.

Die Stilrichtung greift die gemalte EVO-Welt auf: petrolfarbenes Wasser, warme Steinlichter, ruhige räumliche Staffelung und malerische Oberflächen. Die Wiki-Illustration darf mehr anatomische Einzelheiten zeigen als ein kleines animiertes Spieltier.

## Prüfung

`npm run build` und `npm test -- --maxWorkers=2`. Mit laufendem Vite und externem `playwright-core`: `NODE_PATH=/tmp/evo-browser/node_modules node tools/check_wiki_dipterus.cjs`. Die Browserprüfung bestätigt die erste Tierseite, den unentdeckten Umriss, das verzögerte Laden, die Bildpassung, Blättern während des Ladens und die unveränderten Folgeeinträge. Aufnahmen liegen in `captures/`.
