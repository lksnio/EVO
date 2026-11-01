# EVO – Fischdarstellung überarbeiten: Auftrag an Claude

Arbeite im bestehenden Projekt auf `claude/sleepy-clarke-ffews7`. Die technische Bestandsaufnahme dieses Pakets bezieht sich auf `08901b9`; berücksichtige inzwischen vorhandene Änderungen. Setze die Überarbeitung direkt um und prüfe das tatsächliche Bild im Spiel.

## Zuerst lesen und ansehen

1. `REFERENZEN/00_ist_original.png`: tatsächlicher problematischer Spielstand aus dem Screenshot.
2. `REFERENZEN/01_befund_markiert.png` und `BEFUND.md`: die konkreten gestalterischen Baustellen.
3. `REFERENZEN/02_zielbild_formen.png`: neue Gesamtgestaltung der normalen, massigen und kräftig bezahnten Form, von oben nach unten.
4. `REFERENZEN/03_zielbild_biss.png`: geschlossener, halb offener und kräftig geöffneter Kiefer, von oben nach unten.
5. `ART_DIRECTION.md`, `TECHNIK.md` und `ABNAHME.md`.

**Die neuen Bilder sind Gestaltungs- und Posenreferenzen.** Sie besitzen keine zum Rig registrierten UVs. Ausrichtung, Proportionen und Überdeckungen der bestehenden Darstellung sollen anhand dieser Bilder überarbeitet werden. Die Tafeln werden nicht als fertige Laufzeittexturen oder komplette starre Fischbilder eingebaut. Präsentationshintergrund, Halo und Zwischenräume der Tafeln gehören nicht zur Spielgrafik.

## Auftrag

### 1. Spieler im sichtbaren Bereich lesbar machen

Gewünscht ist eine zusätzliche vierte Lösung zur zuvor angebotenen Auswahl: eine begrenzte, ruhig nachgeführte Helligkeitskompensation ausschließlich für die Spielerzeichnung in deren bestehendem Renderpfad, vor dem Sichtschleier. Die normale Szenentiefe und Verdeckung durch Pflanzen/Felsen erhalten. Der Spieler bleibt Teil der Unterwasserbeleuchtung.

Prüfe zuerst die Paletteneinfärbung und danach die Überlagerungen getrennt. Sorge dafür, dass Rücken, Bauchfläche und Gesicht bei normalem Spielzoom erkennbar werden. Nutze eine zur installierten Phaser-Version passende Umsetzung für die gesamte Spielerzeichnung, einschließlich aller Rig-Teile. Die Verstärkung soll begrenzt sein, weich reagieren und die gezeichneten Helligkeitsunterschiede erhalten. Große globale Sichtänderungen und ein heller umlaufender Kontursaum sind dafür keine gestalterischen Ziele.

`Sight.clarityAt()`, Sichtweiten, Gegnerfreigabe und KI-Wahrnehmung behalten ihre bestehende Bedeutung. Es entsteht keine zusätzliche Sichtbarkeit fremder Objekte. Die technische Begründung und betroffenen Stellen stehen in `TECHNIK.md`.

### 2. Anatomie und Zusammensetzung überarbeiten

Normalform: Kopf, Wange, Hals und Rumpf sollen zusammenhängend wirken. Den hellen Kiemenring zurücknehmen; die Kiemenfalte ist eine dünne, auslaufende Furche. Der Kaumuskel wird als Volumen mit passenden Lichtflächen gestaltet; die bisherige dunkle ovale Fläche entfällt in ihrer jetzigen Wirkung.

Massige Form: einen kompakten, runden, kräftigen Körper mit zusammenpassendem Kopf und Schwanzstiel entwickeln. Rücken und Stirn brauchen einen kontrollierten weichen Verlauf. Die bisherige hohe kantige Spitze ist eine zu korrigierende Grundform. Anpassungen der visuellen Formprofile und Kontrollpunkte sind ausdrücklich Teil dieses Auftrags.

Starkes Gebiss: einen kräftigeren Vorderkopf, eine modellierte Wange, ein belastbar wirkendes Kiefergelenk und einen substanziellen Unterkiefer entwickeln. Der Kiefer fügt sich geschlossen in die Kehle ein und behält beim Öffnen seine Masse. Gebissentwicklung bleibt sichtbar und aus den bestehenden Werten abgeleitet.

Behalte die vorhandene Spielmechanik und Spielstanddaten bei. Die Zeichnung und ihre visuelle Abbildung auf die Werte werden überarbeitet. Extreme Werte brauchen eine gestaltete Form; eine pauschale Deckelung der Merkmale ist keine Erledigung des Auftrags.

### 3. Mundraum nach den Posen aufbauen

Überarbeite `drawMouth()` anhand der Bissreferenz. Die Öffnung besitzt eine dunkle zurückliegende Höhle, eine schmale obere Gaumenfläche und einen zurückhaltenden Mundboden. Ihre sichtbaren Ränder folgen den gemalten Lippen. Die rückwärtige Verbindung verschwindet unter Wange und Kieferansatz. Beim Schließen verschwinden alle Innenflächen sauber.

Das bisherige vollflächige aufgespannte Bild wird gestalterisch neu aufgeteilt beziehungsweise maskiert. Allein mehr Netzspalten beheben die rote Membranwirkung nicht. Die vorhandene Gaumentextur kann für schmale Innenflächen weiterverwendet werden; die zentrale Höhle bleibt dunkel. Kopf und Kiefer brauchen passende Überdeckungen.

### 4. Varianten belastbar verbinden

Nutze die vorhandenen Texturen und Referenzanatomien als Ausgangsmaterial. Korrigiere Registrierungen, Formprofile, Farbdurchgänge und Überdeckungen für die neue Gesamtwirkung. Übergänge zwischen Varianten müssen ohne springende Anatomie und ohne doppelte Konturen funktionieren.

Prüfe zusätzlich kurz/massig mit starkem Gebiss und Kopfpanzer mit starkem Gebiss. Löse Anschlüsse und Formprofile im gemeinsamen System. Eine neue Einzelzeichnung für jede Kombination wäre kein tragfähiger Ersatz dafür. Kopfpanzer und Weltfische werden anschließend auf die abgestimmte Grundgestaltung aufgebaut.

### 5. Im tatsächlichen Spiel prüfen

Nutze `ABNAHME.md`. Führe die bestehenden Tests und die Typprüfung aus. Prüfe die Bildwirkung in Werkstatt und Spiel, im Licht und Schatten sowie während des vollständigen Bissablaufs. Dokumentiere den geprüften Commit, Bildbelege und verbleibende Abweichungen. Korrigiere im Vergleich erkennbare Schwächen, bevor du die Darstellung als fertig meldest.

Arbeite innerhalb dieses Auftrags selbstständig weiter. Die Überarbeitung von Formprofilen, Kieferdarstellung und begrenzter Spieleraufhellung ist hier ausdrücklich gewünscht.
