# Frühes Perm – Karten und Arten für den Prototyp

Zielzeit: **Unterperm / Cisuralium, etwa 295–280 Mio. Jahre**. Der Prototyp spielt nur hier; Devon und Karbon
kommen später („demnächst“ in der Zeitalterübersicht).

Stand: **im Spiel** – fünf Orte mit Weltkarte, alle Arten einfach gezeichnet (`PlaceDef.fauna` in `src/data/world.ts`,
Arten in `src/data/species.ts`, Steckbriefe in `src/data/speciesFacts.ts`). Die Gewichte je Ort sind auf etwa diese Mischung
abgestimmt; genaue Zahlen stehen im Code. Rollen wie in `src/data/species.ts`: `prey` (flieht), `predator` (jagt),
`defender` (friedlich, wehrt sich heftig), `hazard` (nur bei Berührung gefährlich), `apex` (Spitzenräuber, mit
`boss: true` ein Boss). Längen sind reale Größen (gerundet); ⚠ heißt: vor dem Steckbrief nachschlagen.

## Fünf Karten und die Weltkarte

Jede Karte läuft von links nach rechts. Am rechten Rand öffnet sich die Weltkarte; man wählt einen benachbarten
Knoten. So entsteht eine Gabelung mit steigender Schwierigkeit:

```
                 ┌── 2 Lagune ────── 3 Die Tiefe      (Wasserweg, Boss Orthacanthus)
 1 Laichfluss ───┤        │
                 └── 4 Ufersumpf ─── 5 Hochland       (Landweg, Boss Dimetrodon)
```

| Stufe | Karte | Grundlage im Spiel | Lebensraum |
|---|---|---|---|
| 1 | **Laichfluss** | vorhandener Laichfluss | Flussmündung, ruhig, Kinderstube |
| 2 | **Lagune** | Korallengarten, umgemalt | flache, warme Bucht zum Meer hin ⚠ Korallen nur meeresnah plausibel |
| 3 | **Die Tiefe** | vorhandenes Tiefental | tiefer, dunkler Grund – Boss im Wasser |
| 2 | **Ufersumpf** | neu (Karbon-Sumpfwelt als Grundlage) | Wasser und Land wechseln, Schachtelhalme, Schlamm |
| 3 | **Hochland** | neu | trockenes Land, Farnsamer, rote Erde – Boss an Land |

Die Verbindung Lagune ↔ Ufersumpf erlaubt einen Seitenwechsel auf mittlerer Stufe.

## Die Arten je Karte (je 5, zusammen 23 verschiedene)

### 1 · Laichfluss – leicht
| Art | Gruppe | Rolle | Länge | Spielidee |
|---|---|---|---|---|
| *Paramblypterus* | kleiner Fisch | prey | ~15 cm | Schwärme, Grundfutter (Rotliegend, auch Deutschland) |
| *Acanthodes* | kleiner Fisch | prey | ~30 cm | aalartig, Flossenstacheln: kostet beim Fressen etwas |
| *Apateon* | Amphibienlarve | prey | ~8 cm | Kiemenbüschel; leichte Beute fürs Jungtier |
| *Gnathorhiza* | mittlerer Fisch (Lungenfisch) | defender | ~50 cm | gräbt sich im Schlamm ein, beißt zurück |
| *Archegosaurus* | Amphibie | predator | ~1,5 m | Langschnauze, schnappt nach Schwärmen – die erste Gefahr |

### 2 · Lagune – mittel
| Art | Gruppe | Rolle | Länge | Spielidee |
|---|---|---|---|---|
| *Aeduella* | kleiner Fisch | prey | ~20 cm | schlanker Schwarmfisch, schneller als *Paramblypterus* |
| *Platysomus* | mittlerer Fisch | prey | ~30 cm | hochrückig, fast scheibenförmig – ganz eigene Silhouette |
| *Diplocaulus* | Amphibie | defender | ~1 m | Bumerangkopf am Grund, rammt zurück |
| *Xenacanthus* | Hai | predator | ~1 m | Nackenstachel, schneller Fischjäger |
| *Ectosteorhachis* | großer Fisch (Fleischflosser) | predator | ~1 m ⚠ | schwerer Lauerjäger – ein entfernter Verwandter der eigenen Linie |

### 3 · Die Tiefe – schwer
| Art | Gruppe | Rolle | Länge | Spielidee |
|---|---|---|---|---|
| *Platysomus* | mittlerer Fisch | prey | ~30 cm | (aus der Lagune) Futter in der Tiefe |
| *Aeduella* | kleiner Fisch | prey | ~20 cm | (aus der Lagune) dunkle Schwärme |
| *Ectosteorhachis* | großer Fisch | predator | ~1 m ⚠ | (aus der Lagune) häufiger und größer |
| *Sclerocephalus* | Amphibie | predator | ~1,5 m | Lauerjäger am Grund |
| ***Orthacanthus*** | Hai | **apex, boss** | bis ~3 m | größter Jäger der Gewässer, aalartig, langer Stachel |

### 4 · Ufersumpf – mittel
| Art | Gruppe | Rolle | Länge | Spielidee |
|---|---|---|---|---|
| *Captorhinus* | frühes Reptil | prey | ~25 cm | kleine Landbeute in Gruppen |
| *Cacops* | gepanzerte Amphibie | defender | ~40 cm | Knochenplatten: schwer zu beißen |
| *Seymouria* | Ufergänger | predator | ~60 cm | jagt Jungtiere an der Wasserlinie |
| *Ophiacodon* | früher Synapside | predator | ~2–3 m | jagt im seichten Wasser, Zwischenboss |
| *Eryops* | Großamphibie | predator | ~2 m | krokodilartiger Lauerjäger an der Wasserlinie, Zwischenboss |

### 5 · Hochland – schwer
| Art | Gruppe | Rolle | Länge | Spielidee |
|---|---|---|---|---|
| *Eudibamus* | frühes Reptil | prey | ~25 cm | rennt auf zwei Beinen, kaum zu fangen (Bromacker, Thüringen) |
| *Edaphosaurus* | Segelrücken, Pflanzenfresser | defender | ~3 m | friedlich, aber schwer und wehrhaft |
| *Diadectes* | großer Pflanzenfresser | defender | ~2,5 m | schlägt zu, wenn man ihn bedrängt (auch Bromacker) |
| *Varanops* | Landjäger | predator | ~1,2 m | flink, waranartig, jagt im Paar |
| ***Dimetrodon grandis*** | Segelrücken, Jäger | **apex, boss** | ~3,5 m | Herrscher des Landes |

Optional für Stimmung (nicht in der Zählung): *Meganeuropsis* (Riesen-Greifenfliege, Luft), Insekten, Tausendfüßer.

## Vielfalt im Wasser

- **3 kleine Fische:** *Paramblypterus* (gedrungen), *Aeduella* (schlank, schnell), *Acanthodes* (aalartig mit Stacheln)
- **2 mittlere Fische:** *Gnathorhiza* (Lungenfisch, am Grund), *Platysomus* (hochrückig)
- **1 großer Fisch:** *Ectosteorhachis* (Fleischflosser)
- **2 Haie:** *Xenacanthus* (mittel), *Orthacanthus* (Boss)
- **Andersartige:** Larve *Apateon*, Amphibien *Archegosaurus*, *Diplocaulus*, *Sclerocephalus*

## Umgesetzt im Prototyp

- **Weltkarte:** eine alte, dunkle Karte (Meer mit der Tiefe, Lagune hinter dem Riff, Flussmündung, Sumpf, rotes Hochland).
  Vor dem ersten Besuch sieht man Name, Schwierigkeit und einen Satz; wer dort lebt, erst nach dem Besuch („unknown – go and
  see“, bei Bossorten „Something big rules here.“).
- **Lagune:** vorerst meeresnah gemalt (Riffbogen, Korallen aus dem Devon).
- **Hochland:** nur mit Beinen (`needsLegs`); ein Fisch sieht es gesperrt. Mit `?debug` ist alles wählbar.
- **Devon-Arten** bleiben vollständig im Code (das Devon ruht im Gestein).

## Noch zu entscheiden

- Lagune endgültig meeresnah (dann später vielleicht *Helicoprion*) oder Süßwassersee (Armleuchteralgen und Schachtelhalme
  statt Korallen)?
- Wie eine Linie im Perm Beine bekommt (z. B. über Zeit an Land im Ufersumpf), damit das Hochland ohne `?debug` erreichbar wird.
- Welche Perm-Arten zuerst richtig gemalt werden.
