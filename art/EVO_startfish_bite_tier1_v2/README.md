# Gebiss 1: kräftiger Kiefer und ruhige Fischbewegung

Überarbeitet ist die reine erste Gebissform `g1_f0_k0`: kantigerer und tieferer Unterkiefer, kräftigere Schnauze und vier deutlich lesbare kurze Zähne. Der Kopf bleibt ungepanzert. Körper, Flossen, Farbwelt und rundes Auge orientieren sich an der bisherigen Zeichnung. Die höheren Stufen behalten ihre größeren Fangzähne. Die übrigen gemalten Formen wurden nicht neu gezeichnet.

Der Master liegt in `source/g1_f0_k0.png`, die Spieltextur in `src/assets/fish/starter/g1_f0_k0.webp`. `src/art/fish/starterRegistration.json` enthält die neue Mundkurve, das Kiefergelenk und vier Zahnmasken; eine Kopie dieser Registrierung liegt hier unter `registration.json`. Die ursprünglichen Trefferflächen und die Bissreichweite sind separat erhalten, damit die geänderte Kieferzeichnung die Kampfwerte nicht verändert. Das vorhandene `tools/starter_fish_assets.py` erzeugt die WebPs aus den registrierten Quellen erneut.

## Bewegung

Die gemeinsame Animation aller 48 Startfischformen liegt in `src/art/fish/starterMotion.ts` und `starterRig.ts`:

- Kopf und Rumpf behalten ihre Form. Neigung und Bissvorstoß bewegen den Körper gemeinsam.
- Die Schwanzflosse dreht sich als zusammenhängende Form; nur der schmale hintere Ansatz biegt sich zum Rumpf hin.
- Flossen arbeiten mit kleinen Ausschlägen an den Spitzen. Ihre Gewichte werden einmal aus der ursprünglichen Zeichnung gelesen. Ausdauerfarbe und Schuppentönung verändern diese Zuordnung nicht.
- Das Kiefergelenk und die Lider folgen der festen Kopfhaltung. Das Maulinnere endet innerhalb der gemalten Lippen.
- Die C-Übersicht verwendet die ruhige Haltung mit Tempo 0. Schwanz und Flossen bewegen sich weiter.

## Spielaufnahmen und Prüfung

- [Vier Gebissstufen im Renderer](captures/gebiss-stufen.png)
- [Neue Stufe 1 mit geöffnetem Maul](captures/gebiss-1-geoeffnet.png)
- [C-Übersicht](captures/c-ansicht.png)
- [Kurze Bewegungsaufnahme der C-Übersicht](captures/c-bewegung.webm)
- [Browser-Prüfbericht](captures/browser-check.json)

Die Browserprüfung läuft mit Chromium/Software-WebGL. Sie kontrolliert alle 48 Formen, konstante Rumpflängen, bewegte Flossen und Schwänze, befestigte Lider, endliche Netzpunkte und konstante Texturzahlen nach dem Aufbau. Anschließend wird im Spiel geschwommen und die C-Übersicht über ihre echte Tasteneingabe geöffnet. Dort werden Haltung und Bewegung über 50 Bilder gemessen. Die Geometrietests prüfen zusätzlich unveränderte Rumpfproportionen, eine ungestreckte Schwanzflosse, das Kiefergelenk und die erhaltene Bissreichweite.

Mit laufendem Vite und optional installiertem `playwright-core`:

```sh
NODE_PATH=/tmp/evo-browser/node_modules EVO_BASE_URL=http://127.0.0.1:8080 node tools/check_starter_motion.cjs
```

`EVO_RECORD_VIDEO=1` erstellt außerdem das WebM; dafür benötigt Playwright seinen FFmpeg-Encoder und das System `ffmpeg` für den kurzen Ausschnitt. Die Aufnahme zeigt die laufende Spielanimation und keine nachträglich animierte Zeichnung.
