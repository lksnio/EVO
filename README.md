# EVO – Die Suche nach Eden

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
Die Welt steht derzeit im **Ordovizium**; Silur und Devon sind vorbereitet, aber noch nicht erreichbar.

**Stirbst du ohne befruchtetes Gelege, stirbt deine Linie aus** – und bleibt als Ast im
**Stammbaum des Lebens**, der mit jedem Spiel weiterwächst.

> Fan-Projekt, inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne
> werden im Browser erzeugt – es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## Ein Leben – und die nächste Generation

- **Heranwachsen:** Jedes Leben beginnt als **Jungtier** mit 40 % der ausgewachsenen Größe. Der Fisch wächst schnell, dann
  immer langsamer – nach **8 Minuten** Spielzeit ist er **ausgewachsen** (92 %) und nähert sich danach weiter der vollen Größe.
  Mit der Größe wachsen Lebenskraft, Biss, Stoß und Magen; ein Jungtier ist dafür etwas flinker. Ab etwa **22 Minuten** wird
  er **alt** (langsamer, schneller müde, weniger Lebenskraft), nach **30 Minuten** stirbt er an Altersschwäche. Gezählt wird
  nur die Zeit, in der man spielt – wer offline ist, altert nicht. Neue Lebensabschnitte melden sich oben links.
- **Laichen (Taste L halten, am Handy der Knopf „Laichen“):** Ausgewachsen, satt genug (gut die Hälfte des Magens) und im
  **Laichfluss** (dem Startort, flussaufwärts der Mündung):
  - **Als Weibchen** schwimmst du dicht über den Grund und hältst L – über dir füllt sich ein Ring, dann liegt dein
    **Gelege** am Boden. Kurz darauf kommt ein **Männchen deiner Art** vom Meer herauf, verweilt über dem Gelege und
    **befruchtet** es (eine helle Wolke, danach schimmert das Gelege warm).
  - **Als Männchen** bist du bereit, sobald du im Laichfluss bist: Ein **Weibchen deiner Art** kommt und legt ein Gelege
    ein Stück vor dir. Schwimm hin – über dem Gelege erscheint das Zeichen L – und halte L, um es zu befruchten.
  - Laichen kostet Kraft aus dem Magen (Weibchen mehr als Männchen); danach dauert es gut zwei Minuten, bis es wieder geht.
    Wer mehrmals laicht, hat mehrere Gelege – die **jüngste befruchtete** führt die Linie weiter.
  - Ein **unbefruchtetes Gelege verdirbt** nach vier Minuten. Ein Männchen, das schon unterwegs ist, findet dein Gelege
    auch, wenn du den Fluss verlässt.
  - Was noch fehlt („noch nicht ausgewachsen“, „zu hungrig“, „nur im Laichfluss“ …), steht auf der Steintafel (C).
- **Der Generationswechsel:** Stirbt dein Tier – durch einen Räuber, an Altersschwäche oder weil du es in der Rast (Esc)
  mit **„Leben weitergeben“** selbst beendest –, schlüpft aus deinem jüngsten befruchteten Gelege die nächste Generation.
  Ein Bildschirm zeigt das Tier, das starb, daneben den Nachkommen (ausgewachsen und so klein, wie er schlüpft), die
  deutlichste Veränderung in einem Satz und **deine Spielweise** (ein bis drei Punkte je Richtung). Mit „Schlüpfen“ geht
  es im Laichfluss weiter – dort, wo das Gelege lag; die Geschwister schwärmen aus. Was die Linie weiß (Orte, Muscheln,
  Aufträge, deine Gruppe), bleibt; Alter, Magen und Spielweise beginnen neu. Ohne befruchtetes Gelege stirbt die Linie aus.
- **Keine Wahl, sondern Anpassung:** Die Nachkommen sind **an deine Spielweise angepasst** – es gibt keine Platten mehr zur
  Auswahl. Jede Richtung (Stoßen, Beißen, Verfolgen, im Schwarm) wächst so stark, wie dein Leben zu ihr passte; was im Leben
  Stück für Stück gewachsen ist (Tarnung, Bodenkontakt, Flossen …), setzt sich zum Teil fort; Größe, Robustheit und Kost
  passen sich an wie bisher (siehe unten). Der **Partner** gibt etwas von seinem Aussehen mit, und das Geschlecht des
  Nachkommen entscheidet der Zufall.
- **Die Weltzeit** läuft für alle gleich (heute nach der Uhr des Rechners, im Mehrspieler nach der des Servers): Die
  12 Millionen Jahre des Ordoviziums dauern etwa 30 echte Tage. Die Ereignisse eines Zeitalters (Durchzügler, Blüte,
  Stürme …) kehren darin immer wieder – für alle zugleich. Oben im Bild stehen die Jahre, darunter die **Lebenslinie**
  deines Tiers (mit Marken bei „ausgewachsen“ und „alt“; sie leuchtet warm, sobald ein befruchtetes Gelege wartet).
- **Eine feste Welt:** Jeder Ort sieht für alle Spieler und in jedem Leben gleich aus (eine feste Weltsaat) – egal, von
  wo man ankommt.
- Alle Zahlen stehen an einer Stelle: `src/data/life.ts` (`WORLD`, `LIFE`, `SPAWN`, `INHERIT`).

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
    zwei Bisse. Wer oft stößt, bekommt einen harten, später gepanzerten Kopf – ein Stoß tut aber auch dem **eigenen Kopf ein wenig weh**
    (mit hartem Schädel weniger). Der Biss geht **aus dem Stand**: Der Körper
    bleibt, wo er ist – nur der Kopf reißt das Maul auf, schnappt zu und knirscht mit den
    Kiefern – mit starkem Gebiss deutlich wuchtiger. Zweimal schnell hintereinander zugebissen heißt:
    gepackt – kleinere Tiere zappeln dann nur noch.
  - **Anlauf und Schwung:** Weder Spurt noch Stoß sind ein Blitzstart. Beim **Spurt (W)** schlägt das Tier kräftiger und wird
    über etwa eine Sekunde **langsam schneller**, nach dem Loslassen klingt das Tempo ebenso langsam ab. Beim **Stoß (R)**
    baut es mit immer kräftigeren Flossenschlägen Tempo auf (R halten = längerer Anlauf, kurzes Antippen = kleiner Stoß), lässt
    dann die Flossen ruhen und **gleitet mit dem aufgebauten Schwung** ein Stück weiter – nach oben und unten lässt sich das
    noch lenken. Auf diesen Moment kommt es an: Wer **im Schwung beißt**, erreicht weiter nach vorn und beißt härter; auch
    der Zusammenstoß zählt erst bei hohem Tempo.
  - **Wenden braucht Zeit:** Das Tier dreht nicht auf der Stelle um – es bremst, dreht sich und nimmt dann erst in die neue
    Richtung Fahrt auf. Wer oft die Richtung wechselt, wird **wendiger** (seine Seitenflossen wachsen) und dreht schneller.
    Wer hauptsächlich nach oben, nach unten oder geradeaus schwimmt, wird in dieser Richtung schneller.
  - **Jagen mit Plan** – kleine Fische sind auf der Flucht pfeilschnell, aber sie schwimmen **nicht ohne Grund aus der
    Ferne** davon: Sie fliehen, wenn man ihnen **wirklich nah kommt** oder **auffällt** (sprinten, stoßen, gerade gekämpft).
    Dabei zählt die **eigene Größe**: Solange man klein ist, haben die anderen weniger Angst und lassen einen näher
    heran; je größer und stärker man wird, desto früher und weiter fliehen sie. Die Flucht geht **nie schnurgerade**,
    sondern mit Haken – mal hoch, mal runter, mal ein Schlenker –, Hauptsache weg. Wer lange ruhig in der Nähe bleibt
    (nicht sprinten, nicht kämpfen), kommt etwas näher heran – ganz nah lassen sie einen aber nie: Hinterhalt, Stoß und schnelle Bisse sind gefragt;
    zu Beginn sind kleine Fische mit zwei Bissen erledigt. Oder man **reizt einen großen Räuber**
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
    umher, und alle halbe Minute etwa zieht ein größeres Tier des Zeitalters durchs Bild (Ordovizium z. B. Orthoceras,
    Megalograptus, selten Cameroceras; Silur Entelognathus, Seeskorpione; Devon Haie, Panzerfische, Fleischflosser).
  - **Jeder Angriff ist zu sehen:** Alle Tiere holen vor dem Biss sichtbar aus (sie spannen sich und
    glühen kurz rötlich auf) und schnellen dann vor – wer aufpasst, kann ausweichen.
  - **Teilen** – frisst ein anderes Tier von deiner Beute mit, während du dabei bist, fasst es
    Vertrauen. Solche Verbündeten verteidigen dich.
  - …oder eine Mischung davon.
- **Deine Art – selten, und sie geben Aufträge:** Artgenossen (fast wie du, mit kleinen Abweichungen) sind **sehr selten**.
  Meist ist man allein; wer einem begegnet, trifft ihn bei einem **Auftrag** (`src/data/quests.ts`, `src/objects/Quest.ts`).
  Über einem Artgenossen, der etwas zu erzählen hat, erscheint in der Nähe ein kleines Zeichen **F**: Mit **F** (oder Eingabe;
  am Handy mit dem Knopf „Reden“) **spricht man ihn an**. Dann rückt die Kamera an beide Tiere heran (schwarze Balken wie beim
  Riesen im Hintergrund), er spricht in **Sprechblasen** (Text erscheint Buchstabe für Buchstabe, **F**/Eingabe/Antippen geht
  weiter) – dabei bewegt sich sein **Maul** in Silben, aus dem Maul steigen **Bläschen** auf, und es **blubbert** leise.
  Räuber ringsum ziehen ab, und solange gesprochen wird (und noch einen Augenblick danach), **greift in der Nähe niemand an** –
  weder dich noch deinen Gesprächspartner. Das eigene Tier bleibt an seinem Platz.
  - **Auftrag „Der Gefährte“ (Ordovizium):** Nach dem Start kann man ein wenig erkunden – **nach links geht es nicht hinaus**
    (dort entspringt der Fluss, das Ufer steigt bis zur Wasseroberfläche), nur nach rechts. Weiter rechts, im offenen Meer hinter
    der Mündung, wartet ein Artgenosse. Er erzählt von einem **Ort ohne Räuber, dafür mit Pflanzen überall** – ein sicherer Ort,
    an dem man es sich gut gehen lassen kann –, will dorthin aufbrechen, bittet, ihn zu begleiten, und **schwimmt voraus**
    (er wartet im nächsten Ort, der Tangwiese). Schwimmt man rechts hinaus, **trifft man ihn dort sofort**; ein kurzes zweites
    Gespräch, dann sagt er: „Warte … hörst du das?“ – beide schauen sich um, es grollt, und **ein großes Tier, das in diese Zeit
    passt** (im Ordovizium ein Riesenkopffüßer), kommt heran, **frisst ihn** und schwimmt davon. Das Tier lässt sich in
    `quests.ts` je Zeitalter einstellen (Silur z. B. Pterygotus, Devon Dunkleosteus); der Auftrag ist bisher nur für das
    Ordovizium eingetragen. Der Stand des Auftrags (0 offen, 1 vorausgeschwommen, 2 erledigt) wird im Spielstand gespeichert.
  - **Auftrag „Die gemeinsame Jagd“ (Ordovizium, nach dem Gefährten):** Im Ort, in dem der Gefährte gefressen wurde, wartet
    danach eine kleine Gruppe von **vier bis fünf Überlebenden deiner Art** – echte Artgenossen mit ihrem gewohnten Verhalten.
    Einen von ihnen kann man ansprechen: Er erzählt von einem **Schwarm Sacabambaspis** ganz in der Nähe und fragt, ob du
    mitjagst (**Ja/Nein** mit ← →, bestätigen mit F/Eingabe – oder antippen). Wer ablehnt, spielt ganz normal weiter; die
    Gruppe wartet, man kann es sich später anders überlegen. Wer zusagt, wird von der Gruppe begleitet; der Schwarm (etwa fünf
    kräftige Sacabambaspis, die sich mit einem Gegenstoß wehren und fliehen) zieht ein Stück entfernt. Gejagt wird mit den
    üblichen Mitteln – keine Vorgaben, kein Locken: Greifst du an, helfen die Artgenossen mit ihrer gewohnten KI mit. **Ziel:
    drei Sacabambaspis erlegen** (deine und die Risse der Gruppe zählen), du musst aber **selbst mitgejagt** haben. Ziel und
    Fortschritt stehen oben links in einem Schild („Sacabambaspis erlegt: 1 von 3“, wie viele deiner Gruppe noch leben, wohin der
    Schwarm zieht). Erlegte Tiere werden ganz normal zu Fleisch. Fehlen Tiere, sammelt sich der Schwarm nach ein paar Sekunden neu.
    Der Stand (0 offen, 1 abgelehnt, 2 Jagd läuft, 3 geschafft), die Zahl der Risse und deine Gruppe werden gespeichert – ein
    Ortswechsel setzt nichts zurück, und wer dich begleitet, kommt mit. Alle Texte und Zielzahlen stehen zentral in
    `src/data/quests.ts` (`JAGD`), der Ablauf in `src/objects/HuntQuest.ts`.
  - **Deine Gruppe – der Schwarm (Taste S, am Handy der Knopf mit den drei Fischen oben rechts):** Nach der Jagd erklärt dir
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
  - **Der Startort** ist ein **Fluss**, der **Laichfluss**: Du schlüpfst in einem flachen Becken zwischen **Fischlaich** am
    Boden – **keine anderen Tiere**, nur ein paar Pflanzen. Der Fluss fällt zum Meer hin ab, erst hinter der Mündung (im
    offenen Meer) wartet das Leben. Auch die ersten Räuber lassen dich im Fluss in Ruhe. Ausgewachsen kehrst du hierher
    zurück, um zu laichen.
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
    **grüne** in einem trüben Ort (im Ordovizium das Sandfeld; mit Querbinden wie bei einem Barsch) und eine **schwarze** in der Tiefe. Ihre Öffnung zeigt zum
    Ankunftsplatz und ist mit **losem Geröll** zugeschüttet (heller als der Fels, Steine mit Lücken dazwischen). Ein
    **kräftiger Stoß** (R, mit vollem Anlauf) bricht es auf – allein schafft das erst ein harter Kopf (Stoßfisch) oder ein
    großer, massiger Körper, sonst **im Schwarm**: Jeder Artgenosse, der dich gerade begleitet, stößt mit (mit drei
    Begleitern reicht es). Ein zu schwacher Stoß lässt nur Risse zurück, an denen man sieht, wie viel noch fehlt. Drinnen
    liegt **immer eine Muschel**; aufgebrochen bleibt das Geröll für den Rest des Lebens (Werte in `src/data/world.ts`,
    `CAVE_WALL`). Wer bis ans hintere Ende schwimmt und wieder herauskommt, hat die neue Farbe. Die Farbe lässt sich **nur einmal pro Spieldurchlauf** wählen – wer einmal
    gefärbt ist, wird nicht mehr umgefärbt. Die **Färbung** steht auf der Steintafel. Daneben gibt es einige
    niedrige **Felsspalten** zum Verstecken für Schlanke.
  - **Neue Orte schaltest du frei, indem du hinausschwimmst:** Nach **links und rechts gibt es keine Wand** – die Grenze
    eines Ortes sieht man nicht, es ist ein Stück Meer wie jedes andere. Wer über den Rand hinausschwimmt, kommt im
    **Nachbarort** an (auf der Karte erscheint er zum ersten Mal), am gegenüberliegenden Rand und **auf derselben Wassertiefe**.
    Gibt es auf der Seite mehrere Nachbarn, entscheidet die Tiefe: oben im Wasser der nördlichere, unten der südlichere.
    Dazu liegen **im Boden** (ein Schacht nach unten) und **oben im Licht** **Durchgänge** – man muss sie erst
    finden. Schwimmst du hinaus, landest du auf der **Karte**, und der Ort, zu dem du schwimmst,
    **erscheint dort zum ersten Mal**. Durch einen Durchgang kommst du am Gegenstück im neuen Ort heraus. Jeder Weg kostet etwas
    Zeit. Das Meer ist tief: Oben fällt das Licht herein, nach unten wird es immer dunkler. Auch Tiere, die den Rand
    erreichen, schwimmen einfach weiter hinaus.
  - **Die Karte ist die Urzeit-Erde:** Jedes Zeitalter hat seine eigene Weltkarte nach der **echten Lage der Kontinente** –
    Ordovizium: Gondwana im Süden, Laurentia, Baltica und Sibiria; Silur und Devon: Laurussia (Laurentia + Baltica),
    Gondwana, Sibiria, dazu Iapetus-, Rheischer Ozean, Paläotethys und Panthalassa ringsum (**Pangäa** gibt es erst viel
    später – im Perm). Die **Orte sind Punkte im Wasser**. Da du ein Fisch bist, bleibt das **meiste unbesucht**: Die Karte
    ist dunkel, nur um bekannte Orte und entlang der geschwommenen Wege (Blasenspuren) wird sie hell – das Land bleibt Nebel.
    Das Tier **schwimmt auf der Karte um das Land herum** (Wegsuche im Wasser, nie über Land), neue Orte decken sich mit
    einem Aufhellen entlang des Weges auf. Die Umrisse sind **gezeichnet, nicht vermessen** – vereinfachte Näherungen.
    Die Karte ist **weit herausgezoomt**: Die zehn Orte liegen nur in der Mitte, ringsum liegt noch viel Welt (Gondwana bis zum Südpol,
    dazu ferne Landmassen wie Nordchina, Südchina, Kasachstania – später braucht man das Land für die Schritte an Land). Die
    **Punkte der Orte sind klein**, das Tier darauf ebenso. `MAP_ZOOM` in `src/art/mapArt.ts` stellt ein, wie weit.
    Die Daten stehen in `src/data/paleo.json` (Umrisse, Meeresnamen, Lage der Orte, ferne Landmassen unter `far`); weitere
    Zeitalter (z. B. Pangäa) lassen sich dort ergänzen.
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
- **Das Aquapendium** (Knopf im Titelbild, wie der Stammbaum): ein **Buch** mit einer Seite für **jedes Tier** der Urmeere
  (41 Stück). Links das Bild, rechts der Steckbrief mit Zeitalter, Lebenszeit („vor ca. 450 Mio. Jahren“), ungefährer
  Länge, Rolle, Nahrung, Lebensweise (Einzelgänger, Schwarm, Rudel), Lebensraum und den **Werten aus dem Spiel**
  (Lebenskraft, Biss, Stärke, Tempo, Sinne), dazu ein paar Sätze zum echten Tier. **Alle Seiten sind von Anfang an da** –
  Tiere, die du noch nie gesehen hast, zeigen nur ihren **schwarzen Umriss** und Fragezeichen. Sobald du einem neuen Tier **nah genug** kommst, wird seine Seite gefüllt – oben links gleitet ein schmales
  **Schild** herein (dunkle Fläche, feine ochrefarbene Linien, ein Ammonit im Ring, darunter in kleinen Buchstaben
  „NEUER AQUAPENDIUM-EINTRAG“ und der Name des Tieres), das Zeichen leuchtet kurz auf, dazu ein leises Rascheln und zwei
  zarte Töne. Kommen mehrere Einträge zusammen, erscheinen sie nacheinander. Das bleibt über alle Leben erhalten. Blättern mit
  ← → (oder A/D, Mausrad, Wischen oder den Pfeilknöpfen), **I** oder „Inhalt“ springt zum Verzeichnis, Esc zurück.
  Die Bilder sind vorerst **Platzhalter** (das Tier aus dem Spiel, groß gemalt); eigene Bilder kommen als `pteraspis.png`
  usw. nach `src/assets/aquapendium/` (siehe dort die README) und werden automatisch eingebunden. Größen und Zeiten der
  Urtiere sind grobe Näherungen.
- **Wachsen von Generation zu Generation:** Im Leben wächst dein Tier nur heran (und altert); die **Art** verändert sich
  erst beim **Generationswechsel** – dann aber deutlich, und die Merkmale bauen über viele Generationen aufeinander auf. Was
  sich ändert, bestimmen deine Spielweise (die **Evolutionsrichtungen**, siehe unten) und drei Anpassungen, die unabhängig
  davon geschehen: **Körpergröße** (Lebensraum), **Körperrobustheit** (überstandene Angriffe) und **Ernährung** (gefressene
  Energie).
- **Kompromisse:** Alles hat seinen Preis. Ein **starkes Gebiss** macht **langsamer** und **schneller müde**; ein harter
  Schädel ebenso. Masse und Schuppenpanzer kosten **Tempo** und machen **hungriger**. Schlanke Verfolger sind schnell und
  halten länger durch, halten aber weniger aus und stoßen schwächer. Das steht (verdeckt) hinter dem Aussehen – die Tafel
  zeigt es als **Tempo**, **Wendigkeit**, **Ausdauer** und **Nahrungsbedarf**.
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
  Meeresgrund (bzw. am Boden) und dösen. Kleine Fische fliehen früh – nicht ins Gras (dort würden sie
  nur stillhalten und sich fressen lassen), sondern **nach oben ins freie, mittlere Wasser**, wo nichts im Weg ist, und
  dann **auf eine sichere Entfernung**. Nur Bodentiere wie Trilobiten verkriechen sich im Dickicht.
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
  fressen mit, sobald sie drankommen: Wer zu lange wartet, geht leer aus. Auch **große Tiere töten nicht nur**, sondern
  **fressen ihre Beute**: Ein Räuber, der etwas erlegt hat, schwimmt zum Fleisch, senkt den Kopf und frisst Bissen für Bissen –
  mit sichtbarem Nicken, Kauen und einem Ruck bei jedem Happen (bis er satt ist oder etwas ihn stört).
- **Herrscher des Devons:** Im Devon wartet der Endgegner – *Dunkleosteus*, mit Lebensbalken unten im Bild; einmal
  aufgetaucht, folgt er dir von Ort zu Ort. Solange die Welt im Ordovizium steht, ist er nicht zu erreichen (wie er in der
  durchgehenden Weltzeit auftaucht, ist noch offen).
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
- **Vier Evolutionsrichtungen – deine Spielweise entscheidet:** Beim Generationswechsel wählst du nichts; die Nachkommen
  entwickeln sich in die Richtungen, die zu deinem Leben passten (meist eine Mischung, oft mit einer deutlichen):
  - **Stoßfisch** – wendiger (große Seitenflossen, kürzerer Körper) und eine ausgeprägte **Kopfplatte** (ein Knochenschild
    über Stirn und Schnauze), kräftiger Stoß; dafür etwas langsamer und schneller müde, das Gebiss bleibt, wie es ist.
  - **Beißfisch** – mehr Kraft und ein **starkes Gebiss**: tieferer Kiefer, mehr und längere Zähne, Reißzähne, ein Kaumuskel
    an der Wange; dafür langsamer und schneller müde.
  - **Verfolgungsfisch** – schneller und ausdauernder: **länglicher**, schlanker Körper, große Schwanzflosse, spitze Schnauze;
    dafür weniger Lebenskraft, ein schwacher Stoß und schwerfälligeres Wenden.
  - **Schwarmfisch** (erst, sobald deine Gruppe auf deinen Ruf kommt) – silbrig, schlanker, mit hellem und
    dunklem Band an der Flanke: Deine Gruppe wird **stärker** (ihr Biss bis zu drei Viertel von deinem), **größer** (mehr kommen
    auf deinen Ruf) und wächst schneller durch geteilte Beute; dafür hast du selbst weniger Lebenskraft – allein bist du
    verletzlicher, und die Beute wird geteilt.
  **Wie stark** sich eine Richtung ausprägt, bestimmt die Spielweise des Lebens (beim Generationswechsel unter „Deine
  Spielweise“ in ein bis drei Punkten): erfolgreiche **Stöße** und mit dem Stoß erlegte Gegner für den Stoßfisch,
  erfolgreiche **Bisse** und erlegte Beute für den Beißfisch, **eingeholte Flüchtende**, Jagden und zurückgelegte Strecke mit
  Tempo für den Verfolgungsfisch, **gemeinsam erlegte und geteilte Beute** für den Schwarmfisch.
  Erfolge gegen **deutlich stärkere Gegner** zählen ein Vielfaches, kleine Beute kaum. Die Richtungen bauen über die
  Generationen aufeinander auf; wer anders lebt, bekommt Mischformen. Keine ist überall die beste.
- **Drei Anpassungen, unabhängig von der Platte:**
  - **Körpergröße** aus dem **Lebensraum**: Es zählt, wo du im Leben am **aktivsten** warst (schwimmen, fressen, kämpfen –
    bloßes Treiben kaum). Flache, bewachsene Orte machen kleiner, trübe etwas größer, die Tiefe und erst recht der Abgrund
    deutlich größer (in tiefen Orten zählt nur, wer auch hinabschwimmt). Größere Fische sind massiger, brauchen mehr Nahrung,
    werden langsamer und schwerfälliger – und fallen früher auf, kleine Beute entkommt ihnen leichter.
  - **Körperrobustheit** aus **überstandenen Angriffen**: Jeder Treffer, den du überlebst, zählt – schwere ein Vielfaches.
    Die Nachkommen bekommen deutlichere, glänzende **Schuppen**, später einen **Schuppenpanzer** mit Knochenschilden auf dem
    Rücken und an der Seite (unabhängig von der Kopfplatte): weniger Schaden, mehr Lebenskraft, aber langsamer und hungriger.
  - **Ernährung** aus der **gefressenen Energie**: Der Anteil von Fleisch und Pflanzen verschiebt die Kost Schritt für
    Schritt (höchstens ein gutes Stück je Generation, nie ganz bis zum Äußersten). Wer zu 90 % Fleisch frisst, dem liefern
    Pflanzen schon in der nächsten Generation spürbar, in der übernächsten **deutlich weniger Energie** – und umgekehrt.
  Beim Generationswechsel siehst du dein Tier und seinen Nachkommen nebeneinander.
- **Die Steintafel (Taste C):** Eine **gebrochene, vermooste Steinplatte** mit Rissen und eingemeißelten
  Runen – anfangs ist alles überwuchert; die Zeilen sitzen auf leicht versetzten Platten.
  Jede **Muschel**, die du findest, legt eine Zeile frei: zuerst der **Nahrungsbedarf** (die erste
  Muschel liegt im ersten Gewässer direkt vor dir), später Gewicht, Körpertemperatur, **Färbung** (aus den Höhlen), Gebiss,
  Länge, Lebenskraft, Schädel bzw. Panzerkopf, **Schuppen** (Robustheit), Kost (mit dem, was die andere Kost noch nährt),
  Tarnung, Wuchs, **Tempo**, **Wendigkeit**, **Ausdauer**, Bodenkontakt, Zusammenhalt und Nerven.
  Alles, was man trainieren kann, wird in **ein bis drei Fischen** gewertet: einer für „ein
  bisschen“, zwei für mehr, drei für stark. Die Muscheln sind schlichte Spiralmuscheln in Creme und Rosa. Sie sind selten – sie liegen in Höhlen, Felsspalten
  und weit draußen am Grund, in der Tiefe am weitesten weg. Rechts neben der Tafel siehst du dein
  Tier, die **Generation**, das Geschlecht, den **Lebensabschnitt** (als Jungtier: wann es ausgewachsen ist), was zum
  **Laichen** noch fehlt bzw. ob ein befruchtetes Gelege wartet, und deine Muscheln. Den Hunger sieht man sonst nirgends im Spiel; die **Zeit** läuft oben im Bild. Das meiste
  andere an deinem Tier bleibt verborgen – es zeigt sich nur in dem, was es tut.
- **Verhalten formt deine Art:** Beißen, Stoßen und Verfolgen bestimmen die Richtung deiner Nachkommen; Bodenkontakt (sich am
  Grund abstützen und dort entlanglaufen) gibt fleischige Stützflossen, später kräftigere Beine; die Richtung, in die du
  am meisten schwimmst, formt die Flossen. Das Verhalten schaltet keine Art frei – es verschiebt, wie deine Nachkommen
  aussehen und was sie können.
- **Ereignisse** je Zeitalter: große Räuber ziehen durch, Stürme wühlen das Wasser auf, Futter
  sprießt – immer wieder, nach der Weltzeit für alle zugleich.
- **Von Generation zu Generation** setzt sich fort, was sich bewährt hat (Tarnung, Bodenkontakt …). Das **Aussehen** der
  Art verwandelt sich **nur beim Generationswechsel** – im Leben wächst das Tier nur heran.
- **Blutig:** Bisse und Stöße bluten – als Wolke im Wasser dort, wo gekämpft wurde, und als Fleck
  am Boden.
- **Keine Spoiler:** Zeitalter, die noch niemand erreicht hat, bleiben im Stammbaum und in der
  Zeitleiste Fragezeichen.

Kaum Zahlen und Balken – im Spiel ist fast nichts eingeblendet: oben in der Mitte die **Weltzeit** (Name des
Zeitalters, „vor 469.800.000 Jahren“ – die Jahre zählen für alle gleich rückwärts) und darunter die **Lebenslinie** deines
Tiers, unten (nur wenn er auftaucht) der Lebensbalken des Herrschers. Oben links erscheinen kurze Meldungen zum Leben
(neuer Lebensabschnitt, Gelege abgelegt bzw. befruchtet, geschlüpft). **Der Name des Ortes** erscheint **nur beim Betreten**, groß und ohne Beschreibung, und blendet
wieder aus; **Hinweise, Erzählzeilen** („eine dunkle Gestalt ist zu hören …“) **und Namensschilder großer Tiere** gibt es
nicht – was man über ein Tier wissen will, steht im Aquapendium. Nur wenn die Kraft schwindet, erscheint kurz ein dünner Balken am Fisch. Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand,
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

Einige Merkmale wachsen im Hintergrund langsam mit (mit abnehmendem Ertrag), Körper und Kampfwerte entstehen erst beim
Generationswechsel – als Wert sieht man nichts davon:

| Wer so lebt … | … dessen Nachkommen bekommen |
| --- | --- |
| lebt als **Stoßfisch** | eine **Kopfplatte** (Knochenschild über Stirn und Schnauze), einen härteren Schädel, große Seitenflossen, einen kurzen, stumpfen Kopf, stahlgraue Farben: kräftiger Stoß, wendiger, weniger eigener Schaden – etwas langsamer, schneller müde |
| … und stößt dabei oft und erfolgreich (Taste R), erlegt damit Tiere | eine deutlichere Ausprägung – Erfolge gegen Stärkere zählen ein Vielfaches |
| lebt als **Beißfisch** | einen tieferen Kiefer, mehr und längere Zähne, **Reißzähne**, einen Kaumuskel, bronzene Farben: viel mehr Beißkraft – langsamer, schneller müde (wer Pflanzen frisst, hat stumpfe Zähne und keine Reißzähne) |
| … und beißt oft und erfolgreich, erlegt Beute | eine deutlichere Ausprägung |
| lebt als **Verfolgungsfisch** | einen längeren, schlankeren, flinken Körper, eine große Schwanzflosse, eine spitze Schnauze, blaugraue Farben: schneller, ausdauernder – weniger Lebenskraft, schwächerer Stoß, wendet träger |
| … und holt Flüchtende ein, jagt, schwimmt viel und schnell (gegen Strömungen doppelt) | eine deutlichere Ausprägung – je länger und schneller die Beute floh, desto mehr |
| ist am **aktivsten** in flachen, bewachsenen Orten · in trüben · in der Tiefe · im Abgrund | kleiner · etwas größer · deutlich größer · noch größer – mit der Größe massiger, hungriger, langsamer und schwerfälliger |
| übersteht viele Treffer (schwere zählen mehr) | robustere **Schuppen**, später einen **Schuppenpanzer** mit Knochenschilden: weniger Schaden, mehr Lebenskraft – langsamer, hungriger |
| frisst (nach Energie) überwiegend Fleisch bzw. Pflanzen | die Kost verschiebt sich Schritt für Schritt: Fleischfresser holen aus Fleisch mehr und aus Pflanzen weniger heraus (bei 90 % Fleisch nach zwei Generationen nur noch gut die Hälfte), Pflanzenfresser umgekehrt |
| frisst Pflanzen, weicht aus, versteckt sich, entkommt Jägern | Tarnmuster, einen schlankeren Körper, mehr Tempo, größere Augen |
| liegt oft still am Boden | sandig braun-graue Farben |
| stützt sich oft am Grund ab und läuft dort entlang | fleischige **Stützflossen** (schneller am Grund, hält sich in Strömungen) |
| lebt als **Schwarmfisch** (erst, wenn deine Gruppe auf deinen Ruf kommt) | silbrig, schlank, mit Band an der Flanke: mehr **Zusammenhalt** – die Gruppe kommt größer, beißt kräftiger und wächst schneller – weniger eigene Lebenskraft |
| … und jagt oft mit der Gruppe und lässt sie mitfressen | eine deutlichere Ausprägung – gegen Starke mehr |
| bleibt nah bei Jägern, ohne aufzufallen | stärkere Nerven: Jäger bemerken einen später – nirgends angezeigt |
| frisst giftige Pflanzen | wird giftfester – nirgends angezeigt |
| hält sich oft oben im Licht bzw. unten in der Tiefe | hellere bzw. dunklere Färbung |
| schwimmt am häufigsten **nach oben** | eine ausgeprägtere **Rückenflosse** oben am Körper, schnelleres Steigen |
| schwimmt am häufigsten **nach unten** | etwas größere **Flossen unten am Körper**, schnelleres Tauchen |
| schwimmt oft und schnell **nach vorn** | eine stärkere **Schwanz-/Hinterflosse**, höheres Reisetempo |
| **wechselt oft die Richtung** | größere **Seitenflossen**: das Tier wendet schneller (gebremst von Länge und Masse) |
| versteckt sich zwischen Pflanzen | grünere Farben, größere (wendigere) Flossen, eine flachere Rückenflosse |

Wer viel tötet, bekommt einen Ruf: Beutetiere fliehen früher, Räuber meiden einen, Verteidiger
werden schneller wütend. Wer mit Artgenossen und Verbündeten unterwegs ist, wirkt gefährlicher.

Jeder Artgenosse hat eine verborgene **Treue**. Sie steigt, wenn er von deiner Beute mitfrisst oder
mit dir grast, und sinkt, wenn er hungrig zusehen muss, wie du alles allein frisst (oder wenn du
ihn beißt). Treue Artgenossen jagen mit, verteidigen dich und verstecken sich mit dir; untreue
bleiben auf Abstand und gehen schließlich. Wer aus deiner Gruppe verärgert abzieht, verlässt sie für immer.

Beim Generationswechsel geht von dem, was im Leben im Hintergrund dazugekommen ist (Tarnung, Bodenkontakt, Flossen …),
gut die Hälfte auf die Nachkommen über (`INHERIT.carry`). Jede Evolutionsrichtung wächst um `INHERIT.gain` × ihre Passung
zur Spielweise (0 bis 1). Größe, Robustheit und Kost passen sich an wie oben. Vom Partner kommen 15 % seines Aussehens
(Farben, Länge, Flossen – keine Kampfwerte). Die Artgenossen tragen dasselbe weiter, jeder mit eigener Abweichung.
Im Stammbaum werden Linien nach Körperform, vorherrschender Platte und Kost zusammengefasst –
daher auch die lateinisch klingenden Namen (z. B. *Odontichthys carnivorus* für einen fleischfressenden Beißfisch).
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
| R | Stoß: Anlauf nehmen, mit dem Schwung gleiten (betäubt kleine und mittelgroße Tiere kurz) |
| F (auch Eingabe) | ansprechen: einen Artgenossen, über dem das Zeichen **F** erscheint; im Gespräch: weiter (bei einer Frage: ← → wählen, F bestätigt) |
| S | deine Gruppe rufen bzw. fortschicken (nach der gemeinsamen Jagd) |
| L (halten) | laichen – ausgewachsen, satt genug, im Laichfluss: Weibchen dicht am Grund, Männchen an einem frischen Gelege |
| C | Steintafel: Werte, Hunger, Lebensabschnitt, Laichen, Muscheln |
| Esc / P | Rast (Pause) mit Steuerung – und „Leben weitergeben“, sobald ein befruchtetes Gelege wartet |
| M | Ton an/aus |

Auf Handy und Tablet erscheinen im Level Bildschirm-Knöpfe (am besten im Querformat spielen).

## Mehrspieler-Prototyp

EVO wird ein persistentes Online-Spiel mit einem **autoritativen Server** ([Colyseus](https://colyseus.io) 0.18, TypeScript).
Der erste Meilenstein steht: **Mehrere Spieler betreten denselben Ort und sehen einander schwimmen.**

- **Ein Raum je Ort:** Wer einen Ort betritt, kommt in dessen Raum auf dem Server (Zeitalter und Ort, z. B. `0/lagune`);
  wer ihn verlässt, verschwindet dort und erscheint im nächsten. Die Orte sehen für alle gleich aus (feste Weltsaat).
- **Die anderen Spieler** schwimmen als ihr eigener Fisch – mit ihrem Aussehen, ihrer Größe (Jungtier oder ausgewachsen),
  Bissen und Stößen – und ihrem **Namen** darüber. Ihre Lage kommt 15 bis 20 Mal je Sekunde an und wird geglättet.
- **Der Server prüft**, was die Clients melden: niemand schwimmt schneller, als ein Fisch kann (sonst setzt er ihn
  zurück), und niemand verlässt den Ort durch die Wand. Die Grenzen kennt er aus demselben Weltgenerator.
- **Die Weltzeit** kommt vom Server – für alle gleich.
- **Verbindung weg?** Der Platz bleibt 20 Sekunden frei (der Fisch wartet halb durchsichtig), der Client verbindet sich
  von selbst neu. Ist gar kein Server erreichbar, geht es still allein weiter.
- **Gemeinsame Tiere:** Alle am Ort sehen **dieselben Tiere** und dasselbe Fleisch. Gerechnet werden sie im Spiel eines
  Spielers, dem **Ortswächter** (wer zuerst da war); der Server verteilt sie an alle anderen. Beißt oder stößt ein anderer
  Spieler ein Tier, geht der Treffer an den Ortswächter; Tiere jagen, meiden und beißen **jeden** Spieler (den jeweils
  nächsten); wer vom Fleisch frisst, nimmt es allen weg. Geht der Ortswächter (oder ist sein Fenster im Hintergrund bzw.
  er in der Rast), übernimmt ein anderer Spieler die Tiere, so wie sie gerade sind. Neue Tiere (Durchzügler, Rückkehrer,
  Schlüpflinge) kommen nur beim Ortswächter dazu. Kein Tier verschwindet vor den Augen eines Spielers.
- **Noch für jeden einzeln:** Pflanzen und Laich, deine Artgenossen (Gruppe, Auftrags-Figuren, Laich-Partner) und die Tiere
  eines Auftrags – die sieht nur, wem sie gehören.

Oben rechts steht klein, wie viele andere Spieler an deinem Ort sind.

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
src/net/WorldSync.ts     gemeinsame Tiere: Ortswächter meldet, Gäste zeigen Stellvertreter, Wechsel des Ortswächters
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
| `npm test` | Tests der Spiellogik ohne Browser (Vitest, `tests/`): Weltgenerator, Lebenszyklus, Vererbung |

**Entwickler-Modus:** `?debug` an die Adresse hängen (z. B. `http://localhost:8080/?debug`) – im Level
werden die verborgenen Werte, Artgenossen, Verbündete und Durchzügler eingeblendet. Mit
`?debug&gallery` gibt es eine Übersicht über viele Ausprägungen der Spielfigur und alle Tierarten
(Leertaste blättert). `?touch` zeigt die Bildschirm-Knöpfe auch am PC. Mit `?debug` lässt **T** dein Tier eine Minute
altern – so kommt man schnell zum Laichen (ausgewachsen nach acht Minuten) und zum Generationswechsel.

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
│   ├── epochs.ts        Zeitalter: Zeitraum, Spieldauer, Tiere, Ereignisse
│   ├── quests.ts        die Aufträge der Artgenossen: Texte, Schritte, das Tier, das den Gefährten frisst; die gemeinsame Jagd (JAGD) und der Schwarm (SWARM) mit allen Zielzahlen
│   ├── world.ts         Orte je Zeitalter (Bewuchs, Tiefe, Muscheln; Lage kommt aus paleo.json)
│   ├── biota.ts         was am Grund wächst: Gewichte je Ortsart, Zeitalter und Untergrund
│   ├── paleo.json/.ts   Urzeit-Karten: Umrisse der Kontinente, Meere und die Lage der zehn Orte je Zeitalter
│   ├── life.ts          Welt und Leben: Weltsaat und Weltzeit (WORLD), Wachsen und Altern (LIFE), Laichen (SPAWN), Vererbung (INHERIT)
│   └── tablet.ts        die Zeilen der Steintafel und wie sie berechnet werden
├── sim/life.ts          der Lebenszyklus als reine Rechnung (Wachstum, Lebensabschnitte, Laichbereitschaft, Weltzeit) – auch für den Server
├── state/GameState.ts   Leben (Lauf), Gelege, Vererbung, verborgene Merkmale, Ruf, Stammbaum, Speichern (ohne Phaser)
├── server/              der Spielserver (Colyseus): index.ts (Räume), ZoneRoom.ts (ein Ort mit seinen Spielern)
├── net/                 Mehrspieler im Spiel: protocol.ts, schema.ts (gemeinsam mit dem Server), NetClient.ts, NetSync.ts, RemoteFish.ts
├── level/
│   ├── LevelGen.ts      erzeugt jeden Ort – für alle Spieler und in jedem Leben gleich (feste Weltsaat), ohne Phaser
│   └── terrain.ts       der Meeresboden: glatte Höhenlinie, Zonen aus Sand/Fels/Schlamm, Felsbrocken, Bögen, Hitboxen
├── art/                 alle Grafiken, per Canvas gemalt (Rauschtexturen, Schattierung, Randlicht)
│   ├── paint.ts         Malwerkzeuge: Haut, Augen, Zähne, Rauschen
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen, stufenlos aus den Merkmalen
│   ├── speciesArt.ts    alle anderen Tiere
│   ├── worldArt.ts      Hintergründe, Pflanzen, Dickicht, Effekte
│   ├── lifeArt.ts       Schwämme, Korallen, Moostierchen, Armfüßer, Seelilien, Cystoideen, Algen sowie Plankton und Graptolithen
│   ├── terrainArt.ts    der Meeresboden in gemalten Stücken (Sand, Fels, Schlamm) und alle Felsen
│   ├── tabletArt.ts     Steinplatte, Moos, Fische für die Wertung, Muschel
│   ├── mapArt.ts        Kartenmaße, Gebiete um die Orte, Zeichen der Ortsarten
│   ├── paleoArt.ts      die Urzeit-Erde: Land, Küstenschelf, Nebel und Aufdecken
│   ├── paleoGeo.ts      Küstenlinien, Land-Wasser-Raster und Wegsuche (A*) um das Land herum
│   └── uiArt.ts         Symbole und Titelbild
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── objects/             Spielfigur, Tiere (KI, Bindung, Durchzügler), Artgenossen, Nahrung, Steuerung, Drift.ts (Plankton, Schnee, Graptolithen), Quest.ts (Gespräche und Szenen der Aufträge), HuntQuest.ts (die gemeinsame Jagd), Swarm.ts (deine Gruppe rufen, begleiten, fortschicken), Spawning.ts (Laichen: Gelege, Partner, Schlüpfen)
├── util/                Mathe, Zeichnen, Fehler abfangen (guard.ts), ein Ereignis-Bus ohne Phaser (emitter.ts)
├── ui/                  Knöpfe, Texte, Menü-Steuerung (ui.ts), die Steintafel (tablet.ts, tabletScreen.ts)
└── scenes/              Titel, Intro, Level, Karte, HUD, Generationswechsel, Stammbaum, Demo-Ende
tests/                   Vitest: Weltgenerator (gleiche Saat = gleicher Ort), Lebenszyklus, Vererbung, Ereignis-Bus, Spielserver mit zwei Clients
art/                     Ist-Stand aller Grafiken als PNG (alt/), Biss-Vorlagen als SVG (vorlagen/), Ablage für eigene Bilder (neu/) – siehe art/README.md
tools/                   bite_sheets.py (Biss-Vorlagen der Linien), fish_sheet.py (Bewegungs-Sprite-Sheet eines Fisches)
```

### Später klären (vorläufig so entschieden)

Damit schnell gespielt und getestet werden kann, ist erst einmal Folgendes festgelegt – bitte später noch einmal ansehen:

- [ ] **Zeitalter:** Die Welt bleibt im Ordovizium; die Jahreszahl läuft in etwa 30 Tagen bis zu dessen Ende und bleibt dann
      stehen. Später: Der Server führt alle gemeinsam nach fester Zeit ins nächste Zeitalter (als Weltereignis).
- [ ] **Endgegner und Demo-Ende** sind ausgesetzt (gehören zum alten Zeitalter-Ablauf).
- [ ] **Altern nur beim Spielen:** Wer offline ist, altert nicht.
- [ ] **Eigene Gelege sind unangreifbar** – weder Räuber noch andere Spieler fressen sie.
- [ ] **Partner beim Laichen ist immer die KI** (garantiert). Später: echte Spieler mit Vorrang – dafür muss das Laichen
      auf den Server.
- [ ] **Geschlecht** jeder neuen Generation: zufällig.
- [ ] **Aussterben:** ohne befruchtetes Gelege Neustart als Urfisch (wie bisher).
- [ ] **Rast im Mehrspieler:** pausiert nur bei dir; die anderen sehen deinen Fisch so lange still stehen.
- [ ] **Tiere rechnet vorerst der Ortswächter** (das Spiel eines Spielers), nicht der Server. Später: die Tier-KI auf den
      Server (dann kann auch niemand schummeln, und die Welt lebt ohne Spieler weiter).
- [ ] **Im Mehrspieler noch für jeden einzeln:** Pflanzen und Laich, deine Artgenossen (Gruppe, Auftrags-Figuren,
      Laich-Partner) und die Tiere eines Auftrags. Auf der Karte (zwischen zwei Orten) ist man für die anderen nicht zu sehen.
- [ ] **Lebenstempo** (bestätigt): ausgewachsen nach 8 Minuten, Lebensende nach 30 Minuten.

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
