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
import { hashExact, hashQuantized, hashTokens } from "./hash.js";
import { Grid } from "./grid.js";
import { generateElevation, landFraction } from "./terrain.js";
import {
  addVolcanoes,
  fillCraterLakes,
  traceLavaFields,
               
} from "./volcanoes.js";
import { erode } from "./erosion.js";
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
import { generateLore,                } from "./lore.js";
import { generateResources, RESOURCE_NAMES,                    } from "./resources.js";
import { generateEconomy,                   } from "./economy.js";
import { generateReligion,                    } from "./religion.js";
import {
  generateSimulation,
  ruinedSettlementIds,
                       
} from "./simulation.js";
import { generateNarrative,                     } from "./narrative.js";
import { generateSagas,           } from "./saga.js";

export const ENGINE_VERSION = "0.13.0";

                              
                        
                 
                  
                    
                                              
                     
                   
                   
                                                                
                    
                                                         
                      
                                                                          
                             
 

                            
                        
                        
                
                 
                   
                       
                        
                       
                    
                        
                        
                         
                        
                      
                        
                          
                  
                     
                     
                     
                      
                       
                     
                        
                       
                     
                          
                        
                                                           
                    
                       
                          
                                                             
                            
                                                  
                            
                                                                               
                      
                                                                                  
                    
                                                                            
                         
 

                        
                  
                  
                    
                    
                 
                     
                     
                       
                               
                   
                        
                  
                           
                        
                          
                              
                                                                      
                            
                                                        
                
                       
 

/** Convert a normalized elevation value to metres above sea level. */
export function elevationToMetres(
  value        ,
  seaLevel        ,
  maxAltitudeMetres        ,
)         {
  if (value <= seaLevel) return 0;
  return Math.round(((value - seaLevel) / (1 - seaLevel)) * maxAltitudeMetres);
}

export function generateWorld(config             )        {
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
  let volcanoes            = [];
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
  // Crater lakes sit above sea level, so the ocean/basin flood fill never finds
  // them; inject them now that erosion has finalized the caldera floors.
  fillCraterLakes(elevation, water, volcanoes, seaLevel);

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
  // Paint lava fields from active volcanoes over the climatic biomes. Downstream
  // (regions, settlements) then see them — nobody settles on fresh basalt.
  if (config.volcanoes !== false) {
    traceLavaFields(elevation, water, biomes, volcanoes, volcanoRng.seed);
  }

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
    { seed: settlementsRng.seed, biomes },
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

  // One authoritative timeline. The simulation defines the world's era; the
  // founding legends and the ruler successions must both answer to it —
  // otherwise legends get dated after the present and dynasties end centuries
  // before the chronicle does.
  const SIM_START_YEAR = 100;
  const SIM_TURNS = 40;
  const SIM_YEARS_PER_TURN = 25;
  const presentYear = SIM_START_YEAR + SIM_TURNS * SIM_YEARS_PER_TURN;

  // L11 — History: a procedural chronicle grounded in the geography above.
  const historyRng = root.stream("history");
  const history = generateHistory(
    elevation,
    water,
    rivers,
    regions,
    settlements.settlements,
    { seed: historyRng.seed, presentYear },
  );

  // L12 — Lore: houses, rulers, figures, and region prose.
  const loreRng = root.stream("lore");
  const lore = generateLore(regions, settlements.settlements, history, {
    seed: loreRng.seed,
    presentYear,
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
    {
      seed: simulationRng.seed,
      startYear: SIM_START_YEAR,
      turns: SIM_TURNS,
      yearsPerTurn: SIM_YEARS_PER_TURN,
    },
  );
  // Apply language contact: the simulation reports which towns a foreign power
  // held long enough to rename. Layer the present-day name over each, preserving
  // the old one, so the map, gazetteer, and hover all show the changed name.
  const settlementById = new Map(settlements.settlements.map((s) => [s.id, s]));
  for (const rn of simulation.renamings) {
    const s = settlementById.get(rn.settlementId);
    if (!s) continue;
    (s.formerNames ??= []).push({
      name: s.name,
      gloss: s.gloss,
      untilYear: rn.year,
    });
    s.name = rn.name;
    s.gloss = rn.gloss;
  }

  // The world as it was is what the simulation ran on. The world as it IS — the
  // one we draw and describe — has ruins in it. Recompute the road network and
  // the economy over the settlements that actually survived, so a highway never
  // runs to a dead city and the gazetteer never lists a ruin among its exporters.
  const ruined = ruinedSettlementIds(simulation.settlementTimeline);
  const standing = settlements.settlements.filter((s) => !ruined.has(s.id));
  const roadsNow = ruined.size
    ? generateRoads(elevation, water, rivers, standing, {})
    : roads;
  const economyNow = ruined.size
    ? generateEconomy(standing, roadsNow, resources, { seed: economyRng.seed })
    : economy;

  const dominant = [...simulation.realms]
    .filter((r) => r.status !== "extinct")
    .sort((a, b) => b.finalSize - a.finalSize)[0];

  // L17 — Narrative: the chronicle told as a story. Strictly downstream of the
  // simulation (its own stream; reads events, never writes them), so the
  // simulation fingerprint is identical with or without it.
  const narrativeRng = root.stream("narrative");
  const narrative = generateNarrative(history, lore, simulation, {
    seed: narrativeRng.seed,
    presentYear: simulation.endYear,
    capital: capital?.name ?? "—",
    capitalHouse: lore.capitalHouse,
  });
  // L17b — Sagas: what each people believes about itself. Same rules: own
  // stream, reads only, cannot perturb anything upstream.
  const sagaRng = root.stream("saga");
  const sagas = generateSagas(regions, settlements.settlements, religion, simulation, {
    seed: sagaRng.seed,
  });

  const maxAltitudeMetres = config.maxAltitudeMetres ?? 4500;
  const peakValue = elevation.extent().max;
  const highestPeakMetres = elevationToMetres(peakValue, seaLevel, maxAltitudeMetres);

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
    roadLength: roadsNow.length,
    realmCount: history.realms.length,
    eventCount: history.events.length,
    presentYear: simulation.endYear,
    capitalHouse: lore.capitalHouse,
    rulerCount: lore.rulers.length,
    resourceCount: resources.deposits.length,
    majorExports: economyNow.majorExports.map((k) => RESOURCE_NAMES[k]).join(", "),
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
    exactHash: hashGridExact(elevation),
    simulationHash: simulationFingerprint(simulation),
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
    roads: roadsNow,
    history,
    lore,
    resources,
    economy: economyNow,
    religion,
    simulation,
    narrative,
    sagas,
    volcanoes,
  };
}

/**
 * Quantized hash of a Grid — rounds to 16 bits, so it survives (and therefore
 * hides) last-bit drift. Useful for "did the terrain change visibly". NOT the
 * determinism guard: use `hashGridExact`. See DECISIONS D-022.
 */
export function hashGrid(grid      )         {
  return hashQuantized(grid.data);
}

/** Exact bit-level hash of a Grid. This is the determinism guard. */
export function hashGridExact(grid      )         {
  return hashExact(grid.data);
}

/**
 * Fingerprint of what history actually did: every realm's arc, every dated
 * event, and every settlement's founding and fall. Terrain can be bit-identical
 * while this drifts — that is exactly what D-022 was.
 */
export function simulationFingerprint(sim                 )         {
  const tokens                         = [];
  for (const r of sim.realms) {
    tokens.push(r.foundedYear, "/", r.peakSize, "/", r.peakYear, "/", r.finalSize, "/", r.status, ";");
  }
  for (const e of sim.events) tokens.push(e.year, ":", e.type, ";");
  for (const t of sim.settlementTimeline) {
    tokens.push(t.id, "@", t.foundedYear, "-", t.fellYear ?? "standing", ";");
  }
  return hashTokens(tokens);
}

/** Serialize world metadata (not the heavy grids) to a JSON string. */
export function worldToJSON(world       )         {
  return JSON.stringify(world.meta, null, 2);
}
