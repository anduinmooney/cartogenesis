// world.ts — Top-level world assembly and serialization.
//
// A World bundles all generated layers plus reproducible metadata. Generation
// is a deterministic pipeline: each subsystem draws from its own named RNG
// stream and reads the layers already produced, so new subsystems slot in
// without disturbing existing output.
//
// Pipeline order (physical dependency order):
//   elevation → water → temperature → moisture → rivers → biomes

import { Rng } from "./rng.ts";
import { hashQuantized } from "./hash.ts";
import { Grid } from "./grid.ts";
import { generateElevation, landFraction } from "./terrain.ts";
import { addVolcanoes, type Volcano } from "./volcanoes.ts";
import { erode } from "./erosion.ts";
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
import {
  generateSettlements,
  type SettlementLayer,
} from "./settlements.ts";
import { generateRoads, type RoadLayer } from "./roads.ts";
import { generateHistory, type HistoryLayer } from "./history.ts";
import { generateLore, type LoreLayer } from "./lore.ts";
import { generateResources, RESOURCE_NAMES, type ResourceLayer } from "./resources.ts";
import { generateEconomy, type EconomyLayer } from "./economy.ts";
import { generateReligion, type ReligionLayer } from "./religion.ts";
import { generateSimulation, type SimulationLayer } from "./simulation.ts";

export const ENGINE_VERSION = "0.12.0";

export interface WorldConfig {
  seed: number | string;
  width?: number;
  height?: number;
  seaLevel?: number;
  /** Passed through to terrain generation. */
  frequency?: number;
  octaves?: number;
  island?: boolean;
  /** Apply hydraulic erosion after elevation (default true). */
  erosion?: boolean;
  /** Build volcanoes onto the terrain (default true). */
  volcanoes?: boolean;
  /** Elevation of a normalized value of 1.0, in metres (default 4500). */
  maxAltitudeMetres?: number;
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
  settlementCount: number;
  capital: string;
  roadLength: number;
  realmCount: number;
  eventCount: number;
  presentYear: number;
  capitalHouse: string;
  rulerCount: number;
  resourceCount: number;
  majorExports: string;
  faithCount: number;
  survivingRealms: number;
  dominantPower: string;
  /** Settlements lost to history (sacked or abandoned). */
  ruinCount: number;
  volcanoCount: number;
  activeVolcanoes: number;
  /** Metres represented by a normalized elevation of 1.0. */
  maxAltitudeMetres: number;
  /** Highest point above sea level, in metres. */
  highestPeakMetres: number;
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
  settlements: SettlementLayer;
  roads: RoadLayer;
  history: HistoryLayer;
  lore: LoreLayer;
  resources: ResourceLayer;
  economy: EconomyLayer;
  religion: ReligionLayer;
  simulation: SimulationLayer;
  volcanoes: Volcano[];
}

/** Convert a normalized elevation value to metres above sea level. */
export function elevationToMetres(
  value: number,
  seaLevel: number,
  maxAltitudeMetres: number,
): number {
  if (value <= seaLevel) return 0;
  return Math.round(((value - seaLevel) / (1 - seaLevel)) * maxAltitudeMetres);
}

export function generateWorld(config: WorldConfig): World {
  const width = config.width ?? 512;
  const height = config.height ?? 512;
  const seaLevel = config.seaLevel ?? 0.42;

  const root = new Rng(config.seed);

  // L1 — Elevation.
  const terrainRng = root.stream("terrain");
  let elevation = generateElevation({
    width,
    height,
    seed: terrainRng.seed,
    frequency: config.frequency,
    octaves: config.octaves,
    island: config.island,
  });

  // L1.6 — Volcanoes: build volcanic cones BEFORE erosion, so erosion carves
  // realistic radial gullies down their flanks.
  const volcanoRng = root.stream("volcanoes");
  let volcanoes: Volcano[] = [];
  if (config.volcanoes !== false) {
    const built = addVolcanoes(elevation, { seed: volcanoRng.seed, seaLevel });
    elevation = built.elevation;
    volcanoes = built.volcanoes;
  }

  // L1.5 — Hydraulic erosion (carves valleys so rivers follow them later).
  const erosionRng = root.stream("erosion");
  if (config.erosion !== false) {
    elevation = erode(elevation, { seed: erosionRng.seed });
  }

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

  // L9 — Settlements: habitability-driven placement.
  const settlementsRng = root.stream("settlements");
  const settlements = generateSettlements(
    elevation,
    temperature,
    moisture,
    water,
    rivers,
    regions,
    seaLevel,
    { seed: settlementsRng.seed },
  );
  const capital = settlements.settlements.find((s) => s.isCapital);

  // L10 — Roads: least-cost network connecting settlements.
  root.stream("roads");
  const roads = generateRoads(
    elevation,
    water,
    rivers,
    settlements.settlements,
    {},
  );

  // L11 — History: a procedural chronicle grounded in the geography above.
  const historyRng = root.stream("history");
  const history = generateHistory(
    elevation,
    water,
    rivers,
    regions,
    settlements.settlements,
    { seed: historyRng.seed },
  );

  // L12 — Lore: houses, rulers, figures, and region prose.
  const loreRng = root.stream("lore");
  const lore = generateLore(regions, settlements.settlements, history, {
    seed: loreRng.seed,
  });

  // L13 — Resources: natural deposits by terrain and biome.
  const resourcesRng = root.stream("resources");
  const resources = generateResources(
    elevation,
    biomes,
    water,
    temperature,
    moisture,
    seaLevel,
    { seed: resourcesRng.seed },
  );

  // L14 — Economy: production, wealth, and trade over resources + roads.
  const economyRng = root.stream("economy");
  const economy = generateEconomy(settlements.settlements, roads, resources, {
    seed: economyRng.seed,
  });

  // L15 — Religion: faiths, deities, and myths, spread across regions.
  const religionRng = root.stream("religion");
  const religion = generateReligion(regions, history, { seed: religionRng.seed });

  // L16 — Simulation: run the world forward; history becomes emergent.
  const simulationRng = root.stream("simulation");
  const simulation = generateSimulation(
    regions,
    history,
    religion,
    settlements.settlements,
    economy,
    { seed: simulationRng.seed },
  );
  const dominant = [...simulation.realms]
    .filter((r) => r.status !== "extinct")
    .sort((a, b) => b.finalSize - a.finalSize)[0];

  const maxAltitudeMetres = config.maxAltitudeMetres ?? 4500;
  const peakValue = elevation.extent().max;
  const highestPeakMetres = elevationToMetres(peakValue, seaLevel, maxAltitudeMetres);

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
    settlementCount: settlements.settlements.length,
    capital: capital?.name ?? "—",
    roadLength: roads.length,
    realmCount: history.realms.length,
    eventCount: history.events.length,
    presentYear: history.presentYear,
    capitalHouse: lore.capitalHouse,
    rulerCount: lore.rulers.length,
    resourceCount: resources.deposits.length,
    majorExports: economy.majorExports.map((k) => RESOURCE_NAMES[k]).join(", "),
    faithCount: religion.faiths.length,
    survivingRealms: simulation.survivingRealms,
    dominantPower: dominant?.name ?? "—",
    ruinCount: simulation.settlementTimeline.filter((s) => s.fellYear !== undefined)
      .length,
    volcanoCount: volcanoes.length,
    activeVolcanoes: volcanoes.filter((v) => v.status === "active").length,
    maxAltitudeMetres,
    highestPeakMetres,
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
    settlements,
    roads,
    history,
    lore,
    resources,
    economy,
    religion,
    simulation,
    volcanoes,
  };
}

/** Stable content hash of a Grid (quantized to survive trivial float noise). */
export function hashGrid(grid: Grid): string {
  return hashQuantized(grid.data);
}

/** Serialize world metadata (not the heavy grids) to a JSON string. */
export function worldToJSON(world: World): string {
  return JSON.stringify(world.meta, null, 2);
}
