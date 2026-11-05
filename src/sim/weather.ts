// ---------------------------------------------------------------------------
// Das Wetter über dem Meer: Ab und zu zieht es zu, es wird dunkler, dann regnet es eine Weile, und es klart wieder auf.
// Es hängt an der gemeinsamen Weltzeit (sim/life.ts) – alle Spieler am selben Ort erleben denselben Regen. Die Zeit ist in
// Abschnitte geteilt; in etwa jedem zweiten zieht ein Regen durch, jedes Mal etwas anders lang, früher oder später, stärker
// oder schwächer. Erst ziehen Wolken auf (es wird dunkler, der Wind frischt auf), dann setzt der Regen ein, in Böen mal
// dichter, mal lichter; am Ende hört er auf, und die Wolken ziehen langsamer ab, als sie kamen.
// ---------------------------------------------------------------------------

export const WEATHER = {
  /** so lang ist ein Abschnitt (Sekunden Weltzeit) – in jedem kann ein Regen durchziehen */
  slot: 480,
  /** so wahrscheinlich regnet es in einem Abschnitt */
  chance: 0.5,
  /** frühester Beginn im Abschnitt und Spielraum dafür (Sekunden) */
  startMin: 50,
  startSpread: 130,
  /** so lange regnet es wenigstens, und so viel länger höchstens */
  durMin: 140,
  durSpread: 130,
  /** so lange vor dem Regen ziehen die Wolken auf, so lange nach ihm ziehen sie ab (Sekunden) */
  cloudIn: 45,
  cloudOut: 60,
  /** so lange setzt der Regen ein bzw. lässt nach */
  rainIn: 25,
  rainOut: 30,
  /** Böen: so stark schwankt der Regen (Anteil) und in welchem Takt (Sekunden) */
  gust: 0.3,
  gustPeriod: 23,
  /** so viel stärker wird der Seegang bei Wind und Regen (1 + storm × …) */
  swell: 0.75,
  /** so viel Licht fällt bei vollem Wolkendach noch ins Wasser */
  light: 0.3,
};

export interface Weather {
  /** wie zugezogen der Himmel ist (0 klar … 1 ganz bedeckt) */
  cloud: number;
  /** wie stark es regnet (0 … 1) */
  rain: number;
}

const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

/** ein fester Zufall je Abschnitt und Zweck (0 … 1) */
function hash(slot: number, salt: number) {
  let h = (Math.imul(slot | 0, 0x27d4eb2d) ^ Math.imul(salt + 1, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Der Regen eines Abschnitts: wann er beginnt und endet und wie stark er ist (oder keiner). */
export function episode(slot: number) {
  if (hash(slot, 0) >= WEATHER.chance) return undefined;
  const start = slot * WEATHER.slot + WEATHER.startMin + hash(slot, 1) * WEATHER.startSpread;
  const end = start + WEATHER.durMin + hash(slot, 2) * WEATHER.durSpread;
  return { start, end, strength: 0.6 + 0.4 * hash(slot, 3) };
}

/** Das Wetter zur Weltzeit s (Sekunden). */
export function weatherAt(s: number): Weather {
  const k = Math.floor(s / WEATHER.slot);
  let cloud = 0, rain = 0;
  // ein Regen kann mit seinen abziehenden Wolken in den nächsten Abschnitt hineinreichen
  for (const slot of [k - 1, k]) {
    const e = episode(slot);
    if (!e) continue;
    const c = smooth((s - (e.start - WEATHER.cloudIn)) / WEATHER.cloudIn) * (1 - smooth((s - e.end) / WEATHER.cloudOut));
    const gusts = 1 - WEATHER.gust * (0.5 + 0.5 * Math.sin((s / WEATHER.gustPeriod) * Math.PI * 2 + slot));
    const r = e.strength * gusts * smooth((s - e.start) / WEATHER.rainIn) * (1 - smooth((s - (e.end - WEATHER.rainOut)) / WEATHER.rainOut));
    cloud = Math.max(cloud, c);
    rain = Math.max(rain, r);
  }
  return { cloud, rain };
}

/** Wie stark der Seegang bei diesem Wetter ist (Faktor): Schon der Wind vor dem Regen rührt das Wasser auf. */
export function stormSwell(w: Weather) {
  return 1 + WEATHER.swell * Math.max(w.cloud * 0.55, w.rain);
}

/** Wie viel Sonnenlicht bei diesem Wetter noch ins Wasser fällt (Faktor). */
export function sunlight(w: Weather) {
  return 1 - (1 - WEATHER.light) * w.cloud;
}

/**
 * Zum Ausprobieren: ?weather=rain, clouds oder clear legt das Wetter fest; ?weather=demo spielt einen ganzen Regen im
 * Zeitraffer (70 Sekunden: klar – Wolken ziehen auf – Regen – es klart auf). seconds: Zeit für den Zeitraffer.
 */
export function forcedWeather(search: string, seconds = 0): Weather | undefined {
  const v = new URLSearchParams(search).get('weather');
  if (v === 'demo') {
    const t = ((seconds % 70) + 70) % 70;
    return { cloud: smooth((t - 6) / 10) * (1 - smooth((t - 52) / 14)), rain: smooth((t - 16) / 6) * (1 - smooth((t - 44) / 8)) };
  }
  if (v === 'rain') return { cloud: 1, rain: 1 };
  if (v === 'clouds') return { cloud: 1, rain: 0 };
  if (v === 'clear') return { cloud: 0, rain: 0 };
  return undefined;
}
