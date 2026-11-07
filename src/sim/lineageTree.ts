import { lineageForm, newLineageEvolution, readLineageEvolution, type LineageEvolution } from './lineageEvolution';

export interface EvolutionRoute {
  id: string;
  name: string;
  evolutionTrace: readonly LineageEvolution[];
  extinct?: boolean;
  archived?: boolean;
}
export interface EvolutionNode {
  id: string;
  form: ReturnType<typeof lineageForm>;
  evolution: LineageEvolution;
  x: number;
  y: number;
  depth: number;
  routes: string[];
  endpoints: string[];
  possible: boolean;
}
export interface EvolutionEdge { from: string; to: string; routes: string[]; possible: boolean }

/** Progress through a nursery belongs to ancestry even while its silhouette is still transitional. */
export function evolutionNodeKey(value: LineageEvolution): string {
  const state = readLineageEvolution(value);
  if (state.habitat) return lineageForm(state);
  if (!state.habitatProgress) return 'transition';
  return `${state.habitatProgress < 0 ? 'water' : 'shore'}-nursery-${Math.abs(state.habitatProgress)}`;
}

/** The subdued map of available paths. Observed routes below never manufacture unplayed ancestors. */
function possibilities(): { nodes: EvolutionNode[]; edges: EvolutionEdge[] } {
  const nodes: EvolutionNode[] = [];
  const edges: EvolutionEdge[] = [];
  const add = (id: string, state: LineageEvolution, x: number, y: number, depth: number) => {
    nodes.push({ id, form: lineageForm(state), evolution: state, x, y, depth, routes: [], endpoints: [], possible: true });
  };
  const edge = (from: string, to: string) => edges.push({ from, to, routes: [], possible: true });
  add('transition', newLineageEvolution(), 435, 438, 0);
  for (const habitat of ['water', 'shore'] as const) {
    const sign = habitat === 'water' ? -1 : 1;
    const centre = habitat === 'water' ? 220 : 650;
    let parent = 'transition';
    for (const progress of [1, 2]) {
      const state = { ...newLineageEvolution(), habitatProgress: sign * progress, births: progress };
      const id = `${habitat}-nursery-${progress}`;
      add(id, state, centre + (habitat === 'water' ? 1 : -1) * (progress === 1 ? 100 : 35), progress === 1 ? 378 : 322, progress);
      edge(parent, id); parent = id;
    }
    const base = { ...newLineageEvolution(), habitatProgress: sign * 3, habitat, births: 3 };
    add(habitat, base, centre, 248, 3); edge(parent, habitat);
    for (const primary of ['bite', 'skull'] as const) {
      const x = centre + (primary === 'bite' ? -96 : 96);
      for (const tier of [1, 2] as const) {
        const state: LineageEvolution = { ...base, primary, tier, births: 3 + tier,
          bite: primary === 'bite' ? (tier === 1 ? 4 : 12) : 0,
          skull: primary === 'skull' ? (tier === 1 ? 4 : 12) : 0,
          specialization: tier === 2 ? 4 : 0 };
        const id = `${habitat}-${primary}-${tier}`;
        add(id, state, x, tier === 1 ? 156 : 48, 3 + tier);
        edge(tier === 1 ? habitat : `${habitat}-${primary}-1`, id);
      }
    }
  }
  return { nodes, edges };
}

/** A small form tree shared by both players, with exact observed transitions overlaid on faint alternatives. */
export function lineageTree(routes: readonly EvolutionRoute[]) {
  const { nodes, edges } = possibilities();
  const byId = new Map(nodes.map(node => [node.id, node]));
  const byEdge = new Map(edges.map(edge => [`${edge.from}>${edge.to}`, edge]));
  for (const route of routes) {
    let previous: string | undefined;
    const trace = route.evolutionTrace.slice(0, 24);
    for (const [index, value] of trace.entries()) {
      const state = readLineageEvolution(value), id = evolutionNodeKey(state), node = byId.get(id);
      if (!node) continue;
      if (node.possible) node.evolution = state;
      node.possible = false;
      if (!node.routes.includes(route.id)) node.routes.push(route.id);
      if (index === trace.length - 1 && !node.endpoints.includes(route.id)) node.endpoints.push(route.id);
      if (previous && previous !== id) {
        const key = `${previous}>${id}`;
        let edge = byEdge.get(key);
        if (!edge) { edge = { from: previous, to: id, routes: [], possible: false }; edges.push(edge); byEdge.set(key, edge); }
        edge.possible = false;
        if (!edge.routes.includes(route.id)) edge.routes.push(route.id);
      }
      previous = id;
    }
  }
  return { nodes, edges, width: 870, height: 478 };
}
