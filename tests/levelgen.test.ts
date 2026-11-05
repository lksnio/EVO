import { describe, expect, it } from 'vitest';
import { EPOCHS, epochIndex } from '../src/data/epochs';
import { SPECIES } from '../src/data/species';
import { STEP } from '../src/level/terrain';
import { maxSlope } from '../src/sim/brood';
import { placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';
import { loadLevel } from '../src/level/loadLevel';
import { faunaAffinity, nearNursery } from '../src/sim/habitat';
import { WORLD } from '../src/data/life';
import { TILE } from '../src/config';

// Die Welt ist für alle gleich: dieselbe Saat ergibt denselben Ort – egal, wer ihn betritt und von wo.
const ep = EPOCHS[0];
const shape = (L: ReturnType<typeof generateLevel>) => ({
  solids: L.solids,
  ground: L.groundRects.length,
  rocks: L.rocks.map((r) => [Math.round(r.x), Math.round(r.y), r.seed]),
  spawns: L.spawns,
  plants: L.plants,
  shrine: L.shrine,
});

describe('Weltgenerator', () => {
  it('erzeugt aus derselben Saat denselben Ort', () => {
    for (const place of placesOf(ep).slice(0, 4)) {
      const a = generateLevel(ep, 'test-welt', place);
      const b = generateLevel(ep, 'test-welt', place);
      expect(shape(a)).toEqual(shape(b));
    }
  });

  it('hängt nicht davon ab, von wo man ankommt (nur der Ankunftsplatz ändert sich)', () => {
    for (const place of placesOf(ep)) {
      const base = generateLevel(ep, 'test-welt', place);
      for (const side of ['left', 'right'] as const) {
        for (const frac of [0.1, 0.9]) {
          const via = generateLevel(ep, 'test-welt', place, { side, frac });
          expect(shape(via)).toEqual(shape(base));
          // man kommt am Gegenrand an (links verlassen → rechts herein)
          if (side === 'left') expect(via.start.x).toBeGreaterThan(via.width * 0.9);
          else expect(via.start.x).toBeLessThan(via.width * 0.1);
        }
      }
    }
  });

  it('andere Saat – andere Welt', () => {
    const place = placesOf(ep)[1];
    expect(shape(generateLevel(ep, 'welt-a', place))).not.toEqual(shape(generateLevel(ep, 'welt-b', place)));
  });
});

describe('Neue Begegnungen auf demselben Gelände', () => {
  it('variiert freie Tiere pro Besuch, ohne Gelände, Nahrung, Gelege oder deren Eltern zu verschieben', () => {
    for (const epoch of [ep, EPOCHS[epochIndex('karbon')]]) for (const place of placesOf(epoch)) {
      const base = loadLevel(epoch, WORLD.seed, place);
      const a = loadLevel(epoch, WORLD.seed, place, undefined, 'besuch-a');
      const b = loadLevel(epoch, WORLD.seed, place, undefined, 'besuch-b');
      const { spawns: original, ...fixed } = base;
      const { spawns: first, ...fixedA } = a;
      const { spawns: second, ...fixedB } = b;
      expect(fixedA).toEqual(fixed);
      expect(fixedB).toEqual(fixed);
      expect(first.filter(s => s.guard !== undefined)).toEqual(original.filter(s => s.guard !== undefined));
      expect(second.filter(s => s.guard !== undefined)).toEqual(original.filter(s => s.guard !== undefined));
      if (!place.safe) expect(first).not.toEqual(second);
      // Eine gemeinsame Besuchssaat funktioniert unabhängig davon, aus welcher Richtung die Spieler kommen.
      const via = loadLevel(epoch, WORLD.seed, place, { side: 'left', frac: .4 }, 'besuch-a');
      expect(via.spawns).toEqual(first);
    }
  });

  it('verändert auch die Zusammensetzung und hält Lebensräume, Kinderstube und Schlucht über viele Besuche frei', () => {
    const mixes = new Set<string>();
    for (let visit = 0; visit < 24; visit++) for (const place of placesOf(ep)) {
      const L = loadLevel(ep, WORLD.seed, place, undefined, visit);
      const counts = new Map<string, number>();
      for (const s of L.spawns) {
        counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
        expect(faunaAffinity(place, SPECIES[s.id])).toBeGreaterThan(0);
        expect(nearNursery(place, s, L.roe)).toBe(false);
        if (L.cave) expect(s.x).toBeGreaterThan(L.cave.x + L.cave.w + 400);
        if (L.chasm) expect(s.x < L.chasm.x0 - 4 * TILE || s.x > L.chasm.x1 + 4 * TILE).toBe(true);
        if (s.guard !== undefined) expect(L.roe[s.guard].species).toBe(s.id);
      }
      if (place.waterway === 0) expect(L.spawns.length).toBeLessThanOrEqual(40);
      if (place.id === 'garten') mixes.add(JSON.stringify([...counts].sort()));
    }
    expect(mixes.size).toBeGreaterThan(12);
  });
});

describe('Laichfluss im Devon', () => {
  const river = placesOf(ep)[0];
  const L = generateLevel(ep, 'evo-welt-1', river);

  it('hat nur noch einen Laichhaufen der eigenen Art – am Schlüpfplatz', () => {
    const own = L.roe.filter((q) => q.own);
    expect(own).toHaveLength(1);
    expect(Math.abs(own[0].x - L.start.x)).toBeLessThan(400);
  });

  it('der eigene Laich und der Start liegen geschützt in der Höhle; darüber bleibt freies Wasser', () => {
    const c = L.cave!;
    expect(c).toBeDefined();
    const roe = L.roe.find(q => q.own)!;
    expect(roe.x).toBeGreaterThan(c.x + 60);
    expect(roe.x).toBeLessThan(c.x + c.w - 40);
    expect(roe.y).toBeCloseTo(c.y + c.h + 3);
    expect(L.start.x).toBe(roe.x);
    expect(L.start.y).toBeGreaterThan(c.y + 30);
    expect(L.start.y).toBeLessThan(roe.y - 30);
    // Platz für die Kinderstube
    expect(c.w).toBeGreaterThan(300);
    expect(c.h).toBeGreaterThan(110);
    const solidAt = (x: number, y: number) => L.solids.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
    // drinnen ist es frei (ein Stück über dem Boden), über der Decke liegt Fels
    for (let x = c.x + 60; x < c.x + c.w - 20; x += 40) {
      expect(solidAt(x, c.y + c.h - 40)).toBe(false);
      expect(solidAt(x, c.y - 30)).toBe(true);
    }
    // über dem Fels ist Wasser bis an den linken Rand
    for (let y = L.surfaceY + 40; y < c.y - 140; y += 40) expect(solidAt(10, y)).toBe(false);
  });
});

const slopeDeg = (hp: number[], i: number) => (Math.atan(Math.abs(hp[i + 1] - hp[i]) / STEP) * 180) / Math.PI;

/** die steilste Stelle am Fuß des Felsens (das untere Fünftel seiner Höhe) */
function steepFoot(L: ReturnType<typeof generateLevel>) {
  const hp = L.terrain.hp;
  const h = L.surfaceY - Math.min(...hp);
  let m = 0;
  for (let i = 0; i < hp.length - 1; i++) {
    const above = L.surfaceY - hp[i];
    if (above > 10 && above < h * 0.18) m = Math.max(m, slopeDeg(hp, i));
  }
  return m;
}

describe('Karbon: Land über dem Wasser', () => {
  const kb = EPOCHS[epochIndex('karbon')];
  const places = placesOf(kb);

  it('jeder Ort hat Wasser und Land – das Land ragt über die Wasserlinie', () => {
    for (const place of places) {
      const L = generateLevel(kb, 'test-welt', place);
      expect(L.amphibious).toBe(true);
      expect(L.surfaceY).toBeGreaterThan(200);
      expect(L.land?.length ?? 0).toBeGreaterThan(0);
      expect(L.terrain.hp.some((y) => y > L.surfaceY + 80)).toBe(true);
      // dieselbe Saat, derselbe Ort
      expect(shape(generateLevel(kb, 'test-welt', place))).toEqual(shape(L));
    }
  });

  it('im Brutsumpf liegt das Nest im flachen Wasser, und dort leben keine Räuber', () => {
    const L = generateLevel(kb, 'test-welt', places[0]);
    expect(L.nest).toBeDefined();
    expect(L.nest!.y).toBeGreaterThan(L.surfaceY);
    for (const s of L.spawns) {
      const d = SPECIES[s.id];
      expect(d.role === 'predator' || d.role === 'apex').toBe(false);
    }
    // Landtiere stehen an Land
    for (const s of L.spawns.filter((q) => SPECIES[q.id].land)) expect(s.y).toBeLessThan(L.surfaceY);
    // Das Nest liegt in einem Tümpel, der ins tiefe Wasser reicht – Inseln trennen die Tümpel, und die Räuber müssen aus
    // demselben Wasser kommen. Der Tümpel ist so lang, dass sie außer Sicht auftauchen.
    const wet = (c: number) => L.ground[c] > L.surfaceY + 40;
    let c0 = Math.floor(L.nest!.x / 40), c1 = c0;
    while (c0 > 0 && wet(c0 - 1)) c0--;
    while (c1 < L.ground.length - 1 && wet(c1 + 1)) c1++;
    expect(Math.max(c1 * 40 - L.nest!.x, L.nest!.x - c0 * 40)).toBeGreaterThan(900);
    expect(Math.max(...L.ground.slice(c0, c1 + 1)) - L.surfaceY).toBeGreaterThan(150);
  });

  it('der steile Fels: ein hoher Gipfel, dessen Hänge oben deutlich steiler sind als unten', () => {
    const fels = places.find((p) => p.shape === 'peak')!;
    const L = generateLevel(kb, 'test-welt', fels);
    expect(L.summit).toBeDefined();
    const hp = L.terrain.hp;
    const top = Math.min(...hp);
    expect(L.surfaceY - top).toBeGreaterThan(18 * 40);
    // die steilste Stelle nahe am Gipfel und unten am Ufer
    let steepTop = 0, steepLow = 0;
    for (let i = 0; i < hp.length - 1; i++) {
      const above = L.surfaceY - hp[i];
      if (above > (L.surfaceY - top) * 0.82) steepTop = Math.max(steepTop, slopeDeg(hp, i));
      else if (above > 20 && above < (L.surfaceY - top) * 0.25) steepLow = Math.max(steepLow, slopeDeg(hp, i));
    }
    expect(steepTop).toBeGreaterThan(50);
    expect(steepLow).toBeLessThan(40);
    // Pederpes mit Grundwerten kommt unten hinauf, aber nicht bis zum Gipfel
    expect(maxSlope(0, 0)).toBeGreaterThan(steepFoot(L));
    expect(maxSlope(0, 0)).toBeLessThan(steepTop);
    expect(maxSlope(0.8, 0.8)).toBeGreaterThan(steepTop);
  });
});

describe('Bewuchs je Ort', () => {
  // Pflanzen und Deko je 1000 Bildpunkte Breite: im Korallengarten dicht, in den Tiefen deutlich weniger
  const dens = (kind: string) => {
    const place = placesOf(ep).find((p) => p.kind === kind)!;
    let n = 0, w = 0;
    for (const seed of ['bewuchs-a', 'bewuchs-b', 'bewuchs-c']) {
      const L = generateLevel(ep, seed, place);
      n += L.plants.length + L.decor.length;
      w += L.width;
    }
    return (n / w) * 1000;
  };
  it('im Korallengarten wächst viel, in den Tiefen deutlich weniger', () => {
    expect(dens('deep')).toBeLessThan(dens('lush') * 0.7);
  });
});

describe('Die Schlucht im Korallengarten', () => {
  const [river, shelf, valley] = placesOf(ep);

  it('das Tiefental erreicht man nur durch die Schlucht – rechts im Korallengarten und im Tal selbst geht es nicht weiter', async () => {
    const { edgeNeighbor } = await import('../src/data/world');
    expect(shelf.descent).toBe(valley.id);
    expect(valley.ascent).toBe(shelf.id);
    expect(edgeNeighbor(ep, river, 'right', 0.5)?.id).toBe(shelf.id);
    expect(edgeNeighbor(ep, shelf, 'left', 0.5)?.id).toBe(river.id);
    for (const frac of [0, 0.5, 1]) expect(edgeNeighbor(ep, shelf, 'right', frac)).toBeUndefined();
    for (const side of ['left', 'right'] as const) for (const frac of [0, 0.5, 1]) expect(edgeNeighbor(ep, valley, side, frac)).toBeUndefined();
  });

  it('in der Mitte ist der Boden „auf“: eine Schlucht mit steilen Wänden, darunter ein Ausgang – links und rechts riesige Felsen, keine Höhle', () => {
    const L = generateLevel(ep, 'test-welt', shelf);
    const ch = L.chasm!;
    expect(ch).toBeTruthy();
    expect(L.cave).toBeUndefined();
    const cols = L.ground.length, T = 40;
    const col = (x: number) => Math.min(cols - 1, Math.floor(x / T));
    const mid = (ch.x0 + ch.x1) / 2;
    // mitten in der Welt, sehr tief (mindestens 800 Bildpunkte unter dem Riffboden), der Ausgang liegt noch über dem Grund
    expect(mid).toBeGreaterThan(L.width * 0.42);
    expect(mid).toBeLessThan(L.width * 0.58);
    expect(L.ground[col(mid)]).toBeGreaterThan(ch.rimY + 800);
    expect(ch.floorY - ch.rimY).toBeGreaterThanOrEqual(900);
    expect(ch.exitY).toBeLessThan(L.ground[col(mid)] - 200);
    expect(ch.exitY).toBeGreaterThan(L.height);
    expect(ch.floorY).toBeGreaterThan(ch.exitY + 1000);
    for (let x = mid - 180; x <= mid + 180; x += 40) {
      expect(L.groundRects.some(r => r.x < x + 20 && r.x + r.w > x - 20)).toBe(false);
      expect(L.ground[col(x)]).toBeGreaterThan(ch.exitY + 1000);
    }
    expect(L.groundRects.every(r => r.h > 0)).toBe(true);
    // der Riffboden ringsum bleibt eben
    expect(Math.abs(L.ground[col(ch.x0 - 6 * T)] - ch.rimY)).toBeLessThan(2 * T);
    expect(Math.abs(L.ground[col(ch.x1 + 6 * T)] - ch.rimY)).toBeLessThan(2 * T);
    // Die Schlucht verläuft als steiler Kanal unter den unteren Kartenrand.
    const wallRise = Math.abs(L.ground[col(ch.x0 + 3 * T)] - L.ground[col(ch.x0 + 13 * T)]) / (10 * T);
    expect(wallRise).toBeGreaterThan(0.7);
    expect(wallRise).toBeLessThan(8);
    const giants = L.rocks.filter((r) => r.rx >= 110);
    expect(giants.some((r) => r.x < ch.x0)).toBe(true);
    expect(giants.some((r) => r.x > ch.x1)).toBe(true);
    // keine Tiere in der Schlucht
    expect(L.spawns.some((s) => s.x > ch.x0 - 3 * T && s.x < ch.x1 + 3 * T)).toBe(false);
    // von der Oberfläche aus gibt es einen freien Weg hinab: Über der Schlucht liegt weder Fels noch Boden bis zum Ausgang
    expect(L.solids.some((q) => q.x < mid + 30 && q.x + q.w > mid - 30 && q.y < ch.exitY && q.y + q.h > L.surfaceY + 100)).toBe(false);
  });

  it('von oben kommt man in der Mitte des Tals an, von unten zurück mitten in der Schlucht', () => {
    const v = generateLevel(ep, 'test-welt', valley, { side: 'top', frac: 0 });
    expect(Math.abs(v.start.x - v.width / 2)).toBeLessThan(80);
    expect(v.start.y).toBeLessThan(v.surfaceY + 400);
    expect(v.start.y).toBeGreaterThan(v.surfaceY + 100);
    const s = generateLevel(ep, 'test-welt', shelf, { side: 'chasm', frac: 0 });
    const ch = s.chasm!;
    expect(s.start.x).toBeGreaterThan(ch.x0);
    expect(s.start.x).toBeLessThan(ch.x1);
    expect(s.start.y).toBeLessThan(ch.exitY);
    expect(s.start.y).toBeGreaterThan(ch.rimY);
  });

  it('der Rest der Welt ändert sich nicht, je nachdem, wie man kommt', () => {
    const base = generateLevel(ep, 'test-welt', shelf);
    for (const side of ['chasm', 'top'] as const) expect(shape(generateLevel(ep, 'test-welt', shelf, { side, frac: 0 }))).toEqual(shape(base));
  });
});
