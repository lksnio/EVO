# Startfisch – Schädelentwicklung v1

Vier eigenständige, transparente Ganzkörperzeichnungen im vorhandenen gemalten EVO-Stil. Die Reihe zeigt die Basis und drei sichtbare Formwechsel der Entwicklungsrichtung **Schädel**.

| Variante | Datei | Gestaltungsmerkmal |
| --- | --- | --- |
| Basis | `masters/startfish_base.png` | Glatte Stirn, kompakter Kopf ohne äußeren Knochenpanzer |
| Schädel > 20 | `masters/startfish_skull_gt20.png` | Erste breite Stirn-, Nasen- und kleine Wangenplatten; viel freie Haut |
| Schädel > 30 | `masters/startfish_skull_gt30.png` | Geschlossener Stirnschild, geschützte Augenhöhle und kräftige Wangenstütze |
| Schädel > 50 | `masters/startfish_skull_gt50.png` | Massiver, überhängender Rammschädel mit breiter Schnauze und hinterem Knochenkragen |

Die Schwellen sind wie beauftragt als **strikt größer als** benannt. Das sind Designbezeichnungen; es wurde keine Spielregel implementiert. Das kleine Gebiss bleibt auf Basisniveau. Die größere Wirkung entsteht durch Knochenstärke, Plattenabdeckung und Kopfsilhouette. Balance, Nachteile und andere Entwicklungsrichtungen sind offen.

## Dateien ansehen

`index.html` direkt im Browser öffnen. Die Vergleichsansicht bietet dunkles Wasser, Schachbrett und einen hellen Hintergrund sowie eine kleine Sprite-Vorschau. Sie verwendet unverändert die vier PNGs.

## Technische Eigenschaften

- Jeweils 1675 × 939 Pixel, RGBA-PNG mit echtem Alphakanal.
- Vollständiger Fisch in neutraler Schwimmhaltung, orthografische Seitenansicht nach rechts.
- Dunkle organische Kontur, schieferblauer/silberner Körper, elfenbeinfarbene Flossen und Knochenplatten.
- Unveränderte Bildgenerator-Originale; keine nachträgliche Skalierung, Beschneidung oder Farbkorrektur.
- Sichtbare Konturen liegen vollständig innerhalb der Leinwand. Einzelne nahezu transparente Restpixel haben Alpha 1/255; die Bounding-Box ab Alpha 16 steht zusätzlich im Manifest.

`manifest.json` enthält Abmessungen, Alpha-Bounding-Boxes, Prüfsummen, Referenzen und die Herkunft der Bilder. `prompts.json` dokumentiert die Generierungsaufträge.

## Spätere Einbindung

Dies sind **gemalte Masterzeichnungen**, noch keine Animationsframes, Ebenendateien oder fertigen Spritesheets. Für die Animation müssen Körper-/Kopfanker und Flossenpositionen aufeinander abgestimmt, passende Zustände gezeichnet und die Exportgröße festgelegt werden. Die Bilder teilen Leinwandgröße und Grundhaltung, sind aber nicht pixelgenau registriert. Die finale Physik und Kollisionsform lassen sich daraus noch nicht ableiten.

Es wurden keine Runtime-Dateien, Imports oder Spielwerte geändert. Die Zeichnungen werden vom Spiel nicht geladen.

Der vorläufige Weltkontext bleibt Devon. Die separat besprochene Folge Wasser → Tiefe/Ufer → Berge/Tiefe/Wasser ist eine spätere Spielentwicklung und wurde hier nicht umgesetzt.
