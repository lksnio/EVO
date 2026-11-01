# Einzelbauteile für den Weltbaukasten

Am 1. November 2026 mit dem Bildgenerierungstool anhand von `art/EVO_reef_direction_v1/source/reef.png` erzeugt. Auftrag: acht getrennte, transparente Einzelteile im selben gemalten Devon-Stil, ohne angebaute Felsfüße an den Pflanzen. Vier Spalten / zwei Reihen: hoher Bandtang, anderer Blattfächer, Astschwamm, Röhrenschwämme, runder Einzelstein, hoher Einzelstein, niedrige Felsplatte und kleine Triebe.

`source.png` bleibt die Originalvorlage. `python3 tools/prepare_editor_units.py` schneidet die acht getrennten Bauteile zu und kodiert die WebP-Laufzeitdateien mit erhaltenem Alpha. Die Pflanzen lassen sich mit beliebigen Steinen oder direkt mit dem Spielboden kombinieren.
