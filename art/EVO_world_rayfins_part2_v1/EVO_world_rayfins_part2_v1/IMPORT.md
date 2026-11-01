# Registrierung und Einbau

## 1. Dateiverwendung

| Ordner | Zweck |
| --- | --- |
| `masters/` | Vollständige gemalte Neutralpose pro Art. Gestalterische Vorlage und mögliche Porträtquelle; Auge, Kiemen und Flossen sind hier eingebrannt. |
| `rig_bodies/` | Kopf, Rumpf, Schwanzstiel und Schwanzflosse als durchgehende Oberfläche. Für den beweglichen Aufbau. |
| `special_parts/` | Vier neue Teile mit artspezifischen Formen. |
| `import/` | Gemessene Bilddaten, Artzuordnung, ungefähre Ansatzpunkte, Quellstand und Erzeugungsprompts. |

Verwende beim Rig-Aufbau keine vollständige Neutralpose unter zusätzlich aufgesetzten Augen und Flossen. Das würde doppelte Konturen und sichtbare Kopien erzeugen. Aus `masters/` darf für eine getrennte Porträtfassung oder einen bewusst als solchen bezeichneten statischen Fallback gerendert werden.

Die Körperflächen sind als gemalte Oberflächen zu verstehen. Sie wurden neu erzeugt; ihre Leinwände und Formen decken sich nicht pixelgenau mit den vollständigen Bildern oder den Spielerfisch-Vorlagen. Die Mundkerbe ist nicht in allen Dateien vollständig ausgespart. Vor dem Cache-Upload deshalb einen **artspezifischen Körperpfad** als Alphamaske verwenden: obere Maulkante bleibt am Schädel, bewegliches Kinn und Unterlippe werden aus dem Körper entfernt. Große schwarze Abschlusskanten am Gelenk vermeiden. Die Körpermaske darf keine neue Linie durch den Hals zeichnen.

## 2. Standardteile wiederverwenden

Der geprüfte Quellstand lädt sie in `src/art/fish/painted.ts` über `FILES` aus:

- `src/assets/fish/painted/eye.webp`
- `src/assets/fish/painted/dorsal.webp`
- `src/assets/fish/painted/anal.webp`
- `src/assets/fish/painted/pelvic.webp`
- `src/assets/fish/painted/pectoral.webp`
- `src/assets/fish/painted/jaw.webp` und `jaw_lang.webp`
- optional `overlay.webp` und `mouth.webp`

Nutze das kurze Kieferbild bei kleinen Schwarmfischen, den langen Satz bei Cheirolepis, Enchodus und Protosphyraena, den neuen schweren Kiefer bei Xiphactinus. Gillicus braucht eine kurze schräg stehende Maulspalte. Passe Formen mit sauberen Konturmasken bzw. dem Flossennetz an; bloßes extremes Strecken eines Blattbildes genügt bei den Sonderteilen nicht.

Der Kiemendeckel ist optional als bewegliche Ebene. Eine leise Kiemenspalte genügt bei kleinen NPCs. Vermeide einen hell umrandeten C-Bogen, der Kopf und Rumpf optisch trennt. Dünne Flossenwurzeln sitzen unter dem Körper bzw. Kiemendeckel. Die ferne Brustflosse darf getönt hinter dem Körper liegen.

## 3. Koordinaten

`assets.json` enthält für jede Originaldatei:

- echte PNG-Breite und -Höhe, RGBA-Modus;
- `paintedBounds128 = [x0,y0,x1,y1)`, gemessen bei Alpha >= 128;
- SHA-256 und Anteil vollständig transparenter Pixel.

Die Bildgrößen variieren. Es gibt keine gemeinsame feste 1712x960-Leinwand und keine kompatible vorgegebene UV-Belegung. Vereinzelt liegt sehr schwaches Alpha außerhalb der eigentlichen Zeichnung; dadurch ist Alpha > 0 keine gute Crop-Grenze. Für eine erste Laufzeitfassung die gemessenen Grenzen plus ca. acht Quellpixel Sicherheitsrand verwenden, dabei den Alphakanal und die vollständige Silhouette erhalten.

`species_profiles.json` enthält `anchorHints.points` in **Pixeln der ursprünglichen Körperdatei**. Das sind künstlerisch gewählte Näherungen für Auge, Gelenk, Flossenwurzel und Schwanzstiel. Sie sind kein gemessenes physikalisches Skelett und kein fertiger Rig-Import. Gerade Augen und Gelenke müssen in einer neutralen Montage nachjustiert werden.

Bei Crop `(cx,cy)` und Verkleinerung mit Faktoren `(sx,sy)` gilt für jeden Ursprungspunkt `(px,py)`:

```
runtimePx = (px - cx) * sx
runtimePy = (py - cy) * sy
```

Wende denselben Schritt auf Quell-UVs und Ansatzpunkte an. Verwende möglichst einheitliche Skalierung; eine unsymmetrische Skalierung auf die alte Spielerfisch-Box würde die neuen Artformen wieder verzerren. Das lokale Fischkoordinatensystem entsteht aus der gewählten neutralen Anatomie, nicht aus der Mitte des transparenten PNG-Rahmens.

Für die Sonderteile stehen die Ansatz-Hinweise in `special_part_hints.json`: u/v beziehen sich auf die gemessenen Alpha-Grenzen des jeweiligen Teils. Beim Gillicus ist die lange Ansatzkante oben. Die Protosphyraena-Brustflosse reicht vom Ansatz oben rechts zur Spitze unten links. Beim Xiphactinus liegt das Gelenk links. Der Enchodus-Fangzahn wächst aus dem oberen Gaumen und gehört zum ruhigen Kopfteil.

## 4. Rig und bisherige Spielobjekte

Der geprüfte Code hat zwei verschiedene Wege:

- Spieler: `src/art/fish/rig.ts` nutzt `FishAnatomy`, `FishTex`, `solveSpine` und getrennte Teile.
- Welt: `src/art/speciesArt.ts` erzeugt bisher `sp_<id>_0/1` und bei Räubern zusätzliche Kieferphasen. `Animal.ts` nutzt diese Texturen als Arcade-Sprite.

Deshalb sind die neuen Bilder allein noch kein Wechsel auf das Rig. Füge eine Art-Anatomieschicht hinzu, die feste `SpeciesDef.art`-Profile auf die gemeinsam benutzten Pose-/Spine-Funktionen abbildet. Falls der Rig-Konstruktor noch zu eng an `Morph` hängt, trenne diesen Eingang sinnvoll ab. Verändere dabei die vorhandenen Evolutionsformeln des Spielers nicht.

Ein praktikabler Aufbau lässt das bisherige Arcade-Objekt als Logik-/Physikträger bestehen und koppelt eine separate Rig-Ansicht daran. Dann müssen Position, Richtung, Winkel, Skalierung, Alpha, Trefferblinken/Tint, Tiefenordnung, Sichtbarkeit und Zerstörung zuverlässig weitergereicht werden. Vermeide sichtbare alte und neue Tiere übereinander. Vermeide verwaiste Netze nach Tod oder Szenenwechsel.

Besondere Anschlussstellen:

- Im Konstruktor von `Animal.ts` hängen Physikgröße und Offset von `this.width` und `this.height` der bisherigen Textur sowie `def.hit` ab. Diese Geometrie ausdrücklich erhalten. Neue hochaufgelöste PNG-Abmessungen dürfen die Physik nicht vergrößern.
- `showJaw`, `jawOf`, `JAWS`, die Zusatzhöhe `e` und die Angriffsphasen hängen an den alten Kieferbildern. Bewahre die bisherigen spielerischen Bissflächen und Zeitpunkte. Die neue Kieferrotation liefert die Ansicht; die Kunst definiert keine neue Schadensreichweite.
- Bei Protosphyraena ist die sichtbare Schnauzenspitze nicht automatisch ein neuer Bisspunkt.
- `makeSpeciesPortrait`, Übersicht und Chronik dürfen weiter mit einer eigenen statischen gemalten Fassung arbeiten. Der Renderer-Wechsel muss nicht alle Ansichten in lebende Rig-Objekte verwandeln.
- Die fünf Kreide-Arten müssen testbar sein, ohne den noch nicht spielbaren Abschnitt freizuschalten.
- Der bisherige Renderer bleibt als nachvollziehbarer Fallback für nicht unterstützte Arten und den bestehenden Canvas-Pfad verfügbar. Zwei Fallback-Schwimmphasen können aus festen Rig-Posen abgeleitet werden, soweit die vorhandene Infrastruktur das unterstützt; sie sind in diesem Paket nicht als fertige Dateien enthalten.

## 5. Form, Licht und Bewegung

Erhalte die Form des neutralen Bildes. Verwende bei Bedarf mehr Spalten im Schwanzbereich; verlängere den Kopf nicht durch einen neuen Sinusbogen. Der Kopf bleibt vergleichsweise ruhig, die Schwanzwelle nimmt nach hinten zu. Die schon vorhandene Begrenzung gegen innere Netzfalten gilt auch für NPC-Profile. Starre Schwertschnauze und Fangzahn bekommen keine Schwanzwelle.

Die Vorlagen tragen bereits Artfarben und breite Helligkeitsmassen. Kleine Schwarmfische brauchen keine zusätzlichen feinen Muster. Falls `stripes` als Spielmerkmal erhalten wird, höchstens einen sehr weichen, breiten Akzent ergänzen. Gegenüber dem Spieler bleiben die NPCs gestalterisch ruhiger. Nicht sämtliche alten prozeduralen Schuppen und dunklen Linien noch einmal über die gemalten Flanken legen.

Der Alphakanal ist maßgeblich. Vollständig transparente Pixel dürfen von Schwarz abweichende RGB-Werte enthalten; das ist kein sichtbarer Hintergrund. Beim Erzeugen einer Laufzeitfassung Alpha korrekt erhalten und im üblichen Phaser-Pfad hochladen. Tests auf hellem und türkisfarbenem Hintergrund decken dunkle Fransen schneller auf als eine schwarze Werkstattwand.

Die Vorschau dieses Pakets bildet keine tatsächliche Spielbeleuchtung ab. Prüfe Lesbarkeit nach Sicht- und Tiefenabdunklung im laufenden Spiel. Füge nicht pauschal ein Leuchten an alle Tiere an. Erhalte Pflanzen-/Felsenverdeckung und die bestehende Lichtstimmung.

## 6. Abnahme

- Neutrale Montage passt zur Artvorlage; keine doppelten Augen, Kinnkanten oder harten Flossenansätze.
- Bewegung, Richtungswechsel und Biss bleiben geschlossen; keine inneren Netzfalten oder gestreckten Halslinien.
- Bilder bei tatsächlichen gemalten Breiten 45/70/90 px; zusätzlich die wirklichen Größendifferenzen aus `SpeciesDef` zeigen.
- Enchodus-Fangzahn bleibt am Oberkiefer, Protosphyraena-Schnauze bleibt steif, Xiphactinus hat Substanz im Kiefer, Gillicus behält sein kleines Maul.
- Trefferfläche, Zielwahl, Verfolgung, Schaden, Angriffstiming, Verdeckung und Despawn verhalten sich wie vorher.
- Cache einmal pro Art/Palette; keine neue hochaufgelöste Textur pro Tier oder Frame.
- Bestehende Tests/Typprüfung und gezielte Transformations-/Adapterprüfungen laufen. Identische Szenen bei 18 und 40 Tieren vergleichen; Renderer, Auflösung und Hardware nennen.

Dieses Paket liefert die Zeichnungen, Artprofile und den Importauftrag. Es enthält keine im Spiel validierte Implementierung.
