// simulation.ts — L16: dynamic history.
//
// Everything before this describes the world at one frozen moment. This runs it
// FORWARD: a deterministic tick loop over many turns in which populations grow
// toward carrying capacity and crash in famines, realms conquer their weaker
// neighbours, overgrown empires fragment into breakaway states, plagues and
// droughts strike, and faiths spread. History stops being a template and becomes
// emergent — the chronicle, the final borders, and each realm's rise and fall
// all fall out of the simulation. Seeded on a `simulation` stream, so a world's
// whole future is still a pure function of its seed.

import { Rng } from "./rng.js";
import { Biome } from "./biomes.js";
import { makeName, languageById } from "./names.js";
                                                
                                                 
                                                   
                                                   
                                                 

                                                                 

                               
             
               
                      
                   
                   
                    
                      
 

                           
               
       
                
                
            
                 
              
              
                  
                  
               
                                                                            
            
            
 

                                  
                
                    
                  
                     
                                                               
                                       
                                      
                                     
                         
                          
 

                                   
               
                 
                        
                     
 

const BIOME_CAPACITY                         = {
  [Biome.Ocean]: 0,
  [Biome.Lake]: 0,
  [Biome.Grassland]: 1.0,
  [Biome.TemperateForest]: 0.9,
  [Biome.Savanna]: 0.8,
  [Biome.TemperateRainforest]: 0.8,
  [Biome.TropicalSeasonalForest]: 0.7,
  [Biome.TropicalRainforest]: 0.6,
  [Biome.Shrubland]: 0.6,
  [Biome.Taiga]: 0.5,
  [Biome.TemperateDesert]: 0.3,
  [Biome.Tundra]: 0.25,
  [Biome.ColdDesert]: 0.2,
  [Biome.Desert]: 0.15,
  [Biome.Alpine]: 0.1,
  [Biome.Snow]: 0.05,
};

                 
             
               
                     
                     
                       
                 
                      
                   
                   
 

export function generateSimulation(
  regions             ,
  history              ,
  religion               ,
  settlements              ,
  economy              ,
  cfg                  ,
)                  {
  const turns = cfg.turns ?? 40;
  const yearsPerTurn = cfg.yearsPerTurn ?? 25;
  const startYear = cfg.startYear ?? 100;
  const rng = new Rng(cfg.seed);

  const regs = [...regions.regions].sort((a, b) => a.id - b.id);
  const byId = new Map(regs.map((r) => [r.id, r]));
  const events             = [];

  if (regs.length === 0) {
    return {
      turns,
      startYear,
      endYear: startYear + turns * yearsPerTurn,
      events,
      finalControl: {},
      population: {},
      realms: [],
      survivingRealms: 0,
    };
  }

  // --- Per-region prosperity from the economy. ---
  const prosperity                         = {};
  const wealthByRegion = new Map                  ();
  for (const s of settlements) {
    const e = economy.economies.find((x) => x.settlementId === s.id);
    if (!e) continue;
    const list = wealthByRegion.get(s.regionId) ?? [];
    list.push(e.wealth);
    wealthByRegion.set(s.regionId, list);
  }
  for (const r of regs) {
    const list = wealthByRegion.get(r.id);
    prosperity[r.id] = list && list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0.25;
  }

  // --- Carrying capacity & initial population per region. ---
  const capacity                         = {};
  const population                         = {};
  for (const r of regs) {
    const bc = BIOME_CAPACITY[r.dominantBiome] ?? 0.3;
    capacity[r.id] = Math.max(50, r.area * bc * (0.6 + 0.8 * prosperity[r.id]));
    population[r.id] = capacity[r.id] * (0.35 + rng.next() * 0.25);
  }

  // --- Initial polities. Every region that holds a city or town starts as its
  // own petty realm; these consolidate through war over the run. Cities that
  // seat a named realm (from history) keep that name for continuity. ---
  const seats = settlements
    .filter((s) => s.tier === "city" || s.tier === "town")
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const seatByRegion = new Map                    ();
  for (const s of seats) if (!seatByRegion.has(s.regionId) && byId.has(s.regionId)) {
    seatByRegion.set(s.regionId, s);
  }

  const realms          = [];
  const realmById = new Map               ();
  const control                         = {};
  let nextRealmId = 0;
  const seatRegionIds = [...seatByRegion.keys()].sort((a, b) => a - b);
  for (const regionId of seatRegionIds) {
    const reg = byId.get(regionId) ;
    const hist = history.realms.find((r) => r.regionId === regionId);
    const lang = languageById(reg.languageId);
    const realm        = {
      id: nextRealmId++,
      name: hist ? hist.name : makeName(lang, new Rng(`${cfg.seed}:realm:${regionId}`)),
      languageId: reg.languageId,
      seatRegion: regionId,
      regions: new Set        (),
      alive: true,
      foundedYear: startYear,
      peakSize: 0,
      peakYear: startYear,
    };
    realms.push(realm);
    realmById.set(realm.id, realm);
  }
  // Fallback: no towns at all → one realm from the largest region.
  if (realms.length === 0) {
    const biggest = [...regs].sort((a, b) => b.area - a.area)[0];
    const lang = languageById(biggest.languageId);
    const realm        = {
      id: nextRealmId++,
      name: makeName(lang, new Rng(`${cfg.seed}:realm:${biggest.id}`)),
      languageId: biggest.languageId,
      seatRegion: biggest.id,
      regions: new Set        (),
      alive: true,
      foundedYear: startYear,
      peakSize: 0,
      peakYear: startYear,
    };
    realms.push(realm);
    realmById.set(realm.id, realm);
  }

  const queue           = [];
  for (const realm of realms) {
    control[realm.seatRegion] = realm.id;
    realm.regions.add(realm.seatRegion);
    queue.push(realm.seatRegion);
  }
  let head = 0;
  while (head < queue.length) {
    const rid = queue[head++];
    const owner = control[rid];
    for (const nb of byId.get(rid)?.neighbors ?? []) {
      if (!(nb in control) && byId.has(nb)) {
        control[nb] = owner;
        realmById.get(owner) .regions.add(nb);
        queue.push(nb);
      }
    }
  }
  // Unreached regions (islands) → nearest realm seat by centroid.
  for (const r of regs) {
    if (r.id in control) continue;
    let best = realms[0];
    let bestD = Infinity;
    for (const realm of realms) {
      const seat = byId.get(realm.seatRegion);
      if (!seat) continue;
      const d = (seat.cx - r.cx) ** 2 + (seat.cy - r.cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = realm;
      }
    }
    control[r.id] = best.id;
    best.regions.add(r.id);
  }

  const faith                         = { ...religion.regionFaith };
  const faithName = (fid        ) =>
    religion.faiths.find((f) => f.id === fid)?.name ?? "the old ways";

  const strengthOf = (realm       )         => {
    let s = 0;
    for (const rid of realm.regions) s += population[rid] * (0.5 + 0.5 * prosperity[rid]);
    return s;
  };

  // --- The tick loop. ---
  for (let t = 0; t < turns; t++) {
    const year = startYear + t * yearsPerTurn;

    // 1) Growth & famine.
    for (const r of regs) {
      const cap = capacity[r.id];
      let pop = population[r.id];
      pop += pop * 0.12 * (1 - pop / cap);
      if (pop > cap * 1.15) {
        pop *= 0.82;
        if (rng.next() < 0.15) {
          events.push({ year, type: "famine", text: `Famine struck ${r.name}; the fields could not feed its people.`, x: r.cx, y: r.cy });
        }
      }
      population[r.id] = Math.max(0, pop);
    }

    // 2) Wars — the strongest realms press their weaker neighbours.
    const opportunities                                                                 = [];
    for (const r of regs) {
      const owner = control[r.id];
      const ownerRealm = realmById.get(owner);
      if (!ownerRealm?.alive) continue;
      for (const nb of r.neighbors) {
        const other = control[nb];
        if (other === undefined || other === owner) continue;
        const otherRealm = realmById.get(other);
        if (!otherRealm?.alive) continue;
        const sa = strengthOf(ownerRealm);
        const sb = strengthOf(otherRealm);
        if (sa > sb) opportunities.push({ a: owner, b: other, region: nb, ratio: sa / (sb + 1) });
      }
    }
    opportunities.sort((p, q) => q.ratio - p.ratio || p.region - q.region);
    let conquests = 0;
    const maxConquests = 2 + rng.int(0, 3);
    const grabbed = new Set        ();
    for (const op of opportunities) {
      if (conquests >= maxConquests) break;
      if (grabbed.has(op.region)) continue;
      if (control[op.region] !== op.b) continue; // may have changed
      if (op.ratio > 1.3 && rng.next() < 0.5) {
        const attacker = realmById.get(op.a) ;
        const defender = realmById.get(op.b) ;
        defender.regions.delete(op.region);
        attacker.regions.add(op.region);
        control[op.region] = op.a;
        population[op.region] *= 0.9;
        grabbed.add(op.region);
        conquests++;
        const cr = byId.get(op.region) ;
        events.push({
          year,
          type: "conquest",
          text: `${attacker.name} seized ${cr.name} from ${defender.name}.`,
          x: cr.cx,
          y: cr.cy,
        });
        if (defender.regions.size === 0 && defender.alive) {
          defender.alive = false;
          events.push({ year, type: "fall", text: `The realm of ${defender.name} was extinguished.`, x: cr.cx, y: cr.cy });
        }
      }
    }

    // 3) Fragmentation — overgrown realms shed a breakaway state.
    const aliveRealms = realms.filter((r) => r.alive);
    const avgSize = aliveRealms.reduce((s, r) => s + r.regions.size, 0) / Math.max(1, aliveRealms.length);
    for (const realm of aliveRealms) {
      if (realm.regions.size > Math.max(4, avgSize * 2.2) && rng.next() < 0.2) {
        // A border region breaks away under a new house.
        const border = [...realm.regions].sort((a, b) => a - b).find((rid) =>
          (byId.get(rid)?.neighbors ?? []).some((nb) => control[nb] !== realm.id),
        );
        const rid = border ?? [...realm.regions].sort((a, b) => a - b)[0];
        const reg = byId.get(rid) ;
        const lang = languageById(reg.languageId);
        const newRealm        = {
          id: nextRealmId++,
          name: makeName(lang, new Rng(`${cfg.seed}:breakaway:${rid}:${t}`)),
          languageId: reg.languageId,
          regions: new Set([rid]),
          alive: true,
          foundedYear: year,
          peakSize: 1,
          peakYear: year,
        };
        realm.regions.delete(rid);
        realms.push(newRealm);
        realmById.set(newRealm.id, newRealm);
        control[rid] = newRealm.id;
        events.push({
          year,
          type: "secession",
          text: `${reg.name} broke away from ${realm.name} to found the realm of ${newRealm.name}.`,
          x: reg.cx,
          y: reg.cy,
        });
      }
    }

    // 4) Faith spread — regions drift toward a stronger neighbour's faith.
    for (const r of regs) {
      if (rng.next() > 0.12) continue;
      let bestNb = -1;
      let bestScore = population[r.id] * prosperity[r.id];
      for (const nb of r.neighbors) {
        const score = (population[nb] ?? 0) * (prosperity[nb] ?? 0);
        if (score > bestScore) {
          bestScore = score;
          bestNb = nb;
        }
      }
      if (bestNb >= 0 && faith[bestNb] !== faith[r.id]) {
        const from = faith[r.id];
        faith[r.id] = faith[bestNb];
        if (rng.next() < 0.25) {
          events.push({
            year,
            type: "conversion",
            text: `${r.name} turned from ${faithName(from)} to ${faithName(faith[bestNb])}.`,
            x: r.cx,
            y: r.cy,
          });
        }
      }
    }

    // 5) Shocks — a plague or drought now and then.
    if (rng.next() < 0.25) {
      const r = regs[rng.int(0, regs.length)];
      population[r.id] *= 0.6;
      const kind = rng.bool() ? "A plague swept" : "A long drought gripped";
      events.push({ year, type: "plague", text: `${kind} ${r.name}; many perished.`, x: r.cx, y: r.cy });
    }

    // 6) Golden ages for large, prosperous realms.
    if (rng.next() < 0.15) {
      const strong = aliveRealms.filter((r) => r.regions.size >= 3);
      if (strong.length) {
        const r = strong[rng.int(0, strong.length)];
        const seat = byId.get(r.seatRegion);
        events.push({
          year,
          type: "goldenage",
          text: `A golden age dawned over ${r.name}; its cities flourished as never before.`,
          x: seat?.cx ?? 0,
          y: seat?.cy ?? 0,
        });
      }
    }

    // Track peak territory.
    for (const realm of realms) {
      if (realm.alive && realm.regions.size > realm.peakSize) {
        realm.peakSize = realm.regions.size;
        realm.peakYear = year;
      }
    }
  }

  const endYear = startYear + turns * yearsPerTurn;
  const summaries                 = realms.map((r) => {
    const finalSize = r.alive ? r.regions.size : 0;
    const status              = !r.alive
      ? "extinct"
      : finalSize >= r.peakSize * 0.8
        ? "ascendant"
        : "diminished";
    return {
      id: r.id,
      name: r.name,
      foundedYear: r.foundedYear,
      peakSize: r.peakSize,
      peakYear: r.peakYear,
      finalSize,
      status,
    };
  });

  events.sort((a, b) => a.year - b.year);

  return {
    turns,
    startYear,
    endYear,
    events,
    finalControl: control,
    population,
    realms: summaries,
    survivingRealms: realms.filter((r) => r.alive).length,
  };
}
