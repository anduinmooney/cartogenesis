// journey.ts — L17c: a traveller's account.
//
// The chronicle looks down at the world from the chronicler's desk; this walks
// it. A named traveller — composed in the capital's own tongue — sets out from
// the capital in the present year and follows the REAL road network (the
// post-simulation, survivors-only MST) to every town a road can reach, telling
// each leg from the actual path cells: the provinces crossed, the rivers
// forded, the climbs, the volcanoes standing off the road, the ruins passed
// and not lingered at. Towns renamed by conquest are heard the way a traveller
// would hear them: the people still say the old name; the ledgers say the new.
//
// Same three laws as the chronicle and the sagas (D-025): strictly downstream,
// total in its own domain (every reachable town is visited — at most, distant
// ones are summarized by name), and grounded (every place, river count, ruin
// and ware is computed from the world, never invented).

import { Rng } from "./rng.js";
import { dist } from "./exact.js";
import { Biome } from "./biomes.js";
import { languageById } from "./names.js";
import { composeName, glossPhrase } from "./language.js";
                                      
                                                
                                                   
                                            
                                              
                                              
                                              
                                                       
                                                 
                                                   
import { RESOURCE_NAMES } from "./resources.js";

                             
                 
               
                
 

                          
                
                                        
                    
                     
                                                                                    
                    
 

                               
                  
                       
                     
                     
                   
                            
                       
                              
                        
                          
                                                                                              
 

/** How each biome feels underfoot, to a traveller in a hurry. Exported so the
 *  chartered expeditions (L18) walk the same countryside in the same words. */
export const BIOME_UNDERFOOT                         = {
  [Biome.Snow]: "over snowfields that squeaked underfoot",
  [Biome.Alpine]: "across bare rock where the wind never rests",
  [Biome.Tundra]: "over hard, treeless miles",
  [Biome.Taiga]: "through pinewood dark as evening",
  [Biome.ColdDesert]: "across cold gravel flats",
  [Biome.Shrubland]: "through thornscrub that plucked at our sleeves",
  [Biome.Grassland]: "through grass as high as the stirrup",
  [Biome.TemperateDesert]: "across pale drylands",
  [Biome.TemperateForest]: "under green galleries",
  [Biome.TemperateRainforest]: "through dripping, moss-hung forest",
  [Biome.Desert]: "across sand that rang underfoot at noon",
  [Biome.Savanna]: "through gold grass and scattered trees",
  [Biome.TropicalSeasonalForest]: "through warm woods loud with birds",
  [Biome.TropicalRainforest]: "down a road that was a green tunnel",
  [Biome.LavaField]: "across black basalt where nothing grows — old fire, cold now",
};

/** Everything a leg's real path tells us. */
                    
                           
                
                      
                        
                        
                           
                                                          
 

export function generateJourney(input              , cfg                  )          {
  const rng = new Rng(cfg.seed);
  const { elevation, regions, biomes, rivers, roads, settlements, volcanoes } = input;
  const { width } = elevation;
  const m = input.meta;

  const byId = new Map(settlements.map((s) => [s.id, s]));
  const capital = settlements.find((s) => s.isCapital) ?? settlements[0];

  const metresOf = (v        ) =>
    v <= m.seaLevel ? 0 : Math.round(((v - m.seaLevel) / (1 - m.seaLevel)) * m.maxAltitudeMetres);

  // --- The traveller, in the capital's own tongue. ---
  const capRegion = regions.regions.find((r) => r.id === capital?.regionId);
  const lang = languageById(capRegion?.languageId ?? "meridian");
  const traveller = composeName(lang, new Rng(`${cfg.seed}:traveller`), { kind: "person" });
  const persona = rng.pick([
    "a dealer in wool and salt",
    "a mapmaker's apprentice",
    "a pilgrim of no great piety",
    "a collector of road-tolls, lately retired from collecting them",
    "a buyer of horses and rumours",
    "a scribe whose physician prescribed walking",
  ]);

  if (!capital || roads.edges.length === 0) {
    return {
      title: "A Traveller's Account",
      opening: [
        `I, ${traveller.name}, ${persona}, meant to walk this country in the year ${m.presentYear}; but no road yet runs from ${capital?.name ?? "the capital"}, and an account of standing still is no account at all.`,
      ],
      legs: [],
      closing: [],
    };
  }

  // --- The road tree (Kruskal MST → acyclic), rooted at the capital. Each
  // edge is registered both ways, with the path reversed for the return
  // direction so the facts read in walking order.
  const adj = new Map                                                  ();
  const ruinedIds = new Set(
    input.simulation.settlementTimeline.filter((t) => t.fellYear !== undefined).map((t) => t.id),
  );
  const add = (a        , b        , path          ) => {
    (adj.get(a) ?? adj.set(a, []).get(a) ).push({ other: b, path });
  };
  for (const e of roads.edges) {
    if (ruinedIds.has(e.a) || ruinedIds.has(e.b)) continue;
    add(e.a, e.b, e.path);
    add(e.b, e.a, [...e.path].reverse());
  }

  // --- Read the facts out of a path's cells. ---
  const factsOf = (path          , fromId        , toId        )           => {
    const regionSeq           = [];
    const fromRegion = byId.get(fromId)?.regionId;
    const toRegion = byId.get(toId)?.regionId;
    let fords = 0;
    let inRiver = false;
    let maxE = -Infinity;
    const biomeTally = new Map                ();
    for (const i of path) {
      const rid = regions.ids[i];
      if (rid >= 0 && rid !== fromRegion && rid !== toRegion) {
        const name = regions.regions.find((r) => r.id === rid)?.name;
        if (name && regionSeq[regionSeq.length - 1] !== name) regionSeq.push(name);
      }
      const onRiver = rivers.riverMask[i] === 1;
      if (onRiver && !inRiver) fords++;
      inRiver = onRiver;
      if (elevation.data[i] > maxE) maxE = elevation.data[i];
      biomeTally.set(biomes.ids[i], (biomeTally.get(biomes.ids[i]) ?? 0) + 1);
    }
    const endsMax = Math.max(
      elevation.data[path[0] ?? 0] ?? 0,
      elevation.data[path[path.length - 1] ?? 0] ?? 0,
    );
    const climbMetres = Math.max(0, metresOf(maxE) - metresOf(endsMax));
    let dominantBiome = Biome.Grassland          ;
    let best = -1;
    for (const [b, n] of [...biomeTally.entries()].sort((x, y) => x[0] - y[0])) {
      if (n > best && b !== Biome.Ocean && b !== Biome.Lake) {
        best = n;
        dominantBiome = b;
      }
    }

    // Sights within a few cells of the path (sampled sparsely — this is prose,
    // not collision detection).
    const NEAR = 7;
    let volcanoNear                     ;
    let craterLakeNear                     ;
    for (const v of volcanoes) {
      for (let k = 0; k < path.length; k += 4) {
        const x = path[k] % width;
        const y = (path[k] / width) | 0;
        if (dist(v.x - x, v.y - y) <= NEAR) {
          if (v.caldera?.lakeLevel !== undefined) craterLakeNear ??= v;
          else volcanoNear ??= v;
          break;
        }
      }
    }
    let ruinNear                      ;
    for (const t of input.simulation.settlementTimeline) {
      if (t.fellYear === undefined) continue;
      for (let k = 0; k < path.length; k += 4) {
        const x = path[k] % width;
        const y = (path[k] / width) | 0;
        if (dist(t.x - x, t.y - y) <= 5) {
          ruinNear = { name: t.name, fate: t.fate ?? "abandoned", year: t.fellYear };
          break;
        }
      }
      if (ruinNear) break;
    }

    return { regionsCrossed: regionSeq.slice(0, 2), fords, climbMetres, dominantBiome, volcanoNear, craterLakeNear, ruinNear };
  };

  // --- Tell one leg. ---
  const pick = (bank                   ) => rng.pick(bank);
  let lastBiome = -1;
  let fordsSinceMention = 0;
  const FORD_WORDS = ["once", "twice", "three times", "four times"];
  const tellLeg = (from            , to            , path          , backtrackFrom             )         => {
    const f = factsOf(path, from.id, to.id);
    const leagues = Math.max(1, Math.round(path.length / 3));
    const bits           = [];

    // The countryside is described when it CHANGES; a traveller does not
    // re-introduce the same grass every morning.
    const underfoot =
      f.dominantBiome === lastBiome
        ? pick([", the country unchanged", ", through more of the same", ""])
        : `, ${BIOME_UNDERFOOT[f.dominantBiome] ?? "through open country"}`;
    lastBiome = f.dominantBiome;

    if (backtrackFrom) {
      bits.push(
        pick([
          `I went back down my own road as far as ${from.name}, then turned for ${to.name}.`,
          `There was nothing for it but to retrace my steps to ${from.name} and strike out for ${to.name}.`,
          `Back through ${from.name}, then — a road walked twice is half as long, whatever my boots say — and on to ${to.name}.`,
        ]),
      );
    } else {
      bits.push(
        pick([
          `From ${from.name} the road runs ${leagues} league${leagues === 1 ? "" : "s"} to ${to.name}`,
          `${to.name} lies ${leagues} league${leagues === 1 ? "" : "s"} on from ${from.name}`,
          `Out of ${from.name}, then, toward ${to.name}`,
          `Two days' walking took me from ${from.name} to ${to.name}`,
          `The ${to.name} road leaves ${from.name} by the ${leagues > 15 ? "long" : "short"} way`,
        ]) + underfoot + ".",
      );
    }

    if (f.regionsCrossed.length) {
      bits.push(`The way crosses ${f.regionsCrossed.join(" and then ")}.`);
    }
    // Fords earn a sentence the first few times; after that the traveller
    // mentions only the memorable crossings.
    if (f.fords > 0) {
      fordsSinceMention += f.fords;
      if (fordsSinceMention <= 4 || f.fords >= 3 || rng.next() < 0.3) {
        const word = FORD_WORDS[Math.min(f.fords, FORD_WORDS.length) - 1] ?? `${f.fords} times`;
        bits.push(
          f.fords === 1
            ? pick(["We forded once, boots held high.", "There is one ford, cold but honest."])
            : pick([
                `We forded ${word}; I stopped counting wet boots.`,
                `The road finds water ${word} on this stretch.`,
              ]),
        );
        fordsSinceMention = 0;
      }
    }
    if (f.climbMetres > 250) {
      bits.push(`The road climbs some ${Math.round(f.climbMetres / 50) * 50} metres before it thinks better of it.`);
    }
    if (f.craterLakeNear) {
      bits.push(`We turned aside to see the lake in Mount ${f.craterLakeNear.name}'s crater — water sitting where fire had been.`);
    } else if (f.volcanoNear) {
      bits.push(
        f.volcanoNear.status === "active"
          ? `Mount ${f.volcanoNear.name} smoked away to one side of the road; we did not linger.`
          : `Mount ${f.volcanoNear.name} stood over the road, quiet.`,
      );
    }
    if (f.ruinNear) {
      bits.push(
        `We passed what remains of ${f.ruinNear.name} — ${
          f.ruinNear.fate === "sacked" ? "stormed" : "abandoned"
        } in ${f.ruinNear.year} — and did not stop long.`,
      );
    }

    // Arrival.
    const eco = input.economy.economies.find((e) => e.settlementId === to.id);
    const arrival           = [];
    arrival.push(
      `${to.name} itself — ${glossPhrase(to.gloss)} — is a ${to.isPort ? `${to.tier} with its face to the sea` : to.tier}`,
    );
    if (eco?.produces.length) {
      arrival.push(`; its market is all ${eco.produces.slice(0, 2).map((k) => RESOURCE_NAMES[k]).join(" and ").toLowerCase()}`);
    }
    bits.push(arrival.join("") + ".");
    if (to.formerNames?.length) {
      const old = to.formerNames[to.formerNames.length - 1];
      bits.push(`The people here still say ${old.name}; the ledgers say ${to.name}. I bought bread in both names.`);
    }
    return bits.join(" ");
  };

  // --- Walk the tree, depth-first, children in id order. ---
  const MAX_TOLD = 18;
  const legs               = [];
  const visited = new Set        ([capital.id]);
  const summarized           = [];
  let position = capital;

  const walk = (at            ) => {
    const children = (adj.get(at.id) ?? [])
      .filter((e) => !visited.has(e.other))
      .sort((a, b) => a.other - b.other);
    for (const e of children) {
      if (visited.has(e.other)) continue;
      const to = byId.get(e.other);
      if (!to) continue;
      visited.add(to.id);
      if (legs.length < MAX_TOLD) {
        const backtrack = position.id !== at.id ? at : undefined;
        legs.push({ fromId: at.id, toId: to.id, prose: tellLeg(at, to, e.path, backtrack) });
        position = to;
      } else {
        summarized.push(to.name);
      }
      walk(to);
    }
  };
  walk(capital);

  // --- Frame. ---
  const year = m.presentYear;
  const opening = [
    `I, ${traveller.name}, ${persona}, set out from ${capital.name} in the spring of ${year} to see how much of this country a pair of boots could hold. What follows is the road as I found it — no more, and I hope no less.`,
  ];

  const unreachable = settlements.filter((s) => !visited.has(s.id) && !ruinedIds.has(s.id));
  const closing           = [];
  if (summarized.length) {
    closing.push(
      `The rest of that country I crossed more quickly than it deserved: ${summarized.join(", ")} — each worth a page I did not have.`,
    );
  }
  if (unreachable.length) {
    closing.push(
      `Of ${unreachable.map((s) => s.name).join(" and ")} I say nothing, for no road goes there; they keep to their water, and perhaps they are right to.`,
    );
  }
  closing.push(
    pick([
      `I came home by the same roads, which were somehow longer in that direction. ${traveller.name}, ${year}.`,
      `My boots did not survive the year. The account did. ${traveller.name}, ${year}.`,
      `I do not say I saw everything; I say I walked past it. ${traveller.name}, ${year}.`,
      `Whoever walks these roads after me: the fords are colder than they look. ${traveller.name}, ${year}.`,
    ]),
  );

  return {
    title: `A Traveller's Account, in the year ${year}`,
    opening,
    legs,
    closing,
  };
}
