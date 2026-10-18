# EVO – Die Suche nach Eden

Ein Überlebensspiel über Evolution im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript
und [Vite](https://vite.dev).

Du beginnst als winziger, schwacher Urfisch im Urozean – einer von wenigen deiner Art. Jedes
**Zeitalter** ist ein fester Zeitraum der Erdgeschichte, und wer bis zum Ende des Zeitraums
überlebt, dessen Linie zieht ins nächste Zeitalter weiter. Es gibt keine Punkte. Es geht **nur ums
Überleben – egal wie**. Am Ende des Devons herrscht ein Gigant, der Panzerfisch *Dunkleosteus* –
erst wer ihn besiegt, kommt weiter.

**Das hier ist eine Demo der Fischzeit:** Sie umfasst Ordovizium, Silur und Devon und endet mit
„Demo beendet“. Alles, was danach kommen sollte (Land, Reptilien, Säuger), ist vorerst gestrichen –
zuerst wird das Fischreich ausgebaut.

**Stirbst du, ist das Spiel vorbei.** Deine Linie stirbt aus – und bleibt als Ast im
**Stammbaum des Lebens**, der mit jedem Spiel weiterwächst.

> Fan-Projekt, inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne
> werden im Browser erzeugt – es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## So spielt sich EVO

- **Überleben, wie du willst:**
  - **Verstecken** – nur mit der **passenden Farbe**: Wer **grün** ist, verschwindet im Gras (Dickicht);
    wer **schwarz** ist, in der Dunkelheit (tief unten, in Tunneln). Ohne Farbe sieht man dich überall – auch im
    Gras. Die Farbe bekommst du in den **Höhlen** (siehe unten). Große Räuber, die nur durchziehen,
    schwimmen fast immer einfach vorbei.
  - **Hinterhalt wie bei Teemo** – wer in seinem Versteck (Gras bei Grün, Dunkelheit bei Schwarz) **1,5 Sekunden
    ganz still** hält, ist bereit: Der nächste Angriff trifft aus dem Hinterhalt deutlich härter – auch noch gleich
    nach dem Hervorbrechen. Ohne passende Farbe gibt es keine Überraschungsangriffe.
  - **Kämpfen** – angreifen tun nur der **Biss** (E) und der **Stoß** (R); bloßes Berühren tut
    niemandem etwas (außer Quallen) – man kann also an jedem Tier vorbeischwimmen. Der Stoß geht von
    Anfang an: Er macht kaum Schaden, **betäubt** kleine und mittelgroße Tiere aber kurz – Zeit für ein,
    zwei Bisse. Wer oft stößt, bekommt einen harten, später gepanzerten Kopf. Beim Biss schnellt das Tier nach vorn, reißt das Maul auf, schnappt zu und knirscht mit den
    Kiefern – mit starkem Gebiss deutlich wuchtiger. Zweimal schnell hintereinander zugebissen heißt:
    gepackt – kleinere Tiere zappeln dann nur noch.
  - **Jagen mit Plan** – kleine Fische sind auf der Flucht pfeilschnell und schwimmen davon, sobald
    man näher kommt. Wer lange ruhig in der Nähe bleibt (nicht sprinten, nicht kämpfen), kommt etwas
    näher heran – ganz nah lassen sie einen aber nie: Hinterhalt, Stoß und schnelle Bisse sind gefragt;
    zu Beginn sind kleine Fische mit zwei Bissen erledigt. Oder man **reizt einen großen Räuber**
    (beißen, stoßen, frech nah heran) und schwimmt davon: Er verfolgt einen und reißt unterwegs alles,
    was ihm vor das Maul kommt – bis man sich versteckt. Was er liegen lässt, kann man fressen. Mittelgroße Tiere wehren sich und beißen zurück. Die großen kann
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
- **Orte und Weltkarte:** Jedes Zeitalter hat **zehn Orte** – und jeder ist **deutlich größer** als früher: breit nach
  links und rechts, aber auch tief nach unten. Die Orte unterscheiden sich in **Form**, Leben und Licht:
  - **Der Startort** ist eine **Mulde** (ein Ufer fällt sanfter ab als das andere) und wimmelt von **kleinen Fischen**.
  - **Bewachsene Orte** (Tangwiese, Schwammgarten, Tangdickicht, Korallengarten) sind **flach und üppig**: dichter
    Bewuchs, viel Nahrung, kaum Jäger.
  - **Trübe Orte** (Trübe Bucht, Sandfeld, Schlickebene …) sind **Hügelketten** oder flache Sandebenen – man sieht
    kaum etwas, und auch du wirst schlechter gesehen.
  - **Tiefe Orte** (Tiefe Kante, Klippenhang, Dunkler Graben, Steilwand) fallen in einem **V-förmigen Trichter** oder
    zerklüfteten Hängen immer weiter ab, die **Abgründe** als **Schacht zwischen zwei Rändern**. Dort gibt es
    **kaum Fische, aber sehr starke, große Tiere**. Je tiefer du schwimmst, desto **trüber und dunkler** wird es:
    Um dich bleibt nur ein kleiner Lichtkreis, die Musik verklingt, das Meer rauscht, dein Herz schlägt, und
    manchmal grollt es in der Ferne.
  - **Licht fällt nur stellenweise** ins Wasser – dazwischen liegt Schatten. Es gibt keine Felstürme, die den Weg
    versperren; der Grund hat nur niedrige Buckel.
  - **Farbtunnel sind selten und gut versteckt:** Nur **zwei Orte im ganzen Zeitalter** haben einen – ein
    **grüner** (mit Querbinden wie bei einem Barsch) und ein **schwarzer** in der Tiefe. Wer auf der anderen Seite
    herauskommt, hat die neue Farbe. Die Farbe lässt sich **nur einmal pro Spieldurchlauf** wählen – wer einmal
    gefärbt ist, wird nicht mehr umgefärbt. Die **Färbung** steht auf der Steintafel. Daneben gibt es einige
    niedrige **Felsspalten** zum Verstecken für Schlanke.
  - **Neue Orte schaltest du frei, indem du hinausschwimmst:** An den Rändern (links/rechts in der Wand),
    **im Boden** (ein Schacht nach unten) und **oben im Licht** liegen **Durchgänge** – man muss sie erst
    finden. Schwimmst du durch einen hinaus, landest du auf der **Karte**, und der Ort, zu dem du schwimmst,
    **erscheint dort zum ersten Mal**. Du kommst am Gegenstück des Durchgangs im neuen Ort heraus. Die Karte
    zeigt **nur, was du schon entdeckt hast**; der Rest bleibt im Dunkeln. Jeder Weg kostet etwas Zeit. Das Meer
    ist tief: Oben fällt das Licht herein, nach unten wird es immer dunkler.
- **Wachsen in Stufen – und nach deinem Spielstil:** Gebiss, Schädel, Wuchs und Reißzähne wachsen in
  einem Zeitalter nur **bis zu einem Deckel**, dann ist Schluss – ein Zeitalter bringt eine Stufe.
  Nach drei Zeitaltern mit starkem Gebiss hat man ein wahres Monstermaul, vorher nicht. **Wie** du
  wächst, hängt davon ab, was du tust: Wer sich mit **Starken anlegt** und Fleisch frisst, bekommt
  ein stärkeres Gebiss; wer **kleine Fische jagt**, wird eher **flink und wendig**; wer die meiste Zeit
  **in der Tiefe überlebt**, wird selbst größer, massiger und gefährlicher. Die **Größe** hängt also am Verhalten – und
  mit ihr Hunger, Tempo und Kraft.
- **Kompromisse:** Alles hat seinen Preis. Wer durch viel Beißen ein **starkes Gebiss** bekommt und damit größere
  Tiere erledigt, schwimmt dafür **langsamer** und wird **schneller müde**; ein harter Schädel macht ebenso träge.
  Schlanke Jäger sind flink und halten länger durch, hauen aber weniger weg. Das steht (verdeckt) hinter dem
  Aussehen – die Tafel zeigt es als **Ausdauer**.
- **Kraft, Ermüdung und Ruhe:** Spurt (W), Stoß (R) und kräftiges Beißen kosten **Kraft**. Wer ständig stößt
  und sprintet, ist irgendwann **erschöpft** – dann geht es nur noch lahm voran, ohne Spurt und Stoß. Verschiedene
  Fische ermüden **verschieden schnell** (siehe Kompromisse). Beim normalen Schwimmen kehrt die Kraft nur langsam
  zurück; **ausruhen** geht schneller: nichts tun und sich **vom Wasser treiben lassen** (man steht dabei nie ganz
  still, sondern gleitet leicht nach links oder rechts). So füllt sich die Kraft **ganz**; die **Lebenskraft** kehrt
  beim Ausruhen aber nur **bis etwa drei Viertel** zurück (und nur, wenn man nicht ausgehungert ist). Alles darüber
  heilen **Heilkräuter** (hellgrün mit rosa Blüten, goldener Schimmer) – manche Pflanzen heilen also, **Fleisch
  heilt nicht**, es macht nur satt.
- **Stärkere Gegner:** Räuber, Riesen und Verteidiger haben deutlich mehr Lebenskraft und **richten
  mehr Schaden an** – zwei, drei Treffer können reichen. Dafür wehren sie sich **sichtbar**: Sie
  spannen sich vor dem Angriff an und glühen auf, schnellen mit einer Spur vor, und wer sie anbeißt,
  muss mit **Gegenwehr** rechnen. Treffer schleudern dich zurück, betäuben kurz und lassen dich bluten.
  Zu fliehen ist oft die beste Idee.
- **Wer frisst wen:** Große Jäger jagen nur, wenn sie Hunger haben – satt liegen sie oft lange am
  Meeresgrund (bzw. am Boden) und dösen. Kleine Tiere fliehen früh und verstecken sich im Dickicht,
  in Höhlen und Felsspalten, bis die Gefahr vorbei ist.
- **Hunger:** Der Magen startet etwa halb voll und leert sich ständig – auch in Ruhe spürbar, beim
  Schwimmen deutlich schneller (am Grund entlangzulaufen spart Kraft). Je leerer er ist,
  desto langsamer sinkt er – ganz leer wird er nie, verhungern kann man also nicht. Aber wer sehr
  hungrig ist, wird schwächer (Biss und Stoß), langsamer und hält bei Angriffen viel weniger aus:
  Verstecken hilft zu überleben, satt wird man davon nicht. **Einen Hungerbalken gibt es nicht** –
  der Magen knurrt, das Bild wird dunkler, und genau nachsehen kann man nur auf der Steintafel
  (siehe unten). Fressen füllt ihn wieder auf, aber nie über das Maximum. Wie viel hineinpasst,
  hängt von der Größe ab: Große Tiere richten mehr Schaden an, verbrauchen aber auch mehr. Ein
  Happen bringt wenig – jeder zeigt kurz, was er gebracht hat: **rot** für Fleisch, **grün** für
  Pflanzen (eine Pflanze „+1“, ein kleiner Fisch etwa „+3“). Manche Pflanzen sind giftig: Sie
  brennen, machen aber kurz hellwach und schnell.
- **Fleisch wie in E.V.O.:** Ein erlegtes Tier leuchtet kurz auf und wird zu einer **saftigen
  Fleischkeule mit Knochen**, große Tiere zu mehreren. Das Fleisch sinkt zügig zu Boden
  (große Stücke schneller) – und nach einer Weile verdirbt es. Andere Fleischfresser
  fressen mit, sobald sie drankommen: Wer zu lange wartet, geht leer aus.
- **Herrscher des Devons:** Kurz vor Schluss des letzten Zeitalters erscheint der Endgegner –
  *Dunkleosteus*, mit Lebensbalken unten im Bild. Er folgt dir von Ort zu Ort. Überlebst du, ohne
  ihn zu besiegen, bleibt deine Linie im Devon: eine neue Generation, etwas später, etwas stärker.
  Man spielt das Zeitalter also mehrmals und entwickelt sich weiter – anfangs frisst man nur die
  kleinen Fische, später größere. Erst wer den Herrscher besiegt, beendet die Demo.
- **Überraschungsangriff:** Wer aus Dickicht, Höhle, Felsspalte oder gut getarnt angreift (das Tier
  ist dann leicht durchsichtig), trifft mit dem ersten Biss oder Stoß zwei- bis dreifach und betäubt.
- **Riesen:** Zu Beginn mancher Zeitalter rast etwas Gewaltiges vorbei – im Ordovizium ein
  Riesenkopffüßer, im Silur *Pterygotus*, im Devon *Dunkleosteus*. Vorher wird das Wasser dunkler,
  es grollt, das Herz klopft, und die kleinen Fische fliehen: Zeit, sich zu verstecken. Selten
  streifen auch große Jäger wie *Megalograptus*, *Cladoselache* oder *Hyneria* umher. Wen ein Riese
  reißt, von dem bleibt meist etwas übrig …
- **Ein Schatten in der Tiefe:** Im Silur wird plötzlich alles langsamer, die Kamera rückt an dein
  Tier heran, die Musik verklingt und das Meer rauscht lauter – du hältst inne, während weit hinten ein
  riesiger Fisch vorbeizieht. Dann geht es weiter, als wäre nichts gewesen.
- **Tiere ihrer Zeit:** Jedes Zeitalter hat **seine eigenen Fische** (und ihre Nachbarn), jede Art lebt in ihrer
  Wasserschicht und an den Orten, die zu ihr passen – mit eigenem Verhalten. **Jeder Ort hat außerdem seine eigene
  Mischung**: Manche Arten fehlen dort fast ganz, andere sind besonders häufig. Es gibt gut zwei Dutzend Arten:
  - **Ordovizium** – die ersten Wirbeltiere: *Arandaspis*, *Astraspis*, *Eriptychius*, *Sacabambaspis* und andere gepanzerte
    Kieferlose, der aalartige *Conodont* (ein kleiner Jäger), Trilobiten (*Isotelus*), Quallen und Orthoceras. Seeskorpione
    sind hier selten.
  - **Silur** – *Pteraspis* (Panzerkopf mit Schnabel), *Thelodus* und *Lasanius* (Schwarmfische), der aalartige
    *Jamoytius*, *Birkenia*, *Cephalaspis*, der wehrhafte Stachelhai *Climatius* und *Entelognathus*, einer der ersten
    Kieferfische (ein gepanzerter Jäger).
  - **Devon** – das Zeitalter der Fische: *Moythomasia*, *Acanthodes* (Schwärme), *Cheiracanthus*, die Lungenfische
    *Dipterus*, *Drepanaspis*, *Bothriolepis* und *Pterichthyodes* (Panzerfische mit Ruderarmen), die Jäger *Coccosteus*,
    *Osteolepis*, *Cheirolepis*, *Cladoselache*, der Hai *Stethacanthus* mit seinem „Amboss“, *Rolfosteus*, die
    Fleischflosser *Eusthenopteron*, *Holoptychius* und *Tiktaalik* – dazu der Herrscher *Dunkleosteus*.
  - **Wer flieht, ist weg:** Kleine Fische rennen wirklich davon – wer lange flüchtet und aus dem Bild ist (oder am Rand
    des Ortes nicht weiterkommt), ist **entkommen und verschwunden**. Nach einer Weile ziehen andere Fische dort wieder ein.
  Kein Tier gleicht dem anderen ganz – manche sind etwas größer, andere etwas kleiner.
- **Strömungen und Felsspalten:** Strömungen reißen Kleine mit – massige Tiere schwimmen dagegen an.
  Unter Felsplatten liegen enge Spalten, in die kein großer Jäger passt; wer selbst zu groß und
  massig wird, aber auch nicht mehr.
- **Drei Entwicklungslinien – ohne Wahl:** Man wählt nicht mehr, was man wird. Jedes Zeitalter zählt **einen Punkt**
  für die Linie, die zum **Spielstil** dieses Zeitalters passte:
  - **Panzer** – wer viel rammt, einsteckt und sich einen harten Schädel holt: wuchtig, gepanzert, stumpfer Kopf, hoher Kamm,
    stahlgrau, mehr Lebenskraft, dafür etwas langsamer.
  - **Jäger** – wer schnell schwimmt und viel jagt: lang, schlank, großer Schwanz, spitze Schnauze, blaugrau, schneller.
  - **Fleischflosser** – wer sich am Grund bewegt und viel versteckt: kräftige Stielflossen, olivfarben mit rostigen
    Flossen, zäh und gut am Boden.
  Nach drei Zeitaltern ergeben sich **zehn Grundformen**: 3-0-0 (rein), 2-1-0 (Hauptlinie mit etwas von einer zweiten)
  oder 1-1-1 (von allem etwas). Größe, Gebiss, Farbe und Werte kommen zusätzlich aus dem, was du tust. Nach dem Zeitalter
  siehst du dein Tier „einst“ und „heute“; was sich verändert, zeigt der Sprung über die Jahrmillionen.
- **Die Steintafel (Taste C):** Eine **gebrochene, vermooste Steinplatte** mit Rissen und eingemeißelten
  Runen – anfangs ist alles überwuchert; die Zeilen sitzen auf leicht versetzten Platten.
  Jede **Muschel**, die du findest, legt eine Zeile frei: zuerst der **Nahrungsbedarf** (die erste
  Muschel liegt im ersten Gewässer direkt vor dir), später Gewicht, Körpertemperatur, **Färbung** (aus den Höhlen), Gebiss,
  Länge, Lebenskraft, Schädel, Kost, Tarnung, Wuchs, Flinkheit, **Ausdauer**, Bodenkontakt, Zusammenhalt und Nerven.
  Alles, was man trainieren kann, wird in **ein bis drei Fischen** gewertet: einer für „ein
  bisschen“, zwei für mehr, drei für stark. Die Muscheln sind schlichte Spiralmuscheln in Creme und Rosa. Sie sind selten – sie liegen in Höhlen, Felsspalten
  und weit draußen am Grund, in der Tiefe am weitesten weg. Rechts neben der Tafel siehst du dein
  Tier und deine Muscheln. Den Hunger sieht man sonst nirgends im Spiel; die **Zeit** läuft oben im Bild. Das meiste
  andere an deinem Tier bleibt verborgen – es zeigt sich nur in dem, was es tut.
- **Vier Verhaltensweisen formen deine Art:** Beutejagd (zubeißen, Beute packen und festhalten) →
  kräftige Kiefer; Bodenkontakt (sich am Grund abstützen und dort entlanglaufen) → fleischige
  Stützflossen, später kräftigere Beine; Stoßen → ein gepanzerter Schädel; Schwimmen (Strecke,
  Tempo, gegen Strömungen) → ein länglicher, flinker Körper. Das Verhalten schaltet keine Art frei –
  es verschiebt nur nach und nach, wie deine Nachkommen aussehen und was sie können.
- **Ereignisse** je Zeitalter: große Räuber ziehen durch, Stürme wühlen das Wasser auf, Futter
  sprießt.
- **Zwischen den Zeitaltern** siehst du dein Tier „einst“ und „heute“, dann vergehen Jahrmillionen –
  und was sich bewährt hat, setzt sich in dieser Zeit fort: je mehr Jahre, desto deutlicher.
- **Blutig:** Bisse und Stöße bluten – als Wolke im Wasser dort, wo gekämpft wurde, und als Fleck
  am Boden.
- **Keine Spoiler:** Zeitalter, die noch niemand erreicht hat, bleiben im Stammbaum und in der
  Zeitleiste Fragezeichen.

Kaum Zahlen und Balken – im Spiel ist fast nichts eingeblendet: oben in der Mitte die **Zeit** (Name des
Zeitalters, „vor 470.000.000 Jahren“ – die Jahre zählen mit der Zeit rückwärts – und die Zündschnur), oben links der Ort und (wenn er kommt) der
Lebensbalken des Herrschers. Nur wenn die Kraft schwindet, erscheint kurz ein dünner Balken am Fisch. Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand,
am Herzschlag und am Tier selbst (eingefallene Flanken, Narben, Blick …). Schwer verletzt färben
sich alle vier Bildränder rot, und das Tier wird ein klein wenig langsamer.

### Der Stammbaum

Jedes Spiel ist ein Pfad von der Wurzel (dem Urahn) nach unten – nach unten vergeht die Zeit.
Linien, die sich gleichen, teilen sich einen Ast; wo sie sich unterscheiden, verzweigt er sich.
Ausgestorbene Zweige enden mit einem Schädel (mit Zeitpunkt und Ursache), gut angepasste Linien
reichen weiter – vielleicht bis heute. Der Baum ist vorher nicht festgelegt, er entsteht nur
durch das Spielen.
Oben rechts im Stammbaum lässt er sich zurücksetzen (zweimal klicken – das löscht alle Äste und das
laufende Spiel).

<details>
<summary>Spoiler: Wie die verborgene Anpassung funktioniert</summary>

Im Hintergrund wachsen langsam (mit abnehmendem Ertrag) einige Merkmale, die man nie als Wert sieht:

| Wer so lebt … | … dessen Nachkommen bekommen |
| --- | --- |
| frisst Pflanzen, weicht aus, versteckt sich, entkommt Jägern | Tarnmuster, schlankeren und kleineren Körper, mehr Tempo, größere Augen |
| liegt oft still am Boden | sandig braun-graue Farben |
| rammt viel, steckt ein, holt sich einen harten Schädel (im Zeitalter) | die **Panzer**-Linie: wuchtiger Körper, hoher Kamm, kleinere Flossen, mehr Lebenskraft |
| schwimmt viel und schnell, jagt viel | die **Jäger**-Linie: länger, schlanker, großer Schwanz, spitze Schnauze, mehr Tempo |
| bewegt sich viel am Grund, versteckt sich lange | die **Fleischflosser**-Linie: Stielflossen, kräftig, olivfarben mit rostigen Flossen |
| stößt oft (Taste R) | einen härteren Schädel und einen kräftigeren Stoß |
| … und erlegt damit Tiere | einen **Panzerkopf**: Der Kopf selbst wird größer und fester (es wächst nichts dazu), stärkerer Stoß, mehr Lebenskraft, weniger eigener Schaden |
| beißt, packt und frisst Fleisch | längere Schnauze, tieferen Kiefer, mehr und größere Zähne – und vorn herausstehende Reißzähne |
| stützt sich oft am Grund ab und läuft dort entlang | fleischige **Stützflossen** (schneller am Grund, hält sich in Strömungen) |
| kämpft oft gemeinsam mit Artgenossen und teilt die Beute | wird zum **Rudeltier**: Artgenossen helfen öfter (und wollen mitfressen) |
| frisst oft Fleisch bzw. Pflanzen | verdaut es besser (mehr Kalorien je Happen) – nirgends angezeigt |
| bleibt nah bei Jägern, ohne aufzufallen | stärkere Nerven: Jäger bemerken einen später – nirgends angezeigt |
| frisst giftige Pflanzen | wird giftfester – nirgends angezeigt |
| frisst viel | wächst |
| hält sich oft oben im Licht bzw. unten in der Tiefe | hellere bzw. dunklere Färbung |
| schwimmt viel und schnell – besonders gegen Strömungen | deutlich länglicheren, schlankeren Körper und größere Flossen |
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

Die rechte Hand liegt auf den Pfeiltasten, die linke auf **Q W E R**. Im Spiel wird die Steuerung
nicht eingeblendet – sie steht im Titelbild unter „Steuerung“ und in der Rast (Esc).

| Taste | Aktion |
| --- | --- |
| ← → ↑ ↓ | schwimmen |
| Leertaste | auftauchen |
| E (auch Q oder J) | beißen und fressen |
| W (auch Shift) | sprinten (kostet Kraft) |
| (nichts tun) | ausruhen: sich treiben lassen, Kraft und Lebenskraft (bis ¾) kehren zurück |
| R | Stoß (betäubt kleine und mittelgroße Tiere kurz) |
| C | Steintafel: Werte, Hunger, Muscheln |
| Esc / P | Rast (Pause) mit Steuerung |
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
  ausgeblendet – auch breite Orte kosten kaum mehr.
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
│   ├── classes.ts       Körperformen mit Grundwerten
│   ├── species.ts       alle Tierarten mit Rolle, Kost, Sinnen, Stärke
│   ├── epochs.ts        Zeitalter: Zeitraum, Spieldauer, Tiere, Ereignisse
│   ├── world.ts         Orte je Zeitalter (Lage auf der Karte, Bewuchs, Tiefe, Muscheln)
│   └── tablet.ts        die Zeilen der Steintafel und wie sie berechnet werden
├── state/GameState.ts   Leben (Lauf), verborgene Merkmale, Ruf, Stammbaum, Speichern
├── level/LevelGen.ts    erzeugt jeden Ort (bei jedem Leben etwas anders, aber immer derselbe Ort)
├── art/                 alle Grafiken, per Canvas gemalt (Rauschtexturen, Schattierung, Randlicht)
│   ├── paint.ts         Malwerkzeuge: Haut, Augen, Zähne, Rauschen
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen, stufenlos aus den Merkmalen
│   ├── speciesArt.ts    alle anderen Tiere
│   ├── worldArt.ts      Hintergründe, Boden, Pflanzen, Dickicht, Effekte
│   ├── tabletArt.ts     Steinplatte, Moos, Fische für die Wertung, Muschel
│   ├── mapArt.ts        die Weltkarte
│   └── uiArt.ts         Symbole und Titelbild
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── objects/             Spielfigur, Tiere (KI, Bindung, Durchzügler), Artgenossen, Nahrung, Steuerung
├── ui/                  Knöpfe, Texte, Menü-Steuerung (ui.ts), die Steintafel (tablet.ts, tabletScreen.ts)
└── scenes/              Titel, Intro, Level, Karte, HUD, Generationen, Stammbaum, Demo-Ende
art/                     Ist-Stand aller Grafiken als PNG (alt/), Biss-Vorlagen als SVG (vorlagen/), Ablage für eigene Bilder (neu/) – siehe art/README.md
tools/                   bite_sheets.py (Biss-Vorlagen der Linien), fish_sheet.py (Bewegungs-Sprite-Sheet eines Fisches)
```

### Ideen für später

- [ ] Fortpflanzung im Level (Partnerwahl unter den Artgenossen)
- [ ] Weitere Orte, Tiere und Zeitalter im Fischreich
- [ ] Gamepad-Steuerung
- [ ] Echte Zeichnungen/Sprites (z. B. von OpenGameArt oder Kenney) statt gemalter Canvas-Grafik

## Veröffentlichung

Der Workflow in `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main` und
veröffentlicht es auf GitHub Pages (Settings → Pages → Source: **GitHub Actions**).
