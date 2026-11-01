# Technische Bestandsaufnahme und Umsetzungsvorschlag

Gelesener Stand: `lksnio/EVO`, Commit `08901b9`. Die folgenden Stellen wurden geprüft. Seitdem vorhandene Änderungen vor dem Arbeiten berücksichtigen.

## Sicht und Verdeckung

`src/config.ts` definiert unter anderem:

| Ebene | Tiefe |
|---|---:|
| Spieler | 20 |
| Vordergrundbewuchs/Verdeckung (`cover`) | 40 |
| Sichtschleier (`cover + 1`) | 41 |
| zusätzliche Vordergrunddekoration | 42 |

`src/scenes/LevelScene.ts` erzeugt `Sight` mit `DEPTH.cover + 1`. `src/objects/Sight.ts` legt darüber zwei DynamicTextures: trübes Wasser und Dunkelheit. Beide enthalten den ausradierten klaren Bereich. Dessen Zentrum wird in `Sight.update()` aus Spielerposition und geglätteter Blickrichtung nach vorn versetzt. `Sight.clarityAt()` und `LevelScene.sightStep()` nutzen diese Geometrie auch zur Darstellung der übrigen Tiere.

Ein pauschales Anheben der Spielertiefe über 41 würde ihn zugleich über Teile der Verdeckung bei 40 zeichnen. Ein Verschieben des gesamten Sichtzentrums würde die gemeinsame Sichtgeometrie beeinflussen. Ein umlaufendes Randlicht verändert vor allem die Kontur und stellt die innere Körpermodellierung nicht automatisch wieder her.

### Bevorzugter Weg: begrenzte Kompensation innerhalb der Spielerzeichnung

Dies ist ein **Umsetzungsvorschlag**, noch keine getestete Rendereränderung dieses Pakets:

- Normale Spielertiefe und Occlusion erhalten.
- Die Spielerzeichnung vor dem Sichtschleier moderat aufhellen, vorzugsweise mit einer passenden gemeinsamen Belichtungs-/Farbkorrektur für ihre Rig-Teile.
- Die Kompensation aus den ohnehin bekannten Sicht-/Schleierwerten oder einem kontrollierten visuellen Parameter ableiten; begrenzen und zeitlich weich nachführen.
- Farben, Schattenmodellierung und dunkle Linien erhalten; auf Clipping der hellen Flossen und Augen achten.
- Auf die Spielerzeichnung begrenzen. Gegnerfreigabe, `clarityAt`, Sichtweiten und `sim/sight.ts` behalten ihre bestehende Funktion.
- Keine GPU-Pixelrücklesung oder große neu erzeugte Körpertextur pro Frame einführen. Die konkrete Umsetzung an die tatsächlich verfügbare Phaser-4-Rendertechnik anpassen.

Die bekannte mittlere Helligkeit mit/ohne Sichtschleier (laut Bericht 25/60) dient als Diagnose. Die tatsächliche Zielhelligkeit wird im Bildvergleich abgestimmt. Der Spieler soll im Schatten noch Form besitzen und weiterhin zur dunklen Welt gehören. Echte Verdeckung durch Pflanzen und Felsen bleibt wirksam.

Vor dieser Kompensation die bestehende Palette prüfen: `paintBodyPainted()` färbt die registrierten Bildpixel über `tint()` auf `F.base` um. Dieser Schritt kann die Bildhelligkeit ebenfalls ändern. Vergleiche vor/nach Palettenanpassung und vor/nach Sichtschleier getrennt, damit keine versehentlich doppelte Abdunklung kompensiert wird.

## Mundraum

`src/art/fish/rig.ts` erzeugt für den gemalten Mund `new Grid(..., MOUTH_COLS, 1)`. In `drawMouth()` entstehen `topA`, `topB`, `botA` und `botB`. Die obere und untere Netzreihe werden jeweils linear zwischen den Endpunkten interpoliert. Die Textur füllt damit eine durchgehende aufgespannte Fläche. Das erklärt die im Screenshot sichtbare Membranwirkung als plausible gestalterische Folge der Konstruktion.

Für die nächste Umsetzung:

1. Tatsächliche gemalte Lippen und den registrierten Kieferansatz als geometrische Anschlüsse verwenden.
2. Hintere Höhlenbegrenzung gebogen und unter die Wange legen.
3. Eine dunkle Grundhöhle mit schmaleren Gaumen-/Mundbodenflächen beziehungsweise einer entsprechenden Texturmaske verbinden.
4. Mehrere Querreihen nur dort vorsehen, wo gekrümmte Innenflächen sie benötigen. Eine unveränderte Vollfläche mit mehr Vertices hätte dieselbe gestalterische Grundwirkung.
5. Beim Schließen Überlappungen und Sichtbarkeit sauber behandeln, ohne helle Dreiecke oder flackernde Restflächen.

Der aktuelle Öffnungswert entsteht in `pose()` aus `p.open`, `J1` und dem Ruhezustand. Der Unterkiefer erhält daraus seine Rotation. Die künstlerisch passende Öffnung und die sichtbare Innenform sind gemeinsam für lange, kurze und kombinierte Anatomien abzustimmen; eine pauschale Verkleinerung aller Bisse wäre keine vollständige Korrektur.

## Formen und Varianten

`painted.ts` enthält bereits Referenzanatomien, die Auswahl nach Körperverhältnis und die Überblendung der Körper-/Kiefervarianten. Diese Mechanik ist der Ausgangspunkt. Die nächste Korrektur betrifft die Formprofile, Anschlüsse und sichtbaren Schatten.

Ein passendes Seitenverhältnis zeigt, dass eine Textur wenig gestreckt wird. Daraus folgt keine gestalterische Freigabe der zugrunde liegenden Silhouette. Ebenso prüfen die gemeldeten 232 Tests und die Typprüfung laut Bericht technische Eigenschaften; die Bildwirkung braucht die zusätzliche visuelle Abnahme.

Für neue Formprofile Kopf, Hals, Kiefer und Flossen gemeinsam aus stabilen Bezugspunkten ableiten. Zusätzliche Bilder pro beliebiger Parameterkombination würden die Anschlussprobleme vervielfachen. Zwei gezielte Mischformen dienen zunächst als Belastungsprobe der gemeinsamen Konstruktion.
