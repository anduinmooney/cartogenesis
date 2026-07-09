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
export { encodePNG } from "./png.ts";
export {
  renderGrayscale,
  renderHypsometric,
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
