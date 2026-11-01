# Wasser als räumliches Medium

## Gestalterische Einschätzung des Screenshots

Die Szene zeigt bereits Wasserfarbe, Strömungsbewegung und Hintergrundebenen. Viele nahe und entfernte Konturen haben noch eine ähnliche Härte; der offene Raum ist relativ gleichmäßig gefüllt. Für ein stärkeres Meeresgefühl würde ich Licht, Sichttiefe und Bewegung im freien Wasser deutlicher miteinander verbinden.

Der Entwurf `reference/wasser_stimmungsreferenz.png` veranschaulicht diese Richtung. Er ist eine gemalte Momentaufnahme; Bewegung und tatsächliche Spiellesbarkeit müssen im Renderer beurteilt werden. Oberflächenlicht ist dort bewusst gut sichtbar. Für die Laufzeit eher schwächer beginnen und langsam steigern.

## Priorität 1: Lichtmuster auf den Oberflächen

Die charakteristischen bewegten Lichtflecken unter Wasser heißen **Kaustiken**: gebündeltes Licht, das durch die bewegte Wasseroberfläche gebrochen wird. Für die Szene eignen sich wenige breite, gebrochene Lichtbänder auf den oberen Sandflächen, Steinoberseiten und gelegentlich dem Höhlendach. Sie sollten langsam wandern und ihre Form ändern, mit ruhiger Helligkeit.

Die Muster sitzen auf den Oberflächen in Weltkoordinaten. Sie dürfen nicht wie ein Ornament mit der Kamera über das ganze Bild rutschen. Begrenze sie auf beleuchtete Flächen; die dunkle unterirdische Geländeschnittfläche, der offene Wasserraum und die Höhlenrückwand bekommen kein flächiges helles Netz. In tieferen oder beschatteten Bereichen sanft ausblenden.

Ein möglicher leichter Aufbau: ein oder zwei wiederholbare Lichtmuster-Texturen mit unterschiedlichen langsamen UV-Bewegungen und weicher Modulation; vorhandene Terrain-/Lichtmasken wiederverwenden. Eine fertige animierte Texturfolge ist ebenfalls möglich. Das ist eine Gestaltungsempfehlung, kein mitgeliefertes Shader-Asset. Zwei bloß gegeneinander verschobene Muster können noch sichtbar gleiten; Formänderung oder ein kleiner Animationszyklus macht den Effekt überzeugender.

Startwert für einen ersten A/B-Vergleich: nur etwa 5–12 % wahrgenommener zusätzlicher Helligkeitsanteil auf ausgewählten Flächen. Das ist ein künstlerischer Ausgangswert, keine physikalische oder gemessene Vorgabe.

## Priorität 2: Wasser zwischen den Bildebenen

Entfernte Pflanzen und Felsen stärker zur Wasserfarbe hin überblenden, ihren Kontrast reduzieren und ihre Konturen weicher gestalten. Mittlere Ebene klarer lassen, nahe Objekte am schärfsten. Ein sehr sanfter, langsam veränderlicher blaugrüner Schleier zwischen Hintergrund und Spielgeschehen erzeugt mehr Tiefe.

Die Entfernung der **Zeichenebene** und die tatsächliche **Wassertiefe** sind verschiedene Größen. Verwende je Ebene passende Trübung und ergänze den vorhandenen Tiefenfarbverlauf. Eine weitere globale Multiplikation mit Dunkelheit würde auch die gemalten Fische, Eier und die Muschel schwächen. Die spielwichtigen Formen müssen nach dem ganzen Sicht-/Lichtpfad lesbar sein.

## Priorität 3: Lichtstrahlen und Schwebeteilchen

Wenige breite, weiche, unregelmäßig unterbrochene Lichtschächte von oben. Sie driften sehr langsam, werden nach unten diffuser und treten nur in passenden beleuchteten Stellen auf. Keine harten weißen Dreiecke. In der Höhle bleibt der direkte Lichteinfall ausgespart.

Dazu drei Partikelebenen:

| Ebene | Erscheinung | Bewegung |
| --- | --- | --- |
| Fern | sehr kleine, kontrastarme Punkte/Flocken | langsam, wenig Parallaxe |
| Mitte | vereinzelte unregelmäßige Schwebeteilchen | folgen der vorhandenen Strömung mit geringer Abweichung |
| Nah | wenige größere, weiche unscharfe Flecken | etwas stärkere Parallaxe, sehr geringe Deckkraft |

Die meisten Partikel bleiben kaum sichtbar. Einzelne fangen im Lichtschacht einen Lichtreflex. Kein gleichmäßig funkelnder Sternenhimmel und kein dichter Schneefall. Als erster Test für ungefähr 1600x900 Bildschirm-Pixel genügen etwa 30–60 sichtbare Schwebeteilchen insgesamt, davon höchstens wenige große nahe Flecken; bei anderer Auflösung bzw. Welt-Skalierung anpassen. Konkrete Anzahl und Deckkraft sind Design-Startwerte.

Die Partikel sollen beim Scrollen räumlich stabil wirken. Lebenszeiten und Ein-/Ausblenden verhindern sichtbare Spawn-Kanten. Wenn es ein Strömungsfeld gibt, dessen Werte verwenden, statt für die Wasserpartikel ein unabhängiges Wackeln zu erfinden.

## Akzente: Blasen und aufgewirbelter Sand

Blasen sparsam und örtlich begründet einsetzen: einzelne Felsspalten oder ein kurzer Effekt bei einem Ereignis. Die vorhandenen runden Blasenringe nicht einfach überall vervielfachen. Die Wasserzeichnung soll auch ohne Blasenquelle überzeugen.

Nahe am Boden kann ein kräftiger Antritt kurz sehr feinen Sand anheben. Er wird vom Strom mitgenommen und setzt sich bzw. verblasst langsam. Diese Reaktion verbindet Tier, Boden und Wasser. Keine permanente braune Rauchwolke unter jedem Fisch.

## Feinschliff: dezente Brechung

Erst nach den oberen Schritten: eine kaum merkliche, langsam wandernde Verzerrung auf entfernten Hintergrundebenen oder Lichtmustern. Die Bewegung sollte bei normalem Spielzoom höchstens subtil auffallen. Keine starke Ganzbild-Verzerrung, und keine Verzerrung von Schrift, HUD oder Eingabefeedback. Der Fisch soll präzise lesbar bleiben.

## Umsetzung und Abnahme

Beginne mit Oberflächenlicht und Trübung der Hintergrundebenen, ergänze dann Lichtschächte und das kleine Partikelfeld. Vergleiche jeden Schritt gegen die Ausgangsszene. Verwende vorhandene Texturen/Masken und gepoolte Partikel; vermeide eine zusätzliche hochaufgelöste Neuzeichnung pro Objekt und Frame.

Phaser dokumentiert Partikel, Shader und Render-/Dynamic-Textures; die tatsächlich verwendete Projektversion und vorhandenen Lichtpfade beim Einbau prüfen. Für den ersten Durchgang sind ein paar passende gemalte Lichttexturen und maskierte Ebenen oft ein sinnvoller Ausgangspunkt. Ein Shader kann anschließend die Formänderung und Verzerrung zusammenfassen.

Abnahme: Vergleich bei Ruhe und Kamerabewegung, heller und tiefer Stelle, Höhle und Muschel. Das Wasser muss räumlicher wirken, während Fische und Interaktionsobjekte klar bleiben. Mit gleicher Auflösung und gleicher Tierzahl Leistung vorher/nachher messen; Software-GL und echte GPU getrennt benennen. Hier wurden keine Effekte implementiert oder Performancewerte gemessen.

Primärquellen für die technischen Möglichkeiten und Lichtphänomene:

- NVIDIA GPU Gems, *Rendering Water Caustics*: https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics
- Phaser 4, Partikel und RenderTexture-Beispiel: https://phaser.io/oss/examples/v4.1.0/game%20objects/render%20texture/view/particle-emitter-to-render-texture
- Phaser 4 RenderTexture-Dokumentation: https://www.phaser.io/oss/docs/api-documentation/class/gameobjects-rendertexture
- Phaser Shader-Dokumentation: https://docs.phaser.io/api-documentation/class/gameobjects-shader

Die konkrete Kombination, Reihenfolge und Intensität oben sind ein künstlerischer Vorschlag für dieses Spiel.
