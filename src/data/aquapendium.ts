import { SPECIES_FACTS as FACTS } from './speciesFacts';
import { epochSpecies, ERAS, type EpochDef } from './epochs';
import { SPECIES, type Role, type SpeciesDef } from './species';
import type { PlaceKind } from './world';

// ---------------------------------------------------------------------------
// Die Chronik des Lebens (im Code „Chronik des Lebens“): ein Buch mit einer Seite für jedes Tier der Urmeere, in sieben Teilen – einer je Zeitalter (Devon bis
// Paläogen; Teile ruhender Zeitalter, deren Tiere noch fehlen, sind leer). Alle Seiten gibt es von Anfang an – wer ein Tier noch nie gesehen hat, sieht nur seinen schwarzen
// Umriss. Hier stehen die Angaben zu jedem Tier: wie es in der
// Wirklichkeit hieß, wie groß es etwa war und wann es lebte, dazu ein paar Worte. Die Werte (Lebenskraft, Biss …) sind
// die aus dem Spiel. Alle Größen und Zeiten sind grobe Näherungen – bei vielen Urtieren weiß man es nicht genauer.
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

const size = (d: SpeciesDef) => FACTS[d.id].cm;

/** Die Tiere eines Zeitalters: die Bewohner seiner Orte, die Durchzügler und die großen Gäste. */
function idsOf(ep: EpochDef): string[] {
  return epochSpecies(ep).filter((id) => SPECIES[id]);
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
