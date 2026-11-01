# EVO – gemalter Kopfpanzer des Spielerfisches

## Umfang

Dieses Paket behandelt ausschließlich Schritt 1: eine eigene gemalte Kopfpanzer-Auflage für den bestehenden Spielerfisch. Es erweitert weder die Weltfische noch andere Tiergruppen oder deren Rigs.

Die neue Auflage besitzt wenige große Knochenfelder, weich gekrümmte Nähte, eine geschwungene organische Hinterkante und eine zurückhaltende mineralische Farbgebung passend zum gemalten Fisch. Sie wird in die bestehende Kopfgeometrie eingebunden; die Stärke bleibt aus den vorhandenen Evolutionswerten abgeleitet.

## Dateien und Rollen

| Datei | Rolle |
|---|---|
| `textures/kopfpanzer_basis.png` | **Empfohlene Laufzeitbasis.** Freigestellte Panzerform mit geschlossener Fläche im Augenbereich; der Renderer setzt Augenöffnung/Augenhöhle an der tatsächlichen Position von `A.eye`. |
| `textures/kopfpanzer_mit_augenoeffnung.png` | Alternative mit tatsächlich transparenter Öffnung; nützlich zur Registrierung und für die maximale Referenzform. |
| `referenzen/kopfpanzer_zielbild.png` | Illustrative Gesamtansicht als gestalterisches Ziel; kein Screenshot einer bereits eingebauten Version und keine Ganzkörper-Laufzeittextur. |
| `referenzen/plate_template.png` und `.svg` | Technische Vorlage des Kopfschilds mit geschwungener Hinterkante, aus den gelesenen Kopfmaßen aufgebaut. |
| `referenzen/plate_guides.png` und `.svg` | Separate Hilfslinien und Bezugspunkte. |
| `registration.json` | Maße der tatsächlich gelieferten Bilder, Referenzanatomie, Augenposition, gemessene Öffnung und gelesene Quelltextstände. |
| `mapping_example.ts` | Kleines Beispiel für eine augenzentrierte Zuordnung der Basiszeichnung in die Körperkoordinaten; an den Importer anpassen und dort prüfen. |
| `prompts.json` | Die verwendeten Bildgenerierungs-Prompts. |

Die PNG-Pixel wurden nach der Bildgenerierung unverändert übernommen. Beide Einzeltexturen sind RGBA mit transparentem Außenraum. Die Basis ist im vorgesehenen Augenbereich deckend; die Alternative enthält dort ein transparentes Loch.

## Warum die geschlossene Basis empfohlen ist

Die Kopfproportionen verändern sich mit der Evolution. Eine bereits ausgeschnittene Öffnung kann beim nicht proportionalen Verformen oval werden oder zu groß geraten. Die geschlossene Basis erlaubt es, den tatsächlich benötigten Augenbereich aus der Panzerauflage zu nehmen beziehungsweise passend zu maskieren und danach die vorhandene Augenhöhle zu zeichnen.

Auge, Irisfarbe, Blick und Lid bleiben die vorhandenen eigenen Elemente. Die sichtbare Augenhöhle wird einmal gestaltet, mit passender dunkler Vertiefung und dezenter Knochenbraue. Die gezeichnete Panzerfläche darf weder den Augapfel überdecken noch einen zweiten starren Augenring daneben erzeugen.

## Registrierung

Gelesener Branch: `claude/sleepy-clarke-ffews7`. Die konkreten Quelltext-Blobs stehen unter `source` in `registration.json`; inzwischen vorhandene Änderungen berücksichtigen.

Die maximale Referenzform hat `skull = 1`, `spike = -1`, `jaw = 0`, `len = 0`, `girth = 0`. Ihre relevanten Kopfmaße sind:

| Größe | Wert in Zeicheneinheiten |
|---|---:|
| Kopfursprung `hx` | 20,4 |
| Kopfursprung `hy` | −0,84 |
| Kopflänge `hg.L` | 28,4 |
| Kopfhöhe `hg.H` | 39,192 |
| Augenmitte x | 30,908 |
| Augenmitte y | −5,8879296 |
| gezeichneter Augapfelradius | 3,7271 |

Die technische Vorlage besitzt 1248 × 1104 Pixel bei 24 Pixeln je Zeicheneinheit. Ihr Rahmen ist x = 4 … 56 und y = −31 … 15. Die Bildgenerierung hat die native Auflösung auf 1334 × 1179 Pixel verändert und einzelne Ränder verschoben. Ein direktes Übernehmen der Vorlagenpixel ist deshalb keine fertige Registrierung.

Die Öffnung der gemalten Alternative wurde aus ihrer Alpha-Maske vermessen. Ihre Mitte liegt ungefähr bei (710,5222 | 638,4097) nativen Pixeln, ihr flächenäquivalenter Radius bei 115,7909 Pixeln. Die tatsächlichen Zahlen und ihre Herleitung stehen im JSON. Eine erste Zuordnung verwendet diese Öffnung als Augenanker und 4,65 Zeicheneinheiten als Referenzradius. Diese Zuordnung ist eine Ausgangsnäherung; Hinterkante, Krone, Schnauze und Lippennähe anschließend im Rig prüfen.

`mapping_example.ts` verankert die Zeichnung direkt an `A.eye` und skaliert ihre beiden Achsen relativ zur Referenz-Kopflänge und -höhe. Damit ist die Augenposition der stabilste Bezugspunkt. Die Basis ermöglicht danach eine dynamische runde Augenöffnung trotz unterschiedlicher Achsenskalierung. Die lokale Lage von Hinterkante und Schnauzenspitze bleibt visuell abzustimmen.

## Einbindung im bestehenden Code

Im gelesenen Stand zeichnet `src/art/fish/paint.ts` den Kopfpanzer in `headDetails()` prozedural. Der betreffende Block beginnt bei `const pl = A.plate * A.plate * 0.7`; anschließend folgen die Plattenfläche, Nähte und Höcker. Der getrennte Augenhöhlen-/Brauenblock folgt darunter. `paintBodyFeatures()` ruft diese Kopfdetails im Körperkoordinatensystem auf. In `painted.ts` werden die Merkmale innerhalb einer Körpermaske auf den gemalten Körper gelegt.

Für den Einbau:

1. Lade die neue Basis über den vorhandenen Asset-Importweg. Erhalte die Originalzeichnung im `art/`-Bereich und nutze bei Bedarf den vorhandenen Laufzeit-Konvertierungsweg.
2. Zeichne die neue Panzerauflage beim Erzeugen des jeweiligen Aussehens im Körperkoordinatensystem in die vorhandene Körpertextur beziehungsweise einen zu ihr passenden Durchgang. Dadurch folgt sie anschließend demselben Kopf-/Körpernetz.
3. Unterdrücke bei verwendeter gemalter Auflage die bisherige prozedurale Panzerfläche einschließlich ihrer Nähte/Höcker. Die übrigen Kopfdetails, insbesondere Kaumuskel, Augensteuerung und vorhandene weitere Merkmale, erhalten ihre jeweilige Funktion. Vermeide zirkuläre Importe zwischen `paint.ts` und `painted.ts`.
4. Begrenze die Panzerzeichnung auf die aktuelle Kopf-/Körperfläche, sodass sie die Lippen, den Unterkiefer oder die Brustflosse nicht übermalt. Die bestehende äußere Körpersilhouette darf keine doppelte schwarze Kante bekommen.
5. Maskiere den Augenbereich passend zu `A.eye` und zeichne eine stimmige Augenhöhle/Braue genau einmal. Das vorhandene Auge und Lid liegen anschließend darüber.
6. Verwende `A.plate` weiter als Stärke. Entwickle Deckung und gegebenenfalls Flächenmaske weich; bei `A.plate = 0` bleibt die Auflage unsichtbar. Erhalte die bestehende Ableitung der Evolutionswerte.
7. Färbe Knochen und Haut bewusst getrennt ab: Die Auflage soll als helleres mineralisches Material erkennbar bleiben und zugleich die Linienfarbe aufnehmen. Eine vollständige Normalisierung auf den dunkleren Hautmittelwert würde ihre gemalte Modellierung verlieren. Im Spiel abstimmen.
8. Erzeuge beziehungsweise cache die fertige Textur pro Aussehen. Eine neue große Panzertextur pro Animationsframe ist unnötig. Bei fehlendem neuen Asset bleibt die bisherige prozedurale Kopfpanzerzeichnung ein brauchbarer Rückfallweg.

## Visuelle Abnahme

- Ohne Panzer, mittlere Ausprägung und maximalen Kopfpanzer vergleichen; der Übergang bleibt kontinuierlich.
- Rückwärtige Kante: geschwungener Verlauf, keine gerade senkrechte Schnittkante und kein heller aufgeklebter Rahmen.
- Auge: sitzt in der Öffnung, bleibt beim Wachstum sichtbar, Lid/Blick funktionieren weiter.
- Schnauze und Unterkiefer: Lippen frei, keine Panzerfläche im geöffneten Maul.
- Schwimmen und vollständiger Biss: Panzer folgt dem Kopf, kein Abreißen am hinteren Rand.
- Bestehende Kombinationen mit verändertem Kiefer und Körperbau auf Anschlussprobleme prüfen. Diese Runde erzeugt dafür keine weiteren eigenständigen Tierzeichnungen.
- Werkstatt sowie tatsächliche Spielansicht bei 45/70/90 Pixeln prüfen, besonders die Lesbarkeit der großen Knochenfelder.
- Passende vorhandene Tests und Typprüfung nach der Integration ausführen.

Die Zeichnungen, ihre Transparenz, die Öffnung und die Referenzmaße wurden geprüft. Der Einbau und die tatsächliche Darstellung im laufenden Rig sind noch im Projekt auszuführen.

## Auftrag an Claude

Setze ausschließlich den gemalten Kopfpanzer des Spielerfisches aus diesem Paket um. Lies diese Hinweise und `registration.json`. Nutze `kopfpanzer_basis.png` als bevorzugte Basis und die Gesamtansicht als gestalterische Referenz. Registriere die Auflage augenzentriert, integriere sie in die bestehende Körperzeichnung und erhalte die stufenlose Entwicklung über `A.plate`. Korrigiere die Hinterkante und die Augenhöhle sorgfältig. Ersetze die bisherige prozedurale Panzerfläche, sobald das neue Asset verwendet wird, und prüfe die oben genannten Abnahmepunkte. Liefere echte Aufnahmen mit mittlerem/maximalem Panzer und während des Bisses. Weitere Tiergruppen und Weltfische gehören zu einem späteren Auftrag.
