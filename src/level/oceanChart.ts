import type { EpochDef } from '../data/epochs';
import { placesOf } from '../data/world';
import { generateLevel } from './LevelGen';

export interface OceanSection {
  id: string;
  x: number;
  width: number;
  surface: number;
  ground: number[];
  roe?: { x: number; y: number };
}
export interface OceanChart { sections: OceanSection[]; width: number; depth: number }

let cached: { key: string; chart: OceanChart } | undefined;

/** Die Karte benutzt den wirklich erzeugten Boden, einschließlich der Saat und der Übergänge. */
export function oceanChart(ep: EpochDef, seed: string | number): OceanChart {
  const key = `${ep.id}/${seed}`;
  if (cached?.key === key) return cached.chart;
  const chart: OceanChart = { sections: [], width: 0, depth: 1 };
  for (const place of placesOf(ep).filter((p) => p.waterway !== undefined)) {
    const L = generateLevel(ep, seed, place);
    const roe = L.roe.find((r) => r.own);
    chart.sections.push({ id: place.id, x: chart.width, width: L.width, surface: L.surfaceY, ground: L.ground, roe });
    chart.width += L.width;
    chart.depth = Math.max(chart.depth, ...L.ground.map((g) => g - L.surfaceY));
  }
  cached = { key, chart };
  return chart;
}
