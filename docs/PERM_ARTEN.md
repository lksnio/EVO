# Frühes Perm – Artenliste (Entwurf)

Zielzeit: **Unterperm / Cisuralium, etwa 295–280 Mio. Jahre**. Die Welt verbindet Wasser, Ufer und Land:
Seen und Flüsse (wie das Rotliegend im Saar-Nahe-Becken), sumpfige Ufer und trockeneres Hochland (wie der
**Bromacker in Thüringen**). Für die Tiefe gibt es zwei Möglichkeiten: einen tiefen See (Süßwasser) oder, falls
gewünscht, ein Randmeer.

Stand: Vorschlag, noch nichts im Spiel. Die Rollen folgen `src/data/species.ts`:
`prey` (flieht), `predator` (jagt), `defender` (friedlich, wehrt sich heftig), `hazard` (nur bei Berührung
gefährlich), `apex` (Spitzenräuber, mit `boss: true` ein Boss). Lebensräume im Code sind `water`, `land` und `air`;
„Ufer“ heißt hier: lebt im Wasser **und** an Land (amphibisch wie Pederpes im Karbon).

Längen sind reale Größen der Tiere (gerundet). Mit ⚠ markierte Angaben vor dem Steckbrief noch einmal prüfen
(Zeitraum, Fundort oder Größe sind in der Literatur unterschiedlich angegeben).

## Bosse

| Lebensraum | Boss | Länge | Warum |
|---|---|---|---|
| **Tiefes Wasser (See)** | ***Orthacanthus*** – Süßwasserhai | bis ~3 m | größter Jäger der Seen und Flüsse; langer Nackenstachel, aalartiger Körper, frisst auch Amphibien |
| **Land** | ***Dimetrodon grandis*** – Segelrücken | ~3–3,5 m | Spitzenjäger an Land, große Säbelzähne vorn, das bekannteste Tier des Perms |
| *(optional)* Tiefes Meer | ***Helicoprion*** – Kreissägenhai | ~5–8 m ⚠ | Unterkiefer mit spiralförmigem Zahnkranz; tritt erst etwas später auf (ab ~290–280 Mio.) ⚠ |

Zwischenbosse (stark, aber nicht `boss`): ***Ophiacodon*** am Ufer, ***Eryops*** an der Wasserlinie.

## Wasser (Seen, Flüsse, Tiefe)

| Art | Rolle | Kost | Länge | Wo | Spielidee |
|---|---|---|---|---|---|
| *Paramblypterus* / *Aeduella* (Strahlenflosser) | prey | Plankton | 10–25 cm | Flachwasser, offen | Schwärme, Grundfutter; Rotliegend-Seen (auch Deutschland) |
| *Acanthodes bronni* (Stachelhai) | prey | Plankton (Filterer) | ~30 cm | offen, Mitte | Schwarm, Stacheln: beim Fressen Schaden ⚠ |
| *Uronectes* (Krebstier) | prey | Abfall | ~5 cm | Grund | winzige Beute für Jungtiere |
| *Apateon* (Branchiosaurier-Larve) | prey | Kleinzeug | 5–10 cm | Flachwasser | Amphibienlarven mit Kiemenbüscheln – Futter |
| *Gnathorhiza* (Lungenfisch) | defender | Muscheln, Kleintiere | ~40 cm | Grund, Schlamm | gräbt sich ein; zieht sich bei Trockenheit in Röhren zurück |
| *Sagenodus* (Lungenfisch) | defender | gemischt | ~1 m ⚠ | Grund | großer friedlicher Brocken, beißt zurück |
| *Xenacanthus* (Süßwasserhai) | predator | Fleisch | ~0,7–1 m | Flachwasser bis Mitte | Nackenstachel; schneller Jäger auf Fische |
| *Archegosaurus decheni* (Langschnauzen-Amphibie) | predator | Fisch | ~1,5 m | offen | schnappt seitlich nach Schwärmen; Saar-Nahe |
| *Sclerocephalus* (Amphibie) | predator | Fisch, Amphibien | bis ~1,5 m | See, Mitte bis Tiefe | Lauerjäger; Jungtiere als Beute, Alte gefährlich; Saar-Nahe |
| *Trimerorhachis* (Amphibie) | predator | Fisch | ~1 m | Grund | flach, liegt im Schlamm und schnappt zu |
| *Diplocaulus* (Bumerangkopf) | defender | Kleintiere | ~1 m | Grund | Bumerangkopf als Waffe; unverwechselbares Profil |
| ***Orthacanthus*** | **apex, boss** | Fleisch | bis ~3 m | **Tiefe** | zieht in der Tiefe Kreise; bewacht den tiefen Laichplatz |

## Ufer (Wasser und Land)

| Art | Rolle | Kost | Länge | Spielidee |
|---|---|---|---|---|
| *Cacops* (gepanzerte Amphibie) | defender | Insekten | ~40 cm | Knochenplatten am Rücken: schwer zu beißen |
| *Seymouria* | predator | Kleintiere | ~60 cm | robuster Ufergänger; jagt Jungtiere an der Wasserlinie (auch Bromacker) |
| ***Eryops*** | predator (Zwischenboss) | Fisch, Amphibien | ~2 m | krokodilartiger Lauerjäger halb im Wasser – die Gefahr beim Übertritt ans Land |
| ***Ophiacodon*** | predator (Zwischenboss) | Fisch | ~2–3 m | früher Synapside, lang und schwer, jagt im seichten Wasser und am Rand |
| Pfeilschwanzkrebse | prey | Abfall | ~10 cm | laichen am Ufer: leichte Beute (optional) |

## Land (Ebene, Wald, Hochland)

| Art | Rolle | Kost | Länge | Spielidee |
|---|---|---|---|---|
| Schaben, Tausendfüßer, Spinnentiere | prey | – | wenige cm | Kleinbeute im Laub |
| *Captorhinus* | prey | Insekten, Pflanzen | ~25 cm | kleine frühe Reptilien in Gruppen |
| *Eudibamus cursoris* | prey | Pflanzen | ~25 cm | rennt auf zwei Beinen: sehr schnell, kaum zu fangen (Bromacker) |
| *Orobates pabsti* | prey | Pflanzen | ~1 m | gemütlicher Pflanzenfresser; seine Spuren sind berühmt (Bromacker) |
| *Casea* | prey | Pflanzen | ~1,2 m | dicker Pflanzenfresser, langsam |
| *Diadectes* | defender | Pflanzen | ~2–3 m | großer Pflanzenfresser, schlägt zu, wenn man ihn bedrängt (auch Bromacker) |
| *Edaphosaurus* | defender | Pflanzen | ~3 m | Segelrücken mit Querstreben, friedlich, aber schwer |
| *Arthropleura* | defender | Pflanzenreste | bis ~2,5 m | Riesentausendfüßer; späte Vorkommen im frühesten Perm ⚠ |
| *Varanops* / *Tambacarnifex* | predator | Fleisch | ~1–1,5 m | flinke, waranartige Jäger; *Tambacarnifex* vom Bromacker |
| *Sphenacodon* | predator | Fleisch | ~2–3 m | Verwandter von Dimetrodon ohne hohes Segel; jagt im Paar ⚠ |
| *Dimetrodon teutonis* | predator | Kleintiere | ~1,7 m | kleiner „deutscher“ Dimetrodon vom Bromacker – Vorbote des Bosses |
| ***Dimetrodon grandis*** | **apex, boss** | Fleisch | ~3–3,5 m | Herrscher des Landes; bewacht den Laichplatz an Land |

## Luft

| Art | Rolle | Spielidee |
|---|---|---|
| *Meganeuropsis* (Riesen-Greifenfliege) | predator / hazard | ~70 cm Spannweite; stößt an Land auf Jungtiere herab ⚠ |
| kleinere Insekten | prey | Futter für Landtiere |

## So ergibt sich die Weggabelung

- **Wasserweg:** Fisch → großer Raubfisch; Gegner *Xenacanthus*, *Sclerocephalus*, Boss *Orthacanthus*.
- **Uferweg:** Fisch mit Beinen → Lauerjäger an der Wasserlinie; Gegner *Eryops*, *Ophiacodon*; Beute auf beiden Seiten.
- **Landweg:** Ufertier geht an Land → Gegner *Varanops*, *Sphenacodon*, *Dimetrodon teutonis*, Boss
  *Dimetrodon grandis*; dazu wehrhafte Pflanzenfresser (*Diadectes*, *Edaphosaurus*) als Hindernis.

Jeder Lebensraum hat damit Kleinbeute, mittlere Jäger, wehrhafte Friedliche und eine Spitze.

## Fossilplatten für die Sammlung (Vorschlag)

Passend zu den sieben großen Gegnern der Sammelstern-Idee: *Orthacanthus*, *Dimetrodon grandis*, *Eryops*,
*Ophiacodon*, *Edaphosaurus*, *Diplocaulus*, *Helicoprion* (falls das Meer kommt; sonst *Diadectes*).

## Noch zu entscheiden

- Gibt es ein Meer mit *Helicoprion*, oder bleibt die Tiefe ein See mit *Orthacanthus*?
- Welche Arten aus dem Karbon dürfen ins Perm mitwandern (z. B. *Xenacanthus*, Lungenfische, Pfeilschwanzkrebse)?
- Wie viele Arten je Ort – im Devon sind es pro Ort etwa 10–15 sichtbare Arten.
