// settlements.ts — L9: where people live.
//
// Scores every land cell for habitability — moderate climate, fresh water
// nearby, low and flat ground — then places settlements at local maxima via
// greedy non-maximum suppression so towns don't clump. Each settlement is named
// in its region's culture and sized into a village / town / city hierarchy, with
// the single best inland-or-port site crowned the capital.

import { Rng } from "./rng.js";
import { Grid } from "./grid.js";
                                                 
                                              
                                                
import { Biome,                 } from "./biomes.js";
import { languageById } from "./names.js";
import { composeName, hintsForBiome } from "./language.js";

                                                         

                             
             
            
            
               
                                                         
                
                   
                       
                  
                     
                
     
                                                                                
                                                                           
                                                           
     
                                                                          
 

                                  
                            
                     
 

                                   
               
                                                 
                 
                                                                       
                      
 

const N4                                  = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function smoothstep(edge0        , edge1        , x        )         {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Build a [0,1] habitability field. Exposed for testing and reuse (e.g. later
 * economic layers). Water and high mountains score 0.
 */
export function habitabilityField(
  elevation      ,
  temperature      ,
  moisture      ,
  water            ,
  rivers            ,
  seaLevel        ,
)       {
  const { width, height } = elevation;
  const n = width * height;
  const inv = 1 / (1 - seaLevel);

  // Distance to fresh/coastal water via multi-source BFS from rivers, lakes,
  // and ocean — the dominant driver of where people settle.
  const distWater = new Float64Array(n).fill(Infinity);
  const queue = new Int32Array(n);
  let qHead = 0;
  let qTail = 0;
  for (let i = 0; i < n; i++) {
    if (
      water.oceanMask[i] === 1 ||
      water.lakeMask[i] === 1 ||
      rivers.riverMask[i] === 1
    ) {
      distWater[i] = 0;
      queue[qTail++] = i;
    }
  }
  while (qHead < qTail) {
    const i = queue[qHead++];
    const x = i % width;
    const y = (i / width) | 0;
    const nd = distWater[i] + 1;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (nd < distWater[ni]) {
        distWater[ni] = nd;
        queue[qTail++] = ni;
      }
    }
  }

  const waterScale = Math.max(6, (width + height) * 0.04);
  const hab = new Grid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (water.oceanMask[i] === 1 || water.lakeMask[i] === 1) continue;
      const eAbove = (elevation.data[i] - seaLevel) * inv;
      if (eAbove > 0.75) continue; // too high to settle

      const t = temperature.data[i];
      const m = moisture.data[i];
      const tempScore = 1 - Math.min(1, Math.abs(t - 0.55) / 0.45);
      const moistScore =
        smoothstep(0.1, 0.5, m) * (1 - 0.4 * smoothstep(0.85, 1, m));
      const elevScore = 1 - Math.max(0, eAbove);
      const slope =
        Math.abs(
          elevation.getClamped(x + 1, y) - elevation.getClamped(x - 1, y),
        ) +
        Math.abs(
          elevation.getClamped(x, y + 1) - elevation.getClamped(x, y - 1),
        );
      const slopeScore = 1 - Math.min(1, slope * 8);
      const waterScore = 1 - Math.min(1, distWater[i] / waterScale);

      hab.data[i] =
        0.2 * tempScore +
        0.16 * moistScore +
        0.14 * elevScore +
        0.1 * slopeScore +
        0.4 * waterScore;
    }
  }
  return hab;
}

export function generateSettlements(
  elevation      ,
  temperature      ,
  moisture      ,
  water            ,
  rivers            ,
  regions             ,
  seaLevel        ,
  cfg                  ,
)                  {
  const { width, height } = elevation;
  const n = width * height;
  const habitability = habitabilityField(
    elevation,
    temperature,
    moisture,
    water,
    rivers,
    seaLevel,
  );

  // Candidate land cells with meaningful habitability, sorted best-first.
  // Fresh basalt is uninhabitable — skip lava fields outright.
  const lava = cfg.biomes?.ids;
  const candidates           = [];
  for (let i = 0; i < n; i++) {
    if (lava && lava[i] === Biome.LavaField) continue;
    if (habitability.data[i] > 0.3) candidates.push(i);
  }
  candidates.sort((a, b) => habitability.data[b] - habitability.data[a]);

  const landArea = regions.regions.reduce((s, r) => s + r.area, 0);
  const target =
    cfg.count ?? Math.max(6, Math.min(44, Math.round(landArea / 3200)));
  const minDist = Math.max(4, Math.sqrt(landArea / target) * 0.62);
  const minDist2 = minDist * minDist;

  const placed                                                            = [];
  for (const i of candidates) {
    if (placed.length >= target) break;
    const x = i % width;
    const y = (i / width) | 0;
    let ok = true;
    for (const p of placed) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (ok) placed.push({ x, y, i, score: habitability.data[i] });
  }

  // Tiers by rank; capital = best site. Ports sit within 2 cells of ocean.
  placed.sort((a, b) => b.score - a.score);
  const cityCut = Math.max(1, Math.round(placed.length * 0.15));
  const townCut = cityCut + Math.max(1, Math.round(placed.length * 0.3));

  const isPort = (x        , y        )          => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (water.oceanMask[ny * width + nx] === 1) return true;
      }
    }
    return false;
  };

  const usedNames = new Set        ();
  const settlements               = placed.map((p, rank) => {
    const regionId = regions.ids[p.i];
    const region = regions.regions.find((r) => r.id === regionId);
    const lang = languageById(region?.languageId ?? "meridian");
    const nameRng = new Rng(`${cfg.seed}:town:${rank}`);
    const tier                 =
      rank < cityCut ? "city" : rank < townCut ? "town" : "village";
    const port = isPort(p.x, p.y);

    // Name the town for what a traveller would notice first — the harbour, the
    // river it fords, the mountain above it — and only then the countryside.
    const hints           = [];
    if (port) hints.push("sea");
    if (rivers.riverMask[p.i] === 1) hints.push("river");
    if (elevation.data[p.i] > 0.66) hints.push("mountain", "stone");
    if (region) hints.push(...hintsForBiome(region.dominantBiome));
    const named = composeName(lang, nameRng, { kind: tier, hints, avoid: usedNames });

    return {
      id: rank,
      x: p.x,
      y: p.y,
      name: named.name,
      gloss: named.gloss,
      regionId,
      tier,
      isPort: port,
      isCapital: rank === 0,
      score: p.score,
    };
  });

  return { settlements, habitability };
}
