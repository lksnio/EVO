# EVO: Living World

Ein Überlebensspiel über Evolution im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript
und [Vite](https://vite.dev).

Du schlüpfst als winziger, schwacher Urfisch im **Laichfluss** – einer von wenigen deiner Art. Du
**wächst heran**, und sobald du ausgewachsen bist, kehrst du in den Fluss zurück und **laichst**. Wer
gelaicht hat, darf sterben, ohne zu verlieren: Aus dem Gelege schlüpft die **nächste Generation**, und du
spielst als ihr Jungtier weiter – angepasst an das, wie du gelebt hast. Es gibt keine Punkte und keine
Abschnitte mehr: Die **Weltzeit läuft für alle gleich weiter**. Es geht **nur ums Überleben – und ums
Weitergeben**.

**EVO wird ein persistentes Online-Spiel:** eine Welt, die weiterläuft, in der mehrere Spieler einander
sehen und beeinflussen – und die auch mit nur einem Spieler lebt (KI-Tiere bleiben). Der erste Schritt
steht: Auf dem eigenen Server sehen sich die Spieler am selben Ort (siehe [Mehrspieler](#mehrspieler-prototyp)).
Gespielt wird in **sieben Zeitaltern**: Im Titelbild wählt man unter „Zeitalter“ zwischen **Devon**, **Karbon**,
**Perm**, **Trias**, **Jura**, **Kreidezeit** und **Paläogen** – jedes ist eine eigene Welt mit eigener Linie, eigenem
Stammbaum-Ast und eigenem Teil in der Chronik des Lebens; im Mehrspieler trifft man dort alle, die dasselbe Zeitalter gewählt haben.
Spielbar sind vorerst das **Devon** – dort beginnt jedes Leben – und das **Karbon** mit *Pederpes*, Gelege und
Generationen (siehe [Das Karbon](#das-karbon-gelege-metamorphose-generationen)); die anderen ruhen noch „im Gestein“
(siehe [Zeitalter wählen](#zeitalter-wählen)).

**Stirbst du, wählst du ein Ei aus dem Laich deiner Linie** – ein Geschwister oder eines der nächsten Generation. **Liegt
kein Laich mehr da und wartet kein Geschwister, stirbt deine Linie aus** – und bleibt als
Ast im **Stammbaum des Lebens**, der mit jedem Spiel weiterwächst.

**Das Logo** spielt mit dem Namen: **EVO** und **LıVING** stehen auf einer Höhe, darunter weit gesperrt **WORLD** zwischen
zwei feinen Linien mit kleinen Rauten. Das i in LIVING hat **keinen Punkt und keine Serifen** – nur ein kurzer, schlichter
Strich, kaum höher als die halbe Buchstabenhöhe. So liest man beides: *EVO LIVING WORLD* und, weil das i so leise ist,
*EVOLVING WORLD*. Die Abstände zwischen den Buchstaben sind von Auge ausgeglichen; hinter der Schrift liegt ein weicher
Schatten, damit das Bild dahinter zurücktritt. Das Logo atmet sich beim Start ins Bild, die Linien wachsen aus der Mitte,
WORLD rückt zusammen, und ab und zu streicht ein Glanz über die Buchstaben (gezeichnet in `drawLogo` in
`src/scenes/TitleScene.ts`).

**Das Titelbild** zeigt eine Höhle am Grund des Urmeers: Rechts liegt das **versteinerte Skelett eines Urfisches** im
Sand, nach links läuft das Bild weich ins Dunkel aus – dort stehen Titel und Menü (Pfeiltasten und Eingabe oder die Maus).
Von oben fällt ein **Lichtstrahl** herein und malt ein Lichtnetz auf den Grund, Schwebeteilchen treiben, aus einer Spalte
steigen Blasen, vorn wiegen sich Algen, in der Ferne zieht ab und zu ein Schwarm vorbei. Ganz langsam kommt die Kamera
näher und weicht wieder zurück. Das Menü: **Weiterleben**, **Zeitalter** (für das erste Leben „Leben beginnen“),
**Stammbaum**, **Chronik des Lebens**, **Steuerung** – die angewählte Zeile leuchtet warm auf, rückt ein, davor erscheint eine feine
Linie mit einer kleinen Raute, und ein Glanz streicht einmal über die Buchstaben. Unten links stehen das gewählte Zeitalter
und seine Weltzeit, die für alle gleich weiterläuft, unten rechts deine Linie und ihre Generation (das Bild:
`src/assets/title/fossil.webp`).

> Inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne werden im Browser erzeugt –
> es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## Zeitalter wählen

Unter „Zeitalter“ (bzw. „Leben beginnen“) stehen die **sieben Zeitalter** nebeneinander – sieben Bilder, so hoch wie der
Bildschirm. Das gewählte öffnet sich weit, die anderen bleiben schmale Streifen **wie Buchrücken**: oben der Zeitraum
(„359 – 299 Mio. J.“), der Name senkrecht, unten die römische Nummer und der Stand (Generation, „spielbar“ oder ein
Ammonit für „noch im Gestein“). Wer mit der Maus auf ein anderes Bild fährt (oder ← → drückt), öffnet es. Jedes Bild
**lebt**, und ganz langsam kommt man näher – das geöffnete folgt dazu ein Stück der Maus:

- **I · Devon** – *Das Zeitalter der Fische* (spielbar): Licht fällt von oben und atmet, ein Lichtnetz spielt auf dem
  Grund, Schwebeteilchen treiben, Blasen steigen, ein Schwarm *Moythomasia* zieht vorbei. Darunter **Weiterleben** (bzw.
  **Leben beginnen**) und **Neue Linie** (mit Rückfrage – die jetzige endet dann). Wer aufbricht, hört einen tiefen Sog
  und einen weiten Chor, das Bild öffnet sich ganz, und man taucht hinein.
- **II · Karbon** – *Die Kohlewälder* (spielbar): Im Sumpfwald ziehen **Nebelbänke** in mehreren Höhen und Geschwindigkeiten zwischen
  den Stämmen hindurch und atmen dabei, fahles Licht fällt schräg herein, Sporen treiben, das stille Wasser glänzt matt
  (die Riesenlibelle des Bildes bleibt, wo sie ist).
- **III · Perm** – *Das Reich der Segelrücken*: Hinter den Palmfarnen **glüht die Sonne im Dunst**, warme Strahlen fallen
  schräg, goldener Staub steigt auf, ein Dunstband zieht am Horizont, vorn **wiegt sich ein Farn** im Wind, in der Ferne
  eine Libelle.
- **VI · Kreidezeit** – *Die Herrschaft der Meeresechsen*: das Meer wie im Devon, mit einem Schwarm *Apsopelix*.
- **IV · Trias**, **V · Jura**, **VII · Paläogen**: Ihre Bilder fehlen noch – dort steht eine **dunkle Steintafel** aus
  Gesteinsschichten mit einem **eingemeißelten Fossil** (Ammonit, Plesiosaurier, Hai), feiner Staub rieselt, und in ihren
  **Rissen glimmt Glut**: Bald bricht sie auf. Titel, Zeile und Text stehen schon.

Alle Zeitalter außer Devon und Karbon **ruhen noch im Gestein**: Ihre Bilder sind grau wie Stein, mit feiner Maserung und Rissen;
wählt man eines an, kehrt die **Farbe zum großen Teil zurück**, Maserung und Risse treten zurück, und ein Lichtstreif
streicht über den Fels wie über eine Fossilplatte. Statt der Knöpfe steht dort ein Ammonit-Zeichen und „Noch im Gestein“.
Ein Klick darauf: Stein reibt über Stein, die Glut in den Rissen flackert auf – es rührt sich (noch) nichts.

Jedes Zeitalter hat **seine eigene Linie**: Wer das Zeitalter wechselt, lässt seine Linie dort ruhen und findet sie bei der
Rückkehr wieder (`enterEpoch`, `runIn` in `src/state/GameState.ts`) – das wird wichtig, sobald mehr als ein Zeitalter
spielbar ist. Die Bilder liegen in `src/assets/eras/` (Devon, Karbon, Perm, Kreidezeit – neue Bilder für Trias, Jura und
Paläogen kommen dorthin und in `LOOK` in `src/scenes/EraScene.ts`, wo auch steht, wie sie leben: Meer, Sumpf oder Land).

**Die Reihenfolge ist Teil des Spielstands** (Nummern): Nummer 0 war früher das Ordovizium und ist jetzt das Devon –
ältere Spielstände leben deshalb im Devon weiter. **Ordovizium und Silur sind verborgen** (`hidden`): Ihre Tiere, Orte
und Karten bleiben im Spiel (auch das Ordovizium-Bild `ordovizium.webp`), sie erscheinen nur nirgends. Für die
**Kreidezeit** gibt es 15 Tiere mit Steckbrief; ihre Orte und ihre Karte fehlen noch. Perm, Trias, Jura und
Paläogen haben bisher nur Name, Zeitraum, Zeile und Text (`later(...)` in `src/data/epochs.ts`). Spielbar wird ein
Zeitalter mit `playable: true`; `brood: true` gibt ihm den Ablauf des Karbons (Gelege statt Laichen), `meta: 'oxy'`
setzt Sauerstoff statt Sicht an die große Muschel.

## Das Karbon: Gelege, Metamorphose, Generationen

Das **Unterkarbon** (vor etwa 348 Millionen Jahren) ist das zweite spielbare Zeitalter. Man lebt als ***Pederpes*** –
einer der ersten Vierfüßer, halb im Wasser, halb an Land. Alle Zahlen stehen an einer Stelle in `src/data/karbon.ts`
(`BROOD`, `OXYGEN`, `CLIMB`, `KTRAIN`), die Rechnung dazu ohne Phaser und mit Tests in `src/sim/brood.ts`.

- **Die Welt:** eine zusammenhängende Wasser- und Sumpfwelt mit flachen Ufern und vielen Inseln über dem Wasser – der
  Brutsumpf, das Farnufer, die Inseln, das Moor, die Schlammbank, die Lagune, der Rhizodus-See, die Rinne, die Küste und
  **der Steile Fels**. Über der Wasserlinie läuft man (mit Schwerkraft), darunter schwimmt man; an der Wasserlinie geht
  es mit einem Satz ans Ufer. An Land leben Tausendfüßer, Urinsekten und Trigonotarbiden (kleine Beute) und der
  Lungenskorpion *Pulmonoscorpius*, im Wasser *Elonichthys*, *Acanthodes*, Garnelen (*Tealliocaris*), Pfeilschwanzkrebse
  (*Bellinurus*), der Lungenfisch *Ctenodus* und der Seeskorpion *Hibbertopterus*; die Räuber sind die Fleischflosser
  *Megalichthys* und *Strepsodus*, der Vierfüßer *Crassigyrinus* und – im See und ganz selten am Nest – der riesige
  *Rhizodus*. Inseln trennen die Gewässer: Fische bleiben in ihrem Tümpel, nur Pederpes geht über Land.
- **Lebenskraft, Ausdauer, Sauerstoff:** Sauerstoff ersetzt im Karbon die Sicht. An Land sinkt er stetig (fünf
  Bläschen neben dem Tier, ausgewachsen reicht er 26 Sekunden, Larven mit Kiemen nur gut die Hälfte), im Wasser füllt er
  sich wieder; leer **trocknet das Tier aus** und nimmt Schaden. Ausdauer kosten Spurt, Bisse und vor allem **Klettern**.
  Die große Muschel bietet Lebenskraft, Ausdauer und Sauerstoff (+15 % je Segen) mit der **gemeinsamen Kostenfolge**
  1, 2, 4, 8 … – im Karbon bleiben die Segen auch nach dem Aussterben.
- **Das Startgelege:** Jede Linie beginnt mit **100 Eiern** im Brutsumpf – alle mit Grundwerten. Man schlüpft als
  kleine **Larve mit Kiemen**. Was man frisst (Pflanzen, kleine Fische, Gliederfüßer), ist **Nahrung**: Mit 24 Nahrung
  kommt die **Metamorphose** (die Kiemen schwinden, das Tier wird groß). Bis dahin greift kein großer Räuber an – nur wer
  angegriffen wird, wehrt sich.
- **Die Gefahr:** Ab der Metamorphose läuft die Zeit bis zum neuen Gelege (5 Minuten, im HUD unter der Jahreszahl), und
  **Räuber kommen in Wellen ans Nest** – aus dem Wasser, in dem das Nest liegt, vom fernen Ende her, später größere. Am
  Nest fressen sie Eier, bis sie satt sind, und ziehen wieder ab; wer in ihrer Nähe ist, wird zuerst angegriffen. Wer das
  Nest verlässt (in einen anderen Ort), verliert alle 4 Sekunden ein Ei – „das Nest ist ungeschützt!“. Fressen ist jetzt
  keine Nahrung mehr, sondern **heilt**.
- **Tod und Ei-Wahl:** Stirbt man, solange Eier im Nest liegen, **wählt man eines von drei Eiern**: Jedes zeigt Gebiss,
  Beine, Griff und Schuppen so, wie die Übersicht sie zeigt (der erste Pederpes hat überall 10, die besten Werte leuchten
  ocker). Das Ei schlüpft am Nest – in der Gefahr gleich ausgewachsen –, und man spielt als dieses Tier weiter.
- **Die nächste Generation:** Wer die Zeit übersteht, legt ein **neues Gelege mit 100 Eiern** (auch wenn das alte leer
  war). Es trägt, was die Generation **getan** hat:
  - **Gebiss** – erlegte kleine Beute (Gliederfüßer, kleine Fische),
  - **Beine** – an Land gelaufene Strecke,
  - **Griff** – an steilen Hängen erklommene Höhe,
  - **Schuppen** – überstandener Schaden (Räuber am Nest, Bisse an Land, Austrocknen).

  Jede Richtung wächst je Generation um höchstens etwa 0,1 (mit abnehmendem Ertrag), die Eier streuen um ±0,05. Die
  Übersicht (C) zeigt unter „Diese Generation“, wie viel schon trainiert ist.
- **Aussterben:** Tot und keine Eier mehr – die Art stirbt aus. Die nächste Linie beginnt bei Generation 0 mit
  Grundwerten; die Segen der großen Muschel bleiben.
- **Kompromisse:** Beine und Griff lassen steilere Hänge zu (28° + 26° × Beine + 22° × Griff) und machen an Land
  schneller, bremsen aber beim Schwimmen. Schuppen schützen, machen an Land etwas langsamer und **das Klettern teurer**.
  Ist ein Hang zu steil, kommt man nicht weiter oder rutscht ab; erschöpft hält man sich fest und klettert erst weiter,
  wenn die Kraft zurück ist.
- **Das Ziel:** Auf dem **Steilen Fels** wartet der Gipfel. Unten kommt jeder Pederpes ein Stück hinauf (dort übt er
  das Klettern), nach oben wird es immer steiler – erst eine Linie mit kräftigen Beinen und gutem Griff kommt hinauf. Wie
  viel es braucht, verrät das Spiel nicht. Oben ist das Zeitalter gemeistert.
- **Zu zweit:** Jeder Spieler hat sein eigenes Jungtier und sein eigenes Gelege. Die Rollen entstehen aus dem
  Verhalten: Wer läuft und klettert, vererbt Beine und Griff (schnell an Land, verletzlich im Wasser); wer am Nest
  kämpft, vererbt Schuppen (geschützt, aber schwer am Hang).

## Ein Leben – und die nächste Generation

- **Heranwachsen:** Jedes Leben beginnt als **Jungtier** mit 40 % der ausgewachsenen Größe. Der Fisch wächst schnell, dann
  immer langsamer – schon nach **3 Minuten** Spielzeit ist er **ausgewachsen** (92 %): **Laichzeit**. Danach lebt er noch
  etwa **8 Minuten** – und **laichen kann er die ganze Zeit, bis kurz vor dem Tod** (auch im Alter); oder er geht gleich mit
  „Leben weitergeben“. In den letzten 40 % dieser
  Zeit ist er **alt** (langsamer, schneller müde, weniger Lebenskraft), in den letzten 40 Sekunden wird er spürbar langsamer,
  dann schläft er ein. Mit der Größe wachsen Lebenskraft, Biss, Stoß und Tempo: Beim Schlüpfen hat der Fisch **60 % seines
  ausgewachsenen Tempos**, bis zur Laichreife erreicht er es allmählich. Gezählt wird
  nur die Zeit, in der man spielt – wer offline ist, altert nicht. Gemeldet wird nur die Laichzeit (leise, oben links).
  Das Tempo steigt über die Generationen behutsam: **10 zusätzliche Flossenpunkte geben 10 % mehr Schwimmtempo**,
  **10 % zusätzliche Körperlänge geben 2 % mehr Grundtempo**. Auch ein Jungtier einer schnellen Linie muss erst
  heranwachsen, bevor es deren volles Tempo erreicht.
- **Dein Tier bleibt, wie es geschlüpft ist:** Im Leben wächst es nur heran und altert. Was es tut – sich verstecken, am Grund
  laufen, oben im Licht oder unten im Dunkeln schwimmen, durch eine Höhle tauchen, Treffer einstecken –, sammelt sich im
  Verborgenen und zeigt sich erst an seinen **Nachkommen**. Nirgends steht, was sich verändert hat: Man merkt es, wenn das
  nächste Tier heranwächst.
- **Jede Generation lebt etwas länger – logarithmisch:** Generation 1 hat 3 + 8 Minuten (bis zur Laichzeit + danach),
  Generation 2 schon 4 + 11, Generation 4 5 + 14, Generation 8 6 + 17, Generation 16 7 + 20 … Wer viel spielt, verändert sich so immer seltener und hat
  Zeit, sich mit seinem Tier anzufreunden.
- **Hunger gibt es nicht.** Man muss nicht fressen, um zu überleben, ist nie „satt“ und muss nirgends warten – Fressen nährt
  nur die **Brut**. Alles Gefressene (die kleinen Zahlen, die beim Fressen kurz aufsteigen) sammelt sich als **Nahrung** für
  den Nachwuchs. **Nahrung kommt in Brocken: klein (1) oder groß (5)** – jeder Brocken wird mit **einem Bissen ganz**
  gefressen, ebenso eine ganze Pflanze (1). Ein kleiner Beutefisch gibt einen kleinen Brocken, ein Conodont um 3 kleine,
  Orthoceras einen großen, ein Seeskorpion um 16, ein Riese wie Cameroceras um 43 (8 große und 3 kleine Brocken). Je
  stärker und größer die Beute, desto mehr (`meatOf` in `src/state/GameState.ts`: ein Zehntel ihrer Lebenskraft, gerundet,
  wenigstens 1).
- **Nachkommen aus Nahrung – sie sind deine Leben:** Jeder Fisch hat einen **Grundwert**: So viel Nahrung braucht ein
  Nachkomme. Beim ersten Fisch sind es **20**. **Beim Laichen** wird aus der gesammelten Nahrung Nachwuchs – je 20 einer,
  der Rest bleibt für das nächste Mal. **Mehrmals laichen zählt zusammen:** 50 gefressen und gelaicht ergibt 2 Nachkommen
  (10 bleiben übrig); wer später noch 10 frisst und wieder laicht, hat 3 – höchstens 24 in einem Leben. **Weiter entwickelte
  Nachfahren brauchen etwas mehr:** Jedes Prozent, um das dein ausgewachsenes Tier besser ist als der erste Fisch (Biss, Stoß,
  Schwimmtempo, Lebenskraft, Ausdauer, Zähigkeit – zusammengezählt), macht den Grundwert um 0,4 % größer. Gebiss 15 statt
  10 (50 % stärker) heißt also 24 je Nachkomme, Gebiss 20 (doppelt so stark) 28.
  Verschlechterungen (der Preis eines Kompromisses) ziehen nichts ab.
  Jeder Nachkomme ist ein **Ei im Laich** (siehe unten, „Der Laich“). Die
  **Übersicht (C)** trennt bereits befruchtete Eier dieses Lebens und verfügbare Nahrung. Dazu stehen der Bedarf je Ei
  und die Zahl weiterer möglicher Eier. Generation und Lebensabschnitt stehen direkt über deinem Fisch,
  wartende Geschwister unter Länge und Gewicht.
- **Vorerst schlüpfst du immer als Männchen** (auch jede neue Generation und jedes Geschwister): Befruchtbarer Laich deiner
  Art liegt im Startgebiet immer bereit. Das Weibchen-Laichen gibt es weiter im Spiel, man schlüpft nur gerade nicht als
  eines (`SPAWN.alwaysMale` in `src/data/life.ts`, auch in der Entwickler-Einstellung).
- **Den Laich besuchen (Taste E in der Grundbelegung – dieselbe wie zum Fressen; am Handy der Biss-Knopf, der dann „Laich“ heißt):**
  Der Laich im Startgebiet bleibt dauerhaft da. In seiner Nähe öffnet die Aktionstaste die **Eiübersicht**, auch als
  Jungtier oder ohne Nahrung. **Weiterschwimmen / Esc** kehrt zum eigenen Tier zurück. Das Ansehen kostet keine Nahrung.
  - **In dem Moment, in dem dein Tier ausgewachsen ist**, steht einmal kurz unter der Lebenslinie, dass Laichzeit ist und was
    noch fehlt („Laichzeit · noch 18 Nahrung“) – dann geht es langsam wieder weg. Nur ein Hinweis; eine dauernde Anzeige
    gibt es nicht (wann es geht, zeigt das Zeichen „E“).
  - **Das Zeichen „E“** erscheint über dem Laich in Reichweite; sein warmer Schimmer wird dort kräftiger.
    Am Handy steht über dem Laich „···“.
  - **Befruchten:** Der eigene Knopf in der Eiübersicht zeigt, wie viele neue Eier entstehen können. Erst beim Drücken
    (oder mit **B**) wird die gesammelte Nahrung verbraucht. Dafür musst du ausgewachsen sein und genug Nahrung für
    wenigstens ein Ei haben. Der Laich bleibt danach zugänglich; die Meldung nennt neue Eier und die Gesamtzahl
    bereits befruchteter Nachkommen dieses Lebens.
  - **Öfter befruchten:** Fressen gehen, wiederkommen und weitere Eier befruchten – nach acht Sekunden aktiven Lebens
    geht es erneut, bis höchstens 24 Nachkommen in diesem Leben erreicht sind.
  - **Das Leben freiwillig weitergeben:** Wähle ein Geschwister oder einen Nachkommen. Erst nach der Bestätigung
    **„Dieses Leben abschließen?“** endet dein jetziges Leben. Geschwister erhalten den Nachwuchs; mit der nächsten
    Generation gehen übrige Geschwister verloren. Im Koop siehst du am Ei den Namen des Mitspielers, der es gerade
    markiert. Markieren reserviert kein Ei; schlüpfen kann daraus nur einer.
- **Einschlafen und Aufwachen:** Am Ende seines Lebens wird dein Tier langsamer, dann still – es schließt die Augen und
  sinkt sanft ab, die Kamera kommt nah heran, die Anzeigen treten zurück, das Bild wird dunkel. (Genauso, wenn du es in der
  Rast (Esc) mit **„Leben weitergeben“** selbst beendest.) Dann wählst du ein Ei aus dem Laich (siehe unten); beginnt damit
  die nächste Generation, folgt der Einschnitt – Dunkelheit, die Generation, die Jahre. Danach **wachst du als schlüpfendes
  Jungtier wieder auf**: Das Bild wird langsam hell, die Augen öffnen sich, die Kamera zieht
  zurück, die Geschwister schwärmen aus, dann kommen die Anzeigen. Ein Druck auf eine Taste kürzt den Einschnitt ab.
- **Der Laich: Geschwister oder die nächste Generation.** Stirbt dein Tier – durch einen Räuber, an Altersschwäche oder
  durch „Leben weitergeben“ –, **wählst du ein Ei** (`RoeScene`), und das Tier daraus spielst du weiter, im Laichfluss, dort,
  wo es gelaicht wurde. Was die Linie weiß (Orte, Muscheln, Aufträge, deine Gruppe), bleibt; Alter, Nahrung und Spielweise
  beginnen neu.
  - **Laich zählt zusammen:** Jedes befruchtete Gelege legt seine Eier auf den **Stapel der Generation** – auch das, was
    Geschwister laichen. Legen drei Geschwister zusammen zehn Eier, wählt man in der nächsten Generation aus diesen zehn.
  - **Die Eier tragen die Werte zur Laichzeit:** Was ein Ei verspricht, steht beim Befruchten fest – so, wie dein Tier
    dann ist und gelebt hat (siehe unten, „Anpassung“). Jedes Ei variiert seinen neuen Zuwachs um ±50 %; bereits geerbte
    Werte streuen dabei nicht erneut.
  - **Goldene Geburt:** Jedes Ei leuchtet mit **5 %** Wahrscheinlichkeit golden (`SPAWN.gold`). Schon beim Laichen sieht man
    es: Das Gelege färbt sich golden, goldene Funken steigen auf, „GOLDENE GEBURT · +25 % Ausdauer“. Das Tier aus einem
    goldenen Ei hat **einen Segen mehr** in einer Richtung der großen Muschel – genau so viel, wie der nächste Segen
    bringen würde (+2,5 % Lebenskraft, +25 % Ausdauer, +5 % Sicht, im Karbon +15 % Sauerstoff). Er gilt **nur für dieses
    Tier**, nicht für die Linie, und macht den nächsten Segen nicht teurer. In der Laich-Wahl leuchtet das Ei golden, die
    Karte trägt ein goldenes Band.
  - **Die Wahl:** Oben stehen die **Geschwister** (Eier deiner Generation, die noch warten – der Urfisch hat keine), unten
    der **Laich für die nächste Generation**. Jedes Ei zeigt das ausgewachsene Tier und seine **Höchstwerte** (Lebenskraft,
    Ausdauer, Gebiss, Stoß, Tempo, Schuppen), daneben den Unterschied zu deinem Tier; die besten Werte einer Gruppe
    leuchten ocker, die stärksten Eier stehen vorn.
  - **Kein Weg zurück:** Ein Geschwister hält dich in deiner Generation (der Laich wartet weiter). Wer ein Ei der
    **nächsten Generation** wählt, beginnt sie – und **kommt nie mehr zurück**: Die übrigen Geschwister sind dann verloren,
    der übrige Laich sind die neuen Geschwister. Vor jedem Schlüpfen fragt das Spiel nach; zu Lebzeiten steht dort
    „Dieses Leben abschließen?“. Erst nach dem Tod ohne Laich und ohne Geschwister stirbt die Linie aus.
  - **Im Koop teilen alle denselben Laich** (siehe [Mehrspieler](#mehrspieler-prototyp)): Was einer laicht, liegt für alle
    da, und man wählt aus der gemeinsamen Menge – ein Ei bekommt nur, wer zuerst kommt. **Geht einer in die nächste
    Generation, kann der andere nach seinem Tod auch nur noch dorthin** (die Laich-Wahl sagt es: „Generation 2 · dein
    Artgenosse ist schon dort“; im Spiel erscheint „Ben ist in Generation 2 – nach deinem Tod geht es nur noch dort
    weiter“). Stirbt jemand und es liegt **kein Laich mehr** da, ist **die Art ausgestorben – für alle**: Ein eigener
    Abschied („Die Art ist ausgestorben · Zu wenige Artgenossen“, die leeren Eihüllen, wer zuletzt starb, die Letzten ihrer
    Art), danach der Stammbaum.
- **Anpassung statt Platten:** Pro Generation stehen vor Varianz höchstens **15 Punkte** bereit. Der Pflanzenanteil der
  Nahrung erhöht die **Lebenskraft**, der Fleischanteil verteilt sich auf **Gebiss, Schädel, Flossen und Schuppen**.
  Nur besiegte Gegner zählen für die Kampfwertung, auch ohne sie zu fressen. Die Menge und relative Stärke bestimmen den
  Zuwachs: Acht ebenbürtige Siege erschließen das volle Fleischbudget; stärkere Gegner zählen entsprechend mehr.
  Jedes Ei variiert nur seinen neuen Zuwachs um **−50 % bis +50 %**. Gegenpaare sind Gebiss/Schädel und Flossen/Schuppen:
  Der Gegenwert verliert die Hälfte der unteren Schranke des positiven Zugewinns. Muschel-Segen haben keine Gegenkosten.
- **Die Weltzeit** läuft für alle gleich (heute nach der Uhr des Rechners, im Mehrspieler nach der des Servers): Die
  12 Millionen Jahre des Devons (vor 383 bis 371 Millionen Jahren) dauern etwa 30 echte Tage. Die Ereignisse eines Zeitalters (Durchzügler, Blüte,
  Stürme …) kehren darin immer wieder – für alle zugleich. Oben im Bild stehen die Jahre – sie laufen **Jahr für Jahr**
  rückwärts –, darunter die **Lebenslinie** deines Tiers (mit Marken bei „ausgewachsen“ und „alt“; sie leuchtet warm, sobald
  Laich deiner Generation da ist).
- **Eine feste Welt:** Jeder Ort sieht für alle Spieler und in jedem Leben gleich aus (eine feste Weltsaat) – egal, von
  wo man ankommt.
- Alle Zahlen stehen an einer Stelle: `src/data/life.ts` (`WORLD`, `LIFE`, `SPAWN`, `INHERIT`, `MISC`) und `FOOD` in
  `src/state/GameState.ts` – und lassen sich im Spiel über die [Entwickler-Einstellung](#entwickler-einstellung) ändern.

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
    Anfang an: Er macht kaum Schaden, **betäubt** getroffene Tiere aber **1 Sekunde beim Schädel-Grundwert 10** –
    die Dauer steigt linear bis auf **2 Sekunden ab Schädel 100**, auch bei großen Räubern. Der Trefferschaden des
    Stoßes wurde um **25 %** erhöht; der anfängliche Schädelwert bleibt **10**, ebenso die bisherige Betäubungsskala.
    Wer oft stößt, bekommt einen harten, später gepanzerten Kopf – ein Stoß tut aber auch dem **eigenen Kopf ein wenig weh**
    (mit hartem Schädel weniger). Der Biss geht **aus dem Stand**: Der Körper
    bleibt, wo er ist – nur der Kopf reißt das Maul auf, schnappt zu und knirscht mit den
    Kiefern – mit starkem Gebiss deutlich wuchtiger. Bei **Gebiss 20, 30, 40 …** werden die Vorderzähne sichtbar länger,
    auch wenn der Kiefer bereits voll ausgeprägt ist. Zweimal schnell hintereinander zugebissen heißt:
    gepackt – kleinere Tiere zappeln dann nur noch.
  - **Anlauf und Schwung:** Weder Spurt noch Stoß sind ein Blitzstart. Beim **Spurt (W)** schlägt das Tier kräftiger und wird
    über etwa eine Sekunde **langsam schneller**, nach dem Loslassen klingt das Tempo ebenso langsam ab. Beim **Stoß (R)**
    baut es mit immer kräftigeren Flossenschlägen Tempo auf (R halten = längerer Anlauf, kurzes Antippen = kleiner Stoß), lässt
    dann die Flossen ruhen und **gleitet mit dem aufgebauten Schwung** ein Stück weiter – nach oben und unten lässt sich das
    noch lenken. Mit stärkerem **Schädel** wird der Anlauf kürzer und der Stoß schneller. Dabei kneift der Fisch die Augen
    zusammen und duckt den Kopf. Danach ist er für knapp eine Sekunde langsamer und kann noch nicht wieder stoßen oder
    sprinten – **für schnelle Fortbewegung bleibt Sprinten am besten**. Wer **im Schwung beißt**, erreicht weiter nach vorn
    und beißt härter; auch der Zusammenstoß zählt erst bei hohem Tempo.
  - **Wenden braucht Zeit:** Das Tier dreht nicht auf der Stelle um – es bremst, dreht sich und nimmt dann erst in die neue
    Richtung Fahrt auf. Wer oft die Richtung wechselt, wird **wendiger** (seine Seitenflossen wachsen) und dreht schneller.
    Wer hauptsächlich nach oben, nach unten oder geradeaus schwimmt, wird in dieser Richtung schneller.
  - **Jagen mit Plan** – kleine Fische sind auf der Flucht pfeilschnell, aber sie schwimmen **nicht ohne Grund aus der
    Ferne** davon: Sie fliehen, wenn man ihnen **wirklich nah kommt** oder **auffällt** (sprinten, stoßen, gerade gekämpft).
    Dabei zählt die **eigene Größe**: Solange man klein ist, haben die anderen weniger Angst und lassen einen näher
    heran; je größer und stärker man wird, desto früher und weiter fliehen sie. Die Flucht geht **nie schnurgerade**,
    sondern mit Haken – mal hoch, mal runter, mal ein Schlenker –, Hauptsache weg. Wer lange ruhig in der Nähe bleibt
    (nicht sprinten, nicht kämpfen), kommt etwas näher heran – ganz nah lassen sie einen aber nie: Hinterhalt, Stoß und schnelle Bisse sind gefragt;
    die kleinsten Fische sind mit zwei Bissen erledigt, kleine brauchen wenigstens drei. Oder man **reizt einen großen Räuber**
    (beißen, stoßen, frech nah heran) und schwimmt davon: Er verfolgt einen und reißt unterwegs alles,
    was ihm vor das Maul kommt – bis man sich versteckt. Was er liegen lässt, kann man fressen. Mittelgroße Tiere wehren sich und beißen zurück. Die großen kann
    man anfangs nur meiden; später gibt es vier Wege: ein **starkes Gebiss**, schnelle **Stöße und
    Ausweichen**, immer wieder aus dem **Hinterhalt** – oder man lässt sich **verfolgen, bis das Tier
    erschöpft ist**, und greift dann an (erschöpfte Tiere treiben langsam, schnappen nach Luft und
    nehmen mehr Schaden). Das klappt auch bei kleineren.
  - **Größere Fische haben Launen:** Sie schwimmen meist einfach ihres Weges, jagen kleine Fische, fressen und ziehen
    weiter – nicht jeder Räuber will gleich alles fressen. Gereizt werden sie, wenn man sie **angreift**, ihnen **zu nah**
    kommt, **vor ihnen herumrast** oder **länger in ihrer Nähe bleibt**; manche sind schneller reizbar als andere. Erst dann
    verfolgen sie den Spieler. Und sie sind **öfter zu sehen**: Räuber ruhen kürzer und seltener am Grund, streifen weiter
    umher, und alle halbe Minute etwa zieht ein größeres Tier des Zeitalters durchs Bild (im Devon Haie, Panzerfische,
    Fleischflosser und der Seeskorpion *Pterygotus*; im verborgenen Ordovizium Orthoceras, Megalograptus, Cameroceras).
  - **Jeder Angriff ist zu sehen:** Alle Tiere holen vor dem Biss sichtbar aus (sie spannen sich und
    glühen kurz rötlich auf) und schnellen dann vor – wer aufpasst, kann ausweichen.
  - **Die großen Fische beißen richtig zu** (`src/sim/bite.ts`, `Animal.attackStep`): Ein Jäger wird **rot** und spannt sich
    (große mit einem roten **!** und einem Knurren), das **Maul geht halb auf** – dann schwimmt er **kurz viel schneller** auf
    dich zu, das **Maul weit aufgerissen mit allen Zähnen** (beim Panzerfisch die Knochenklingen), und **schnappt zu**, sobald
    etwas zwischen seinen Kiefern ist; sonst schlagen die Kiefer am Ende ins Leere. **Schaden nimmt nur, was im Maul landet** –
    bloßes Berühren tut nichts, auch nicht im Vorbeischwimmen. Gelenkt wird nur am Anfang des Vorstoßes: Wer dann zur Seite
    schwimmt, entkommt mit etwas Glück. Jeder Biss ist ein wenig anders (mal holt er kürzer aus und schnappt schneller zu, mal
    wartet er länger bis zum nächsten) – nicht viel, aber genug, dass man sie nicht nach dem Takt ausspielen kann. Der weite
    Vorstoß der Riesen ist derselbe Biss aus größerer Entfernung; beim **Ansturm** beben sie rot und stürmen mit offenem Maul
    hinterher. Verteidiger und Beute, die zurückstößt, treffen nur mit dem Kopf.
  - **Teilen** – frisst ein anderes Tier von deiner Beute mit, während du dabei bist, fasst es
    Vertrauen. Solche Verbündeten verteidigen dich.
  - …oder eine Mischung davon.
- **Deine Art – selten, und sie geben Aufträge:** Artgenossen (fast wie du, mit kleinen Abweichungen) sind **sehr selten**.
  Meist ist man allein; wer einem begegnet, trifft ihn bei einem **Auftrag** (`src/data/quests.ts`, `src/objects/Quest.ts`).
  Über einem Artgenossen, der etwas zu erzählen hat, erscheint in der Nähe ein kleines Zeichen **F** (bzw. die Taste, die
  „Ansprechen“ in der [Steuerung](#steuerung) hat): Mit **F** (oder Eingabe;
  am Handy mit dem Knopf „Reden“) **spricht man ihn an**. Dann rückt die Kamera an beide Tiere heran (schwarze Balken wie beim
  Riesen im Hintergrund), er spricht in **Sprechblasen** (Text erscheint Buchstabe für Buchstabe, **F**/Eingabe/Antippen geht
  weiter) – dabei bewegt sich sein **Maul** in Silben, aus dem Maul steigen **Bläschen** auf, und es **blubbert** leise.
  Räuber ringsum ziehen ab, und solange gesprochen wird (und noch einen Augenblick danach), **greift in der Nähe niemand an** –
  weder dich noch deinen Gesprächspartner. Das eigene Tier bleibt an seinem Platz.
  - **Auftrag „Der Gefährte“ (Devon):** Nach dem Start kann man ein wenig erkunden – **nach links geht es nicht hinaus**
    (dort entspringt der Fluss, das Ufer steigt bis zur Wasseroberfläche), nur nach rechts. Weiter rechts, im offenen Meer hinter
    der Mündung, wartet ein Artgenosse. Er erzählt von einem **Ort ohne Räuber, dafür mit Pflanzen überall** – ein sicherer Ort,
    an dem man es sich gut gehen lassen kann –, will dorthin aufbrechen, bittet, ihn zu begleiten, und **schwimmt voraus**
    (er wartet im nächsten Ort, dem Korallengarten). Schwimmt man rechts hinaus, **trifft man ihn dort sofort**; ein kurzes zweites
    Gespräch, dann sagt er: „Warte … hörst du das?“ – beide schauen sich um, es grollt, und **ein großes Tier, das in diese Zeit
    passt** (im Devon *Dunkleosteus*), kommt heran, **frisst ihn** und schwimmt davon. Das Tier lässt sich in
    `quests.ts` je Zeitalter einstellen; der Auftrag ist bisher nur für das Devon eingetragen. Der Stand des Auftrags (0 offen, 1 vorausgeschwommen, 2 erledigt) wird im Spielstand gespeichert.
  - **Auftrag „Die gemeinsame Jagd“ (Devon, nach dem Gefährten):** Im Ort, in dem der Gefährte gefressen wurde, wartet
    danach eine kleine Gruppe von **vier bis fünf Überlebenden deiner Art** – echte Artgenossen mit ihrem gewohnten Verhalten.
    Einen von ihnen kann man ansprechen: Er erzählt von einem **Schwarm Drepanaspis** ganz in der Nähe (flache, gepanzerte
    Weidegänger am Grund) und fragt, ob du
    mitjagst (**Ja/Nein** mit ← →, bestätigen mit F/Eingabe – oder antippen). Wer ablehnt, spielt ganz normal weiter; die
    Gruppe wartet, man kann es sich später anders überlegen. Wer zusagt, wird von der Gruppe begleitet; der Schwarm (etwa fünf
    kräftige Drepanaspis, die sich mit einem Gegenstoß wehren und fliehen) zieht ein Stück entfernt. Gejagt wird mit den
    üblichen Mitteln – keine Vorgaben, kein Locken: Greifst du an, helfen die Artgenossen mit ihrer gewohnten KI mit. **Ziel:
    drei Drepanaspis erlegen** (deine und die Risse der Gruppe zählen), du musst aber **selbst mitgejagt** haben. Ziel und
    Fortschritt stehen oben links in einem Schild („Drepanaspis erlegt: 1 von 3“, wie viele deiner Gruppe noch leben, wohin der
    Schwarm zieht). Erlegte Tiere werden ganz normal zu Fleisch. Fehlen Tiere, sammelt sich der Schwarm nach ein paar Sekunden neu.
    Der Stand (0 offen, 1 abgelehnt, 2 Jagd läuft, 3 geschafft), die Zahl der Risse und deine Gruppe werden gespeichert – ein
    Ortswechsel setzt nichts zurück, und wer dich begleitet, kommt mit. Alle Texte und Zielzahlen stehen zentral in
    `src/data/quests.ts` (`JAGD`), der Ablauf in `src/objects/HuntQuest.ts`.
  - **Deine Gruppe – der Schwarm (Taste S in der Grundbelegung, am Handy der Knopf mit den drei Fischen oben rechts):** Nach der Jagd erklärt dir
    einer der Überlebenden, dass du sie **rufen** kannst. Wer überlebt hat, gehört fortan zu deiner Gruppe (die Zahl am Knopf).
    Auf deinen Ruf schwimmen sie von außerhalb des Bildes herbei, **folgen dir locker** und **helfen, sobald du angreifst**.
    Noch einmal S schickt sie fort (sie leben weiter; danach kann man ein paar Sekunden nicht rufen). Jeder von ihnen hat **so
    viel Lebenskraft wie du, aber einen schwächeren Biss** (anfangs halb so stark). Die Kehrseiten: **Wer mitjagt, will
    mitfressen** – wer leer ausgeht, beißt dich und verlässt die Gruppe für immer; **wer stirbt, kommt nicht wieder**, beim
    nächsten Ruf fehlt er. Lässt du sie aber öfter von gemeinsamer Beute fressen, **schließen sich weitere an** und die Gruppe
    kommt größer. Verletzte bleiben bis zur nächsten Generation angeschlagen. Zahlen in `src/data/quests.ts` (`SWARM`),
    Verhalten in `src/objects/Swarm.ts`. Sonst gibt es weiterhin keine Artgenossen, die frei umherschwimmen.
- **Orte und Weltkarte:** Jedes Zeitalter hat **zehn Orte** – und jeder ist **deutlich größer** als früher: breit nach
  links und rechts, aber auch tief nach unten. Die Orte unterscheiden sich in **Form**, Leben und Licht:
  - **Der Startort** ist der **Laichfluss**: Du schlüpfst in einem flachen Becken zwischen **Fischlaich** am Boden.
    Im Devon leben hier locker verteilte kleine Fische und Trilobiten. Direkt an den eigenen Gelegen werden keine
    fremden Bewohner oder Zuwanderer erzeugt; natürliche Bewegung bleibt möglich. Große Jäger wohnen erst weiter draußen.
    Selten zieht ein einzelner größerer Raubfisch außerhalb der Kinderstube vorbei. Auch im Hintergrund ist weniger los.
    Ausgewachsen kehrst du hierher zurück, um zu laichen – und um an der **großen
    Muschel** zu beten (siehe „Die große Muschel – beten“ weiter unten).
  - **Bewachsene Orte** (Tangwiese, Schwammgarten, Tangdickicht, Korallengarten) sind **flach und üppig**: dichter
    Bewuchs, viel Nahrung, kaum Jäger.
  - **Trübe Orte** (Trübe Bucht, Sandfeld, Schlickebene …) sind **Hügelketten** oder flache Sandebenen – man sieht
    kaum etwas, und auch du wirst schlechter gesehen.
  - **Tiefe Orte** (Tiefe Kante, Klippenhang, Dunkler Graben, Steilwand) fallen in einem **V-förmigen Trichter** oder
    zerklüfteten Hängen immer weiter ab, die **Abgründe** als **Schacht zwischen zwei Rändern**. Dort gibt es
    **kaum Fische, aber sehr starke, große Tiere**. Je tiefer du schwimmst, desto **trüber und dunkler** wird es:
    Um dich bleibt nur ein kleiner Lichtkreis, die Musik verklingt, das Meer rauscht, und manchmal grollt es in der Ferne.
  - **Licht fällt nur stellenweise** ins Wasser – dazwischen liegt Schatten. Es gibt keine Felstürme, die den Weg
    versperren.
  - **Der Meeresboden** ist **glatt statt stufig**: eine weiche Höhenlinie mit sanften Hügeln und Mulden. **Sandflächen**
    (hell, mit Dünen und Rippelspuren) wechseln sich mit **Felsgebieten** (dunkel, mit eingebetteten Steinen) und **Schlamm** ab –
    weich ineinander übergehend, nach unten immer dunkler. Auf dem Grund liegen **Felsbrocken** (manche lehnen aneinander,
    manche stecken halb im Hang) und **Kiesel**; man schwimmt um sie herum oder über sie hinweg. **Große, dunkle Felsen im
    Vordergrund** haben keine Hitbox: Wer **hinter** ihnen schwimmt, verschwindet kurz aus dem Bild. Die Höhlen liegen unter einer
    **Felskuppel** – mit unregelmäßiger Decke und rundem, geschlossenem Ende –, die Felsspalten unter einer Platte, die auf
    einem Felsbrocken ruht. Die Hitboxen bleiben
    Rechtecke (Säulen von 20 Bildpunkten, bei den Felsen schmale Scheiben) – nur so fein, dass nichts mehr eckig wirkt; kleine
    Stufen (bis etwa 22 Bildpunkte) gleitet man am Grund einfach hinauf.
  - **Bodentiere (Trilobiten u. a.) laufen am Boden wirklich:** Sie **richten sich nach dem Boden aus** (am Hang schräg, an
    steilen Flanken fast senkrecht – der Winkel kommt aus der Oberkante des Bodens links und rechts vom Tier, ohne Strahlen
    zu schießen), **steigen Stufen und Wände hinauf**, solange sie niedrig genug sind und oben Platz ist, und kehren nur an
    **echten Abgründen** um. Am Boden sind sie etwas langsamer, bergauf noch mehr. Kommen sie nicht weiter (auch ohne dass
    der Körper eine Wand meldet), **ducken** sie sich unter Überhängen hindurch, sonst weichen sie ein Stück zurück, suchen
    sich ein neues Ziel auf der anderen Seite und merken sich die Wand (Nahrung dahinter wird eine Weile nicht angesteuert);
    in einer Sackgasse bleiben sie ruhig stehen, statt zwischen links und rechts zu zappeln.
  - **Farbhöhlen sind selten und verschüttet:** Nur **zwei Orte im ganzen Zeitalter** haben eine – eine
    **grüne** in einem trüben Ort (im Devon der Korallengarten; mit Querbinden wie bei einem Barsch) und eine **schwarze** in der Tiefe. Ihre Öffnung zeigt zum
    Ankunftsplatz und ist mit **losem Geröll** zugeschüttet (heller als der Fels, Steine mit Lücken dazwischen). Ein
    **kräftiger Stoß** (R, mit vollem Anlauf) bricht es auf – allein schafft das erst ein harter Kopf (Stoßfisch) oder ein
    großer, massiger Körper, sonst **im Schwarm**: Jeder Artgenosse, der dich gerade begleitet, stößt mit (mit drei
    Begleitern reicht es). Ein zu schwacher Stoß lässt nur Risse zurück, an denen man sieht, wie viel noch fehlt.
    Aufgebrochen bleibt das Geröll für den Rest des Lebens (Werte in `src/data/world.ts`,
    `CAVE_WALL`). Wer bis ans hintere Ende schwimmt und wieder herauskommt, gibt die Farbe an seine **Nachkommen** weiter
    (ein leiser Schimmer zeigt es; das Tier selbst bleibt, wie es ist). Die Farbe gibt es **nur einmal pro Spieldurchlauf** –
    wer einmal gefärbt ist, wird nicht mehr umgefärbt. Die **Färbung** steht in der Übersicht (C). Daneben gibt es einige
    niedrige **Felsspalten** zum Verstecken für Schlanke.
  - **Ein zusammenhängendes Meer im Devon:** Vom Laichfluss schwimmt man nach rechts direkt in den noch flachen
    Korallengarten und von dort ins **Tiefental**. Dessen Boden fällt nach rechts immer weiter ab. Zurück geht es ebenso
    direkt nach links, ohne Overworld, Zielauswahl oder zusätzliche Reisezeit. Die Abschnitte werden mit einer kurzen
    Überblendung geladen; Tiefe, Nahrung, Lebenskraft und Gruppe bleiben erhalten. Übergangsböden passen zusammen.
  - **Die Karte liegt auf C:** Die frühere **Overworld mit Gondwana, den übrigen Kontinenten und den Meeren** steht
    verkleinert bei den Werten. Der helle Punkt markiert deinen aktuellen Ort. **Rot ist der eigene Lebensraum im Meer**:
    Mit dauerhaft besseren Fähigkeiten und Muschelsegen wächst die Fläche. Land wird dabei ausgespart.
    Die Karte dient der Orientierung; zwischen den Wasserabschnitten schwimmt man weiterhin direkt hinüber.
  - **Bewohner nach Tiefe:** Im Laichfluss leben nur wenige kleine Fische zwischen Krabbeltieren, keine großen ansässigen Jäger.
    Die größeren Schwarmbestände kleiner Beutefische sammeln sich im zweiten Gebiet, dem Flachwasser. Auch im
    Hintergrund ist der Laichfluss deutlich ruhiger und das Flachwasser belebter.
    Größere Jäger begegnen dir im Flachwasser; die Riesen und Spitzenräuber erst im Tiefental. Für Zuwanderer gelten
    dieselben Grenzen. Im Laichfluss kann außerhalb der Kinderstube alle **3–5 Minuten** ein einzelner größerer
    Raubfisch vorbeiziehen; ein Großräuber wird dort nicht mehr erzwungen. Die früheren Nebenorte werden beim Laden alter Spielstände
    dem Flachwasser oder Tiefental zugeordnet; vorhandene Eier, Nahrung und Fähigkeiten bleiben erhalten.
- **Ein Meer hinter dem Spielfeld:** Im Hintergrund ziehen in **zwei Tiefenstufen** Schwärme und gelegentlich ein **ganz
  großer Fisch** durchs Wasser – als **dunkle Schattenrisse**, deutlich anders als die hellen, echten Tiere. Jede Gruppe
  schwimmt in ihre **eigene Richtung**, und die Schichten wandern mit der Kamera mit (Parallaxe: weiter hinten weniger),
  **rechnerisch stimmig**: Wer nach links schwimmt, sieht den Hintergrund nach rechts davonziehen – ein Fisch, der selbst
  nach rechts schwimmt, ist entsprechend schneller aus dem Bild. Sie liegen hinter Gelände, Pflanzen und allen echten
  Tieren und sind **nur Kulisse**: kein Körper, keine Logik, nichts davon kann gebissen oder gefressen werden. Welche Arten
  ziehen, hängt vom Zeitalter und vom Ort ab; in der Tiefe wird es dunkler und stiller.
- **Leben am Grund und im freien Wasser:** Der Meeresboden ist bewohnt – mit wenig aufwendigen, aber gut erkennbaren Formen,
  die je nach **Ortsart**, **Zeitalter** und **Untergrund** anders gewichtet sind (`src/data/biota.ts`):
  - **Schwämme** (Vase, Röhrenbündel, Glasschwamm in der Tiefe, Krusten, Kugeln), **Korallen und Riffbauer** (Tabulaten mit
    Wabenmuster, Hornkorallen, Kettenkorallen, Astkorallen, Stromatoporen – im **Devon** bilden sie dichte Riffe),
    **Moostierchen** (Netzfächer, Äste), **Armfüßer** (Spirifer, Orthiden, Gruppen, Pentamerus), **Seelilien** (hoch, niedrig, als
    Gruppe – vor allem im **Silur**) und **Cystoideen** (gestielte Kugeln mit Plattenmuster – im **Ordovizium** häufig, im Devon
    fast verschwunden) stehen in kleinen Gruppen auf Sand, Fels oder Schlamm; manche wiegen sich in der Strömung.
  - **Algen und Matten:** Blätter, Büschel, Kalkalgen, Wirtelalgen und **Stromatolithen** (gewölbte Mikrobenpolster);
    dazu **mikrobielle Matten**, die als dünner, runzliger Belag mit Gasbläschen der Bodenlinie folgen. Der Boden zeigt
    feine **Sedimentschichten**, und wer **schnell über den Grund schwimmt**, wirbelt **Sediment** auf, das in einer hellen Wolke
    wieder absinkt (auch große Tiere tun das).
  - **Schwebendes:** Im Wasser treiben **Plankton** (Acritarchen, Radiolarien, Chitinozoen, Muschelkrebse, Larven, kleine
    Quallen, Cyanobakterienketten – manche leuchten schwach, in der Tiefe mehr), **Meeresschnee** (sinkende Schwebstoffe) und
    **graptolithenartige Kolonien** (Gabeln, Fächer, Kreuze, Doppelreihen – häufig im Ordovizium und Silur, im Devon fast
    keine). Alles liegt in **drei Tiefenstufen** (Parallaxe: weiter hinten kleiner, blasser, langsamer), ist reine Kulisse und
    nicht fressbar. Der klare Startfluss hat wenig davon, das trübe Wasser wimmelt, in der Tiefe rieselt vor allem Schnee.
- **Fischlaich:** Im Startfluss liegen ein paar **Gelege** der eigenen Brut; im Meer gibt es **nur vereinzelt** Gelege der
  Bewohner – im **Flachen** und bei Pflanzen, am Fluss kaum, **in der Tiefe gar nicht** (kleine Fische laichen dort nicht).
  Jedes Gelege hat **Eltern in der Nähe**, die darüber wachen: Sie **schwimmen nicht davon**, sondern bleiben dicht beim Laich
  und **beobachten dich aus kleiner Entfernung**. Auch wenn du über den Laich hinwegschwimmst oder daneben stehst, geschieht
  nichts – **angegriffen wirst du erst, wenn du anfängst, den Laich zu fressen**. Laich ist eine **gute Nahrungsquelle**
  (sättigt und gibt Kalorien), aber: **Bekommen die Eltern mit, dass du ihre Brut frisst** (sie müssen in Sichtweite sein –
  wer sich versteckt, fällt nur aus nächster Nähe auf), **werden sie aggressiv** und greifen dich an. Lässt du den Laich in
  Ruhe, **schlüpft** der der Beute- und Wächterarten mit der Zeit zu kleinen Jungtieren. Die Eltern der großen Räuber bleiben
  seltener bei ihrem Gelege.
- **Die Chronik des Lebens** (früher „Aquapendium“ – es sind ja nicht nur Meerestiere; im Titelbild, wie der Stammbaum):
  ein **Buch** mit einer Seite für **jedes Tier** der Urzeit, in
  **sieben Teilen – einer je Zeitalter** (Devon 30, Kreidezeit 15 Tiere; wer in mehreren Zeitaltern lebt, steht in jedem
  Teil). Oben am Buch stecken sieben **Lesezeichen** (das des aufgeschlagenen Teils ist hell wie das Pergament; ein Klick
  darauf führt zu seinem Inhalt, das Haus-Zeichen oben links zurück zum Titelbild); jeder Teil beginnt mit seinem Inhalt
  (wie viel davon gefunden ist, und bei ruhenden Zeitaltern: „Dieses Zeitalter ruht noch im Gestein“). Teile, deren Tiere
  noch fehlen (Karbon, Perm, Trias, Jura, Paläogen), zeigen statt der Zahl den Abdruck eines Ammoniten und rechts ein
  angelegtes, noch leeres Verzeichnis. Links das Bild, rechts der Steckbrief
  mit Zeitalter, Lebenszeit („vor ca. 450 Mio. Jahren“), ungefährer
  Länge, Rolle, Nahrung, Lebensweise (Einzelgänger, Schwarm, Rudel), Lebensraum und den **Werten aus dem Spiel**
  (Lebenskraft, Biss, Stärke, Tempo, Sinne), dazu ein paar Sätze zum echten Tier. **Alle Seiten sind von Anfang an da** –
  Tiere, die du noch nie gesehen hast, zeigen nur ihren **schwarzen Umriss** und Fragezeichen. Sobald du einem neuen Tier **nah genug** kommst, wird seine Seite gefüllt – oben links gleitet ein schmales
  **Schild** herein (dunkle Fläche, feine ochrefarbene Linien, ein Ammonit im Ring, darunter in kleinen Buchstaben
  „NEU IN DER CHRONIK DES LEBENS“ und der Name des Tieres), das Zeichen leuchtet kurz auf, dazu ein leises Rascheln und zwei
  zarte Töne. Kommen mehrere Einträge zusammen, erscheinen sie nacheinander. Das bleibt über alle Leben erhalten. Blättern mit
  ← → (oder A/D, Mausrad, Wischen oder den Pfeilknöpfen) – durch alle Teile hindurch; **1 bis 7**, **Tab** oder die
  Lesezeichen springen zu einem Teil, **I** zum Inhalt des aufgeschlagenen, Esc zurück.
  Die Bilder sind vorerst **Platzhalter** (das Tier aus dem Spiel, groß gemalt); eigene Bilder kommen als `pteraspis.png`
  usw. nach `src/assets/aquapendium/` (siehe dort die README; im Code heißt die Chronik weiter „Aquapendium“) und werden
  automatisch eingebunden. Größen und Zeiten der
  Urtiere sind grobe Näherungen.
- **Wachsen von Generation zu Generation:** Im Leben wächst dein Tier nur heran (und altert); die **Art** verändert sich
  erst beim **Generationswechsel** – sanft, **nie zu stark** auf einmal, und die Merkmale bauen über viele Generationen
  aufeinander auf. Was
  sich ändert, bestimmen deine Spielweise (die **Evolutionsrichtungen**, siehe unten) und drei Anpassungen, die unabhängig
  davon geschehen: **Körpergröße** (Lebensraum), **Körperrobustheit** (überstandene Angriffe) und **Ernährung** (gefressene
  Energie).
- **Kompromisse:** Alles hat seinen Preis. Ein **starkes Gebiss** macht **langsamer** und **schneller müde**; ein harter
  Schädel ebenso. Masse und Schuppenpanzer kosten **Tempo**. Schlanke Verfolger sind schnell und halten länger durch,
  halten aber weniger aus und stoßen schwächer. Das steht (verdeckt) hinter dem Aussehen – Zahlen dazu zeigt das Spiel
  nicht: Man merkt es beim Spielen.
- **Ausdauer – wie in *Breath of the Wild*:** Spurt (W), Stoß (R) und kräftiges Beißen kosten **Ausdauer**. Sie zeigt
  sich als **grüner Kreis rechts neben deinem Tier**: Er erscheint, sobald Ausdauer verbraucht wird, leert sich im
  Uhrzeigersinn von zwölf Uhr aus, füllt sich kurz danach wieder, leuchtet auf, wenn er voll ist, und blendet aus. Wird es
  knapp, **blinkt** er rot. Ist er ganz leer, ist dein Tier **erschöpft**: Der Kreis wird **rot**, es geht nur noch lahm
  voran, ohne Spurt und Stoß – erst wenn er sich (rot) **ganz** gefüllt hat, ist es vorbei. Jedes Tier hat **einen Kreis**;
  **mehr Ausdauer gibt es nur von der großen Muschel** (siehe unten): Jeder Segen in Ausdauer legt außen ein Stück Ring an
  (ein Viertelkreis je Segen, höchstens drei Kreise), und die äußeren Ringe leeren sich zuerst. Der Kreis ist klein und dezent –
  ein schmaler, leicht durchscheinender Ring dicht neben dem Tier. **Wie schnell** die Ausdauer
  schwindet, hängt am Körper: Schwere, gepanzerte Tiere und starke Kiefer ermüden schneller, schlanke Verfolger halten länger
  durch (ein Kreis reicht bei normalem Körperbau drei Sekunden Spurt). Beim normalen Schwimmen füllt sich der Kreis nur
  langsam; **ausruhen** geht schneller: nichts tun und sich **vom Wasser treiben lassen** (man steht dabei nie ganz still,
  sondern gleitet leicht nach links oder rechts). So kehren Ausdauer und **Lebenskraft** zurück: Wer sich treiben lässt,
  heilt gut ein Prozent je Sekunde (in knapp anderthalb Minuten von fast nichts bis voll), wer nur langsam schwimmt, ein
  halbes – nicht gleich nach einem Treffer, nicht im Spurt oder Stoß, im Alter langsamer. Schneller geht es mit
  **Heilkräutern** (hellgrün mit rosa Blüten, goldener Schimmer; eines heilt 40 %) – manche Pflanzen heilen also,
  **Fleisch heilt nicht**, es nährt nur die Brut.
- **Muscheln farmen:** Muscheln liegen nicht fest an ihren Orten – sie **fallen selten von erlegter Beute** (Tiere, die
  du erlegt hast oder an deren Tod du beteiligt warst). Wie selten, hängt davon ab, **wie stark das Tier im Vergleich zu dir
  war**: ein ebenbürtiges in **10 %** der Fälle, ein doppelt so starkes (größeres) in **20 %**, schwache Beute halb so
  oft – wer stärker wird, findet bei kleinen Tieren also seltener eine. Die Muschel sinkt funkelnd zu Boden, ein heller Ton
  klingt; wer sie berührt, nimmt sie mit (oben links steht, wie viele frei sind und was der nächste Segen kostet).
  **Weil sie so selten sind, gehören die Muscheln dir – nicht deiner Linie:** Sie bleiben über **alle Läufe** hinweg, auch
  wenn deine Linie ausstirbt.
- **Die große Muschel – Muscheln verteilen:** Im **Laichfluss** steht ein Stück vor dem Schlupfplatz eine **riesige
  Fächermuschel**, perlmuttfarben, mit einer leise glühenden **Perle** davor, Lichtfunken steigen auf, von oben fällt ein
  Lichtschacht. Wer davor die Taste fürs Ansprechen drückt (F, am Handy „Beten“), tritt vor sie: Ein Fenster zeigt, wie
  viele Muscheln **frei** sind, und **drei Richtungen**, in die sie deine Linie segnen kann – jede mit dem Wert jetzt und
  danach („27 → 28“):
  - **Lebenskraft:** +2,5 % je Segen – und der **Körper wird je Segen um 1,8 % größer**.
  - **Ausdauer:** ein Viertelkreis mehr (höchstens drei Kreise) – und die **Flossen werden größer und kräftiger**.
  - **Sicht:** von **20 %** aus je Segen **5 %** mehr (höchstens 100 %, siehe „Sicht“ unten) – und die **Augen werden
    größer**, die Iris leuchtet kräftiger, mit hellem Ring und einem zweiten, kleinen Lichtreflex.

  **Was ein Segen kostet:** Der erste **1 Muschel**, jeder weitere **doppelt so viele** wie der vorige – **gleich, in welche
  Richtung**: 1, 2, 4, 8, 16 … Vorerst gibt es **höchstens 10 Segen** je Linie: Der zehnte kostet 512 Muscheln, alle zehn
  zusammen 1023 (`UPGRADES.max`). Das Fenster zeigt „Segen 3 von 10“. Wählen mit ← → (oder Klick), Eingabe segnet,
  Esc geht. Dann strömt Licht von der Perle in dein Tier, Ringe aus Licht gehen von ihr aus, und es wächst sichtbar: der
  Körper (und die Lebenskraft ist ganz wieder da), der Ausdauerkreis oder der Blick. Die Segen gelten für die **ganze
  Linie** (über alle Generationen). **Beginnt eine neue Linie** (nach dem Aussterben oder bei einem Neustart), sind **alle
  Muscheln wieder frei** und man verteilt sie neu – gleich beim Schlüpfen, denn die große Muschel steht im Laichfluss
  (eine Meldung erinnert daran). Ist ein Segen bereit, **ruft** die Perle: Alle paar Sekunden geht ein Ring aus Licht von
  ihr aus. Alle Zahlen stehen in `SHELLS`, `UPGRADES` und `STAMINA` (`src/data/life.ts`) und in der
  [Entwickler-Einstellung](#entwickler-einstellung) („Muscheln, Segen und Sicht“); die Muschel in `src/objects/Shrine.ts`,
  das Fenster in `src/scenes/HudScene.ts` (`openShrine`).
- **Sicht unter Wasser:** Ein Fisch sieht vor allem dorthin, wohin er schwimmt – aber auch ein Stück hinter sich. Wie auf
  einem **Zeitstrahl von 0 bis 10**: Steht der Fisch auf 5 und schaut Richtung 10, sieht er **4, 5, 6, 7**; dreht er sich
  um, sieht er **3, 4, 5, 6**. Nach vorn reicht der Blick also **doppelt so weit wie nach hinten**. In der Fläche ist das ein
  **runder klarer Bereich, dessen Mitte ein Stück vor dem Fisch liegt** – beim Umdrehen gleitet er weich auf die andere
  Seite, und er sitzt immer genau am Fisch (auch wenn die Kamera nachzieht). Der Rand ist **kurz und deutlich**; dahinter
  liegt **trübes Wasser** in den Farben des Ortes, und gleich am Rand beginnt es **dunkel** zu werden – nach außen immer
  dunkler. **Tiere** sind im Trüben nicht zu sehen, am Rand erscheinen sie als blasser, verschwommener Umriss, im Blick
  deutlich. **Wie weit man sieht, hängt an drei Dingen:**
  - **an deinem Tier – seiner Sicht:** zu Beginn **20 %**, jeder Segen in Sicht gibt **5 %** mehr (100 % hieße bis zum
    Bildrand bei guten Bedingungen). Nach vorn sieht jedes Tier dazu ein Grundstück (ein Zehntel der Weite),
    das ebenso wie die eigene Sicht mit Wasserqualität und Tiefe verrechnet wird.
  - **an der Wasserqualität:** Der **Laichfluss** hat **sehr klares Wasser** – man sieht es ihm an: Das Wasser ist dort
    heller und kühl hellblau, mit kräftigeren Lichtbahnen, glitzernden Schwebeteilchen und einem hellen Dunst statt Trübe.
    Dort reicht der klare Blick schon beim ersten Fisch deutlich weiter; Trübung verkürzt die Reichweite überproportional. Durch das
    Wasser hindurch auch den **Hintergrund und die Fische in der Ferne** gut. Der **Korallengarten** ist noch recht klar,
    aber schon etwas weniger (man merkt es an der Sicht). In **trüben Orten** (Delta, Schlammbank) sieht man deutlich
    weniger weit und kaum etwas vom Hintergrund; dunkle Tiefengebiete begrenzen die Sicht zusätzlich.
  - **an der Tiefe:** **Nah an der Oberfläche** reicht der Blick am weitesten (und in die Ferne sieht man dort am meisten),
    **je tiefer, desto weniger weit** – und in der Tiefe hört die Sicht **plötzlicher auf** (der Rand wird steiler), und
    das **Schwarze kommt früher** und wird dichter. Auch der kleine Sichtbereich direkt um den Fisch schrumpft dabei,
    damit der erste Fisch in großer Tiefe nicht genauso weit sieht wie in trübem Flachwasser.

  Greift ein Tier aus dem Trüben an, sieht man kein Ausrufezeichen – man hört es nur. In Szenen mit der Kamera (Aufträge)
  lichtet sich das Wasser. Auf dem Land gibt es diese Sicht nicht. Alle Zahlen stehen in `SIGHT` (`src/sim/sight.ts`, die
  Rechnung); `src/objects/Sight.ts` legt das Wasser und das Dunkle über das Bild, `LevelScene.sightStep` blendet die Tiere
  und die Fische in der Ferne (`BackSea.see`).
- **Herzklopfen:** Das Herz schlägt **genau dann, wenn dich ein Tier jagt** – meist eines, das man im Trüben gar nicht
  richtig sieht. **Je größer und stärker der Jäger** im Vergleich zu dir, desto **lauter und schneller** (ein kleiner Fisch
  macht kaum Angst), und **je näher du dem Tod bist**, desto mehr. Am lautesten, wenn man fast tot ist und ein großer Fisch
  einen jagt. Mit jedem Schlag pochen die roten Bildränder einer Verletzung mit (`LevelScene.heartStep`).
- **Panzerung (Schuppen):** Ein Schuppenpanzer macht **langsamer**, dafür wirft dich ein Treffer **weniger weit zurück** –
  und man fängt sich schneller (bei vollem Panzer etwa halb so weit).
- **Stärkere Gegner:** Räuber, Riesen und Verteidiger haben deutlich mehr Lebenskraft und **richten
  mehr Schaden an** – zwei, drei Treffer können reichen. Dafür wehren sie sich **sichtbar**: Sie
  spannen sich vor dem Angriff an und glühen auf, schnellen mit einer Spur vor, und wer sie anbeißt,
  muss mit **Gegenwehr** rechnen. Treffer schleudern dich zurück, betäuben kurz und lassen dich bluten.
  Zu fliehen ist oft die beste Idee.
- **Wer frisst wen:** Große Jäger jagen nur, wenn sie Hunger haben – satt liegen sie oft lange am
  Meeresgrund (bzw. am Boden) und dösen. Kleine Fische fliehen früh – nicht ins Gras (dort würden sie
  nur stillhalten und sich fressen lassen), sondern **nach oben ins freie, mittlere Wasser**, wo nichts im Weg ist, und
  dann **auf eine sichere Entfernung**. Nur Bodentiere wie Trilobiten verkriechen sich im Dickicht.
- **Fressen – für den Nachwuchs:** Hunger gibt es nicht (siehe oben). Ein Happen zeigt klein und kurz, was er gebracht
  hat: rötlich für Fleisch, grünlich für Pflanzen. Pflanzen bringen wenig (1 je Pflanze, mit einem Bissen ganz gefressen),
  sind aber ungefährlich und wachsen nach. **Beute nährt nach ihrer Stärke und Größe** (`meatOf` in
  `src/state/GameState.ts`) und zerfällt in **Brocken zu 5 und zu 1**: ein kleiner Beutefisch 1, ein Räuber wie der
  Conodont um 3, Orthoceras um 5, Seeskorpione und Riesen weit mehr (viele große Brocken). Jeder Brocken ist **ein Bissen** –
  wer mehr will, muss Stärkeres erlegen, mit mehr Risiko. Manche Pflanzen sind giftig: Sie brennen, machen aber kurz
  hellwach und schnell.
- **Fleisch wie in E.V.O.:** Ein erlegtes Tier leuchtet kurz auf und wird zu Fleisch: kleine Brocken (1) als Happen, große
  (5) als **saftige Fleischkeule mit Knochen** – große Tiere zu vielen. Das Fleisch sinkt zügig zu Boden
  (große Stücke schneller) – und nach einer Weile verdirbt es. Andere Fleischfresser
  fressen mit, sobald sie drankommen: Wer zu lange wartet, geht leer aus. Auch **große Tiere töten nicht nur**, sondern
  **fressen ihre Beute**: Ein Räuber, der etwas erlegt hat, schwimmt zum Fleisch, senkt den Kopf und frisst Bissen für Bissen –
  mit sichtbarem Nicken, Kauen und einem Ruck bei jedem Happen (bis er satt ist oder etwas ihn stört).
- **Herrscher des Devons:** Im Devon wartet der Endgegner – *Dunkleosteus*, mit Lebensbalken unten im Bild; einmal
  aufgetaucht, folgt er dir von Ort zu Ort (nie ins sichere Startgebiet). Wie er in der durchgehenden Weltzeit auftaucht,
  ist noch offen.
- **Überraschungsangriff:** Wer aus Dickicht, Höhle, Felsspalte oder gut getarnt angreift (das Tier
  ist dann leicht durchsichtig), trifft mit dem ersten Biss oder Stoß zwei- bis dreifach und betäubt.
- **Riesen:** Zu Beginn mancher Zeitalter rast etwas Gewaltiges vorbei – im Devon *Dunkleosteus* (im verborgenen
  Ordovizium ein Riesenkopffüßer, im Silur *Pterygotus*). Vorher wird das Wasser dunkler,
  es grollt, das Herz klopft, und die kleinen Fische fliehen: Zeit, sich zu verstecken. Selten
  streifen auch große Jäger wie *Megalograptus*, *Cladoselache* oder *Hyneria* umher. Wen ein Riese
  reißt, von dem bleibt meist etwas übrig …
- **Ein Schatten in der Tiefe:** Im Silur wird plötzlich alles langsamer, die Kamera rückt an dein
  Tier heran, die Musik verklingt und das Meer rauscht lauter – du hältst inne, während weit hinten ein
  riesiger Fisch vorbeizieht. Dann geht es weiter, als wäre nichts gewesen.
- **Tiere ihrer Zeit:** Jedes Zeitalter hat **seine eigenen Fische** (und ihre Nachbarn), jede Art lebt in ihrer
  Wasserschicht und an den Orten, die zu ihr passen – mit eigenem Verhalten. **Jeder Ort hat außerdem seine eigene
  Mischung**: Manche Arten fehlen dort fast ganz, andere sind besonders häufig. Es gibt gut zwei Dutzend Arten:
  - **Ordovizium** (vorerst verborgen) – die ersten Wirbeltiere: *Arandaspis*, *Astraspis*, *Eriptychius*, *Sacabambaspis* und andere gepanzerte
    Kieferlose, der aalartige *Conodont* (ein kleiner Jäger), Trilobiten (*Isotelus*), Quallen und Orthoceras. Seeskorpione
    sind hier selten.
  - **Silur** (vorerst verborgen) – *Pteraspis* (Panzerkopf mit Schnabel), *Thelodus* und *Lasanius* (Schwarmfische), der
    aalartige *Jamoytius*, *Birkenia*, *Cephalaspis*, der wehrhafte Stachelhai *Climatius* und *Entelognathus*, einer der
    ersten Kieferfische (ein gepanzerter Jäger).
  - **Devon** (spielbar – hier beginnt jedes Leben) – das Zeitalter der Fische, jetzt mit allem, was bereitstand:
    Schwärme aus *Moythomasia* (am häufigsten), *Acanthodes* und *Thelodus*, kieferlose Panzerfische (*Drepanaspis*,
    *Cephalaspis*, *Pteraspis* …), *Cheiracanthus*, der Lungenfisch *Dipterus*, *Bothriolepis* und *Pterichthyodes*
    (Panzerfische mit Ruderarmen), Trilobiten, Quallen, Conodonten und Orthoceras; seltener die Jäger *Coccosteus*,
    *Osteolepis*, *Cheirolepis*, *Climatius*, Seeskorpione, *Cladoselache*, *Rolfosteus*, der Hai *Stethacanthus* mit seinem
    „Amboss“ und die Fleischflosser *Eusthenopteron*, *Holoptychius*, *Tiktaalik* und *Hyneria* (ganz selten). Als
    Durchzügler kommt der Riesen-Seeskorpion *Pterygotus* dazu, und der Herrscher *Dunkleosteus* rast früh im Zeitalter
    einmal vorbei. Die Häufigkeiten stehen in `src/data/epochs.ts`.
  - **Karbon** (spielbar, als *Pederpes*) – am häufigsten *Elonichthys*, dazu *Acanthodes*, Garnelen, Pfeilschwanzkrebse,
    der Lungenfisch *Ctenodus*, an Land Tausendfüßer, Urinsekten und Trigonotarbiden; seltener der Seeskorpion
    *Hibbertopterus*, der Lungenskorpion *Pulmonoscorpius*, die Jäger *Megalichthys*, *Crassigyrinus*, *Strepsodus* und
    *Stethacanthus*; im Rhizodus-See wartet *Rhizodus* (siehe [Das Karbon](#das-karbon-gelege-metamorphose-generationen)).
  - **Kreidezeit** (ruht noch) – das Westliche Binnenmeer: *Apsopelix* (Schwärme), der harmlose Riese *Gillicus*, Ammoniten
    und *Baculites*, der „Säbelzahnhering“ *Enchodus*, *Protosphyraena* mit Schwertschnauze, *Xiphactinus*, die Haie
    *Squalicorax* und *Cretoxyrhina*, die Riesenschildkröte *Archelon*, der langhalsige Plesiosaurier *Elasmosaurus* und die
    Mosasaurier *Platecarpus*, *Tylosaurus* und *Mosasaurus*, der Herrscher der späten Kreidemeere.
  - **Wer flieht, ist weg:** Kleine Fische rennen wirklich davon – wer lange flüchtet und aus dem Bild ist (oder am Rand
    des Ortes nicht weiterkommt), ist **entkommen und verschwunden**. Nach einer Weile ziehen andere Fische dort wieder ein.
    Wer einen Fisch **immer wieder aufscheucht**, vertreibt ihn irgendwann ganz: Er (und sein Schwarm) gibt den Ort auf –
    wird dabei aber **müde** und ist dann leichte Beute, wenn man dranbleibt.
  - **Schwärme und Rudel:** Fast alle kleinen Fische leben in **großen Schwärmen** (bis zu 16 Tiere), die zusammen
    schwimmen und **gemeinsam fliehen**; viele Räuber, Verteidiger und Wirbellose (Haie, Conodonten, Cheirolepis,
    Seeskorpione, Quallen …) leben in **kleinen Rudeln** – und **jagen gemeinsam**: Wer ein Ziel anspringt, setzt das Rudel
    darauf an.
  - **Gegenstoß:** **Etwas größere Fische** (im Vergleich zu deiner Kampfkraft) wehren sich, wenn du sie anbeißt: Sie
    holen kurz aus (rot aufglühen) und **schnellen mit einem Stoß auf dich zu** – wie dein Stoß mit R. Das tut weh, ist
    aber so bemessen, dass du es auch als kleiner Fisch überlebst; danach fliehen sie weiter. Je größer du wirst, desto
    weniger wagen es.
  - **Mehr los im Wasser:** Die Orte sind etwas dichter besiedelt (vor allem mit Beute).
  Kein Tier gleicht dem anderen ganz – manche sind etwas größer, andere etwas kleiner.
- **Strömungen und Felsspalten:** Strömungen reißen Kleine mit – massige Tiere schwimmen dagegen an.
  Unter Felsplatten liegen enge Spalten, in die kein großer Jäger passt; wer selbst zu groß und
  massig wird, aber auch nicht mehr.
- **Vier Kampffähigkeiten:** Bisse stärken das **Gebiss**, Stöße den **Schädel**, erfolgreiche Verfolgungen die **Flossen**,
  überstandene Angriffe anschließend besiegter Gegner die **Schuppen**. Ein Sieg wird nach den eingesetzten Fähigkeiten
  aufgeteilt und insgesamt nur einmal gewertet. Bloße Treffer oder erlittene Angriffe ohne anschließenden Sieg zählen nicht.
  Beispiel: 60 % Pflanzen und 40 % Fleisch ergeben 9 Lebenspunkte und bis zu 6 Kampfpunkte vor Varianz. Bei reiner
  Bisswertung sind das +3 bis +9 Gebiss pro Ei und fest −1,5 Schädel. Die Varianz verändert keine bereits geerbten Punkte.
- **Verborgener Körperbau:** Viel Schwimmstrecke macht die Nachkommen länger und schneller; die Schuppen verlieren dabei
  die Hälfte des relativen Längenzuwachses. Zeitlich gemittelte Wassertiefe erhöht das Gewicht: Mehr Masse schützt neben
  den Schuppen vor Schaden, kostet aber die Hälfte des relativen Gewichtszuwachses an Tempo. Länge und Gewicht bleiben
  ohne Änderungsanzeige. Standard: höchstens 10 % mehr Länge bei 60.000 Bildpunkten Strecke, bis 10 % mehr Gewicht bei
  voller mittlerer Wassertiefe je Generation. Die Werte sind in der Entwickler-Einstellung anpassbar.
  Auch zusätzliche vererbte Lebenspunkte lassen den Körper etwas mitwachsen: Eine verdoppelte Lebensbasis macht ihn
  rund **15 % größer**. Das richtet sich nach den vererbten Punkten; Verletzungen lassen das Tier nicht schrumpfen.
- **Die Übersicht (Taste C)** – wie der Charakterbogen alter Rollenspiele (etwa in *Gothic*): ein ruhiger, dunkler Bogen
  mit feinem Rahmen. Oben der Name deiner Linie (z. B. *Protichthys vulgaris*), darunter Körperform und Zeitalter.
  Darunter groß die **drei übergreifenden Werte**, die die große Muschel segnet: **Lebenskraft** als Zahl, gerade und
  höchstens („20/50“), **Sicht** (20 zu Beginn) und **Ausdauer** (30 bei einem Kreis und normalem Körperbau – so viele
  Zehntelsekunden reicht ein Spurt). Darunter, auf einer Reihe kleiner Tafeln, Waffen und Schutz: **Gebiss** (Bissstärke),
  **Schädel** (Stoßstärke), **Flossen** (Schwimmen und Wendigkeit) und
  **Schuppen** (Panzerung). Der erste Fisch hat ausgewachsen Gebiss, Schädel und Schuppen je 10, ein Jungtier etwas weniger.
  **Das Tempo steht hier nicht** – es ergibt sich aus Größe und Körperbau. Unten links dein Tier und sein **Körper** (Länge,
  Gewicht, darunter Geschwister, Färbung und Kost), rechts die **Karte des Lebensraums**. Generation und Lebensabschnitt
  stehen über dem bewegten Fischbild. Die Gewichtsanzeige ist um Faktor 100 skaliert, ohne die Kampfverhältnisse zu ändern.
  Nahrung, Eikosten und Nachwuchs stehen gemeinsam am Laich (E), nicht mehr auf C. Neben Gebiss, Schädel, Flossen und
  Schuppen steht klein, **wie viel sich die Fähigkeit gegenüber der vorigen Generation verändert hat** (▲ grün, ▼ rot; Null entfällt;
  ausgewachsen gemessen, mit denselben Segen – so zählt nur, was vererbt wurde; im Karbon Gebiss, Beine, Griff, Schuppen).
  Die **Segen** stehen als kleine Kugeln direkt unter den großen Zahlen: **Lebenskraft rot, Ausdauer grau, Sicht schwarz**
  (im Karbon Sauerstoff blau), ohne zusätzliche Beschriftung. Zwei Segen in Lebenskraft ergeben zwei rote Kugeln.
  Ein Segen aus einer **goldenen Geburt** hat einen dezenten goldenen statt weißen Glanzpunkt.
  Auch an der großen Muschel stehen die Kugeln unter dem passenden Wert. Die **Muscheln** stehen rechts in der Spalte
  der kleinen Karten: ein Muschel-Symbol mit der noch freien Anzahl, ohne weitere Beschriftung. Die Muscheln sind klein und
  kostbar: Wellhornschnecken aus Elfenbein mit zarten rosa Bändern und einer perlmuttschimmernden Mündung mit goldenem Saum,
  die ab und zu kurz funkeln. Sie fallen selten von erlegter Beute (siehe oben). Wurde eine neue
  gefunden, leuchtet der Knopf „C“ leise, bis man nachgesehen hat. Das Spiel steht still, solange die Übersicht offen ist
  (C, Esc oder ein Klick daneben schließt sie).
- **Die Beute (rechts neben der Übersicht):** Die Überschrift **„Beute: 72“** zeigt die aktuell übrige Nahrung, ohne
  Orts- oder Epochenzeile darunter. Nahrungsanteile und die drei am häufigsten gegessenen Tierarten gelten für
  die ganze Epoche, über Orte, Generationen und Linien hinweg. Eine Tierart zählt einmal pro gefressenem Tier, auch wenn
  es viele Fleischbrocken hat; das Töten allein zählt hier nicht. Andere Epochen haben eigene Listen.
- **Verhalten formt deine Art:** Beißen, Stoßen und Verfolgen bestimmen die Richtung deiner Nachkommen; Bodenkontakt (sich am
  Grund abstützen und dort entlanglaufen) gibt fleischige Stützflossen, später kräftigere Beine; die Richtung, in die du
  am meisten schwimmst, formt die Flossen. Das Verhalten schaltet keine Art frei – es verschiebt, wie deine Nachkommen
  aussehen und was sie können.
- **Ereignisse** je Zeitalter: große Räuber ziehen durch, Stürme wühlen das Wasser auf, Futter
  sprießt – immer wieder, nach der Weltzeit für alle zugleich.
- **Von Generation zu Generation** setzt sich fort, was sich bewährt hat (Tarnung, Bodenkontakt …). Das **Aussehen** und
  die Fähigkeiten der Art verändern sich **nur beim Generationswechsel** – im Leben wächst das Tier nur heran.
- **Blutig:** Bisse und Stöße bluten – als Wolke im Wasser dort, wo gekämpft wurde, und als Fleck
  am Boden.
- **Keine Spoiler:** Zeitalter, die noch ruhen, zeigen im Stammbaum nur ihren ausgegrauten Ast – im Gestein.

Kaum Zahlen und Balken – im Spiel ist fast nichts eingeblendet: oben in der Mitte die **Weltzeit** (Name des
Zeitalters, „vor 382.438.000 Jahren“ – die Jahre zählen für alle gleich rückwärts) und darunter die **Lebenslinie** deines
Tiers, unten (nur wenn er auftaucht) der Lebensbalken des Herrschers. Wie weit man sieht, zeigt das Wasser selbst (siehe
„Sicht unter Wasser“). Oben links erscheinen wenige, kurze Meldungen zum
Leben (Laichzeit, Gelege abgelegt bzw. befruchtet). **Der Name des Ortes** erscheint **nur beim Betreten**, groß und ohne Beschreibung, und blendet
wieder aus; **Hinweise, Erzählzeilen** („eine dunkle Gestalt ist zu hören …“) **und Namensschilder großer Tiere** gibt es
nicht – was man über ein Tier wissen will, steht in der Chronik des Lebens. Nur wenn Ausdauer verbraucht wird, erscheint neben dem Tier der grüne Ausdauerkreis. Verletzung und Verstecktsein zeigen sich am Bildrand,
am schiefer werdenden Klavier bei Gefahr und am Tier selbst. Schwer verletzt färben
sich alle vier Bildränder rot, und das Tier wird ein klein wenig langsamer.

### Der Stammbaum

**Ein Baum für alle sieben Zeitalter – und er zeigt nur deine jetzige Linie.** Von oben nach unten läuft die Zeit am
**Stamm** entlang (davor und danach läuft er gestrichelt aus: Das Leben ging vorher schon weiter und geht danach weiter).
Am Stamm sitzen sieben kleine Rauten, je Zeitalter eine, daneben Nummer, Name und Zeitraum („I · DEVON, vor 419–359 Mio.
Jahren“). Von jeder Raute geht ein **Ast** ab – **versetzt wie die Stäbe eines Fächers**: Das Devon setzt ganz oben an und
zeigt weit nach links, jedes spätere Zeitalter setzt ein Stück tiefer an und zeigt steiler nach unten, das Paläogen schon
nach rechts unten.

**Dein Weg** ist ein heller Strang auf seinem Ast: vom Urahn am Stamm bis zu deiner jetzigen Generation, die am Ende
leuchtet (dort schwimmt dein Tier). Mit jeder Generation wird er länger (zwölf Generationen füllen den halben Ast; länger
als sein Ast wird er nie). Wo deine Linie eine **neue Art** wurde, sitzt ein Knoten mit einem kleinen Bild der Art. Was
(noch) nicht gespielt ist, steht **ausgegraut** da – die Äste gepunktet bis an ihr Ende: die Möglichkeit des Fächers.
Zwischen und neben den Ästen **verzweigen sich leise die übrigen Linien des Lebens** – feine Zweige vom Stamm und von jedem
Ast: Alles ist ein Baum.

**Generationen und Arten stehen rechts**, sobald man etwas berührt (Maus oder ← →): ein Abschnitt des Strangs zeigt seine
Art und „Generation 4 bis 7 · 4 Generationen im Devon“, das leuchtende Ende „Deine Linie lebt · Generation 10“, der Ansatz
am Stamm den Urahn, ein leerer Ast sein Zeitalter (Zeitraum, „noch im Gestein“).

**Stirbt deine Linie aus,** siehst du nach der Meldung noch einmal ihren Strang mit dem Schädel am Ende – dann zerfällt er
von seinem Ende her zu Staub, und übrig bleibt nur der **Urahn**: Mit ihm beginnt das nächste Leben (vorerst; die alten
Äste bleiben im Spielstand gespeichert, werden aber nicht mehr gezeigt). Rechts unten **Weiterleben** bzw. **Leben
beginnen**, oben rechts lässt sich alles zurücksetzen (zweimal klicken).

<details>
<summary>Spoiler: Wie die verborgene Anpassung funktioniert</summary>

Einige Merkmale wachsen im Hintergrund langsam mit (mit abnehmendem Ertrag), Körper und Kampfwerte entstehen erst beim
Generationswechsel – als Wert sieht man nichts davon:

| Wer so lebt … | … dessen Nachkommen bekommen |
| --- | --- |
| besiegt Gegner mit Bissen bzw. Stößen | stärkere Gebisse bzw. Schädel; der jeweils andere Wert sinkt um ein Viertel des Basiszugewinns |
| verfolgt Gegner erfolgreich und besiegt sie | stärkere Flossen, dafür etwas weniger Schuppen |
| übersteht Angriffe und besiegt diese Gegner | stärkere Schuppen, dafür etwas schwächere Flossen |
| frisst überwiegend Pflanzen | mehr Lebenskraft |
| schwimmt weite Strecken | längerer Körper und höheres Tempo; halb so viel relativer Verlust an Schuppen |
| hält sich im zeitlichen Mittel tief im Wasser auf | mehr Gewicht und Schutz vor Schaden; halb so viel relativer Tempoverlust |
| frisst (nach Energie) überwiegend Fleisch bzw. Pflanzen | die Kost verschiebt sich Schritt für Schritt: Fleischfresser holen aus Fleisch mehr und aus Pflanzen weniger heraus (bei 90 % Fleisch nach zwei Generationen nur noch gut die Hälfte), Pflanzenfresser umgekehrt |
| frisst Pflanzen, weicht aus, versteckt sich, entkommt Jägern | Tarnmuster, einen schlankeren Körper, mehr Tempo, größere Augen |
| liegt oft still am Boden | sandig braun-graue Farben |
| stützt sich oft am Grund ab und läuft dort entlang | fleischige **Stützflossen** (schneller am Grund, hält sich in Strömungen) |
| bleibt nah bei Jägern, ohne aufzufallen | stärkere Nerven: Jäger bemerken einen später – nirgends angezeigt |
| frisst giftige Pflanzen | wird giftfester – nirgends angezeigt |
| hält sich oft oben im Licht bzw. unten in der Tiefe | hellere bzw. dunklere Färbung |
| schwimmt durch eine Farbhöhle | die Farbe der Höhle (grün bzw. schwarz) – einmal je Durchlauf |
| versteckt sich zwischen Pflanzen | grünere Farben, größere (wendigere) Flossen, eine flachere Rückenflosse |

Wer viel tötet, bekommt einen Ruf: Beutetiere fliehen früher, Räuber meiden einen, Verteidiger
werden schneller wütend. Wer mit Artgenossen und Verbündeten unterwegs ist, wirkt gefährlicher.

Jeder Artgenosse hat eine verborgene **Treue**. Sie steigt, wenn er von deiner Beute mitfrisst oder
mit dir grast, und sinkt, wenn er hungrig zusehen muss, wie du alles allein frisst (oder wenn du
ihn beißt). Treue Artgenossen jagen mit, verteidigen dich und verstecken sich mit dir; untreue
bleiben auf Abstand und gehen schließlich. Wer aus deiner Gruppe verärgert abzieht, verlässt sie für immer.

Im Leben verändert sich das eigene Tier nicht: Was dazukommt (Tarnung, Bodenkontakt, Färbung, Flossen …), sammelt sich im
Verborgenen (`Life.drift`), und beim Generationswechsel geht gut die Hälfte davon auf die Nachkommen über (`INHERIT.carry`,
höchstens `INHERIT.step.carry` je Generation). Jede Evolutionsrichtung wächst um `INHERIT.plateStep` × `INHERIT.gain` × ihre
Passung zur Spielweise (0 bis 1; höchstens `plateStep`, alle zusammen höchstens `plateTotal`). Größe, Robustheit und Kost
passen sich an wie oben. Vom Partner kommen 15 % seines Aussehens
(Farben, Länge, Flossen – keine Kampfwerte). Die Artgenossen tragen dasselbe weiter, jeder mit eigener Abweichung.
Im Stammbaum werden Linien nach Körperform, vorherrschender Platte und Kost zusammengefasst –
daher auch die lateinisch klingenden Namen (z. B. *Odontichthys carnivorus* für einen fleischfressenden Beißfisch).
</details>

## Die Musik des Ozeans

Ein instrumentaler Soundtrack, der live entsteht (`src/audio/OceanScore.ts`) und deshalb **nahtlos endlos** läuft, ohne sich
zu wiederholen: **minimalistische, organische elektronische Ambient-Musik** für einen urzeitlichen, fremdartigen Ozean –
weit, geheimnisvoll, lebendig, still schön, mit unterschwelliger Unruhe und dem Gefühl verletzlicher Existenz. Keine Stimmen,
kein durchgehender Beat, keine heroischen Melodien, keine epische Orchestrierung, keine Trommeln, keine Schreckeffekte – und
viel Raum für die Geräusche des Wassers, die das Spiel selbst spielt.

- **Das Tonmaterial** ist die **Obertonreihe eines tiefen D** (36,7 Hz): Alle Töne sind Vielfache davon. Flächen und
  Glastöne klingen dadurch wie natürliche Resonanzen eines Körpers – vertraut und doch fremd (der 7., 11. und 13. Teilton
  liegen zwischen den Tasten eines Klaviers).
- **Es beginnt beinahe lautlos:** erst nur der Grund (ein Ton, den man mehr spürt als hört, und der Atem des Wassers), dann
  kommen nach und nach die **Klangflächen** – drei Stimmen, die sehr langsam zwischen offenen, schwebenden Klängen wandern,
  jede atmet für sich und schweigt manchmal ganz –, die **fließenden Resonanzen** (Rauschen, das in schmalen Bändern auf
  Obertönen singt und langsam gleitet) und **ferne, gläserne Töne**, weit weg im Raum.
- **Motive:** wenige prägnante Folgen aus **drei, vier Tönen** – kleine Schritte, ein unerwarteter Sprung, nie aufgelöst. Sie
  tauchen selten auf, oft nur als Bruchstück, manchmal eine Oktave tiefer und mit einem fernen Echo; eine Stimme der Flächen
  gleitet vorher zu ihrem ersten Ton.
- **Pulse:** weiche, **unregelmäßige** Stöße in der Tiefe, wie ein fremdes Herz – in Ruhe kaum zu hören.
- **Gefahr:** Kommt ein großer Räuber näher, entsteht **allmählich rhythmische Spannung**: Die Pulse werden dichter und
  regelmäßiger, ein **gedämpftes Ostinato** aus wenigen gezupften Tönen in ungeraden Gruppen (3 + 2 + 2) setzt ein – erst
  vereinzelt, dann dichter und heller –, die Flächen beginnen zu zittern, ein dunkler, reibender Klang schwillt an, enge
  Dissonanzen steigen auf und vergehen. Ist die Gefahr vorüber, **gleitet alles langsam zurück in die Stille** (die
  Spannung kommt allmählich und geht noch langsamer).
- **Tiefe:** Höhen und Melodisches treten zurück, die Glastöne werden dumpf und tiefer, Druck, tiefe Resonanzen und ein Ächzen
  wie von nachgebender Welt treten hervor – und lange Momente fast völliger Stille.
- **Ein Artgenosse stirbt:** Die Klanglandschaft bricht für einen Moment fast ganz zusammen; nur eine tiefe Resonanz und zwei
  Töne eines Motivs hallen nach, brüchig, etwas zu tief. Dann kehrt die Welt zurück.

Titelbild und der Einschnitt zwischen zwei Leben nutzen dieselbe Klanglandschaft, ruhiger, ohne Gefahr und mit den Motiven
etwas öfter. Eine Hörprobe lässt sich im Browser rendern: `OceanScore` in einem `OfflineAudioContext` anlegen, Stimmung setzen
(`set({ threat, depth })`), `tick(t)` in kleinen Schritten bis zum Ende aufrufen, dann `startRendering()`.

### Klänge der Bedienung

Die Bedienung klingt zurückhaltend, aber mit Gewicht – nach Stein, Wasser und einem großen, dunklen Raum: Alle Bedienklänge
laufen durch einen **Hall**, der wie ein Gewölbe unter Wasser nachklingt (gefaltetes, abklingendes Rauschen, das zum Ende hin
dunkler wird). **Überfahren** ist ein leiser Glanz, **Klicken** ein weiches Antippen von Stein, **Bestätigen** (die
wichtigsten Knöpfe, „Weiterleben“) ein tiefer, weicher Schlag mit einem offenen Klang aus Grundton, Quinte und Oktave und
einem hellen Schimmer darüber. Ein **Buch** oder eine Tafel öffnet sich mit einem dunklen Anschwellen, Seiten werden
umgeschlagen, Lesezeichen klopfen mit einem kleinen Glockenton. In der Auswahl der Zeitalter rauscht beim Wechseln eine
Strömung, **Aufbrechen** in ein Zeitalter ist ein Sog in die Tiefe mit einem weiten Chor, und ein ruhendes Zeitalter
antwortet mit Stein, der über Stein reibt. Die Lautstärken stehen in `UI_GAIN` (`src/audio/Audio.ts`).

Die **Knöpfe** sind Platten aus dunklem Stein mit abgeschrägten Ecken, einem feinen Ockerrand und zwei kleinen Rauten an
den Seiten; die wichtigste Wahl liegt auf einer Platte aus Bernstein, Gefährliches auf einer blutroten. Angewählt wird die
Platte heller, mit der Tastatur gewählt glüht sie leise (`Button` in `src/ui/ui.ts`).

## Steuerung

**Die Tasten lassen sich frei belegen:** im Titelbild unter „Steuerung“ und in der Rast (Esc) – direkt im Spiel. Dort steht jede Handlung mit **zwei Tasten** (Haupt- und Zweittaste): eine anklicken (oder mit den Pfeiltasten
anwählen und Eingabe drücken), dann die neue Taste drücken. **Entf** (oder ein Rechtsklick) leert sie, **Esc** bricht ab.
Gehört die Taste schon einer anderen Handlung, wechselt sie hierher – unten steht dann, wem sie genommen wurde.
**Grundbelegung** stellt alles wieder her. Die Belegung gilt sofort (auch mitten im Spiel), wird im Browser gespeichert
(`evo-keys-v1`, unabhängig vom Spielstand) und überall verwendet: die Zeichen über dem Kopf („E“ zum Laichen, „F“ zum
Ansprechen) zeigen die eigene Taste, ebenso der Übersicht-Knopf oben rechts und die Hinweise in den Aufträgen. **Esc** ist
fest (Rast, zurück); in Menüs wählen immer auch die Pfeiltasten und Eingabe. Code: `src/state/keymap.ts` (Belegung),
`src/ui/keysPanel.ts` (die Seite), `src/objects/Controls.ts` (liest sie im Spiel).

Die Grundbelegung – die rechte Hand liegt auf den Pfeiltasten, die linke auf **Q W E R**:

| Taste | Aktion |
| --- | --- |
| ← → ↑ ↓ | schwimmen |
| Leertaste (auch ↑) | auftauchen |
| E (auch Q) | beißen und fressen – zur Laichzeit: laichen, sobald über dem orangen Laich deiner Art das Zeichen **E** erscheint (als Weibchen: dicht am Grund) |
| W (auch Shift) | sprinten (kostet Ausdauer) |
| (nichts tun) | ausruhen: sich treiben lassen, Ausdauer und Lebenskraft kehren zurück (langsam schwimmen heilt auch, nur langsamer) |
| R | Stoß: Anlauf nehmen, mit dem Schwung gleiten (betäubt kleine und mittelgroße Tiere kurz) |
| F (auch Eingabe) | ansprechen: einen Artgenossen, über dem das Zeichen **F** erscheint; im Gespräch: weiter (bei einer Frage: ← → wählen, F bestätigt); an der großen Muschel: Muscheln verteilen (← → wählen, Eingabe segnet, Esc geht) |
| S | deine Gruppe rufen bzw. fortschicken (nach der gemeinsamen Jagd) |
| C | Werte, Körper, Muscheln und Lebensraumkarte; daneben „Beute: N“ mit der übrigen Nahrung |
| P (und immer Esc) | Rast (Pause) mit Steuerung, Hauptmenü – und „Leben weitergeben“, sobald Laich deiner Generation da ist; läuft der Weg ins Hauptmenü, bricht sie ihn ab |
| M | Ton an/aus |

**Zum Hauptmenü (und später weiterspielen):** In der Rast gibt es den Knopf **„Hauptmenü“**. Danach läuft das Spiel noch
**5 Sekunden** weiter – oben in der Mitte zählt ein Schild herunter („Zum Hauptmenü in 5 …“) –, damit man so keiner
schwierigen Lage (einem Räuber, einem Kampf) entkommt. Esc, die Rast-Taste oder ein Tipp auf das Schild bricht ab; stirbt
das Tier in dieser Zeit, zählt der Tod. Dann wird alles gespeichert, auch **die Stelle, an der man gerade ist**: Mit
„Weiterleben“ im Titelbild kommt man **genau dort** wieder an (`quitStep`/`quitToTitle` in `src/scenes/LevelScene.ts`,
`EpochProg.resume` in `src/state/GameState.ts`).

**In der Auswahl der Zeitalter:** ← → wählen, ↑ ↓ (oder Tab) zwischen den Knöpfen, Eingabe: aufbrechen, Esc: zurück.
**Im Stammbaum:** ← → geht von Knoten zu Knoten. **In der Chronik des Lebens:** 1 bis 7 oder Tab wechseln den Teil.

**Am Laich (E):** Geschwister und nächste Generation ansehen, Nahrung und Kosten je Ei ablesen, mit B befruchten.
Ein Wechsel wird bestätigt; Esc kehrt zum lebenden Fisch zurück. Die Karte selbst öffnet sich mit C.

Auf Handy und Tablet erscheinen im Level Bildschirm-Knöpfe (am besten im Querformat spielen).

## Entwickler-Einstellung

Zum Testen und Abstimmen: Im Titelbild oben rechts, neben dem Ton, sitzt ein kleines **Zahnrad**. Es öffnet eine Seite
mit **allen Zahlen, die das Gleichgewicht bestimmen** – jeweils mit dem eingestellten Standard daneben:

- **Nahrung:** Nahrung je Lebenskraft der Beute und wie stark sie bei großen Tieren abnimmt, wie viel in einem großen
  Brocken steckt, Nahrung je Pflanze und je Ei, Fleisch je Biss anderer Tiere, wie schnell Pflanzen nachwachsen.
- **Nachwuchs und Laichen:** Nahrung je Nachkomme, wie viel mehr weiter Entwickelte brauchen, höchstens Nachkommen, Pause
  nach dem Laichen, immer als Männchen schlüpfen, Reichweiten, Zeiten der KI-Partner, Verderben der Gelege.
- **Leben:** Dauer bis zur Laichzeit und danach (und wie viel länger je Generation), Größe beim Schlüpfen, Alter, das
  Langsamerwerden am Ende, Heilen beim Treiben und beim langsamen Schwimmen (und bis wohin), Heilkraut.
- **Vererbung:** wie stark sich die Nachkommen je Generation verändern (Richtungen, Obergrenzen, Größe, Robustheit, Kost,
  Angesammeltes, Partner).
- **Eigenes Tier:** Grundwerte des ersten Fischs (Lebenskraft, Biss, Stoß, Tempo).
- **Alle Tiere:** Faktoren auf Lebenskraft, Biss, Tempo und Angriffstempo aller Arten.
- **Biss der Jäger:** wie weit vor dem Maul ein Jäger ansetzt, wie lange er ausholt, vorschnellt und sich erholt, wie schnell er dabei
  wird, die Pause bis zum nächsten Biss, wie sehr das alles streut (schnelle Bisse, längere Pausen) und wie lange er beim
  Vorstoß noch nachlenkt (`BITE` in `src/sim/bite.ts`).
- **Tiere einzeln:** eine Tabelle mit jeder Art – **wie viel Nahrung sie bringt**, Lebenskraft, Biss, Tempo und Stärke.
  Ohne eigenen Wert richtet sich die Nahrung nach der Lebenskraft (bei Größe 1).
- **Gruppe und gemeinsame Jagd:** Größe der Gruppe, Angriffskraft der Artgenossen, Zielzahlen der Jagd.

Geänderte Werte leuchten ocker, ↺ (bzw. ein Doppelklick in der Tabelle) setzt einen Wert zurück, „Alles zurücksetzen“
alle. Ein Suchfeld filtert. **Exportieren** gibt die geänderten Werte als Text aus (zum Weitergeben), **Importieren**
übernimmt sie wieder. Gespeichert wird im Browser (`localStorage`, Schlüssel `evo-tuning-v1`) – die Werte gelten beim
nächsten Start wieder und die meisten ab dem nächsten Ort bzw. Leben. Sind eigene Werte aktiv, steht unter dem Zahnrad
leise „eigene Werte“. Im Mehrspieler rechnet die Tiere der Ortswächter – dort gelten dessen Werte. Das Register aller Werte
steht in `src/data/tuning.ts`, die Seite in `src/ui/devConfig.ts`.

## Mehrspieler-Prototyp

EVO wird ein persistentes Online-Spiel mit einem **autoritativen Server** ([Colyseus](https://colyseus.io) 0.18, TypeScript).
Der erste Meilenstein steht: **Mehrere Spieler betreten denselben Ort und sehen einander schwimmen.**

- **Ein Raum je Ort:** Wer einen Ort betritt, kommt in dessen Raum auf dem Server (Zeitalter und Ort, z. B. `0/riff`);
  wer ihn verlässt, verschwindet dort und erscheint im nächsten. Die Orte sehen für alle gleich aus (feste Weltsaat).
- **Die anderen Spieler** schwimmen als ihr eigener Fisch – mit ihrem Aussehen, ihrer Größe (Jungtier oder ausgewachsen),
  Bissen und Stößen – und ihrem **Namen** darüber. Ihre Lage kommt etwa 20 Mal je Sekunde an und wird geglättet
  (`src/net/Interp.ts`): Jede Meldung trägt die Uhrzeit des Absenders, so stört das Zittern des Netzes die Bahn nicht. Die
  anderen werden ein kleines Stück in der Vergangenheit gezeigt – bei einer ruhigen Verbindung knapp 0,1 Sekunden, bei
  einer wackligen (oder einem langsamen Rechner) von selbst mehr, höchstens 0,4 Sekunden. Bleibt eine Meldung aus,
  schwimmen sie kurz in ihrer Richtung weiter, statt stehen zu bleiben. Der Server verteilt Änderungen 30 Mal je Sekunde.
- **Der Server prüft**, was die Clients melden: niemand schwimmt schneller, als ein Fisch kann (sonst setzt er ihn
  zurück), und niemand verlässt den Ort durch die Wand. Die Grenzen kennt er aus demselben Weltgenerator.
- **Die Weltzeit** kommt vom Server – für alle gleich.
- **Die gemeinsame Art (Koop):** Je Zeitalter gibt es einen Raum der Art (`src/server/SpeciesRoom.ts`), der über alle Orte
  und Szenen hinweg verbunden bleibt (`src/net/Species.ts`). Er hält den **Laich aller Spieler**: die Geschwister der
  jetzigen Generation und den Laich der nächsten, jedes Ei unter seiner Kennung. Wer laicht, legt seine Eier dorthin
  (Eier aus einer vergangenen Generation verfallen); wer stirbt, wählt aus dem gemeinsamen Laich, und der Server **teilt
  das Ei zu** (wer zuerst kommt). Wählt jemand ein Ei der nächsten Generation, beginnt sie **für alle**. Stirbt jemand
  ohne Laich, meldet der Server allen das **Aussterben**. Der Raum bleibt bestehen, wenn alle gegangen sind (bis der
  Server endet); wer sich meldet, bringt seinen eigenen Laich mit – ist er allein im Raum (oder die Art ausgestorben),
  beginnt die Art mit seinem Laich neu. Ohne Server bleibt alles beim eigenen Laich. (Im Karbon hat vorerst jeder sein
  eigenes Gelege.)
- **Verbindung weg?** Der Platz bleibt 20 Sekunden frei (der Fisch wartet halb durchsichtig), der Client verbindet sich
  von selbst neu. Ist gar kein Server erreichbar, geht es still allein weiter.
- **Gemeinsame Tiere und Pflanzen:** Alle am Ort sehen **dieselben Tiere**, dasselbe Fleisch und **dieselben Pflanzen**
  (wer abfrisst, frisst es allen weg; nachwachsen und die Blütezeit rechnet der Ortswächter). Gerechnet werden sie im Spiel eines
  Spielers, dem **Ortswächter** (wer zuerst da war); der Server verteilt sie an alle anderen. Beißt oder stößt ein anderer
  Spieler ein Tier, geht der Treffer an den Ortswächter; Tiere jagen, meiden und beißen **jeden** Spieler (den jeweils
  nächsten); wer vom Fleisch frisst, nimmt es allen weg. Geht der Ortswächter (oder ist sein Fenster im Hintergrund bzw.
  er in der Rast), übernimmt ein anderer Spieler die Tiere, so wie sie gerade sind. Neue Tiere (Durchzügler, Rückkehrer,
  Schlüpflinge) kommen nur beim Ortswächter dazu. Kein Tier verschwindet vor den Augen eines Spielers.
- **Noch für jeden einzeln:** der Laich, deine Artgenossen (Gruppe, Auftrags-Figuren, Laich-Partner) und die Tiere eines
  Auftrags – die sieht nur, wem sie gehören.

Oben rechts steht klein, wie viele andere Spieler an deinem Ort sind – und wie lange eine Nachricht zum Server und zurück
braucht (z. B. „· 40 ms“; ab 150 ms wird die Zeile ocker: Dann liegt ein Ruckeln eher an der Verbindung als am Spiel).

### Selbst ausprobieren (ein Rechner)

```bash
npm install
npm run dev
```

Dann **zwei Fenster** öffnen: `http://localhost:8080/?name=Anna` und `http://localhost:8080/?name=Ben&slot=2`
(`slot=2` gibt dem zweiten Fenster einen eigenen Spielstand – sonst spielen beide denselben Fisch). Beide starten im
Laichfluss und sehen einander. Mit `?offline` spielt man ohne Server.

### Mit Freunden über Tailscale

[Tailscale](https://tailscale.com) verbindet eure Rechner in einem privaten Netz – ohne Portfreigabe am Router und ohne
gemieteten Server.

1. **Tailscale installieren** – auf deinem Windows-PC und bei jedem Freund – und anmelden. Deine Freunde müssen deinen PC
   erreichen können: Entweder lädst du sie in dein Tailnet ein (Admin-Konsole → *Users* → *Invite*), oder du teilst nur
   deinen PC mit ihnen (Admin-Konsole → *Machines* → dein PC → *Share*).
2. **Server starten** auf deinem PC: **`Spielabend-starten.bat` doppelklicken** (installiert, baut und startet) – oder
   `npm run spielabend`. Nur du brauchst Node.js und das Projekt; deine Freunde brauchen nur Tailscale und einen Browser.
3. **Adresse weitergeben:** Der Server schreibt beim Start die Adresse für Freunde ins Fenster
   (`Freunde (Tailscale): http://100.x.y.z:2567/?name=IhrName`). Sonst steht sie im Tailscale-Fenster bzw. bei
   `tailscale ip -4`. Mit MagicDNS geht auch der Name, z. B. `http://mein-pc.tail1234.ts.net:2567`. (Zum Entwickeln
   geht auch `npm run dev` – dann Port 8080.)
4. **Windows-Firewall:** Fragt Windows beim ersten Start, ob Node.js Verbindungen annehmen darf, **erlauben** (private
   Netzwerke). Kommt keine Frage und Freunde erreichen dich nicht: in der Windows-Firewall eine eingehende Regel für
   TCP-Port 2567 (bzw. 8080) anlegen.

Solange dein PC läuft, läuft die Welt. Das Spiel auf GitHub Pages bleibt eine Einzelspieler-Fassung (dort gibt es keinen
Server).

Alle neuen Fische schlüpfen im **Laichfluss** – dort trefft ihr euch. Wer weiterschwimmt, sieht die anderen erst wieder
im selben Ort.

### Der Server im Projekt

```
src/server/index.ts      der Spielserver: Räume (je Ort einer, filterBy 'zone')
src/server/ZoneRoom.ts   ein Ort: Spieler betreten/verlassen, Lage prüfen (Tempo, Grenzen), Wiederverbinden
src/net/schema.ts        der Zustand, den der Server verteilt (Colyseus-Schema) – von Server und Client genutzt
src/net/protocol.ts      Nachrichten und Grenzwerte (Sendetakt, Höchsttempo …)
src/net/NetClient.ts     die Verbindung im Browser (wird nur geladen, wenn ein Server da ist)
src/net/NetSync.ts       Level ↔ Server: melden, die anderen zeigen; Name (?name), Server (?server), ?offline
src/net/RemoteFish.ts    der Fisch eines anderen Spielers: geglättet, mit Namen
src/net/Interp.ts        die Glättung: Uhrzeit des Absenders, Verzögerung nach Netz, kurz weiterschwimmen
src/net/WorldSync.ts     gemeinsame Tiere und Pflanzen: Ortswächter meldet, Gäste zeigen Stellvertreter, Wechsel
src/net/GhostAnimal.ts   ein Tier des Ortswächters bei den anderen: folgt den Meldungen, gibt Treffer weiter
```

`npm run typecheck` prüft den Server ohne Browser-Typen (`tsconfig.server.json`) – so rutscht nichts aus dem Browser
(Phaser, `window`) in den Server. `npm test` startet den Server und lässt zwei Clients einander sehen (`tests/net.test.ts`).

## Entwickeln

Voraussetzung: [Node.js](https://nodejs.org) 22 oder neuer.

```bash
npm install
npm run dev      # Dev-Server mit Live-Reload auf http://localhost:8080
```

| Befehl | Was es macht |
| --- | --- |
| `npm run dev` | Startet Spiel und Spielserver zusammen (Live-Reload, auch für den Server) |
| `npm run build` | Typprüfung + Produktions-Build: das Spiel nach `dist/client`, der Server nach `dist/server` |
| `npm start` | Startet den gebauten Server auf Port 2567 – er liefert auch das Spiel aus |
| `npm run spielabend` | Baut das Spiel und startet den Server – für einen Spieleabend (unter Windows auch: `Spielabend-starten.bat` doppelklicken) |
| `npm run preview` | Zeigt den fertigen Build lokal an (ohne Server, also allein) |
| `npm run typecheck` | Nur TypeScript prüfen (Spiel, Tests und Konfiguration) |
| `npm test` | Tests der Spiellogik ohne Browser (Vitest, `tests/`): Weltgenerator, Lebenszyklus, Vererbung, Entwickler-Einstellung |

**Entwickler-Modus:** `?debug` an die Adresse hängen (z. B. `http://localhost:8080/?debug`) – im Level
werden die verborgenen Werte, Artgenossen, Verbündete und Durchzügler eingeblendet. Mit
`?debug&gallery` gibt es eine Übersicht über viele Ausprägungen der Spielfigur und alle Tierarten
(Leertaste blättert). `?touch` zeigt die Bildschirm-Knöpfe auch am PC. Mit `?debug` lässt **T** dein Tier eine Minute
altern – so kommt man schnell zum Laichen (Laichzeit nach drei Minuten) und zum Generationswechsel.

**Mehrspieler-Adresszusätze:** `?name=Anna` (Name über dem Fisch, wird gemerkt), `?slot=2` (eigener Spielstand – für ein
zweites Fenster im selben Browser), `?offline` (ohne Server spielen), `?server=http://…` (einen anderen Server benutzen).

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
│   ├── epochs.ts        Zeitalter: Zeitraum, Tiere, Ereignisse, spielbar oder ruhend, Zeile und Text für die Auswahl
│   ├── quests.ts        die Aufträge der Artgenossen: Texte, Schritte, das Tier, das den Gefährten frisst; die gemeinsame Jagd (JAGD) und der Schwarm (SWARM) mit allen Zielzahlen
│   ├── world.ts         Orte je Zeitalter (Bewuchs, Tiefe, Höhlen; Lage kommt aus paleo.json)
│   ├── biota.ts         was am Grund wächst: Gewichte je Ortsart, Zeitalter und Untergrund
│   ├── paleo.json/.ts   Urzeit-Karten: Umrisse der Kontinente, Meere und die Lage der zehn Orte je Zeitalter
│   ├── life.ts          Welt und Leben: Weltsaat und Weltzeit (WORLD), Wachsen und Altern (LIFE), Laichen (SPAWN), Vererbung (INHERIT), Sonstiges (MISC)
│   ├── karbon.ts        das Karbon: Gelege und Gefahr (BROOD), Sauerstoff (OXYGEN), Klettern (CLIMB), Evolution durch Verhalten (KTRAIN)
│   └── tuning.ts        die Entwickler-Einstellung: alle Balancing-Werte mit Standard, Speichern, Export/Import
├── sim/life.ts          der Lebenszyklus als reine Rechnung (Wachstum, Lebensabschnitte, Laichbereitschaft, Weltzeit) – auch für den Server
├── sim/sight.ts         die Sicht unter Wasser als reine Rechnung (Blickfeld nach vorn, kleiner Kreis nach hinten, Verschwimmen)
├── sim/bite.ts          der Biss der Jäger: Ablauf (ausholen, vorschnellen, zuschnappen, erholen) und seine Streuung
├── sim/brood.ts         das Karbon als reine Rechnung: Gelege, Nahrung und Metamorphose, Eier zur Wahl, Vererbung aus dem Training, Hänge, Sauerstoff
├── state/GameState.ts   Leben (Lauf), Gelege, Vererbung, verborgene Merkmale, Ruf, Stammbaum, Speichern (ohne Phaser)
├── server/              der Spielserver (Colyseus): index.ts (Räume), ZoneRoom.ts (ein Ort mit seinen Spielern), SpeciesRoom.ts (die gemeinsame Art: der Laich aller Spieler eines Zeitalters)
├── net/                 Mehrspieler im Spiel: protocol.ts, schema.ts (gemeinsam mit dem Server), NetClient.ts, NetSync.ts, RemoteFish.ts, Species.ts (die gemeinsame Art im Koop)
├── level/
│   ├── LevelGen.ts      erzeugt jeden Ort – für alle Spieler und in jedem Leben gleich (feste Weltsaat), ohne Phaser
│   └── terrain.ts       der Meeresboden: glatte Höhenlinie, Zonen aus Sand/Fels/Schlamm, Felsbrocken, Bögen, Hitboxen
├── art/                 alle Grafiken, per Canvas gemalt (Rauschtexturen, Schattierung, Randlicht)
│   ├── paint.ts         Malwerkzeuge: Haut, Augen, Zähne, Rauschen
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen, stufenlos aus den Merkmalen
│   ├── speciesArt.ts    alle anderen Tiere (Fische, Haie, Kopffüßer, Seeskorpione, Trilobiten, Mosasaurier, Plesiosaurier, Schildkröten, Ammoniten); Jäger mit Kiefer auch mit halb und weit offenem Maul (`openJaw`, `jawOf`)
│   ├── worldArt.ts      Hintergründe, Pflanzen, Dickicht, Effekte
│   ├── lifeArt.ts       Schwämme, Korallen, Moostierchen, Armfüßer, Seelilien, Cystoideen, Algen sowie Plankton und Graptolithen
│   ├── terrainArt.ts    der Meeresboden in gemalten Stücken (Sand, Fels, Schlamm) und alle Felsen
│   ├── shellArt.ts      die Muschel (eine Wellhornschnecke) und ihr Funkeln
│   ├── mapArt.ts        Kartenmaße, Lage der Punkte, Gebiete um die Orte
│   ├── paleoArt.ts      die Urzeit-Erde: Land, Küstenschelf, Nebel und Aufdecken
│   ├── paleoGeo.ts      Küstenlinien, Land-Wasser-Raster und Wegsuche (A*) um das Land herum
│   └── uiArt.ts         Symbole
├── assets/title/        das Bild des Titelbilds (der versteinerte Urfisch in der Höhle)
├── assets/eras/         die Bilder der drei Zeitalter in der Auswahl
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── audio/OceanScore.ts  die Musik des Ozeans: live entstehendes Ambient aus der Obertonreihe – Flächen, Resonanzen, Glas, Motive, Pulse, Ostinato bei Gefahr
├── objects/             Spielfigur, Tiere (KI, Bindung, Durchzügler), Artgenossen, Nahrung, Steuerung, Drift.ts (Plankton, Schnee, Graptolithen), Quest.ts (Gespräche und Szenen der Aufträge), HuntQuest.ts (die gemeinsame Jagd), Swarm.ts (deine Gruppe rufen, begleiten, fortschicken), Spawning.ts (Laichen: Gelege, Partner, Schlüpfen), Shrine.ts (die große Muschel), Sight.ts (das trübe Wasser über dem Bild), Nest.ts (das Gelege im Brutsumpf)
├── util/                Mathe, Zeichnen, Fehler abfangen (guard.ts), ein Ereignis-Bus ohne Phaser (emitter.ts)
├── ui/                  Knöpfe, Texte, Menü-Steuerung (ui.ts), die Übersicht (overview.ts), die Segen als Punktfolge (upTrail.ts), die Entwickler-Einstellung (devConfig.ts)
└── scenes/              Titel, Auswahl der Zeitalter (EraScene), Intro, Level, HUD, der Einschnitt zwischen zwei Generationen (GenerationScene), die Wahl aus dem Laich im Devon (RoeScene), der Abschied, wenn die gemeinsame Art ausstirbt (ExtinctScene), die Ei-Wahl im Karbon (ClutchScene), Stammbaum, Chronik des Lebens (AquapendiumScene), Demo-Ende
tests/                   Vitest: Weltgenerator (gleiche Saat = gleicher Ort), Lebenszyklus, Vererbung, Karbon (Gelege, Metamorphose, Ei-Wahl, Vererbung aus dem Verhalten, Hänge, Sauerstoff), Zeitalter (Linien, Stammbäume, Chronik des Lebens), Entwickler-Einstellung, Ereignis-Bus, Spielserver mit zwei Clients
art/                     Ist-Stand aller Grafiken als PNG (alt/), Biss-Vorlagen als SVG (vorlagen/), Ablage für eigene Bilder (neu/) – siehe art/README.md
tools/                   bite_sheets.py (Biss-Vorlagen der Linien), fish_sheet.py (Bewegungs-Sprite-Sheet eines Fisches)
```

### Später klären (vorläufig so entschieden)

Damit schnell gespielt und getestet werden kann, ist erst einmal Folgendes festgelegt – bitte später noch einmal ansehen:

- [ ] **Zeitalter:** Zur Wahl stehen sieben (Devon, Karbon, Perm, Trias, Jura, Kreidezeit, Paläogen); spielbar sind das
      Devon (dort beginnt jedes Leben) und das Karbon. Jedes Zeitalter ist eine eigene Welt mit eigener Linie – man bleibt in seinem
      Zeitalter (kein Übergang mehr ins nächste). Die Jahreszahl läuft in etwa 30 Tagen bis zum Ende des Zeitalters und
      bleibt dann stehen. Das Devon beginnt vorerst mit dem Urfisch; die Kreidezeit behält vorerst ihr bisheriges Bild,
      Trias, Jura und Paläogen warten auf ihre Bilder (Steintafel). Ordovizium und Silur sind verborgen.
- [ ] **Karbon:** Jeder Spieler hat sein eigenes Gelege (ein gemeinsames Nest im Mehrspieler fehlt noch; beim Gast
      fressen die Stellvertreter der Räuber am Nest mit). Ein Ei, das in der Gefahr schlüpft, ist gleich ausgewachsen;
      das neue Gelege kommt von selbst nach 5 Minuten; drei Eier stehen zur Wahl (die Start-Eier sind gleich, dann nur
      eines). Die Segen der großen Muschel überdauern im Karbon das Aussterben. Der Gipfel braucht etwa Beine und Griff je
      0,6 (gut fünf Generationen mit viel Training). *Rhizodus* kommt höchstens einmal, spät, ans Nest. Alle Werte in
      `src/data/karbon.ts`.
- [ ] **Die neue Musik** (Obertonreihe, Flächen, Glas, Motive, Pulse, Ostinato bei Gefahr) bitte mit Kopfhörern anhören –
      Lautstärken und Häufigkeiten stehen oben in `src/audio/OceanScore.ts`.
- [x] **Laichfluss:** Weniger kleine Fische und Trilobiten, Abstand zum eigenen Laich, keine großen ansässigen Jäger.
      Seltene größere Besucher kommen einzeln; größere Jäger wohnen im Flachwasser, Riesen im Tiefental.
- [ ] **Muscheln und Segen:** Muscheln gehören dir und bleiben über alle Läufe; je Linie verteilt man sie an der großen
      Muschel auf Lebenskraft (+2,5 %), Ausdauer (+¼ Kreis) und Sicht (+5 %). Kosten 1, 2, 4, 8 … gleich wofür, höchstens
      10 Segen (der zehnte kostet 512, zusammen 1023); eine neue Linie verteilt neu. Die Chance richtet sich nach der Stärke
      der Beute (10 % ebenbürtig, bis 20 % bei doppelt so starker, 5 % bei schwacher).
- [ ] **Sicht:** Sie hängt an der Sicht des Tiers, der Wasserqualität und der Tiefe; der Rand ist kurz, dahinter wird es
      dunkel. Bitte beim Spielen ansehen, ob es zu dunkel oder zu eng ist (`SIGHT` in `src/sim/sight.ts`: `front0`, `fade`,
      `water`, `depth`, `dark`, `darkSpread`).
- [ ] **Endgegner und Demo-Ende** sind ausgesetzt (gehören zum alten Zeitalter-Ablauf).
- [ ] **Altern nur beim Spielen:** Wer offline ist, altert nicht.
- [ ] **Eigene Gelege sind unangreifbar** – weder Räuber noch andere Spieler fressen sie.
- [ ] **Partner beim Laichen ist immer die KI** (garantiert). Später: echte Spieler mit Vorrang – dafür muss das Laichen
      auf den Server.
- [ ] **Geschlecht:** vorerst immer männlich (Laich zum Befruchten liegt im Startgebiet immer bereit). Später wieder zufällig.
- [ ] **Aussterben:** ohne Laich und ohne wartende Geschwister Neustart als Urfisch (wie bisher).
- [ ] **Goldene Geburt und Koop-Laich:** Der goldene Segen gilt nur für das Tier aus dem goldenen Ei (nicht für seine
      Nachkommen) und zählt nicht beim Preis des nächsten Segens; die Richtung ist zufällig (unter denen, die noch wachsen
      können). Im Koop teilen sich alle Spieler eines Zeitalters auf dem Server die Art; wer neu dazukommt, schließt sich
      ihrer Generation an (seine eigenen Eier aus einer früheren Generation verfallen). Stirbt jemand ohne Laich, endet
      auch das Leben der anderen (so wie gewünscht: „durch zu wenig Artgenossen ausgestorben“). Der Laich der Art lebt nur,
      solange der Server läuft (jeder hat eine Kopie im eigenen Spielstand).
- [ ] **Der Laich (Devon):** Die Eier tragen die Werte zur Laichzeit (nicht erst beim Tod); die Streuung betrifft nur
      Fähigkeiten, die die Linie schon entwickelt hat, und ist erblich. Passen mehr als 26 Eier in eine Gruppe, stehen die
      schwächsten nur als „+N“ da. Alte Spielstände: Geschwister und befruchtete Gelege werden beim Laden zu Eiern (so, wie
      das Tier gerade ist, ohne Streuung).
- [ ] **Nachkommen:** je Grundwert Nahrung einer (erster Fisch 20, je 1 % Verbesserung 2 % mehr, höchstens 12); beim
      Laichen wird die gesammelte Nahrung zu Nachwuchs, der Rest bleibt – mehrmals laichen zählt zusammen. Kein Hunger.
- [ ] **Rast im Mehrspieler:** pausiert nur bei dir; die anderen sehen deinen Fisch so lange still stehen.
- [ ] **Tiere rechnet vorerst der Ortswächter** (das Spiel eines Spielers), nicht der Server. Später: die Tier-KI auf den
      Server (dann kann auch niemand schummeln, und die Welt lebt ohne Spieler weiter).
- [ ] **Im Mehrspieler noch für jeden einzeln:** der Laich, deine Artgenossen (Gruppe, Auftrags-Figuren, Laich-Partner)
      und die Tiere eines Auftrags. Jeder Wasserabschnitt hat seinen eigenen Raum.
- [ ] **Tempo:** Das eigene Tier ist etwa 15 % gemächlicher als früher (Grundtempo 183 statt 215), alle anderen Tiere 10 %
      (`src/data/classes.ts`, `PACE` in `src/data/species.ts`) – Platz nach oben für schnellere Nachkommen. Angriffe der
      Tiere (Ausholen, Zustoßen, Ansturm) sind so schnell wie früher.
- [ ] **Futter:** Fleisch nach Stärke und Größe der Beute (`meatOf`, ein Zehntel der Lebenskraft; ein kleiner Beutefisch 1),
      in Brocken zu 5 und zu 1, jeder mit einem Bissen ganz gefressen (weitere Größen, wenn es größere Tiere gibt); eine
      Pflanze 1; Training gedeckelt nach den stärksten bezwungenen Gegnern (`ceilBase`, `ceilPer` in `INHERIT`).
- [ ] **Lebenskraft und Heilen:** alle Fische zäher (der erste Fisch 45 statt 30; Räuber, Verteidiger und Riesen × 1,25;
      Beutefische ab 6 Lebenskraft × 1,2 – die kleinsten sind mit zwei Bissen erledigt, kleine brauchen drei und mehr);
      Treiben heilt 1,2 % je Sekunde bis ganz, langsames Schwimmen 0,5 %.
- [x] **Karte:** Wasserquerschnitt auf C; direkte Gebietswechsel ohne Overworld und ohne zusätzliche Reisezeit.
- [ ] **Evolution sanft:** je Generation höchstens `plateStep` (4,5 %) einer Richtung, zusammen `plateTotal` (6,5 %); das
      eigene Tier verändert sich im Leben nicht (auch nicht durch eine Farbhöhle – die Farbe geht an die Nachkommen).
- [ ] **Lebenstempo:** Generation 1 ist nach 3 Minuten ausgewachsen und kann dann bis kurz vor dem Tod laichen (noch 8
      Minuten); Generation 2: 4 + 11; danach logarithmisch länger (Generation 8: 6 + 17). Die ganze Lebensdauer ist dieselbe
      wie zuvor (11, 15, 19, 23 Minuten). Laich der Artgenossen im Startgebiet verdirbt nicht.

### Ideen für später

- [ ] Andere Spieler als Partner beim Laichen (heute kommt ein Artgenosse der KI)
- [ ] Weitere Orte, Tiere und Zeitalter im Fischreich
- [ ] Gamepad-Steuerung
- [ ] Echte Zeichnungen/Sprites (z. B. von OpenGameArt oder Kenney) statt gemalter Canvas-Grafik

## Veröffentlichung

Der Workflow in `.github/workflows/deploy.yml` prüft und testet das Spiel bei jedem Push auf `main` und
veröffentlicht `dist/client` auf GitHub Pages (Settings → Pages → Source: **GitHub Actions**). Dort gibt es keinen
Spielserver – die Pages-Fassung spielt man allein. Für das gemeinsame Spiel läuft der Server auf deinem Rechner
(siehe [Mehrspieler](#mehrspieler-prototyp)).
