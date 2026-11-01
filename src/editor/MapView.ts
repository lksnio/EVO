import type Phaser from 'phaser';
import { chasmArt } from '../art/chasmArt';
import { terrainArt } from '../art/terrainArt';
import { paintedRiver, riverCave } from '../art/riverProps';
import { paintedReef, reefRock } from '../art/reefProps';
import { MapScenery } from '../objects/MapScenery';
import { inkBackdrop, moodOf } from '../art/inkWorld';
import { levelBackgrounds, plantTextures, roeTextures } from '../art/worldArt';
import { setInkWorld } from '../art/ink';
import { Plant, Roe } from '../objects/Food';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { WorldMap } from './document';

/** Uses the same terrain, props and map-object renderer as LevelScene. No simulation or saved-run changes. */
export class MapView {
  readonly scenery: MapScenery;
  private images: Phaser.GameObjects.GameObject[] = [];
  private keys: string[] = [];
  private backgrounds: Phaser.GameObjects.TileSprite[] = [];
  constructor(private scene: Phaser.Scene, readonly map: WorldMap, ep: EpochDef, place: PlaceDef) {
    const L = map.layout, ink = ep.id === 'devon', reef = ink && paintedReef(scene);
    setInkWorld(ink); plantTextures(scene, L.theme); roeTextures(scene);
    const [far, mid] = ink ? inkBackdrop(scene, moodOf(place), true) : levelBackgrounds(scene, L.theme, L.variant, place.kind === 'start');
    const bg = scene.add.tileSprite(640, 360, 1280, 720, far).setScrollFactor(0).setDepth(-100);
    const mg = scene.add.tileSprite(640, 360, 1280, 720, mid).setScrollFactor(0).setDepth(-99).setAlpha(.65);
    this.images.push(bg, mg);
    this.backgrounds = [bg, mg];
    const visual = { ...L, rocks: L.rocks.filter(r => !(ink && paintedRiver(scene) && r.paintedProp === 'cave') && !(reef && (r.form === 'slab' || r.paintedProp === 'shelter-support'))) };
    const art = terrainArt(scene, visual, L.theme, place.def.ground, ink);
    this.keys.push(...art.keys);
    for (const c of art.chunks) {
      this.images.push(scene.add.image(c.x, c.y, c.key).setOrigin(0).setDisplaySize(c.w, c.h).setDepth(0));
      this.images.push(scene.add.rectangle(c.x, c.deepY - 1, c.w, L.height + 400 - c.deepY, art.deep).setOrigin(0).setDepth(-.1));
    }
    for (const k of art.rocks) this.images.push(scene.add.image(k.x, k.y, k.key).setOrigin(0).setDisplaySize(k.w, k.h).setDepth(.5));
    for (const k of art.fore) this.images.push(scene.add.image(k.x, k.y, k.key).setOrigin(0).setDisplaySize(k.w, k.h).setDepth(42));
    if (reef) for (const r of L.rocks) if (r.form === 'slab' || r.paintedProp === 'shelter-support') this.images.push(reefRock(scene, r).setDepth(.5));
    if (L.cave && ink && paintedRiver(scene)) { const cave = riverCave(scene, L.cave); cave.back.setDepth(-7); cave.front.setDepth(40); this.images.push(cave.back, cave.front); }
    if (L.chasm) this.images.push(chasmArt(scene, L.chasm));
    this.scenery = new MapScenery(scene, L, map.objects, ink);
    for (const p of L.plants) this.images.push(new Plant(scene, p.x, p.y, L.theme, 3, p.v).img);
    for (const r of L.roe) this.images.push(new Roe(scene, r.x, r.y, r.species, r.tone, 4, r.own).img);
  }
  update() {
    const cam = this.scene.cameras.main;
    this.backgrounds.forEach((bg, i) => {
      bg.setSize(1280 / cam.zoom, 720 / cam.zoom).setTileScale(1 / cam.zoom);
      bg.tilePositionX = cam.scrollX * (i ? .28 : .08);
    });
  }
  destroy() {
    this.scenery.destroy(); for (const img of this.images) img.destroy();
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.images = []; this.keys = [];
  }
}
