# Bilder für die Chronik des Lebens

Dateiname = Kennung der Art, z. B. `dipterus.webp`, `pteraspis.png` oder `dunkleosteus.png` (Kennungen in `src/data/species.ts`, Reihenfolge in `src/data/aquapendium.ts`).

- PNG, WebP oder JPG; ein transparentes Tierporträt oder eine vollständig gemalte Lebensraumszene.
- Etwa 1024 × 820 Pixel passen gut zum Bildrahmen. Das Seitenverhältnis bleibt erhalten und das ganze Motiv wird gezeigt.
- Eigene Bilder werden erst nach der Entdeckung des Tieres geladen. Vorher bleibt dessen freigestellter Spielumriss sichtbar, auch bei einer deckenden Landschaftsillustration.
- Fehlt eine Datei, zeigt die Seite das bisherige Spielporträt.
- Neue Dateien werden beim nächsten Bauen automatisch eingebunden. Keine zusätzliche Liste erforderlich.

Der erste illustrierte Eintrag ist `Dipterus valenciennesi`, Seite 1 im Devon. Quelle, Bildprompt und Rekonstruktionshinweise: `art/EVO_wiki_dipterus_v1/`. Das Original bleibt dort erhalten; `python tools/prepare_wiki_dipterus.py` erzeugt die optimierte Laufzeitdatei reproduzierbar.
