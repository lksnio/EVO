# EVO – Entscheidungen und offene Arbeit nach dem Dipterus-Wikibild

Stand: 3. November 2026, einschließlich der jüngsten Änderungen an Sammlung,
Freischaltungen und Stammbaumdarstellung. Technische Ausgangsbasis ist `32a7679`,
inzwischen auch auf dem abgerufenen `origin/main`.

Dieses Dokument hält Entscheidungen fest. Es implementiert die beschriebenen
Spielsysteme noch nicht. Vorschläge des Assistenten sind ausdrücklich von
Festlegungen des Nutzers getrennt.

**Entwicklungsdokument mit Spoilern:** Die interne Zahl möglicher Grundformen,
Verzweigungen und Belohnungen ist kein Inhalt für Spielerhinweise oder die
Stammbaumoberfläche. Die README beschreibt das Zielbild ohne diese internen Details.

## 1. Bereits umgesetzt: der Ausgangspunkt

Die letzte tatsächliche Spieländerung im geprüften Checkout ist
`32a7679`: gemaltes Dipterus-Bild auf der ersten Wiki-Tierseite, mit passender
Ladelogik und Prüfung. Davor wurden umgesetzt:

- `1885c27` / `773c476`: gemeinsame biologische Größenbasis für Tiere; anschließend
  bessere Sichtbarkeit der kleinsten Tiere und eine leichte Stauchung der
  Größenunterschiede. Große Tiere verwenden eher niedrigere plausible Größen,
  kleine eher höhere. Die biologischen Wikiangaben bleiben davon getrennt.
- `fedb050`: PvP entfernt; Wasseroberfläche mit Himmel und günstiger Animation;
  offener Abstieg vom Korallengarten ins Tiefental; eigener Laich in der Höhle.
- Weltbaukasten mit Speichern, Import/Export und Übernahme der Kartendaten ins
  Hauptspiel; gemalte Weltbauteile, Konturen und Vordergrundebenen.

Die anschließend erzeugten Evolutionsbilder sind Konzeptstudien, keine bereits
eingebauten oder animierten Tiergrundformen. Die beiden Bilder wurden als zu
generisch und zu ähnlich beurteilt und sind keine freigegebenen Körpervorlagen.

## 2. Statusbegriffe

- **Festgelegt:** im Gespräch vom Nutzer ausdrücklich festgehalten oder bestätigt.
- **Zielbild:** gewünschte Richtung; Umfang oder Einzelregeln sind noch nicht final.
- **Vorschlag:** besprochen, aber vom Nutzer noch nicht bestätigt.
- **Offen:** vor der betreffenden Umsetzung zu entscheiden.

Die Aufwandsschätzungen in Abschnitt 13 gelten für die zugehörigen Arbeitspakete.
Designpunkte sind keine zusätzlichen, separat zu addierenden Aufgaben.

## 3. Kern des Spiels

**Festgelegt:**

- Evolution, Überleben, Verhalten, Fortpflanzung und Vererbung tragen das Spiel.
- Eigenschaften sollen aus der tatsächlich gespielten Lebensweise entstehen.
  Das soll gegenüber zufälligen Wertebelohnungen gestärkt werden.
- Die Vererbungsregeln werden dafür **insgesamt neu ausgearbeitet**. Bestehende
  Trainingsformeln, Gegenkosten und Muschel-Sonderfälle sind keine unverändert
  übernommenen Designvorgaben.
- Die Hauptlinie soll zusammenhängend durch Devon, Karbon, Perm, Trias, Jura,
  Kreide und Paläogen spielbar werden. Sieben voneinander getrennte Spiele sind
  nicht mehr das Ziel.
- Eine zusätzliche Fantasygeschichte oder Queststruktur ist dafür nicht vorgesehen.
  Wissenschaftliche Nähe, Grafik, Animation und Balancing stehen im Mittelpunkt.
- Die jetzt gewünschten kurzen Weisheiten und Sammlungsrätsel bilden einen
  begrenzten erzählerischen Rahmen um die besonderen Fundorte und Belohnungen.
- Reale Tiere und ihre Lebensweisen sollen verständlich werden. Die Spielerstammlinie
  ist eine bewusst fiktive, biologisch angeregte Entwicklung.

**Zielbild:** Drei Ernährungs-/Überlebensrichtungen sollen über längere Abschnitte
tragfähig sein. Welche das konkret in jeder Umgebung sind und welche Kompromisse
sie haben, ist noch auszuarbeiten. Sie sind keine bereits festgelegten starren Klassen.

**Neue vorläufige Spielzeit:** ungefähr **4–5 Stunden pro Lauf**. Die frühere Idee von
40–60 Stunden für einen Lauf ist überholt. Dauer, Zahl der Generationen und Tempo
bleiben Gegenstand des Balancings.

Aufwand / Übernahme: Pakete P1, P3 und P12. Ich kann die Regeln implementieren,
Messwerte erfassen und Varianten vorbereiten; Spielgefühl und gewünschte Schwierigkeit
prüfen wir gemeinsam.

## 4. Weltzeit und Spielerentwicklung

**Festgelegt:**

- Weltzeit und Spielerfortschritt sind entkoppelt.
- Die Welt verändert sich über ihre Epochen. Wie weit die Spielerstammlinie bereits
  entwickelt ist, hängt von ihrem eigenen Verlauf ab.
- Ein früh entwickelter säugetierartiger Spieler darf deshalb in einer dafür
  historisch zu frühen Umwelt vorkommen. Das ist eine gewollte Spielvereinfachung.
- Reale Tierarten bekommen eigene zeitliche Auftretensfenster. Diese können mitten
  in einer Epoche beginnen oder über eine Epochengrenze hinausreichen.
- Generationenzahl und Epochenwechsel müssen nicht zusammenfallen.

**Offen:**

- Konkreter Zeitmaßstab, Pausen-/Offlineverhalten und das Ende eines Laufs.
- Wie viele größere Körperentwicklungsschritte die Hauptlinie genau hat und was
  den nächsten Schritt auslöst.
- Wie Weltzeit, Entwicklungsschritt und gewöhnlicher Generationswechsel in der
  Oberfläche auseinandergehalten werden, ohne die interne Baumstruktur offenzulegen.

Wichtig: Die Rechnung mit 64 Endwegen gilt bei festem Start und **sechs binären
Entscheidungen**. Sie folgt nicht automatisch aus sieben Epochen, nachdem Weltzeit
und Entwicklung entkoppelt wurden.

Aufwand / Übernahme: P1 und P2; Umsetzung durch mich möglich.

## 5. Lebensräume, Laichplätze und Übergänge

**Festgelegt / Arbeitsgrundlage:**

`Tiefsee ↔ Wasser ↔ Ufer ↔ Land ↔ Berge`

- Hauptstart im Wasser.
- Zunächst ein Fortpflanzungsort pro Lebensraum. Weitere Karten und mehrere
  Fortpflanzungsorte desselben Typs können später ergänzt werden.
- Auswandern erfolgt grundsätzlich in benachbarte Lebensräume.
- Pro relevantem Entwicklungsschritt soll es **genau zwei Optionen** geben.
- Diese sind eine interne Planungsregel. Die Welt und ihre Fortpflanzungsorte
  sollen die Möglichkeiten vermitteln; ein sichtbares Menü des vollständigen
  theoretischen Baums ist nicht vorgesehen.
- Bleiben und sich weiter spezialisieren ist eine gültige Option; besonders in
  den Bergen soll niemand grundlos zum Verlassen gezwungen werden.
- Der Fortpflanzungsort bestimmt den möglichen Wechsel der nächsten Grundform.
  Vorherige Vorbereitung, unter anderem Atmung und Fortbewegung, bestimmt, wie
  gut der Nachwuchs dort überleben kann.
- Erreichen/Fortpflanzen ist eine konkrete Handlung. Es ist kein Kauf mit zehn
  Muscheln vorgesehen.
- Unzureichend vorbereitete Nachkommen können aussterben.
- Umweltprobleme sollen früh genug erkennbar werden, um über Generationen reagieren
  zu können. Beispiele: sinkendes oder steigendes Wasser, lokale Sauerstoffprobleme,
  Wärme und Trockenheit. Das ist noch kein fertiger Ereigniskalender.

**Offen:**

- Die zwei konkreten Optionen an jedem Entscheidungspunkt.
- Vollständig lebensfähiger, binärer Baum oder einzelne ökologisch begrenzte Äste.
  Gewünscht sind zwei Optionen; die vollständige Ausgestaltung aller Äste ist noch
  keine bestätigte Liste von Tierformen.
- Bedingungen für einen Körperwechsel, Verhalten des bisherigen Laichs und die
  genaue Rückkehr vom Land ins Wasser.
- Ob „Wasser“ als Lebensraum präziser benannt werden soll, etwa als Flachwasser.

Aufwand / Übernahme: P3; Umsetzung und Prüfung durch mich möglich. Der vollständige
Inhalt aller Lebensräume ist darin nicht enthalten.

## 6. Körperformen, Merkmale und Animation

**Festgelegt:**

- Die Körpergrundform berücksichtigt den bisherigen Abstammungsweg.
- Darüber liegen graduelle, kombinierbare und vererbte Merkmale, beispielsweise
  Gebiss, Panzerung, Flossen/Gliedmaßen, Proportionen und Farbe.
- Beim Grundformwechsel werden die vorhandenen Merkmale sinnvoll auf die neue
  Anatomie abgebildet. Sie werden nicht einfach zurückgesetzt.
- Ein Rückkehrer aus dem Wasser soll sich erkennbar aus seinem bisherigen Körper
  entwickeln. Ein generischer neuer Standardkörper bei jedem Epochenwechsel
  erfüllt das Ziel nicht.
- Fossiltiere können anatomische Vorbilder sein. Eine belegte direkte Ahnenfolge
  wird dadurch nicht behauptet.
- Tiere innerhalb derselben Generation sollen sich auch visuell unterscheiden.
- Ein skalierbares System für Körper, Bilder und Bewegungen wird benötigt.
- Der Spieler sieht **seinen tatsächlich entstandenen Stammbaum**. Gebiss,
  Proportionen, Farben und andere vererbte Ausprägungen machen die Verläufe individuell.
- Die endliche interne Liste von Basisformen soll nicht leicht erkennbar sein.
  Keine vorgezeichnete vollständige Schablone, Basisformnummern oder Anzeige
  „64 mögliche Endtiere / 127 Knoten / X % aller theoretischen Äste“ im Spiel.
- Das Entdecken soll sich offen und vielfältig anfühlen. Die Nachkommenwerte
  bleiben dabei ausdrücklich sichtbar; verborgen bleibt die globale Inhaltsstruktur.

**Vorgeschlagene Architektur, noch kein implementiertes System:**

1. Grundform mit Proportionen, Ansatzpunkten und anatomischen Grenzen.
2. Vererbte Merkmale verändern diese Grundform innerhalb ihrer Möglichkeiten.
3. Gemeinsame Rigs und Bewegungsabläufe für kompatible Körperbaupläne.
4. Charakteristische gezeichnete Teile und Oberflächen pro Tierform.
5. Eigene Bewegungsgrundlagen für deutlich andere Baupläne, etwa Gliederfüßer.

**Vorschlag:** Körperwerkbank mit Reglern, Ansatzpunkten, Animationsvorschau,
Vergleich zweier Formen und Speicherung der im Spiel verwendeten Profile.
Der konkrete Editorumfang ist nicht beschlossen.

Bei sechs Entscheidungen entstehen 64 Endwege und 127 Positionen im vollständigen
internen Baum. Diese Zahlen dienen ausschließlich der Entwicklungsplanung.
Das ist nicht automatisch die Anzahl unterschiedlicher Rigs oder einzeln
gezeichneter Animationssätze. Wie stark Grundformen geteilt werden können, muss
an konkreten Körpergeschichten erprobt werden.

Aufwand / Übernahme: P4. Anatomiemodell, Rigs, Werkzeuge und Bildentwürfe kann ich
übernehmen. Gestalterische Auswahl und Qualitätsbeurteilung bleiben gemeinsam.

## 7. Nachkommen und Kooperation

**Festgelegt:**

- Eigenschaften der Nachkommen sind **immer erkennbar**. Keine Muschel- oder
  Intelligenzsperre für diese Kerninformation.
- Der Nachwuchs bleibt sichtbar und auswählbar wie bisher.
- Unterschiedliche Geschwister ermöglichen unterschiedliche Entscheidungen: etwa
  ein schwächeres Tier zum Erkunden oder ein stärkeres zum Nahrungserwerb.
- Koop ist ein wichtiges Ziel. Die gewünschte Richtung ist dieselbe Art und
  Generation mit gemeinsam beeinflusster Vererbung.
- Die bereits geregelte Koop-Todfrage wird nicht neu entworfen.

**Offen:** Ausprägung der Geschwisterstreuung, gemeinsame Entscheidungen beim
Körperwechsel und erforderliche Netzwerksynchronisierung der neuen Systeme.

Aufwand / Übernahme: P3, P4 und P11; technische Umsetzung durch mich möglich.

## 8. Muscheln als laufübergreifendes Sammelziel

**Festgelegt:**

- Muscheln bleiben besondere **Sammelgegenstände**. Sie sind keine Nahrung.
- Keine zufälligen Lebens-, Ausdauer- oder Sauerstoffboni als ihre neue Rolle.
- Keine Muschelpflicht zum Freischalten des nächsten Laichplatzes.
- Keine Intelligenzsperre vor den Nachkommenwerten.
- **Sieben unterschiedliche Muscheln an festen, bewusst gestalteten Fundorten.**
- Die Sammlung bleibt **über mehrere Läufe und Starttiere hinweg erhalten**.
  Eine Muschel zählt pro Spielerprofil einmal. Sieben Funde in einem Lauf sind
  ausdrücklich keine Voraussetzung mehr.
- Die Fundorte werden nicht an den gewählten Spielerpfad angepasst. Ein Lauf darf
  Funde verpassen oder wegen seiner Lebensweise beziehungsweise Weltzeit nicht
  erreichen; spätere Läufe ergänzen die Sammlung.
- Feste Fundorte können eine definierte Geschichte über mehrere Kartenzeitstände
  haben. Diese richtet sich nach der Welt, nicht nach der aktuellen Spielerposition.
- Die einzigartige große Muschel am ursprünglichen Wasserstart soll erhalten bleiben.
- Nach jeder neu gefundenen Muschel hat die große Muschel bei einem späteren Besuch
  eine neue kurze „Weisheit“. Diese Hinweise ergeben ein Rätsel um die spätere
  Belohnung durch ein neues Tier. Sie sind kein allgemeiner Upgrade-Shop.
- Entdecken, Überleben und Vererbung bleiben die tragenden Tätigkeiten. Muscheln
  liefern keine Pflichtpunkte für die normale Körperentwicklung.

**Neues Zielbild für das Einlösen:**

- Den vollständigen Satz an einem besonderen Ort abgeben. Dort entsteht oder
  wird ein neues Gelege erreichbar, das eine zusätzliche Startlinie eröffnet.
- Bevorzugt soll einer der beiden Belohnungsorte im tiefen Wasser und der andere
  an Land liegen. Welche Sammlung zu welchem Ort und Tier gehört, hängt von der
  endgültigen Tierauswahl ab.
- Eine Rückkehr in einem späteren Lauf ist gewollt möglich. Die bisherige Idee,
  zwingend im selben Lauf als Fisch zurückkehren zu müssen, entfällt.

**Offen:** die sieben Orte und ihre Zeitfenster; Texte und Abrufreihenfolge der
Weisheiten; genaue Abgabestelle und ihr Verhältnis zur großen Startmuschel;
Übergang vom entdeckten Belohnungsgelege zur neuen Startlinie. Insbesondere ist
noch zu entscheiden, ob der Besuch einen späteren Neustart freischaltet oder
direkt den Wechsel in den eigenen Startzeitpunkt der neuen Linie anbietet.

**Vorgeschlagene Speichergrundlage:** Gefundene Muschel-IDs, bereits gehörte
Weisheiten, Einlösung und freigeschaltete Startlinien getrennt dauerhaft speichern.
Ein Tod oder Wiedereinstieg darf Funde weder löschen noch doppelt zählen.

Aufwand / Übernahme: P6; Code, Speicherregeln, Oberfläche und Fundortdaten kann ich
übernehmen. Vollständige Platzierung setzt die fertigen Karten voraus.

## 9. Sieben Bossfossilien

**Zielbild:**

- Sieben markante große Gegner, je einer für eine Epoche, ergeben sieben
  Fossilmedaillen mit einer Abbildung des jeweiligen Tieres.
- Sie haben passende Lebensräume und historische Auftretensfenster.
- Ihre Fundorte werden nicht auf jede mögliche Spielerlinie zugeschnitten. Eine
  Begegnung darf durch gewählten Lebensraum oder Zeitpunkt verpasst werden.
- Die sieben verschiedenen Fossilien bilden wie die Muscheln eine dauerhafte,
  laufübergreifende Sammlung. Nicht alle Gegner müssen in einem Lauf besiegt werden.
- Die Fossilien lassen sich an einer besonderen Stelle als Steinplatten einsetzen.
  Nach vollständigem Einsetzen öffnet sich ein Weg zu einem neuen Gelege und damit
  einer zusätzlichen Startlinie.
- Die zuletzt bevorzugte Lage dieses Ortes ist in den Tiefen des Wassers. Ein
  späterer Lauf darf erforderlich sein, um ihn nach dem letzten Fund zu erreichen.
  Die endgültige Zuordnung bleibt von den Belohnungstieren abhängig.
- Als wissenschaftliche Beschreibung passen lokale Spitzenräuber besser als ein
  angeblich einziges weltweit dominantes Tier der ganzen Epoche.

Die folgende Besetzung ist ausschließlich ein **Vorschlag des Assistenten**:

| Epoche | Vorschlag | Lebensraum |
| --- | --- | --- |
| Devon | Dunkleosteus | Wasser |
| Karbon | Anthracosaurus; alternativ Rhizodus | Ufer/Sumpf beziehungsweise Wasser |
| Perm | Inostrancevia | Land |
| Trias | Postosuchus | Land |
| Jura | Liopleurodon | Meer |
| Kreide | Mosasaurus | Meer |
| Paläogen | große Hyaenodon-Art | Land |

**Offen:** endgültige Arten, ihre Orte und Zeitfenster, Verhalten und Schwierigkeit;
Gestaltung des Einsetzens und des geöffneten Wegs; Übergang zur neuen Startlinie.
Die Sammlung wird dauerhaft geführt; die genaue Regel, ob bereits einzelne
Platten oder erst der vollständige Satz eingesetzt werden können, ist noch offen.

**Gemeinsame Sammlungsansicht:** Muscheln und eingesetzte beziehungsweise gefundene
Fossilien ergeben zusammen eine gestaltete Sternübersicht. Sie ist vom Startbildschirm
aus sichtbar und gehört zum Spielerprofil über alle gespielten Tiere hinweg.
Sie zeigt den Sammlungsstand, nicht den Umfang des theoretischen Evolutionsbaums.

Aufwand / Übernahme: P7; System, Darstellungen und Gegnerumsetzung kann ich
übernehmen. Die endgültige Auswahl treffen wir gemeinsam.

## 10. Zusätzliche Starttiere und Stammbaum

**Zielbild:**

- Drei Starttiere: ursprüngliches Tier und je eine zusätzliche Linie aus Muschel-
  und Fossilsammlung. Reihenfolge, Tiere und Abgabeorte bleiben zu bestimmen.
- Zunächst die erste Linie fertigstellen; Belohnungslinien sind Zusatzinhalt.
- Ein freigeschaltetes Tier kann an einem anderen Ort und zu einer anderen Zeit
  beginnen und einen kürzeren Verlauf haben.
- Beispielidee: ein Karbon-Gliederfüßer mit drei bis vier Epochen. Das konkrete
  Tier und die tatsächliche Zahl von Körperstufen sind noch nicht bestimmt.
- Eine eigene Linie muss keinen genauso großen Stammbaum wie die Hauptlinie haben.
- Das Belohnungsgelege steht für einen eigenen Ursprung mit eigenem Startort,
  Startzeitpunkt und Ausgangstier. Seine Entdeckung muss mit diesen Startbedingungen
  vereinbar umgesetzt werden.

**Festgelegt:** Im Stammbaum soll man in eine bereits erreichte Linie einsteigen
können, und zwar in deren **erste Generation**. Er zeigt gespielte Entwicklungen
mit ihren individuellen Ausprägungen. Ein vorab sichtbarer vollständiger
theoretischer Baum und dessen „100 %“-Anzeige werden nicht verfolgt.

**Vorgeschlagene technische Grundlage:** Eine unveränderliche Eintrittsmomentaufnahme
mit vererbten Werten, Körperprofil, Weltzeit, Ort, relevanter Weltphase und Zufallszustand.

**Festgelegt für Sammlungen:** Das aktuelle Spielerprofil behält Muscheln und
Fossilien beim Wiedereinstieg. Die Weltzeit des betretenen Linienanfangs und die
dauerhaften Sammlungseinträge sind getrennte Zustände.

**Offen:** Behandlung gewöhnlicher Laufressourcen, Begegnungs-/Zufallszustände und
gemeinsamer Koop-Wiedereinstiege. Ebenso offen sind die drei konkreten Starttiere,
ihre Endpunkte und die genaue Menügestaltung. Der Besuch eines neuen Geleges
soll eine eigenständige Startlinie eröffnen; die Beziehung zwischen deren eigener
Startzeit und dem besuchenden Lauf ist noch auszugestalten.

Aufwand / Übernahme: P5, P6 und später P10; technische Umsetzung und Grafikentwürfe
durch mich möglich. Die endgültigen neuen Baupläne werden gemeinsam ausgewählt.

## 11. Orte und Landschaften über die Zeit

**Geäußerter Wunsch:** Die Landschaft soll sich erheblich verändern und sich auch
geografisch bewegen können. Nur wechselnde Tiere auf derselben unveränderten Karte
wäre weniger interessant. Umfang und Umsetzung sind noch nicht beschlossen.

**Vorgeschlagene Lösung:**

- Weltkarte mit verschobenen Regionen, veränderten Küsten und neuen Verbindungen.
- Wenige handgebaute Zeitstände je spielbarer Region.
- Vor Ort wechselndes Gelände, Wasser, Durchgänge, Laichplätze und Vegetation.
- Sichtbare Vorzeichen und geeignete Übergänge bei größeren Veränderungen.
- Wiedererkennbare große Landschaftsformen, ohne jede Höhle durch hunderte
  Millionen Jahre unverändert erhalten zu müssen.
- Regionen dürfen verschwinden, neue dürfen entstehen.
- Keine vollständige numerische Simulation der Plattentektonik als Voraussetzung.
- Weltbaukasten um Zeitvarianten und eine Vorschau erweitern; Hauptspiel und Server
  lesen dieselben veröffentlichten Daten.
- Nur benötigte Kartenzustände und Assets laden.

**Vorschlag für den ersten Nachweis:** Eine Region in drei deutlich verschiedenen
Zeitständen, mit funktionierenden Wegen, Laichplätzen und Muschelfundorten.

**Offen:** regionale Erdgeschichte, Zahl der Karten, Zeitstände und Übergangsregeln;
Umgang mit einem Spieler oder Gelege mitten in einer großen Geländeänderung;
aktuelle und frühere Positionen bekannter Orte auf der Weltkarte.

Aufwand / Übernahme: P8 und P9; Datenmodell, Editor und Laufzeittechnik kann ich
übernehmen. Handgestaltung und Bildentwürfe kann ich vorbereiten; Auswahl und
Komposition sollen deine gewünschte Handschrift behalten.

## 12. Überholte oder nicht beschlossene Ansätze

- Sieben vollständig getrennte Hauptspiele: durch den zusammenhängenden Hauptlauf ersetzt.
- Fester Körperwechsel genau an jeder Epochengrenze: durch die Entkopplung überholt.
- 40–60 Stunden pro Lauf: durch vorläufig 4–5 Stunden ersetzt.
- Alte Zufallsdrops kaufen dauerhafte Muschel-Werteboni: soll ersetzt werden.
- Muscheln als Nahrung: ausdrücklich abgelehnt.
- Zehn Muscheln kaufen den nächsten Laichplatz: nicht weiterverfolgt.
- Muscheln/Intelligenz schalten Nachkommenwerte frei: abgelehnt; Werte bleiben erkennbar.
- Muscheln als Nachwuchs-Neuwürfelwährung: besprochene Alternative, nicht gewählt.
- 50 Muscheln als Umfang: durch sieben feste Muscheln ersetzt.
- Sieben Muscheln zwingend in einem Lauf: durch laufübergreifendes Sammeln ersetzt.
- Bewegliche Ersatzfundorte passend zu jeder Spielerroute: durch feste Fundorte ersetzt.
- Alle sieben Bosse müssen auf jeder Route erreichbar sein: nicht vorgesehen.
- Vollständiger vorgezeichneter Stammbaum als sichtbare „100 %“-Liste: verworfen.
- Freischaltung allein als automatische Menübelohnung ohne besonderen Ort: durch
  das neue Zielbild mit abzugebenden Sammlungen, Wegen und Gelegen ersetzt.
- Unvermeidliches Aussterben bestimmter korrekt gespielter Äste: diskutiert, nicht beschlossen.
- Pflicht zur vollständigen physischen Rückkehr als Fisch: nicht beschlossen.
- Vollständige Plattentektoniksimulation: nicht beauftragt.
- Die vorgeschlagenen sieben Bossarten und die genaue Rig-/Editorarchitektur sind
  keine bereits bestätigten Inhaltslisten.

## 13. Aufwand und was ich übernehmen kann

Grobe Größenordnungen für fokussierte Entwicklungsarbeit mit Implementierung und
passender Prüfung. Ein Arbeitstag entspricht ungefähr 6–8 Arbeitsstunden. Das sind
keine Zusagen zur Dauer einer Chatantwort oder zu festen Fertigstellungsterminen.
Die Spannen gelten für erste überprüfbare Stände im jeweils genannten Umfang,
nicht für ein fertig balanciertes Spiel. Pakete haben Abhängigkeiten und sind nicht
ohne Weiteres zu einer Gesamtzeit zu addieren.

| Paket | Konkreter erster Umfang | Aufwand | Kann ich übernehmen? |
| --- | --- | --- | --- |
| P1 | Datenmodell und Trennung von Weltzeit, Generation, Entwicklungsstufe und realen Artenzeitfenstern; wenige Testarten | 2–4 Tage | Ja: Konzept, Code, Tests; historische Inhaltsauswahl gemeinsam |
| P2 | Zusammenhängender Lauf statt getrennter Epochenlinien; versionierter Spielstand und Migration | 3–6 Tage | Ja: Code, Migration und Prüfungen |
| P3 | Vererbungsregeln neu entwerfen und ersten Wasser/Ufer/Land-Übergang mit zwei internen Optionen, Laichwechsel und verhaltensbasierter Vererbung einschließlich Lebenskraft/Ausdauer umsetzen | 5–10 Tage | Ja: Entwurf, Technik und erste Regeln; konkrete Trainingsanreize und Spielgefühl gemeinsam |
| P4a | Zwei erkennbar unterschiedliche verwandte Körperformen, Merkmalsabbildung, Geschwistervariation und gemeinsame passende Animation | 5–10 Tage | Ja: Anatomiedaten, Rig, Bildentwürfe, Integration und Prüfung |
| P4b | Kleine Körperwerkbank mit Reglern, Animationsvergleich und Speichern | zusätzlich 3–6 Tage | Ja; Umfang noch zu entscheiden |
| P5 | Einstieg in die erste Generation einer erreichten Linie, Momentaufnahmen und individuelle Stammbaumoberfläche ohne sichtbare theoretische Gesamtliste | 3–5 Tage | Ja: Speicherlogik, Oberfläche und Tests |
| P6 | Dauerhafte Sieben-Muscheln-Sammlung, alte Drop-/Segensregeln entfernen, Migration, erste feste Fundorte, Weisheiten und Abgabe-/Gelege-Nachweis | 3–6 Tage | Ja; fertige Orte und Texte werden gemeinsam ausgewählt, die Bonuslinie kommt separat hinzu |
| P7a | Dauerhafte Fossilsammlung, Sternübersicht sowie Einsetzen von Platten und Öffnen eines Wegs zu Testlaich | 3–6 Tage | Ja: Daten, Oberfläche, Speicherung und Prüfung; fertige Höhlengestaltung und Bonuslinie separat |
| P7b | Einen ausgewählten Gegner mit eigenem Verhalten und erster Fossildarstellung ausarbeiten | je 2–5 Tage bei vorhandenem geeignetem Rig | Ja; neue Körperbaupläne und spätere Balancingrunden kommen hinzu |
| P8 | Zeitvarianten im Weltbaukasten, gemeinsame Ladelogik und sichere Zustandswechsel | 4–8 Tage | Ja: Daten, Editor, Client/Server und Tests |
| P9 | Eine Region in drei deutlich veränderten, spielbaren Zeitständen als Nachweis | 5–10 Tage | Ja: Entwürfe, Bau und Integration; Gestaltung gemeinsam; abhängig von verfügbaren Bauteilen |
| P10 | Eine zusätzliche kurze Startlinie auf bereits vorhandener Bewegungsgrundlage | 1–3 Wochen | Ja; bei einem neuen Gliederfüßer-Rig erst nach einem Bauplanprototyp belastbar schätzbar |
| P11 | Neue Lauf-, Zeit-, Laich-, Sammel- und Körperzustände im Koop synchronisieren | 3–7 Tage nach Stabilisierung der Grundlagen | Ja: Server, Protokoll und Mehrspielerprüfung; vorhandene Todregeln beibehalten |
| P12 | Ein begrenzter Balancing-/Performance-Durchgang an einem spielbaren Abschnitt | 2–5 Tage je Durchgang | Ja: Messungen, Automatisierung und Anpassungen; längere echte Spieltests gemeinsam |

Viele weitere Arten, sämtliche Karten, alle 64 Endwege und ein durchgehend
balanciertes Sieben-Epochen-Spiel sind damit noch nicht fertig. Ihr Produktionsaufwand
liegt eher in Monaten als Tagen und wird erst nach einem funktionierenden Teilstück
vernünftig schätzbar. Die Zahl der neuen Körperbaupläne und handgebauten Kartenstände
ist dafür entscheidender als die Zahl gespeicherter Stammbaumknoten.

## 14. Sinnvolle nächste Reihenfolge

1. Die grundlegenden offenen Regeln konkretisieren: Entwicklungsschritte,
   genau zwei interne Optionen, neue Vererbungsregeln und was einen vollständigen
   Lauf beendet. Die tatsächliche Linie bleibt die einzige sichtbare Baumstruktur.
2. Einen Teil von P1/P2 aufsetzen: stabil getrennte Zeit-/Entwicklungsdaten mit
   versionierter Speicherung, zunächst ohne alle existierenden Inhalte umzubauen.
3. Einen durchgehenden Wasser/Ufer/Land-Abschnitt aus P3/P4a beweisen: Verhalten,
   Nachwuchswahl, Körperwechsel und erkennbare Geschwister.
4. Den Wiedereinstieg aus P5 und den ersten Koop-Nachweis aus P11 anschließen.
5. P6 und P7a mit kleinen Testinhalten integrieren: dauerhafte eindeutige Funde,
   eine Weisheit, Sternübersicht und ein Abgabeort mit freigelegtem Gelege. Keine
   neuen Werteboni als Zwischenlösung für Muscheln einführen.
6. P8/P9 an einer Region prüfen, bevor alle Karten in Zeitvarianten ausgebaut werden.
7. Erst danach zusätzliche Wege, Epochen, vollständige Sammlungen und Bonuslinien
   in größerer Menge produzieren.

Die erste zusammenhängende, bewusst begrenzte Fassung liegt grob in der Größenordnung
mehrerer Wochen fokussierter Arbeit. Als Richtwert für einen Schnitt aus zwei
Körperformen, einem Übergang, Speichern/Wiedereinstieg und ersten Sammelobjekten:
etwa 3–6 Wochen. Vollständige Werkzeuge, mehrere Landschaftszeitstände, neue
Bauplanfamilien und komplette Koop-Abdeckung erweitern diesen Umfang.

## 15. Technische Anschlussstellen im aktuellen Code

Diese Punkte wurden am Ausgangsstand gelesen; sie sind noch nicht umgebaut:

- `src/data/epochs.ts`: Epochen sind derzeit getrennte Welten mit eigener
  Spielerklasse. Zeitfenster und Spielergrundform müssen auseinandergezogen werden.
- `src/state/GameState.ts`: getrennte Epochenlinien, Wurzeln und geparkte Läufe;
  heutige Spielstandprüfung setzt teilweise dieselbe Klasse und Epoche innerhalb
  eines Astes voraus. Ein übergreifender individueller Baum braucht neue Regeln
  und eine Migration; laufübergreifende Sammlungen dürfen nicht mit einem
  Linien-Checkpoint zurückgesetzt werden.
- `src/data/life.ts`, `GameState.ts`, `src/scenes/HudScene.ts`: alte
  Muschel-Drops, Kaufkosten und Werteboni müssen samt Anzeigen und Altständen
  gemeinsam ersetzt werden. Auch davon abhängige Sonderfälle wie goldene Eier
  sind zu prüfen.
- `src/art/fish/{anatomy,rig,paint,painted}.ts`: bereits vorhandene Trennung von
  Anatomie, Zeichnung und Bewegung ist eine Grundlage, kein fertig universelles Rig.
- `src/editor/`, `src/data/maps/worlds.json`: bestehender Weltbaukasten und
  gemeinsamer Speicherweg können um Zeitvarianten erweitert werden.
- `src/net/`, `src/server/`: Ortszuordnung und Zustandssynchronisierung müssen
  den gemeinsamen Lauf und seine neuen Zustände unterstützen.
- `src/objects/Shrine.ts`, `src/scenes/TitleScene.ts`, `src/scenes/TreeScene.ts`:
  große Muschel, Sammlungszugang und Stammbaumdarstellung erhalten neue Rollen.
  Interne Variantenkataloge und Gesamtzahlen gehören nicht in die Spieleransicht.

Für diese Dokumentationsänderung sind keine neuen Spieltests erforderlich.
Implementierungen bekommen jeweils passende Simulations-, Speicher-, Browser-
und gegebenenfalls Mehrspielerprüfungen.
