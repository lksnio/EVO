# Auftrag: die gemalten Requisiten einbauen

Baue die Zeichnungen aus diesem Ordner für den bestehenden Laichplatz und die bestehende Höhle ein. Behandle die Höhle als normale Höhle. Arbeite auf dem vorhandenen Feature-Branch; `main` bleibt unverändert.

## 1. Bestehende Darstellung finden

Lies zuerst `START_HERE.md` und `import/assets.json`, dann den aktuellen Code für Laichplatz, Höhle, Terrain, Licht/Sicht und Interaktionen. Ermittle die vorhandenen Weltpositionen, Größen, Bodenpunkte, Trigger, Kollisionen und Zeichnungstiefen. Ersetze die jeweiligen bisherigen Zeichnungen vollständig, damit alte und neue Konturen nicht übereinander stehen.

## 2. Laichplatz

Der einfache Bildaustausch nutzt `assets/laichplatz_komplett.png`. Erhalte den bisherigen Fußpunkt und die Funktion. Die gemalte Fläche soll zunächst ungefähr die bisherige Breite behalten. Prüfe zusätzlich 80/110/140 px als visuelle Größenreferenzen, ohne die ganze Szene allein nach dieser Werkstattgröße umzubauen.

Falls die Zahl der Eier im bisherigen Spiel sichtbar mit Verlust, Schlüpfen oder Fortschritt verknüpft ist, verwende `laich_nest_leer.png` plus wiederholte Instanzen von `laich_ei_einzeln.png`. Die feste gemalte Zahl des Komplettbildes ist dann keine passende Zustandsanzeige. Bewahre den logischen Eierstand und die bestehenden Interaktionen. Verwende eine stabile, organisch verteilte Anordnung: kleinere Eier vorne/seitlich, etwas größere hinten, leichte statische Größen- und Winkelvariation. Kein zufälliges Springen beim Neuzeichnen. Eier hinter dem niedrigen Steinrand platzieren und Überlappung prüfen.

Das Nest bleibt am Boden verankert. Ruhe durch statische Zeichnung ist gewünscht. Eine sehr schwache Änderung der Lichtreflexe reicht, falls etwas Bewegung nötig ist. Keine periodische Skalierung des gesamten Haufens und keine dauernden Partikel-Fontänen. Schlüpfen oder Ei-Verlust können eigene kurze Ereignisse bleiben.

## 3. Höhle

Für eine einfache erste Fassung nutze `assets/hoehle_komplett.png` als vorhandenes dekoratives Höhlenbild. Falls Tiere die Höhle sichtbar betreten oder vom Dach verdeckt werden, nutze stattdessen die Ebenen:

1. Höhlenrückwand: `hoehle_hintergrund.png`.
2. Fisch bzw. Höhleninhalt.
3. Vorderer Felsrahmen: `hoehle_vordergrund.png`.

Die Komplettfassung wird in diesem Ebenenaufbau nicht zusätzlich gezeichnet. Richte **beide gesamten Ebenen-Leinwände** an demselben Referenzrahmen aus. Ihre Originalgrößen unterscheiden sich um 1–2 Pixel in der Breite. Beim gemeinsamen Rahmen normalisieren und einen einzigen Weltmaßstab, Ursprung und Bodenpunkt verwenden. Schneide Ebenen nicht unabhängig auf ihre Alpha-Grenzen zu und zentriere sie dann einzeln; sonst verrutscht die Rückwand. Die transparente Öffnung ist geprüft, das optische Zusammenpassen muss im Spiel überprüft werden.

Die Höhle bleibt ein breiter natürlicher Unterstand. Erhalte die bestehende begeh-/beschwimmbare Öffnung sowie die vorhandenen Trigger und Kollisionen. Leite keine neue massive rechteckige Kollision aus der PNG-Größe ab. Vermeide eine zweite starke Abdunklung über der bereits dunkel gemalten Rückwand. Ein Fisch im Eingang soll noch lesbar sein. Vorhandene Terrainzeichnung kann die untersten 1–3 Bildschirm-Pixel der Steinfüße überdecken, damit der Fels im Boden sitzt.

## 4. Import und Licht

Gemessene Alpha-Grenzen und echte Dateimaße stehen im Manifest. Bei gewünschter gemalter Breite W gilt zuerst `scale = W / (x1 - x0)`. Den tatsächlichen Bodenanker einschließlich transparenter Ränder berücksichtigen. Bei der Höhle den gemeinsamen Ebenenrahmen verwenden.

Erzeuge nur beim Laden/Build optimierte Laufzeitdateien. Originale unverändert unter `art/` aufbewahren. Alpha korrekt erhalten. Einzelne vollständig transparente Pixel können farbige RGB-Werte enthalten; daraus entsteht bei richtiger Alpha-Darstellung kein sichtbarer Hintergrund.

Vergleiche beide Requisiten neben der gemalten Muschel bei normalem Spielzoom. Gleiche breite Licht-/Schattenflächen und Farbtemperatur an. Der Laich soll weich und lebendig lesbar bleiben; die Höhle darf dunkler und schwerer sein. Zusätzliche starke Konturlinien oder eine pauschale dunkle Volltönung würden die gemalte Modellierung schwächen.

## 5. Prüfen

- Bodenanschluss und Maßstab auf waagerechtem und leicht ansteigendem Terrain.
- Vorhandene Laich- und Höhleninteraktionen sowie ggf. Eiverlust/Schlüpfen.
- Fisch vor, innerhalb und hinter dem Höhlenrahmen; keine alte Zeichnung darunter sichtbar.
- Sicht-/Tiefenlicht, Pflanzenverdeckung, Szenenwechsel, Zoom und Mehrfachinstanzen.
- Texturen einmal cachen, keine neue große Textur pro Frame erzeugen.
- Bestehende Typprüfung und passende vorhandene Tests; dazu Vergleichsaufnahmen bei echtem Spielzoom.

`WASSER_ARTDIRECTION.md` ist ein separater Gestaltungsvorschlag. Die Wasser-Stilreferenz wird nicht als starres Vollbild über das laufende Spiel gelegt.
