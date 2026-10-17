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

## Feste Evolutionslinien (Vorschlag – noch nicht umgesetzt)

Mit eigenen Bildern wird das Tier nicht mehr stufenlos aus Anlagen gezeichnet, sondern es gibt
**feste Formen**, die am Ende eines Zeitalters zur Wahl stehen. Vorschlag für die Fischzeit
(an echten Linien orientiert):

```
Ordovizium            Silur                          Devon
                 ┌─ Panzerlinie ───────────┬─ Beißer-Panzer (Dunkleosteus-artig)
Urfisch ─────────┤  (Kopfschild, Rammen)   └─ Tank (Bothriolepis-artig)
(kieferlos)      ├─ Stachelhai-Linie ──────┬─ Jäger (Cladoselache-artig)
                 │  (flink, jagt)          └─ Schleicher (Rolfosteus-artig, Tarnung)
                 └─ Fleischflosser-Linie ──┬─ Räuber (Eusthenopteron-artig)
                    (Stielflossen)         └─ Landgänger-Vorstufe (Tiktaalik-artig)
```

= **1 + 3 + 6 = 10 Formen.** Jede Form bräuchte:

- `form.png` – Ruhe/Schwimmen, Blick nach rechts
- `form_2.png` – zweite Schwimmphase (optional, sonst biege ich das Bild beim Schwimmen selbst)
- `form_biss.png` – Maul offen (optional; sonst nur Kopfstoß mit Wackeln)

Farbe und Kleinigkeiten (Narben, Tarnmuster) kommen später aus dem Code über das Bild.
