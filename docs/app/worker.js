// web/worker.ts — Generation off the main thread.
//
// The engine is pure, so it runs fine in a module worker. On a request it
// builds the world, renders all layers to RGBA, and posts back the layer buffers
// (transferred, zero-copy) plus the whole world for the main thread to inspect
// on hover/click. Keeping generation here means the UI never freezes.

import { generateWorld,            } from "./engine/world.js";
import {
  renderHypsometric,
  renderGrayscale,
  renderBiomes,
  renderRegions,
  renderFaiths,
  renderPowers,
  renderTemperature,
  renderMoisture,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
  overlayResources,
} from "./engine/render.js";

const LAYER_NAMES = [
  "terrain",
  "biome",
  "political",
  "powers",
  "faiths",
  "resources",
  "temperature",
  "moisture",
  "height",
];

function layerPixels(world       , layer        )             {
  const w = world.elevation.width;
  const h = world.elevation.height;
  const towns = world.settlements.settlements;
  switch (layer) {
    case "biome": {
      const px = renderBiomes(world.biomes, world.elevation);
      overlayRivers(px, world.rivers, w, h);
      return px;
    }
    case "political": {
      const px = renderRegions(world.regions, world.water, world.elevation);
      overlayRoads(px, world.roads);
      overlaySettlements(px, towns, w, h);
      return px;
    }
    case "powers":
      return renderPowers(world.regions, world.simulation, world.water, world.elevation);
    case "faiths":
      return renderFaiths(world.regions, world.religion, world.water, world.elevation);
    case "resources": {
      const px = renderHypsometric(world.elevation, world.meta.seaLevel, {
        water: world.water,
      });
      overlayResources(px, world.resources.deposits, w, h);
      return px;
    }
    case "temperature":
      return renderTemperature(world.temperature, world.water);
    case "moisture":
      return renderMoisture(world.moisture, world.water);
    case "height":
      return renderGrayscale(world.elevation);
    case "terrain":
    default: {
      const px = renderHypsometric(world.elevation, world.meta.seaLevel, {
        water: world.water,
      });
      overlayRivers(px, world.rivers, w, h);
      overlayRoads(px, world.roads);
      overlaySettlements(px, towns, w, h);
      return px;
    }
  }
}

self.onmessage = (e              ) => {
  const { seed, size } = e.data                                  ;
  const world = generateWorld({ seed, width: size, height: size });

  const layers                             = {};
  const transfer                = [];
  for (const name of LAYER_NAMES) {
    const px = layerPixels(world, name);
    layers[name] = px;
    transfer.push(px.buffer);
  }

  // The world is structured-cloned (data only — the main thread never calls
  // Grid methods, just reads .data / arrays for hover & detail).
  (self                     ).postMessage({ seed, size, layers, world }, transfer);
};
