// religion.ts — L15: faiths and myths.
//
// A handful of faiths are born in the world's larger regions, each with a chief
// deity and a domain, and a creation myth that names the world's own features —
// the peak it was forged on, the river it set running, the lake it guards. Faiths
// then spread outward across the region-adjacency graph, so each region has a
// dominant faith. Pure content on a `religion` stream, downstream of geography.

import { Rng } from "./rng.js";
import { languageById } from "./names.js";
import { composeName } from "./language.js";
                                                
                                                 

                        
               
                                                                
                
                 
 

                        
             
               
                         
               
               
                            
 

                                
                  
                              
                                      
 

                                 
               
 

const DOMAINS = [
  "the Sea", "the Mountain", "the Harvest", "the Sky", "the Dead",
  "War", "the Sun", "the Storm", "the Forest", "the Hearth",
];

const FAITH_FORMS = ["the Faith of ", "the Way of ", "the Rite of ", "the Cult of "];

function mythFor(
  domain        ,
  deity        ,
  region        ,
  peak        ,
  river        ,
  lake        ,
)         {
  switch (domain) {
    case "the Sea":
      return `In the first age the waters covered all, until ${deity} drew up the land and set the ${river} running to the sea.`;
    case "the Mountain":
      return `${deity} raised ${peak} as a throne above the world, and from its slopes breathed life into the valleys of ${region}.`;
    case "the Harvest":
      return `${deity} scattered the first seed across ${region}; the golden fields were the gift, and the tithe the price.`;
    case "the Sky":
      return `${deity} hung the stars over ${region} and taught its first people to read them.`;
    case "the Dead":
      return `They say ${deity} keeps the gate beneath ${lake}, where all rivers end and all souls are counted.`;
    case "War":
      return `${deity} forged the first blade in the fires of ${peak} and gave it to the bold of ${region}.`;
    case "the Sun":
      return `Each dawn ${deity} drives the sun over ${peak}; the people of ${region} greet it with fire.`;
    case "the Storm":
      return `${deity} rides the storms down the ${river}, and ${region} both fears and blesses the rain.`;
    case "the Forest":
      return `${deity} planted the first tree in ${region} and hides still among the deep woods.`;
    default:
      return `${deity} lit the first hearth in ${region}, and its flame has never since gone out.`;
  }
}

export function generateReligion(
  regions             ,
  history              ,
  cfg                ,
)                {
  const rng = new Rng(cfg.seed);
  const regs = regions.regions;
  if (regs.length === 0) return { faiths: [], regionFaith: {} };

  const feat = (kind        ) => history.features.find((f) => f.kind === kind);
  const peak = feat("peak")?.name ?? "the mountain";
  const river = feat("river")?.name ?? "the river";
  const lake = feat("lake")?.name ?? "the lake";

  // Faith count scales with the world; origins are large, spread-out regions.
  const faithCount = Math.max(1, Math.min(4, Math.round(regs.length / 8)));
  const byArea = [...regs].sort((a, b) => b.area - a.area);
  const origins              = [];
  for (const r of byArea) {
    if (origins.length >= faithCount) break;
    // Prefer origins in regions of a culture not yet represented.
    if (!origins.some((o) => o.languageId === r.languageId) || origins.length < 1) {
      origins.push(r);
    }
  }
  // Backfill toward faithCount with the largest remaining regions. Iterate a
  // monotonically increasing index — using origins.length as the index can spin
  // forever when that element is already an origin.
  for (let idx = 0; idx < byArea.length && origins.length < faithCount; idx++) {
    if (!origins.includes(byArea[idx])) origins.push(byArea[idx]);
  }

  const usedDomains = rng.shuffle([...DOMAINS]);
  const faiths          = origins.map((region, i) => {
    const lang = languageById(region.languageId);
    const deityWord = composeName(lang, new Rng(`${cfg.seed}:deity:${i}`), {
      kind: "deity",
    });
    const deityName = deityWord.name;
    const domain = usedDomains[i % usedDomains.length];
    const faithName =
      rng.pick(FAITH_FORMS) + deityName;
    return {
      id: i,
      name: faithName,
      originRegionId: region.id,
      deity: { name: deityName, gloss: deityWord.gloss, domain },
      myth: mythFor(domain, deityName, region.name, peak, river, lake),
      followerRegions: [],
    };
  });

  // Spread faiths across the region-adjacency graph (multi-source BFS).
  const regionFaith                         = {};
  const byId = new Map(regs.map((r) => [r.id, r]));
  const queue           = [];
  for (const f of faiths) {
    regionFaith[f.originRegionId] = f.id;
    queue.push(f.originRegionId);
  }
  let head = 0;
  while (head < queue.length) {
    const rid = queue[head++];
    const fid = regionFaith[rid];
    const region = byId.get(rid);
    if (!region) continue;
    for (const nb of region.neighbors) {
      if (!(nb in regionFaith)) {
        regionFaith[nb] = fid;
        queue.push(nb);
      }
    }
  }
  // Regions unreached by adjacency (islands): nearest origin by centroid.
  for (const r of regs) {
    if (r.id in regionFaith) continue;
    let best = faiths[0];
    let bestD = Infinity;
    for (const f of faiths) {
      const o = byId.get(f.originRegionId) ;
      const dx = o.cx - r.cx;
      const dy = o.cy - r.cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    regionFaith[r.id] = best.id;
  }

  for (const r of regs) {
    const f = faiths[regionFaith[r.id]];
    if (f) f.followerRegions.push(r.id);
  }

  return { faiths, regionFaith };
}
