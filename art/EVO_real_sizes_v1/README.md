# Biologische Referenzen und lesbarer Spielmaßstab

Alle 68 vorhandenen Tierarten beziehen ihre ungefähre biologische Referenzgröße aus `src/data/speciesFacts.ts`. Die Chronik zeigt diese Angaben weiterhin unverändert. Für das Spiel wird daraus eine bewusst vergrößerte, leicht gestauchte Darstellungsgröße berechnet. Neue Tiere brauchen ebenfalls eine Größenreferenz; ein fehlender Wert wird nicht durch eine frei gewählte Standardgröße ersetzt.

Die Abstimmung steht zentral in `src/data/animalSize.ts`: Eine gewählte Referenz von 1 m entspricht 240 Weltpixeln; andere Größen folgen der Potenzkurve `240 × (cm / 100)^0,85`. Kleine Tiere profitieren relativ stärker von der Vergrößerung. Ausgewachsene Tiere erhalten mindestens 24 Weltpixel Körperlänge, also rund 17 Spielbildpixel beim normalen Zoom 0,72. Individuelle Variation kann diese Untergrenze bis etwa 15 Pixel senken; selbst Jungtiere bleiben bei mindestens etwa acht Pixeln. Die Größe des Tiers wird weiterhin gemeinsam mit Trefferfläche und Biss skaliert. Kamera und Bildschirmgröße beeinflussen nur die Projektion. Die eigene evolvierbare Spielfigur und ihre Artgenossen behalten ihren bestehenden Körperbau und Wuchs; sie stellen keine fest vermessene Fossilart dar.

Der Umrechnungsfaktor zwischen Zeichnung und Welt bleibt getrennt vom individuellen Faktor `sz`: bestehende Alters-/Größenvariation, Kampfwerte und die Netzwerk-Nachricht ändern ihre Bedeutung nicht. Alle Angriffs- und Erholungsposen wenden den Artmaßstab wieder an. Gastgeber, Stellvertreter und ein übernehmender Gastgeber rechnen gleich. Trefferflächen und Bisskoordinaten werden mit dem Sprite skaliert. Große Schwimmer werden beim Erzeugen mit ihrer tatsächlichen Körperausdehnung über Boden und Felsen platziert.

Die Texturen werden weiter in ihrer bisherigen Auflösung wiederverwendet. Es entstehen keine größeren Tiertexturen oder Größenvarianten pro Frame. Die ferne Fauna verwendet denselben Maßstab mit perspektivischer Verkleinerung; der alte zusätzliche Mindestgrößenfaktor für große Hintergrundschatten entfällt.

## Auswahl innerhalb der biologischen Größenordnungen

`PLAY_LENGTH_CM` enthält ausdrücklich gestalterisch gewählte Spielreferenzen. Kleine Fische werden eher durch größere Exemplare vertreten (z. B. Moythomasia 10 cm), große Arten eher durch konservative kleinere Rekonstruktionen (z. B. Dunkleosteus 3,4 m, Rhizodus 6 m). Diese Auswahl ist getrennt von den Chronikdaten und behauptet keine neu vermessenen wissenschaftlichen Unsicherheitsintervalle. Wo kein belastbarer Alternativwert vorliegt, bleibt die bestehende Referenz erhalten; Sichtbarkeit übernimmt dort die Größenkurve.

Beispiele ohne individuellen Alters-/Größenfaktor:

| Tier | Chronikreferenz | Spielauswahl | Länge in der Spielwelt |
| --- | ---: | ---: | ---: |
| Moythomasia | 6 cm | 10 cm | ca. 34 px |
| Cladoselache | 1,8 m | 1 m | 240 px |
| Hyneria | 2,8 m | 2,5 m | ca. 523 px |
| Dunkleosteus | 4,1 m | 3,4 m | ca. 679 px |
| Rhizodus | 7 m | 6 m | ca. 1.101 px |
| Mosasaurus | 15 m | 11 m | ca. 1.843 px |

Damit werden auch die größten Tiere insgesamt größer als bei der vorherigen 1-px-pro-cm-Fassung. Die Spannweite zwischen Moythomasia und Mosasaurus sinkt dabei von 250:1 auf ungefähr 54:1.

## Messgrundlagen und Grenzen

- Fische und Meeresechsen: Gesamtlänge einschließlich Schwanz, im ruhigen geschlossenen Zustand. Bei Bewegung verkürzt sich ihre Projektion durch die Krümmung.
- Gliederfüßer und Trilobiten: Körperlänge; Beine, Antennen und Scheren können darüber hinausragen.
- Gerade Kopffüßer: Schalenlänge. Bei fossilen Riesen ist gerade diese Angabe wesentlich besser zugänglich als die Länge des Weichkörpers.
- Ammonit: Schalendurchmesser, separat von Kopf und Fangarmen.
- Qualle: Schirmdurchmesser, separat von Tentakeln und transparentem Lichtsaum.

Die Werte stammen aus den bisher hinterlegten Chronik-Referenzen. Sie sind keine neu durchgeführte wissenschaftliche Vermessung aller Arten. Gattungen umfassen unterschiedlich große Arten und Individuen. Die Sammelbezeichnungen `kieferlos`, `trilobit`, `qualle` und `tausendfuss` verwenden ausdrücklich einen repräsentativen Körper; es gibt keine einzige tatsächliche Größe dieser ganzen Gruppen.

Dunkleosteus wurde von 5 m auf eine Referenz von 4,1 m aktualisiert. Neuere Rekonstruktionen liegen für große Exemplare ungefähr bei 3,4–4,1 m; der kaum überlieferte Hinterkörper macht jede Gesamtlänge zu einer Schätzung. Literaturhinweis: R. K. Engelman (2023), *A Devonian Fish Tale: A New Method of Body Length Estimation Suggests Much Smaller Sizes for Dunkleosteus terrelli*, Diversity 15(3), 318, DOI: https://doi.org/10.3390/d15030318. Auch die sehr großen Angaben zu Rhizodus und Cameroceras beruhen auf unsicheren Rekonstruktionen und dienen als Größenreferenzen, nicht als exakt bekannte Maße.

Die Zeichnungen bleiben stilisiert. Die Darstellung komprimiert die biologischen Größenverhältnisse zugunsten der Lesbarkeit; sie ersetzt keine anatomische Neubearbeitung aller Körperformen. Bereits vorhandene Jungtiere verwenden weiter den bisherigen Größenanteil von 55 %. Artgenaue Wachstumsreihen und Schlupfgrößen sind damit noch nicht modelliert.

## Konkrete Folgen fürs Spiel

Die kleinsten Tiere sind jetzt sichtbar und besser zu treffen. Individueller Wuchs und Kampfwerte bleiben getrennt: Nahrung, Tempo und Gefahr nutzen weiterhin das bisherige Balancing. Die globale Vergrößerung verändert die Begegnungsabstände und die Passung in schmalen Unterschlüpfen. Der Erzeugungsabstand großer Schwimmer zu Boden und Felsen berücksichtigt ihre größere Körperausdehnung.

Mosasaurus aus dem noch ruhenden Kreide-Katalog ist bei normalem Zoom breiter als ein Bildschirm. Das ist eine Folge der gewünschten Gesamtvergrößerung. Die zukünftigen Kreide-Lebensräume sind noch keine fertig spielbaren Karten.

## Prüfung und Vorschau

- `npm test -- --maxWorkers=2`
- `npm run build`
- Vite starten, dann `NODE_PATH=/tmp/evo-browser/node_modules node tools/check_animal_sizes.cjs` (externes playwright-core und Chromium).
- `?debug&gallery=sizes` zeigt sechs Tiere in derselben Spielansicht. Das Lineal misst Weltpixel; biologische Referenz und Spielauswahl stehen separat daneben. `&ids=all` zeigt alle 68 Arten in Seiten zu je sechs; Leertaste blättert. Alternativ `&ids=moythomasia,cladoselache,dunkleosteus`.
- Die bisherigen Porträtwerkstätten passen Tiere weiterhin zur Betrachtung in gleich große Felder ein. Sie sind keine Größenvergleiche.

`captures/browser-check.json` enthält den Browserbericht für alle 68 Arten: biologische Referenz, Spielauswahl, Darstellungsgröße, Zeichnungsmaßstab, Körper-/Trefferfläche, Jungtierfaktor, Wiederherstellung nach Posen und übereinstimmende Stellvertreter. Enthalten sind auch Bodenkontrollen im Tiefental und die Prüfung auf konstante Texturzahl bei wiederholten Größen-/Animationswechseln.
