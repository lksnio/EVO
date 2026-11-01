# Prüfumfang dieses Pakets

- 20 neue Original-PNGs vorhanden und lesbar, alle RGBA mit tatsächlich transparenten Pixeln.
- Alpha-Grenzen bei 128 gemessen und Dateigrößen im Manifest festgehalten.
- Inhalt und Ausrichtung der erzeugten Bilder visuell geprüft; Schwanzform, Fangzahn, Schwertschnauze und schwerer Kiefer unterscheiden die Arten.
- PNG-Prüfsummen für die unveränderten Originale dokumentiert.
- `tools/inspect_assets.py` prüft die Dateien reproduzierbar, ohne sie zu verändern.
- Die HTML-Vorschau zeigt die Dateien aus dem Paket; Größen beziehen sich auf die gemalte Alpha-Silhouette.

Noch offen für den Einbau: finale Registrierung, Körper-/Maulmasken, neutrale Montage, Rig-Bewegung, Licht-/Sichtdarstellung, Gameplay-Regressionen und Laufzeit-/GPU-Messung. Es wurde kein Spielcode verändert und keine Projekt-Testsuite ausgeführt. Die Ansatzpunkte sind bewusst nur Hinweise.
