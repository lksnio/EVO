# Startfisch – sechs Mischformen mit Stufe 2 + Stufe 1

Sechs neue transparente Ganzkörper-Master im vorhandenen gemalten EVO-Stil. Zustände und Dateinamen verwenden **Gebiss – Flossen – Kopfplatte** (`g`, `f`, `k`). Ein Merkmal liegt auf Stufe 2, eines auf Stufe 1; das dritte bleibt auf Basisniveau.

| Zustand | Datei | Kombination |
| --- | --- | --- |
| **1–2–0** | `masters/startfish_g1_f2_k0.png` | Lange Steuerflossen und zwei Rückenflossen + kurze Raubzähne |
| **0–2–1** | `masters/startfish_g0_f2_k1.png` | Flossensystem der zweiten Stufe + erste Stirn- und Nasenplatten |
| **2–1–0** | `masters/startfish_g2_f1_k0.png` | Kräftiges Fanggebiss mit tiefem Unterkiefer + breite Steuerflossen |
| **2–0–1** | `masters/startfish_g2_f0_k1.png` | Kräftiges Fanggebiss + erste Stirn- und Nasenplatten |
| **1–0–2** | `masters/startfish_g1_f0_k2.png` | Geschlossener Schädelpanzer mit Wangenstütze + kurze Raubzähne |
| **0–1–2** | `masters/startfish_g0_f1_k2.png` | Schädelpanzer der zweiten Stufe + breite Steuerflossen |

Damit liegen zusammen mit den bisherigen Paketen 24 Ausbauvarianten und der gemeinsame Basisfisch vor. Dieses Paket enthält nur die sechs neuen Master und sechs unverändert kopierte Einzelreferenzen für die Vergleichsseite.

## Dateien

`index.html` zeigt die sechs neuen Formen samt ihren jeweiligen Stufe-2- und Stufe-1-Vorlagen. Hintergrundwechsel und eine 96-Pixel-Vorschau erleichtern den Vergleich. `preview.png` ist die feste Übersicht. Die neuen PNGs liegen unter `masters/`, die Einzelreferenzen unter `references/`.

Native Auflösungen und originale PNG-Daten bleiben erhalten. `manifest.json` dokumentiert Maße, Alphakanal, sichtbare Bounding-Boxes, Herkunft und SHA-256-Prüfsummen; `prompts.json` dokumentiert die Generierung. Nahezu transparente Restpixel können außerhalb der sichtbaren Silhouette liegen; deshalb ist zusätzlich die Bounding-Box ab Alpha 16 angegeben.

Die visuellen Stufen entsprechen dem aktuellen Plan mit Generationssprüngen 20 → 25, 50 → 60 und 100 → 125. Alte Referenzdateien tragen noch ihre historischen >20/>30/>50-Bezeichnungen.

## Verwendung

Gemalte Master in neutraler Seitenansicht nach rechts, noch keine Animationen, Ebenendateien oder pixelgenau registrierten Austausch-Sprites. Die Zeichnungen werden vom Spiel noch nicht geladen. Anker, Gelenke, Bewegungszustände und Exportgrößen müssen für die spätere Integration abgestimmt werden.

Die separat vorgenommene Gameplay-Änderung betrifft die Ausdauer des Startfischs, nicht den Bildimport. Sie verwendet feste Kosten von ½ Anfangsausdauer je Biss und ⅓ je Rammstoß. Die Reserve wächst zwischen Flossenwerten 10, 25, 60 und 125 linear auf 1, 1½, 2 und 3⅓ Anfangsreserven. Ohne Regeneration sind damit 2/3, 3/4, 4/6 und 6/10 Bisse/Stöße möglich. Neue Generationsregeln und aufgeladene Bisse sind damit noch nicht implementiert.
