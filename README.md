# EVO – Die Suche nach Eden

Ein Überlebensspiel über Evolution im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript
und [Vite](https://vite.dev).

Du beginnst als kleiner, schwacher Urfisch im dunklen Urozean. Es gibt keine Punkte zu sammeln und
kein Menü, in dem du dir Körperteile aussuchst. Es geht nur ums **Überleben**: fressen, ausweichen,
kämpfen, sich verstecken. **Was du tust, formt, was aus dir wird** – Stück für Stück, über
Generationen. Du siehst es nur an deinem Tier und daran, wie die anderen Tiere auf dich reagieren.

> Fan-Projekt, inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne
> werden im Browser erzeugt – es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## So spielt sich EVO

1. **Zeitalter** – Steintafeln für die Epochen der Erdgeschichte. Was du noch nicht erreicht hast,
   bleibt ein **Fragezeichen**.
2. **Weltkarte** – unbekannte Orte liegen im Nebel und zeigen nur ein **?**. Wer einen Ort überlebt,
   entdeckt die Wege zu seinen Nachbarn. Irgendwo herrscht ein Spitzenräuber über sein Revier.
3. **Level** – friss Pflanzen oder Fleisch, um nicht zu verhungern (satt frisst du nichts mehr),
   weiche Jägern aus, versteck dich im Dickicht, sprinte – oder stell dich zum Kampf.
   Am Ende des Weges wartet ein Lichtspalt.
4. **Generationen** – nach jedem überlebten Ort siehst du dein Tier „einst“ und „heute“.
   Stirbst du, setzt ein Nachkomme die Reise fort – was du auf dieser Reise geworden bist, ist dann
   allerdings verloren. Am Ende eines Zeitalters nehmen deine Nachfahren eine neue Form an:
   Fisch → Lurch → Echse → Säuger.

Es gibt keine Zahlen und keine Balken: Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand,
am Herzschlag und am Tier selbst (eingefallene Flanken, Narben, Blick …).

Der Spielstand wird automatisch im Browser gespeichert.

<details>
<summary>Spoiler: Wie die verborgene Anpassung funktioniert</summary>

Im Hintergrund wachsen langsam (mit abnehmendem Ertrag) einige Merkmale, die man nie als Wert sieht:

| Wer so lebt … | … dessen Nachkommen bekommen |
| --- | --- |
| frisst Pflanzen, weicht aus, versteckt sich, entkommt Jägern | Tarnmuster, schlankeren und kleineren Körper, mehr Tempo, größere Augen |
| rammt andere Tiere mit Anlauf | gewölbte Stirn, Knochenplatten, Höcker, Hörner – und tut sich beim Rammen weniger weh |
| beißt und frisst Fleisch | längere Schnauze, tieferen Kiefer, mehr und größere Zähne |
| frisst viel | wächst |

Wer viel tötet, bekommt einen Ruf: Beutetiere fliehen früher, Räuber meiden einen, Verteidiger
werden schneller wütend. Friedliche Zeit lässt die Angriffslust wieder abklingen. Pflanzen- bzw.
Fleischfresser verdauen ihre gewohnte Kost besser. Schwere Treffer, die man überlebt, hinterlassen Narben.

Die Tiere der Welt haben Rollen (Beute, Räuber, Verteidiger, Gefahr, Spitzenräuber), Hunger,
Sinne und Angst: Sie fressen selbst, jagen einander und bemerken dich je nach Tempo, Blickrichtung,
Dickicht und Dunkelheit.
</details>

## Steuerung

| Taste | Aktion |
| --- | --- |
| ← → / A D | laufen bzw. schwimmen |
| ↑ ↓ / W S | im Wasser auf- und abtauchen |
| Leertaste / ↑ | springen (an Land) |
| J, X oder Y | beißen und fressen |
| Shift, K oder C | sprinten (kostet Kraft) |
| Esc / P | Rast (Pause) |
| M | Ton an/aus |

Auf der Karte: Pfeiltasten wandern, Enter bricht auf, **T** zeigt dein Tier und deine Ahnen.
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

**Entwickler-Modus:** `?debug` an die Adresse hängen (z. B. `http://localhost:8080/?debug`) – alle
Zeitalter und Orte offen, im Level werden die verborgenen Werte eingeblendet. Mit `?debug&gallery`
gibt es eine Übersicht über viele Ausprägungen der Spielfigur und alle Tierarten (Leertaste blättert).
`?touch` zeigt die Bildschirm-Knöpfe auch am PC.

### Projektstruktur

```
src/
├── main.ts              Start: Schriften laden, Spielstand laden, Phaser starten
├── config.ts            Bildgröße, Kachelgröße, Schwerkraft, Ebenen, Farben der Oberfläche
├── data/                Spieldaten – hier lässt sich das Spiel am leichtesten anpassen
│   ├── classes.ts       Körperformen (Fisch … Säuger) mit Grundwerten
│   ├── species.ts       alle Tierarten mit Rolle, Kost, Sinnen, Stärke
│   └── eras.ts          Zeitalter, Orte auf der Weltkarte, Tiere je Ort, Wege dazwischen
├── state/GameState.ts   verborgene Merkmale, Ruf, Fortschritt, Ahnenreihe, Speichern
├── level/LevelGen.ts    erzeugt die Level aus einer festen Saat (jeder Ort sieht immer gleich aus)
├── art/                 alle Grafiken, per Canvas gemalt (Rauschtexturen, Schattierung, Randlicht)
│   ├── paint.ts         Malwerkzeuge: Haut, Augen, Zähne, Rauschen
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen, stufenlos aus den Merkmalen
│   ├── speciesArt.ts    alle anderen Tiere
│   ├── worldArt.ts      Hintergründe, Boden, Pflanzen, Dickicht, Weltkarten
│   └── uiArt.ts         Symbole, Titelbild, Steintafeln
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── objects/             Spielfigur, Tiere (KI), Nahrung, Steuerung
├── ui/ui.ts             Knöpfe, Texte, Menü-Steuerung, Überblendungen
└── scenes/              Titel, Intro, Zeitalter, Weltkarte, Level, HUD, Generationen, Abspann
```

### Ideen für später

- [ ] Weitere Entwicklungswege (z. B. Vögel oder Urmenschen)
- [ ] Fortpflanzung und Revierverhalten der Tiere
- [ ] Gamepad-Steuerung
- [ ] Echte Zeichnungen/Sprites (z. B. von OpenGameArt oder Kenney) statt gemalter Canvas-Grafik

## Veröffentlichung

Der Workflow in `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main` und
veröffentlicht es auf GitHub Pages (Settings → Pages → Source: **GitHub Actions**).
