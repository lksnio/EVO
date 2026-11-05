import Phaser from 'phaser';
import { placeBound, protectedKey, stemsOf } from './texRules';

// ---------------------------------------------------------------------------
// Grafikspeicher im Griff: Fast alle Bilder des Spiels werden zur Laufzeit gemalt (Canvas) und bleiben danach als Textur
// liegen. Damit der Speicher über viele Orte und Zeitalter nicht immer weiter wächst, bekommt jedes gemalte Bild einen
// Besitzer: das Zeitalter, in dem es entstand – oder, bei großen ortsgebundenen Bildern (Hintergründe, trübes Wasser,
// Schluchtschatten), den Ort. Beim Betreten eines Ortes wird freigegeben:
//   – alles aus anderen Zeitaltern,
//   – ortsgebundene Bilder von Orten, die länger zurückliegen als die letzten KEEP_PLACES (wer hin- und herschwimmt,
//     findet sie noch vor).
// Nie freigegeben wird, was gerade irgendwo zu sehen ist oder in einer laufenden Animation steckt (samt seiner
// Geschwisterbilder mit demselben Namensstamm, z. B. allen Bewegungsphasen und Teilen einer Art), was schon vor dem ersten Ort da war (Titelbild,
// Grundausstattung) und geladene Bilddateien (sie ließen sich nicht neu malen). Freigegebenes wird bei Bedarf einfach neu
// gemalt – die Maler prüfen, ob es ihr Bild schon gibt.
//
// Im Koop gilt das je Rechner: Jeder zeichnet nur den Ort seines eigenen Tiers und gibt nur seine eigenen Bilder frei.
// ---------------------------------------------------------------------------

/** so viele zuletzt besuchte Orte behalten ihre ortsgebundenen Bilder */
export const KEEP_PLACES = 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

interface Scope { epoch: string; place: string }

const owner = new Map<string, Scope>();
let baseline: Set<string> | undefined;
let current: Scope | undefined;
/** die zuletzt besuchten Orte als „Zeitalter/Ort“, der jüngste zuletzt */
const recent: string[] = [];

const placeOf = (s: Scope) => `${s.epoch}/${s.place}`;


/** Ein Bild, das wir selbst gemalt haben (und notfalls neu malen können) – keine geladene Datei, kein Schriftbild. */
function generated(tm: Phaser.Textures.TextureManager, key: string) {
  if (key.startsWith('__') || UUID.test(key)) return false;
  const t = tm.get(key);
  return t instanceof Phaser.Textures.CanvasTexture || (t.source[0]?.image instanceof HTMLCanvasElement && !(t instanceof Phaser.Textures.DynamicTexture));
}

/** Neue, noch herrenlose Bilder dem Ort bzw. Zeitalter zuordnen, in dem sie entstanden sind. */
function adopt(tm: Phaser.Textures.TextureManager, scope: Scope) {
  for (const key of tm.getTextureKeys()) {
    if (owner.has(key) || baseline?.has(key)) continue;
    owner.set(key, scope);
  }
  for (const key of [...owner.keys()]) if (!tm.exists(key)) owner.delete(key);
}

/** Ein Ort beginnt (am Anfang von LevelScene.create): Was seit dem letzten Mal neu ist, gehört noch zum vorigen Ort. */
export function enterPlace(scene: Phaser.Scene, epoch: string, place: string) {
  const tm = scene.textures;
  if (!baseline) baseline = new Set(tm.getTextureKeys());
  if (current) adopt(tm, current);
  current = { epoch, place };
  const id = placeOf(current), at = recent.indexOf(id);
  if (at >= 0) recent.splice(at, 1);
  recent.push(id);
  while (recent.length > 16) recent.shift();
}

/** Was gerade irgendwo zu sehen ist oder in einer laufenden Animation steckt – samt Geschwisterbildern. */
function inUse(game: Phaser.Game) {
  const keys = new Set<string>();
  const visit = (o: Phaser.GameObjects.GameObject) => {
    const g = o as Phaser.GameObjects.GameObject & {
      texture?: Phaser.Textures.Texture; list?: Phaser.GameObjects.GameObject[];
      anims?: { currentAnim?: { frames: { textureKey: string }[] } | null };
    };
    if (g.texture?.key) keys.add(g.texture.key);
    for (const f of g.anims?.currentAnim?.frames ?? []) keys.add(f.textureKey);
    if (Array.isArray(g.list)) for (const c of g.list) visit(c);
  };
  for (const s of game.scene.scenes) {
    const list = s.sys?.displayList?.list;
    if (list) for (const o of list) visit(o);
  }
  // Geschwisterbilder: alles, was mit demselben Stamm beginnt („wf_moythomasia_fb“ schützt auch „…_fe“, „…_fj“ usw.) –
  // manche Ansichten wechseln ihre Bilder erst später (Bewegungsphasen, Licht, Kiefer)
  return { keys, stems: stemsOf(keys) };
}

/**
 * Nach dem Aufbau eines Ortes (am Ende von LevelScene.create): neue Bilder diesem Ort zuordnen und freigeben, was nicht mehr
 * gebraucht wird. keep: Stichworte des jetzigen Ortes (z. B. seine Stimmung) – ortsgebundene Bilder mit „_stichwort“ im
 * Namen bleiben, auch wenn ein anderer Ort sie gemalt hat. Gibt die Zahl freigegebener Bilder zurück.
 */
export function settle(scene: Phaser.Scene, keep: string[] = []) {
  // zum Vergleichen: ?keeptex gibt nichts frei
  if (!current || new URLSearchParams(globalThis.location?.search ?? '').has('keeptex')) return 0;
  const tm = scene.textures;
  adopt(tm, current);
  const kept = new Set(recent.slice(-KEEP_PLACES));
  const used = inUse(scene.game);
  const gone = new Set<string>(), staleAnims = new Set<string>();
  for (const [key, s] of owner) {
    if (!tm.exists(key) || !generated(tm, key)) continue;
    if (protectedKey(key, used)) continue;
    const otherEpoch = s.epoch !== current.epoch;
    const stalePlace = placeBound(key) && !kept.has(placeOf(s)) && !keep.some(k => key.includes('_' + k));
    if (!otherEpoch && !stalePlace) continue;
    // Animationen, die auf das Bild zeigen, gehen mit – sie entstehen neu, wenn das Bild neu gemalt wird
    for (const a of scene.anims.getAnimsFromTexture(key)) staleAnims.add(a);
    tm.remove(key);
    gone.add(key);
    owner.delete(key);
  }
  for (const a of staleAnims) scene.anims.remove(a);
  // für die Fehlersuche in der Entwicklerkonsole
  (globalThis as { __evoTexFreed?: string[] }).__evoTexFreed = [...gone];
  return gone.size;
}

/** Für die Entwickleranzeige: wie viele Bilder es gibt und wie viel Grafikspeicher sie etwa belegen (MB). */
export function textureStats(tm: Phaser.Textures.TextureManager) {
  let px = 0, n = 0;
  for (const key of tm.getTextureKeys()) {
    for (const s of tm.get(key).source) px += (s.width || 0) * (s.height || 0);
    n++;
  }
  return { count: n, mb: (px * 4) / 1048576 };
}

/** Nur für Tests: alles vergessen. */
export function resetTexBudget() {
  owner.clear();
  baseline = undefined;
  current = undefined;
  recent.length = 0;
}
