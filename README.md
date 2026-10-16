# EVO – Auf der Suche nach Eden

Ein Evolutions-Abenteuer im Browser, gebaut mit [Phaser 4](https://phaser.io), TypeScript und [Vite](https://vite.dev).

Du beginnst als kleiner Urfisch im Urozean. Besiege Gegner, friss ihr Fleisch, sammle **EVO-Punkte**
und entwickle deinen Körper weiter – vom **Fisch** über **Amphibie** und **Reptil** bis zum
**Säugetier** – und finde den Weg nach **Eden**.

> Fan-Projekt, inspiriert von *E.V.O.: Search for Eden* (SNES, 1992). Alle Grafiken, Level und Töne
> werden im Browser erzeugt – es werden keine Original-Inhalte verwendet.

**Online spielen:** https://lksnio.github.io/EVO/

## So spielt sich EVO

1. **Karte wählen** – fünf Zeitalter: Urozean, Urzeitliche Sümpfe, Zeitalter der Reptilien, Eiszeit,
   Weg nach Eden. Jedes Zeitalter braucht eine bestimmte Entwicklungsstufe.
2. **Weltkarte** – laufe zwischen den Orten hin und her. Geschaffte Orte schalten ihre Nachbarn frei,
   am Ende wartet ein Endgegner.
3. **Level** – schwimmen (als Fisch) oder laufen und springen (an Land), beißen, Hornstöße,
   Fleisch fressen (EVO-Punkte und Lebenspunkte), Kristalle sammeln, zum Tor am Ende.
4. **Evolution** – jederzeit auf der Karte (Taste **E**) oder im Pausenmenü. Die Vorschau zeigt sofort,
   wie dein Tier aussieht und wie sich die Werte ändern:

   | Körperteil | Wirkung | Beispiele |
   | --- | --- | --- |
   | Klasse | neue Lebensräume | Fisch → Amphibie → Reptil → Säugetier |
   | Kiefer | Bissstärke | Spitze Zähne, Knackkiefer, Reißzähne, Säbelzähne |
   | Horn | Hornstoß | Stirnbeule, Nasenhorn, Doppelhorn mit Nackenschild, Kronenhorn |
   | Körper | Lebenspunkte, Abwehr | Schlank, Kräftig, Massig, Riesig, Koloss |
   | Haut | Abwehr | Schuppen, Knochenplatten, Stachelpanzer, Dichter Pelz |
   | Flosse / Schwanz | Tempo | Sichelflosse, Ruderschwanz, Keulenschwanz, Buschschwanz |
   | Beine | Tempo, Sprungkraft | Laufbeine, Sprungbeine, Krallenfüße, Lange Läufe |
   | Farbe | Aussehen | acht Farben, z. B. Korallenrot oder Gold |

   Einmal gekaufte Teile kannst du später kostenlos wieder auswählen.
   Eine neue Klasse wird frei, wenn du den Endgegner des vorherigen Zeitalters besiegt hast.

Der Spielstand wird automatisch im Browser gespeichert.

## Steuerung

| Taste | Aktion |
| --- | --- |
| ← → / A D | laufen bzw. schwimmen |
| ↑ ↓ / W S | im Wasser hoch und runter |
| Leertaste / ↑ | springen (an Land) |
| J oder X | beißen |
| K oder C | Hornstoß (braucht ein Horn) |
| E | Evolution (auf der Karte) |
| Esc / P | Pause |
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

**Entwickler-Modus:** `?debug` an die Adresse hängen (z. B. `http://localhost:8080/?debug`) –
5000 EVO-Punkte, alle Karten und Orte offen. Mit `?debug&gallery` gibt es eine Übersicht über
alle Körperteil-Kombinationen und Gegner (Leertaste blättert). `?touch` zeigt die
Bildschirm-Knöpfe auch am PC.

### Projektstruktur

```
src/
├── main.ts              Start: Schrift laden, Spielstand laden, Phaser starten
├── config.ts            Bildgröße, Kachelgröße, Schwerkraft, Ebenen
├── data/                Spieldaten – hier lässt sich das Spiel am leichtesten anpassen
│   ├── classes.ts       Entwicklungsstufen (Fisch … Säugetier) mit Grundwerten
│   ├── parts.ts         Körperteile, Preise und Wirkung
│   ├── enemies.ts       alle Gegner und Endgegner
│   └── eras.ts          Zeitalter, Orte auf der Weltkarte, Wege dazwischen
├── state/GameState.ts   Spielstand, EVO-Punkte, Fortschritt, Speichern
├── level/LevelGen.ts    erzeugt die Level aus einer festen Saat (jeder Ort sieht immer gleich aus)
├── art/                 alle Grafiken, per Canvas gezeichnet
│   ├── creatureArt.ts   die Spielfigur aus Einzelteilen (Kiefer, Horn, Beine …)
│   ├── enemyArt.ts      Gegner
│   ├── worldArt.ts      Hintergründe, Boden, Pflanzen, Weltkarten
│   └── uiArt.ts         Symbole und Titelbild
├── audio/Audio.ts       Soundeffekte und Musik (Web Audio, live erzeugt)
├── objects/             Spielfigur, Gegner, Endgegner, Steuerung
├── ui/ui.ts             Knöpfe, Texte, Menü-Steuerung, Überblendungen
└── scenes/              Titel, Intro, Kartenwahl, Weltkarte, Level, HUD, Evolution, Abspann
```

### Ideen für später

- [ ] Weitere Entwicklungswege (z. B. Vögel oder Urmenschen)
- [ ] Mehr Endgegner-Phasen und versteckte Orte
- [ ] Gamepad-Steuerung
- [ ] Eigene Musikstücke pro Ort

## Veröffentlichung

Der Workflow in `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main` und
veröffentlicht es auf GitHub Pages (Settings → Pages → Source: **GitHub Actions**).
