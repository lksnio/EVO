import type Phaser from 'phaser';
import { FONT, TITLE_FONT } from '../config';
import { PALEO } from '../data/paleo';
import { placeOf } from '../data/world';
import { game } from '../state/GameState';
import { habitatExtent } from '../sim/habitat';
import { MAP_BOX, mapPos } from '../art/mapArt';
import { MAP_LABELS, worldMapCanvas } from '../art/paleoArt';
import { drawnOutlines, farOutlines } from '../art/paleoGeo';
import { newCanvas } from '../util/canvas';

let uid = 0;

/** Die frühere Overworld verkleinert: Kontinente bleiben sichtbar, der rote Lebensraum liegt ausschließlich im Meer. */
export function habitatMap(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  const c = scene.add.container(x, y);
  const ep = game.epoch.id;
  const map = PALEO[ep];
  if (!map) return c;
  const place = placeOf(game.epoch, game.prog.place);
  const scale = Math.min((w - 2) / MAP_BOX.w, (h - 2) / MAP_BOX.h);
  const mw = MAP_BOX.w * scale, mh = MAP_BOX.h * scale;
  const left = (w - mw) / 2, top = (h - mh) / 2;
  const pos = (px: number, py: number) => {
    const p = mapPos(px, py);
    return { x: left + (p.x - MAP_BOX.x) * scale, y: top + (p.y - MAP_BOX.y) * scale };
  };
  // In doppelter Auflösung bleibt die eingebettete Karte auch bei vergrößerter Oberfläche scharf.
  const [cv, ctx] = newCanvas(w * 2, h * 2);
  ctx.scale(2, 2);
  ctx.fillStyle = '#08161b';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(worldMapCanvas(ep), MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, left, top, mw, mh);

  const point = pos(place.x, place.y);
  const extent = habitatExtent(game.gain(), game.upTrail.length);
  const rx = mw * (0.025 + 0.15 * extent), ry = rx * 0.6;
  const [area, a] = newCanvas(w * 2, h * 2);
  a.scale(2, 2);
  // Ein örtliches Stück Meer statt des früheren Wasserquerschnitts. Mit Stärke und Segen wächst seine Ausdehnung.
  a.beginPath();
  a.ellipse(point.x, point.y, rx, ry, -0.15, 0, Math.PI * 2);
  a.fillStyle = 'rgba(180,55,62,0.48)';
  a.fill();
  a.strokeStyle = 'rgba(239,121,123,0.9)';
  a.lineWidth = 1;
  a.stroke();
  // Alle echten Küstenlinien einschließlich Gondwana und des fernen Landes aus der roten Fläche ausschneiden.
  a.globalCompositeOperation = 'destination-out';
  a.fillStyle = '#000';
  for (const outline of [...drawnOutlines(ep), ...farOutlines(ep)]) {
    a.beginPath();
    outline.forEach(([px, py], i) => {
      const p = pos(px, py);
      if (i) a.lineTo(p.x, p.y); else a.moveTo(p.x, p.y);
    });
    a.closePath();
    a.fill();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, mw, mh);
  ctx.clip();
  ctx.drawImage(area, 0, 0, w, h);
  // Lesbare Beschriftung in der Miniatur, unabhängig von der ursprünglichen Bildschirmgröße.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#030a0e';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#eee0b4';
  ctx.font = `700 12px ${TITLE_FONT}`;
  for (const continent of map.continents) if (MAP_LABELS.has(continent.name)) {
    const p = pos(...continent.label);
    ctx.fillText(continent.name.toUpperCase(), p.x, p.y);
  }
  ctx.font = `italic 11px ${FONT}`;
  ctx.fillStyle = '#a2c5c4';
  for (const ocean of map.oceans) {
    const p = pos(ocean.x, ocean.y);
    ctx.fillText(ocean.name, p.x, p.y - 7);
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,247,222,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff7de';
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c8a46a';
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${game.epoch.name} · ${place.name}`, 9, 14);
  ctx.strokeStyle = 'rgba(200,145,60,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  const key = `habitat_world_${++uid}`;
  scene.textures.addCanvas(key, cv);
  c.add(scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(w, h));
  // Jede Übersicht besitzt ihre Karte; wiederholtes Öffnen sammelt keine unbenutzten GPU-Texturen an.
  c.once('destroy', () => { if (scene.textures.exists(key)) scene.textures.remove(key); });
  return c;
}
