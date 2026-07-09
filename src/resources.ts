// resources.ts — L13: natural resources.
//
// Scatters deposits of ~15 resource kinds across the map according to what the
// land can plausibly bear: ores and gems in the mountains, timber in the
// forests, grain on fertile lowlands, fish along the coasts, furs in the taiga,
// spices in the jungle. Each kind scores every land cell for suitability, then
// deposits are placed at local maxima with spacing so they don't clump. These
// become the inputs to the economy layer. Deterministic on a `resources` stream.

import { Rng } from "./rng.ts";
import type { Grid } from "./grid.ts";
import type { WaterLayer } from "./hydrology.ts";
import type { BiomeLayer } from "./biomes.ts";
import { Biome } from "./biomes.ts";

export const Resource = {
  Iron: 0,
  Copper: 1,
  Gold: 2,
  Gems: 3,
  Stone: 4,
  Coal: 5,
  Timber: 6,
  Grain: 7,
  Livestock: 8,
  Fish: 9,
  Furs: 10,
  Spices: 11,
  Salt: 12,
  Horses: 13,
  Wine: 14,
} as const;
export type Resource = (typeof Resource)[keyof typeof Resource];

export const RESOURCE_NAMES: Record<number, string> = {
  [Resource.Iron]: "Iron",
  [Resource.Copper]: "Copper",
  [Resource.Gold]: "Gold",
  [Resource.Gems]: "Gems",
  [Resource.Stone]: "Stone",
  [Resource.Coal]: "Coal",
  [Resource.Timber]: "Timber",
  [Resource.Grain]: "Grain",
  [Resource.Livestock]: "Livestock",
  [Resource.Fish]: "Fish",
  [Resource.Furs]: "Furs",
  [Resource.Spices]: "Spices",
  [Resource.Salt]: "Salt",
  [Resource.Horses]: "Horses",
  [Resource.Wine]: "Wine",
};

export const RESOURCE_COLORS: Record<number, [number, number, number]> = {
  [Resource.Iron]: [120, 120, 130],
  [Resource.Copper]: [200, 120, 70],
  [Resource.Gold]: [240, 200, 70],
  [Resource.Gems]: [220, 90, 200],
  [Resource.Stone]: [160, 160, 155],
  [Resource.Coal]: [50, 50, 55],
  [Resource.Timber]: [70, 130, 60],
  [Resource.Grain]: [225, 205, 100],
  [Resource.Livestock]: [200, 175, 140],
  [Resource.Fish]: [90, 180, 210],
  [Resource.Furs]: [150, 110, 80],
  [Resource.Spices]: [220, 110, 60],
  [Resource.Salt]: [235, 235, 240],
  [Resource.Horses]: [180, 140, 90],
  [Resource.Wine]: [150, 60, 90],
};

export interface Deposit {
  kind: Resource;
  x: number;
  y: number;
  richness: number; // 0..1
}

export interface ResourceLayer {
  deposits: Deposit[];
  /** Count per resource kind. */
  counts: Record<number, number>;
}

const MOUNTAIN = new Set<number>([Biome.Alpine, Biome.Snow]);
const FOREST = new Set<number>([
  Biome.Taiga,
  Biome.TemperateForest,
  Biome.TemperateRainforest,
  Biome.TropicalSeasonalForest,
  Biome.TropicalRainforest,
]);
const GRASS = new Set<number>([Biome.Grassland, Biome.Savanna, Biome.Shrubland]);
const COLD = new Set<number>([Biome.Taiga, Biome.Tundra]);
const TROPICS = new Set<number>([
  Biome.TropicalRainforest,
  Biome.TropicalSeasonalForest,
]);
const DRY = new Set<number>([
  Biome.Desert,
  Biome.TemperateDesert,
  Biome.ColdDesert,
]);

interface Ctx {
  biome: number;
  eAbove: number;
  moisture: number;
  temperature: number;
  coastal: boolean;
}

interface Def {
  kind: Resource;
  /** Larger = rarer (bigger spacing, fewer deposits). */
  spacing: number;
  score: (c: Ctx) => number;
}

const DEFS: Def[] = [
  { kind: Resource.Iron, spacing: 12, score: (c) => hill(c, 0.4, 0.85) },
  { kind: Resource.Copper, spacing: 14, score: (c) => hill(c, 0.38, 0.8) * 0.9 },
  { kind: Resource.Coal, spacing: 15, score: (c) => hill(c, 0.35, 0.7) },
  { kind: Resource.Stone, spacing: 13, score: (c) => (c.eAbove > 0.35 ? c.eAbove : 0) },
  { kind: Resource.Gold, spacing: 22, score: (c) => (MOUNTAIN.has(c.biome) ? c.eAbove : hill(c, 0.6, 0.95) * 0.5) },
  { kind: Resource.Gems, spacing: 28, score: (c) => (MOUNTAIN.has(c.biome) ? c.eAbove * 0.9 : 0) },
  { kind: Resource.Timber, spacing: 11, score: (c) => (FOREST.has(c.biome) ? 0.5 + 0.5 * c.moisture : 0) },
  { kind: Resource.Furs, spacing: 16, score: (c) => (COLD.has(c.biome) ? 0.7 : 0) },
  { kind: Resource.Spices, spacing: 18, score: (c) => (TROPICS.has(c.biome) ? 0.8 : 0) },
  {
    kind: Resource.Grain,
    spacing: 12,
    score: (c) =>
      c.eAbove < 0.35 && (c.biome === Biome.Grassland || c.biome === Biome.TemperateForest)
        ? 1 - Math.abs(c.moisture - 0.55) - Math.abs(c.temperature - 0.6) * 0.5
        : 0,
  },
  { kind: Resource.Livestock, spacing: 13, score: (c) => (GRASS.has(c.biome) || c.biome === Biome.Tundra ? 0.6 : 0) },
  { kind: Resource.Horses, spacing: 16, score: (c) => (c.biome === Biome.Grassland || c.biome === Biome.Savanna ? 0.7 - c.eAbove : 0) },
  {
    kind: Resource.Wine,
    spacing: 17,
    score: (c) =>
      c.eAbove < 0.45 && (c.biome === Biome.Grassland || c.biome === Biome.TemperateForest || c.biome === Biome.Shrubland)
        ? 1 - Math.abs(c.temperature - 0.62) * 2 - Math.abs(c.moisture - 0.45)
        : 0,
  },
  { kind: Resource.Fish, spacing: 10, score: (c) => (c.coastal ? 0.8 : 0) },
  { kind: Resource.Salt, spacing: 18, score: (c) => (DRY.has(c.biome) ? 0.6 : c.coastal ? 0.4 : 0) },
];

function hill(c: Ctx, lo: number, hi: number): number {
  if (c.eAbove < lo || c.eAbove > hi) return 0;
  return (c.eAbove - lo) / (hi - lo);
}

export interface ResourceConfig {
  seed: number;
  /** Overall deposit density multiplier. */
  density?: number;
}

export function generateResources(
  elevation: Grid,
  biomes: BiomeLayer,
  water: WaterLayer,
  temperature: Grid,
  moisture: Grid,
  seaLevel: number,
  cfg: ResourceConfig,
): ResourceLayer {
  const { width, height } = elevation;
  const n = width * height;
  const rng = new Rng(cfg.seed);
  const inv = 1 / (1 - seaLevel);
  const density = cfg.density ?? 1;

  // Coastal land = land cell within 2 of ocean, or adjacent to a lake.
  const coastal = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (water.oceanMask[i] || water.lakeMask[i]) continue;
      if (water.distToOcean.data[i] <= 2) {
        coastal[i] = 1;
        continue;
      }
      for (let dy = -1; dy <= 1 && !coastal[i]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (water.lakeMask[ny * width + nx]) {
            coastal[i] = 1;
            break;
          }
        }
      }
    }
  }

  const deposits: Deposit[] = [];
  const counts: Record<number, number> = {};

  for (const def of DEFS) {
    // Score every land cell for this kind.
    const cand: Array<{ i: number; s: number }> = [];
    for (let i = 0; i < n; i++) {
      if (water.oceanMask[i] || water.lakeMask[i]) continue;
      const eAbove = Math.max(0, (elevation.data[i] - seaLevel) * inv);
      const ctx: Ctx = {
        biome: biomes.ids[i],
        eAbove,
        moisture: moisture.data[i],
        temperature: temperature.data[i],
        coastal: coastal[i] === 1,
      };
      const s = def.score(ctx);
      if (s > 0.45) cand.push({ i, s });
    }
    cand.sort((a, b) => b.s - a.s || a.i - b.i);

    const spacing = def.spacing / Math.sqrt(density);
    const spacing2 = spacing * spacing;
    const placed: Array<{ x: number; y: number }> = [];
    const cap = Math.max(1, Math.round((cand.length / (spacing * spacing)) * 0.5));
    for (const { i, s } of cand) {
      if (placed.length >= cap) break;
      const x = i % width;
      const y = (i / width) | 0;
      let ok = true;
      for (const p of placed) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < spacing2) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // Small deterministic richness jitter so deposits aren't all identical.
      const richness = Math.min(1, s * (0.8 + rng.next() * 0.4));
      placed.push({ x, y });
      deposits.push({ kind: def.kind, x, y, richness });
    }
    counts[def.kind] = placed.length;
  }

  return { deposits, counts };
}
