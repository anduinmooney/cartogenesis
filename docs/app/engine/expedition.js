// expedition.ts — L18: chartered expeditions (the world, walked where YOU point).
//
// The traveller's account (L17c) walks the roads the world happened to build;
// an expedition walks wherever the reader points. Given any two settlements,
// it finds a real route over the actual terrain — following roads where they
// serve, striking overland where they don't, and taking ship where the land
// gives out — then writes a dated journal of the crossing, leg by leg, from
// the route's actual cells.
//
// Three properties, in the house style (D-025):
//   1. STRICTLY DOWNSTREAM AND PURE. Reads the finished world, mutates
//      nothing. It is computed on demand (at click time in the app), not
//      inside generateWorld — the golden fingerprints cannot even see it.
//   2. DETERMINISTIC. Same world, same pair of towns, same journal to the
//      letter: routing uses only exact arithmetic (D-022) with total
//      tie-breaking, and the prose draws from a private stream keyed by
//      (seed, fromId, toId).
//   3. GROUNDED. Every place, ford, climb, ruin and volcano in the journal is
//      read out of the route's cells, never invented.

import { Rng } from "./rng.js";
import { dist } from "./exact.js";
import { Biome } from "./biomes.js";
import { languageById } from "./names.js";
import { composeName, glossPhrase } from "./language.js";
import { BIOME_UNDERFOOT } from "./journey.js";
                                      
                                                 
                                              
                                              
                                                
                                                   
                                            
                                              
                                                       
                                                 
import { RESOURCE_NAMES } from "./resources.js";

                                
                                                                          
                       
                                                    
                 
                                         
              
                                                             
                    
               
 

                             
              
                
                                           
                  
                        
                  
                                                
               
                                                    
                 
                 
               
 

                                  
                  
                    
                     
                     
                       
                   
                            
                       
                              
                        
         
                          
                     
                              
                        
    
 

// --- Terrain cost: how each biome slows a laden traveller. -------------------

const BIOME_COST                         = {
  [Biome.Snow]: 2.2,
  [Biome.Alpine]: 2.4,
  [Biome.Tundra]: 1.5,
  [Biome.Taiga]: 1.35,
  [Biome.ColdDesert]: 1.5,
  [Biome.Shrubland]: 1.1,
  [Biome.Grassland]: 1.0,
  [Biome.TemperateDesert]: 1.6,
  [Biome.TemperateForest]: 1.3,
  [Biome.TemperateRainforest]: 1.7,
  [Biome.Desert]: 1.9,
  [Biome.Savanna]: 1.05,
  [Biome.TropicalSeasonalForest]: 1.4,
  [Biome.TropicalRainforest]: 1.9,
  [Biome.LavaField]: 2.5,
};

const ROAD_COST = 0.4; // a road is worth walking three cells out of the way for
const SEA_COST = 2.6; // ship passage per cell — slow to charter, quick to sail
const EMBARK_COST = 14; // finding a boat (or a beach to land on) is not free
const FORD_COST = 1.1; // wading a river, added once per river cell off-road
const SLOPE_COST = 55; // per unit of normalized climb, uphill only

const SQRT2 = Math.sqrt(2);

/** N8 steps with their base move length (exact constants only). */
const STEPS                                          = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/**
 * Least-cost route between two cells over the real terrain (A*, 8-neighbour,
 * exact arithmetic, total deterministic ordering). Water is passable at a
 * price, so island towns are reachable — the journal will call it a voyage.
 */
function findRoute(input                 , start        , goal        )           {
  const { elevation, water, rivers, biomes, roads } = input;
  const { width, height, data } = elevation;
  const n = width * height;
  const gx = goal % width;
  const gy = (goal / width) | 0;

  const isWater = (i        ) => water.oceanMask[i] === 1 || water.lakeMask[i] === 1;
  const cellCost = (i        )         => {
    if (isWater(i)) return SEA_COST;
    if (roads.roadMask[i] === 1) return ROAD_COST;
    let c = BIOME_COST[biomes.ids[i]] ?? 1.2;
    if (rivers.riverMask[i] === 1) c += FORD_COST;
    return c;
  };

  const g = new Float64Array(n).fill(Infinity);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);

  // Binary heap of [f, g, cell] with a TOTAL order (f, then cell index) so the
  // expansion order — and therefore the route — is identical on every machine.
  const heapF           = [];
  const heapI           = [];
  const less = (a        , b        ) =>
    heapF[a] < heapF[b] || (heapF[a] === heapF[b] && heapI[a] < heapI[b]);
  const swap = (a        , b        ) => {
    const f = heapF[a];
    heapF[a] = heapF[b];
    heapF[b] = f;
    const i = heapI[a];
    heapI[a] = heapI[b];
    heapI[b] = i;
  };
  const push = (f        , i        ) => {
    heapF.push(f);
    heapI.push(i);
    let k = heapF.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (less(k, p)) {
        swap(k, p);
        k = p;
      } else break;
    }
  };
  const pop = ()         => {
    const top = heapI[0];
    const last = heapF.length - 1;
    swap(0, last);
    heapF.pop();
    heapI.pop();
    let k = 0;
    for (;;) {
      const l = k * 2 + 1;
      const r = l + 1;
      let m = k;
      if (l < heapF.length && less(l, m)) m = l;
      if (r < heapF.length && less(r, m)) m = r;
      if (m === k) break;
      swap(k, m);
      k = m;
    }
    return top;
  };

  const heuristic = (i        ) => {
    const x = i % width;
    const y = (i / width) | 0;
    return dist(x - gx, y - gy) * ROAD_COST; // admissible: no step is cheaper
  };

  g[start] = 0;
  push(heuristic(start), start);
  while (heapF.length > 0) {
    const cur = pop();
    if (closed[cur] === 1) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const x = cur % width;
    const y = (cur / width) | 0;
    const curWater = isWater(cur);
    for (const [dx, dy, len] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closed[ni] === 1) continue;
      let step = len * cellCost(ni);
      // Changing element — stepping aboard or ashore — costs a delay.
      if (isWater(ni) !== curWater) step += EMBARK_COST;
      // Climbing costs; descending is free (knees disagree, but they lose).
      const rise = data[ni] - data[cur];
      if (rise > 0 && !isWater(ni)) step += rise * SLOPE_COST;
      const ng = g[cur] + step;
      if (ng < g[ni]) {
        g[ni] = ng;
        cameFrom[ni] = cur;
        push(ng + heuristic(ni), ni);
      }
    }
  }

  if (cameFrom[goal] === -1 && goal !== start) return [];
  const path           = [goal];
  let at = goal;
  while (at !== start) {
    at = cameFrom[at];
    if (at === -1) return [];
    path.push(at);
  }
  return path.reverse();
}

// --- The journal. -------------------------------------------------------------

                    
                           
                
                      
                        
                         
                        
                                                          
 

export function charterExpedition(
  input                 ,
  fromId        ,
  toId        ,
)             {
  const { elevation, water, rivers, biomes, regions, roads, settlements, volcanoes } = input;
  const { width } = elevation;
  const m = input.meta;
  const rng = new Rng(`${m.seed}:expedition:${fromId}>${toId}`);
  const pick = (bank                   ) => rng.pick(bank);

  const byId = new Map(settlements.map((s) => [s.id, s]));
  const from = byId.get(fromId);
  const to = byId.get(toId);
  const fail = (title        , opening        )             => ({
    ok: false,
    title,
    opening,
    legs: [],
    closing: "",
    days: 0,
    path: [],
    fromId,
    toId,
  });
  if (!from || !to) return fail("An Expedition Miscarried", "No such town is on the charts.");
  if (fromId === toId) {
    return fail(
      `The Crossing of ${from.name}, by ${from.name}`,
      `Chartered to travel from ${from.name} to ${from.name}, I completed the crossing before breakfast and submitted my account, which the patron declined to pay.`,
    );
  }

  // The traveller speaks the from-town's tongue.
  const fromRegion = regions.regions.find((r) => r.id === from.regionId);
  const lang = languageById(fromRegion?.languageId ?? "meridian");
  const traveller = composeName(lang, new Rng(`${m.seed}:expedition-traveller:${fromId}>${toId}`), {
    kind: "person",
  });
  const persona = pick([
    "a surveyor of no fixed employer",
    "a courier who reads the letters only a little",
    "a widowed drover with strong opinions on fords",
    "a scholar of roads, which is to say a vagrant with a ledger",
    "a guide who has never once been lost longer than a week",
    "a spice-factor's agent, travelling on someone else's coin",
  ]);

  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  const path = findRoute(input, start, goal);
  if (path.length === 0) {
    return fail(
      `The Crossing to ${to.name}, Abandoned`,
      `I, ${traveller.name}, ${persona}, was chartered at ${from.name} to reach ${to.name}; no route over land or water could be found, and I record the failure so the next fool can skip the surveying.`,
    );
  }

  const isWater = (i        ) => water.oceanMask[i] === 1 || water.lakeMask[i] === 1;
  const metresOf = (v        ) =>
    v <= m.seaLevel ? 0 : Math.round(((v - m.seaLevel) / (1 - m.seaLevel)) * m.maxAltitudeMetres);

  // Standing settlements near the route become waypoints (rest stops).
  const ruined = new Set(
    input.simulation.settlementTimeline
      .filter((t) => t.fellYear !== undefined)
      .map((t) => t.id),
  );
  const cellTown = new Map                    ();
  for (const s of settlements) {
    if (ruined.has(s.id)) continue;
    cellTown.set(s.y * width + s.x, s);
  }

  // --- Split the route into legs: at element changes (land↔water), at towns
  // passed, and every ~55 cells so no single entry swallows a week.
  const MAXLEG = 55;
  const legsRaw                                                                         = [];
  let cur           = [path[0]];
  let curKind                 = isWater(path[0]) ? "sea" : "land";
  const flush = (waypoint             ) => {
    if (cur.length > 1) legsRaw.push({ kind: curKind, path: cur, waypoint });
    cur = [cur[cur.length - 1]];
  };
  for (let k = 1; k < path.length; k++) {
    const i = path[k];
    const kind                 = isWater(i) ? "sea" : "land";
    if (kind !== curKind) {
      flush();
      curKind = kind;
    }
    cur.push(i);
    const town = cellTown.get(i);
    if (town && town.id !== fromId && k < path.length - 1) flush(town);
    else if (cur.length >= MAXLEG) flush();
  }
  flush(to);

  // --- Facts of a leg, read from its cells (the journey's method, L17c). ---
  const factsOf = (cells          )           => {
    const regionSeq           = [];
    let fords = 0;
    let inRiver = false;
    let maxE = -Infinity;
    let onRoad = 0;
    const tally = new Map                ();
    for (const i of cells) {
      const rid = regions.ids[i];
      if (rid >= 0 && rid !== from.regionId && rid !== to.regionId) {
        const name = regions.regions.find((r) => r.id === rid)?.name;
        if (name && regionSeq[regionSeq.length - 1] !== name) regionSeq.push(name);
      }
      const onRiver = rivers.riverMask[i] === 1;
      if (onRiver && !inRiver) fords++;
      inRiver = onRiver;
      if (elevation.data[i] > maxE) maxE = elevation.data[i];
      if (roads.roadMask[i] === 1) onRoad++;
      tally.set(biomes.ids[i], (tally.get(biomes.ids[i]) ?? 0) + 1);
    }
    const endsMax = Math.max(
      elevation.data[cells[0] ?? 0] ?? 0,
      elevation.data[cells[cells.length - 1] ?? 0] ?? 0,
    );
    let dominantBiome = Biome.Grassland          ;
    let best = -1;
    for (const [b, count] of [...tally.entries()].sort((x, y) => x[0] - y[0])) {
      if (count > best && b !== Biome.Ocean && b !== Biome.Lake) {
        best = count;
        dominantBiome = b;
      }
    }
    let volcanoNear                     ;
    for (const v of volcanoes) {
      for (let k = 0; k < cells.length; k += 4) {
        const x = cells[k] % width;
        const y = (cells[k] / width) | 0;
        if (dist(v.x - x, v.y - y) <= 7) {
          volcanoNear = v;
          break;
        }
      }
      if (volcanoNear) break;
    }
    let ruinNear                      ;
    for (const t of input.simulation.settlementTimeline) {
      if (t.fellYear === undefined) continue;
      for (let k = 0; k < cells.length; k += 4) {
        const x = cells[k] % width;
        const y = (cells[k] / width) | 0;
        if (dist(t.x - x, t.y - y) <= 5) {
          ruinNear = { name: t.name, fate: t.fate ?? "abandoned", year: t.fellYear };
          break;
        }
      }
      if (ruinNear) break;
    }
    return {
      regionsCrossed: regionSeq.slice(0, 2),
      fords,
      climbMetres: Math.max(0, metresOf(maxE) - metresOf(endsMax)),
      dominantBiome,
      onRoadFraction: cells.length > 0 ? onRoad / cells.length : 0,
      volcanoNear,
      ruinNear,
    };
  };

  // --- Tell each leg. ---
  const legs                  = [];
  let day = 1;
  let lastBiome = -1;
  for (const leg of legsRaw) {
    const cells = leg.path;
    const leagues = Math.max(1, Math.round(cells.length / 3));
    const legDays = Math.max(1, Math.round(leagues / (leg.kind === "sea" ? 12 : 7)));
    const bits           = [];

    if (leg.kind === "sea") {
      bits.push(
        pick([
          `We found a master willing to take us across for an honest fare and a dishonest one, and paid the second.`,
          `The land gave out, so we took ship — ${leagues} league${leagues === 1 ? "" : "s"} of grey water.`,
          `A fishing boat carried us over; the crossing took ${legDays === 1 ? "less than a day" : `${legDays} days`}, most of it spent regretting breakfast.`,
          `We went by water. I will not pretend I was useful aboard.`,
        ]),
      );
      lastBiome = -1;
    } else {
      const f = factsOf(cells);
      const underfoot =
        f.dominantBiome === lastBiome
          ? pick([", the country unchanged", ", through more of the same", ""])
          : `, ${BIOME_UNDERFOOT[f.dominantBiome] ?? "through open country"}`;
      lastBiome = f.dominantBiome;
      const going =
        f.onRoadFraction > 0.6
          ? pick([`The road served us well here`, `We kept to the road`, `Good road this stretch`])
          : f.onRoadFraction > 0.2
            ? pick([`Road and rough ground by turns`, `The road came and went`])
            : pick([
                `No road runs this way; we made our own`,
                `We struck out overland, the mapmakers having given up before us`,
                `Open country, and slow going`,
              ]);
      bits.push(`${going} — ${leagues} league${leagues === 1 ? "" : "s"}${underfoot}.`);
      if (f.regionsCrossed.length) bits.push(`The way crossed ${f.regionsCrossed.join(" and then ")}.`);
      if (f.fords >= 3) bits.push(pick([`We forded until counting felt like boasting.`, `The country is all rivers here; our boots gave up drying.`]));
      else if (f.fords > 0 && rng.next() < 0.6) bits.push(pick([`One cold ford, taken at a run.`, `We crossed water once, boots held high.`]));
      if (f.climbMetres > 250) bits.push(`The land climbed some ${Math.round(f.climbMetres / 50) * 50} metres before relenting.`);
      if (f.volcanoNear) {
        bits.push(
          f.volcanoNear.status === "active"
            ? `Mount ${f.volcanoNear.name} smoked off to one side; we walked faster.`
            : `Mount ${f.volcanoNear.name} watched us pass, and said nothing.`,
        );
      }
      if (f.ruinNear) {
        bits.push(
          `We passed the remains of ${f.ruinNear.name}, ${f.ruinNear.fate === "sacked" ? "stormed" : "abandoned"} in ${f.ruinNear.year}. ${pick(["We did not camp there.", "Nobody suggested stopping.", "The dogs would not go in."])}`,
        );
      }
    }

    if (leg.waypoint && leg.waypoint.id !== toId) {
      const w = leg.waypoint;
      const eco = input.economy.economies.find((e) => e.settlementId === w.id);
      bits.push(
        `We rested at ${w.name}${eco?.produces.length ? ` — its market all ${eco.produces.slice(0, 2).map((k) => RESOURCE_NAMES[k]).join(" and ").toLowerCase()}` : ""}${pick([", and slept indoors for once.", "; the beds were honest.", ", where the innkeep overcharged us fairly.", "."])}`,
      );
    }

    legs.push({
      kind: leg.kind,
      path: cells,
      day,
      waypoint: leg.waypoint?.name,
      text: bits.join(" "),
    });
    day += legDays;
  }

  const totalDays = day - 1;
  const opening =
    `Chartered at ${from.name} in the year ${m.presentYear}: I, ${traveller.name}, ${persona}, ` +
    pick([
      `undertook to reach ${to.name} and to keep this journal honestly, which I have half done.`,
      `agreed to make the crossing to ${to.name} for a fee I now consider too small.`,
      `set out for ${to.name} with two companions, a mule, and an unwarranted confidence.`,
      `was engaged to survey the way to ${to.name}. What follows is the way.`,
    ]);

  const arrivalTags = to.isPort ? `a ${to.tier} with its face to the sea` : `a ${to.tier}`;
  const closing =
    `${to.name} — ${glossPhrase(to.gloss)} — is ${arrivalTags}, and after ${totalDays} day${totalDays === 1 ? "" : "s"} on the way, it looked like paradise. ` +
    pick([
      `The account is rendered; the mule is retired; I am for the inn.`,
      `Let the patron read this and reckon the fee again.`,
      `Whoever follows this route: the fords are real, the leagues are honest, and the inns improve as you go.`,
      `I sign this in a warm room, which forgives the whole road.`,
    ]);

  return {
    ok: true,
    title: `The Crossing from ${from.name} to ${to.name}`,
    opening,
    legs,
    closing,
    days: totalDays,
    path,
    fromId,
    toId,
  };
}
