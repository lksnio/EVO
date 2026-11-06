import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { game, ZERO_TRAITS, type RoeEgg } from '../src/state/GameState';
import { WORLD } from '../src/data/life';
import { EPOCHS, epochIndex, firstPlayable } from '../src/data/epochs';
import { setServerClock, worldYears } from '../src/sim/life';
import { endLineage, focusTime, markKey, newLineage, observeLineage, readLineage, recordBirth, TIME_WORLD,
  timeAt, timeFraction, zoomTime, type LineageForm, type LineageSite } from '../src/sim/lineage';

/** das spielbare Zeitalter (das Perm) */
const P = firstPlayable();
const form: LineageForm = { cls: 'fish', traits: {}, hue: 1, seed: 2, sex: 1 };
const site: LineageSite = { key: 'devon:riff', place: 'riff', name: 'Laichfluss', x: 100, y: 500 };
const egg = (place = 'riff', seed = 2): RoeEgg => ({ place, x: 100, y: 500, seed, sex: 1, traits: { bs: .8, cb: .3 } });
let now: number;
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
  now = WORLD.start + 3600_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  setServerClock(now, now); game.load('lineagetest'); game.resetAll();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setServerClock(Date.now(), Date.now()); });

describe('Persönlicher gespielter Stammbaum', () => {
  it('datiert Geburt und Dauer nach Weltzeit; bloßes Besuchen eines Gebiets erzeugt keinen Knoten', () => {
    game.newRun(P);
    const r = game.data.lineage.runs[0], s = r.segments[0];
    expect(s.site.name).toBe('The Spawning River');
    expect(s.from).toBe(worldYears(EPOCHS[P].from, EPOCHS[P].to));
    now += 600_000; game.ageBy(600); game.enterPlace('garten', { side: 'left', frac: .5 });
    expect(s.from - s.to).toBeCloseTo(600 * WORLD.yearsPerSecond);
    expect(s.seconds).toBe(600); expect(r.segments).toHaveLength(1);
  });
  it('behält Änderungen der Werte und Geschwister am selben Laichplatz im selben Abschnitt', () => {
    game.newRun(P); now += 600_000; game.hatchRoe(egg(), 2);
    now += 60_000; game.hatchRoe({ ...egg(), x: 320, seed: 9 }, 2);
    const r = game.data.lineage.runs[0];
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].births.map(b => b.gen)).toEqual([1, 2, 2]);
    expect(r.segments[0].first.traits).not.toHaveProperty('bs');
    expect(r.segments[0].last.seed).toBe(9);
    game.run!.traits.cb = -.9;
    expect(r.segments[0].last.traits.cb).toBe(.3);
  });
  it('setzt neue Knoten genau bei gewählten Nachkommen an anderen Laichplätzen, auch bei einer Rückkehr', () => {
    game.newRun(P); now += 600_000; game.hatchRoe(egg('garten'), 2);
    const date = worldYears(EPOCHS[P].from, EPOCHS[P].to);
    now += 600_000; game.hatchRoe(egg('riff'), 3);
    const s = game.data.lineage.runs[0].segments;
    expect(s.map(s => s.site.place)).toEqual(['riff', 'garten', 'riff']);
    expect(s[1].from).toBe(date); expect(s[0].to).toBe(date);
  });
  it('nimmt keine fremden Koop-Generationen als gespielt auf; erst die eigene Auswahl zählt', () => {
    game.newRun(P);
    game.syncShared(8, [egg('garten')], []);
    expect(game.data.lineage.runs[0].segments).toHaveLength(1);
    expect(game.data.lineage.runs[0].segments[0].births).toHaveLength(1);
    now += 30_000; game.hatchRoe(egg('garten'), 8);
    expect(game.data.lineage.runs[0].segments[1].births[0].gen).toBe(8);
  });
  it('zeichnet im Karbon erst das gewählte Ei auf, nicht schon das Angebot der nächsten Generation', () => {
    const K = epochIndex('karbon');
    EPOCHS[K].playable = true;
    try {
      game.newRun(K); game.newClutch();
      const r = game.data.lineage.runs[0];
      expect(r.segments[0].births).toHaveLength(1);
      now += 100_000; game.hatchEgg(game.eggOffer()[0]);
      expect(r.segments[0].births).toHaveLength(2);
      expect(r.segments[0].births[1].gen).toBe(2);
    } finally { EPOCHS[K].playable = undefined; }
  });
  it('erhält ausgestorbene Verläufe und vermischt gleiche Tierformen aus verschiedenen Läufen nicht', () => {
    game.newRun(P); now += 600_000; game.ageBy(600);
    game.extinct(.1, 'Gefressen'); game.newRun(P);
    expect(game.data.lineage.runs.map(r => r.status)).toEqual(['extinct', 'alive']);
    expect(game.data.lineage.runs[0].cause).toBe('Gefressen');
    expect(game.data.lineage.runs[0].segments).toHaveLength(1);
  });
  it('speichert Markierung, Farben und Zeiten, ohne beim erneuten Laden eine Geburt zu erfinden', () => {
    game.newRun(P); now += 600_000; game.hatchRoe(egg('garten'), 2);
    const r = game.data.lineage.runs[0], key = markKey(r, r.segments[1]); game.markLineage(key);
    const before = JSON.stringify(game.data.lineage); game.load('lineagetest');
    expect(JSON.stringify(game.data.lineage)).toBe(before);
    expect(game.data.lineage.marked).toBe(key);
    expect(game.data.lineage.runs[0].segments[1].first.traits).toEqual(expect.objectContaining({ cb: .3, bs: .8 }));
  });
  it('ein beschädigter Geburtseintrag löscht weder das Profil noch andere gültige Läufe', () => {
    game.newRun(P); game.extinct(.1, 'Test'); game.newRun(P);
    const raw = JSON.parse(JSON.stringify(game.data));
    raw.lineage.runs[0].segments[0].births = [null];
    storage.set('evo-save-v3-lineagetest', JSON.stringify(raw)); game.load('lineagetest');
    expect(game.run?.id).toBe(2);
    expect(game.data.lineage.runs.some(r => r.id === 2 && !r.legacy)).toBe(true);
  });
  it('hält Aufzeichnungen verschiedener lokaler Spieler auch bei gleichen Eiern getrennt', () => {
    game.newRun(P); game.hatchRoe(egg('garten'), 2); game.save();
    game.load('anotherplayer'); game.resetAll(); game.newRun(P); game.hatchRoe(egg('wand'), 2); game.save();
    game.load('lineagetest');
    expect(game.data.lineage.runs[0].segments.at(-1)?.site.place).toBe('garten');
    game.load('anotherplayer');
    expect(game.data.lineage.runs[0].segments.at(-1)?.site.place).toBe('wand');
  });
  it('kennzeichnet ältere aktive Spielstände und bewahrt datierte alte Endpunkte ohne ausgedachte Geburten', () => {
    game.newRun(P); game.hatchRoe(egg(), 2); game.extinct(.3, 'Alt'); game.newRun(P);
    const old = JSON.parse(JSON.stringify(game.data)); delete old.lineage;
    storage.set('evo-save-v3-lineagetest', JSON.stringify(old)); now += 3600_000; game.load('lineagetest');
    const ended = game.data.lineage.runs.find(r => r.status === 'extinct')!, alive = game.data.lineage.runs.find(r => r.status === 'alive')!;
    expect(ended.legacy).toBe(true); expect(alive.legacy).toBe(true);
    expect(ended.segments[0].from).toBe(EPOCHS[P].from - .3 * (EPOCHS[P].from - EPOCHS[P].to));
    expect(ended.segments[0].to).toBe(ended.segments[0].from);
    expect(alive.segments[0].site.name).toBe('Spawning site not recorded');
    const before = JSON.stringify(game.data.lineage); game.load('lineagetest');
    expect(JSON.stringify(game.data.lineage)).toBe(before);
  });
});

describe('Zeitmaßstab und robuste Aufzeichnung', () => {
  it('hat gleiche vertikale Abstände für gleiche Weltjahre, unabhängig von der Zahl der Generationen', () => {
    const w = { from: 383e6, to: 371e6 };
    expect(timeFraction(380e6, w)).toBe(.25);
    expect(timeAt(.5, w)).toBe(377e6);
    expect(timeFraction(377e6, w) - timeFraction(380e6, w)).toBe(timeFraction(374e6, w) - timeFraction(377e6, w));
  });
  it('zoomt am Mausanker und begrenzt den Ausschnitt auf die sieben Epochen', () => {
    const w = { from: 383e6, to: 371e6 }, zoom = zoomTime(w, .5, .3);
    expect(timeAt(.3, zoom)).toBe(timeAt(.3, w));
    expect(zoom.from - zoom.to).toBe(6e6);
    expect(zoomTime(TIME_WORLD, 10)).toEqual(TIME_WORLD);
  });
  it('behält einen persönlichen Verlauf durch Epochengrenzen und lässt Uhrkorrekturen nicht nach oben wachsen', () => {
    const a = newLineage(); const r = recordBirth(a, 1, 0, 380e6, 1, site, form);
    observeLineage(r, 375e6, 600); observeLineage(r, 378e6, 20);
    expect(r.segments[0].to).toBe(375e6);
    recordBirth(a, 1, 1, 350e6, 6, { ...site, key: 'karbon:ufer' }, { ...form, cls: 'amphibian' });
    expect(r.epoch).toBe(1); expect(r.segments.map(s => s.epoch)).toEqual([0, 1]);
    const w = focusTime([r]); expect(w.from).toBeGreaterThan(380e6); expect(w.to).toBeLessThan(350e6);
    endLineage(r, 340e6, 'Ende'); expect(readLineage(a).runs).toHaveLength(1);
  });
  it('verwirft beschädigte Zeitreihen und ungültige Markierungen, ohne das übrige Archiv zu verlieren', () => {
    const a = newLineage(); recordBirth(a, 1, 0, 380e6, 1, site, form);
    recordBirth(a, 2, 0, 380e6, 1, site, form).segments[0].to = Infinity;
    a.marked = '2/s1'; expect(readLineage(a).runs.map(r => r.id)).toEqual([1]);
    expect(readLineage(a).marked).toBeUndefined(); expect(readLineage(null)).toEqual(newLineage());
    expect(ZERO_TRAITS).toHaveProperty('jaw');
  });
});
