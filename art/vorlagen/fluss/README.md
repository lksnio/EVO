# Laichplatz, Höhle und Wasser

Aufnahmen aus Chromium mit Software-WebGL, keine Asset-Montagen:

- [Werkstatt](aufnahmen/werkstatt.png): Laich bei 80/110/140 Bildschirm-Pixeln, verschiedene Eierstände und Höhlenrahmen mit Fischen.
- [Höhle vorher](aufnahmen/hoehle_vorher.png) / [nachher](aufnahmen/hoehle_nachher.png): identischer Weltort und Zoom.
- [Laich und Wasser vorher](aufnahmen/laich_wasser_vorher.png) / [nachher](aufnahmen/laich_wasser_nachher.png): bestehender Laichplatz neben der Muschel bei Spielzoom 0,72.
- [Browser-Prüfbericht](aufnahmen/browser-check.json).

`npm run build` und 290 Tests in 30 Dateien bestanden. Die Browserprüfung kontrolliert Eierverlust, Ende des Nahrungsvorrats, Schlüpfen, konstante Trefferfläche, Höhlenanmeldung/-abmeldung mit einem simulierten Netzwerkpartner, gemeinsame Ebenenregistrierung, Mehrfachinstanzen, Textur-Caches und Szenenwechsel. Gelände, Dachkollisionen und Höhlentrigger sind im direkten Vergleich identisch. Die automatisierte Anmeldung ersetzt keinen manuellen Spielabend mit zwei echten Browsern.

Wasserlicht verwendet statische Geometriemasken über schmalen Oberflächen und acht einmal erzeugte Musterbilder. Kein Lichtnetz über dem offenen Wasser, dem dunklen Geländeschnitt oder der Höhlenrückwand. Die Partikel verteilen sich auf drei Tiefenebenen; bestehende Strömungsfelder beeinflussen ihre Bewegung. Neue feine Brechungs-Shader wurden nicht ergänzt.

Der Prüfbericht enthält CPU-Zeiten für Render-Aufrufe bei gleicher Auflösung (1440×900) und Tierzahl (18), jeweils zwölf Bilder unter Software-WebGL. Gemessen wird die CPU-Übermittlung, keine vollständige GPU-Laufzeit; die Werte sind keine Bildratenzusage für reale Grafikkarten. Der zusätzliche Wasserpfad kostet mehr Renderarbeit; Bilder und Masken bleiben gecacht. Für den direkten Vergleich dienen `?oldprops&oldwater`.

Alle Original-PNGs bleiben im Assetpaket. `tools/river_assets.py` prüft ihre SHA-256-Werte und normalisiert die vollständigen Höhlen-Leinwände gemeinsam. Die Rückwand wird nicht unabhängig auf ihren gemalten Inhalt zugeschnitten.
