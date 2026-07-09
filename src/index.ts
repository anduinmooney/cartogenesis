// index.ts — Public API surface for the Cartogenesis engine.
//
// Import from here when embedding the engine in other tools:
//   import { generateWorld, renderHypsometric, encodePNG } from "./src/index.ts";

export { Rng, hashString, normalizeSeed } from "./rng.ts";
export { hashQuantized } from "./hash.ts";
export { valueNoise2D, fbm2D, ridge2D, type FbmOptions } from "./noise.ts";
export { Grid } from "./grid.ts";
export {
  generateElevation,
  landFraction,
  type TerrainConfig,
} from "./terrain.ts";
export { erode, type ErosionConfig } from "./erosion.ts";
export {
  analyzeWater,
  countComponents,
  type WaterLayer,
} from "./hydrology.ts";
export {
  generateTemperature,
  generateMoisture,
  latitudeBand,
  type TemperatureConfig,
  type MoistureConfig,
} from "./climate.ts";
export {
  generateRivers,
  type RiverLayer,
  type RiverConfig,
} from "./rivers.ts";
export {
  Biome,
  BIOME_NAMES,
  BIOME_COLORS,
  classifyCell,
  classifyBiomes,
  type BiomeLayer,
} from "./biomes.ts";
export {
  LANGUAGES,
  languageById,
  makeName,
  makeNamer,
  type Language,
} from "./names.ts";
export {
  generateRegions,
  type RegionLayer,
  type RegionInfo,
  type RegionConfig,
} from "./regions.ts";
export {
  generateSettlements,
  habitabilityField,
  type Settlement,
  type SettlementLayer,
  type SettlementTier,
} from "./settlements.ts";
export {
  generateRoads,
  type RoadLayer,
  type RoadEdge,
} from "./roads.ts";
export {
  generateHistory,
  type HistoryLayer,
  type HistoryEvent,
  type Realm,
  type NamedFeature,
} from "./history.ts";
export {
  generateLore,
  type LoreLayer,
  type House,
  type Ruler,
  type Figure,
} from "./lore.ts";
export {
  generateResources,
  Resource,
  RESOURCE_NAMES,
  RESOURCE_COLORS,
  type ResourceLayer,
  type Deposit,
} from "./resources.ts";
export {
  generateEconomy,
  productList,
  type EconomyLayer,
  type SettlementEconomy,
} from "./economy.ts";
export {
  generateReligion,
  type ReligionLayer,
  type Faith,
} from "./religion.ts";
export {
  generateSimulation,
  type SimulationLayer,
  type SimEvent,
  type RealmSummary,
} from "./simulation.ts";
export { worldReportMarkdown } from "./report.ts";
export { worldPosterSVG, type PosterOptions } from "./svgmap.ts";
export { encodePNG } from "./png.ts";
export {
  renderGrayscale,
  renderHypsometric,
  renderScalarField,
  renderTemperature,
  renderMoisture,
  renderRelief,
  renderBiomes,
  renderRegions,
  renderFaiths,
  renderPowers,
  regionColor,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
  overlayResources,
  type RGB,
} from "./render.ts";
export {
  generateWorld,
  hashGrid,
  worldToJSON,
  ENGINE_VERSION,
  type World,
  type WorldConfig,
  type WorldMeta,
} from "./world.ts";
