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
import { languageById } from "./names.js";
import { composeName } from "./language.js";
                                                            
                                                   
                                                 

                        
                  
                    
                                              
                                                            
                
 

                        
                  
                                            
                    
                  
                                                                    
                    
 

                         
               
               
                      
 

                            
                  
                  
                    
                                          
                                             
                                                      
                       
 

                             
               
                                                                   
                      
 

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

// How a culture's people live — but geography gets a veto. The old version
// gave every Auld region "sea-wise" folk (inland ones included) and every
// Meridian region "vineyards" (bare alpine peaks included), and repeated the
// same line for ten regions running (found by reading, Session 27). Each
// culture now has coastal, inland, and hard-country banks, drawn per region
// from a private stream.
const COLD_BIOMES = new Set        ([
  Biome.Snow, Biome.Alpine, Biome.Tundra, Biome.ColdDesert, Biome.Taiga,
]);

const CULTURE_FLAVOR                                                                        = {
  auld: {
    coast: [
      "its folk hardy and sea-wise",
      "whalers' fires burning on its headlands",
      "its people reckoning wealth in boats and grudges",
    ],
    inland: [
      "its folk hardy and long of memory",
      "herders of the high pastures, sparing with words",
      "its halls warm precisely because the land is not",
    ],
    hard: [
      "its folk hardy and long of memory",
      "a country crossed on skis half the year",
      "where hospitality is law because the weather enforces it",
    ],
  },
  meridian: {
    coast: [
      "a country of vineyards and old stone towns",
      "terraced hills running down to busy water",
      "its harbours louder than its temples",
    ],
    inland: [
      "a country of orchards and drove-roads",
      "wheat country, its towns grown fat on the fields between them",
      "old stone towns strung along older roads",
    ],
    hard: [
      "high herding country, its stone villages shuttered half the year",
      "a hard country the southern tongue softens in the telling",
      "a country that keeps the old roads and the old prayers",
    ],
  },
  kesh: {
    coast: [
      "its people pearl-divers and salt-traders",
      "where the caravans meet the tide, and both leave richer",
      "its ports paved with other countries' coin",
    ],
    inland: [
      "its people caravan-traders and readers of stars",
      "well-keepers and star-readers, rich in patience",
      "a country crossed at night and remembered by its wells",
    ],
    hard: [
      "its people caravan-traders and readers of stars",
      "a country of stone shelters and long silences",
      "where every spring has a name and a keeper",
    ],
  },
  sylvan: {
    coast: [
      "its villages half-hidden where the trees meet the water",
      "its people boat-builders who never quite trust open water",
      "green to the tide-line, and quiet",
    ],
    inland: [
      "its villages half-hidden among the trees",
      "its people patient as the woods they keep",
      "where the paths are known and the maps are not",
    ],
    hard: [
      "its villages few and its woods listened to",
      "its people patient as the woods they keep",
      "where winter is answered with woodsmoke and silence",
    ],
  },
};

function describeRegion(
  region            ,
  seatTowns              ,
  rng     ,
)         {
  const phrase = BIOME_PHRASE[region.dominantBiome] ?? "wild country";
  const banks = CULTURE_FLAVOR[region.languageId];
  const bank = !banks
    ? ["a land apart"]
    : COLD_BIOMES.has(region.dominantBiome)
      ? banks.hard
      : region.coastal
        ? banks.coast
        : banks.inland;
  const flavor = rng.pick(bank);
  const shore = region.coastal ? "a coast" : "an inland reach";
  const seat = seatTowns.find((s) => s.isCapital) ?? seatTowns[0];
  const seatClause = seat ? `, seat of ${seat.name}` : "";
  // Vary the frame as well as the words — ten identical sentence shapes in a
  // row read like a form letter even when the words differ. The frames avoid
  // verbs whose number would have to agree with the biome phrase ("barrens
  // stretches" once slipped through).
  const shape = rng.int(0, 3);
  if (shape === 1) {
    return `${region.name} is ${region.coastal ? "a shore" : "a country"} of ${phrase} — ${flavor}${seatClause}.`;
  }
  if (shape === 2) {
    return `In ${region.name}, ${phrase} and little else${region.coastal ? " but the sea" : ""}; ${flavor}${seatClause}.`;
  }
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
    const houseWord = composeName(lang, new Rng(`${cfg.seed}:house:${realm.id}`), {
      kind: "house",
    });
    const houseName = houseWord.name;
    houses.push({
      realmId: realm.id,
      realmName: realm.name,
      name: houseName,
      gloss: houseWord.gloss,
    });

    // The house reigns from its founding right up to the present day. (It used
    // to stop after nine rulers, leaving centuries of the chronicle kingless.)
    const present = cfg.presentYear;
    let year = realm.foundedYear;
    let n = 0;
    // A house reuses given names across the centuries, as houses do — but a
    // second Meontai is "Meontai II", not an apparent typo (Session 27: two
    // consecutive identical rulers read as a bug, because unnumbered they are).
    const givenCounts = new Map                ();
    const NUMERALS = ["", "", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
    while (year < present && n < 80) {
      const reign = rng.int(12, 42);
      const given = composeName(lang, new Rng(`${cfg.seed}:ruler:${realm.id}:${n}`), {
        kind: "person",
      }).name;
      const nth = (givenCounts.get(given) ?? 0) + 1;
      givenCounts.set(given, nth);
      const numeral = NUMERALS[Math.min(nth, NUMERALS.length - 1)];
      const epithet = rng.bool(0.4) ? ` ${rng.pick(EPITHETS)}` : "";
      const endYear = Math.min(year + reign, present);
      rulers.push({
        realmId: realm.id,
        name: `${given}${numeral} ${houseName}${epithet}`,
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

  // Region prose — each region on its own private stream, so the variety
  // never shifts the reign lengths drawn from the main stream above.
  const regionDescriptions                         = {};
  for (const region of regions.regions) {
    regionDescriptions[region.id] = describeRegion(
      region,
      townsByRegion.get(region.id) ?? [],
      new Rng(`${cfg.seed}:regiondesc:${region.id}`),
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
    const name = composeName(langFor(spec.region), new Rng(`${rng.next()}`), {
      kind: "person",
    }).name;
    figures.push({
      name: `${name}, ${spec.role}`,
      role: spec.role,
      description: `${name} ${spec.make()}.`,
    });
  }
  return figures;
}
