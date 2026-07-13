// saga.ts — L17b: the founding sagas.
//
// The chronicle (narrative.ts) tells what the simulation recorded; the sagas
// tell what each people BELIEVES about itself. One saga per culture present in
// the world, in short verse: how the folk came to their heartland, what they
// named it and why (the lexicon's own roots, glossed into the lines), the first
// city they raised, the god they set over it, and how their greatest realm
// fared — proud if it stands, elegiac if the simulation extinguished it.
//
// Same three laws as the chronicle (D-025): strictly downstream (private
// stream, fingerprints untouched), grounded (every proper name and every root
// is real), and honest — a saga may boast, but its facts are the world's facts.

import { Rng } from "./rng.js";
import { languageById } from "./names.js";
import { glossPhrase, lexiconOf } from "./language.js";
                                                
                                                   
                                                   
                                                       

                       
                                                                               
                    
                       
                
                                                    
                  
 

                             
               
 

const EPITHET                         = {
  auld: "northern",
  meridian: "southern",
  kesh: "desert",
  sylvan: "woodland",
};

/** The land a culture crossed to arrive, in its saga's imagination. */
const CROSSING                         = {
  auld: "the grey water",
  meridian: "the warm sea",
  kesh: "the singing sands",
  sylvan: "the deep wood",
};

export function generateSagas(
  regions             ,
  settlements              ,
  religion               ,
  simulation                 ,
  cfg            ,
)         {
  const rng = new Rng(cfg.seed);
  const sagas         = [];

  // Cultures present, largest homeland first — the world's peoples in order.
  const areaByCulture = new Map                ();
  for (const r of regions.regions) {
    areaByCulture.set(r.languageId, (areaByCulture.get(r.languageId) ?? 0) + r.area);
  }
  const cultures = [...areaByCulture.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([id]) => id);

  for (const cultureId of cultures) {
    const lang = languageById(cultureId);
    const lex = lexiconOf(lang);
    const epithet = EPITHET[cultureId] ?? "far";

    // The culture's world, in facts.
    const theirRegions = regions.regions
      .filter((r) => r.languageId === cultureId)
      .sort((a, b) => b.area - a.area);
    const heartland = theirRegions[0];
    if (!heartland) continue;
    const regionIds = new Set(theirRegions.map((r) => r.id));
    const theirTowns = settlements
      .filter((s) => regionIds.has(s.regionId))
      .sort((a, b) => a.id - b.id); // lowest id = best site = the elder city
    const firstCity = theirTowns[0];
    const faith = religion.faiths.find((f) => regionIds.has(f.originRegionId));
    const realm = [...simulation.realms]
      .filter((r) => r.languageId === cultureId)
      .sort((a, b) => b.peakSize - a.peakSize || a.id - b.id)[0];

    const lines           = [];

    // I. Arrival.
    const crossing = CROSSING[cultureId] ?? "the wide world";
    lines.push(
      rng.pick([
        `First came the ${epithet} folk over ${crossing},`,
        `Out of ${crossing} came the ${epithet} folk,`,
        `Long the ${epithet} folk wandered ${crossing},`,
        `It was hunger drove the ${epithet} folk across ${crossing},`,
      ]),
    );
    lines.push(
      heartland.coastal
        ? rng.pick([
            `and the shore they found they would not leave.`,
            `and where the water ended, so did the wandering.`,
          ])
        : rng.pick([
            `and the land they found they would not leave.`,
            `and here the road wore out before the people did.`,
          ]),
    );

    // II. Naming the land — the lexicon speaks in its own voice.
    lines.push(`${heartland.name} they named it — ${glossPhrase(heartland.gloss)} —`);
    lines.push(
      rng.pick([
        `for they were a people who named things truly.`,
        `and the name has outlived every wall they raised.`,
        `and no one has improved on it since.`,
        `a name that fit the land like weather.`,
      ]),
    );

    // III. The first city. A founding saga keeps the name the founders gave —
    // if conquest later re-said it (S18's language contact), the saga notes the
    // new name the way one notes an insult.
    if (firstCity) {
      const original = firstCity.formerNames?.[0];
      const firstName = original?.name ?? firstCity.name;
      const firstGloss = original?.gloss ?? firstCity.gloss;
      lines.push(`${firstName} they built first, ${glossPhrase(firstGloss)},`);
      lines.push(
        firstCity.isPort
          ? rng.pick([
              `its harbour open like a hand.`,
              `its quays the first words of a long argument with the sea.`,
            ])
          : rng.pick([
              `its walls set square against the weather.`,
              `its well dug before its walls, as wise folk build.`,
            ]),
      );
      if (original) {
        lines.push(`(The maps write it ${firstCity.name} now. The saga does not.)`);
      }
    }

    // IV. The god.
    if (faith) {
      lines.push(`Over it they set ${faith.deity.name}, ${glossPhrase(faith.deity.gloss)},`);
      lines.push(`whose dominion is ${faith.deity.domain.toLowerCase()};`);
      lines.push(
        rng.bool()
          ? `and ${faith.name} keeps that fire yet.`
          : `and ${faith.name} remembers.`,
      );
    }

    // V. Word-lore — teach the reader two roots, as the saga-keepers would.
    const taught = rng
      .shuffle(["sea", "stone", "fire", "home", "king", "star"])
      .slice(0, 2)
      .sort();
    lines.push(
      `In their tongue, ${lex.roots[taught[0]]} is ${taught[0]} and ${lex.roots[taught[1]]} is ${taught[1]};`,
    );
    lines.push(
      rng.pick([
        `so read their map: every name a small song.`,
        `learn those two words and their map opens like a door.`,
        `their map is a psalter, if you can read it.`,
      ]),
    );

    // VI. The fate of their greatest realm — the simulation has the last word.
    if (realm) {
      if (realm.status === "extinct") {
        lines.push(`Of ${realm.name} their singers made much, once.`);
        lines.push(
          `It rose to ${realm.peakSize} province${realm.peakSize === 1 ? "" : "s"} and it fell, and the saga does not say so —`,
        );
        lines.push(`but the chronicle does.`);
      } else if (realm.status === "ascendant") {
        lines.push(`And of ${realm.name} the singers still sing,`);
        lines.push(`for its banners stand as high as ever they did.`);
      } else {
        lines.push(`${realm.name} endures, lesser than its songs —`);
        lines.push(`as all things are, that last long enough to be sung of.`);
      }
    }

    sagas.push({
      cultureId,
      cultureLabel: lang.label,
      title: realm
        ? `The Saga of ${realm.name}`
        : `How the ${epithet[0].toUpperCase()}${epithet.slice(1)} Folk Came to ${heartland.name}`,
      lines,
    });
  }

  return sagas;
}
