// regions.ts — L7: partition the land into named regions (provinces).
//
// Scatter well-spaced seed points across the land, then grow regions outward by
// multi-source BFS that never crosses water — so every region is a single
// contiguous landmass province. Each region takes a naming culture chosen from
// its own climate (cold coasts sound Auld, deserts sound Kesh, deep forests
// sound Sylvan, everything else Meridian), so the map's cultures follow its
// geography.

import { Rng } from "./rng.js";
                                      
                                                 
                                              
import { Biome } from "./biomes.js";
import { languageById, makeName,               } from "./names.js";

                             
             
               
                     
                        
                             
                           
                           
                   
                        
                          
                       
                       
                      
 

                              
                                               
                  
                        
 

const N4                                  = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DESERTISH = new Set        ([
  Biome.Desert,
  Biome.TemperateDesert,
  Biome.ColdDesert,
  Biome.Savanna,
]);
const FORESTISH = new Set        ([
  Biome.Taiga,
  Biome.TemperateForest,
  Biome.TemperateRainforest,
  Biome.TropicalSeasonalForest,
  Biome.TropicalRainforest,
]);

/** Pick a naming culture from a region's climate + dominant biome. */
function cultureFor(meanTemp        , dominant       )           {
  if (meanTemp < 0.34) return languageById("auld");
  if (DESERTISH.has(dominant)) return languageById("kesh");
  if (FORESTISH.has(dominant)) return languageById("sylvan");
  return languageById("meridian");
}

                               
               
                                             
                       
 

export function generateRegions(
  elevation      ,
  temperature      ,
  moisture      ,
  water            ,
  biomes            ,
  cfg              ,
)              {
  const { width, height } = elevation;
  const n = width * height;
  const rng = new Rng(cfg.seed);

  const isLand = (i        ) =>
    water.oceanMask[i] === 0 && water.lakeMask[i] === 0;

  const landCells           = [];
  for (let i = 0; i < n; i++) if (isLand(i)) landCells.push(i);
  const landArea = landCells.length;

  const ids = new Int32Array(n).fill(-1);
  if (landArea === 0) return { ids, regions: [] };

  const regionCount =
    cfg.regionCount ??
    Math.max(4, Math.min(28, Math.round(landArea / 2200)));

  // --- Place well-spaced seed points on land (rejection sampling). ---
  const minDist = Math.sqrt(landArea / regionCount) * 0.7;
  const minDist2 = minDist * minDist;
  const seeds           = [];
  const seedXY                          = [];
  let attempts = 0;
  const maxAttempts = regionCount * 400;
  while (seeds.length < regionCount && attempts < maxAttempts) {
    attempts++;
    const c = landCells[rng.int(0, landArea)];
    const x = c % width;
    const y = (c / width) | 0;
    let ok = true;
    for (const [sx, sy] of seedXY) {
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (ok) {
      seeds.push(c);
      seedXY.push([x, y]);
    }
  }

  // --- Multi-source BFS over land only → nearest-seed partition. ---
  const queue = new Int32Array(landArea);
  let qHead = 0;
  let qTail = 0;
  for (let s = 0; s < seeds.length; s++) {
    ids[seeds[s]] = s;
    queue[qTail++] = seeds[s];
  }
  while (qHead < qTail) {
    const i = queue[qHead++];
    const rid = ids[i];
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (ids[ni] === -1 && isLand(ni)) {
        ids[ni] = rid;
        queue[qTail++] = ni;
      }
    }
  }

  // --- Coverage pass: any land component that received no seed (an isolated
  // island) becomes its own region. Guarantees every land cell is assigned. ---
  let nextId = seeds.length;
  for (let start = 0; start < n; start++) {
    if (!isLand(start) || ids[start] !== -1) continue;
    const rid = nextId++;
    ids[start] = rid;
    const stack           = [start];
    while (stack.length > 0) {
      const i = stack.pop() ;
      const x = i % width;
      const y = (i / width) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (ids[ni] === -1 && isLand(ni)) {
          ids[ni] = rid;
          stack.push(ni);
        }
      }
    }
  }

  // --- Accumulate per-region statistics. ---
  const count = nextId;
  const area = new Float64Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const sumE = new Float64Array(count);
  const sumT = new Float64Array(count);
  const sumM = new Float64Array(count);
  const coastal = new Uint8Array(count);
  const biomeTally                           = Array.from(
    { length: count },
    () => ({}),
  );
  const neighborSets                = Array.from(
    { length: count },
    () => new Set        (),
  );

  for (let i = 0; i < n; i++) {
    const rid = ids[i];
    if (rid < 0) continue;
    const x = i % width;
    const y = (i / width) | 0;
    area[rid]++;
    sumX[rid] += x;
    sumY[rid] += y;
    sumE[rid] += elevation.data[i];
    sumT[rid] += temperature.data[i];
    sumM[rid] += moisture.data[i];
    const b = biomes.ids[i];
    biomeTally[rid][b] = (biomeTally[rid][b] ?? 0) + 1;

    // Coast + neighbor detection via right/down neighbors (each pair once).
    if (x + 1 < width) {
      const r = i + 1;
      if (water.oceanMask[r] === 1) coastal[rid] = 1;
      else if (ids[r] >= 0 && ids[r] !== rid) {
        neighborSets[rid].add(ids[r]);
        neighborSets[ids[r]].add(rid);
      }
    }
    if (y + 1 < height) {
      const d = i + width;
      if (water.oceanMask[d] === 1) coastal[rid] = 1;
      else if (ids[d] >= 0 && ids[d] !== rid) {
        neighborSets[rid].add(ids[d]);
        neighborSets[ids[d]].add(rid);
      }
    }
  }

  const regions               = [];
  for (let r = 0; r < count; r++) {
    if (area[r] === 0) continue;
    let dominant = Biome.Grassland;
    let best = -1;
    for (const key of Object.keys(biomeTally[r])) {
      const id = Number(key);
      if (biomeTally[r][id] > best) {
        best = biomeTally[r][id];
        dominant = id         ;
      }
    }
    const meanTemperature = sumT[r] / area[r];
    const lang = cultureFor(meanTemperature, dominant);
    const nameRng = new Rng(`${cfg.seed}:region:${r}`);
    regions.push({
      id: r,
      name: makeName(lang, nameRng),
      languageId: lang.id,
      languageLabel: lang.label,
      area: area[r],
      cx: Math.round(sumX[r] / area[r]),
      cy: Math.round(sumY[r] / area[r]),
      coastal: coastal[r] === 1,
      meanElevation: sumE[r] / area[r],
      meanTemperature,
      meanMoisture: sumM[r] / area[r],
      dominantBiome: dominant,
      neighbors: [...neighborSets[r]].sort((a, b) => a - b),
    });
  }

  return { ids, regions };
}
