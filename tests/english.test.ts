import { beforeEach, describe, expect, it } from 'vitest';
import { lengthText } from '../src/data/aquapendium';
import { shortYears, spanWords, yearsAgo } from '../src/data/epochs';
import { game } from '../src/state/GameState';
import { historyBranchName, historyCause, historySiteName } from '../src/ui/historyText';

describe('English game text', () => {
  beforeEach(() => game.resetAll());

  it('formats geological time and animal lengths with English grouping and decimal separators', () => {
    expect(yearsAgo(375995466, 1)).toBe('375,995,466 years ago');
    expect(yearsAgo(0, 1)).toBe('today');
    expect(shortYears(1250000)).toBe('1.3 million yr');
    expect(spanWords(1000000)).toBe('1 million years');
    expect(spanWords(12500)).toBe('12,500 years');
    expect(lengthText(125)).toBe('approx. 1.3 m');
  });

  it('displays old German history in English without modifying saved history or identifiers', () => {
    game.newRun(0);
    const segment = game.data.lineage.runs[0].segments[0];
    segment.site.name = 'Der Laichfluss';
    const before = JSON.stringify(game.data);
    expect(historySiteName(segment)).toBe('The Spawning River');
    expect(historyCause('Altersschwäche')).toBe('Old age');
    expect(historyCause('Qualle')).toBe('Jellyfish');
    expect(JSON.stringify(game.data)).toBe(before);
    expect(historySiteName({ ...segment, site: { ...segment.site, key: 'devon:unknown' } })).toBe('Spawning site not recorded');
    expect(historyCause('Dunkleosteus')).toBe('Dunkleosteus');
    expect(historyCause('constructor')).toBe('constructor');
  });

  it('translates archived default branch labels while preserving names chosen by players', () => {
    const branch = { id: 'past-1-0', name: 'Deine Linie', trace: [] };
    expect(historyBranchName(branch)).toBe('Your lineage');
    expect(historyBranchName({ ...branch, id: 'local-1' })).toBe('Your lineage');
    expect(historyBranchName({ ...branch, id: 'peer-anna' })).toBe('Deine Linie');
    expect(historyBranchName({ ...branch, name: 'Annas Fisch' })).toBe('Annas Fisch');
  });
});
