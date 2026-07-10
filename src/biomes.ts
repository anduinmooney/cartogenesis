// biomes.ts — L6: biome classification.
//
// A Whittaker-style classifier: given temperature and moisture, look up a biome
// in a 5×5 matrix (temperature band × moisture band). Elevation overrides high
// ground to alpine/snow, and water cells map to ocean/lake. This is the layer
// where all the physical fields finally become a legible "kind of place".

import { Grid } from "./grid.ts";
import type { WaterLayer } from "./hydrology.ts";

// NOTE: a plain const object, NOT a TS `enum`. Node's native type-stripping
// ("strip-only" mode) rejects `enum` because it requires code generation.
// This pattern gives the same `Biome.Ocean` access and a `Biome` value type.
export const Biome = {
  Ocean: 0,
  Lake: 1,
  Snow: 2,
  Alpine: 3,
  Tundra: 4,
  Taiga: 5,
  ColdDesert: 6,
  Shrubland: 7,
  Grassland: 8,
  TemperateDesert: 9,
  TemperateForest: 10,
  TemperateRainforest: 11,
  Desert: 12,
  Savanna: 13,
  TropicalSeasonalForest: 14,
  TropicalRainforest: 15,
  // Not climatic — painted onto the map by lava flows from active volcanoes.
  LavaField: 16,
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export const BIOME_NAMES: Record<Biome, string> = {
  [Biome.Ocean]: "Ocean",
  [Biome.Lake]: "Lake",
  [Biome.Snow]: "Snow",
  [Biome.Alpine]: "Alpine",
  [Biome.Tundra]: "Tundra",
  [Biome.Taiga]: "Taiga",
  [Biome.ColdDesert]: "Cold Desert",
  [Biome.Shrubland]: "Shrubland",
  [Biome.Grassland]: "Grassland",
  [Biome.TemperateDesert]: "Temperate Desert",
  [Biome.TemperateForest]: "Temperate Forest",
  [Biome.TemperateRainforest]: "Temperate Rainforest",
  [Biome.Desert]: "Desert",
  [Biome.Savanna]: "Savanna",
  [Biome.TropicalSeasonalForest]: "Tropical Seasonal Forest",
  [Biome.TropicalRainforest]: "Tropical Rainforest",
  [Biome.LavaField]: "Lava Field",
};

export const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  [Biome.Ocean]: [42, 84, 128],
  [Biome.Lake]: [70, 130, 165],
  [Biome.Snow]: [244, 246, 250],
  [Biome.Alpine]: [150, 140, 134],
  [Biome.Tundra]: [156, 164, 142],
  [Biome.Taiga]: [92, 130, 100],
  [Biome.ColdDesert]: [176, 168, 138],
  [Biome.Shrubland]: [158, 170, 110],
  [Biome.Grassland]: [176, 194, 110],
  [Biome.TemperateDesert]: [204, 182, 122],
  [Biome.TemperateForest]: [82, 150, 82],
  [Biome.TemperateRainforest]: [50, 120, 72],
  [Biome.Desert]: [222, 206, 150],
  [Biome.Savanna]: [192, 188, 100],
  [Biome.TropicalSeasonalForest]: [96, 162, 70],
  [Biome.TropicalRainforest]: [38, 120, 56],
  [Biome.LavaField]: [58, 44, 46], // cooled basalt, near-black
};

// Rows = temperature band (cold→hot), cols = moisture band (dry→wet).
const MATRIX: Biome[][] = [
  [Biome.ColdDesert, Biome.Tundra, Biome.Tundra, Biome.Taiga, Biome.Taiga],
  [
    Biome.ColdDesert,
    Biome.Shrubland,
    Biome.Grassland,
    Biome.TemperateForest,
    Biome.TemperateRainforest,
  ],
  [
    Biome.TemperateDesert,
    Biome.Grassland,
    Biome.Grassland,
    Biome.TemperateForest,
    Biome.TemperateRainforest,
  ],
  [
    Biome.Desert,
    Biome.Savanna,
    Biome.Savanna,
    Biome.TropicalSeasonalForest,
    Biome.TropicalRainforest,
  ],
  [
    Biome.Desert,
    Biome.Desert,
    Biome.Savanna,
    Biome.TropicalSeasonalForest,
    Biome.TropicalRainforest,
  ],
];

function band(v: number): number {
  const b = Math.floor(v * 5);
  return b < 0 ? 0 : b > 4 ? 4 : b;
}

/**
 * Classify a single land cell. `eAbove` is elevation above sea level in [0,1];
 * `temperature` and `moisture` are [0,1]. Pure function — the unit of testing.
 */
export function classifyCell(
  eAbove: number,
  temperature: number,
  moisture: number,
): Biome {
  if (eAbove > 0.82) return Biome.Snow;
  if (eAbove > 0.62) return temperature < 0.25 ? Biome.Snow : Biome.Alpine;
  return MATRIX[band(temperature)][band(moisture)];
}

export interface BiomeLayer {
  ids: Uint8Array;
  /** Count of cells per biome id. */
  counts: Record<number, number>;
  /** Number of distinct biomes present. */
  diversity: number;
  /** The most common land biome. */
  dominant: Biome;
}

export function classifyBiomes(
  elevation: Grid,
  temperature: Grid,
  moisture: Grid,
  water: WaterLayer,
  seaLevel: number,
): BiomeLayer {
  const { width, height, data } = elevation;
  const n = width * height;
  const ids = new Uint8Array(n);
  const counts: Record<number, number> = {};
  const inv = 1 / (1 - seaLevel);

  for (let i = 0; i < n; i++) {
    let biome: Biome;
    if (water.oceanMask[i] === 1) {
      biome = Biome.Ocean;
    } else if (water.lakeMask[i] === 1) {
      biome = Biome.Lake;
    } else {
      const eAbove = Math.max(0, (data[i] - seaLevel) * inv);
      biome = classifyCell(eAbove, temperature.data[i], moisture.data[i]);
    }
    ids[i] = biome;
    counts[biome] = (counts[biome] ?? 0) + 1;
  }

  // Dominant land biome (exclude ocean/lake).
  let dominant = Biome.Grassland;
  let best = -1;
  for (const key of Object.keys(counts)) {
    const id = Number(key);
    if (id === Biome.Ocean || id === Biome.Lake) continue;
    if (counts[id] > best) {
      best = counts[id];
      dominant = id;
    }
  }

  return {
    ids,
    counts,
    diversity: Object.keys(counts).length,
    dominant,
  };
}
