# Nachweis am tatsächlichen Ergebnis

Die hier erzeugten Referenzbilder sind keine Screenshots einer bereits verbesserten Spielversion. Alle folgenden Nachweise entstehen nach der Umsetzung im Projekt.

## Bildwirkung

- Normal, kurz/massig und starkes Gebiss bei geschlossenem Maul nebeneinander ansehen.
- Beim starken Gebiss geschlossen, halb offen und maximale gestaltete Öffnung vergleichen.
- Rücken der massigen Form: runder zusammenhängender Verlauf, kein spitzer Körperhöcker.
- Kiemenfalte: auslaufende Furche mit geringem Eigenkontrast; kein heller Ring um den Kopf.
- Wange: modellierte Masse und passend verdecktes Gelenk; kein flacher ovaler Fleck.
- Unterkiefer: kräftiger Ansatz und geschlossener Anschluss zur Kehle, auch in Bewegung.
- Innenraum: dunkle Tiefe, schmale Gaumen-/Mundbodenflächen, weiche hintere Verbindung; keine gespannte rote Fläche.
- Kein plötzlich sichtbarer Schnitt, keine Lücken oder doppelten Umrisse bei Variantenübergängen.

## Spielansicht und Sicht

- Gleicher Ort, gleiche Evolutionswerte und gleicher Seed für Vorher/Nachher.
- Oberflächenlicht und Schatten bei normalem Spielzoom prüfen; Größenvergleich 45/70/90 Pixel ergänzen.
- Eigener Fisch vor und hinter Vordergrundpflanzen beziehungsweise Felsen: Verdeckung muss funktionieren.
- Wenden und Kameranachlauf: die Spieleraufhellung darf nicht springen oder flackern.
- Gegner am Sichtrand: bestehende Freigabe/Silhouettenwirkung vergleichen; keine neue Sichtbarkeit durch die Spielerkompensation.
- Augen, helle Flossen und Bauch: kein ausgebrannter Glanz und kein umlaufender Leuchtrand.

## Belastungsfälle

- Kurz/massig + starkes Gebiss.
- Kopfpanzer + starkes Gebiss.
- Zwischenwerte um die vorhandenen Variantenschwellen.
- Schwimmen, Beschleunigen und vollständiger Bissablauf.
- Ein repräsentativer Fischbestand für die Performanceprüfung; Software-GL und echte GPU-Messungen getrennt benennen.

## Abschluss

Bestehende Tests und Typprüfung ausführen. Den tatsächlich geprüften Commit, die Bildbelege und wesentliche verbleibende Abweichungen nennen. Technische Korrektheit und gestalterische Prüfung getrennt berichten. Bei fehlender Grafikhardware die Einschränkung ausdrücklich benennen.
