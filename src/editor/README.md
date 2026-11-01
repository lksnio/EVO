# EVO-Weltbaukasten

Den Baukasten im Hauptmenü öffnen oder direkt `?editor=devon:garten` aufrufen. Er verändert beim Bauen und bei der Begehung keinen Spielstand. Die gemeinsame Grundlage gilt für alle vorhandenen Epochen; die Palette folgt dem jeweiligen Lebensraum. Auch noch nicht spielbare Epochen lassen sich vorbereiten.

## Gestalten

- Zeitalter und Ort oben wählen. Zunächst wird die Projektkarte, andernfalls eine einmalig erzeugte Vorlage geladen. Bestehende Browserentwürfe haben im Editor Vorrang.
- Bauteile aus der Palette ins Bild ziehen. Ein Klick auf ein Bauteil setzt es in die Bildmitte. Pflanzen, Schwämme, kleine Steine und Platten liegen einzeln vor; größere Gruppen sind zusätzliche Bauteile.
- Zum Verschieben am Bauteil ziehen. Der eckige Griff skaliert gleichmäßig um den Fußpunkt; der runde Griff dreht. Im rechten Feld lassen sich Breite, Höhe, Winkel, Spiegelung, Deckkraft und Ebene präzise einstellen.
- Umschalt erweitert die Auswahl. Gruppierte Bildbauteile werden gemeinsam ausgewählt und verschoben. Duplizieren, Löschen, Gruppieren und Auflösen stehen rechts. Strg+D dupliziert, Strg+Z macht einen Arbeitsschritt rückgängig, Strg+Umschalt+Z wiederholt ihn. Auch Boden- und Kollisionsänderungen gehören zum Verlauf.
- Der Bodenpinsel formt die reale Höhenlinie. Felsen aus der Vorlage sind auswählbar; ihre vorhandenen Kollisionsscheiben bewegen und skalieren sich mit. Höhlen nehmen dabei ihren Spielbereich und Hohlraum mit.
- „Kollision“, „Versteck“, „Felsspalte“, „Futterpflanze“, „Tier“, „Laich“ und „Startpunkt“ platzieren Spielobjekte oder Bereiche. Im Korallengarten lässt sich auch der offene Tiefenzugang auswählen oder mit „Tiefenzugang“ neu setzen; seine Austrittshöhe bleibt Teil der gespeicherten Karte. Die Bereiche werden bei aktivierter Hilfsansicht umrandet. Größe und Position stehen rechts. Für Tiere und Laich lässt sich dort die Art wählen.
- Bei einzelnen Steinbauteilen erzeugt „Fester Körper · Kollision“ passende schmale Scheiben, die Größe, Position und Drehung mitmachen. Separat gesetzte Kollisionsrechtecke bleiben ebenfalls direkt bearbeitbar.
- Mausrad zoomt um den Mauszeiger. Leertaste und Ziehen, mittlere oder rechte Maustaste verschieben die Kamera. „Ganze Karte“ gibt einen Überblick. Ebenen lassen sich einzeln ausblenden.

## Fußpunkte und Tiefe

„Am Boden verankern“ hält den Fußpunkt relativ zur bearbeiteten Bodenlinie fest. Der vertikale Versatz steht als „Bodenabstand“ im Inspector und bleibt auch bei numerischen X-Änderungen erhalten. „Auf Boden setzen“ setzt den Fußpunkt mit einem kleinen natürlichen Einsinkversatz direkt an die Bodenlinie. Vordergrund am Boden hat dieselbe Kamerabewegung wie der Spielboden: Pflanzen schweben beim Kameraschwenk nicht ab. Die „Nahe Kulisse“ ist eine eigene Rahmenebene mit Parallaxe und einem Fuß unter dem Bildrand. Sie ist für eigene vorgelagerte Fels-/Pflanzengruppen gedacht. Ferne und nahe Kulisse blockieren die Bewegung nicht. Die Begehung zeigt diese Tiefenwirkung; die Bauansicht zeigt die unverzerrten Platzierungskoordinaten.

## Speichern und Hauptspiel

1. **Browserentwurf:** abgeschlossene Arbeitsschritte werden automatisch je Epoche und Ort in `localStorage` gesichert. Browserdaten sind keine Projektdateien. Browserentwürfe ersetzen keine Mehrspielerkarten.
2. **Datei exportieren / öffnen:** vollständige, versionierte `.evo-map.json`-Dateien. Import wird geprüft, bevor die aktuelle Karte ersetzt wird. Fehlgeschlagener Import lässt den bisherigen Entwurf bestehen. Strg+S exportiert ebenfalls eine Datei.
3. **Im Projekt speichern:** bei `npm run dev` schreibt der Editor über eine Entwicklungsroute in `src/data/maps/worlds.json`. Nach dem Neuladen verwendet das Hauptspiel diese Projektkarte. Die Änderung anschließend wie Quellcode committen und ausliefern. Client und Server laden die Karte über dieselbe Funktion `loadLevel`; dadurch teilen alle Spieler die veröffentlichte Geometrie.

Auf einer statischen Veröffentlichung gibt es keinen schreibbaren Projektserver. Dort als Datei exportieren; zum Übernehmen den lokalen Entwicklungsserver starten und die Datei im Editor öffnen und im Projekt speichern. Es gibt keine Schreibroute im Produktionsserver. Gespeicherte Projektkarten werden mit `npm run build` in Client und Server übernommen. Ein Browserentwurf wird ausdrücklich nicht automatisch ins Hauptspiel eingeschleust.

Die Karte enthält die konkrete Bodenlinie, feste Felsen, deren zugeordnete Kollisionen, Spielbereiche, Startpunkte, Population und alle Bildbauteile. Beim Laden wird diese Momentaufnahme verwendet; die Dekoration wird nicht erneut zufällig zusammengesetzt. Orte ohne Projektkarte verwenden weiterhin den bisherigen Weltgenerator. Die Lebenssimulation im Hauptspiel läuft weiter.

## Begehung und Prüfung

„Begehung“ nutzt den gemeinsamen Gelände-/Bauteilrenderer und die realen Kollisionsdaten mit einer steuerbaren Testfigur: WASD/Pfeile, Leertaste beschleunigt, Esc zurück. Die Figur beeinflusst keine Leben, Tiere oder Spielstände. Im Hauptspiel kommen Tiere, Nahrungsaufnahme, Lebenszyklus und Netzwerk hinzu.

- `npm run build`
- `npm test -- --maxWorkers=2`
- Vite starten, dann `NODE_PATH=/tmp/evo-browser/node_modules node tools/check_editor.cjs` für echte UI-Gesten, Import/Export, Entwurfwiederherstellung, Begehung und Projektspeichern bis ins Hauptspiel. Der Prüflauf stellt die Projektdatei danach wieder her; währenddessen nur einen isolierten lokalen Testserver verwenden.

Die Baukasten-Bauteile in `src/assets/reef/units/` wurden mit Bildgenerierung als getrennte, transparente Pflanzen und Steine gezeichnet. Original: `art/EVO_editor_units_v1/source.png`. `tools/prepare_editor_units.py` schneidet und verkleinert sie reproduzierbar. Weitere Assetpakete können dieselben Platzierungs-, Ebenen- und Speicherfunktionen nutzen.
