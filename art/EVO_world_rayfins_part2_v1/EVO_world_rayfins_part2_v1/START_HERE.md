# Part 2 – die normalen Strahlenflosser

Dieses Paket enthält 20 neue gemalte PNGs: acht vollständige Neutralposen, acht Körperflächen für das Rig und vier besondere Einzelteile. Alle Fische blicken nach rechts; die Dateien haben einen echten Alphakanal.

**Zum Anschauen:** `VORSCHAU.html` lokal im Browser öffnen. Sie zeigt die vollständigen Fische und die Körperflächen, verschiedene Hintergründe sowie die tatsächlichen gemalten Breiten 45, 70 und 90 px. Das ist eine Assetvorschau ohne Spielbeleuchtung.

**Für Claude:** den ganzen Ordner unter `art/EVO_world_rayfins_part2_v1/` ins Repository legen und `CLAUDE_AUFTRAG.md` als Auftrag geben. Die gemalten Originale bleiben unter `art/`; optimierte Laufzeitdateien werden beim Einbau daraus erzeugt.

| ID | Zeichnung |
| --- | --- |
| cheirolepis | schlanker bronzefarbener Jäger |
| moythomasia | kleiner voller Bronzefisch |
| elonichthys | schlankerer olivfarbener Schwarmfisch |
| apsopelix | kleiner silberner Schwarmfisch |
| gillicus | kleines schräges Maul, langer Afterflossensaum |
| enchodus | langer Schädel und oberer Fangzahn |
| protosphyraena | Schwertschnauze und lange Brustflosse |
| xiphactinus | kräftiger Kopf und Unterkiefer |

Die acht Arten stammen aus dem aktuellen `src/data/species.ts`. Xiphactinus ist dort ein regulärer Räuber. Die Kreide-Arten sind mit enthalten, auch wenn ihr Spielabschnitt laut Quelltext noch nicht spielbar ist; für sie genügt zunächst die Werkstatt.

## Was fertig ist

- Neue gemalte Oberflächen und artspezifische Silhouetten im bisherigen Stil.
- Vollständige Neutralbilder als gestalterische Vergleichsvorlagen und für Porträts.
- Körperflächen ohne Auge und bewegliche Flossen; die Schwanzflosse gehört zum Körper.
- Sonderteile: Gillicus-Afterflosse, Protosphyraena-Brustflosse, Enchodus-Fangzahn und Xiphactinus-Unterkiefer.
- Gemessene Dateigrößen, Alpha-Grenzen und Prüfsummen; ausdrücklich als Näherungen markierte Ansatzpunkte.

## Was der Einbau noch leisten muss

Die Bilder sind **keine fertig registrierten Rig-Texturen**. Kopf, Unterkiefer und Maul müssen anhand der tatsächlichen Anatomie maskiert und ausgerichtet werden. Manche Körperbilder enthalten noch eine kleine Unterlippe bzw. einen Kinnrest; sie müssen im Körper-Cache abgeschnitten werden, sobald ein eigener Kiefer benutzt wird. Die genauen Arbeitsschritte stehen in `IMPORT.md`.

Standardflossen, Auge und passende Kiefer werden aus den vorhandenen gemalten Assets wiederverwendet. Dieses Paket enthält keine neuen Einzelteile für jede Flosse jeder Art. Die Sonderflossen ergänzen den vorhandenen Satz.

Die Dateien wurden auf Lesbarkeit, RGBA, Transparenz und Vollständigkeit geprüft. Die Animation und das Verhalten im Spiel sind noch nicht integriert oder getestet. Hier wurde nichts ins Repository gepusht.
