# Startfisch – Flossenentwicklung v1

Drei neue transparente Ganzkörperzeichnungen für die Entwicklungsrichtung **Flossen**, ergänzt um den unveränderten Basisfisch aus den vorherigen Reihen.

| Variante | Datei | Gestaltungsmerkmal |
| --- | --- | --- |
| Basis, unverändert übernommen | `masters/startfish_base.png` | Ursprüngliche kompakte Flossenform |
| Flossen > 20 | `masters/startfish_fins_gt20.png` | Kräftigere Steuerflossen und stärker gegabelte Schwanzflosse |
| Flossen > 30 | `masters/startfish_fins_gt30.png` | Lange Brustflossen und ein zusätzlicher Rückenstabilisator |
| Flossen > 50 | `masters/startfish_fins_gt50.png` | Große Sichelflossen und zusätzliche kleine Leitflösschen vor dem Schwanz |

Die Formen behalten den schieferblauen Körper, die glatte Stirn, das kleine Basisgebiss und das charakteristische runde Auge. Die hellen Flossen haben dieselben gemalten Membranen und dunklen organischen Konturen wie die Basis. Die Bilder zeigen eine neutrale Schwimmhaltung in Seitenansicht nach rechts.

## Dateien ansehen

`index.html` ist eine lokale Vergleichsansicht mit Hintergrundwechsel und einer 96-Pixel-Vorschau. `preview.png` zeigt alle Varianten auf dunklem Wasser. Die transparenten Einzelbilder liegen unter `masters/`.

Die PNGs bleiben in ihrer nativen Auflösung und sind unveränderte Bildgenerator-Originale. Maße, Alphakanal, Bounding-Boxes und SHA-256-Prüfsummen stehen in `manifest.json`; `prompts.json` dokumentiert die Generierungsaufträge. Sehr schwache Alpha-Restpixel können außerhalb der sichtbaren Silhouette vorkommen; das Manifest enthält deshalb zusätzlich die Bounding-Box ab Alpha 16.

## Spätere Einbindung

Die drei Schwellen sind wie bei den bisherigen Reihen als **strikt größer als 20, 30 und 50** beschriftet. Das sind Designbezeichnungen ohne implementierte Schwellenlogik. Verhalten, Bewegungsvorteile, Balance und Nachteile sind noch offen.

Dies sind gemalte Masterzeichnungen, keine fertigen Animationsframes, Ebenendateien oder pixelgenau registrierten Austausch-Sprites. Durch die größeren Flossensilhouetten kann sich die Rahmung gegenüber dem Basisfisch unterscheiden. Für die Animation müssen Körperanker, Flossengelenke, Bewegungszustände und Exportgröße noch abgestimmt werden. Kombinierte Schädel-, Gebiss- und Flossenformen wurden noch nicht gezeichnet.

Es wurden keine Runtime-Dateien, Imports oder Spielwerte geändert. Das Spiel lädt diese Assets noch nicht.
