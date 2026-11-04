/** Gebiss, Flossen, Kopfplatte. Die Reihenfolge ist zugleich die stabile Bildkennung im Netzwerk. */
export const STARTER_FORMS = [
  [0,0,0], [1,0,0], [2,0,0], [3,0,0], [0,1,0], [0,2,0], [0,3,0], [0,0,1], [0,0,2], [0,0,3],
  [3,1,0], [3,0,1], [1,3,0], [0,3,1], [1,0,3], [0,1,3],
  [1,1,0], [0,1,1], [1,0,1], [1,2,0], [0,2,1], [2,1,0], [2,0,1], [1,0,2], [0,1,2],
] as const;
export type StarterScores = [number, number, number];
export const starterId = (index: number) => {
  const [g,f,k] = STARTER_FORMS[validStarterForm(index) ? index : 0];
  return `g${g}_f${f}_k${k}`;
};
export const validStarterForm = (index: unknown): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < STARTER_FORMS.length;
export const starterFormIndex = (stages: readonly number[]) => Math.max(0, STARTER_FORMS.findIndex(s => s.every((v,i) => v === stages[i])));
const stageOf = (score: number) => score >= 125 ? 3 : score >= 60 ? 2 : score >= 25 ? 1 : 0;

/** Ältere Spielstände: stärkste Richtung plus höchstens ein frühes Nebenmerkmal. Keine Werte verändern. */
export function resolveStarterForm(scores: StarterScores, stored?: number): number {
  if (validStarterForm(stored)) return stored;
  const order = [0,1,2].sort((a,b) => stageOf(scores[b]) - stageOf(scores[a]) || scores[b] - scores[a] || a-b);
  const stages = [0,0,0];
  stages[order[0]] = stageOf(scores[order[0]]);
  if (stages[order[0]] && stageOf(scores[order[1]])) stages[order[1]] = 1;
  return starterFormIndex(stages);
}

/** Nur bei der Geburt: Grenzwert des Elternteils + tatsächlicher Zugewinn → nächste sichtbare Form. */
export function advanceStarterFish(start: StarterScores, next: StarterScores, stored?: number, storedPrimary?: number) {
  const stages: number[] = [...STARTER_FORMS[resolveStarterForm(start, stored)]];
  const gains = next.map((v,i) => v - start[i]);
  const rank = [0,1,2].sort((a,b) => stages[b]-stages[a] || start[b]-start[a] || a-b);
  let primary = storedPrimary && storedPrimary >= 1 && storedPrimary <= 3 && Number.isInteger(storedPrimary) ? storedPrimary - 1 : -1;
  if (primary < 0 && stages.some(Boolean)) primary = rank[0];
  if (primary < 0) primary = [0,1,2].filter(i => start[i] >= 20 - 1e-6 && gains[i] > 1e-6)
    .sort((a,b) => gains[b]-gains[a] || a-b)[0] ?? -1;
  const scores: StarterScores = [...next];
  const thresholds = [20,50,100], targets = [25,60,125];
  if (primary >= 0) {
    const stage = stages[primary];
    if (stage < 3 && start[primary] >= thresholds[stage] - 1e-6 && gains[primary] > 1e-6) {
      scores[primary] = targets[stage];
      stages[primary]++;
    }
    // Genau ein Nebenmerkmal darf früh Stufe 1 erreichen; nur das Primärmerkmal wächst weiter.
    let secondary = rank.find(i => i !== primary && stages[i] > 0);
    if (secondary === undefined && stages[primary] > 0) {
      secondary = [0,1,2].filter(i => i !== primary && start[i] >= 20 - 1e-6 && gains[i] > 1e-6)
        .sort((a,b) => gains[b]-gains[a] || a-b)[0];
      if (secondary !== undefined) { stages[secondary] = 1; scores[secondary] = 25; }
    }
  }
  for (let i=0;i<3;i++) {
    const stage = stages[i];
    const floor = stage ? targets[stage-1] : 1;
    const ceiling = stage < 3 ? thresholds[stage] : Infinity;
    scores[i] = Math.max(floor, Math.min(ceiling, scores[i]));
  }
  return { scores, form: starterFormIndex(stages), primary: primary + 1 };
}
