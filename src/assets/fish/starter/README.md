# Startfisch: 48 Formen aus 25 Gemälden

Die 25 WebPs stammen aus den PNG-Mastern unter `art/EVO_startfish_*`. Sie sind auf 768 Pixel Breite komprimiert und behalten ihren Alphakanal. `python tools/starter_fish_assets.py` erzeugt diese 25 Dateien erneut (ffmpeg erforderlich).

`src/sim/starterFish.ts` enthält 48 erreichbare Zustände für Gebiss–Flossen–Kopfplatte. Die ersten 25 Kennungen bleiben stabil. Nur eines der beiden Schadensmerkmale kann über Stufe 1 hinausgehen; das andere bleibt nach seinem ersten Sprung bei 25. Flossen entwickeln sich unabhängig bei 20/50/100, maximal 100 Punkte. Deshalb gibt es zwölf Schadenskombinationen × vier Flossenstufen.

Für die 23 zusätzlichen Kombinationen setzt `StarterFishRig` die vorhandenen gemalten Hinterkörper/Flossen und Köpfe im Renderer zusammen. Es sind keine 23 neuen Gemälde. Die registrierten Augen, Kiefergelenke und Zahnkonturen bleiben erhalten. Im WebGL-Rig bleiben Kopf und Rumpf formstabil; Schwanzansatz und Flossen bewegen sich gezielt. Canvas zeigt dieselben Formen mit vereinfachter Bewegung.

Die reine erste Gebissform `g1_f0_k0` verwendet die [überarbeitete Zeichnung](../../../../art/EVO_startfish_bite_tier1_v2/README.md) mit stärkerer Kieferkontur und deutlicheren Zähnen. Die alte gemalte Fassung bleibt als Designhistorie erhalten. Bissreichweite und Trefferflächen sind durch diese Zeichnungsänderung unverändert.

Lebenskraft skaliert die Größe mit der Kubikwurzel. Ausdauer färbt die Flossen zunehmend türkis; Schuppen dunkeln den Körper Richtung Schwarz ab. Diese Varianten teilen sich die gemalten Quellen und erzeugen nur die tatsächlich verwendeten Farbtexturen.

Zur Kontrolle: `?debug&gallery=starter&cols=6` zeigt alle 48 Formen. `forms=0,3,47&cols=3&zoom=3&hold=1` zeigt große Formen mit geöffnetem Maul. `left`, `pitch`, `bite`, `speed` und `lift` erlauben weitere Posen.
