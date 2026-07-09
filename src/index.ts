// index.ts — Public API surface for the Cartogenesis engine.
//
// Import from here when embedding the engine in other tools:
//   import { generateWorld, renderHypsometric, encodePNG } from "./src/index.ts";

export { Rng, hashString, normalizeSeed } from "./rng.ts";
export { valueNoise2D, fbm2D, ridge2D, type FbmOptions } from "./noise.ts";
export { Grid } from "./grid.ts";
export {
  generateElevation,
  landFraction,
  type TerrainConfig,
} from "./terrain.ts";
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
export { encodePNG } from "./png.ts";
export {
  renderGrayscale,
  renderHypsometric,
  renderScalarField,
  renderTemperature,
  renderMoisture,
  renderBiomes,
  renderRegions,
  regionColor,
  overlayRivers,
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
