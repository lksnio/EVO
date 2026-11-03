# Persönlicher Stammbaum mit Weltzeit

Der Stammbaum öffnet sich außerhalb des Spiels über **Stammbaum** im Titelbild,
auch vor dem ersten Lauf. Er verwendet den bisherigen dunklen Stein-, Knochen-
und Ockerstil. Die Sammlung bleibt im Spiel unter C.

## Ansicht

- Die senkrechte Achse misst echte gespeicherte Weltjahre, von früher oben nach
  später unten. Die Generationenzahl bestimmt keine Astlänge.
- Alle sieben Epochen stehen links als Übersicht. Anklicken zeigt einen Zeitraum;
  **Alle Epochen**, **Dein Verlauf**, +/− und Mausrad steuern den Zeitzoom.
  Ziehen verschiebt den Ausschnitt. ↑/↓ wählt Knoten, ←/→ blättert durch Läufe.
- Drei persönliche Läufe passen nebeneinander. Weitere sind seitenweise erreichbar.
  Ausgestorbene Linien bleiben mit ihrem Endpunkt erhalten.
- Neue Knoten entstehen beim gewählten Nachkommen an einem anderen Laichplatz.
  Ein Gebiet entspricht anfangs einer Fortpflanzungsstation; kleine unterschiedliche
  Positionen desselben Geleges erzeugen keine weiteren Knoten. Eine Rückkehr an
  einen früheren Laichort beginnt einen neuen, datierten Abschnitt.
- Weitere gewählte Nachkommen am gleichen Ort erhalten kleine Striche. Die Karte
  zeigt die erste Form am Knoten beziehungsweise die letzte Form am Linienende,
  dazu Generationen, Weltzeit, gewählte Tiere und aktive Minuten des Abschnitts.
- **Laichplatz merken** speichert eine persönliche Markierung und stellt die
  Auswahl beim nächsten Besuch wieder her. Das Betrachten einer alten Linie
  ersetzt kein laufendes Tier.

[Leere Ansicht](captures/leer.png) · [Persönlicher Verlauf](captures/persoenlicher-verlauf.png) ·
[Markierter Laichplatz](captures/laichplatz-markiert.png) ·
[Vorschau über sieben Epochen](captures/sieben-epochen-vorschau.png) ·
[Mehrere Läufe](captures/mehrere-laeufe.png).

Die Sieben-Epochen-Aufnahme ist ein kontrollierter Beispieldatensatz im isolierten
Testprofil. Sie schaltet keine zukünftigen Gebiete oder Körperformen im Spiel frei.

## Speichern und bestehende Systeme

`SaveData.lineage` enthält die persönliche Aufzeichnung: Läufe, datierte
Laichplatzabschnitte, gewählte Generationen, aktive Zeit und kompakte erste/letzte
Merkmalsstände samt Farbe, Saat und Geschlecht. Die Daten werden nicht mit dem
Koop-Laich übertragen. Erst die eigene tatsächliche Auswahl schreibt die eigene
Linie weiter. Die normalen Spielstandplätze bleiben voneinander getrennt.

Alte Merkmalsknoten werden für Namensbildung und Spielstandkompatibilität behalten.
Alte datierte Todespunkte werden übernommen; nicht aufgezeichnete Geburten werden
nicht aus Generationenzahlen geschätzt. Bei laufenden alten Spielständen beginnt
die verlässliche Zeitaufzeichnung mit der Übernahme, als solche gekennzeichnet.
Ein defekter Archiveintrag darf den gültigen übrigen Spielstand nicht löschen.

Die bisherige Weltuhr liefert die Zeitpunkte. Feste Dauer eines gesamten Laufs,
die automatische Abfolge aller sieben Epochen, neue Übergangsregeln und historische
Wiedereinstiege bleiben eigene Arbeitspakete. Die Figurensysteme und die
Koop-Todregeln werden von der Ansicht nicht verändert.

Die Grafik wird beim Zoomen, Verschieben oder Auswählen aktualisiert. Kurven
werden vor ihrer Unterteilung auf den Ausschnitt begrenzt. Nur ein ausgewähltes
Tier wird animiert; das Archiv erzeugt keine ständig laufenden Tier-Rigs.

## Prüfung

- `npm run build`: TypeScript sowie Client- und Server-Build.
- `npm test -- --maxWorkers=2`: **342 Tests in 36 Dateien**.
- Vite auf Port 8080 starten, danach `node tools/check_lineage.cjs` mit Chromium
  und `playwright-core`. Eigene Testspielstände: `treecheck` und `treepeer`.

Die Logiktests prüfen reale Spielstand-Hooks, exakte Zeitpunkte, Kartenbesuche,
Geschwister, Laichplatzwechsel und Rückkehr, den Karbon-Brutzyklus, Koop-Auswahl,
Speichern/Laden, getrennte Spielerplätze, alte und beschädigte Spielstände,
Epochengrenzen, Uhrkorrekturen und den Zeitzoom.

Die Browserprüfung bedient Knoten, Markierung, Zeitzoom, Verschieben, Seiten und
Titelmenü und prüft die Trennung zweier Spielerprofile. Aufnahmen und das
[Prüfprotokoll](captures/browser-check.json) liegen unter `captures/`.

Der abgeschlossene Browserlauf meldet keine Laufzeitfehler. Nach dem Aufwärmen
bleibt die Texturanzahl auch nach 28 weiteren Wechseln der ausgewählten Ansicht
bei **245**. Tastatur und Seitenwechsel werden erst nach ihrer tatsächlichen
Verarbeitung geprüft; Aufnahmen entstehen nach abgeschlossener Überblendung.
