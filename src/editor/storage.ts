import { mapKey, parseWorldMap, type WorldMap } from './document';
const prefix = 'evo.world-editor.v1.';
export function saveDraft(map: WorldMap) { localStorage.setItem(prefix + mapKey(map.epoch, map.place), JSON.stringify(map)); }
export function readDraft(epoch: string, place: string): WorldMap | undefined {
  const raw = localStorage.getItem(prefix + mapKey(epoch, place));
  if (raw === null) return undefined;
  return parseWorldMap(JSON.parse(raw));
}
export function exportMap(map: WorldMap) {
  const blob = new Blob([JSON.stringify(parseWorldMap(map), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${map.epoch}--${map.place}.evo-map.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function saveProject(map: WorldMap) {
  const response = await fetch('/__evo/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(map) });
  if (!response.ok) {
    let message = 'Saving to the project is only available with npm run dev. Otherwise, export the map as a file.';
    try { message = (await response.json()).error || message; } catch { /* static hosting has no save endpoint */ }
    throw Error(message);
  }
}
