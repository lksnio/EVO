# Platformer

Ein 2D-Plattformer, gebaut mit [Phaser 4](https://phaser.io), TypeScript und [Vite](https://vite.dev).

## Loslegen

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
npm run dev      # Dev-Server mit Live-Reload auf http://localhost:8080
```

| Befehl              | Was es macht                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Startet den Entwicklungsserver                 |
| `npm run build`     | Typprüfung + Produktions-Build nach `dist/`    |
| `npm run preview`   | Zeigt den fertigen Build lokal an              |
| `npm run typecheck` | Nur TypeScript prüfen                          |

## Steuerung

- **← / →** oder **A / D** – laufen
- **Leertaste**, **↑** oder **W** – springen (kurz drücken = kleiner Sprung)

## Projektstruktur

```
├── index.html            Einstiegsseite
├── public/assets/        Grafiken, Sounds, Tilemaps (werden 1:1 ausgeliefert)
├── src/
│   ├── main.ts           Phaser-Konfiguration (Auflösung, Physik, Szenen)
│   ├── config.ts         Spielwerte: Laufgeschwindigkeit, Sprungkraft, Schwerkraft …
│   ├── levels/           Level-Daten (aktuell als ASCII-Karten)
│   ├── objects/          Spielobjekte, z. B. der Player
│   └── scenes/
│       ├── BootScene.ts  Assets laden (erzeugt bis dahin Platzhalter-Grafiken)
│       ├── GameScene.ts  Das eigentliche Level: Boden, Münzen, Ziel, Kamera
│       └── UIScene.ts    HUD über dem Spiel (Punkte, Hinweise)
└── .github/workflows/    Automatischer Build + Veröffentlichung auf GitHub Pages
```

## Schon eingebaut

- Arcade-Physik mit Schwerkraft und Kollision
- Spielersteuerung mit **Coyote-Time**, **Jump-Buffer** und **variabler Sprunghöhe**
- Münzen einsammeln, Punktezähler, Ziel-Flagge, Neustart beim Runterfallen
- Kamera folgt dem Spieler
- Level als Textkarte in `src/levels/level1.ts` – einfach Zeichen ändern:
  `#` Boden · `o` Münze · `P` Start · `G` Ziel · `.` leer

## Nächste Schritte (Ideen)

- [ ] Eigene Sprites/Animationen in `public/assets/` und in `BootScene` laden
- [ ] Level mit [Tiled](https://www.mapeditor.org) bauen und als JSON laden
- [ ] Gegner, Leben/Schaden, Checkpoints
- [ ] Mehrere Level + Titelbildschirm
- [ ] Soundeffekte und Musik
- [ ] Touch-Steuerung für Mobilgeräte

## Online spielen (GitHub Pages)

Der Workflow in `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main`.
Einmalig unter **Settings → Pages → Source** auf **GitHub Actions** stellen –
danach ist das Spiel unter `https://<benutzername>.github.io/<repo-name>/` spielbar.
