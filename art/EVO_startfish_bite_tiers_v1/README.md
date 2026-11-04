# Startfisch – Gebissentwicklung v1

Drei neue transparente Ganzkörperzeichnungen für die Entwicklungsrichtung **Gebiss**. Derselbe Basisfisch aus der Schädelreihe liegt unverändert zum Vergleich bei.

| Variante | Datei | Gestaltungsmerkmal |
| --- | --- | --- |
| Basis, unverändert übernommen | `masters/startfish_base.png` | Kompakte Schnauze, kleines Gebiss |
| Gebiss > 20 | `masters/startfish_bite_gt20.png` | Deutliche Reihe kurzer spitzer Zähne und kräftigere Kieferkante |
| Gebiss > 30 | `masters/startfish_bite_gt30.png` | Tieferer Unterkiefer und ineinandergreifende spitze Zähne mit größeren vorderen Fangzähnen |
| Gebiss > 50 | `masters/startfish_bite_gt50.png` | Massiver Unterkiefer, breite Schnauze und große gegeneinandergreifende Fangzähne |

Die Stirn bleibt glatt und ungepanzert. Diese Reihe verändert Kiefer und Zähne; die Schädelpanzer der separaten Entwicklungsrichtung wurden nicht übernommen. Körper, Flossen, Farbpalette und rundes Auge orientieren sich an derselben Basis. Die Darstellung zeigt eine ruhige Schwimmhaltung mit sichtbarer Bezahnung, keinen Angriffsframe.

## Ansehen und verwenden

`index.html` ist eine lokale Vergleichsansicht mit Hintergrundwechsel und 96-Pixel-Vorschau. `preview.png` zeigt die vier Varianten auf dunklem Wasser. Alle Einzelbilder liegen unter `masters/`.

- Native Größe: 1674–1675 × 939 Pixel je Master, RGBA-PNG mit echtem Alphakanal.
- Vollständiger Fisch in Seitenansicht nach rechts.
- Unveränderte Bildgenerator-Originale; keine nachträgliche Skalierung oder Rasterbearbeitung.
- Sichtbare Konturen vollständig innerhalb der Leinwand. Fast unsichtbare Alpha-Restpixel können außerhalb der Silhouette vorkommen; die Bounding-Box ab Alpha 16 ist im Manifest dokumentiert.
- `manifest.json` enthält Maße, Alpha-Bounding-Boxes, Herkunft und SHA-256-Prüfsummen. `prompts.json` dokumentiert die Generierung und die Überarbeitung der mittleren Zahnreihe.

Die Schwellen sind wie bei der Schädelreihe als **strikt größer als 20, 30 und 50** beschriftet. Es wurde keine Schwellenlogik oder Balance implementiert; das sind vorläufige Designbezeichnungen.

Dies sind gemalte Masterzeichnungen für spätere Animationen. Keine Ebenendateien, Animationsframes oder pixelgenau registrierten Austausch-Sprites. Für die Einbindung müssen Anker, Kiefergelenk, Bewegungszustände und Exportgrößen noch abgestimmt werden. Kombinierte Schädel-/Gebissformen sind noch nicht gezeichnet.

Es wurden keine Runtime-Dateien, Imports oder Spielwerte geändert. Das Spiel lädt diese Assets noch nicht.
