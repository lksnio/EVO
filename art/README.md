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
Verhalten kommen zusätzlich aus dem Code (Größe wirkt sich auf das Verhalten im Spiel aus). Der
Zeichenstil ist mit den Vorlagen unten festgelegt.

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

### Bewegung: kommt aus den Ebenen, nicht aus weiteren Bildern

Schwimmen, Flossenschlag usw. zeichnest du **nicht** Bild für Bild – das baue ich im Spiel aus den
Ebenen zusammen (so macht es der Code heute schon mit dem gemalten Fisch):

| Bewegung | kommt aus |
|---|---|
| Schwanzschlag, Körperwelle beim Schwimmen | `tail` dreht sich um `gelenk-schwanz`; der Körper wird leicht gebogen |
| Flossenschlag, Schweben | `fin-pectoral`, `fin-pectoral-far`, `fin-pelvic`, `fin-dorsal` drehen sich um ihre Gelenke |
| Biss, Maulaufreißen | `jaw-lower` um `gelenk-kiefer` (wie in den 5 Bildern) |
| Kopfstoß, Ausholen, Zusammenzucken | der Fisch als Ganzes, Kopf neigt sich |
| Atmen, Treiben, Treffer, Tod | leichte Bewegungen, Blinken, Auf-den-Rücken-Drehen |

Damit das sauber aussieht, bitte beim Überarbeiten:

1. **Teile an Gelenken überlappen lassen.** Schwanz und Flossen reichen mit der Wurzel ein Stück *unter*
   den Körper (liegen in der Ebene dahinter) – sonst klafft beim Bewegen eine Lücke. Der Körper sollte
   die Ansätze verdecken.
2. **Gelenke markieren.** Die ausgeblendete Ebene `gelenke` hat je Drehpunkt ein Fadenkreuz
   (`gelenk-schwanz`, `-kiefer`, `-brustflosse`, `-bauchflosse`, `-rueckenflosse`, …). Wenn du Teile
   verschiebst oder neu zeichnest: Ebene einblenden, Fadenkreuz an die neue Stelle setzen, wieder ausblenden.
3. **Jedes bewegliche Teil in eine eigene Ebene** (nicht mit dem Körper verschmelzen).
4. Flossen **ohne den Rumpf-Umriss** zeichnen (sie werden einzeln gedreht).

**Damit sich die Linien später mischen lassen** (z. B. Kopf und Kiefer der Hauptlinie, Schwanz und
Flossen der zweiten), bitte beim Überarbeiten beibehalten: Blickrichtung rechts, Bildgröße 480 × 300,
Schnauzenspitze etwa bei x = 466, Schwanzansatz etwa bei x = 60–75, Kiefergelenk bei x ≈ 340–352 – und die
Ebenennamen.

### Rückgabe

Bearbeitete Dateien bitte unter **gleichem Namen** nach `art/neu/spieler/` legen
(z. B. `art/neu/spieler/panzer_biss.svg`; PNG-Auszug gern dazu). Die Vorlagen in `art/vorlagen/` bleiben
dann als Original stehen. Mehr als 5 Bilder oder andere Größen sind kein Problem – bitte kurz sagen.

Die Vorlagen stammen aus `tools/bite_sheets.py` (`python3 tools/bite_sheets.py` schreibt sie neu).
**Nicht neu erzeugen, wenn du die SVG-Dateien von Hand bearbeitet hast** – das überschreibt sie.

## Die anderen Tiere

Auch die übrigen 18 Arten (`art/alt/tiere/`) sind bisher im Code gemalt und würden neben den neuen
Fischen auffallen. Sie lassen sich **einzeln** ersetzen – was nicht ersetzt ist, bleibt wie bisher.
Vorschlag für das Format: **eine Vorlage je Art wie die Biss-Blätter** (Ebenen für Körper, Schwanz, Flossen
und – bei Räubern – Kiefer), damit die Bewegung wieder aus den Ebenen kommt; bei Räubern zusätzlich
„Maul zu“ und „Maul offen“, weil sie vor dem Biss sichtbar ausholen.

| Gruppe | Arten | Hinweis |
|---|---|---|
| Linien-Verwandte | Dunkleosteus, Bothriolepis (Panzer) · Cladoselache, Cheiracanthus (Jäger) · Eusthenopteron, Hyneria (Fleischflosser) | lassen sich zum großen Teil aus den drei Linien-Vorlagen ableiten (Größe, Farbe, Proportion) – wenig Extra-Arbeit |
| Kleine Beute | Kieferloser Fisch, Sacabambaspis, Birkenia, Cephalaspis, Rolfosteus | einfach: Körper, Schwanz, eine Flosse |
| Wirbellose | Trilobit, Qualle, Orthoceras, Riesenkopffüßer, Seeskorpion, Megalograptus, Pterygotus | eigene Körperform: Fangarme, Scheren, Beine, Ruderplatten als eigene Ebenen |
