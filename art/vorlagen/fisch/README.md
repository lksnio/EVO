# Vorlagen für die gemalte Zeichnung des Spielerfisches

Alles hier ist **aus der tatsächlichen Implementierung exportiert** (`src/art/fish/export.ts`, Werkzeug: im Browser
`__evo.fishTemplates(morph, name, pxPerUnit)`; der Lauf, der diese Dateien erzeugt hat, steht unten). Die Zeichnung und alle
Hilfslinien sind **getrennte Dateien**; in den Zeichnungen ist nichts eingebrannt.

## Ordner

| Ordner | Form (Evolutionswerte) | Zweck |
|---|---|---|
| `neutral/` | ungeänderter Ausgangsfisch (Linie 1, Männchen/Weibchen ohne Merkmal) | **die Hauptvorlage – diese Zeichnung wird gebraucht** |
| `kopfpanzer_max/` | `skull 1`, `spike −1` | Referenzform: größter Kopfpanzer |
| `starkes_gebiss/` | `jaw 1`, `diet 1`, `toothTier 9` | Referenzform: größtes Maul |
| `kurz_massig/` | `len −1`, `girth 1` | Referenzform: kürzester, höchster Körper |
| `lang_schlank/` | `len 1`, `girth −1`, `swift 1` | Referenzform: längster, schlankster Körper |

Die vier Referenzformen sind **keine Zeichenaufträge**, sondern zeigen, wie weit sich die neutrale Zeichnung dehnen muss
(und wo das nicht mehr reicht, siehe „Verformung und Varianten“).

## Dateien je Ordner (Beispiel `neutral/`)

Maßstab: **16 Bildpunkte je g-Einheit** (`pxPerUnit`, einstellbar). Blickrichtung **nach rechts** (Schnauze rechts). Hintergrund **transparent**
(Alpha); jedes Bild hat mindestens 4 Einheiten (64 px) leeren Rand rund um die Zeichnung (Zusammensetzung) bzw. den Umfang des Teils.

| Datei | Inhalt |
|---|---|
| `fisch_neutral.png` | der ganze Fisch in der neutralen Ausgangspose, alle Teile an ihrem Platz in der Zeichenreihenfolge (**1712 × 960 px**, Umfang x −59 … 48, y −33 … 27) |
| `hilfslinien_netz.png` | **getrennt**: Netzgrenzen und UV-Rahmen aller Teile (gelb Körper 16 × 3, orange Kiemendeckel, blau Rücken-/After-/Bauchflosse, grün Brustflosse, rosa Unterkiefer, weiß Auge), gleiche Größe wie `fisch_neutral.png` |
| `hilfslinien_ansatzpunkte.png` | **getrennt**: Auge, Kiefergelenk, Maulspitze, Unterkiefer-Spitze, Flossenansätze mit Flossenachse, Schwanzstiel-Ende, Schwanzflossen-Rahmen, Drehpunkt und Halszone der Verformung, Wirbelsäule (y = 0) – mit Koordinaten beschriftet |
| `vorschau_mit_hilfslinien.png` | nur zur Ansicht: Zeichnung + beide Hilfslinien übereinander (nicht zum Malen) |
| `teil_<name>.png` | **Einzelvorlage** je Teil, genau in der Größe, in der das Rig sie auf das Netz legt |
| `raster_<name>.png` | **getrennt**: Raster alle 5 Einheiten mit Beschriftung; rotes Kreuz = Ursprung des Teils; roter Rahmen = Bildrand |
| `manifest.json` | alle Koordinaten, Teilgrößen, Ursprünge, Netze, Maße der Anatomie (maschinenlesbar) |

## Koordinaten

* **g-Einheit** = Zeicheneinheit des Fisches. Der Fisch hat die Größe `size` (Normalfisch = 1): im Spiel wird alles mit `size` multipliziert.
* **Fischkoordinaten:** Ursprung in der **Körpermitte** (auf der Wirbelsäule, y = 0), +x zur Schnauze, +y nach unten.
* **Pixel einer Datei:** `px = (x − box.x0) · 16`, `py = (y − box.y0) · 16`; der Ursprung des Teils liegt bei `originPx`.
* **UV:** `u = (x − box.x0)/(box.x1 − box.x0)`, `v` entsprechend von oben nach unten (das Netz spiegelt `v` beim Zeichnen, das ist im Rig erledigt).

### Die Teile (neutral; alle Zahlen stehen im `manifest.json`)

| Teil | Datei | Größe px | Ursprung im Bild (px) | Ursprung sitzt im Fisch bei (x \| y) | Netz | Hinweis |
|---|---|---|---|---|---|---|
| Körper mit Kopf, Schwanzstiel, Schwanzflosse, **oberen Zähnen** | `teil_body.png` | 1575 × 648 | 880 \| 351 | 0 \| 0 | **16 × 3** | ohne Auge und ohne Kiemendeckel-Überlagerung |
| Unterkiefer (mit **unteren Zähnen**) | `teil_jaw.png` | 295 × 233 | 64 \| 80 | **Kiefergelenk** 28,8 \| 3,0 | – (Bild dreht sich) | Länge 10,4, Tiefe 6,6; Oberkante = Maulspalte |
| Auge | `teil_eye.png` | 149 × 149 | 74 \| 74 | **Augenmitte** 27,8 \| −4,4 | – | Augapfel-Radius 3,1 |
| Kiemendeckel (liegt über der Brustflosse) | `teil_overlay.png` | 352 × 389 | −118 \| 164 | 0 \| 0 (Bild liegt bei x 7,4 … 29,4, y −10,2 … 14,1) | 5 × 3 | folgt dem Körper |
| Rückenflosse (hinter dem Körper) | `teil_dorsal.png` | 500 × 336 | 250 \| 272 | **Ansatz** −6,0 \| −11,2 | 4 × 2 | Ansatz steckt 2–4 Einheiten unter der Haut |
| Afterflosse (hinter dem Körper) | `teil_anal.png` | 279 × 288 | 139 \| 64 | Ansatz −16,2 \| 8,4 | 4 × 2 | |
| Bauchflosse (hinter dem Körper) | `teil_pelvic.png` | 208 × 208 | 104 \| 64 | Ansatz 0 \| 11,2 | 4 × 2 | klein |
| Brustflosse nah (vor dem Körper) | `teil_pectoral.png` | 384 × 368 | 288 \| 128 | Ansatz 17,0 \| 3,6 | 3 × 2 | zeigt nach hinten unten, kommt unter dem Kiemendeckel hervor |
| Brustflosse fern | `teil_pectoral_far.png` | 384 × 368 | 288 \| 128 | dieselbe Stelle, 1,2 Einheiten höher | 3 × 2 | dunkler, hinter dem Körper |

**Reihenfolge von hinten nach vorn:** ferne Brustflosse – Bauchflosse – Rückenflosse – Afterflosse – (Mundhöhle, dynamisch) – Unterkiefer – **Körper** –
nahe Brustflosse – Kiemendeckel – Auge – Lid (dynamisch).

**Weitere Ansatzpunkte** (in `hilfslinien_ansatzpunkte.png`): Maulspitze (Oberkiefer) 40,4 \| 2,8 · Schwanzstiel endet bei x −30 (halbe Höhe 3,8), dort
beginnt die Schwanzflosse (Länge 16, Spannweite ±13) · Drehpunkt der Verformung x 7,2 (hier bleibt der Rumpf ruhig) · Halszone beginnt bei x 16,8.

## Was gemalt werden muss, was prozedural bleibt

**Gemalt (Zeichnung des Künstlers), je Teil eine Datei in der Größe der Vorlage:**

1. **Körper** (`teil_body`): Silhouette von Schnauze bis Schwanzflossenspitze, Kopfform, Rückenwölbung, Bauch, Schwanzstiel, Schwanzflosse mit Rändern und Strahlen, Grundfarben (Rücken/Flanke/Bauch), die obere Zahnreihe als Zähne **in der Lippe** (Wurzeln unter der Lippenlinie).
2. **Unterkiefer** (`teil_jaw`): Form, Kinn, Farbe, untere Zähne. Er muss in Ruhe **bündig unter die Oberlippe** passen (Oberkante auf der Maulspalte, hinterer unterer Punkt auf der Kehle des Körpers: Kehle (28,8 − 2,6 \| 3,0 + 0,62 · Tiefe)).
3. **Brust-, Rücken-, After- und Bauchflosse**: je eine Zeichnung, Ansatz unter der Haut (die Ansätze liegen in der Vorlage im Körper verborgen).
4. **Kiemendeckel** (`teil_overlay`): der hintere Rand des Deckels mit Schatten auf Rumpf und Flossenansatz.
5. **Auge** (`teil_eye`): Augapfel mit Iris und Pupille (Iris-Farbe aus der Linie, siehe unten).

**Prozedural (bleibt im Code, damit die graduelle Evolution erhalten bleibt):**

| Merkmal | warum prozedural | wie |
|---|---|---|
| **Maße der Anatomie** (Länge, Höhe, Kopfgröße, Maul, Flossengrößen, Schwanzflosse) | kommen stufenlos aus den Evolutionswerten | `anatomy.ts` bestimmt die Ruheform des Netzes (Ruhepositionen der Netzpunkte) |
| **Farbe der Linie / Tarnung / Höhle / Platten-Färbung** | Palette hängt an Linie, Tarnwerten, Licht, Höhlenfarbe | als **Einfärbung** (Tönung) der gemalten Grauwerte bzw. als eigene Farbebene; `palette()` bleibt |
| **Körpermuster**: Tarnbänder, Schwarmband, Hungerrippen, Narben, Männchen-Kehlfleck | entstehen und verschwinden mit Verhalten und Alter | als **Musterebene**, die auf dem Körpernetz mitgeführt wird (gleiche UV wie der Körper), nicht in die Zeichnung gemalt |
| **Schuppen und Schilde** | Größe und Stärke wachsen mit der Panzerung | Musterebene wie oben; die gemalte Zeichnung enthält höchstens **sehr zarte** Grundschuppen |
| **Kopfplatten (Kopfpanzer)** mit Nähten, Höckern und Augenhöhle | wachsen stufenlos mit Schädel und Kopfschild | eigene **Plattenebene** über dem Kopf, mit Rand und Augenhöhle (Auge liegt darüber); wird ab etwa `skull > 0,15` eingeblendet |
| **Zahnzahl und -größe, Kauzähne (Pflanzenfresser stumpf)** | Gebiss entwickelt sich sichtbar | **Zähne** bleiben eigene kleine Bilder in Lippe/Kiefer (Wurzel verdeckt); das **Maul wird größer**, die Zähne bleiben klein und gleich viele (festgelegt) |
| **Mundhöhle, Lid, Augenfarbe, Blick** | bewegen sich / hängen an Zustand | dynamisch (Graphics) bzw. Tönung der gemalten Iris (`P.eye`, wacher/finsterer Blick = Lid-Wert) |
| **Pose** (Welle, Biss, Flossen) | Animation | `spine.ts`, `rig.ts` – kennt keine Evolutionswerte |

**Wichtig für die Zeichnerin/den Zeichner:** Muster, Schuppen, Platten und Zähne **nicht in den Körper malen**, sondern den Körper als saubere Grundfläche mit
Form, Licht und Kontur anlegen (Grauwerte oder neutrale Farben, sodass die Tönung die Palette trägt). Alles, was mit dem Verhalten wächst, liegt in einer
eigenen Ebene.

## Verformung und Varianten – wie weit trägt eine gemeinsame Textur?

Das Netz verformt in zwei Arten, die man trennen muss:

1. **Pose** (Schwimmen, Biss): Das Netz folgt der Wirbelsäule. Zellen stauchen/dehnen sich nur an der Kurveninnenseite; im Rig ist der Knick pro Spalte so begrenzt,
   dass die Innenkante einer Zelle nie unter 10 % ihrer Breite fällt (`MIN_INNER`, getestet für alle Extremformen in `tests/fish.test.ts`). Der Hals streckt sich beim Biss
   (Vorstoß) bis rund 45–70 % einer Halszellenbreite (nur 1–2 Zellen). **Folge für die Zeichnung:** Rumpf und Schwanz dürfen beliebige Flächen haben; Linien dürfen
   quer zur Körperachse laufen; im Hals (x 7 … 20) sollen keine feinen Details sitzen.
2. **Evolution** (Ruhepositionen des Netzes): Die Zeichnung der neutralen Form wird auf die Anatomie der jeweiligen Form **umgerechnet**
   (UV bleibt, Ruhepunkte wandern). Gemessen gegenüber `neutral` (siehe `manifest.json` der Referenzordner):

| Form | Körperlänge | Körperhöhe | Kopflänge | Kopfhöhe | Unterkiefer-Tiefe |
|---|---|---|---|---|---|
| `kopfpanzer_max` | 1,00× | 1,00× | **1,42×** | **1,42×** | 9,3 (neutral 6,6) |
| `starkes_gebiss` | 1,00× | 1,00× | **2,43×** | 1,17× | 11,1 |
| `kurz_massig` | **0,58×** | **1,81×** | 1,00× | **1,78×** | 11,7 |
| `lang_schlank` | **1,42×** | **0,52×** | 1,00× | **0,54×** | 4,0 |
| `len ± 0,4` / `girth ± 0,4` | 0,83 … 1,17× | 0,85 … 1,15× | 1,00× | 0,85 … 1,15× | – |

**Empfehlung nach den Messungen:**

* **Eine gemeinsame Textur trägt** für Körperlänge und -höhe etwa **±25 %** (alle Zwischenstufen, `len`/`girth` bis ±0,4, mittleres Maul `jaw ≤ 0,5`
  mit Kopf 1,5×). Der Rumpf besteht aus ruhigen Flächen; eine gleichmäßige Dehnung bleibt darin unsichtbar.
* **Zusätzliche Varianten sind nötig** für:
  1. **Kopfpanzer** (Kopf 1,4×, Platten, Augenhöhle): kein Dehnen, sondern die **Plattenebene** (prozedural) über dem normal gezeichneten Kopf; der Kopf der neutralen Zeichnung
     wird dafür auf 1,4× vergrößert, deshalb soll er **ohne feine Einzelheiten** sein. Optional eine gemalte Plattenebene.
  2. **Starkes Gebiss** (Kopf bis 2,4× lang): Die Schnauze dehnt sich nur im **Schnauzenteil** (x 28 … 40 bei neutral). Dazu den Kopf in der Zeichnung so anlegen, dass die Schnauze
     ein **eigener, ruhiger Streifen** ist (keine Zeichnung im Streifen, die sich 2,4× dehnen dürfte). Der Unterkiefer wird zusätzlich als **eigene, längere Zeichnung** („Kiefer lang“) gebraucht,
     weil er in der Länge 1,0 … 2,4× und der Tiefe 0,6 … 1,7× läuft.
  3. **Kurz/massig** (0,58 × 1,81): Rumpf stark gestaucht und hoch – eine **eigene Körperzeichnung** („Körper kurz“) ist nötig, sonst werden Kopf und Schwanzstiel verzerrt.
  4. **Lang/schlank** (1,42 × 0,52): ebenfalls eine eigene Körperzeichnung („Körper lang“); der Kopf ist hier nur 0,54× hoch, sodass Auge und Kiemendeckel nicht mehr auf die gedehnte neutrale Zeichnung passen.
  Alle anderen Werte (Flossen-, Schwanzgrößen) laufen als Ruhepositionen der kleinen Flossennetze (ein Bild, 1,0 … 1,9× größer; die Flossenzeichnung soll deshalb **ohne feine Muster** sein).

Daraus ergibt sich als **Liste der Zeichenassets** (mindestens → ideal):

| Nr. | Asset | Pflicht | Bemerkung |
|---|---|---|---|
| 1 | `teil_body` (neutral) | ja | Silhouette, Farbflächen, Kontur, obere Zähne |
| 2 | `teil_jaw` (neutral) | ja | Unterkiefer, untere Zähne |
| 3 | `teil_eye` | ja | Auge; Iris-Farbe über Tönung |
| 4 | Brustflosse nah + fern (`teil_pectoral`, `_far`) | ja | ein Bild, die ferne wird dunkler getönt |
| 5 | Rückenflosse, Afterflosse, Bauchflosse | ja | je eine Zeichnung |
| 6 | `teil_overlay` (Kiemendeckel) | ja | |
| 7 | Körper **kurz/massig** | empfohlen | sonst starke Verzerrung bei `len < −0,5`, `girth > 0,5` |
| 8 | Körper **lang/schlank** | empfohlen | sonst starke Verzerrung bei `len > 0,5`, `girth < −0,5` |
| 9 | Unterkiefer **lang** (Gebiss 0,5 … 1) | empfohlen | Maul-Entwicklung bleibt sichtbar (Kiefer, Zähne) |
| 10 | Plattenebene Kopfpanzer (mit Augenhöhle) | optional | sonst bleibt sie prozedural (wie jetzt) |

## Aufnahmen (`aufnahmen/`)

| Datei | Inhalt |
|---|---|
| `EVO_formen_werkstatt.png` | Werkstatt: normal, maximaler Kopfpanzer, starkes Gebiss, kurz/massig, lang/schlank |
| `EVO_formen_im_spiel.png` | dieselben fünf Formen im Spiel bei normalem Zoom (Devon, Laichfluss; dunkel wegen Tiefenschatten und Sicht) |
| `EVO_groessenvergleich_45_70_90.png` | die fünf Formen mit **45 / 70 / 90 Pixeln Bildschirmbreite** (Breite des Netzes von Schwanzflossenspitze bis Schnauze, 1:1 Bildschirmpixel) |
| `EVO_kopfpanzer_auge.png` | Auge bei maximalem Kopfpanzer: eigene Ebene, Augenhöhle, Braue, Augapfel 22 % größer |
| `EVO_gebiss_entwicklung.png` | Gebiss 10 → 20 → 40 → 70: Maul wird länger und tiefer, die Zähne wachsen mit (nur in der Größe) |
| `EVO_szenen_alter_spielstand.png` | Level, Übersicht, Stammbaum, Ende, Aussterben mit einem Spielstand, den der Stand **vor** dem Fisch-Rig geschrieben hat |

### Überarbeitung v3 (`aufnahmen/v3/`)

Vorher = Stand `08901b9` (vor der Überarbeitung), nachher = Stand der Abnahme; Werkstatt mit `?debug&gallery=fish`, Spiel im Devon (Laichfluss) mit echtem Spielfisch.
Alle Aufnahmen ohne Grafikkarte (Software-GL, Chromium `--disable-gpu`).

| Datei | Inhalt |
|---|---|
| `werkstatt_formen_vorher_nachher.png` | normal, kurz/massig, starkes Gebiss – geschlossen nebeneinander |
| `werkstatt_misch_vorher_nachher.png` | Mischformen: kurz + Gebiss, Kopfpanzer + Gebiss, lang + Gebiss, Panzer + kurz |
| `werkstatt_biss_vorher_nachher.png` | starkes Gebiss geschlossen / halb / maximal offen |
| `werkstatt_uebergaenge.png` | Stufen 0 … 1 von kurz/massig, Gebiss und lang/schlank (Werte um die Schwellen von `bodyWeights` und `jawLongWeight`): keine Sprünge, keine doppelten Konturen |
| `groessen_vorher_nachher.png` | fünf Formen bei 45 / 70 / 90 Pixeln Bildschirmbreite |
| `spiel_start_vorher_nachher.png`, `spiel_licht_vorher_nachher.png` | Spielfisch (normal, kurz/massig, Gebiss) im Spiel am Start und in der Tiefe; nachher mit der begrenzten Aufhellung |
| `spiel_gebiss_offen.png` | Gebiss im Spiel geschlossen / halb / maximal offen (`holdOpen`, nur Entwicklung) |
| `spiel_schwimmen_biss.png` | Schwimmen → Spurt → Biss (13 Einzelbilder aus dem Spiel; Software-GL schafft nur wenige Bilder je Sekunde, der Biss dauert etwa 0,2 s, deshalb ist nur ein Bild weit offen) |
| `spiel_verdeckung.png` | Spielfisch frei / hinter Vordergrundpflanze / hinter Vordergrundfels (beide mit `DEPTH.decoFront` über dem Fisch) |
| `spiel_drehen.png` | Wechsel der Schwimmrichtung bei nachlaufender Kamera: keine Helligkeitssprünge (die Aufhellung ist ein weich nachgeführter Wert, kein Wert je Bild) |

### Kopfpanzer und feste Weltfische (`aufnahmen/kopfpanzer/`, `aufnahmen/weltfische/`)

Alle Aufnahmen ohne Grafikkarte (Software-GL, Chromium `--disable-gpu`).

| Datei | Inhalt |
|---|---|
| `kopfpanzer/werkstatt_ohne_mittel_max.png`, `werkstatt_stufen.png` | ohne / mittel / maximal und die stufenlose Entwicklung (Schädel 0,1 … 1) |
| `kopfpanzer/werkstatt_mischformen.png` | schwach, stark, mit Gebiss, kurz, lang, mit Schuppenpanzer |
| `kopfpanzer/werkstatt_biss.png`, `spiel_max_biss.png`, `spiel_mittel.png` | Biss geschlossen / halb / offen, Werkstatt und Spiel |
| `kopfpanzer/groessen_45_70_90.png`, `detail_max.png` | Lesbarkeit bei 45 / 70 / 90 px, Detail der Hinterkante und der Augenhöhle |
| `weltfische/werkstatt_alle_neu_alt.png` | die acht Arten im Rig (oben) und als altes Bild (unten) |
| `weltfische/werkstatt_jaeger_zu_offen.png` | Cheirolepis, Enchodus, Protosphyraena, Gillicus: Maul zu / offen |
| `weltfische/groessen_45_70_90.png` | Vorlage (masters/) – neu (Rig) – alt bei 45 / 70 / 90 px |
| `weltfische/spiel_biss_zustaende.png` | Jäger im Spiel: Schwimmen, Ausholen (Krümmung), Zuschnappen |
| `weltfische/spiel_neu.png`, `spiel_alt.png` | dieselbe Szene im Level mit Rig und mit den alten Bildern |

## Prüfungen

* **Spielstände:** Ein Spielstand, geschrieben vom Stand `a6def21` (vor dem Fisch-Rig), lädt im neuen Spiel (Schädel 0,4, Kiefer 0,35, Gebisszuwachs 14 …), Level, Laich, Übersicht (C),
  Stammbaum, Ende und Aussterben laufen ohne einen Fehler in der Konsole. Das Speicherformat hat sich durch das Rig nicht geändert (die Darstellung wird aus den Werten abgeleitet).
* **Leistung** (ohne Grafikkarte, Software-GL, 18 Fische im Schwimmen mit Bissen): 22,5 Bilder pro Sekunde gegenüber 24,3 mit dem alten Fisch, Rechenzeit der Posen
  0,17 ms je Bild für alle 18; neues Aussehen erzeugen (gemalt, mit Profilverzerrung) 16 … 47 ms je nach Größe (Größe 0,5 … 1,6), programmiert 9 … 16 ms – nur beim Wechsel des
  Aussehens, danach aus dem Zwischenspeicher. Die Spieleraufhellung kostet nichts je Bild (ein Tint-Wert, nur bei Änderung gesetzt; kein Auslesen der Grafikkarte,
  keine Textur je Bild). **Auf echter Grafikhardware ist nichts davon gemessen** – in dieser Umgebung gibt es keine. Messhilfe: `http://localhost:8080/?debug&gallery=fish&perf&n=40&mode=swim&speed=0.7&bite=1&zoom=0.9`
  zeigt oben links Fischzahl, Bilder pro Sekunde, Millisekunden je Bild und ob WebGL läuft; zum Vergleich dieselbe Adresse mit `&oldfish`.

## Erzeugung

```
npm run dev
# Seite mit ?debug öffnen, in der Konsole (nach dem Titel):
const T = __evo.fishTemplates({...__evo.state.morph(), jaw: 1}, 'name', 16);
// T.canvases = { 'fisch_neutral.png': <canvas>, ... }, T.manifest = { ... }
```

Die hier abgelegten Dateien wurden mit Linie 1 (`hue 1`), Saat 7 und den Werten der Tabelle oben erzeugt.
