// lore.ts — L12: peoples, rulers, and the words for places.
//
// Everything upstream is geography and demography — this is where the world
// grows a human voice. Each realm gets a ruling house and a line of named
// rulers with reign-years and epithets; a handful of non-royal figures are tied
// to real places; and every region earns a one-line prose description drawn
// from its climate, coast, culture, and towns. All deterministic (a dedicated
// `lore` stream), and all downstream of the physical world — so none of this
// touches the elevation golden hash.

import { Rng } from "./rng.js";
import { Biome } from "./biomes.js";
import { makeName, languageById } from "./names.js";
                                                            
                                                   
                                                 

                        
                  
                    
                                              
 

                        
                  
                                            
                    
                  
                                                                    
                    
 

                         
               
               
                      
 

                            
                  
                  
                    
                                          
                                             
                                                      
                       
 

                             
               
                                                                   
                      
 

const EPITHETS = [
  "the Great", "the Wise", "the Cruel", "the Navigator", "the Lawgiver",
  "the Bold", "the Young", "the Cursed", "the Builder", "the Pious",
  "the Conqueror", "the Fair", "the Mad", "the Just", "the Silent",
  "the Far-Sighted", "the Unlucky", "the Golden", "the Grim", "the Learned",
];

// A vivid phrase for each biome, used in region prose.
const BIOME_PHRASE                         = {
  [Biome.Ocean]: "open water",
  [Biome.Lake]: "still lakes",
  [Biome.Snow]: "snowbound heights",
  [Biome.Alpine]: "bare grey peaks",
  [Biome.Tundra]: "frozen barrens",
  [Biome.Taiga]: "dark pine forest",
  [Biome.ColdDesert]: "cold, stony flats",
  [Biome.Shrubland]: "windswept scrub",
  [Biome.Grassland]: "rolling grassland",
  [Biome.TemperateDesert]: "dry basin country",
  [Biome.TemperateForest]: "old broadleaf woods",
  [Biome.TemperateRainforest]: "mist-hung rainforest",
  [Biome.Desert]: "sun-scoured dunes",
  [Biome.Savanna]: "golden savanna",
  [Biome.TropicalSeasonalForest]: "monsoon forest",
  [Biome.TropicalRainforest]: "steaming jungle",
};

// A cultural flavor line per naming language.
const CULTURE_FLAVOR                         = {
  auld: "its folk hardy and sea-wise",
  meridian: "a country of vineyards and old stone towns",
  kesh: "its people caravan-traders and readers of stars",
  sylvan: "its villages half-hidden among the trees",
};

function describeRegion(region            , seatTowns              )         {
  const phrase = BIOME_PHRASE[region.dominantBiome] ?? "wild country";
  const flavor = CULTURE_FLAVOR[region.languageId] ?? "a land apart";
  const shore = region.coastal ? "a coast" : "an inland reach";
  const seat = seatTowns.find((s) => s.isCapital) ?? seatTowns[0];
  const seatClause = seat ? `, seat of ${seat.name}` : "";
  return `${region.name} is ${shore} of ${phrase}, ${flavor}${seatClause}.`;
}

export function generateLore(
  regions             ,
  settlements              ,
  history              ,
  cfg            ,
)            {
  const rng = new Rng(cfg.seed);

  // Group settlements by region for prose + figures.
  const townsByRegion = new Map                      ();
  for (const s of settlements) {
    const list = townsByRegion.get(s.regionId) ?? [];
    list.push(s);
    townsByRegion.set(s.regionId, list);
  }

  // Houses + ruler successions, one line per realm.
  const houses          = [];
  const rulers          = [];
  for (const realm of history.realms) {
    const region = regions.regions.find((r) => r.id === realm.regionId);
    const lang = languageById(region?.languageId ?? "meridian");
    const houseName = makeName(lang, new Rng(`${cfg.seed}:house:${realm.id}`));
    houses.push({ realmId: realm.id, realmName: realm.name, name: houseName });

    // The house reigns from its founding right up to the present day. (It used
    // to stop after nine rulers, leaving centuries of the chronicle kingless.)
    const present = cfg.presentYear;
    let year = realm.foundedYear;
    let n = 0;
    while (year < present && n < 80) {
      const reign = rng.int(12, 42);
      const given = makeName(lang, new Rng(`${cfg.seed}:ruler:${realm.id}:${n}`));
      const epithet = rng.bool(0.4) ? ` ${rng.pick(EPITHETS)}` : "";
      const endYear = Math.min(year + reign, present);
      rulers.push({
        realmId: realm.id,
        name: `${given} ${houseName}${epithet}`,
        startYear: year,
        endYear,
        reigning: endYear >= present,
      });
      year = endYear + 1;
      n++;
    }
  }

  const capital = settlements.find((s) => s.isCapital);
  const capitalHouse =
    houses.find((h) => h.realmId === capital?.regionId)?.name ??
    houses[0]?.name ??
    "—";

  // Notable non-royal figures tied to real places.
  const figures = makeFigures(rng, regions, settlements, history);

  // Region prose.
  const regionDescriptions                         = {};
  for (const region of regions.regions) {
    regionDescriptions[region.id] = describeRegion(
      region,
      townsByRegion.get(region.id) ?? [],
    );
  }

  return { houses, rulers, figures, regionDescriptions, capitalHouse };
}

function makeFigures(
  rng     ,
  regions             ,
  settlements              ,
  history              ,
)           {
  const figures           = [];
  const cities = settlements.filter((s) => s.tier === "city");
  const ports = settlements.filter((s) => s.isPort);
  const peak = history.features.find((f) => f.kind === "peak");
  const river = history.features.find((f) => f.kind === "river");
  const lake = history.features.find((f) => f.kind === "lake");
  const capital = settlements.find((s) => s.isCapital);

  const langFor = (regionId        ) =>
    languageById(
      regions.regions.find((r) => r.id === regionId)?.languageId ?? "meridian",
    );

  // A menu of figure archetypes; each is added only if its subject exists.
                                                                                
  const specs         = [
    {
      role: "the Explorer",
      ok: !!ports.length && !!river,
      region: (ports[0] ?? capital)?.regionId ?? 0,
      make: () =>
        `charted the far coasts and traced the ${river .name} to its source`,
    },
    {
      role: "the Heretic",
      ok: !!capital,
      region: capital?.regionId ?? 0,
      make: () => `was exiled from ${capital .name} for denying the old gods`,
    },
    {
      role: "the Architect",
      ok: cities.length >= 2,
      region: cities[0]?.regionId ?? 0,
      make: () =>
        `raised the great road between ${cities[0].name} and ${cities[1].name}`,
    },
    {
      role: "the Scholar",
      ok: !!(lake ?? river),
      region: (cities[0] ?? capital)?.regionId ?? 0,
      make: () => `mapped the waters of ${(lake ?? river) .name}`,
    },
    {
      role: "the General",
      ok: cities.length >= 1,
      region: cities[0]?.regionId ?? 0,
      make: () => `broke the long siege of ${rng.pick(cities).name}`,
    },
    {
      role: "the Mountaineer",
      ok: !!peak,
      region: (cities[0] ?? capital)?.regionId ?? 0,
      make: () => `was first to stand atop ${peak .name} and return alive`,
    },
  ];

  const chosen = rng.shuffle(specs.filter((s) => s.ok)).slice(0, 4 + rng.int(0, 2));
  for (const spec of chosen) {
    const name = makeName(langFor(spec.region), new Rng(`${rng.next()}`));
    figures.push({
      name: `${name}, ${spec.role}`,
      role: spec.role,
      description: `${name} ${spec.make()}.`,
    });
  }
  return figures;
}
