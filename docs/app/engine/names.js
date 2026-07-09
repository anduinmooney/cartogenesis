// names.ts — L8: procedural place-name languages.
//
// A small syllable-based phonology engine. Each "language" defines onsets,
// vowel nuclei, and codas plus how syllables combine; names are assembled from
// them. Neighboring regions can share a language so a coastline reads as one
// culture. Everything is a pure function of a seed, so names are stable.

import { Rng } from "./rng.js";

                           
             
                                                                   
                
                   
                   
                  
                                                                   
                      
                                                             
                     
                                               
                     
 

// Four distinct naming cultures. Kept deliberately small and legible.
export const LANGUAGES             = [
  {
    id: "auld",
    label: "Auld (northern)",
    onsets: ["", "th", "br", "sk", "v", "gr", "hr", "st", "kn", "fj", "d", "b"],
    nuclei: ["a", "o", "u", "ei", "y", "au", "o", "a"],
    codas: ["rk", "nd", "ll", "gr", "st", "rn", "sk", "n"],
    sylCounts: [2, 2, 3],
    suffixes: ["", "", "heim", "vik", "gard"],
    codaChance: 0.5,
  },
  {
    id: "meridian",
    label: "Meridian (southern)",
    onsets: ["", "v", "l", "m", "s", "c", "r", "n", "b", "t", "d", "p"],
    nuclei: ["a", "e", "i", "o", "ia", "eo", "au", "e", "a", "i"],
    codas: ["na", "ria", "len", "mor", "nte", "lla", "sso", "ndo"],
    sylCounts: [2, 3, 3],
    suffixes: ["", "", "mar", "vento", "a"],
    codaChance: 0.4,
  },
  {
    id: "kesh",
    label: "Kesh (desert)",
    onsets: ["", "k", "kh", "s", "sh", "z", "t", "j", "q", "gh", "r", "m"],
    nuclei: ["a", "aa", "i", "u", "a", "ai", "e", "a"],
    codas: ["r", "n", "kh", "d", "sh", "z", "q", "m"],
    sylCounts: [2, 2, 3],
    suffixes: ["", "", "abad", "ur", "esh"],
    codaChance: 0.5,
  },
  {
    id: "sylvan",
    label: "Sylvan (woodland)",
    onsets: ["", "ae", "el", "th", "si", "l", "n", "ph", "sy", "r", "mel", "an"],
    nuclei: ["a", "e", "i", "ae", "ia", "eo", "y", "e", "a"],
    codas: ["l", "n", "r", "th", "s", "en", "il", "wyn"],
    sylCounts: [2, 3, 3],
    suffixes: ["", "", "iel", "wood", "dell"],
    codaChance: 0.45,
  },
];

export function languageById(id        )           {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}

function titleCase(s        )         {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Generate one name in the given language from a private Rng. */
export function makeName(lang          , rng     )         {
  const syllables = rng.pick(lang.sylCounts);
  let out = "";
  for (let i = 0; i < syllables; i++) {
    const onset = rng.pick(lang.onsets);
    const nucleus = rng.pick(lang.nuclei);
    let syl = onset + nucleus;
    // Avoid three-vowel pileups when an onset is itself vowel-like.
    if (i < syllables - 1 && rng.next() < lang.codaChance) {
      syl += rng.pick(lang.codas);
    }
    out += syl;
  }
  if (rng.next() < 0.35) out += rng.pick(lang.suffixes);
  // Clean up doubled separators/vowels a touch.
  out = out.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return titleCase(out);
}

/**
 * A stable namer bound to a base seed. Calling `name(key)` yields the same name
 * for the same key every time — key is any string/number identifying a feature
 * (a region id, "river:3", "peak", …).
 */
export function makeNamer(
  baseSeed        ,
  lang          ,
)                                   {
  return (key) => {
    const rng = new Rng(`${baseSeed}:${key}`);
    return makeName(lang, rng);
  };
}
