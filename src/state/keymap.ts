// ---------------------------------------------------------------------------
// Die Tastenbelegung: Jede Handlung hat bis zu zwei Tasten (eine Haupt- und eine Zweittaste), frei belegbar auf der Seite
// „Steuerung“ (Titelbild und Rast). Eine Taste gehört immer nur einer Handlung – wer sie neu vergibt, nimmt sie der alten
// weg. Esc bleibt fest (Rast, zurück). Gespeichert im Browser, unabhängig vom Spielstand.
// Tasten werden als Tastencodes (KeyboardEvent.keyCode – wie bei Phaser) geführt.
// ---------------------------------------------------------------------------

export type Bind = 'left' | 'right' | 'up' | 'down' | 'bite' | 'sprint' | 'ram' | 'talk' | 'call' | 'jump' | 'overview' | 'pause' | 'mute';

export interface BindDef {
  id: Bind;
  label: string;
  /** ein paar leise Worte dazu */
  note?: string;
}

/** Die Handlungen in der Reihenfolge der Seite „Steuerung“. */
export const BINDS: BindDef[] = [
  { id: 'left', label: 'Nach links' },
  { id: 'right', label: 'Nach rechts' },
  { id: 'up', label: 'Nach oben' },
  { id: 'down', label: 'Nach unten' },
  { id: 'bite', label: 'Beißen und Fressen', note: 'zur Laichzeit: laichen' },
  { id: 'sprint', label: 'Sprinten', note: 'kostet Kraft' },
  { id: 'ram', label: 'Stoß', note: 'Anlauf nehmen' },
  { id: 'talk', label: 'Ansprechen', note: 'im Gespräch: weiter' },
  { id: 'call', label: 'Gruppe rufen', note: 'oder fortschicken' },
  { id: 'jump', label: 'Auftauchen' },
  { id: 'overview', label: 'Übersicht' },
  { id: 'pause', label: 'Rast', note: 'auch Esc' },
  { id: 'mute', label: 'Ton an/aus' },
];

/** Die Grundbelegung: Pfeiltasten schwimmen, die linke Hand liegt auf Q W E R. */
export const DEFAULT_KEYS: Record<Bind, number[]> = {
  left: [37],
  right: [39],
  up: [38],
  down: [40],
  bite: [69, 81],
  sprint: [87, 16],
  ram: [82],
  talk: [70, 13],
  call: [83],
  jump: [32],
  overview: [67],
  pause: [80],
  mute: [77],
};

/** Esc ist fest vergeben (Rast, zurück, abbrechen). */
export const ESC = 27;

const STORE = 'evo-keys-v1';

const copy = (m: Record<Bind, number[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]])) as Record<Bind, number[]>;

let keys: Record<Bind, number[]> = copy(DEFAULT_KEYS);
const listeners = new Set<() => void>();

/** Gerade wird eine Taste neu belegt: Dann wirkt keine Taste im Spiel (auch nicht M für den Ton). */
export const capture = { on: false };

function storage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    return undefined;
  }
}

/** Die gespeicherte Belegung laden (fehlende Handlungen behalten ihre Grundbelegung). */
export function loadKeys() {
  keys = copy(DEFAULT_KEYS);
  try {
    const raw = storage()?.getItem(STORE);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Record<Bind, unknown>>;
    for (const b of BINDS) {
      const v = saved[b.id];
      if (Array.isArray(v)) keys[b.id] = v.filter((c): c is number => typeof c === 'number' && c > 0 && c !== ESC).slice(0, 2);
    }
  } catch {
    /* kaputt gespeichert: dann eben die Grundbelegung */
  }
}

function changed() {
  try {
    storage()?.setItem(STORE, JSON.stringify(keys));
  } catch {
    /* ohne Speicher gilt die Belegung bis zum Neuladen */
  }
  for (const fn of listeners) fn();
}

/** Bei jeder Änderung der Belegung benachrichtigen (gibt die Abmeldung zurück). */
export function onKeysChanged(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function keysOf(b: Bind): readonly number[] {
  return keys[b];
}

/** Welche Handlung hat diese Taste? */
export function bindOf(code: number): Bind | undefined {
  return BINDS.find((b) => keys[b.id].includes(code))?.id;
}

/**
 * Eine Taste vergeben (slot 0: Haupttaste, 1: Zweittaste) – oder mit null leeren. Hatte eine andere Handlung die Taste,
 * verliert sie sie (zurückgegeben wird, welche). Esc lässt sich nicht vergeben.
 */
export function setKey(b: Bind, slot: 0 | 1, code: number | null): Bind | undefined {
  if (code === ESC) return undefined;
  const list = keys[b];
  let took: Bind | undefined;
  if (code === null) list.splice(slot, 1);
  else if (list.includes(code)) {
    // schon eine Taste dieser Handlung: Haupt- und Zweittaste tauschen
    const i = list.indexOf(code);
    if (i !== slot && slot < list.length) [list[i], list[slot]] = [list[slot], list[i]];
  } else {
    for (const o of BINDS) {
      const i = keys[o.id].indexOf(code);
      if (i < 0) continue;
      keys[o.id].splice(i, 1);
      took = o.id;
    }
    if (slot < list.length) list[slot] = code;
    else list.push(code);
  }
  changed();
  return took;
}

export function resetKeys() {
  keys = copy(DEFAULT_KEYS);
  changed();
}

export function isDefault() {
  return BINDS.every((b) => keys[b.id].join() === DEFAULT_KEYS[b.id].join());
}

/** Gehört dieser Tastendruck zur Handlung? (Während des Neubelegens nie.) */
export function matches(b: Bind, e: { keyCode: number }) {
  return !capture.on && keys[b].includes(e.keyCode);
}

const NAMES: Record<number, string> = {
  8: 'Rücktaste', 9: 'Tab', 13: 'Eingabe', 16: 'Shift', 17: 'Strg', 18: 'Alt', 20: 'Feststell', 32: 'Leertaste',
  33: 'Bild ↑', 34: 'Bild ↓', 35: 'Ende', 36: 'Pos1', 37: '←', 38: '↑', 39: '→', 40: '↓', 45: 'Einfg', 46: 'Entf',
  91: 'Win', 92: 'Win', 93: 'Menü', 106: 'Num *', 107: 'Num +', 109: 'Num -', 110: 'Num ,', 111: 'Num /',
  160: '^', 163: '#', 171: '+', 173: '-', 186: 'Ü', 187: '+', 188: ',', 189: '-', 190: '.', 191: '#', 192: 'Ö', 219: 'ß',
  220: '^', 221: '´', 222: 'Ä', 226: '<',
};

/** Der Name einer Taste, wie er auf der Tastatur steht. */
export function keyName(code: number): string {
  if (NAMES[code]) return NAMES[code];
  if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return `Num ${code - 96}`;
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `Taste ${code}`;
}

/** Die Haupttaste einer Handlung (für Zeichen über dem Kopf und Hinweise) – „–“, wenn keine vergeben ist. */
export function keyLabel(b: Bind) {
  const c = keys[b][0];
  return c ? keyName(c) : '–';
}

/** Alle Tasten einer Handlung: „E oder Q“. */
export function keysText(b: Bind) {
  return keys[b].length ? keys[b].map(keyName).join(' oder ') : 'keine Taste';
}

loadKeys();
