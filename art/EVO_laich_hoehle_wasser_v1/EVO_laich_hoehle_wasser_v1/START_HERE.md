# Laichplatz, Höhle und Wasser – EVO

## Direkt nutzbare Zeichnungen

- `assets/laichplatz_komplett.png`: fertiger gemalter Laichhaufen auf einem Stein-/Algenbett.
- `assets/hoehle_komplett.png`: fertige gemalte Höhle mit dunklem Innenraum.

Beide Zeichnungen sind transparente PNGs. Sie brauchen keine Spritesheet-Animation. Richte sie am vorhandenen Boden und an der bisherigen Interaktionsstelle aus; die transparenten Ränder zählen nicht zur gemalten Breite.

## Optionale getrennte Teile

- `laich_nest_leer.png` + `laich_ei_einzeln.png`: Eier separat setzen, falls Anzahl, Verlust und Schlüpfen sichtbar werden sollen. Das komplette Laichbild enthält eine feste gemalte Zahl und darf deshalb nicht als genauer Zähler dienen.
- `hoehle_hintergrund.png` + `hoehle_vordergrund.png`: Rückwand hinter dem Fisch, Felsrahmen davor. Die Öffnung des Rahmens ist wirklich transparent.

Die Varianten sind jeweils Alternativen zum vollständigen Bild. Bei der Höhle beide Ebenen in einem gemeinsamen Koordinatenrahmen ausrichten. Die Einzelbilder haben geringfügig andere Leinwandbreiten; `import/assets.json` dokumentiert Maße und den gemeinsamen Rahmen.

## Wasseridee

`reference/wasser_stimmungsreferenz.png` ist eine gemalte atmosphärische Bearbeitung des mitgeschickten Screenshots. Sie zeigt eine mögliche Kombination aus Lichtstrahlen, Lichtmustern auf dem Boden, Wassertrübung und Schwebeteilchen. Sie ist eine Stilreferenz, keine transparente Effekttextur und keine maßhaltige Montage der neuen Requisiten. Die alten Requisiten aus dem Screenshot bleiben darin sichtbar.

Die konkrete gestalterische und technische Richtung steht in `WASSER_ARTDIRECTION.md`.

## An Claude übergeben

Den ganzen Ordner unter `art/EVO_laich_hoehle_wasser_v1/` ins Projekt legen und `CLAUDE_ASSET_EINBAU.md` als Auftrag geben. Die Originale bleiben erhalten; daraus können passende Laufzeitfassungen entstehen.

`VORSCHAU.html` öffnet die neuen Dateien lokal im Browser. Sie zeigt auch die Höhlenebenen übereinander und den Wasserentwurf. Die Bildgenerierungsprompts und die gemessenen Alpha-Grenzen liegen unter `import/`.

Stand: Zeichnungen erstellt, RGBA und transparente Öffnung geprüft. Der Einbau, die Kollisionsprüfung und die laufende Spielbeleuchtung sind noch nicht getestet. Hier wurde kein Spielcode geändert oder gepusht.
