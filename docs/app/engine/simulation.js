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
import { dist as euclid, dist2 } from "./exact.js";
import { Biome } from "./biomes.js";
import { makeName, languageById } from "./names.js";
import { composeLayered } from "./language.js";
                                                
                                                 
                                                   
                                                   
                                                 

                                                                 

                               
             
               
                                                                                 
                     
                      
                   
                   
                    
                      
 

                           
               
     
                                                                                
                                                                     
                                                                          
     
                                                                 
       
                
                
                
            
            
                 
              
              
              
                  
                  
               
                                                                            
            
            
 

                                  
               
                                                         
                                  
 

/**
 * A settlement's life across the simulated centuries. The world's settlements
 * (from L9) are not all as old as each other, and not all of them survive: a
 * city can be sacked in a conquest or abandoned when its country empties out.
 * `fellYear === undefined` means it stands to the present day — so the
 * present-day maps are exactly the survivors, and the fallen become ruins.
 */
                                  
                                      
            
            
               
               
                   
                     
                      
                    
                                     
                                
 

                                  
                
                    
                  
                     
                                                                             
                                                           
                               
                                                                
                                        
                                                               
                                       
                                      
                                     
                         
                          
                                                                                 
                                  
 

/** A settlement renamed because a foreign power held its region long enough. */
                                     
                       
                                                              
               
                
                                                                   
                     
                      
               
                                              
                      
                    
 

/** Settlements standing in a given year. */
export function settlementsAt(
  timeline                   ,
  year        ,
)                    {
  return timeline.filter(
    (s) => s.foundedYear <= year && (s.fellYear === undefined || year < s.fellYear),
  );
}

/** Ids of settlements that did NOT survive to the present day. */
export function ruinedSettlementIds(timeline                   )              {
  const out = new Set        ();
  for (const s of timeline) if (s.fellYear !== undefined) out.add(s.id);
  return out;
}

                                   
               
                 
                        
                     
 

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
      snapshots: [],
      settlementTimeline: [],
      finalControl: {},
      population: {},
      realms: [],
      survivingRealms: 0,
      renamings: [],
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
      name: hist
        ? hist.name
        : makeName(lang, new Rng(`${cfg.seed}:realm:${regionId}`), { kind: "realm" }),
      languageId: reg.languageId,
      aggression: 0.6 + rng.next() * 1.2,
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
      name: makeName(lang, new Rng(`${cfg.seed}:realm:${biggest.id}`), { kind: "realm" }),
      languageId: biggest.languageId,
      aggression: 0.6 + rng.next() * 1.2,
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

  // Every world gets at least one would-be conqueror. Without this, a map of
  // uniformly timid realms simply never goes to war and the chronicle is empty.
  if (realms.length > 1) {
    let boldest = realms[0];
    for (const r of realms) if (r.aggression > boldest.aggression) boldest = r;
    if (boldest.aggression < 1.35) boldest.aggression = 1.35 + rng.next() * 0.25;
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
      const d = dist2(seat.cx - r.cx, seat.cy - r.cy);
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

  // --- Balance of power ---------------------------------------------------
  // Raw strength grows with every conquest, which alone produces a runaway
  // empire on every world. Three counter-forces keep outcomes varied:
  //   1. OVEREXTENSION — a sprawling realm projects less force per front.
  //   2. DISTANCE — armies weaken far from their capital.
  //   3. HOME GROUND — defenders fight harder on their own soil.
  // Plus war exhaustion (cooldowns) and unrest/revolt in freshly taken land.
  const DISTANCE_PENALTY = 2.0; // beyond the free radius, per map-diagonal
  const FREE_RADIUS = 0.18; // neighbouring wars cost no distance penalty
  const DEFENDER_BONUS = 1.15;
  const HOME_GROUND = 0.3; // extra weight on the defended region's own people
  const ATTACK_RATIO = 0.8; // bold realms will gamble on losing odds
  const CONQUEST_COOLDOWN = 1; // turns a realm must rest after taking land
  const UNREST_TURNS = 3;

  /**
   * How steeply boldness lowers the odds a realm will accept. This used to be
   * `Math.pow(a, 1.6)`. The exponent is a tuning knob, and 1.5 is `a * sqrt(a)`
   * — pure exact arithmetic, so the same war gets declared on every engine.
   */
  const aggressionCurve = (a        )         => a * Math.sqrt(a);

  // Each world has its own temperament. Low cohesion → unruly peoples, empires
  // fray and fragment. High cohesion → conquests stick and a great power can
  // unify the map. This is what makes outcomes differ from world to world
  // instead of every history ending the same way.
  const cohesion = 0.6 + rng.next() * 0.9; // 0.6 unruly … 1.5 cohesive
  const OVEREXTENSION = 0.1 / cohesion; // per region beyond the first
  const REVOLT_CHANCE = 0.1 / cohesion; // scaled up again for overextended empires
  const SECESSION_RATE = 0.06 / cohesion;

  // Scale for distance penalties: the diagonal of the region-centroid bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of regs) {
    if (r.cx < minX) minX = r.cx;
    if (r.cx > maxX) maxX = r.cx;
    if (r.cy < minY) minY = r.cy;
    if (r.cy > maxY) maxY = r.cy;
  }
  const mapDiag = Math.max(1, euclid(maxX - minX, maxY - minY));

  /** Force a realm can actually bring to bear on `target`. */
  const projectedStrength = (realm       , targetId        )         => {
    const raw = strengthOf(realm);
    const overext = 1 + OVEREXTENSION * (realm.regions.size - 1);
    const seat = byId.get(realm.seatRegion);
    const target = byId.get(targetId);
    let dist = 0;
    if (seat && target) dist = euclid(seat.cx - target.cx, seat.cy - target.cy) / mapDiag;
    const far = Math.max(0, dist - FREE_RADIUS); // border wars aren't penalised
    return raw / (overext * (1 + DISTANCE_PENALTY * far));
  };

  /** Force a realm musters defending `target` — home ground counts extra. */
  const defenceOf = (realm       , targetId        )         => {
    const raw = strengthOf(realm);
    const overext = 1 + OVEREXTENSION * 0.5 * (realm.regions.size - 1);
    const local = (population[targetId] ?? 0) * (0.5 + 0.5 * (prosperity[targetId] ?? 0));
    return (raw / overext) * DEFENDER_BONUS + HOME_GROUND * local;
  };

  /** Keep a realm's seat inside its own territory (capitals get conquered). */
  const ensureSeat = (realm       )       => {
    if (realm.regions.has(realm.seatRegion)) return;
    const next = [...realm.regions].sort((a, b) => a - b)[0];
    if (next !== undefined) realm.seatRegion = next;
  };

  /** Turn index until which a realm is exhausted from its last conquest. */
  const cooldown = new Map                ();
  /** Region id → turns of unrest remaining after being conquered. */
  const unrest = new Map                ();

  // --- Settlement timeline. The best sites are the oldest; every town is
  // founded within the first half of the span so the present-day map is settled.
  const spanEnd = startYear + turns * yearsPerTurn;
  const byScore = [...settlements].sort((a, b) => b.score - a.score || a.id - b.id);
  const foundSpan = (spanEnd - startYear) * 0.55;
  const settlementTimeline                    = byScore.map((s, i) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    name: s.name,
    tier: s.tier,
    regionId: s.regionId,
    isCapital: s.isCapital,
    foundedYear: Math.round(
      startYear + (i / Math.max(1, byScore.length - 1)) * foundSpan,
    ),
  }));
  const townsByRegion = new Map                           ();
  for (const ts of settlementTimeline) {
    const list = townsByRegion.get(ts.regionId) ?? [];
    list.push(ts);
    townsByRegion.set(ts.regionId, list);
  }
  // Never let the whole map turn to ruins — and never the capital, which the
  // present-day metadata names.
  const maxRuins = Math.floor(settlementTimeline.length * 0.35);
  let ruinCount = 0;
  const canRuin = (ts                 , year        )          =>
    !ts.isCapital &&
    ts.fellYear === undefined &&
    ts.foundedYear < year && // a town must actually stand before it can fall
    ruinCount < maxRuins;

  // --- Real years, not round ones. The dynamics tick in 25-year turns, but a
  // chronicle whose every entry lands on a multiple of 25 reads like a ledger
  // of turns, not a history of years (user's note, Session 26). Each event is
  // dated to its own year inside the turn's window (turnYear, turnYear+25],
  // drawn from a PRIVATE stream so the dynamics never feel it. The cursor
  // never runs backwards, so the record's causal order — a fall after its
  // conquest, a sack during its war — survives the finer dating. Years land
  // in the window the turn's snapshot closes, so the Powers-map era markers
  // still bucket correctly. Declared fingerprint move: D-028.
  const yearJitter = new Rng(`${cfg.seed}:yearjitter`);
  let datedCursor = startYear;
  const dated = (turnYear        )         => {
    const lo = Math.max(turnYear + 1, datedCursor);
    const hi = turnYear + yearsPerTurn;
    // Draw short of the cap: the window's last year is a multiple of 25, and
    // history piling onto round years is exactly the ledger-feel to avoid.
    datedCursor = lo >= hi ? hi : lo + yearJitter.int(0, hi - lo);
    return datedCursor;
  };

  const ruinSettlement = (
    ts                 ,
    turnYear        ,
    fate                        ,
  )       => {
    const y = dated(turnYear);
    ts.fellYear = y;
    ts.fate = fate;
    ruinCount++;
    events.push({
      year: y,
      type: "ruin",
      actors: { place: ts.name },
      text:
        fate === "sacked"
          ? `${ts.name} was stormed and left a ruin.`
          : `${ts.name} was abandoned; its people drifted away.`,
      x: ts.x,
      y: ts.y,
    });
  };

  // --- Language contact. A region ruled by a foreign culture for this many
  // turns sees its towns' names layer: the land-word survives in the old tongue,
  // the settlement-word is re-said in the ruler's. Tracked from the deterministic
  // `control` state and composed with a PRIVATE Rng, so this never touches the
  // simulation's own stream — the fingerprint is unchanged by the renaming.
  const CONTACT_TURNS = 3;
  const foreignTurns = new Map                ();
  const renamed = new Set        ();
  const renamings                       = [];
  const settlementById = new Map(settlements.map((s) => [s.id, s]));
  // Present-day names must stay unique — the base namer guarantees it, and the
  // renaming must not break it (two towns both re-said as "Khirlamor" once
  // slipped through). Track the live name set as renames land.
  const takenNames = new Set(settlements.map((s) => s.name));

  // Chronicle events anchor to a marked place when the region has one: the
  // oldest town standing in that year. Clicking the chronicle then lands on a
  // town dot instead of empty countryside. (x/y are not part of the
  // fingerprint, so this is presentation, not history.)
  const anchorOf = (regionId        , year        )                           => {
    const towns = (townsByRegion.get(regionId) ?? [])
      .filter((t) => t.foundedYear <= year && (t.fellYear === undefined || t.fellYear >= year))
      .sort((a, b) => a.foundedYear - b.foundedYear || a.id - b.id);
    if (towns.length > 0) return { x: towns[0].x, y: towns[0].y };
    const reg = byId.get(regionId);
    return { x: reg?.cx ?? 0, y: reg?.cy ?? 0 };
  };

  // --- The tick loop. Record borders after every turn (plus the initial). ---
  const snapshots                    = [{ year: startYear, control: { ...control } }];
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
          { const at = anchorOf(r.id, year); events.push({ year: dated(year), type: "famine", actors: { place: r.name }, text: `Famine struck ${r.name}; the fields could not feed its people.`, x: at.x, y: at.y }); }
        }
      }
      population[r.id] = Math.max(0, pop);

      // A country that empties out cannot hold its towns.
      if (population[r.id] < capacity[r.id] * 0.2) {
        for (const ts of townsByRegion.get(r.id) ?? []) {
          if (canRuin(ts, year) && rng.next() < 0.3) {
            ruinSettlement(ts, year, "abandoned");
          }
        }
      }
    }

    // 2) Wars — a realm presses a neighbour only where it can actually project
    // more force than the defender musters on home ground.
    const opportunities                                                                 = [];
    for (const r of regs) {
      const owner = control[r.id];
      const ownerRealm = realmById.get(owner);
      if (!ownerRealm?.alive) continue;
      if ((cooldown.get(owner) ?? -1) > t) continue; // war-weary
      for (const nb of r.neighbors) {
        const other = control[nb];
        if (other === undefined || other === owner) continue;
        const otherRealm = realmById.get(other);
        if (!otherRealm?.alive) continue;
        const attack = projectedStrength(ownerRealm, nb);
        const defend = defenceOf(otherRealm, nb);
        const ratio = attack / (defend + 1);
        // A warlike realm marches on far thinner odds than a cautious one —
        // sometimes on odds so poor the invasion is thrown straight back.
        if (ratio > ATTACK_RATIO / aggressionCurve(ownerRealm.aggression)) {
          opportunities.push({ a: owner, b: other, region: nb, ratio });
        }
      }
    }
    opportunities.sort((p, q) => q.ratio - p.ratio || p.region - q.region);
    let conquests = 0;
    const maxConquests = 1 + rng.int(0, 2);
    const grabbed = new Set        ();
    for (const op of opportunities) {
      if (conquests >= maxConquests) break;
      if (grabbed.has(op.region)) continue;
      if (control[op.region] !== op.b) continue; // may have changed
      if ((cooldown.get(op.a) ?? -1) > t) continue;
      const attacker = realmById.get(op.a) ;
      const defender = realmById.get(op.b) ;
      if (rng.next() >= 0.3 + 0.3 * attacker.aggression) continue; // no march this turn
      conquests++;
      grabbed.add(op.region);
      const cr = byId.get(op.region) ;

      // Favourable odds are not certain ones — invasions can be thrown back.
      const successProb = Math.max(0.2, Math.min(0.9, (op.ratio - 0.7) / 1.3));
      if (rng.next() >= successProb) {
        population[op.region] *= 0.96; // the border bleeds either way
        cooldown.set(op.a, t + CONQUEST_COOLDOWN + 1); // a costly failure
        {
          const at = anchorOf(cr.id, year);
          events.push({
            year: dated(year),
            type: "repulsed",
            actors: { subject: attacker.name, object: defender.name, place: cr.name },
            text: `${attacker.name}'s invasion of ${cr.name} was thrown back by ${defender.name}.`,
            x: at.x,
            y: at.y,
          });
        }
        continue;
      }

      defender.regions.delete(op.region);
      attacker.regions.add(op.region);
      control[op.region] = op.a;
      population[op.region] *= 0.85; // the war costs lives
      unrest.set(op.region, UNREST_TURNS); // conquered land seethes
      cooldown.set(op.a, t + CONQUEST_COOLDOWN); // and the victor must rest
      ensureSeat(defender);
      ensureSeat(attacker);
      // Some cities do not survive their conquest.
      for (const ts of townsByRegion.get(op.region) ?? []) {
        if (canRuin(ts, year) && rng.next() < 0.15) {
          ruinSettlement(ts, year, "sacked");
        }
      }
      {
        const at = anchorOf(cr.id, year);
        events.push({
          year: dated(year),
          type: "conquest",
          actors: { subject: attacker.name, object: defender.name, place: cr.name },
          text: `${attacker.name} seized ${cr.name} from ${defender.name}.`,
          x: at.x,
          y: at.y,
        });
      }
      if (defender.regions.size === 0 && defender.alive) {
        defender.alive = false;
        { const at = anchorOf(cr.id, year); events.push({ year: dated(year), type: "fall", actors: { subject: defender.name, place: cr.name }, text: `The realm of ${defender.name} was extinguished.`, x: at.x, y: at.y }); }
      }
    }

    const aliveRealms = realms.filter((r) => r.alive);
    const avgSize =
      aliveRealms.reduce((s, r) => s + r.regions.size, 0) / Math.max(1, aliveRealms.length);

    // 2b) Revolts — freshly conquered land throws off its new masters, and the
    // more overextended the empire, the likelier the province rises.
    for (const rid of [...unrest.keys()].sort((a, b) => a - b)) {
      const left = unrest.get(rid) ;
      if (left <= 0) {
        unrest.delete(rid);
        continue;
      }
      unrest.set(rid, left - 1);
      const owner = realmById.get(control[rid]);
      if (!owner?.alive || owner.regions.size <= 1) continue;
      const strain = Math.max(0.5, Math.min(2.5, owner.regions.size / Math.max(1, avgSize)));
      if (rng.next() >= REVOLT_CHANCE * strain) continue;
      const reg = byId.get(rid) ;
      const lang = languageById(reg.languageId);
      const revoltYear = dated(year); // the realm is founded the year it rose
      const rebel        = {
        id: nextRealmId++,
        name: makeName(lang, new Rng(`${cfg.seed}:revolt:${rid}:${t}`), { kind: "realm" }),
        languageId: reg.languageId,
        aggression: 0.6 + rng.next() * 1.2,
        seatRegion: rid,
        regions: new Set([rid]),
        alive: true,
        foundedYear: revoltYear,
        peakSize: 1,
        peakYear: revoltYear,
      };
      owner.regions.delete(rid);
      control[rid] = rebel.id;
      realms.push(rebel);
      realmById.set(rebel.id, rebel);
      unrest.delete(rid);
      ensureSeat(owner);
      {
        const at = anchorOf(reg.id, year);
        events.push({
          year: revoltYear,
          type: "revolt",
          actors: { subject: rebel.name, object: owner.name, place: reg.name },
          text: `${reg.name} rose against ${owner.name} and declared the free realm of ${rebel.name}.`,
          x: at.x,
          y: at.y,
        });
      }
    }

    // 3) Fragmentation — overgrown realms shed a breakaway state.
    for (const realm of aliveRealms) {
      if (realm.regions.size < 4) continue;
      // The more a realm outgrows its rivals, the harder it is to hold together.
      const strain = realm.regions.size / Math.max(1, avgSize);
      if (strain < 1.5) continue;
      if (rng.next() > Math.min(0.3, SECESSION_RATE * strain)) continue;

      const owned = [...realm.regions].sort((a, b) => a - b);
      const border = owned.find(
        (rid) =>
          rid !== realm.seatRegion &&
          (byId.get(rid)?.neighbors ?? []).some((nb) => control[nb] !== realm.id),
      );
      const startId = border ?? owned.find((rid) => rid !== realm.seatRegion);
      if (startId === undefined) continue;

      // Grow a contiguous cluster inside the realm — a breakaway with enough
      // land to actually survive as a rival.
      const clusterMax = Math.max(1, Math.min(3, Math.floor(realm.regions.size / 3)));
      const cluster           = [startId];
      const queue           = [startId];
      while (queue.length > 0 && cluster.length < clusterMax) {
        const cur = queue.shift() ;
        for (const nb of byId.get(cur)?.neighbors ?? []) {
          if (cluster.length >= clusterMax) break;
          if (realm.regions.has(nb) && nb !== realm.seatRegion && !cluster.includes(nb)) {
            cluster.push(nb);
            queue.push(nb);
          }
        }
      }
      if (cluster.length >= realm.regions.size) continue; // never secede the whole realm

      const reg = byId.get(startId) ;
      const lang = languageById(reg.languageId);
      const secessionYear = dated(year); // founded the year it broke away
      const newRealm        = {
        id: nextRealmId++,
        name: makeName(lang, new Rng(`${cfg.seed}:breakaway:${startId}:${t}`), { kind: "realm" }),
        languageId: reg.languageId,
        aggression: 0.6 + rng.next() * 1.2,
        seatRegion: startId,
        regions: new Set(cluster),
        alive: true,
        foundedYear: secessionYear,
        peakSize: cluster.length,
        peakYear: secessionYear,
      };
      for (const rid of cluster) {
        realm.regions.delete(rid);
        control[rid] = newRealm.id;
        unrest.delete(rid);
      }
      realms.push(newRealm);
      realmById.set(newRealm.id, newRealm);
      ensureSeat(realm);
      events.push({
        year: secessionYear,
        type: "secession",
        actors: { subject: newRealm.name, object: realm.name, place: reg.name },
        text:
          cluster.length > 1
            ? `${reg.name} and ${cluster.length - 1} neighbouring province(s) broke away from ${realm.name} to found the realm of ${newRealm.name}.`
            : `${reg.name} broke away from ${realm.name} to found the realm of ${newRealm.name}.`,
        x: anchorOf(reg.id, year).x,
        y: anchorOf(reg.id, year).y,
      });
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
          {
            const at = anchorOf(r.id, year);
            events.push({
              year: dated(year),
              type: "conversion",
              actors: { subject: faithName(faith[bestNb]), object: faithName(from), place: r.name },
              text: `${r.name} turned from ${faithName(from)} to ${faithName(faith[bestNb])}.`,
              x: at.x,
              y: at.y,
            });
          }
        }
      }
    }

    // 5) Shocks — a plague or drought now and then.
    if (rng.next() < 0.25) {
      const r = regs[rng.int(0, regs.length)];
      population[r.id] *= 0.45; // a true pestilence carries off a third or more
      const kind = rng.bool() ? "A plague swept" : "A long drought gripped";
      { const at = anchorOf(r.id, year); events.push({ year: dated(year), type: "plague", actors: { place: r.name }, text: `${kind} ${r.name}; many perished.`, x: at.x, y: at.y }); }
    }

    // 6) Golden ages for large, prosperous realms.
    if (rng.next() < 0.15) {
      const strong = aliveRealms.filter((r) => r.regions.size >= 3);
      if (strong.length) {
        const r = strong[rng.int(0, strong.length)];
        const seat = byId.get(r.seatRegion);
        events.push({
          year: dated(year),
          type: "goldenage",
          actors: { subject: r.name },
          text: `A golden age dawned over ${r.name}; its cities flourished as never before.`,
          x: seat?.cx ?? 0,
          y: seat?.cy ?? 0,
        });
      }
    }

    // 7) Language contact — long foreign rule layers a region's place-names.
    for (const r of regs) {
      const owner = realmById.get(control[r.id]);
      if (!owner?.alive || owner.languageId === r.languageId) {
        foreignTurns.set(r.id, 0); // native rule (or none) resets the clock
        continue;
      }
      const held = (foreignTurns.get(r.id) ?? 0) + 1;
      foreignTurns.set(r.id, held);
      if (held !== CONTACT_TURNS) continue; // trigger once, when it first sticks
      const fromLang = languageById(r.languageId);
      const toLang = languageById(owner.languageId);
      for (const ts of townsByRegion.get(r.id) ?? []) {
        if (ts.fellYear !== undefined || renamed.has(ts.id)) continue;
        const orig = settlementById.get(ts.id);
        if (!orig) continue;
        // Retry with a salted stream if the layered form collides with a name
        // already on the map; give up after a few — an unrenamed town is fine,
        // a duplicate name is not.
        let layered                                    = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          const candidate = composeLayered(
            fromLang,
            toLang,
            orig.gloss.split("-"),
            new Rng(`${cfg.seed}:contact:${ts.id}:${t}:${attempt}`),
          );
          if (!candidate || candidate.name === orig.name) continue;
          if (takenNames.has(candidate.name)) continue;
          layered = candidate;
          break;
        }
        if (!layered) continue;
        takenNames.delete(orig.name);
        takenNames.add(layered.name);
        renamed.add(ts.id);
        renamings.push({
          settlementId: ts.id,
          name: layered.name,
          gloss: layered.gloss,
          formerName: orig.name,
          formerGloss: orig.gloss,
          year: dated(year), // renames wear a real year too
          fromCulture: fromLang.label,
          toCulture: toLang.label,
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

    // Record this turn's borders.
    snapshots.push({ year: year + yearsPerTurn, control: { ...control } });
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
      languageId: r.languageId,
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
    snapshots,
    settlementTimeline,
    finalControl: control,
    population,
    realms: summaries,
    survivingRealms: realms.filter((r) => r.alive).length,
    renamings,
  };
}
