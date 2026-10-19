import { afterEach, describe, expect, it } from 'vitest';
import { SPAWN } from '../src/data/life';
import { SPECIES } from '../src/data/species';
import { ANIMALS, changedCount, exportTuning, GROUPS, importTuning, isChanged, resetAll, setParam, SPECIES_ROWS } from '../src/data/tuning';
import { meatOf } from '../src/state/GameState';

// Die Entwickler-Einstellung: Jeder Wert lässt sich ändern, zurücksetzen und weitergeben.
describe('Entwickler-Einstellung', () => {
  afterEach(() => resetAll());
  const param = (id: string) => [...GROUPS.flatMap((g) => g.params), ...SPECIES_ROWS.flatMap((r) => r.params)].find((p) => p.id === id)!;

  it('ändert die Werte selbst – und auf den Standard zurück', () => {
    const p = param('SPAWN.perYoung');
    expect(p.def()).toBe(100);
    setParam(p, 140);
    expect(SPAWN.perYoung).toBe(140);
    expect(isChanged(p)).toBe(true);
    expect(changedCount()).toBe(1);
    // genau der Standard: keine Änderung mehr
    setParam(p, 100);
    expect(isChanged(p)).toBe(false);
    setParam(p, 90);
    resetAll();
    expect(SPAWN.perYoung).toBe(100);
    expect(changedCount()).toBe(0);
  });

  it('jede Art: Nahrung ohne eigenen Wert nach der Lebenskraft, die Faktoren für alle Tiere obendrauf', () => {
    const row = SPECIES_ROWS.find((r) => r.id === 'kieferlos')!;
    const [food, hp] = row.params;
    const hp0 = SPECIES.kieferlos.hp;
    expect(food.get()).toBeCloseTo(meatOf(hp0), 1);
    setParam(food, 3);
    expect(SPECIES.kieferlos.food).toBe(3);
    setParam(hp, hp0 * 2);
    expect(SPECIES.kieferlos.hp).toBe(hp0 * 2);
    setParam(param('ANIMALS.hp'), 1.5);
    expect(ANIMALS.hp).toBe(1.5);
    expect(SPECIES.kieferlos.hp).toBe(Math.round(hp0 * 3));
    resetAll();
    expect(SPECIES.kieferlos.hp).toBe(hp0);
    expect(SPECIES.kieferlos.food).toBeUndefined();
  });

  it('lässt sich weitergeben: Exportieren und Importieren', () => {
    setParam(param('FOOD.meatPerHp'), 0.8);
    setParam(param('SPAWN.alwaysMale'), 0);
    expect(SPAWN.alwaysMale).toBe(false);
    const text = exportTuning();
    resetAll();
    expect(SPAWN.alwaysMale).toBe(true);
    expect(importTuning(text)).toBe(2);
    expect(SPAWN.alwaysMale).toBe(false);
    expect(importTuning('kein JSON')).toBe(-1);
    // unbekannte Schlüssel und Unsinn werden übergangen
    expect(importTuning(JSON.stringify({ 'SPAWN.perYoung': 120, 'gibt.es.nicht': 3, 'LIFE.mature': 'x' }))).toBe(1);
    expect(SPAWN.perYoung).toBe(120);
  });
});
