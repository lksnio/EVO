import { EPOCHS } from '../data/epochs';
import { SPECIES } from '../data/species';
import { placesOf } from '../data/world';
import type { FishBranch } from '../sim/fishTree';
import type { LineageSegment } from '../sim/lineage';

// Translate system text stored by older versions at display time. Save keys and player names stay intact.
const OLD_CAUSES: Record<string, string> = {
  Unbekannt: 'Unknown', unbekannt: 'unknown', Verschollen: 'Lost', Gefressen: 'Eaten',
  Altersschwäche: 'Old age', Aufgegeben: 'Gave up', Ausgetrocknet: 'Dried out',
  'Beim Zusammenstoß verletzt': 'Injured in a collision',
  'Zu wenige Artgenossen': 'Too few of your species remain', 'Kein Laich mehr': 'No eggs left',
  'Lebensende – an die Nachkommen weitergegeben': 'Life ended — passed on to your offspring',
  'Das Leben weitergeben': 'Pass on life', Druckwelle: 'Shockwave', Feuerregen: 'Fire rain',
  Steinschlag: 'Rockfall', 'Glühende Felsen': 'Scorching rocks', Dornen: 'Thorns',
  'Sturz in die Tiefe': 'Fell into the depths',
};
const OLD_SPECIES: Record<string, string> = {
  'Kieferloser Fisch': 'kieferlos', Trilobit: 'trilobit', Qualle: 'qualle',
  Riesenkopffüßer: 'cameroceras', Seeskorpion: 'seeskorpion',
  Tausendfüßer: 'tausendfuss', Urinsekt: 'urinsekt', Ammonit: 'ammonit',
};

export function historyCause(value: string) {
  if (Object.hasOwn(OLD_CAUSES, value)) return OLD_CAUSES[value];
  return Object.hasOwn(OLD_SPECIES, value) ? SPECIES[OLD_SPECIES[value]]?.name ?? value : value;
}

export function historySiteName(segment: LineageSegment) {
  if (segment.site.key.endsWith(':unknown')) return 'Spawning site not recorded';
  const ep = EPOCHS[segment.epoch];
  const place = ep && placesOf(ep).find(p => p.id === segment.site.place);
  return place?.name ?? segment.site.name;
}

export function historyBranchName(branch: FishBranch) {
  return /^(local|past)-/.test(branch.id) && branch.name === 'Deine Linie' ? 'Your lineage' : branch.name;
}
