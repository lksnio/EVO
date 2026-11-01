# Devon-Rigs: echte Browseraufnahmen

Die PNGs stammen aus dem laufenden WebGL-Renderer (Chromium mit Software-WebGL), nicht aus den Asset-Vorschautafeln.

- `gruppen.png`: Strahlenflosser, Haie, Lappenflosser, Panzerfische, Bosse und eigene Wirbellosen-Rigs.
- `devon_weitere.png`: weitere Devon-Profile, Kieferlose und Trilobiten.
- `biss.png`: geöffnete Mäuler und Scheren.
- `kopfpanzer.png`: ohne, mittel, maximal sowie Kombinationen mit Gebiss und Körperbau.
- `kopfpanzer_biss.png`: maximaler Panzer bei geöffnetem Maul.
- `klein_45px.png`, `klein_70px.png`, `klein_90px.png`: Größenproben auf türkisem Hintergrund.
- `spiel.png`: tatsächliches Devon-Level mit Sichtschleier, HUD und Verdeckung. Das Prüfsystem beendet für die Standaufnahme die Kamera-Einblendung, ohne die Sichtberechnung oder Tierfarben zu verändern.

Validierung: `npm run build` erfolgreich; 275 Tests in 29 Dateien bestanden. Die zusätzlichen Anatomietests prüfen alle Devon-Fischprofile, registrierte Maulwinkel und den starren Vorderkörper unter extremen Posen. `tools/check_fauna.cjs` vergleicht alte und neue Physik-/Bissgeometrie für sieben repräsentative Arten, prüft Alpha, Rotation, Spiegelung, Tint und Aufräumen sowie einen Netzwerk-Stellvertreter. Im geprüften echten Level: 18 von 18 erzeugten Tieren mit Rig, keine Browserfehler. Größen- und Panzer-Bissaufnahmen separat mit `--sizes` geprüft.

Der Browserlauf prüft Funktion und Montage, keine belastbare GPU-Leistungsmessung. Chronik-Porträts, Beute-Icons und der Canvas-Rückfall verwenden weiterhin den bisherigen statischen Zeichenweg. Neue Originalmalereien wurden für die Gruppen nach den Strahlenflossern nicht erzeugt: Sie verwenden die gemeinsame gemalte Oberfläche und eigene Anatomien beziehungsweise prozedurale Gelenkteile.
