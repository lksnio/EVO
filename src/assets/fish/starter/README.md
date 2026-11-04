# Startfisch: 25 Laufzeitformen

Die WebPs stammen unverändert im Design aus den 25 PNG-Mastern unter `art/EVO_startfish_*`. Sie sind für die Laufzeit auf 768 Pixel Breite komprimiert und behalten ihren Alphakanal. Die Originale bleiben erhalten.

`python tools/starter_fish_assets.py` erzeugt die Dateien erneut (benötigt ffmpeg). Quellen und Bezugspunkte stehen in `src/art/fish/starterRegistration.json`. Dateinamen verwenden Gebiss–Flossen–Kopfplatte: `g1_f2_k0`.

Die stabile Reihenfolge für Speicherstände und Koop steht in `src/sim/starterFish.ts`. Sie darf nicht umsortiert werden. Alle 25 Kombinationen sind erreichbar; genau ein frühes Nebenmerkmal darf Stufe 1 erreichen, nur das erste Primärmerkmal steigt weiter. Die Grenzwerte 20/50/100 führen beim nächsten Kind mit positivem Zugewinn auf 25/60/125. Die Form ändert sich beim Generationswechsel.

`StarterFishRig` verwendet die vollständigen gezeichneten Silhouetten. Körper und Flossen folgen einem Netz, der Unterkiefer hat ein eigenes Gelenk, obere und untere Zähne bleiben am zugehörigen Kiefer. Die Lider folgen dem Auge beim Schwimmen, Rammen und Beißen. Canvas zeigt dieselben Bilder mit einer vereinfachten Bewegung.

Zur Kontrolle: `?debug&gallery=starter` zeigt alle 25 Formen im tatsächlichen Renderer. `forms=0,3,9&cols=3&zoom=3&hold=1` zeigt wenige große Formen mit geöffnetem Maul; `left`, `pitch`, `bite`, `speed` und `lift` erlauben weitere Posen.
