// world.ts — Top-level world assembly and serialization.
//
// A World bundles all generated layers plus reproducible metadata. Generation
// is a deterministic pipeline: each subsystem draws from its own named RNG
// stream and reads the layers already produced, so new subsystems slot in
// without disturbing existing output.
//
// Pipeline order (physical dependency order):
//   elevation → water → temperature → moisture → rivers → biomes

import { Rng } from "./rng.js";
import { hashQuantized } from "./hash.js";
import { Grid } from "./grid.js";
import { generateElevation, landFraction } from "./terrain.js";
import { analyzeWater,                 } from "./hydrology.js";
import { generateTemperature, generateMoisture } from "./climate.js";
import { generateRivers,                 } from "./rivers.js";
import {
  classifyBiomes,
  BIOME_NAMES,
                  
             
} from "./biomes.js";
import { generateRegions,                  } from "./regions.js";
import {
  generateSettlements,
                       
} from "./settlements.js";
import { generateRoads,                } from "./roads.js";
import { generateHistory,                   } from "./history.js";

export const ENGINE_VERSION = "0.8.0";

                              
                        
                 
                  
                    
                                              
                     
                   
                   
 

                            
                        
                        
                
                 
                   
                       
                        
                       
                    
                        
                        
                         
                        
                      
                        
                          
                  
                     
                     
                     
                      
                                                                         
                      
 

                        
                  
                  
                    
                    
                 
                     
                     
                       
                               
                   
                        
 

export function generateWorld(config             )        {
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

  const meta            = {
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
    dominantBiome: BIOME_NAMES[biomes.dominant         ],
    regionCount: regions.regions.length,
    largestRegion: largest.name,
    settlementCount: settlements.settlements.length,
    capital: capital?.name ?? "—",
    roadLength: roads.length,
    realmCount: history.realms.length,
    eventCount: history.events.length,
    presentYear: history.presentYear,
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
  };
}

/** Stable content hash of a Grid (quantized to survive trivial float noise). */
export function hashGrid(grid      )         {
  return hashQuantized(grid.data);
}

/** Serialize world metadata (not the heavy grids) to a JSON string. */
export function worldToJSON(world       )         {
  return JSON.stringify(world.meta, null, 2);
}
