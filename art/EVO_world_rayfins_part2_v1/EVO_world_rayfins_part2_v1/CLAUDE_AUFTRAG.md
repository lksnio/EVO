# Auftrag: Part 2 der gemalten Weltfische einbauen

Setze dieses Assetpaket für genau diese acht IDs um: `cheirolepis`, `moythomasia`, `elonichthys`, `apsopelix`, `gillicus`, `enchodus`, `protosphyraena`, `xiphactinus`.

Arbeite auf dem bestehenden Feature-Branch. `main` bleibt unverändert. Lies zuerst `START_HERE.md`, `IMPORT.md`, `import/assets.json` und `import/species_profiles.json`; prüfe anschließend den tatsächlichen aktuellen Code.

Ziel: zusammenhängend gemalte Weltfische mit kontinuierlicher Schwimmbewegung aus dem vorhandenen Spine-Solver und eigenen anatomischen Profilen. Diese NPCs haben feste Artformen. Verwende die acht Silhouetten und die benannten Sonderteile; erhalte ihre Unterschiede beim Übertragen ins Rig.

1. Füge einen Adapter für feste Arten hinzu. Er soll die vorhandene Rig-Bewegung wiederverwenden und die Evolution des Spielerfisches davon unabhängig lassen. Die vollständigen Bilder in `masters/` sind die gestalterische Vergleichsvorlage. Baue die beweglichen Tiere aus `rig_bodies/`, vorhandenen gemalten Standardteilen und den neuen Sonderteilen auf.
2. Registriere die Teile je Art. Die Alpha-Grenzen sind gemessen, die Ansatzpunkte sind nur Startwerte. Erzeuge pro Art eine neutrale Montage und gleiche Auge, Kiefer, Schwanzstiel und Flossenansätze mit dem vollständigen Bild ab. Maskiere verbliebene Kinn-/Unterlippenflächen aus dem Körper. Lass die Wurzel des Kiefers ausreichend unter den Kopf reichen.
3. Nutze das originale Artprofil für die Farbidentität. Die gemalten Basisfarben sind bereits artspezifisch; eine zusätzliche volle Verhältnis-Tönung auf die alte Grundfarbe kann sie verdunkeln. Erhalte die hellen Bauchflächen und prüfe Farben nach dem gesamten Licht-/Sichtpfad.
4. Halte Gameplay, Größenverhältnisse, AI, Trefferflächen und Angriffstiming stabil. Beachte besonders `Animal.ts`: Physikgröße hängt bisher von der alten Texturgröße ab; Kieferbilder beeinflussen Offset und Bissfläche. Übernimm diese Werte ausdrücklich, bevor du die sichtbare Darstellung wechselst. Der neue Bildrand definiert keine neue Hitbox.
5. Erweitere die Werkstatt um genau diese Arten und zeige sie auch in echter Spielgröße. Prüfe Ruhe, Schwimmen, Antritt, Biss, Blickrichtungswechsel und Despawn. Standardteile dürfen gemeinsam gecacht werden; pro Frame werden nur Posen gerechnet.

Artspezifisch:

- Cheirolepis, Moythomasia, Elonichthys behalten den längeren oberen Schwanzlappen.
- Gillicus bekommt die neue lange Afterflosse und ein kleines schräges Maul.
- Enchodus trägt den Fangzahn am oberen Gaumen; der Zahn darf beim Öffnen nicht mit dem Unterkiefer mitdrehen.
- Protosphyraena behält eine stabile Schwertschnauze; die lange Brustflosse erhält einen eigenen Ansatz und eine geringe Nachbewegung.
- Xiphactinus nutzt den schweren neuen Unterkiefer. Beim Biss bleibt eine dunkle Mundöffnung mit Tiefe sichtbar, ohne eine rote gespannte Fläche.

Prüfe vorhandene Tests und Typprüfung, dazu sinnvolle Adapter-/Transformationsprüfungen. Liefere Vergleichsaufnahmen aller acht Arten bei 45/70/90 px sowie der Jäger beim Biss. Messe den neuen NPC-Pfad gegen den alten mit vergleichbaren Szenen bei 18 und 40 Tieren; benenne Software-GL ausdrücklich, falls keine echte GPU verfügbar ist.

Fertig heißt hier: Die neue Darstellung läuft mit dem bisherigen Verhalten, die Übergänge bleiben in Bewegung geschlossen, und die Arten sind in Spielgröße lesbar. Dokumentiere konkrete Restarbeiten ehrlich. Andere Tiergruppen und Bosse bleiben für spätere Teile vorgesehen.
