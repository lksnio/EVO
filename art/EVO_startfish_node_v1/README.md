# Startfisch – vollständiger erster Knoten v1

Der Satz enthält **15 Ausbauvarianten und den gemeinsamen Basisfisch**: neun unverändert übernommene Einzelentwicklungen und sechs neu gezeichnete Mischformen. Alle Master liegen gemeinsam in `masters/`.

## Zustände

Dateinamen verwenden `g` = Gebiss, `f` = Flossen und `k` = Kopfplatte. Beispiel: `startfish_g3_f1_k0.png` bedeutet Gebiss 3, Flossen 1, Kopfplatte 0.

| Schwerpunkt | Reine Stufen | Neue Mischformen |
| --- | --- | --- |
| Gebiss | 1–0–0, 2–0–0, 3–0–0 | **3–1–0, 3–0–1** |
| Flossen | 0–1–0, 0–2–0, 0–3–0 | **1–3–0, 0–3–1** |
| Kopfplatte | 0–0–1, 0–0–2, 0–0–3 | **1–0–3, 0–1–3** |

Der Basisfisch ist 0–0–0. Eine Mischform hat genau ein Merkmal auf Stufe 3 und ein anderes auf Stufe 1. Zustände wie 2–1–0, 2–2–0 oder 3–1–1 gehören nicht zu diesem Bildsatz. Die reinen Stufen 1, 2 und 3 entsprechen den bisherigen Bildbezeichnungen >20, >30 und >50; die endgültige Schwellenlogik bleibt offen.

## Sechs neue Zeichnungen

- **3–1–0:** Großer Raubkiefer und Fangzähne + kräftigere Steuerflossen.
- **3–0–1:** Großer Raubkiefer und Fangzähne + erste Stirn- und Nasenplatten.
- **1–3–0:** Maximale Sichelflossen und Leitflösschen + kurze spitze Raubzähne.
- **0–3–1:** Maximale Sichelflossen und Leitflösschen + erste Stirn- und Nasenplatten.
- **1–0–3:** Massiver Schädelpanzer und Knochenkragen + kurze spitze Raubzähne.
- **0–1–3:** Massiver Schädelpanzer und Knochenkragen + kräftigere Steuerflossen.

Jede Mischform wurde als zusammenhängendes Ganzkörperbild aus zwei gezeichneten Referenzen neu erzeugt. Das starke Hauptmerkmal und das kleinere Nebenmerkmal bleiben visuell getrennt erkennbar. Die Bilder sind keine ausgeschnittenen oder übereinandergelegten Rasterteile.

## Vergleich und Dateien

`index.html` öffnet zunächst die sechs neuen Mischformen. Unter jedem großen Bild stehen die beiden verwendeten Einzelentwicklungen zum direkten Vergleich. Ein Filter zeigt auf Wunsch alle 16 Zustände einschließlich Basis. Außerdem gibt es einen Hintergrundwechsel und eine 96-Pixel-Ansicht.

`preview_mixed.png` zeigt die sechs neuen Kombinationen; `preview_all.png` zeigt den vollständigen Knoten. Die Einzelbilder liegen als transparente RGBA-PNGs in `masters/`. Ihre nativen Maße, Alpha-Bounding-Boxes, SHA-256-Prüfsummen und Herkunft stehen in `manifest.json`. Die neun früheren Varianten und der Basisfisch wurden unverändert kopiert. Die Bildgenerator-Originale bleiben ebenfalls unverändert; keine nachträgliche Skalierung oder Rasterbearbeitung.

`prompts.json` enthält die sechs neuen Aufträge und ihre Referenzen. `generation_history/` bewahrt die bisherigen Aufträge der drei Einzelreihen auf. Nahezu transparente Restpixel können außerhalb der sichtbaren Kontur liegen; das Manifest enthält zusätzlich die Bounding-Box ab Alpha 16.

## Spätere Einbindung

Dies sind gemalte Masterzeichnungen in neutraler Seitenansicht nach rechts, noch keine Animationen, Ebenendateien oder pixelgenau registrierten Austausch-Sprites. Für die Verwendung im Spiel sind Anker, Flossengelenke, Kieferbewegungen, weitere Zustände und Exportgrößen noch abzustimmen. Das spätere Mapping zum nächsten Knoten ist nicht umgesetzt.

Es wurden keine Runtime-Dateien, Imports, Spielwerte oder Regeln geändert. Das Spiel lädt diese Assets noch nicht.
