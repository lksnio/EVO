import Phaser from 'phaser';
import { EPOCHS, firstPlayable, type EpochDef } from '../data/epochs';
import { placesOf, type PlaceDef } from '../data/world';
import { audio } from '../audio/Audio';
import { assetCatalog, type MapAsset } from '../editor/catalog';
import { cloneMap, MAP_LAYERS, newMapId, objectSolids, parseWorldMap, rebuildGround, type MapLayer, type WorldMap } from '../editor/document';
import { items, moveItem, deleteItems, duplicateObjects, type EditorItem } from '../editor/model';
import { createMap, groundObject } from '../editor/seed';
import { readDraft, saveDraft, saveProject, exportMap } from '../editor/storage';
import { MapHistory } from '../editor/history';
import { MapView } from '../editor/MapView';
import { publishedMap } from '../level/loadLevel';
import { groundCurve } from '../level/terrain';
import { LAYER_NAMES } from '../objects/MapScenery';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import '../editor/editor.css';
import { CAMERA } from '../config';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;
};
type Drag = { mode: 'move' | 'pan' | 'scale' | 'rotate' | 'ground'; x: number; y: number; screenX: number; screenY: number;
  before: WorldMap; originals: EditorItem[]; scrollX: number; scrollY: number; changed: boolean; angle: number; distance: number };

export class WorldEditorScene extends Phaser.Scene {
  map!: WorldMap;
  private ep!: EpochDef;
  private place!: PlaceDef;
  private view?: MapView;
  private root!: HTMLDivElement;
  private palette!: HTMLElement;
  private inspector!: HTMLElement;
  private status!: HTMLElement;
  private footer!: HTMLElement;
  private epochSelect!: HTMLSelectElement;
  private placeSelect!: HTMLSelectElement;
  private undoButton!: HTMLButtonElement;
  private redoButton!: HTMLButtonElement;
  private previewButton!: HTMLButtonElement;
  private overlay!: Phaser.GameObjects.Graphics;
  private history = new MapHistory();
  private selected = new Set<string>();
  private hidden = new Set<MapLayer>();
  private catalog: MapAsset[] = [];
  private thumbs = new Map<string, string>();
  private search = '';
  private tool: 'select' | 'ground' | 'solid' | 'cover' | 'crevice' | 'plant' | 'animal' | 'roe' | 'start' | 'chasm' = 'select';
  private snap = true;
  private regions = true;
  private grid = false;
  private drag?: Drag;
  private keys = new Set<string>();
  private preview = false;
  private tester?: Phaser.GameObjects.Rectangle;
  private fish?: CreatureView;
  private testSolids?: Phaser.Physics.Arcade.StaticGroup;
  private testCollider?: Phaser.Physics.Arcade.Collider;
  private restoreCamera?: { x: number; y: number; zoom: number };
  private lastPaint = 0;
  private initialLoadError = '';

  constructor() { super('WorldEditor'); }
  create() {
    audio.music(null);
    this.preview = false; this.keys.clear(); this.selected.clear(); this.hidden.clear(); this.history = new MapHistory();
    this.overlay = this.add.graphics().setDepth(100);
    this.buildUI();
    const q = new URLSearchParams(location.search), requested = q.get('editor')?.split(':');
    const epoch = EPOCHS.find(e => e.id === requested?.[0]) ?? EPOCHS[firstPlayable()];
    const place = placesOf(epoch).find(p => p.id === requested?.[1]) ?? placesOf(epoch)[epoch.painted ? 1 : 0];
    this.openMap(epoch, place);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _g: unknown, _x: number, dy: number) => {
      if (this.preview || this.overUI(p.event as unknown as Event)) return;
      const cam = this.cameras.main, a = cam.getWorldPoint(p.x, p.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? .88 : 1.14), .15, 2)); cam.preRender();
      const b = cam.getWorldPoint(p.x, p.y); cam.scrollX += a.x - b.x; cam.scrollY += a.y - b.y;
    });
    const keyDown = (e: KeyboardEvent) => this.onKey(e);
    const keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => { this.keys.clear(); if (this.drag) this.pointerUp(); };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
    const dragOver = (e: DragEvent) => { e.preventDefault(); };
    const drop = (e: DragEvent) => {
      e.preventDefault(); const key = e.dataTransfer?.getData('application/x-evo-asset'); if (!key || this.preview) return;
      const bounds = this.game.canvas.getBoundingClientRect();
      const p = this.cameras.main.getWorldPoint((e.clientX - bounds.left) / bounds.width * 1280, (e.clientY - bounds.top) / bounds.height * 720);
      this.addAsset(key, p.x, p.y);
    };
    this.game.canvas.addEventListener('dragover', dragOver); this.game.canvas.addEventListener('drop', drop);
    this.events.once('shutdown', () => {
      this.persist(); this.stopTest(); this.view?.destroy(); this.view = undefined; this.root.remove(); this.thumbs.clear();
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
      this.game.canvas.removeEventListener('dragover', dragOver); this.game.canvas.removeEventListener('drop', drop);
    });
  }
  private overUI(e?: Event) { return e?.target instanceof Element && !!e.target.closest('.evo-editor'); }
  private say(message: string, error = false) { this.status.textContent = message; this.status.classList.toggle('error', error); }
  private button(parent: HTMLElement, text: string, action: () => void, className = '') {
    const b = el('button', text); b.type = 'button'; b.className = className; b.onclick = action; parent.append(b); return b;
  }
  private buildUI() {
    this.root = el('div'); this.root.className = 'evo-editor'; this.root.setAttribute('aria-label', 'World Editor');
    this.root.addEventListener('keydown', e => { this.onKey(e); e.stopPropagation(); });
    this.root.addEventListener('keyup', e => { this.keys.delete(e.code); e.stopPropagation(); });
    this.root.addEventListener('keypress', e => e.stopPropagation());
    const bar = el('header'); bar.append(el('h1', 'WORLD EDITOR')); this.root.append(bar);
    this.epochSelect = el('select'); this.epochSelect.setAttribute('aria-label', 'Era');
    for (const ep of EPOCHS.filter(e => !e.hidden)) { const o = el('option', ep.name); o.value = ep.id; this.epochSelect.append(o); }
    this.placeSelect = el('select'); this.placeSelect.setAttribute('aria-label', 'Location');
    this.epochSelect.onchange = () => { this.persist(); const ep = EPOCHS.find(e => e.id === this.epochSelect.value)!; this.openMap(ep, placesOf(ep)[0]); };
    this.placeSelect.onchange = () => { this.persist(); this.openMap(this.ep, placesOf(this.ep).find(p => p.id === this.placeSelect.value)!); };
    bar.append(this.epochSelect, this.placeSelect);
    this.undoButton = this.button(bar, '↶', () => this.undo(), 'edit-only'); this.undoButton.title = 'Undo · Ctrl+Z';
    this.redoButton = this.button(bar, '↷', () => this.redo(), 'edit-only'); this.redoButton.title = 'Redo · Ctrl+Shift+Z';
    this.previewButton = this.button(bar, 'Walkthrough', () => this.togglePreview(), 'primary');
    this.button(bar, 'Export file', () => { try { exportMap(this.map); this.say('Map file exported.'); } catch (e) { this.error(e); } });
    const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.className = 'hidden';
    file.onchange = async () => { try {
      const f = file.files?.[0]; if (!f) return; if (f.size > 4 * 1024 * 1024) throw Error('The map file is too large (maximum 4 MB).');
      const map = parseWorldMap(JSON.parse(await f.text())); this.persist(); this.openMap(EPOCHS.find(e => e.id === map.epoch)!, placesOf(map.epoch).find(p => p.id === map.place)!, map); this.persist(); this.say('Map file imported and saved as a draft.');
    } catch (e) { this.error(e); } finally { file.value = ''; } };
    bar.append(file); this.button(bar, 'Open file', () => file.click(), 'edit-only');
    this.button(bar, 'Save to project', async () => { try { this.persist(); this.say('Saving map to the project …'); await saveProject(this.map); this.say('Saved to project · the main game will load this map.'); } catch (e) { this.error(e); } }, 'edit-only');
    this.status = el('span'); this.status.className = 'status grow'; this.status.setAttribute('role', 'status'); bar.append(this.status);
    this.button(bar, 'Menu', () => { if (this.preview) this.togglePreview(); this.persist(); const q = new URLSearchParams(location.search); q.delete('editor'); history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '')); this.scene.start('Title'); });
    this.palette = el('aside'); this.palette.className = 'palette'; this.root.append(this.palette);
    this.inspector = el('aside'); this.inspector.className = 'inspector'; this.root.append(this.inspector);
    this.footer = el('footer'); this.root.append(this.footer); document.body.append(this.root);
  }
  private error(e: unknown) { this.say(e instanceof Error ? e.message : String(e), true); }
  private openMap(ep: EpochDef, place: PlaceDef, imported?: WorldMap) {
    if (this.preview) this.togglePreview();
    this.ep = ep; this.place = place; this.initialLoadError = '';
    let draft: WorldMap | undefined;
    try { draft = imported ?? readDraft(ep.id, place.id); } catch (e) { this.initialLoadError = 'Could not load the draft. The template is still available. ' + (e instanceof Error ? e.message : ''); }
    this.map = draft ?? publishedMap(ep.id, place.id) ?? createMap(this, ep, place);
    this.selected.clear(); this.history = new MapHistory();
    this.catalog = assetCatalog(this, ep.theme); this.thumbs.clear();
    this.epochSelect.value = ep.id; this.placeSelect.replaceChildren();
    for (const p of placesOf(ep)) { const option = el('option', p.name); option.value = p.id; this.placeSelect.append(option); }
    this.placeSelect.value = place.id;
    const q = new URLSearchParams(location.search); q.set('editor', ep.id + ':' + place.id); q.delete('gallery'); history.replaceState(null, '', location.pathname + '?' + q);
    this.rebuild();
    const cam = this.cameras.main, L = this.map.layout;
    cam.setBounds(-800, -1200, L.width + 1600, L.height + 2400).setZoom(.65);
    const x = L.crevices[0]?.x ?? L.start.x + 400;
    cam.centerOn(x, groundCurve(L.terrain.hp, x) - 260);
    this.renderPalette(); this.renderInspector();
    this.say(this.initialLoadError || (draft ? 'Browser draft loaded · changes are saved automatically.' : publishedMap(ep.id, place.id) ? 'Project map loaded.' : 'Template loaded · build your own location from it.'), !!this.initialLoadError);
  }
  private rebuild() { this.view?.destroy(); this.view = new MapView(this, this.map, this.ep, this.place); }
  private persist() {
    if (!this.map) return;
    try { saveDraft(this.map); } catch { this.say('Could not save the browser draft. Please export it as a file.', true); }
  }
  private changed(rebuild = true) {
    this.persist(); if (rebuild) this.rebuild(); this.renderInspector();
    this.say('Draft saved in this browser · save to the project to use it in the main game.');
  }
  private edit(action: () => void, rebuild = true) { this.history.checkpoint(this.map); action(); this.changed(rebuild); }
  private restore(map: WorldMap) {
    this.map = map;
    this.selected = new Set([...this.selected].filter(key => map.objects.some(o => key === 'obj:' + o.id)));
    this.changed();
  }
  private undo() { const map = this.history.undo(this.map); if (map) this.restore(map); }
  private redo() { const map = this.history.redo(this.map); if (map) this.restore(map); }
  private thumbnail(key: string) {
    const hit = this.thumbs.get(key); if (hit) return hit;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 90; const ctx = cv.getContext('2d')!;
    const k = Math.min(96 / src.width, 86 / src.height); ctx.drawImage(src, (100 - src.width * k) / 2, (90 - src.height * k) / 2, src.width * k, src.height * k);
    const url = cv.toDataURL(); this.thumbs.set(key, url); return url;
  }
  private renderPalette() {
    this.palette.replaceChildren(el('h2', 'ASSETS'));
    const search = el('input'); search.type = 'search'; search.placeholder = 'Search components …'; search.value = this.search;
    const listing = el('div'); search.oninput = () => { this.search = search.value; this.fillAssets(listing); };
    this.palette.append(search, listing); this.fillAssets(listing);
    this.palette.append(el('h3', 'Terrain & gameplay areas'));
    const tools = el('div'); tools.className = 'grid';
    for (const [key, label] of Object.entries({ select: 'Select', ground: 'Sculpt ground', solid: 'Collision', cover: 'Cover', crevice: 'Rock crevice', plant: 'Food plant', animal: 'Animal', roe: 'Eggs', start: 'Start point', chasm: 'Deep-water entrance' })) {
      if (key === 'chasm' && !this.place.descent) continue;
      this.button(tools, label, () => { this.tool = key as typeof this.tool; this.renderPalette(); this.say(label + ' · click on the map.' ); }, this.tool === key ? 'active' : '');
    }
    this.palette.append(tools, el('p', 'Drag components into the scene or click them. Shift selects multiple items. Combine small pieces freely.'));
    this.button(this.palette, 'Clear vegetation', () => this.edit(() => { this.map.objects = []; this.selected.clear(); }));
  }
  private fillAssets(container: HTMLElement) {
    container.replaceChildren(); const categories = new Map<string, HTMLElement>();
    for (const asset of this.catalog.filter(a => (a.name + a.key).toLowerCase().includes(this.search.toLowerCase()))) {
      let group = categories.get(asset.category);
      if (!group) { container.append(el('h3', asset.category)); group = el('div'); group.className = 'grid'; categories.set(asset.category, group); container.append(group); }
      const b = this.button(group, '', () => this.addAsset(asset.key)); b.className = 'asset'; b.draggable = true; b.dataset.asset = asset.key; b.title = asset.name;
      const img = el('img'); img.src = this.thumbnail(asset.key); img.alt = ''; b.append(img, el('span', asset.name));
      b.ondragstart = e => { e.dataTransfer?.setData('application/x-evo-asset', asset.key); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'; };
    }
  }
  private addAsset(key: string, x = this.cameras.main.midPoint.x, y?: number) {
    const a = this.catalog.find(a => a.key === key); if (!a) return;
    const src = this.textures.get(key).getSourceImage(), floor = groundCurve(this.map.layout.terrain.hp, x);
    this.edit(() => {
      const id = newMapId();
      this.map.objects.push({ id, asset: key, x: this.snapped(x), y: y === undefined ? 5 : this.snapped(y - floor), width: a.height * src.width / src.height, height: a.height, angle: 0, flipX: false, layer: 'back', alpha: 1, grounded: true });
      if (/reef_(unit_(stone|pebble|ledge)|roof|support_)/.test(key)) this.map.objects.at(-1)!.solid = true;
      if (/ribbon|fan|shoot|kelp|seaweed|grass|fern|reed|horsetail/.test(key)) this.map.objects.at(-1)!.sway = 1;
      this.selected = new Set(['obj:' + id]); this.tool = 'select';
    });
    this.renderPalette();
  }
  private check(parent: HTMLElement, name: string, value: boolean, change: (v: boolean) => void) {
    const label = el('label'); label.className = 'check'; const input = el('input'); input.type = 'checkbox'; input.checked = value; input.onchange = () => change(input.checked); label.append(input, document.createTextNode(name)); parent.append(label); return input;
  }
  private field(parent: HTMLElement, name: string, value: number, change: (v: number) => void, min = -100000, max = 100000) {
    const label = el('label', name), input = el('input'); input.type = 'number'; input.value = String(Math.round(value * 100) / 100); input.min = String(min); input.max = String(max); input.step = '1';
    input.onchange = () => { const v = Number(input.value); if (Number.isFinite(v) && v >= min && v <= max) change(v); else { input.value = String(value); this.say('This value is outside the allowed range.', true); } };
    label.append(input); parent.append(label); return input;
  }
  private renderInspector() {
    this.inspector.replaceChildren(el('h2', 'SELECTION'));
    const selected = items(this.map).filter(i => this.selected.has(i.key));
    this.undoButton.disabled = !this.history.canUndo; this.redoButton.disabled = !this.history.canRedo;
    if (selected.length === 1) {
      const i = selected[0], o = i.object;
      this.inspector.append(el('h3', this.catalog.find(a => a.key === o?.asset)?.name ?? i.name));
      const fields = el('div'); fields.className = 'fields'; this.inspector.append(fields);
      this.field(fields, 'X', i.x, v => this.edit(() => moveItem(this.map, i.key, v, o?.grounded ? groundCurve(this.map.layout.terrain.hp, v) + o.y : i.y)));
      if (o?.grounded) this.field(fields, 'Ground offset', o.y, v => this.edit(() => { o.y = v; }));
      else this.field(fields, o ? 'Y · anchor' : 'Y', i.y, v => this.edit(() => moveItem(this.map, i.key, i.x, v)));
      this.field(fields, 'Width', i.width, v => this.edit(() => moveItem(this.map, i.key, i.x, i.y, v, i.height)), 2, 5000);
      this.field(fields, 'Height', i.height, v => this.edit(() => moveItem(this.map, i.key, i.x, i.y, i.width, v)), 2, 5000);
      if (i.key === 'chasm' && this.map.layout.chasm) {
        const ch = this.map.layout.chasm;
        this.field(fields, 'Exit height Y', ch.exitY, v => this.edit(() => { ch.exitY = v; }), ch.rimY + 1, ch.floorY - 1);
        this.inspector.append(el('p', 'Swimming below the exit height in this area leads to the Deep Valley. Use the ground brush to create a clear passage.'));
      }
      if (o) {
        this.field(fields, 'Rotation °', o.angle, v => this.edit(() => { o.angle = v; }), -360, 360);
        this.field(fields, 'Opacity %', o.alpha * 100, v => this.edit(() => { o.alpha = v / 100; }), 0, 100);
        const layer = el('select'); for (const key of MAP_LAYERS) { const option = el('option', LAYER_NAMES[key]); option.value = key; layer.append(option); } layer.value = o.layer;
        layer.onchange = () => this.edit(() => { o.layer = layer.value as MapLayer; }); this.inspector.append(layer);
        this.check(this.inspector, 'Anchor to ground', o.grounded, v => this.edit(() => groundObject(o, this.map, v)));
        this.button(this.inspector, 'Place on ground', () => this.edit(() => { o.grounded = true; o.y = 5; }));
        this.check(this.inspector, 'Flip', o.flipX, v => this.edit(() => { o.flipX = v; }));
        this.check(this.inspector, 'Solid body · collision', o.solid === true, v => this.edit(() => { o.solid = v; }));
        this.check(this.inspector, 'Gentle motion', !!o.sway, v => this.edit(() => { o.sway = v ? 1 : 0; }));
        this.inspector.append(el('p', o.layer === 'frame' ? 'Near scenery has its own parallax and grows from the lower edge of the screen.' : 'Grounded foreground scenery keeps its anchor when the camera moves.'));
      }
      if (i.key.startsWith('animal:') || i.key.startsWith('roe:')) {
        const field = i.key.startsWith('animal:') ? 'spawns' : 'roe', index = Number(i.key.split(':')[1]), select = el('select');
        const ids = new Set([...this.ep.fauna.map(([id]) => id), ...this.ep.passers.map(([id]) => id), ...(field === 'roe' ? ['own'] : [])]);
        for (const id of ids) { const op = el('option', id); op.value = id; select.append(op); }
        const item = this.map.layout[field][index] as unknown as { id?: string; species?: string }; select.value = item.id ?? item.species ?? '';
        select.onchange = () => this.edit(() => { if (field === 'spawns') item.id = select.value; else item.species = select.value; }); this.inspector.append(select);
      }
    } else this.inspector.append(el('p', selected.length ? selected.length + ' components selected.' : 'Click a component. The gold point is its ground anchor; the handles change its size and rotation.'));
    if (selected.length) {
      const row = el('div'); row.className = 'row'; this.inspector.append(row);
      this.button(row, 'Duplicate', () => this.edit(() => { this.selected = new Set(duplicateObjects(this.map, this.selected)); }));
      this.button(row, 'Delete', () => this.remove());
      if (selected.some(i => i.object)) {
        const row = el('div'); row.className = 'row'; this.inspector.append(row);
        this.button(row, 'Group', () => this.edit(() => { const group = newMapId(); for (const i of selected) if (i.object) i.object.group = group; }));
        this.button(row, 'Ungroup', () => this.edit(() => { for (const i of selected) if (i.object) delete i.object.group; }));
      }
    }
    this.inspector.append(el('h3', 'View'));
    this.check(this.inspector, 'Snap to a 10-unit grid', this.snap, v => { this.snap = v; });
    this.check(this.inspector, 'Show grid', this.grid, v => { this.grid = v; });
    this.check(this.inspector, 'Show gameplay areas', this.regions, v => { this.regions = v; });
    const layers = el('div'); layers.className = 'layers'; this.inspector.append(layers);
    for (const key of MAP_LAYERS) this.check(layers, LAYER_NAMES[key], !this.hidden.has(key), v => { if (v) this.hidden.delete(key); else this.hidden.add(key); });
    this.button(this.inspector, 'Whole map', () => { const L = this.map.layout; this.cameras.main.setZoom(Math.max(.15, Math.min(1280 / L.width, 620 / L.height))).centerOn(L.width / 2, L.height / 2); });
    this.inspector.append(el('h3', 'Visible components'));
    const list = el('div'); list.className = 'list'; this.inspector.append(list);
    const v = this.cameras.main.worldView;
    for (const i of items(this.map).filter(i => i.x > v.x - 100 && i.x < v.right + 100).slice(-70)) this.button(list, i.name, () => { this.selected = new Set([i.key]); this.renderInspector(); });
    this.inspector.append(el('p', 'Browser drafts are local. Export a file for a portable copy. Save to project applies the map to the main game in the development environment.'));
  }
  private remove() { if (this.selected.has('start')) this.selected.delete('start'); this.edit(() => { deleteItems(this.map, this.selected); this.selected.clear(); }); }
  private snapped(n: number) { return this.snap ? Math.round(n / 10) * 10 : n; }
  private pick(x: number, y: number) {
    const candidates = items(this.map).filter(i => !i.object || !this.hidden.has(i.object.layer));
    candidates.sort((a, b) => (a.object ? 50 + MAP_LAYERS.indexOf(a.object.layer) : a.key.startsWith('rock:') ? 10 : 30) - (b.object ? 50 + MAP_LAYERS.indexOf(b.object.layer) : b.key.startsWith('rock:') ? 10 : 30));
    return candidates.reverse().find(i => {
      if (i.object) { const a = -i.object.angle * Math.PI / 180, dx = x - i.x, dy = y - i.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(lx) < i.width / 2 && ly < 0 && ly > -i.height; }
      if (!this.regions && !i.key.startsWith('rock:') && !i.key.startsWith('fore:')) return false;
      return x >= i.bounds.x && x <= i.bounds.x + i.bounds.w && y >= i.bounds.y && y <= i.bounds.y + i.bounds.h;
    });
  }
  private pointerDown(p: Phaser.Input.Pointer) {
    if (this.preview || this.overUI(p.event as unknown as Event)) return;
    const cam = this.cameras.main, q = cam.getWorldPoint(p.x, p.y), selected = items(this.map).filter(i => this.selected.has(i.key));
    const pan = p.middleButtonDown() || p.rightButtonDown() || this.keys.has('Space');
    let mode: Drag['mode'] = pan ? 'pan' : this.tool === 'ground' ? 'ground' : 'move';
    if (!pan && selected.length === 1 && selected[0].object) {
      const i = selected[0], a = i.object!.angle * Math.PI / 180;
      const handle = (dx: number, dy: number) => ({ x: i.x + dx * Math.cos(a) - dy * Math.sin(a), y: i.y + dx * Math.sin(a) + dy * Math.cos(a) });
      const corner = handle(i.width / 2, -i.height), turn = handle(0, -i.height - 28 / cam.zoom);
      if (Phaser.Math.Distance.Between(q.x, q.y, corner.x, corner.y) < 12 / cam.zoom) mode = 'scale';
      else if (Phaser.Math.Distance.Between(q.x, q.y, turn.x, turn.y) < 12 / cam.zoom) mode = 'rotate';
    }
    if (!pan && mode === 'move' && this.tool !== 'select') { this.addGameplay(q.x, q.y); return; }
    if (!pan && mode === 'move') {
      const hit = this.pick(q.x, q.y);
      if (hit) {
        if (!this.keys.has('ShiftLeft') && !this.keys.has('ShiftRight') && !this.selected.has(hit.key)) this.selected.clear();
        if (hit.object?.group) { for (const o of this.map.objects) if (o.group === hit.object.group) this.selected.add('obj:' + o.id); }
        this.selected.add(hit.key);
      } else this.selected.clear();
      this.renderInspector();
    }
    const originals = items(this.map).filter(i => this.selected.has(i.key)).map(i => cloneMap(i));
    const i = originals[0];
    this.drag = { mode, x: q.x, y: q.y, screenX: p.x, screenY: p.y, before: cloneMap(this.map), originals,
      scrollX: cam.scrollX, scrollY: cam.scrollY, changed: false, angle: i ? Math.atan2(q.y - i.y, q.x - i.x) : 0, distance: i ? Math.hypot(q.x - i.x, q.y - i.y) : 1 };
    if (mode === 'ground') this.pointerMove(p);
  }
  private pointerMove(p: Phaser.Input.Pointer) {
    const d = this.drag; if (!d) return;
    const cam = this.cameras.main;
    if (d.mode === 'pan') { cam.scrollX = d.scrollX - (p.x - d.screenX) / cam.zoom; cam.scrollY = d.scrollY - (p.y - d.screenY) / cam.zoom; return; }
    const q = cam.getWorldPoint(p.x, p.y);
    if (!d.changed) { if (Math.hypot(q.x - d.x, q.y - d.y) < 1 && d.mode !== 'ground') return; this.history.checkpoint(d.before); d.changed = true; }
    if (d.mode === 'ground') {
      const hp = this.map.layout.terrain.hp, radius = 100 / cam.zoom;
      for (let j = 0; j < hp.length; j++) { const dx = Math.abs(j * 20 + 10 - q.x); if (dx < radius) hp[j] += (Phaser.Math.Clamp(q.y, -200, this.map.layout.height - 30) - hp[j]) * (1 - dx / radius) * .55; }
    } else if (d.mode === 'move') {
      const dx = this.snapped(q.x - d.x), dy = this.snapped(q.y - d.y);
      for (const i of d.originals) {
        const y = i.object?.grounded ? groundCurve(this.map.layout.terrain.hp, i.x + dx) + i.object.y + dy : i.y + dy;
        moveItem(this.map, i.key, i.x + dx, y);
      }
    } else {
      const i = d.originals[0], o = this.map.objects.find(o => 'obj:' + o.id === i.key)!;
      if (d.mode === 'scale') { const ratio = Math.max(.05, Math.hypot(q.x - i.x, q.y - i.y) / d.distance); o.width = Phaser.Math.Clamp(i.width * ratio, 2, 5000); o.height = Phaser.Math.Clamp(i.height * ratio, 2, 5000); }
      else o.angle = ((i.object!.angle + (Math.atan2(q.y - i.y, q.x - i.x) - d.angle) * 180 / Math.PI + 540) % 360) - 180;
    }
    if ((d.mode === 'ground' || d.originals.some(i => !i.object)) && performance.now() - this.lastPaint > 180) { this.rebuild(); this.lastPaint = performance.now(); }
  }
  private pointerUp() {
    const d = this.drag; this.drag = undefined;
    if (d?.changed) { if (d.mode === 'ground') rebuildGround(this.map.layout); this.changed(); }
  }
  private addGameplay(x: number, y: number) {
    x = this.snapped(x); y = this.snapped(y);
    this.edit(() => {
      const L = this.map.layout;
      if (this.tool === 'start') L.start = { x, y };
      else if (this.tool === 'chasm' && this.place.descent) { L.chasm = { x0: x - 320, x1: x + 320, rimY: y - 900, floorY: y, exitY: y - 250 }; this.selected = new Set(['chasm']); }
      else if (this.tool === 'solid') { (L.editorSolids ??= []).push({ x: x - 60, y: y - 60, w: 120, h: 60 }); L.solids.push(L.editorSolids.at(-1)!); this.selected = new Set(['solid:' + (L.editorSolids.length - 1)]); }
      else if (this.tool === 'cover' || this.tool === 'crevice') { const key = this.tool === 'cover' ? 'cover' : 'crevices'; L[key].push({ x: x - 80, y: y - 90, w: 160, h: 90 }); this.selected = new Set([this.tool + ':' + (L[key].length - 1)]); }
      else if (this.tool === 'plant') { L.plants.push({ x, y, v: 0 }); this.selected = new Set(['plant:' + (L.plants.length - 1)]); }
      else if (this.tool === 'animal') { const id = this.ep.fauna[0]?.[0]; if (id) { L.spawns.push({ x, y, id }); this.selected = new Set(['animal:' + (L.spawns.length - 1)]); } }
      else if (this.tool === 'roe') { L.roe.push({ x, y, species: this.ep.fauna[0]?.[0] ?? 'own', tone: 0, own: false }); this.selected = new Set(['roe:' + (L.roe.length - 1)]); }
      this.tool = 'select';
    }); this.renderPalette();
  }
  private onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); this.persist(); exportMap(this.map); return; }
    if (e.target instanceof Element && e.target.closest('input,select,textarea')) return;
    this.keys.add(e.code);
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') { e.preventDefault(); if (this.preview) this.togglePreview(); else { this.selected.clear(); this.tool = 'select'; this.renderInspector(); this.renderPalette(); } }
    if (this.preview) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); this.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { e.preventDefault(); this.edit(() => { this.selected = new Set(duplicateObjects(this.map, this.selected)); }); }
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); if (this.selected.size) this.remove(); }
  }
  private togglePreview() {
    this.pointerUp(); this.preview = !this.preview; this.root.classList.toggle('preview', this.preview);
    this.keys.clear();
    this.previewButton.textContent = this.preview ? 'Back to editing' : 'Walkthrough';
    if (!this.preview) { this.stopTest(); this.say('Back in the editor · your saved game is unchanged.'); return; }
    this.restoreCamera = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY, zoom: this.cameras.main.zoom };
    const L = this.map.layout, target = items(this.map).find(i => this.selected.has(i.key));
    const x = target?.x ?? this.cameras.main.midPoint.x, y = target ? target.y - 100 : groundCurve(L.terrain.hp, x) - 140;
    this.tester = this.add.rectangle(x, y, 45, 24, 0, 0); this.physics.add.existing(this.tester);
    const b = this.tester.body as Phaser.Physics.Arcade.Body; b.setAllowGravity(false).setDrag(200, 200);
    this.testSolids = this.physics.add.staticGroup();
    for (const r of [...L.groundRects, ...L.solids, ...L.platforms, ...objectSolids(this.map)]) this.testSolids.add(this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setVisible(false));
    this.testCollider = this.physics.add.collider(this.tester, this.testSolids);
    const m: Morph = { cls: L.amphibious || L.mode === 'land' ? 'amphibian' : 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 0, seed: 50, sex: 0 };
    this.fish = new CreatureView(this, x, y, m, .7).setDepth(20); this.fish.setLift(.24);
    // so nah wie im Spiel beim ausgewachsenen Starttier
    this.cameras.main.setZoom(CAMERA.adult).startFollow(this.tester, true, .1, .1);
    this.say('Walkthrough · WASD/arrows to move · Space to accelerate · Esc to return. Your save is unchanged.');
  }
  private stopTest() {
    // Phaser shuts down camera/physics plugins before user shutdown listeners.
    const cam = this.cameras.main;
    cam?.stopFollow(); if (this.testCollider?.world) this.testCollider.destroy(); this.testCollider = undefined;
    if (this.testSolids?.scene) { this.testSolids.clear(true, true); this.testSolids.destroy(); } this.testSolids = undefined;
    this.tester?.destroy(); this.tester = undefined; this.fish?.destroy(); this.fish = undefined;
    if (this.restoreCamera) { const c = this.restoreCamera; cam?.setZoom(c.zoom).setScroll(c.x, c.y); this.restoreCamera = undefined; }
  }
  update(_time: number, dms: number) {
    if (!this.map || !this.view) return;
    const cam = this.cameras.main, dt = Math.min(.05, dms / 1000);
    this.view.update();
    if (this.preview && this.tester && this.fish) {
      const L = this.map.layout, b = this.tester.body as Phaser.Physics.Arcade.Body;
      const dx = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
      const dy = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
      const water = L.mode === 'water' && (!L.amphibious || this.tester.y > L.surfaceY);
      b.setAllowGravity(!water); b.setGravityY(water ? 0 : 700);
      if (water) { const k = dx && dy ? Math.SQRT1_2 : 1, speed = this.keys.has('Space') ? 260 : 150; b.setVelocity(dx * speed * k, dy * speed * k); }
      else { b.setVelocityX(dx * 130); if (dy < 0 && b.blocked.down) b.setVelocityY(-300); }
      this.fish.setPosition(this.tester.x, this.tester.y); if (dx) this.fish.setFacing(dx);
      this.fish.animate(dt, water ? 'swim' : dx ? 'walk' : 'idle', dx || dy ? .65 : 0);
      this.view.scenery.update(this.tester, false, this.hidden);
    } else {
      this.view.scenery.update(undefined, true, this.hidden);
      this.undoButton.disabled = !this.history.canUndo; this.redoButton.disabled = !this.history.canRedo;
    }
    this.drawOverlay();
    this.footer.textContent = this.preview ? 'WALKTHROUGH · same terrain and collisions as the main game · animals and the life cycle begin in the main game.'
      : `Zoom ${Math.round(cam.zoom * 100)} % · ${this.map.objects.length} components · Scroll: zoom · Space + drag / right mouse: pan · Shift: multiselect · Ctrl+Z: undo`;
  }
  private drawOverlay() {
    const g = this.overlay; g.clear(); if (this.preview) return;
    const cam = this.cameras.main, v = cam.worldView, w = 1 / cam.zoom;
    if (this.grid) { g.lineStyle(w, 0x96c4c9, .12); const step = cam.zoom < .4 ? 200 : 50;
      for (let x = Math.floor(v.x / step) * step; x < v.right; x += step) g.lineBetween(x, v.y, x, v.bottom);
      for (let y = Math.floor(v.y / step) * step; y < v.bottom; y += step) g.lineBetween(v.x, y, v.right, y);
    }
    if (this.regions) for (const i of items(this.map)) {
      if (i.object || i.key.startsWith('fore:') || i.key.startsWith('rock:')) continue;
      const color = i.key === 'start' ? 0xffcc76 : i.key.startsWith('solid:') ? 0xf2968b : i.key.startsWith('animal:') ? 0x9fc3f5 : 0x68c8b9;
      g.fillStyle(color, .08).fillRect(i.bounds.x, i.bounds.y, i.bounds.w, i.bounds.h);
      g.lineStyle(w, color, .65).strokeRect(i.bounds.x, i.bounds.y, i.bounds.w, i.bounds.h);
    }
    if (this.regions) { g.lineStyle(w, 0xf2968b, .6); for (const r of objectSolids(this.map)) g.strokeRect(r.x, r.y, r.w, r.h); }
    if (this.tool === 'ground') { const hp = this.map.layout.terrain.hp; g.lineStyle(3 * w, 0x6ce1cd, .9); g.beginPath(); for (let i = 0; i < hp.length; i++) { if (!i) g.moveTo(i * 20 + 10, hp[i]); else g.lineTo(i * 20 + 10, hp[i]); } g.strokePath(); }
    const selected = items(this.map).filter(i => this.selected.has(i.key));
    for (const i of selected) {
      g.lineStyle(2 * w, 0xf5ca82, 1);
      if (i.object) {
        const a = i.object.angle * Math.PI / 180, at = (x: number, y: number) => [i.x + x * Math.cos(a) - y * Math.sin(a), i.y + x * Math.sin(a) + y * Math.cos(a)] as const;
        const corners = [at(-i.width / 2, 0), at(-i.width / 2, -i.height), at(i.width / 2, -i.height), at(i.width / 2, 0)];
        g.beginPath(); corners.forEach(([x, y], n) => n ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.strokePath();
        if (selected.length === 1) { const c = corners[2], t = at(0, -i.height - 28 * w), b = at(0, -i.height); g.lineBetween(b[0], b[1], t[0], t[1]); g.fillStyle(0xf5ca82).fillRect(c[0] - 5 * w, c[1] - 5 * w, 10 * w, 10 * w).fillCircle(t[0], t[1], 5 * w); }
      } else g.strokeRect(i.bounds.x, i.bounds.y, i.bounds.w, i.bounds.h);
      g.fillStyle(0xf5ca82).fillCircle(i.x, i.y, 4 * w);
    }
  }
}
