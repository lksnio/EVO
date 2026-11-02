# Biologischer Größenmaßstab

Alle 68 vorhandenen Tierarten beziehen ihre ungefähre ausgewachsene Größe aus `src/data/speciesFacts.ts`. Die Chronik und die lebenden Tiere verwenden dieselben Werte. Neue Tiere brauchen ebenfalls eine Größenreferenz; ein fehlender Wert wird nicht durch eine frei gewählte Standardgröße ersetzt.

Ein Zentimeter entspricht einem Weltpixel (`WORLD_PX_PER_CM` in `src/data/animalSize.ts`). Kamera und Bildschirmgröße beeinflussen die Projektion, nicht das Verhältnis der Tiere untereinander. Die eigene evolvierbare Spielfigur und ihre Artgenossen behalten ihren bestehenden Körperbau und Wuchs; sie stellen keine fest vermessene Fossilart dar.

Der Umrechnungsfaktor zwischen Zeichnung und Welt bleibt getrennt vom individuellen Faktor `sz`: bestehende Alters-/Größenvariation, Kampfwerte und die Netzwerk-Nachricht ändern ihre Bedeutung nicht. Alle Angriffs- und Erholungsposen wenden den Artmaßstab wieder an. Gastgeber, Stellvertreter und ein übernehmender Gastgeber rechnen gleich. Trefferflächen und Bisskoordinaten werden mit dem Sprite skaliert. Große Schwimmer werden beim Erzeugen mit ihrer tatsächlichen Körperausdehnung über Boden und Felsen platziert.

Die Texturen werden weiter in ihrer bisherigen Auflösung wiederverwendet. Es entstehen keine größeren Tiertexturen oder Größenvarianten pro Frame. Die ferne Fauna verwendet denselben Maßstab mit perspektivischer Verkleinerung; der alte zusätzliche Mindestgrößenfaktor für große Hintergrundschatten entfällt.

## Messgrundlagen und Grenzen

- Fische und Meeresechsen: Gesamtlänge einschließlich Schwanz, im ruhigen geschlossenen Zustand. Bei Bewegung verkürzt sich ihre Projektion durch die Krümmung.
- Gliederfüßer und Trilobiten: Körperlänge; Beine, Antennen und Scheren können darüber hinausragen.
- Gerade Kopffüßer: Schalenlänge. Bei fossilen Riesen ist gerade diese Angabe wesentlich besser zugänglich als die Länge des Weichkörpers.
- Ammonit: Schalendurchmesser, separat von Kopf und Fangarmen.
- Qualle: Schirmdurchmesser, separat von Tentakeln und transparentem Lichtsaum.

Die Werte stammen aus den bisher hinterlegten Chronik-Referenzen. Sie sind keine neu durchgeführte wissenschaftliche Vermessung aller Arten. Gattungen umfassen unterschiedlich große Arten und Individuen. Die Sammelbezeichnungen `kieferlos`, `trilobit`, `qualle` und `tausendfuss` verwenden ausdrücklich einen repräsentativen Körper; es gibt keine einzige tatsächliche Größe dieser ganzen Gruppen.

Dunkleosteus wurde von 5 m auf eine Referenz von 4,1 m aktualisiert. Neuere Rekonstruktionen liegen für große Exemplare ungefähr bei 3,4–4,1 m; der kaum überlieferte Hinterkörper macht jede Gesamtlänge zu einer Schätzung. Literaturhinweis: R. K. Engelman (2023), *A Devonian Fish Tale: A New Method of Body Length Estimation Suggests Much Smaller Sizes for Dunkleosteus terrelli*, Diversity 15(3), 318, DOI: https://doi.org/10.3390/d15030318. Auch die sehr großen Angaben zu Rhizodus und Cameroceras beruhen auf unsicheren Rekonstruktionen und dienen als Größenreferenzen, nicht als exakt bekannte Maße.

Die Zeichnungen bleiben stilisiert. Die Skalierung stellt die linearen Größenverhältnisse her; sie ersetzt keine anatomische Neubearbeitung aller Körperformen. Bereits vorhandene Jungtiere verwenden weiter den bisherigen Größenanteil von 55 %. Artgenaue Wachstumsreihen und Schlupfgrößen sind damit noch nicht modelliert.

## Konkrete Folgen fürs Spiel

Bei normalem Zoom sind 2–6 cm große Tiere nur etwa 1–4 Spielbildpixel lang. Moythomasia, Trilobiten und kleine Karbon-Gliederfüßer sind daher deutlich schwerer zu erkennen und zu treffen. Es gibt keine künstliche Mindestgröße. Rolfosteus ist mit 45 cm nun erheblich kleiner als sein bisheriger frei gewählter Auftritt, während seine bisherigen Kampfwerte erhalten bleiben. Bestehende Geschwindigkeiten wirken bei winzigen Körpern sehr hoch; Nahrung, Jagd und Gefahr müssen auf diesem Maßstab neu ausbalanciert werden.

Riesen können schmale Unterschlüpfe nicht mehr wie zuvor nutzen. Rhizodus erreicht etwa 7 m; ein ausgewachsener Mosasaurus aus dem noch ruhenden Kreide-Katalog etwa 15 m. Letzterer ist bei normalem Zoom nahezu bildschirmfüllend. Die aktuellen Tiefental-Schwimmer wurden im Browser auf freien Platz über dem Boden geprüft. Die zukünftigen Kreide-Lebensräume sind noch keine fertig spielbaren Karten.

## Prüfung und Vorschau

- `npm test -- --maxWorkers=2`
- `npm run build`
- Vite starten, dann `NODE_PATH=/tmp/evo-browser/node_modules node tools/check_animal_sizes.cjs` (externes playwright-core und Chromium).
- `?debug&gallery=sizes` zeigt sechs Tiere mit einem gemeinsamen Lineal. `&ids=all` zeigt alle 68 Arten in Seiten zu je sechs; Leertaste blättert. Alternativ `&ids=moythomasia,cladoselache,dunkleosteus`.
- Die bisherigen Porträtwerkstätten passen Tiere weiterhin zur Betrachtung in gleich große Felder ein. Sie sind keine Größenvergleiche.

`captures/browser-check.json` enthält den Browserbericht für alle 68 Arten: Länge, Zeichnungsmaßstab, Körper-/Trefferfläche, Jungtierfaktor, Wiederherstellung nach Posen und übereinstimmende Stellvertreter. Enthalten sind auch Bodenkontrollen im Tiefental und die Prüfung auf konstante Texturzahl bei wiederholten Größen-/Animationswechseln.
