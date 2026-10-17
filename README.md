# EVO – Die Suche nach Eden

Ein Überlebensspiel über Evolution im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript
und [Vite](https://vite.dev).

Du beginnst als winziger, schwacher Urfisch im Urozean – einer von wenigen deiner Art. Jedes
**Zeitalter** ist ein fester Zeitraum der Erdgeschichte: Oben läuft eine Uhr („vor 452.320.000 Jahren“),
und wer bis zum Ende des Zeitraums überlebt, dessen Linie zieht ins nächste Zeitalter weiter.
Es gibt keine Punkte. Es geht **nur ums Überleben – egal wie**. Nur am Ende jeder großen Region
(Urmeer, Sümpfe, Reptilienzeit, Eiszeit) herrscht ein Gigant – erst wer ihn besiegt, kommt weiter.

**Stirbst du, ist das Spiel vorbei.** Deine Linie stirbt aus – und bleibt als Ast im
**Stammbaum des Lebens**, der mit jedem Spiel weiterwächst.

> Fan-Projekt, inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne
> werden im Browser erzeugt – es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## So spielt sich EVO

- **Überleben, wie du willst:**
  - **Verstecken** – still im Dickicht übersehen dich die meisten Jäger; große Räuber, die nur
    durchziehen, schwimmen fast immer einfach vorbei. In den Höhlen des Urmeers sieht man von dir
    nur noch die Augen.
  - **Kämpfen** – angreifen tun nur der **Biss** (J) und der **Stoß** (R); bloßes Berühren tut
    niemandem etwas (außer Quallen) – man kann also an jedem Tier vorbeischwimmen. Der Stoß geht von
    Anfang an: Er macht kaum Schaden, **betäubt** kleine und mittelgroße Tiere aber kurz – Zeit für ein,
    zwei Bisse. Wer oft stößt, bekommt einen harten, später gepanzerten Kopf. Beim Biss schnellt das Tier nach vorn, reißt das Maul auf, schnappt zu und knirscht mit den
    Kiefern – mit starkem Gebiss deutlich wuchtiger. Zweimal schnell hintereinander zugebissen heißt:
    gepackt – kleinere Tiere zappeln dann nur noch.
  - **Jagen mit Plan** – kleine Fische sind auf der Flucht pfeilschnell und halten Abstand. Wer aber
    eine Weile ruhig und friedlich neben ihnen herschwimmt (nicht sprinten, nicht kämpfen), dem gegenüber
    lassen sie ihre Deckung fallen: Dann reichen ein Stoß und ein, zwei Bisse – zu Beginn sind kleine
    Fische mit zwei Bissen erledigt. Mittelgroße Tiere wehren sich und beißen zurück. Die großen kann
    man anfangs nur meiden; später gibt es vier Wege: ein **starkes Gebiss**, schnelle **Stöße und
    Ausweichen**, immer wieder aus dem **Hinterhalt** – oder man lässt sich **verfolgen, bis das Tier
    erschöpft ist**, und greift dann an (erschöpfte Tiere treiben langsam, schnappen nach Luft und
    nehmen mehr Schaden). Das klappt auch bei kleineren.
  - **Jeder Angriff ist zu sehen:** Alle Tiere holen vor dem Biss sichtbar aus (sie spannen sich und
    glühen kurz rötlich auf) und schnellen dann vor – wer aufpasst, kann ausweichen.
  - **Teilen** – frisst ein anderes Tier von deiner Beute mit, während du dabei bist, fasst es
    Vertrauen. Solche Verbündeten verteidigen dich.
  - …oder eine Mischung davon.
- **Deine Art:** In der Gegend leben einige Artgenossen – fast wie du, mit kleinen Abweichungen,
  Männchen (mit Kehlfleck) und Weibchen. Sie schwimmen **nicht im Schwarm** hinter dir her, sondern
  leben in ihrem eigenen Revier, fressen, warnen mit Rufen und fliehen vor Räubern. Greifst du in
  ihrer Nähe etwas an, **helfen sie manchmal mit**. Wer oft gemeinsam kämpft, dessen Art wird mehr und
  mehr zum **Rudeltier**: Artgenossen helfen dann öfter – wollen aber auch **mitfressen**. Frisst du
  gemeinsame Beute allein, beißt dich der Helfer und schwimmt verärgert davon; wer zu oft leer
  ausgeht, zieht ganz weg. Lässt du etwas übrig, wächst das Vertrauen.
- **Wo du lebst, entscheidest du:** Jedes Zeitalter hat links und rechts vom Start ein eigenes
  Gebiet, in das man fließend hinüberschwimmt bzw. -läuft – links flacher und trüber, voller Pflanzen
  und mit wenigen Jägern (dort sieht man dich schlechter), rechts tief und dunkel, mit mehr Räubern
  und einem der ganz Großen. Boden, Licht und Tiere sind dort anders. Das Meer ist tief: Oben fällt
  das Licht herein, nach unten wird es immer dunkler – die Kamera zeigt ein großes Stück davon.
- **Wer frisst wen:** Große Jäger jagen nur, wenn sie Hunger haben – satt liegen sie oft lange am
  Meeresgrund (bzw. am Boden) und dösen. Kleine Tiere fliehen früh und verstecken sich im Dickicht,
  in Höhlen und Felsspalten, bis die Gefahr vorbei ist.
- **Hunger:** Der Magen startet etwa halb voll und leert sich ständig – auch in Ruhe spürbar, beim
  Schwimmen bzw. Laufen deutlich schneller (am Grund entlangzulaufen spart Kraft). Fressen füllt ihn
  wieder auf, aber nie über das Maximum. Wie viel hineinpasst, hängt von der Größe ab: Große Tiere
  richten mehr Schaden an, verbrauchen aber auch mehr. Ein Happen bringt wenig – jeder zeigt kurz,
  was er gebracht hat: **rot** für Fleisch, **grün** für Pflanzen (eine Pflanze „+1“, ein kleiner
  Fisch etwa „+3“). Manche Pflanzen sind giftig: Sie brennen, machen aber kurz hellwach und schnell.
- **Fleisch wie in E.V.O.:** Ein erlegtes Tier leuchtet kurz auf und wird zu einer **saftigen
  Fleischkeule mit Knochen**, große Tiere zu mehreren. Im Wasser sinkt das Fleisch zügig zu Boden
  (große Stücke schneller), an Land fällt es herunter – und nach einer Weile verdirbt es. Andere Fleischfresser
  fressen mit, sobald sie drankommen: Wer zu lange wartet, geht leer aus.
- **Herrscher der Region:** Im letzten Zeitalter jeder Region erscheint kurz vor Schluss der
  Endgegner – im Devon *Dunkleosteus*, im Perm *Dimetrodon*, in der Kreide der *T. rex*, im Quartär
  der Säbelzahntiger – mit Lebensbalken unten im Bild. Überlebst du, ohne ihn zu besiegen, bleibt
  deine Linie in diesem Zeitalter: eine neue Generation, etwas später, etwas stärker. Man spielt
  ein Zeitalter also mehrmals und entwickelt sich weiter – anfangs frisst man nur die kleinen
  Fische, später größere. Erst wer den Herrscher besiegt, zieht in die neue Zeit.
- **Überraschungsangriff:** Wer aus Dickicht, Höhle, Felsspalte oder gut getarnt angreift (das Tier
  ist dann leicht durchsichtig), trifft mit dem ersten Biss oder Stoß zwei- bis dreifach und betäubt.
- **Riesen:** Zu Beginn mancher Zeitalter rast etwas Gewaltiges vorbei – im Ordovizium ein
  Riesenkopffüßer, im Silur *Pterygotus*, im Devon *Dunkleosteus*. Vorher wird das Wasser dunkler,
  es grollt, das Herz klopft, und die kleinen Fische fliehen: Zeit, sich zu verstecken. Selten
  streifen auch große Jäger wie *Megalograptus*, *Cladoselache* oder *Hyneria* umher. Wen ein Riese
  reißt, von dem bleibt meist etwas übrig …
- **Tiere ihrer Zeit:** Im Urmeer leben u. a. *Sacabambaspis*, *Birkenia*, *Cephalaspis* und der
  Panzerfisch *Bothriolepis*; kein Tier gleicht dem anderen ganz – manche sind etwas größer,
  andere etwas kleiner.
- **Strömungen und Felsspalten:** Strömungen reißen Kleine mit – massige Tiere schwimmen dagegen an.
  Unter Felsplatten liegen enge Spalten, in die kein großer Jäger passt; wer selbst zu groß und
  massig wird, aber auch nicht mehr.
- **Nachwuchs wählen:** Am Ende eines Zeitalters stehen fünf Nachkommen zur Wahl – die Art ist
  größer als deine Gruppe. Man sieht **nur die Tiere selbst**, keine Werte: alle im selben Maßstab
  in einem Stück Lebensraum, sodass Größe, Körperbau und Färbung direkt vergleichbar sind; ein Klick
  wählt aus. Der erste ist die **Hauptlinie** (deine bisherige Wahl mit allem, was dazugelernt
  wurde); die anderen weichen davon ab, und zwar umso weiter, je mehr du gefressen hast – in
  verschiedene Richtungen: länger oder massiger, größere oder kleinere Flossen, ein breiterer oder
  schmalerer Schwanz, eine höhere oder flachere Rückenflosse, etwas größer oder kleiner, heller,
  dunkler oder im Farbton leicht verschoben.
- **Werte (Taste C):** Name der Art, wie oft sie schon ausgestorben ist, Länge, Gewicht,
  Lebenskraft, sichtbare Fähigkeiten, Nahrung, Zusammenhalt – und was du in diesem Zeitalter
  **gelebt** hast (Beute gepackt, am Grund entlang, gerammt, geschwommen: „kaum“ bis „sehr oft“) –
  im Stil eines alten Rollenspiel-Charakterbogens. Das meiste bleibt verborgen.
- **Vier Verhaltensweisen formen deine Art:** Beutejagd (zubeißen, Beute packen und festhalten) →
  kräftige Kiefer; Bodenkontakt (sich am Grund abstützen und dort entlanglaufen) → fleischige
  Stützflossen, später kräftigere Beine; Stoßen → ein gepanzerter Schädel; Schwimmen (Strecke,
  Tempo, gegen Strömungen) → ein länglicher, flinker Körper. Das Verhalten schaltet keine Art frei –
  es verschiebt nur nach und nach, wie deine Nachkommen aussehen und was sie können.
- **Ereignisse** je Zeitalter: große Räuber ziehen durch, Stürme trüben die Sicht, die Erde bebt,
  Futter sprießt – und am Ende der Kreidezeit fällt Feuer vom Himmel.
- **Zwischen den Zeitaltern** siehst du dein Tier „einst“ und „heute“, dann vergehen Jahrmillionen –
  und was sich bewährt hat, setzt sich in dieser Zeit fort: je mehr Jahre, desto deutlicher.
  Nach dem Sieg über einen Herrscher nehmen deine Nachfahren eine neue Form an (Fisch → Lurch →
  Echse → Säuger): Das Wasser weicht dem Ufer, das Tier flackert zwischen alter und neuer Gestalt –
  immer schneller –, bis die neue bleibt.
- **Blutig:** Bisse und Stöße bluten – im Wasser als Wolke dort, wo gekämpft wurde, an Land als
  Fleck am Boden.
- **Keine Spoiler:** Zeitalter, die noch niemand erreicht hat, bleiben im Stammbaum und in der
  Zeitleiste Fragezeichen.

Kaum Zahlen und Balken – nur die Uhr, der Magen und (wenn er kommt) der Lebensbalken des Herrschers.
Verletzung, Hunger und Verstecktsein zeigen sich außerdem am Bildrand,
am Herzschlag und am Tier selbst (eingefallene Flanken, Narben, Blick …). Schwer verletzt färben
sich alle vier Bildränder rot, und das Tier wird ein klein wenig langsamer.

### Der Stammbaum

Jedes Spiel ist ein Pfad von der Wurzel (dem Urahn) nach unten – nach unten vergeht die Zeit.
Linien, die sich gleichen, teilen sich einen Ast; wo sie sich unterscheiden, verzweigt er sich.
Ausgestorbene Zweige enden mit einem Schädel (mit Zeitpunkt und Ursache), gut angepasste Linien
reichen weiter – vielleicht bis heute. Der Baum ist vorher nicht festgelegt, er entsteht nur
durch das Spielen.

<details>
<summary>Spoiler: Wie die verborgene Anpassung funktioniert</summary>

Im Hintergrund wachsen langsam (mit abnehmendem Ertrag) einige Merkmale, die man nie als Wert sieht:

| Wer so lebt … | … dessen Nachkommen bekommen |
| --- | --- |
| frisst Pflanzen, weicht aus, versteckt sich, entkommt Jägern | Tarnmuster, schlankeren und kleineren Körper, mehr Tempo, größere Augen |
| liegt oft still am Boden oder in Höhlen | sandig braun-graue Farben |
| wählt als Nachwuchs den Längeren, Massigeren oder Flinkeren | längeren Körper (schneller), mehr Masse (mehr Lebenskraft, stärkerer Stoß, langsamer) bzw. größere Flossen und mehr Tempo |
| stößt oft (Taste R) | einen härteren Schädel und einen kräftigeren Stoß |
| … und erlegt damit Tiere | einen **Panzerkopf**: Knochenplatten, stärkerer Stoß, mehr Lebenskraft, weniger eigener Schaden |
| beißt, packt und frisst Fleisch | längere Schnauze, tieferen Kiefer, mehr und größere Zähne – und vorn herausstehende Reißzähne |
| stützt sich oft am Grund ab und läuft dort entlang | fleischige **Stützflossen** (schneller am Grund, hält sich in Strömungen); an Land kräftigere Beine |
| kämpft oft gemeinsam mit Artgenossen und teilt die Beute | wird zum **Rudeltier**: Artgenossen helfen öfter (und wollen mitfressen) |
| frisst oft Fleisch bzw. Pflanzen | verdaut es besser (mehr Kalorien je Happen) – nirgends angezeigt |
| bleibt nah bei Jägern, ohne aufzufallen | stärkere Nerven: Jäger bemerken einen später – nirgends angezeigt |
| frisst giftige Pflanzen | wird giftfester – nirgends angezeigt |
| frisst viel | wächst |
| hält sich oft oben im Licht bzw. unten in der Tiefe (an Land: offen bzw. im Dickicht) | hellere bzw. dunklere Färbung |
| schwimmt bzw. läuft viel und schnell – besonders gegen Strömungen | deutlich länglicheren, schlankeren Körper und größere Flossen |
| sprintet oft | einen breiteren, kräftigeren Schwanz |
| versteckt sich zwischen Pflanzen | grünere Farben, größere (wendigere) Flossen, eine flachere Rückenflosse |
| wird oft verletzt | eine höhere, wehrhaftere Rückenflosse bzw. einen Rückenkamm |

Wer viel tötet, bekommt einen Ruf: Beutetiere fliehen früher, Räuber meiden einen, Verteidiger
werden schneller wütend. Wer mit Artgenossen und Verbündeten unterwegs ist, wirkt gefährlicher.

Jeder Artgenosse hat eine verborgene **Treue**. Sie steigt, wenn er von deiner Beute mitfrisst oder
mit dir grast, und sinkt, wenn er hungrig zusehen muss, wie du alles allein frisst (oder wenn du
ihn beißt). Treue Artgenossen jagen mit, verteidigen dich und verstecken sich mit dir; untreue
bleiben auf Abstand und gehen schließlich. Die durchschnittliche Treue der Überlebenden bestimmt,
wie zutraulich die Gruppe im nächsten Zeitalter beginnt.

Zwischen den Zeitaltern wird verstärkt, was im letzten Zeitalter dazugekommen ist – umso stärker,
je mehr Jahrmillionen vergehen (Faktor etwa 0,9 bis 1,8). Die Artgenossen tragen dasselbe weiter,
jeder mit eigener Abweichung; der Gewählte bringt zusätzlich seine besondere Stärke mit.
Im Stammbaum werden Linien nach Körperform, vorherrschender Anpassung und Kost zusammengefasst –
daher auch die lateinisch klingenden Namen (z. B. *Cryptichthys phytophagus*).
</details>

## Steuerung

| Taste | Aktion |
| --- | --- |
| ← → / A D | laufen bzw. schwimmen |
| ↑ ↓ / W S | im Wasser auf- und abtauchen |
| Leertaste / ↑ | springen (an Land) |
| J, X oder Y | beißen und fressen |
| Shift oder K | sprinten (kostet Kraft) |
| C | Werte deines Tiers |
| R oder V | Stoß (betäubt kleine und mittelgroße Tiere kurz) |
| Esc / P | Rast (Pause) |
| M | Ton an/aus |

Auf Handy und Tablet erscheinen im Level Bildschirm-Knöpfe (am besten im Querformat spielen).

## Entwickeln

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
npm run dev      # Dev-Server mit Live-Reload auf http://localhost:8080
```

| Befehl | Was es macht |
| --- | --- |
| `npm run dev` | Startet den Entwicklungsserver |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` |
| `npm run preview` | Zeigt den fertigen Build lokal an |
| `npm run typecheck` | Nur TypeScript prüfen |

**Entwickler-Modus:** `?debug` an die Adresse hängen (z. B. `http://localhost:8080/?debug`) – im Level
werden die verborgenen Werte, Artgenossen, Verbündete und Durchzügler eingeblendet. Mit
`?debug&gallery` gibt es eine Übersicht über viele Ausprägungen der Spielfigur und alle Tierarten
(Leertaste blättert). `?touch` zeigt die Bildschirm-Knöpfe auch am PC.

### Stabilität und Leistung

- **Kein Einfrieren mehr:** Phaser fordert das nächste Bild erst an, wenn das aktuelle fertig ist –
  ein einziger Fehler hielt früher das ganze Spiel an. Jetzt wird jedes Bild abgesichert
  (`src/util/guard.ts`): Der Fehler landet einmal in der Konsole (`[EVO] Fehler …`), das Spiel läuft
  weiter. Ein Tier, dessen Verhalten einen Fehler wirft, wird einfach entfernt.
- **Grafik vorab:** Alle Tierarten eines Zeitalters (auch die großen Durchzügler) werden beim Start
  des Zeitalters gemalt, nicht erst, wenn sie zum ersten Mal auftauchen.
- **Neu zeichnen nur in ruhigen Momenten:** Verändert sich das eigene Tier, wird es nicht mitten
  im Kampf neu gezeichnet, sondern kurz danach (höchstens alle 3 Sekunden).
- **Nur Sichtbares wird gezeichnet:** Boden, Pflanzen, Licht und Deko außerhalb des Bildes werden
  ausgeblendet – der Lebensraum ist dreimal so breit, kostet aber kaum mehr.
- **Speicher bleibt begrenzt:** Nicht mehr benutzte Aussehen-Texturen werden freigegeben;
  Blutflecken und Partikel werden wiederverwendet statt immer neu erzeugt.
- Die Spiellogik läuft mit `requestAnimationFrame` und Zeitdelta (Phaser), die KI nimmt ihre
  Umgebung nur alle ~0,25 s neu wahr, Kollisionen prüft Arcade Physics mit einem räumlichen Baum.

### Projektstruktur

```
src/
├── main.ts              Start: Schriften laden, Spielstand laden, Phaser starten
├── config.ts            Bildgröße, Kachelgröße, Schwerkraft, Ebenen, Farben der Oberfläche
├── data/                Spieldaten – hier lässt sich das Spiel am leichtesten anpassen
│   ├── classes.ts       Körperformen (Fisch … Säuger) mit Grundwerten
│   ├── species.ts       alle Tierarten mit Rolle, Kost, Sinnen, Stärke
│   └── epochs.ts        Zeitalter: Zeitraum, Spieldauer, Lebensraum, Tiere, Ereignisse
├── state/GameState.ts   Leben (Lauf), verborgene Merkmale, Ruf, Stammbaum, Speichern
├── level/LevelGen.ts    erzeugt den Lebensraum für jedes Zeitalter (bei jedem Leben etwas anders)
├── art/                 alle Grafiken, per Canvas gemalt (Rauschtexturen, Schattierung, Randlicht)
│   ├── paint.ts         Malwerkzeuge: Haut, Augen, Zähne, Rauschen
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen, stufenlos aus den Merkmalen
│   ├── speciesArt.ts    alle anderen Tiere
│   ├── worldArt.ts      Hintergründe, Boden, Pflanzen, Dickicht, Effekte
│   └── uiArt.ts         Symbole und Titelbild
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── objects/             Spielfigur, Tiere (KI, Bindung, Durchzügler), Artgenossen, Nahrung, Steuerung
├── ui/ui.ts             Knöpfe, Texte, Menü-Steuerung, Überblendungen
└── scenes/              Titel, Intro, Level, HUD, Generationen, Stammbaum, Abspann
```

### Ideen für später

- [ ] Fortpflanzung im Level (Partnerwahl unter den Artgenossen)
- [ ] Weitere Entwicklungswege (z. B. Vögel oder Urmenschen) als eigene Äste
- [ ] Gamepad-Steuerung
- [ ] Echte Zeichnungen/Sprites (z. B. von OpenGameArt oder Kenney) statt gemalter Canvas-Grafik

## Veröffentlichung

Der Workflow in `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main` und
veröffentlicht es auf GitHub Pages (Settings → Pages → Source: **GitHub Actions**).
