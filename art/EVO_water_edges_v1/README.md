# EVO – Wassergrenzen

Zwei neue gemalte Quellen passend zur Devon-Welt: `source/sky.png` (asymmetrisches Wolkenpanorama und ferne Küste) und `source/waterline.png` (transparentes, ruhiges Wellenband). Beide entstanden mit Bildgenerierung. Es gibt keine Bildgenerierung während des Spiels.

`python tools/prepare_water_edges.py` beschneidet und verkleinert die Quellen mit Pillow zu `src/assets/water/sky.webp` und `waterline.webp` (zusammen etwa 150 KB). Das Wellenband wird anhand seiner sichtbaren Alpha-Grenzen beschnitten; einzelne fast transparente Pixel außerhalb der Zeichnung vergrößern die Sprite-Fläche nicht.

`src/art/WaterSurface.ts` verwendet fünf Bildobjekte: Himmelsfarbe, Panorama, Wasserkante und zwei überlagerte Wellenbänder mit verschiedenen Längen und Geschwindigkeiten. Die Wellen heben sich um weniger als zwei Weltpixel. Die langen Bänder werden einmal gespiegelt zwischengespeichert; ihre Enden schließen ohne harte Naht an. Der sichtbare Ausschnitt enthält keinen kurzen Wiederholungsrhythmus. Oberhalb der Wasserlinie deckt der Himmel die Unterwasser-Lichtstrahlen und die ferne Unterwasserkulisse ab.

Außerhalb des Kamerabereichs sind alle fünf Objekte unsichtbar und die Oberflächen-Aktualisierung kehrt sofort zurück. Im Tiefental werden sie gar nicht angelegt. Pro Frame wird keine Leinwand gezeichnet und keine Textur erzeugt. Der Kartenübergang benötigt eine einzelne Bildschirmaufnahme, deren Textur nach der Überblendung wieder freigegeben wird.

`src/level/waterBounds.ts` definiert die sichtbare Himmelshöhe und hält den unteren Tiefenzugang offen. Editor und Hauptspiel teilen diese Regeln; alte Bodendekorationen folgen dem verlängerten Schluchtprofil. Der Laich liegt im geschützten Höhleninneren, gespeicherte Gelege werden dorthin versetzt.

Prüfen:

- `npm test -- --maxWorkers=2`
- `npm run build`
- Vite starten, dann `NODE_PATH=/tmp/evo-browser/node_modules node tools/check_water_edges.cjs` (externes `playwright-core`, Chromium über `CHROMIUM_PATH` wählbar). Erstellt echte WebGL-Aufnahmen und den Bericht in `captures/`: Höhle, Flussoberfläche, schmaler Himmel im Korallengarten, offener Schluchtkanal und Tiefental. Prüft auch beide Reiserichtungen, fehlende PvP-Szenen, konstante Texturzahl und Ausblendung der Oberfläche.

Die Software-WebGL-Prüfung bestätigt den Renderpfad und die Ressourcenfreigabe; sie ersetzt keine Messung auf einem Mobilgerät.
