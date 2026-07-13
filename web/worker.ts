// web/worker.ts — Generation off the main thread.
//
// The engine is pure, so it runs fine in a module worker. On a request it
// builds the world, renders all layers to RGBA, and posts back the layer buffers
// (transferred, zero-copy) plus the whole world for the main thread to inspect
// on hover/click. Keeping generation here means the UI never freezes.

import { generateWorld, type World } from "./engine/world.ts";
import { ruinedSettlementIds } from "./engine/simulation.ts";
import {
  renderHypsometric,
  renderRelief,
  renderContours,
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
} from "./engine/render.ts";

const LAYER_NAMES = [
  "terrain",
  "topographic",
  "biome",
  "political",
  "powers",
  "faiths",
  "resources",
  "temperature",
  "moisture",
  "height",
];

function layerPixels(world: World, layer: string): Uint8Array {
  const w = world.elevation.width;
  const h = world.elevation.height;
  // Present-day maps show the settlements that survived history, not its ruins.
  const ruined = ruinedSettlementIds(world.simulation.settlementTimeline);
  const towns = world.settlements.settlements.filter((s) => !ruined.has(s.id));
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
    case "topographic":
      return renderContours(world.elevation, world.meta.seaLevel, world.meta.maxAltitudeMetres);
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
      return renderTemperature(world.temperature, world.water, world.elevation);
    case "moisture":
      return renderMoisture(world.moisture, world.water, world.elevation);
    case "height":
      return renderRelief(world.elevation, world.water);
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

self.onmessage = (e: MessageEvent) => {
  const { seed, size } = e.data as { seed: string; size: number };
  const world = generateWorld({ seed, width: size, height: size });

  const layers: Record<string, Uint8Array> = {};
  const transfer: ArrayBuffer[] = [];
  for (const name of LAYER_NAMES) {
    const px = layerPixels(world, name);
    layers[name] = px;
    transfer.push(px.buffer);
  }

  // The world is structured-cloned (data only — the main thread never calls
  // Grid methods, just reads .data / arrays for hover & detail).
  (self as unknown as Worker).postMessage({ seed, size, layers, world }, transfer);
};
