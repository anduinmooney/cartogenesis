// world.ts — Top-level world assembly and serialization.
//
// A World bundles all generated layers plus reproducible metadata. Generation
// is a deterministic pipeline: each subsystem draws from its own named RNG
// stream and reads the layers already produced, so new subsystems slot in
// without disturbing existing output.
//
// Pipeline order (physical dependency order):
//   elevation → water → temperature → moisture → rivers → biomes

import { createHash } from "node:crypto";
import { Rng } from "./rng.ts";
import { Grid } from "./grid.ts";
import { generateElevation, landFraction } from "./terrain.ts";
import { analyzeWater, type WaterLayer } from "./hydrology.ts";
import { generateTemperature, generateMoisture } from "./climate.ts";
import { generateRivers, type RiverLayer } from "./rivers.ts";
import {
  classifyBiomes,
  BIOME_NAMES,
  type BiomeLayer,
  type Biome,
} from "./biomes.ts";
import { generateRegions, type RegionLayer } from "./regions.ts";

export const ENGINE_VERSION = "0.6.0";

export interface WorldConfig {
  seed: number | string;
  width?: number;
  height?: number;
  seaLevel?: number;
  /** Passed through to terrain generation. */
  frequency?: number;
  octaves?: number;
  island?: boolean;
}

export interface WorldMeta {
  engineVersion: string;
  seed: number | string;
  width: number;
  height: number;
  seaLevel: number;
  landFraction: number;
  oceanFraction: number;
  lakeFraction: number;
  lakeCount: number;
  riverFraction: number;
  mainRiverFlow: number;
  biomeDiversity: number;
  dominantBiome: string;
  regionCount: number;
  largestRegion: string;
  /** Content hash of the elevation field — a determinism fingerprint. */
  contentHash: string;
}

export interface World {
  meta: WorldMeta;
  elevation: Grid;
  water: WaterLayer;
  temperature: Grid;
  moisture: Grid;
  rivers: RiverLayer;
  biomes: BiomeLayer;
  regions: RegionLayer;
}

export function generateWorld(config: WorldConfig): World {
  const width = config.width ?? 512;
  const height = config.height ?? 512;
  const seaLevel = config.seaLevel ?? 0.42;

  const root = new Rng(config.seed);

  // L1 — Elevation.
  const terrainRng = root.stream("terrain");
  const elevation = generateElevation({
    width,
    height,
    seed: terrainRng.seed,
    frequency: config.frequency,
    octaves: config.octaves,
    island: config.island,
  });

  // L2 — Hydrology I: sea, coasts, lakes. (Reserve the stream even though the
  // current analysis is deterministic, so future hydrology randomness stays
  // isolated.)
  root.stream("hydrology");
  const water = analyzeWater(elevation, seaLevel);

  // L3 — Temperature; L4 — Moisture. Both draw from the climate stream.
  const climateRng = root.stream("climate");
  const temperature = generateTemperature(elevation, water, {
    seed: climateRng.stream("temperature").seed,
    seaLevel,
  });
  const moisture = generateMoisture(elevation, temperature, water, {
    seed: climateRng.stream("moisture").seed,
    seaLevel,
  });

  // L5 — Rivers: drainage + flow accumulation (deterministic; reserve stream).
  root.stream("rivers");
  const rivers = generateRivers(elevation, water, moisture, {});

  // L6 — Biomes: classify each cell from the fields above.
  root.stream("biomes");
  const biomes = classifyBiomes(
    elevation,
    temperature,
    moisture,
    water,
    seaLevel,
  );

  // L7 — Regions: partition land into named provinces.
  const regionsRng = root.stream("regions");
  const regions = generateRegions(
    elevation,
    temperature,
    moisture,
    water,
    biomes,
    { seed: regionsRng.seed },
  );
  const largest = regions.regions.reduce(
    (a, b) => (b.area > a.area ? b : a),
    regions.regions[0] ?? { name: "—", area: 0 },
  );

  const meta: WorldMeta = {
    engineVersion: ENGINE_VERSION,
    seed: config.seed,
    width,
    height,
    seaLevel,
    landFraction: landFraction(elevation, seaLevel),
    oceanFraction: water.oceanFraction,
    lakeFraction: water.lakeFraction,
    lakeCount: water.lakeCount,
    riverFraction: rivers.riverFraction,
    mainRiverFlow: Math.round(rivers.maxFlow),
    biomeDiversity: biomes.diversity,
    dominantBiome: BIOME_NAMES[biomes.dominant as Biome],
    regionCount: regions.regions.length,
    largestRegion: largest.name,
    contentHash: hashGrid(elevation),
  };

  return {
    meta,
    elevation,
    water,
    temperature,
    moisture,
    rivers,
    biomes,
    regions,
  };
}

/** Stable content hash of a Grid (quantized to survive trivial float noise). */
export function hashGrid(grid: Grid): string {
  const h = createHash("sha256");
  const buf = Buffer.alloc(grid.data.length * 2);
  for (let i = 0; i < grid.data.length; i++) {
    // Quantize to 16 bits — robust fingerprint, tolerant of ULP-level drift.
    buf.writeUInt16LE(Math.round(grid.data[i] * 65535) & 0xffff, i * 2);
  }
  h.update(buf);
  return h.digest("hex").slice(0, 16);
}

/** Serialize world metadata (not the heavy grids) to a JSON string. */
export function worldToJSON(world: World): string {
  return JSON.stringify(world.meta, null, 2);
}
