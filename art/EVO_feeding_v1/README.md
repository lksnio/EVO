# Direktes Fressen und beweglichere Schwimmer

Ein eigener Biss, der die **volle** Lebenskraft der Beute überwindet, schluckt
sie direkt für **+1 Nahrung**. Es entstehen keine Fleischstücke. Die Rechnung
nutzt den wirksamen Schaden einschließlich Hinterhalt, Schwung und geschwächten
Gegnern, nicht eine feste Liste kleiner Arten. Die Regel gilt auch bei einer
stärkeren eigenen Linie; Verdauungsboni erhöhen diesen Happen nicht. Ein bloßer
letzter Treffer auf einen großen verwundeten Gegner erzeugt weiterhin Fleisch.
Siege, vererbbares Kampftraining, Beutestatistik und Fossilfunde bleiben erhalten.

Fleischstücke werden mit einem Biss alle ganz aufgenommen, soweit sie die echte
Bissfläche überlappen. Jedes Stück zeigt seinen Wert; nahe Zahlen werden versetzt.
Die Stücke weiter weg bleiben liegen. Eine erlegte Art zählt weiterhin einmal
für die Beutestatistik, unabhängig von ihrer Stückzahl.

Räuber und größere Schwimmer wechseln schon beim normalen Schwimmen weich ihr
Tempo, mit unterschiedlichen Phasen je Tier. Sie ziehen häufig schneller vorbei
und stoppen seltener an Wegpunkten. Beim sichtbaren Ausholen schwimmen sie flott
seitlich zum Ziel, mit Prüfung auf Wasseroberfläche, Kartenrand und Felsen.
Nach dem Vorstoß gleiten sie weiter. Die Angriffswarnung, das eigentliche
Zuschnappen und erschöpfungsbedingte Ruhe bleiben bestehen. Die Tempokurve
benötigt nur zwei Sinuswerte je aktiver Schwimmbewegung, keine neue Wegsuche.

Im Koop vergibt nur eine Bestätigung des Ortswächters den direkten Happen an
den betreffenden Gast. Der Server prüft Absender, Tierkennung und Empfänger
und verhindert doppelte Meldungen. Die Tierart kommt aus dem Serverbestand.

## Prüfung

- `npm test -- --maxWorkers=2`: 328 Tests in 35 Dateien, einschließlich echtem
  Colyseus-Server, voller Lebenskraft als Schwelle und glattem Tempowechsel.
- `npm run build`: TypeScript sowie Client- und Server-Build.
- Vite auf Port 8080, dann `node tools/check_feeding.cjs` (Chromium und
  `playwright-core`; eigene Testablage `feedcheck`).

Der Browser prüft echte Tiere und Bissflächen: direktes +1 ohne Fleisch,
verwundete große Beute mit Fleisch, zwei gleichzeitige +8 bei Verdauungsfaktor
1,6, ein unberührtes entferntes Stück, einmalige Beutestatistik, direkte Beute
bei stärkerem Gebiss sowie Tempowechsel und seitliches Ausholen ohne vorzeitigen
Schaden. [Messwerte](captures/browser-check.json) · [Zwei Happen](captures/zwei-happen.png).
