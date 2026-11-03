# Sieben Fossilien und sieben Muscheln

Die Sammlung liegt **im laufenden Spiel** groß auf der rechten Seite der C-Übersicht.
Sie zeigt nur den Stern selbst: ohne Überschrift, Sammelzähler oder zusätzlichen
Button. C, Esc oder ein Klick außerhalb des Rahmens schließen die Übersicht.
Die Sammlung wird nicht im Startmenü geöffnet.

## Darstellung

- Siebenzackiger dunkler Stein mit sieben größeren Platten an den Spitzen.
- Sieben kleine Fächermuscheln in den inneren Winkeln.
- Gefundene Platten tragen unterschiedliche Reliefsymbole: Dunkleosteus,
  Anthracosaurus, Inostrancevia, Postosuchus, Liopleurodon, Mosasaurus und Hyaenodon.
  Dies ist die vorläufig gewählte Besetzung der Sammlung.
- Unentdeckte Fossilien bleiben dunkle, namenlose Aussparungen.
- Die gefundenen Platten und Muscheln sind direkt am Stern erkennbar. Angaben zu
  Nachkommen stehen am Laich; die Übersicht braucht dafür keinen zweiten Bereich.
- Stern, Muscheln und Reliefs sind gezeichnete Canvas-Texturen, die je Variante
  einmal angelegt und wiederverwendet werden. Es gibt kein Bild je möglicher
  Gesamtkombination und keine Bildberechnung des Sterns im laufenden Frame.

[Leere Ansicht](captures/stern-leer.png) · [Vollständige Vorschau](captures/stern-voll.png) ·
[C-Übersicht](captures/uebersicht.png) · [Erster Fundort](captures/muschel-im-tiefental.png) ·
[Erste Weisheit](captures/weisheit.png)

Die volle Ansicht ist eine Vorschau aus einem isolierten Browser-Testprofil.
Im normalen Spiel sind derzeit eine Muschel und das Dunkleosteus-Fossil erreichbar.

## Sammeln und Speichern

- `src/data/collection.ts` definiert die sieben unterschiedlichen Muscheln, sieben
  Bossfossilien, sieben vorläufigen Weisheiten und die festen Fundortdefinitionen.
- Die erste Muschel liegt im Devon-Tiefental (`devon:wand`) am tiefsten freien
  Bodenpunkt, außerhalb der Fels-Kollisionen. Ihr Anker hängt an der Karte und
  verändert sich nicht abhängig vom Weg oder Verhalten des Spielers.
- Normale Tiere lassen keine Muscheln mehr fallen. Der erste eigene Sieg über
  Dunkleosteus erzeugt seine Fossilplatte. Weitere Siege erzeugen keine Duplikate.
- Die physische Platte wird durch Berührung gesammelt. Ihr noch nicht aufgehobener
  Fund bleibt gespeichert und erscheint nach dem Verlassen oder Tod am selben Ort
  wieder. Bei Gästen wird ein Bossfund erst nach bestätigtem Tod eines Tiers mit
  eigener Kampfbeteiligung registriert.
- Der Sammlungsteil des Spielerprofils ist unabhängig von der laufenden Linie.
  Neue Läufe, Tod und Epochenauswahl setzen ihn nicht zurück.
- Die große Muschel hat pro neuem unterschiedlichem Muschelfund einen weiteren
  vorläufigen Rätselvers. Mehrere ungelesene Verse können nacheinander angehört
  werden. Ohne neuen Fund wiederholt sie die letzte bekannte Weisheit.
- Abgabeorte, neue Wege und Belohnungsgelege sind noch nicht Teil dieser Umsetzung.

## Alte Spielstände

Beim Laden werden die alte numerische Muschelwährung, alte Muschellisten,
`seenShells`, `keptUps`, `ups`, `upLog`, `upHint`, `blessings`, `seenRows` und
goldene Ei-/Tierboni aus aktiven und geparkten Linien sowie gespeicherten Eiern
entfernt. Die Bereinigung wird unmittelbar gespeichert. Alte Währung wird nicht
in neue Funde umgerechnet. Vererbte Werte, Alter, reguläre Eier, Linien und
bekannte Tiere bleiben erhalten.

Die gekauften HP-, Größen-, Ausdauer-, Sicht- und Sauerstoffboni samt Kaufoberfläche,
Entwicklerreglern und goldenen Zufallssegen sind entfernt. Der Ausdauerkreis nutzt
weiterhin die vorhandene vererbte Ausdauer und den Körperbau. Die später geplante
vollständige Überarbeitung der Vererbungsregeln bleibt ein eigenes Paket.

## Prüfung

Build und Tests: `npm run build` und `npm test -- --maxWorkers=2`.
Der Browserlauf endet ohne Laufzeitfehler; zwölfmaliges erneutes Öffnen hält die
Texturanzahl konstant. Zusätzlich prüfen die Tests freie Fundplätze neben Felsen
und quer durch die Geometrie des tatsächlichen Tiefentals.

- `npm run build`
- `npm test -- --maxWorkers=2`
- Vite auf Port 8080 starten; `node tools/check_collection.cjs` mit verfügbarem
  `playwright-core` und Chromium. Der Test nutzt ein eigenes Browserprofil und den
  Spielstandplatz `collectcheck`.

Der Browserlauf prüft reale Maus-/Tastaturbedienung, alte Spielstände, 14 Plätze,
reduzierte Statistik ohne Zusatzbutton oder Sammelzähler, erreichbaren Tiefentalfund,
ersten garantierten Dunkleosteus-Drop, Duplikatvermeidung,
Wiederfinden einer nicht aufgehobenen Platte, Dialog, volle Vorschau, wiederholtes
Öffnen und Laden der gespeicherten Sammlung. Aufnahmen und Messwerte stehen in
`captures/` (historische Aufnahmen des damaligen Layouts). Mit `EVO_CAPTURE_DIR`
lassen sich neue Aufnahmen in ein separates Verzeichnis schreiben; der Test verändert
keine veröffentlichten Karten.
