# Grafiken – wie du eigene Bilder einbaust

Bisher hat EVO **keine Bilddateien**: Alle Grafiken werden beim Start im Code gezeichnet
(`src/art/*.ts`, Canvas). Damit du sie durch eigene Bilder ersetzen kannst, habe ich den **Ist-Stand
als PNG** hier abgelegt – genau so, wie das Spiel ihn gerade benutzt.

## Ordner

```
art/
├── alt/    ← Ist-Stand (Referenz, bitte nicht verändern)
└── neu/    ← hier legst du deine Bilder ab
```

- `art/neu/` hat dieselben Unterordner wie `art/alt/`.
- **Gleicher Unterordner + gleicher Dateiname = Ersatz.** Liegt `art/neu/tiere/dunkleosteus_0.png`,
  ersetzt es `art/alt/tiere/dunkleosteus_0.png`. Was in `neu` fehlt, bleibt wie bisher (aus dem Code).
- Du kannst also Stück für Stück ersetzen – das Spiel läuft jederzeit.
- Den Einbau (Laden der Bilder im Spiel) übernehme ich, sobald die ersten Dateien in `neu` liegen.

## Größen

Die Dateien in `alt/` haben die **Spielgröße** (so groß werden sie im Spiel gezeichnet, vor dem
Herauszoomen auf 72 %). Für eigene Bilder gilt:

- **Gleiches Seitenverhältnis, beliebig größer.** Ich skaliere auf die Spielgröße herunter. Empfohlen:
  **4× oder 8×** der Spielgröße (z. B. Kieferloser 48×24 → 192×96 oder 384×192), dann bleibt es scharf.
- PNG mit **transparentem Hintergrund**, Tiere und Fische **von der Seite, Blick nach rechts**.
- Nichts abschneiden: Das Bild sollte genau um das Tier herum beschnitten sein (wie in `alt/`).

## Was liegt wo (`art/alt/`)

| Ordner | Inhalt | Dateien |
|---|---|---|
| `tiere/` | die 18 Arten der Welt, je 2 Schwimmphasen (`_0`, `_1`) | 36 |
| `spieler/` | dein Tier (und Artgenossen), in **Einzelteilen**; 7 Beispiel-Zustände | 42 + Übersicht |
| `pflanzen/` | Algen (Nahrung, 4 Wachstumsstufen) und Dickicht (Versteck) | 15 |
| `dekor/` | Gestein, Muscheln, Knochen, Seegras, Algen, Korallen, Schwämme, Anemonen, Seefächer, Kelp | 10 |
| `boden/` | Boden-Kachel, Grasnarbe, Felsplatten, Kiesel/Einsprengsel | 13 |
| `hintergrund/` | Ferne, Mittelgrund, Nebel (je normal/dunkel) | 6 |
| `hoehle/` | Höhlenschatten und -hintergrund | 9 |
| `gefahren/` | Seeigel | 3 |
| `nahrung/` | Fleischstücke (klein/mittel/groß) | 3 |
| `licht/` | Lichtstrahlen, Wasseroberfläche, Dunkelheit der Tiefe, Vignetten, Glühen | 14 |
| `partikel/` | Blasen, Blut, Krümel, Schatten, Augenglanz | 11 |
| `tafel/` | Steintafel (C), Fisch-Wertung, Muschel | 4 |
| `karte/` | Kartensymbole der Ortsarten, Wellenmuster | 6 |
| `ui/` | Symbole der Schaltflächen, Titelbild, Sockel | 13 |

`alt/_ungenutzt/` enthält Reste aus den entfernten Land-Zeitaltern (Farne, Baumstümpfe, Schnee …) –
in der Demo kommen sie nicht vor, die musst du nicht zeichnen.

Hinweis: Dateien in `licht/`, `partikel/`, `hintergrund/` und `boden/` sind größtenteils Verläufe und
Kacheln, die der Code über- und nebeneinanderlegt. Die wichtigsten für bessere Optik sind
`tiere/`, `spieler/`, `pflanzen/`, `dekor/`, `boden/` und `hintergrund/`.

### `tiere/` – Spielgröße

| Datei | Art | Größe (px) |
|---|---|---|
| `birkenia_0.png`, `birkenia_1.png` | Birkenia | 37×16 |
| `bothriolepis_0.png`, `bothriolepis_1.png` | Bothriolepis | 67×36 |
| `cameroceras_0.png`, `cameroceras_1.png` | Riesenkopffüßer (Cameroceras) | 285×83 |
| `cephalaspis_0.png`, `cephalaspis_1.png` | Cephalaspis | 63×22 |
| `cheiracanthus_0.png`, `cheiracanthus_1.png` | Cheiracanthus | 49×26 |
| `cladoselache_0.png`, `cladoselache_1.png` | Cladoselache | 143×51 |
| `dunkleosteus_0.png`, `dunkleosteus_1.png` | Dunkleosteus | 322×154 |
| `eusthenopteron_0.png`, `eusthenopteron_1.png` | Eusthenopteron | 196×74 |
| `hyneria_0.png`, `hyneria_1.png` | Hyneria | 261×101 |
| `kieferlos_0.png`, `kieferlos_1.png` | Kieferloser Fisch | 48×24 |
| `megalograptus_0.png`, `megalograptus_1.png` | Megalograptus | 152×53 |
| `orthoceras_0.png`, `orthoceras_1.png` | Orthoceras | 92×31 |
| `pterygotus_0.png`, `pterygotus_1.png` | Pterygotus | 317×94 |
| `qualle_0.png`, `qualle_1.png` | Qualle | 64×68 |
| `rolfosteus_0.png`, `rolfosteus_1.png` | Rolfosteus | 177×44 |
| `sacabambaspis_0.png`, `sacabambaspis_1.png` | Sacabambaspis | 54×25 |
| `seeskorpion_0.png`, `seeskorpion_1.png` | Seeskorpion | 116×40 |
| `trilobit_0.png`, `trilobit_1.png` | Trilobit | 47×23 |
| `acanthodes_0.png`, `acanthodes_1.png` | Acanthodes | 51×18 |
| `arandaspis_0.png`, `arandaspis_1.png` | Arandaspis | 57×22 |
| `astraspis_0.png`, `astraspis_1.png` | Astraspis | 44×29 |
| `cheirolepis_0.png`, `cheirolepis_1.png` | Cheirolepis | 82×26 |
| `climatius_0.png`, `climatius_1.png` | Climatius | 49×28 |
| `coccosteus_0.png`, `coccosteus_1.png` | Coccosteus | 78×32 |
| `conodont_0.png`, `conodont_1.png` | Conodont | 68×15 |
| `dalmanites_0.png`, `dalmanites_1.png` | Dalmanites | 55×26 |
| `dipterus_0.png`, `dipterus_1.png` | Dipterus | 64×28 |
| `drepanaspis_0.png`, `drepanaspis_1.png` | Drepanaspis | 54×22 |
| `entelognathus_0.png`, `entelognathus_1.png` | Entelognathus | 87×32 |
| `eriptychius_0.png`, `eriptychius_1.png` | Eriptychius | 65×26 |
| `holoptychius_0.png`, `holoptychius_1.png` | Holoptychius | 163×65 |
| `isotelus_0.png`, `isotelus_1.png` | Isotelus | 71×30 |
| `jamoytius_0.png`, `jamoytius_1.png` | Jamoytius | 77×17 |
| `lasanius_0.png`, `lasanius_1.png` | Lasanius | 43×26 |
| `moythomasia_0.png`, `moythomasia_1.png` | Moythomasia | 37×17 |
| `osteolepis_0.png`, `osteolepis_1.png` | Osteolepis | 77×33 |
| `pteraspis_0.png`, `pteraspis_1.png` | Pteraspis | 59×25 |
| `pterichthyodes_0.png`, `pterichthyodes_1.png` | Pterichthyodes | 47×28 |
| `stethacanthus_0.png`, `stethacanthus_1.png` | Stethacanthus | 113×38 |
| `thelodus_0.png`, `thelodus_1.png` | Thelodus | 37×18 |
| `tiktaalik_0.png`, `tiktaalik_1.png` | Tiktaalik | 234×76 |

Die beiden Phasen `_0` / `_1` wechseln beim Schwimmen (ca. 6× pro Sekunde); sie dürfen fast gleich
sein – z. B. Schwanz und Flossen leicht verschoben. Fürs Spiegeln nach links ist gesorgt.

### `spieler/` – dein Tier

Hier gibt es bisher **keine festen Formen**, sondern Teile, die je nach Anlagen (Gebiss, Schädel,
Tarnung …) im Code neu gezeichnet werden. Jeder Ordner ist ein Beispiel-Zustand:
`neu` (Urfisch), `kiefer`, `kiefer-stark`, `schaedel`, `schaedel-stark`, `tarnung`, `tarnung-stark`.
Teile: `body` (Rumpf mit Rückenflosse), `head` (Kopf mit Maul-Innenraum), `jaw` (Unterkiefer, schwingt beim
Biss), `teeth` (Zähne), `tail` (Schwanzflosse), `fin` (Brust-/Bauchflosse).
`spieler/_uebersicht_fisch.png` zeigt alle sieben zusammengesetzt.

## Entwicklungslinien (festgelegt)

Der Spieler wählt seine Form **nicht** mehr aus – sie entsteht aus dem, wie er überlebt. Es gibt drei
Linien, an echten Fischgruppen orientiert:

| Linie | Vorbild | Überlebensart |
|---|---|---|
| **Panzer** | Placodermen (Dunkleosteus, Bothriolepis) | Kopfschild, Rammen, kräftiger Biss, wenig Tempo |
| **Jäger** | Stachelhaie / frühe Haie (Cheiracanthus, Cladoselache) | schlank, schnell, jagt viele kleine Bisse |
| **Fleischflosser** | Eusthenopteron & Verwandte | Stielflossen, zäh, Weg ans Land |

Jedes der drei Zeitalter gibt **einen Punkt** an die Linie, die zu seinem Spielstil passt. Daraus
ergeben sich zehn Grundkombinationen: **3-0-0** (rein, 3 Möglichkeiten), **2-1-0** (Hauptlinie mit einem
Schuss einer zweiten, 6 Möglichkeiten) und **1-1-1** (von allem etwas). Größe, Farbe, Muster und
Verhalten kommen zusätzlich aus dem Code (Größe wirkt sich auf das Verhalten im Spiel aus). **Jede
Kombination bekommt ihre eigenen, fertig gezeichneten Animationen** – es wird nichts aus Teilen
verschiedener Linien zusammengesetzt und im Spiel nichts gedreht. Der Zeichenstil ist mit den Vorlagen
unten festgelegt.

> Stand im Spiel: Die Linien sind eingebaut (ein Punkt je Zeitalter nach Spielstil, keine Auswahl). Bis deine Bilder da
> sind, wird jede der zehn Kombinationen aus dem Code gezeichnet (Körperform, Farbe, Flossen).

## Biss-Vorlagen (`art/vorlagen/`)

Je Linie ein Sprite-Sheet mit **5 Bildern** nebeneinander – Maul **geschlossen → ganz offen**
(Kiefer 0° / 14° / 28° / 42° / 56°). Jedes Bild ist 480 × 300 groß, Blick nach rechts.

| Datei | Inhalt |
|---|---|
| `panzer_biss.svg` / `.png` | Panzerlinie – das Kopfschild klappt beim Aufreißen leicht nach oben |
| `jaeger_biss.svg` / `.png` | Jägerlinie – schlank, Querbinden, zwei Rückenflossen mit Stachel |
| `fleischflosser_biss.svg` / `.png` | Fleischflosser – Schuppen, Stielflossen, lange Reißzähne |
| `_uebersicht.png` | alle drei untereinander (nur zum Anschauen) |

Die **SVG** sind die Vorlage zum Bearbeiten (Inkscape, Illustrator, Affinity …); die `.png` sind
transparente Auszüge in doppelter Größe (4800 × 600, je Bild 960 × 600) zum Ansehen oder Weitermalen.

Aufbau im SVG – alles in benannten Ebenen, je Bild (`bild1-…` bis `bild5-…`), von hinten nach vorn:
`tail`, `fin-dorsal`, `fin-pelvic`, `fin-pectoral-far` (Flosse der abgewandten Seite), `mouth-interior`,
`jaw-lower` (mit `teeth-lower`), `body`, `head` (mit `teeth-upper` und `eye`), `fin-pectoral`, dazu zwei
**ausgeblendete** Ebenen: `hilfslinien` (Bildraster) und `gelenke` (Drehpunkte, siehe unten).
Der Unterkiefer dreht sich um das **Kiefergelenk** (steht im `transform` der Ebene `jaw-lower`: bei Panzer
und Jäger bei x = 340, y = 168, beim Fleischflosser bei x = 352, y = 170).

### Bewegung: ganze Bilder, keine Drehung

Alle Bewegungen (Schwimmen, Tauchen, Fressen, Zucken …) werden **Bild für Bild als Sprite-Sheet**
gezeichnet – das Spiel spielt sie nur ab. Die Ebenen und Gelenke in diesen SVG-Vorlagen sind darum
nur noch eine **Zeichenhilfe**. Ein Muster mit allen nötigen Bewegungen liegt in `art/vorlagen/tiere/`
(siehe unten).

### Rückgabe

Bearbeitete Dateien bitte unter **gleichem Namen** nach `art/neu/spieler/` legen
(z. B. `art/neu/spieler/panzer_biss.svg`; PNG-Auszug gern dazu). Die Vorlagen in `art/vorlagen/` bleiben
dann als Original stehen. Mehr als 5 Bilder oder andere Größen sind kein Problem – bitte kurz sagen.

Die Vorlagen stammen aus `tools/bite_sheets.py` (`python3 tools/bite_sheets.py` schreibt sie neu).
**Nicht neu erzeugen, wenn du die SVG-Dateien von Hand bearbeitet hast** – das überschreibt sie.

## Bewegungs-Sprite-Sheet (Muster: Cladoselache)

Zum Ausprobieren der ganzen Kette (Zeichnen → Zurücklegen → Einbau) mit einem **gleichbleibenden Gegner**
liegt in `art/vorlagen/tiere/` ein vollständiges Sheet für den *Cladoselache* (Räuber, kann also alles):

| Datei | Zweck |
|---|---|
| `cladoselache_sheet.png` | **transparent**, 3584 × 2880 – darüber oder danach malen |
| `cladoselache_sheet_raster.png` | mit Raster, Mittenkreuz und Beschriftung (halbe Größe) – nur zur Orientierung |
| `cladoselache_sheet.svg` | dasselbe als bearbeitbares SVG (Ebenen je Bild) |
| `cladoselache_sheet.json` | Raster, Reihen, Bilderzahl, Zeiten – **das liest später das Spiel** |

**Aufbau:** Jede **Reihe ist eine Bewegung**, jedes **Bild eine fertige Pose** (links nach rechts abspielen).
Zelle 448 × 360, Blick nach rechts, die Körpermitte liegt im Zellmittelpunkt (Kreuz im Raster).

| Reihe | Bilder | Wann im Spiel | Zeit je Bild |
|---|---|---|---|
| `schwimmen` | 8 | normales Umherschwimmen (Schleife) | 100 ms |
| `schnell` | 6 | Flucht, Jagd, Anlauf (Schleife) | 70 ms |
| `tauchen` | 6 | schwimmt nach unten, Kopf ca. 26° geneigt (Schleife) | 100 ms |
| `steigen` | 6 | schwimmt nach oben, Kopf ca. 26° geneigt (Schleife) | 100 ms |
| `ruhen` | 6 | Ruhen, Lauern, Dösen (Schleife) | 160 ms |
| `fressen` | 6 | Pflanzen und Fleischstücke fressen (Schleife) | 110 ms |
| `beissen` | 8 | Angriff: Ausholen (1–3), Vorstoß (4–5), Zubeißen (6), Erholen (7–8) | 140/140/120/70/70/90/120/140 ms |
| `zucken` | 4 | Treffer: zusammenzucken, Auge zukneifen, fangen | 60/80/100/120 ms |

Zusammen 50 Bilder. Das Wenden bleibt vorerst beim Spiegeln des Bildes.

**Zeichnen & Zurücklegen:**

- Die Posen in der Vorlage sind nur Anhaltspunkte (Körperwelle, Flossen, Kiefer) – gern frei neu zeichnen.
- **Anordnung beibehalten** (Reihenfolge der Reihen, Bilder je Reihe, Körpermitte im Zellmittelpunkt). Das Bild
  darf gleichmäßig größer sein (z. B. 2× oder 4× der Zellgröße), nicht anders angeordnet.
- Nichts über den Zellrand hinaus – die Vorlage lässt mindestens 11 px Rand.
- Fertige Datei als **`art/neu/tiere/cladoselache_sheet.png`** ablegen (gern zusätzlich das SVG). Weitere Reihen
  oder andere Bilderzahlen sind kein Problem – bitte die Änderung im JSON mitschreiben oder kurz sagen.
- Hinweis zum Aufwand: Kleine Beute braucht weniger – `schwimmen`, `schnell`, `ruhen/fressen`, `zucken`, auch
  mit je 4–6 Bildern; `beissen`, `tauchen`, `steigen` nur für Räuber und große Tiere.

Das Sheet stammt aus `tools/fish_sheet.py`. **Nicht neu erzeugen, wenn du die Dateien bearbeitet hast** – das überschreibt sie.

## Die anderen Tiere

Auch die übrigen Arten (`art/alt/tiere/`) sind bisher im Code gemalt und würden neben den neuen Fischen
auffallen. Sie lassen sich **einzeln** ersetzen – was nicht ersetzt ist, bleibt wie bisher. Jede Art bekommt
ein Sheet wie oben (mit den Reihen, die sie braucht).

| Gruppe | Arten | Hinweis |
|---|---|---|
| Fische (Räuber) | Cladoselache (Muster), Rolfosteus, Eusthenopteron, Hyneria, Dunkleosteus | alle Reihen |
| Kleine Beute | Kieferloser Fisch, Sacabambaspis, Birkenia, Cephalaspis, Cheiracanthus | schwimmen, schnell, ruhen/fressen, zucken |
| Gepanzert, langsam | Bothriolepis | wie Räuber, aber ohne Sprint |
| Wirbellose | Trilobit, Qualle, Orthoceras, Riesenkopffüßer, Seeskorpion, Megalograptus, Pterygotus | eigene Reihen je Körperform (Fangarme, Scheren, Beine) |
