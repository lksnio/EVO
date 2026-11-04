import { finStage } from './fishEvolution';
/** Gebiss, Flossen, Kopfplatte. Die Reihenfolge ist zugleich die stabile Bildkennung im Netzwerk. */
export const PAINTED_FORMS = [
  [0,0,0], [1,0,0], [2,0,0], [3,0,0], [0,1,0], [0,2,0], [0,3,0], [0,0,1], [0,0,2], [0,0,3],
  [3,1,0], [3,0,1], [1,3,0], [0,3,1], [1,0,3], [0,1,3],
  [1,1,0], [0,1,1], [1,0,1], [1,2,0], [0,2,1], [2,1,0], [2,0,1], [1,0,2], [0,1,2],
] as const;
type StarterState = readonly [number, number, number];
// Keep the first 25 IDs stable for existing saves and network peers.
const forms: StarterState[] = [...PAINTED_FORMS];
for (let g=0;g<=3;g++) for (let f=0;f<=3;f++) for (let k=0;k<=3;k++) {
  if (g>1 && k>1) continue;
  if (!forms.some(s=>s[0]===g && s[1]===f && s[2]===k)) forms.push([g,f,k]);
}
export const STARTER_FORMS: readonly StarterState[] = forms;
export type StarterScores = [number, number, number];
export const starterId = (index: number) => {
  const [g,f,k] = STARTER_FORMS[validStarterForm(index) ? index : 0];
  return `g${g}_f${f}_k${k}`;
};
export const validStarterForm = (index: unknown): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < STARTER_FORMS.length;
export const starterFormIndex = (stages: readonly number[]) => Math.max(0, STARTER_FORMS.findIndex(s => s.every((v,i) => v === stages[i])));
const stageOf = (score: number) => score >= 125 ? 3 : score >= 60 ? 2 : score >= 25 ? 1 : 0;

/** Older saves retain their strongest damage direction; fins are independent. */
export function resolveStarterForm(scores: StarterScores, stored?: number): number {
  if (validStarterForm(stored)) return stored;
  const g=stageOf(scores[0]),k=stageOf(scores[2]);
  const primary=scores[0]>=scores[2]?0:2;
  return starterFormIndex([primary===0?g:Math.min(1,g), finStage(scores[1]), primary===2?k:Math.min(1,k)]);
}

/** Only a birth develops the visible weapons. The first damage direction owns the higher tiers. */
export function advanceStarterFish(start: StarterScores, next: StarterScores, stored?: number, storedPrimary?: number) {
  const stages: number[] = [...STARTER_FORMS[resolveStarterForm(start, stored)]];
  const gains = next.map((v,i)=>v-start[i]);
  let primary = storedPrimary===1?0:storedPrimary===3?2:-1;
  if(primary<0 && (stages[0] || stages[2])) primary=stages[0]>stages[2] || stages[0]===stages[2] && start[0]>=start[2]?0:2;
  if(primary<0) primary=[0,2].filter(i=>start[i]>=20-1e-6 && gains[i]>1e-6).sort((a,b)=>gains[b]-gains[a] || a-b)[0]??-1;
  const scores:StarterScores=[...next];
  const thresholds=[20,50,100],targets=[25,60,125];
  for(const i of [0,2]) {
    let stage=stages[i];
    if(i===primary && stage<3 && start[i]>=thresholds[stage]-1e-6 && gains[i]>1e-6) { scores[i]=targets[stage]; stage++; }
    else if(i!==primary && primary>=0 && stage===0 && start[i]>=20-1e-6 && gains[i]>1e-6) { scores[i]=25;stage=1; }
    stages[i]=stage;
    const floor=stage?targets[stage-1]:10;
    const ceiling=i!==primary && stage?25:stage<3?thresholds[stage]:Infinity;
    scores[i]=Math.max(floor,Math.min(ceiling,scores[i]));
  }
  scores[1]=Math.max(10,Math.min(100,scores[1]));
  stages[1]=Math.max(stages[1],finStage(scores[1]));
  return {scores,form:starterFormIndex(stages),primary:primary+1};
}
