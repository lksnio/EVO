import { cloneMap, type WorldMap } from './document';
/** One snapshot per completed gesture. A bounded history also includes native terrain and gameplay geometry. */
export class MapHistory {
  private past: WorldMap[] = [];
  private future: WorldMap[] = [];
  checkpoint(map: WorldMap) { this.past.push(cloneMap(map)); if (this.past.length > 35) this.past.shift(); this.future = []; }
  undo(current: WorldMap) { const map = this.past.pop(); if (map) this.future.push(cloneMap(current)); return map; }
  redo(current: WorldMap) { const map = this.future.pop(); if (map) this.past.push(cloneMap(current)); return map; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
