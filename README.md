# EVO – Die Suche nach Eden

Ein Überlebensspiel über Evolution im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript
und [Vite](https://vite.dev).

Du beginnst als kleiner, schwacher Urfisch im Urozean – einer von wenigen deiner Art. Jedes
**Zeitalter** ist ein fester Zeitraum der Erdgeschichte: Oben läuft eine Uhr („vor 452.320.000 Jahren“),
und wer bis zum Ende des Zeitraums überlebt, dessen Linie zieht ins nächste Zeitalter weiter.
Es gibt keine Punkte, kein Ziel und keinen Endgegner. Es geht **nur ums Überleben – egal wie**.

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
  - **Kämpfen** – beißen und dich durchfressen. Wer in ein Tier hineinschwimmt oder -rennt, verletzt
    **beide**. Mit der Zeit wird der Kopf härter – irgendwann kannst du gezielt **rammen**.
  - **Teilen** – frisst ein anderes Tier von deiner Beute mit, während du dabei bist, fasst es
    Vertrauen. Solche Verbündeten bleiben in deiner Nähe und verteidigen dich.
  - …oder eine Mischung davon.
- **Deine Art:** Jedes Zeitalter beginnt mit einer kleinen Gruppe von Artgenossen – fast wie du,
  mit kleinen Abweichungen, Männchen (mit Kehlfleck) und Weibchen. Sie folgen dir, warnen mit Rufen,
  fliehen und verstecken sich mit dir – und **jagen mit**, wenn du angreifst. Die Gruppe lernt dabei:
  Lässt du ihnen von der Beute etwas übrig, bleiben sie bei dir und werden zu Verbündeten. Frisst du
  alles allein, wenden sie sich ab und ziehen irgendwann ohne dich weiter. Wer mit dir überlebt,
  bekommt Nachwuchs – und wie eng die Gruppe zusammenhält, erben die Nachkommen.
- **Ereignisse** je Zeitalter: große Räuber ziehen durch, Stürme trüben die Sicht, die Erde bebt,
  Futter sprießt – und am Ende der Kreidezeit fällt Feuer vom Himmel.
- **Hunger:** Fressen hält dich am Leben, aber satt frisst du nichts mehr.
- **Zwischen den Zeitaltern** siehst du dein Tier „einst“ und „heute“, dann vergehen Jahrmillionen –
  und was sich bewährt hat, setzt sich in dieser Zeit fort: je mehr Jahre, desto deutlicher.
  Manchmal nehmen deine Nachfahren dabei eine neue Form an: Fisch → Lurch → Echse → Säuger.
- **Blutig:** Bisse und Zusammenstöße bluten (im Wasser als Wolke, an Land als Fleck am Boden), und
  wer Beute reißt, hat eine Weile einen Brocken Fleisch im Maul und eine blutige Schnauze.
- **Keine Spoiler:** Zeitalter, die noch niemand erreicht hat, bleiben im Stammbaum und in der
  Zeitleiste Fragezeichen.

Es gibt keine Zahlen und keine Balken: Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand,
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
| versteckt sich oft im Dickicht | grünliche Farben |
| liegt oft still am Boden oder in Höhlen | sandig braun-graue Farben |
| stößt mit anderen Tieren zusammen | einen härteren Schädel – ab einem gewissen Punkt die Fähigkeit, gezielt zu **rammen** (Taste R) |
| … und teilt dabei mehr aus, als er einsteckt | einen **Stachelkopf**: Stachelkrone und Wangenstacheln, stärkerer Rammstoß |
| … und steckt dabei mehr ein, als er austeilt | einen **Panzerkopf**: Knochenhelm, mehr Lebenskraft, weniger eigener Schaden |
| beißt und frisst Fleisch | längere Schnauze, tieferen Kiefer, mehr und größere Zähne |
| frisst viel | wächst |

Wer viel tötet, bekommt einen Ruf: Beutetiere fliehen früher, Räuber meiden einen, Verteidiger
werden schneller wütend. Wer mit Artgenossen und Verbündeten unterwegs ist, wirkt gefährlicher.

Jeder Artgenosse hat eine verborgene **Treue**. Sie steigt, wenn er von deiner Beute mitfrisst oder
mit dir grast, und sinkt, wenn er hungrig zusehen muss, wie du alles allein frisst (oder wenn du
ihn beißt). Treue Artgenossen jagen mit, verteidigen dich und verstecken sich mit dir; untreue
bleiben auf Abstand und gehen schließlich. Die durchschnittliche Treue der Überlebenden bestimmt,
wie zutraulich die Gruppe im nächsten Zeitalter beginnt.

Zwischen den Zeitaltern wird verstärkt, was im letzten Zeitalter dazugekommen ist – umso stärker,
je mehr Jahrmillionen vergehen (Faktor etwa 0,6 bis 1,4).
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
| Shift, K oder C | sprinten (kostet Kraft) |
| R oder V | rammen (erst mit hartem Schädel) |
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
