import { ERAS, type EpochDef } from './epochs';
import { SPECIES, type Role, type SpeciesDef } from './species';
import type { PlaceKind } from './world';

// ---------------------------------------------------------------------------
// Das Aquapendium: ein Buch mit einer Seite für jedes Tier der Urmeere, in sieben Teilen – einer je Zeitalter (Devon bis
// Paläogen; Teile ruhender Zeitalter, deren Tiere noch fehlen, sind leer). Alle Seiten gibt es von Anfang an – wer ein Tier noch nie gesehen hat, sieht nur seinen schwarzen
// Umriss. Hier stehen die Angaben zu jedem Tier: wie es in der
// Wirklichkeit hieß, wie groß es etwa war und wann es lebte, dazu ein paar Worte. Die Werte (Lebenskraft, Biss …) sind
// die aus dem Spiel. Alle Größen und Zeiten sind grobe Näherungen – bei vielen Urtieren weiß man es nicht genauer.
// ---------------------------------------------------------------------------

interface Fact {
  /** wissenschaftlicher Name */
  latin: string;
  /** Länge in Zentimetern (ungefähr) */
  cm: number;
  /** vor so vielen Millionen Jahren (ungefähr) */
  ma: number;
  /** ein, zwei Sätze zum Tier */
  note: string;
}

const FACTS: Record<string, Fact> = {
  kieferlos: { latin: 'Agnatha', cm: 15, ma: 480, note: 'So nennt man die frühesten Fische: Sie hatten noch keine Kiefer, sondern ein rundes Saugmaul. Sie filterten Nahrung aus dem Wasser und dem Schlamm.' },
  sacabambaspis: { latin: 'Sacabambaspis janvieri', cm: 35, ma: 450, note: 'Die Augen sitzen ganz vorn am Kopf, der Körper steckt in einem knöchernen Panzer. Gefunden wurde er in Bolivien – einer der vollständigsten Fische seiner Zeit.' },
  birkenia: { latin: 'Birkenia elegans', cm: 8, ma: 425, note: 'Ein kleiner Kieferloser mit einer Reihe spitzer Stacheln auf dem Rücken. Er schwamm in Schwärmen durch flache Gewässer und Flussmündungen.' },
  cephalaspis: { latin: 'Cephalaspis lyelli', cm: 22, ma: 410, note: 'Sein Kopf trägt einen halbrunden Knochenschild wie ein Hufeisen. Mit dem flachen Bauch ruhte er am Boden und wühlte nach Nahrung im Schlamm.' },
  cheiracanthus: { latin: 'Cheiracanthus murchisoni', cm: 25, ma: 390, note: 'Ein „Stachelhai“: kein echter Hai, sondern ein eigener Zweig früher Kieferfische mit kräftigen Stacheln vor den Flossen. Er lebte in Schwärmen.' },
  bothriolepis: { latin: 'Bothriolepis canadensis', cm: 30, ma: 380, note: 'Ein Panzerfisch mit zwei gepanzerten „Ruderarmen“ statt Brustflossen. Er lebte am Grund und kam in riesigen Mengen vor – man findet ihn in vielen Fossillagern.' },
  cladoselache: { latin: 'Cladoselache fyleri', cm: 180, ma: 370, note: 'Ein früher Hai, schlank wie ein Torpedo und sehr schnell. Er jagte kleinere Fische im offenen Wasser und verschluckte sie oft im Ganzen.' },
  rolfosteus: { latin: 'Rolfosteus canningensis', cm: 45, ma: 380, note: 'Ein Panzerfisch mit einem langen, spitzen Fortsatz an der Schnauze. Er lebte in einem Riff im heutigen Australien.' },
  eusthenopteron: { latin: 'Eusthenopteron foordi', cm: 100, ma: 385, note: 'Ein Fleischflosser: In den kräftigen Flossen stecken Knochen, die an Arme und Beine der späteren Landtiere erinnern. Ein großer Räuber der Flüsse und Küsten.' },
  arandaspis: { latin: 'Arandaspis prionotolepis', cm: 15, ma: 470, note: 'Eines der ältesten gepanzerten Wirbeltiere, gefunden in Australien. Sein Kopf steckt in einem Schild aus Knochenplatten, ein Kiefer fehlt.' },
  astraspis: { latin: 'Astraspis desiderata', cm: 20, ma: 460, note: 'Sein Panzer besteht aus vielen kleinen, gehöckerten Knochenplättchen wie ein Mosaik. Er lebte in flachen Meeren, im heutigen Nordamerika.' },
  eriptychius: { latin: 'Eriptychius americanus', cm: 30, ma: 450, note: 'Ein Kieferloser mit einem dicken Panzer aus Knochen und Zahnbein. Seine Reste wurden in Colorado gefunden – und gehören zu den ältesten Wirbeltierfossilien überhaupt.' },
  conodont: { latin: 'Promissum pulchrum', cm: 40, ma: 445, note: 'Ein aalartiges Tier mit großen Augen und Reihen kleiner Zähnchen. Lange kannte man nur die Zähnchen – erst später fand man das ganze Tier.' },
  isotelus: { latin: 'Isotelus rex', cm: 70, ma: 450, note: 'Einer der größten Trilobiten, die je gefunden wurden. Der glatte, breite Panzer erinnert an einen Löffel; er pflügte durch den Schlamm.' },
  pteraspis: { latin: 'Pteraspis rostrata', cm: 20, ma: 410, note: 'Der Kopfpanzer läuft vorn in einem langen Schnabel aus, der Schwanz hat eine lange untere Spitze. Er schwamm im freien Wasser und filterte Kleinzeug.' },
  thelodus: { latin: 'Thelodus parvidens', cm: 15, ma: 430, note: 'Statt eines Panzers trägt er winzige, zahnartige Schuppen. Er war flach gebaut und schwamm in großen Schwärmen.' },
  jamoytius: { latin: 'Jamoytius kerwoodi', cm: 25, ma: 430, note: 'Lang und schlank wie ein Aal, mit Flossensäumen an Rücken und Bauch. Wovon er lebte, ist bis heute nicht ganz geklärt.' },
  lasanius: { latin: 'Lasanius problematicus', cm: 10, ma: 430, note: 'Ein kleiner, hochrückiger Kieferloser aus Schottland mit einer Reihe von Schuppen entlang der Flanke. Er gehört zu den Anaspiden.' },
  climatius: { latin: 'Climatius reticulatus', cm: 8, ma: 420, note: 'Ein winziger Stachelhai mit zwei Reihen langer Stacheln an Bauch und Rücken – wer ihn schlucken wollte, hatte es schwer.' },
  entelognathus: { latin: 'Entelognathus primordialis', cm: 20, ma: 423, note: 'Einer der ersten Fische mit echten Kieferknochen, wie sie später alle Knochenfische tragen. Ein gepanzerter Jäger, gefunden in China.' },
  dalmanites: { latin: 'Dalmanites limulurus', cm: 10, ma: 430, note: 'Ein Trilobit mit großen Facettenaugen, einem Kopf wie ein Helm und einem langen Stachel am Schwanz.' },
  coccosteus: { latin: 'Coccosteus cuspidatus', cm: 40, ma: 385, note: 'Ein Panzerfisch mit scherenartigem Maul. Kopf und Brust sind gepanzert, ein Gelenk im Nacken ließ den Kopf weit aufklappen.' },
  pterichthyodes: { latin: 'Pterichthyodes milleri', cm: 15, ma: 385, note: 'Ein „Flügelfisch“: Die gepanzerten Brustflossen sehen aus wie Arme oder Flügel. Er lebte in schottischen Seen.' },
  dipterus: { latin: 'Dipterus valenciennesi', cm: 35, ma: 385, note: 'Ein früher Lungenfisch mit fleischigen Flossen und kräftigen Zahnplatten, mit denen er Schalen knackte.' },
  osteolepis: { latin: 'Osteolepis macrolepidotus', cm: 20, ma: 385, note: 'Ein kleiner Fleischflosser mit großen, glänzenden Schuppen. Er jagte kleine Tiere in Seen und Flüssen.' },
  cheirolepis: { latin: 'Cheirolepis trailli', cm: 55, ma: 390, note: 'Einer der frühesten Strahlenflosser – die Gruppe, zu der die meisten heutigen Fische gehören. Schlank, schnell und ein gieriger Räuber.' },
  moythomasia: { latin: 'Moythomasia durgaringa', cm: 6, ma: 380, note: 'Ein kleiner früher Strahlenflosser mit glänzenden, rautenförmigen Schuppen. Er stammt aus dem Gogo-Riff im heutigen Australien.' },
  stethacanthus: { latin: 'Stethacanthus altonensis', cm: 70, ma: 360, note: 'Ein Hai mit einer Rückenflosse wie ein Amboss oder Bügelbrett, besetzt mit Zähnchen. Wozu das diente, rätseln Forscher bis heute.' },
  tiktaalik: { latin: 'Tiktaalik roseae', cm: 250, ma: 375, note: 'Ein Fisch mit Hals, flachem Krokodilkopf und Flossen, die schon fast Arme sind. Ein Zwischenschritt auf dem Weg vom Wasser an Land.' },
  drepanaspis: { latin: 'Drepanaspis gemuendenensis', cm: 35, ma: 400, note: 'Flach wie eine Flunder, mit dem Maul nach vorn. Er siebte den Boden nach Futter. Gefunden wurde er im deutschen Hunsrück.' },
  holoptychius: { latin: 'Holoptychius flemingi', cm: 100, ma: 370, note: 'Ein großer Fleischflosser mit dicken, gewellten Schuppen. Er war ein Räuber der Flüsse und Lagunen.' },
  acanthodes: { latin: 'Acanthodes bronni', cm: 30, ma: 380, note: 'Ein Stachelhai ohne Zähne. Er filterte Plankton aus dem offenen Wasser und zog in Schwärmen umher.' },
  trilobit: { latin: 'Trilobita', cm: 5, ma: 500, note: 'Gliederfüßer mit dreigeteiltem Panzer, die über 250 Millionen Jahre lang die Meere bevölkerten. Man kennt mehr als 20.000 Arten.' },
  qualle: { latin: 'Scyphozoa', cm: 10, ma: 500, note: 'Quallen gab es schon, bevor es Fische gab. Ihre Nesselzellen brennen – Berührung lohnt sich nicht.' },
  orthoceras: { latin: 'Orthoceras regulare', cm: 60, ma: 470, note: 'Ein Kopffüßer mit einer geraden Schale, verwandt mit den heutigen Tintenfischen. Er jagte Krebstiere und kleine Fische.' },
  cameroceras: { latin: 'Cameroceras', cm: 600, ma: 470, note: 'Einer der größten Kopffüßer: Seine gerade Schale konnte mehrere Meter lang werden. Ein Schatten, vor dem sich alle in Acht nahmen.' },
  seeskorpion: { latin: 'Eurypterus remipes', cm: 20, ma: 420, note: 'Seeskorpione sind keine Skorpione, sondern Verwandte der Spinnen und Pfeilschwanzkrebse. Mit den Paddelbeinen ruderten sie durchs Wasser.' },
  dunkleosteus: { latin: 'Dunkleosteus terrelli', cm: 500, ma: 370, note: 'Der Schrecken des Devon: ein Panzerfisch von vielen Metern Länge. Statt Zähnen hat er scharfe Knochenklingen mit enormer Beißkraft.' },
  megalograptus: { latin: 'Megalograptus ohioensis', cm: 130, ma: 450, note: 'Ein großer Seeskorpion mit Stachelzangen an den Vorderbeinen. Er jagte am Meeresgrund nach Würmern, Krebsen und Fischen.' },
  pterygotus: { latin: 'Pterygotus anglicus', cm: 200, ma: 420, note: 'Der Riese unter den Seeskorpionen: fast zwei Meter lang, mit kräftigen Scheren und riesigen Augen. Er zählte zu den größten Räubern seiner Zeit.' },
  hyneria: { latin: 'Hyneria lindae', cm: 280, ma: 365, note: 'Ein riesiger Fleischflosser mit mächtigen Fangzähnen – ein Räuber der Flüsse und Mündungen im Spätdevon.' },
  // ---- Kreidezeit
  apsopelix: { latin: 'Apsopelix anglicus', cm: 30, ma: 85, note: 'Ein kleiner, heringsartiger Fisch, der in großen Schwärmen durch das Binnenmeer zog – Futter für fast alle größeren Jäger.' },
  gillicus: { latin: 'Gillicus arcuatus', cm: 200, ma: 85, note: 'Groß, aber harmlos: Mit winzigen Zähnen siebte er Kleinzeug aus dem Wasser. Man fand ihn im Bauch eines Xiphactinus – im Ganzen verschluckt.' },
  ammonit: { latin: 'Placenticeras meeki', cm: 60, ma: 75, note: 'Ein Kopffüßer in einer aufgerollten, gekammerten Schale, die ihn wie ein Schwimmkörper trug. Viele Schalen tragen Bissspuren von Mosasauriern.' },
  baculites: { latin: 'Baculites ovatus', cm: 100, ma: 75, note: 'Ein Ammonit mit fast gerader Schale. Er trieb wohl schräg im Wasser, den Kopf nach unten, und fing kleines Getier.' },
  enchodus: { latin: 'Enchodus petrosus', cm: 100, ma: 80, note: 'Der „Säbelzahnhering“: ein Raubfisch mit langen Fangzähnen vorn im Maul. Er war häufig – und selbst eine beliebte Beute der Meeresechsen.' },
  protosphyraena: { latin: 'Protosphyraena perniciosa', cm: 300, ma: 85, note: 'Ein schneller Jäger mit schwertartiger Schnauze und sichelförmigen Brustflossen – er erinnert an einen Schwertfisch, ist aber nicht mit ihm verwandt.' },
  squalicorax: { latin: 'Squalicorax falcatus', cm: 250, ma: 80, note: 'Der „Krähenhai“: Seine gesägten Zähne steckten in Knochen von Meeresechsen, Schildkröten und sogar Dinosauriern, die ins Meer gespült wurden – er fraß auch Aas.' },
  xiphactinus: { latin: 'Xiphactinus audax', cm: 500, ma: 85, note: 'Ein Raubfisch so groß wie ein Hai, mit vorstehendem Unterkiefer und langen Fangzähnen. Ein berühmtes Fossil zeigt einen Xiphactinus mit einem fast zwei Meter langen Fisch im Bauch.' },
  archelon: { latin: 'Archelon ischyros', cm: 400, ma: 75, note: 'Die größte Meeresschildkröte, die je gelebt hat: vier Meter lang, mit einem lederartigen Panzer und einem kräftigen Hakenschnabel. Sie fraß wohl Quallen und Ammoniten.' },
  cretoxyrhina: { latin: 'Cretoxyrhina mantelli', cm: 700, ma: 85, note: 'Ein Riesenhai, gebaut wie ein Weißer Hai, mit messerscharfen Zähnen – daher sein Spitzname „Ginsu-Hai“. Er jagte Fische, Meeresechsen und Plesiosaurier.' },
  platecarpus: { latin: 'Platecarpus tympaniticus', cm: 550, ma: 82, note: 'Ein mittelgroßer Mosasaurier, schlank und schnell, mit einer Schwanzflosse wie ein Hai. Er jagte Fische und Kopffüßer.' },
  elasmosaurus: { latin: 'Elasmosaurus platyurus', cm: 1300, ma: 80, note: 'Ein Plesiosaurier, dessen Hals länger ist als der ganze übrige Körper – über 70 Halswirbel. Mit vier Flossen „flog“ er durchs Wasser und schnappte nach Fischschwärmen.' },
  tylosaurus: { latin: 'Tylosaurus proriger', cm: 1300, ma: 82, note: 'Einer der größten Mosasaurier, mit einer langen, knöchernen Schnauze, mit der er Beute rammen konnte. In seinem Magen fand man Fische, Haie, Plesiosaurier – und sogar einen Seevogel.' },
  mosasaurus: { latin: 'Mosasaurus hoffmannii', cm: 1500, ma: 70, note: 'Der Herrscher der späten Kreidemeere: eine Meeresechse von bis zu fünfzehn Metern, mit einem Maul voller kegelförmiger Zähne. Ihm war keiner gewachsen.' },
};

// ---------------------------------------------------------------------------

export interface Entry {
  id: string;
  /** Seitenzahl in seinem Teil des Buches (ab 1) */
  no: number;
  def: SpeciesDef;
  latin: string;
  cm: number;
  ma: number;
  note: string;
  /** in welchen Zeitaltern dieses Spiels es vorkommt */
  eras: string[];
}

/** Ein Teil des Buches: die Tiere eines Zeitalters. */
export interface Section {
  /** Nummer des Zeitalters */
  epoch: number;
  ep: EpochDef;
  entries: Entry[];
}

const ROLE_ORDER: Role[] = ['prey', 'defender', 'predator', 'hazard', 'apex'];

const size = (d: SpeciesDef) => (d.art as { len?: number }).len ?? ((d.art as { r?: number }).r ?? 16) * 2;

/** Die Tiere eines Zeitalters: die Bewohner seiner Orte, die Durchzügler und die großen Gäste. */
function idsOf(ep: EpochDef): string[] {
  const ids = [...ep.fauna.map(([f]) => f), ...ep.passers.map(([f]) => f), ...ep.events.map((v) => v.species ?? '')];
  return [...new Set(ids)].filter((id) => SPECIES[id]);
}

function entry(id: string, no: number): Entry {
  const def = SPECIES[id];
  const f = FACTS[id] ?? { latin: def.name, cm: 20, ma: 400, note: '' };
  return { id, no, def, latin: f.latin, cm: f.cm, ma: f.ma, note: f.note, eras: ERAS.filter((e) => idsOf(e.ep).includes(id)).map((e) => e.ep.name) };
}

/** Die Seiten eines Teils: erst die Beute, dann die Wehrhaften, die Jäger … – innerhalb davon die großen zuerst. */
function build(ep: EpochDef): Entry[] {
  const ids = idsOf(ep).sort((a, b) => {
    const da = SPECIES[a], db = SPECIES[b];
    const ra = ROLE_ORDER.indexOf(da.role), rb = ROLE_ORDER.indexOf(db.role);
    if (ra !== rb) return ra - rb;
    return size(db) - size(da) || a.localeCompare(b);
  });
  return ids.map((id, i) => entry(id, i + 1));
}

/** Das Buch in sieben Teilen – einer je Zeitalter, in der Reihenfolge der Erdgeschichte. */
export const SECTIONS: Section[] = ERAS.map(({ i, ep }) => ({ epoch: i, ep, entries: build(ep) }));

/** Alle Tiere des Buches (jedes nur einmal – manche leben in mehreren Zeitaltern). */
export const ENTRIES: Entry[] = (() => {
  const seen = new Set<string>();
  return SECTIONS.flatMap((s) => s.entries).filter((e) => !seen.has(e.id) && !!seen.add(e.id));
})();

export const ROLE_TEXT: Record<Role, string> = {
  prey: 'Beute',
  defender: 'Wehrhaft',
  predator: 'Jäger',
  hazard: 'Nesseltier',
  apex: 'Herrscher',
};

export const DIET_TEXT: Record<SpeciesDef['diet'], string> = { plant: 'Pflanzen und Kleinzeug', meat: 'Fleisch', none: 'Nesselt, frisst Plankton' };

export const LAYER_TEXT = { floor: 'Nahe am Grund', mid: 'Mittleres Wasser', open: 'Offenes Wasser' } as const;

export const PLACE_TEXT: Record<PlaceKind, string> = { start: 'Startgewässer', lush: 'bewachsene Orte', murky: 'trübe Orte', deep: 'tiefe Orte', abyss: 'Abgründe' };

export function lengthText(cm: number) {
  const fmt = (n: number, d = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: d });
  return cm >= 100 ? `ca. ${fmt(cm / 100, 1)} m` : `ca. ${fmt(cm)} cm`;
}

export function herdText(d: SpeciesDef) {
  if (!d.herd) return 'Einzelgänger';
  const [a, b] = d.herd;
  const n = a === b ? `${a}` : `${a} bis ${b}`;
  return d.role === 'predator' || d.role === 'apex' ? `Rudel aus ${n} Tieren` : `Schwärme aus ${n} Tieren`;
}

/** Wo die Art häufiger vorkommt als anderswo. */
export function placesText(d: SpeciesDef) {
  const w = d.where;
  if (!w) return 'überall';
  const kinds = (Object.keys(PLACE_TEXT) as PlaceKind[]).filter((k) => (w[k] ?? 1) >= 1.2);
  return kinds.length ? kinds.map((k) => PLACE_TEXT[k]).join(', ') : 'überall';
}

/** Größte Werte über alle Tiere – damit die Balken vergleichbar sind. */
export const MAXES = (() => {
  const m = { hp: 1, dmg: 1, power: 1, speed: 1, sense: 1 };
  for (const e of ENTRIES) {
    m.hp = Math.max(m.hp, e.def.hp);
    m.dmg = Math.max(m.dmg, e.def.dmg);
    m.power = Math.max(m.power, e.def.power);
    m.speed = Math.max(m.speed, e.def.speed);
    m.sense = Math.max(m.sense, e.def.sense);
  }
  return m;
})();

export const entryOf = (id: string) => ENTRIES.find((e) => e.id === id);
