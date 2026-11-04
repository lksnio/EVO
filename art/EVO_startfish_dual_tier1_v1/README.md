# Startfisch – drei frühe Mischformen

Drei neue transparente Ganzkörper-Master im vorhandenen gemalten EVO-Stil. Reihenfolge der Zustände und Dateinamen: **Gebiss – Flossen – Kopfplatte** (`g`, `f`, `k`). Beide kombinierten Merkmale sind jeweils auf **Stufe 1**; das dritte bleibt auf Basisniveau.

| Zustand | Datei | Erkennbare Kombination |
| --- | --- | --- |
| **1–1–0** | `masters/startfish_g1_f1_k0.png` | Kurze spitze Raubzähne + breite Steuerflossen und stärker gegabelter Schwanz |
| **0–1–1** | `masters/startfish_g0_f1_k1.png` | Breite Steuerflossen + niedriger Stirnschild, Nasenplatte und kleine Wangenplatte |
| **1–0–1** | `masters/startfish_g1_f0_k1.png` | Kurze spitze Raubzähne + erste Stirn- und Nasenplatten; kompakte Basisflossen |

## Vergleich und Einzelbilder

`index.html` zeigt die drei neuen Zeichnungen mit den jeweils verwendeten Einzelreferenzen. Die Ansicht bietet dunkles Wasser, Schachbrett und einen hellen Hintergrund sowie eine 96-Pixel-Vorschau. `preview.png` ist die feste Vergleichsübersicht.

`masters/` enthält ausschließlich die drei neuen Zeichnungen. `references/` enthält unveränderte Kopien der drei bisherigen Stufe-1-Einzelentwicklungen für die Vergleichsseite. Alle PNGs bleiben in ihrer nativen Auflösung; keine nachträgliche Skalierung oder Rasterbearbeitung.

`manifest.json` dokumentiert native Maße, Alphakanal, Bounding-Boxes, Herkunft und SHA-256-Prüfsummen. Sehr schwache Alpha-Restpixel können außerhalb der sichtbaren Kontur liegen; die Bounding-Box ab Alpha 16 ist deshalb zusätzlich angegeben. `prompts.json` enthält die Aufträge und Referenzen.

## Abgrenzung

Diese drei frühen Mischformen ergänzen den bisherigen Bildsatz. Die sechs Kombinationen mit Stufe 2 aus der letzten Anforderung werden in diesem Schritt **noch nicht gezeichnet**. Das ältere Paket `EVO_startfish_node_v1` bleibt als damaliger Stand unverändert.

Die frühere Benennung der Einzelbilder mit >20, >30 und >50 ist historisch. Laut neuer Vorgabe sind die vorgesehenen Generationssprünge **20 → 25 (Stufe 1), 50 → 60 (Stufe 2), 100 → 125 (Stufe 3)**. Hier werden nur die vorhandenen visuellen Stufen kombiniert, keine Werte oder Regeln implementiert. Der neue Regelkontext steht in `DESIGN_CONTEXT.md`.

Gemalte Ganzkörper-Master in neutraler Seitenansicht nach rechts, noch keine Animationsframes, Ebenendateien oder pixelgenau registrierten Austausch-Sprites. Anker, Gelenke, Kieferbewegungen und Exportgrößen bleiben für die spätere Integration abzustimmen.

Es wurden keine Runtime-Dateien, Spielwerte, Regeln oder Imports geändert. Das Spiel lädt diese Bilder noch nicht.
