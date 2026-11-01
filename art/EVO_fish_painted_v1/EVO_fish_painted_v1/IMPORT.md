# EVO – gemalter Spielerfisch, erster Assetsatz

## Inhalt und Stand

Dieser Satz enthält eine vollständige gestalterische Referenz und acht freigestellte PNG-Einzeltexturen für die neutrale Form des Spielerfisches. Grundlage sind die tatsächlichen Vorlagen aus `lksnio/EVO`, Commit `780cdea`, und die dort dokumentierten Ansatzpunkte. Die Bilder wurden mit dem integrierten Bildgenerator erzeugt und visuell geprüft. Die Bildpixel wurden anschließend unverändert kopiert; Alpha wurde erhalten.

Die Gesamtzeichnung `fish_master_reference.png` zeigt die angestrebte Wirkung: zusammenhängende slate-graue Körperflächen, eine helle Bauchfläche, dunkle organische Konturen, zurückhaltende Kiemenfalte und grau-elfenbeinfarbene Flossen. Sie ist die gestalterische Referenz. Die Laufzeitdarstellung entsteht aus den Einzeltexturen und den weiterhin prozeduralen Merkmalen.

**Der Satz ist für den ersten Integrationstest vorbereitet. Eine passgenaue Montage im tatsächlichen Rig ist noch auszuführen.** Die Bildgenerierung hat Auflösungen, transparente Ränder und einzelne Konturen gegenüber den Vorlagen verändert. Die ursprünglichen UV-Rahmen, Ansatzpunkte und Pivotkoordinaten bleiben maßgeblich. Die generierten Dateien sollten deshalb über eine Registrierung importiert werden.

## Dateien

| Datei | Verwendung |
|---|---|
| `fish_master_reference.png` | Gesamtzeichnung als Zielbild für den neutralen Fisch |
| `textures/teil_body.png` | Kopf, Rumpf, Schwanzstiel und Schwanzflosse; freie Körperfläche ohne Auge, Kiemenüberlagerung, separate Flossen, Unterkiefer oder Zähne |
| `textures/teil_jaw.png` | Unterkiefer ohne Zähne, mit weichem hinterem Anschluss |
| `textures/teil_eye.png` | Auge einschließlich Iris, Pupille und Lichtpunkt |
| `textures/teil_overlay.png` | schmale Kiemenfalte; ihre Stärke und Übergänge im zusammengesetzten Tier an die Gesamtzeichnung angleichen |
| `textures/teil_dorsal.png` | Rückenflosse |
| `textures/teil_anal.png` | Afterflosse |
| `textures/teil_pelvic.png` | Bauchflosse |
| `textures/teil_pectoral.png` | nahe Brustflosse; dasselbe Bild für die ferne Brustflosse verwenden und dort dunkler tönen |
| `registration.json` | gemessene Bildgrößen und Alpha-Bounds sowie ursprüngliche Rahmen, Pivotkoordinaten und Netze |
| `reference/source_manifest_780cdea.json` | unveränderte Koordinatenbeschreibung der neutralen Ausgangsvorlage |
| `prompts.json` | verwendete Gestaltungs- und Einzelteilprompts |

## Registrierung beim Import

Die PNGs liegen in ihrer nativen generierten Auflösung vor. Jede Textur muss auf den jeweiligen **ursprünglichen Vorlagenrahmen** abgebildet werden. Das ursprüngliche Manifest definiert anschließend die Zuordnung dieses Rahmens zum Fisch und seinem Mesh.

`registration.json` enthält für jedes Teil:

- `nativeSize`: tatsächliche Auflösung der neuen Datei.
- `paintedBounds128`: Begrenzung der neuen Zeichnung bei Alpha ≥ 128; exklusiver rechter/unterer Rand wie bei Pillow.
- `templateSize`: ursprüngliche Auflösung des Teilrahmens.
- `templateBounds128`: entsprechende Begrenzung in der bisherigen Vorlage.
- `templateOriginPx`, `placedAt`, `box`, `mesh`: ursprüngliche Koordinaten aus dem Manifest.

Diese Begrenzungen sind Messhilfen. Eine Abbildung der neuen Bounds auf die alten Bounds ist eine erste Näherung, die anschließend an den anatomischen Bezugspunkten korrigiert werden muss. Am Auge Zentrum und Durchmesser ausrichten; am Kiefer Gelenk, Maulspalte und Kinn; an den Flossen Wurzel und freie Spitze; am Körper Schwanzstiel, Schnauze und Halszone. Beim Kiefer enthielt die alte Alpha-Begrenzung auch die Zähne, während die neue Textur zahnfrei ist. Diesen Unterschied bei der Registrierung berücksichtigen.

Empfohlener Import: beim Laden beziehungsweise Erzeugen eines Aussehens jede neue Textur einmal über einen kontrollierten Zeichen-/Importtransform in einen Canvas mit dem ursprünglichen Vorlagenrahmen übertragen. Das vorhandene Mesh verwendet weiter die bisherigen normalisierten UVs. Den Importtransform separat konfigurierbar halten, damit Verschiebung und Skalierung pro Teil korrigiert werden können. Kein automatisches Zuschneiden ohne aktualisierten Ursprung.

**Zur Kontrolle:** exportierte Vorlagen und neue Texturen in der Werkstatt deckungsgleich überblenden. Dann das neutral zusammengesetzte Tier prüfen. Die Montage ist am vollständigen Tier und während eines Bisses zu beurteilen.

## Ebenen und Evolution

Der Körper ist bewusst eine saubere gemalte Basis. Tarnung, Schwarmmuster, Schuppen, Kopfplatten, Narben, Farbvarianten und Zähne bleiben aus den Evolutions-/Zustandsdaten abgeleitet.

Im gelesenen Stand von `paint.ts` werden mehrere dieser Merkmale noch zusammen mit der bisherigen Grundzeichnung in `paintBody` gemalt. Beim Import der neuen Basis diese Funktionen in geeignete Grund- und Merkmalsdurchgänge aufteilen. Die alte flächige Zeichnung würde sonst die neue Textur überdecken.

Muster auf die neue Körpermaske begrenzen und auf demselben Körpernetz mitführen. Kopfplatten und Augenhöhle weiter aus der Anatomie ableiten. Die Zähne auf Ober- und Unterkiefer getrennt ergänzen; Wurzeln unter der jeweiligen Lippe verdecken. In diesem Satz sind die Zähne aus den Teiltexturen herausgehalten. Das vermeidet doppelte oder unveränderlich eingebrannte Zähne.

Die Kiemenüberlagerung soll als Falte im Körper erscheinen. Den Eigenkontrast und die Überdeckung so abstimmen, dass daraus kein hell abgesetzter C-Ring wird. Die Gesamtzeichnung zeigt dafür die Zielwirkung. Eine Feinabstimmung der Kiemenmaske beziehungsweise ihrer sichtbaren Breite kann beim Einbau nötig sein.

Zeichenreihenfolge des vorhandenen Rigs erhalten: ferne Brustflosse – Bauchflosse – Rückenflosse – Afterflosse – dynamische Mundhöhle – Unterkiefer – Körper – nahe Brustflosse – Kiemenüberlagerung – Auge – dynamisches Lid. Zusätzliche Merkmalsebenen an ihrer anatomisch passenden Position einordnen.

Die Bilder verwenden weitgehend neutrale Grauwerte mit leicht kühler Haut und wärmeren Flossen. Die vorhandene Einfärbung sollte Licht und Schatten erhalten. Ihr Ergebnis mit den vorhandenen Linienfarben prüfen. Bei einer vollständigen Farbumsetzung gegebenenfalls aus den Helligkeitswerten eine getrennte Farbzuordnung ableiten; die Zeichnung selbst bleibt erhalten.

## Reihenfolge der Umsetzung

1. Einen neutralen Fisch mit diesem Satz in der Werkstatt zusammensetzen und alle Ansatzpunkte registrieren.
2. Im Spiel die Größen 45, 70 und 90 Bildschirm-Pixel sowie die vorhandene Tiefen-/Sichtabdunklung prüfen. Die eigentliche kleine Spielansicht entscheidet über die Lesbarkeit.
3. Schwimmen, Beschleunigen, maximalen Ausschlag und Biss prüfen: geschlossene Hautübergänge, passende Maulspalte, keine aufklappenden Kanten.
4. Prozedurale Farbe, Zähne, Tarnung, Schuppen und Kopfpanzer wieder ergänzen und auf doppeltes Zeichnen prüfen.
5. Moderate Morphologien und anschließend die Extremformen ansehen. Für kurz/massig, lang/schlank und einen stark verlängerten Kiefer zusätzliche gestaltete Varianten ausarbeiten, sobald die neutrale Montage als Referenz steht. Diese Sonderzeichnungen sind ein anschließender Arbeitsschritt.
6. Die nun funktionierende Einbindung auf die übrigen relevanten Devon-Fische übertragen; ihre jeweils eigene Anatomie und Silhouette erhalten.

## Was bereits geprüft wurde

- Alle neun Bilder sind lesbare RGBA-PNGs mit transparenten und vollständig deckenden Pixeln.
- Gesamtzeichnung und alle acht Einzelteile wurden visuell angesehen.
- Körper und Kiefer enthalten keine fest eingezeichneten Zahnreihen; die Körperfläche bleibt frei von dynamischen Mustern.
- Auflösungen und Alpha-Begrenzungen wurden aus den tatsächlichen Dateien gemessen.

Die Laufzeitmontage, Farbzuordnung, Evolution und Darstellung bei 45 Pixeln sind mit diesem neuen Assetsatz noch im Projekt zu prüfen. Die zuvor gemeldeten 230 Tests beziehen sich auf den Entwicklungsstand vor der Integration dieser Bilder.

## Kurzer Auftrag für den Coding-Agenten

Integriere den neutralen gemalten Fisch aus diesem Paket in das vorhandene Devon-Rig. Lies zuerst diese Importhinweise und das ursprüngliche Manifest. Verwende die Gesamtzeichnung als gestalterisches Ziel. Registriere die Einzeltexturen anhand der tatsächlichen Ansatzpunkte; verwende die gemessenen Alpha-Bounds als erste Orientierung. Erhalte die bestehenden anatomischen Koordinaten und normalisierten UVs. Führe Grundzeichnung und prozedurale Evolutionsmerkmale getrennt zusammen, sodass keine alte Flächenzeichnung die gemalte Basis überdeckt und keine Zähne doppelt erscheinen. Prüfe die neutrale Montage bei 45/70/90 Pixeln, beim Schwimmen und Beißen sowie mit den vorhandenen Farben. Korrigiere insbesondere Kieferanschluss, Kiemenfalte und Flossenwurzeln. Liefere Aufnahmen der tatsächlichen Montage und nenne die verbleibenden Sonderformen konkret. Spielmechanik und Evolutionswerte bleiben erhalten.
