// language.ts — L8.5: word-roots, compounding, and meaning.
//
// Before this module, names were syllable soup: a Kesh town and a Kesh peak
// shared a *sound* but no *vocabulary*. Here each culture gets a real lexicon —
// a fixed set of ~50 concepts (sea, stone, high, fort, holy …), each realized
// as a root in that culture's phonology — and names are built by COMPOUNDING
// those roots according to what a thing is and where it stands. A port town in
// Auld lands reliably carries the Auld root for "sea"; the peak above it
// carries the root for "high". The result is a name you can translate, and a
// glossary that makes the whole map legible.
//
// Two deliberate choices:
//
//   1. A lexicon is a pure function of the LANGUAGE, not the world seed. "Vask"
//      means sea in Auld in *every* world. Cultures are older than any one map,
//      and a reader who learns a dozen roots can then read every world we
//      generate. (It also keeps `makeName(lang, rng)` free of seed plumbing.)
//
//   2. Compounding runs through real morphophonology — elision, degemination,
//      epenthesis — so joins never produce "kkh" or "aa" pileups, and a root is
//      allowed to change shape slightly at a boundary, the way real ones do.

import { Rng } from "./rng.ts";
import type { Language } from "./names.ts";

/**
 * The concept inventory: every root every language must have. The English word
 * is the gloss; the root is invented per language. Order matters — it seeds the
 * generation loop — so APPEND new concepts, never insert.
 */
export const CONCEPTS = [
  // water
  "water", "sea", "river", "lake", "spring",
  // landform
  "stone", "mountain", "hill", "field", "vale", "isle", "cliff", "marsh", "land",
  // flora
  "wood", "tree", "thorn", "grass",
  // element & ore
  "fire", "ash", "ice", "sand", "salt", "iron", "gold",
  // quality
  "high", "deep", "dark", "bright", "old", "new",
  "red", "white", "black", "green", "cold", "wild",
  // works of hands
  "fort", "hall", "gate", "bridge", "haven", "home", "market",
  // people
  "folk", "king", "blood", "war", "peace",
  // sky & sacred
  "holy", "dread", "dawn", "dusk", "star", "moon", "sun", "sky", "wind", "storm",
] as const;

export type Concept = (typeof CONCEPTS)[number];

/** A culture's vocabulary: concept → root, plus the glue that joins them. */
export interface Lexicon {
  languageId: string;
  languageLabel: string;
  /** concept → root form, e.g. `{ sea: "vask", fort: "hold" }`. */
  roots: Record<string, string>;
  /** Vowel inserted to break an unpronounceable cluster at a compound seam. */
  linker: string;
  /** Endings that turn a root into a personal name ("Vaskan", "Vaskir"). */
  personal: string[];
  /** Particle a deity's name takes ("El-"), already lower-case. */
  divine: string;
}

const VOWELS = "aeiouy";
const isVowel = (c: string) => VOWELS.includes(c);

/** Consonants at the end of `s` (may be ""). */
function tail(s: string): string {
  let i = s.length;
  while (i > 0 && !isVowel(s[i - 1])) i--;
  return s.slice(i);
}

/** Consonants at the start of `s` (may be ""). */
function head(s: string): string {
  let i = 0;
  while (i < s.length && !isVowel(s[i])) i++;
  return s.slice(0, i);
}

/**
 * Join two morphemes the way a language would, not the way string concatenation
 * would. Three rules, applied at the seam:
 *
 *   elision      "vaska" + "erd"  → "vaskerd"   (vowel meets vowel)
 *   degemination "hold"  + "dun"  → "holdun"    (a consonant meets its twin)
 *   epenthesis   "vaskr" + "stan" → "vaskrastan" (cluster too thick to say;
 *                a three-consonant seam like "vaskhold" is fine)
 */
export function joinRoots(a: string, b: string, linker: string): string {
  if (!a) return b;
  if (!b) return a;
  const la = a[a.length - 1];
  const fb = b[0];

  if (isVowel(la) && isVowel(fb)) {
    let x = a.slice(0, -1);
    // Elide once; if that exposes the *same* vowel again ("rauri" + "ia"),
    // elide again rather than admit "rauriia".
    if (x.length > 1 && x[x.length - 1] === fb) x = x.slice(0, -1);
    return x.length > 0 ? x + b : a + b;
  }
  if (la === fb) return a + b.slice(1);
  if (!isVowel(la) && !isVowel(fb)) {
    if (tail(a).length + head(b).length >= 4) return a + linker + b;
  }
  return a + b;
}

/** Build one root: a syllable (or two, rarely) in the language's phonology. */
function coinRoot(lang: Language, rng: Rng, taken: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const twoSyllable = rng.next() < 0.18;
    let root = "";
    const syls = twoSyllable ? 2 : 1;
    for (let s = 0; s < syls; s++) {
      const onset = rng.pick(lang.onsets);
      const nucleus = rng.pick(lang.nuclei);
      let syl = onset + nucleus;
      const last = s === syls - 1;
      // A final coda gives the root consonantal weight; medial codas are rarer.
      if (rng.next() < (last ? 0.62 : 0.25)) syl += rng.pick(lang.codas);
      root = joinRoots(root, syl, lang.nuclei[0]);
    }
    // Roots must be sayable, distinct, and short enough to compound.
    if (root.length < 2 || root.length > 6) continue;
    if (!/[aeiouy]/.test(root)) continue;
    // Roots begin with a consonant. A vowel-initial root ("au" = hall) makes a
    // mush of every compound it heads — "cau" + "au" → "caau" — because the
    // seam is always a hiatus. Affixes may start with vowels; roots may not.
    if (isVowel(root[0])) continue;
    if (taken.has(root)) continue;
    // Reject a root that is a prefix of an existing one (or vice versa) — such
    // pairs become indistinguishable once compounded.
    let clashes = false;
    for (const t of taken) {
      if (t.startsWith(root) || root.startsWith(t)) { clashes = true; break; }
    }
    if (clashes) continue;
    return root;
  }
  // Exhausted: fall back to a guaranteed-unique consonant-initial form.
  const consonantal = lang.onsets.filter((o) => o.length > 0 && !isVowel(o[0]));
  let n = 2;
  let base = rng.pick(consonantal) + rng.pick(lang.nuclei) + rng.pick(lang.codas);
  while (taken.has(base)) base += lang.nuclei[n++ % lang.nuclei.length];
  return base;
}

const cache = new Map<string, Lexicon>();

/**
 * The lexicon of a language. Deterministic in the language id alone, and
 * memoized — every world shares the same Auld vocabulary.
 */
export function lexiconOf(lang: Language): Lexicon {
  const hit = cache.get(lang.id);
  if (hit) return hit;

  const rng = new Rng(`lexicon:${lang.id}`);
  const roots: Record<string, string> = {};
  const taken = new Set<string>();
  for (const concept of CONCEPTS) {
    const root = coinRoot(lang, rng, taken);
    taken.add(root);
    roots[concept] = root;
  }

  const lex: Lexicon = {
    languageId: lang.id,
    languageLabel: lang.label,
    roots,
    linker: lang.nuclei[0],
    personal: rng.shuffle(["an", "ir", "os", "en", "ai", "un"]).slice(0, 3),
    divine: rng.pick(["el", "ai", "va", "or", "is"]),
  };
  cache.set(lang.id, lex);
  return lex;
}

/** Every root in a language, as (root, gloss) pairs in concept order. */
export function glossary(lang: Language): Array<{ root: string; gloss: string }> {
  const lex = lexiconOf(lang);
  return CONCEPTS.map((c) => ({ root: lex.roots[c], gloss: c }));
}

// ---------------------------------------------------------------------------
// Naming templates: what concepts a thing of a given kind is named after.
// ---------------------------------------------------------------------------

export type NameKind =
  | "city" | "town" | "village"
  | "peak" | "volcano" | "river" | "lake" | "region"
  | "realm" | "house" | "deity" | "person";

const QUALITY = ["high", "deep", "dark", "bright", "old", "new",
  "red", "white", "black", "green", "cold", "wild"];
const LANDFORM = ["stone", "hill", "field", "vale", "isle", "cliff",
  "marsh", "wood", "grass", "sand", "spring", "thorn"];
const WORKS = ["fort", "hall", "gate", "bridge", "haven", "home", "market"];
const SACRED = ["holy", "dread", "dawn", "dusk", "star", "moon", "sun", "sky",
  "wind", "storm", "fire"];

/**
 * What a settled place may be named after. Deliberately wider than QUALITY +
 * LANDFORM: it must contain every concept a caller can pass as a hint, or the
 * hint is silently ignored and the port stops being named for the sea.
 */
const PLACE_MODS = [...QUALITY, ...LANDFORM,
  "sea", "river", "water", "mountain", "ice", "salt", "gold", "iron", "ash",
  "fire", "tree", "holy"];

/** Concept slots for each kind: [modifier candidates, head candidates]. */
const TEMPLATES: Record<NameKind, [string[], string[]]> = {
  city:    [PLACE_MODS, ["hall", "gate", "market", "haven", "fort"]],
  town:    [PLACE_MODS, WORKS],
  village: [PLACE_MODS, ["home", "field", "bridge", "spring", "fort"]],
  peak:    [["high", "white", "cold", "dark", "old", "black", "dread", "storm"],
            ["stone", "mountain", "cliff"]],
  // Wide enough to name the nine volcanoes a big world can raise without
  // repeating itself: 12 × 4 combinations, not 5 × 2.
  volcano: [["fire", "ash", "dread", "red", "black", "dark", "old", "storm",
             "holy", "white", "high", "cold"],
            ["mountain", "stone", "cliff", "hill"]],
  river:   [[...QUALITY, "iron", "salt", "gold"], ["river", "water", "spring"]],
  lake:    [[...QUALITY, "holy", "salt"], ["lake", "water"]],
  region:  [PLACE_MODS, [...LANDFORM, "land", "land", "folk"]],
  realm:   [["high", "old", "gold", "holy", "iron", "white", "bright", "dread"],
            ["king", "folk", "land", "home", "peace", "war"]],
  house:   [[...QUALITY], ["blood", "iron", "star", "gold", "stone", "war", "thorn"]],
  deity:   [SACRED, ["holy", "king", "sun", "star", "fire", "storm", "sky", "blood"]],
  person:  [[...QUALITY, ...LANDFORM, "blood", "iron", "star", "war", "gold", "sun"], []],
};

/** A finished name, and the meaning it was built from. */
export interface ComposedName {
  name: string;
  /** Hyphenated literal reading, e.g. `"sea-fort"`. */
  gloss: string;
  /** The concepts used, in order. */
  concepts: string[];
  languageId: string;
}

export interface NameOptions {
  kind?: NameKind;
  /**
   * Concepts the place genuinely embodies — a port passes `["sea"]`, a desert
   * region `["sand"]`. The first hint the template can use becomes the
   * modifier, so names describe the land they sit on.
   */
  hints?: string[];
  /** Names already in use; the composer will try to avoid colliding. */
  avoid?: Set<string>;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function composeOnce(
  lang: Language,
  rng: Rng,
  kind: NameKind,
  hints: string[],
): ComposedName {
  const lex = lexiconOf(lang);
  const [mods, heads] = TEMPLATES[kind];

  // A hint only overrides the modifier if this kind can actually take it as a
  // modifier — a peak is never a "sea peak". Hints arrive most-salient-first,
  // so a port usually gets named for its harbour rather than its hinterland,
  // but not always: real maps have inland-sounding names on the coast.
  const usable = hints.filter((h) => mods.includes(h));
  const modifier =
    usable.length === 0
      ? rng.pick(mods)
      : rng.next() < 0.6
        ? usable[0]
        : rng.pick(usable);

  if (kind === "person") {
    const root = lex.roots[modifier];
    const name = joinRoots(root, rng.pick(lex.personal), lex.linker);
    return {
      name: titleCase(name),
      gloss: `${modifier}-born`,
      concepts: [modifier],
      languageId: lang.id,
    };
  }

  let headConcept = rng.pick(heads);
  // Never name a thing "stone-stone".
  if (headConcept === modifier) headConcept = rng.pick(heads.filter((h) => h !== modifier));

  let name = joinRoots(lex.roots[modifier], lex.roots[headConcept], lex.linker);
  if (kind === "deity") name = joinRoots(lex.divine, name, lex.linker);

  return {
    name: titleCase(name),
    gloss: `${modifier}-${headConcept}`,
    concepts: [modifier, headConcept],
    languageId: lang.id,
  };
}

/** Names below this are stubs; above it they are the mouthfuls we set out to kill. */
const MIN_LEN = 4;
const MAX_LEN = 13;

function acceptable(c: ComposedName, avoid?: Set<string>): boolean {
  if (c.name.length < MIN_LEN || c.name.length > MAX_LEN) return false;
  return !avoid?.has(c.name);
}

/**
 * Compose a name from the culture's own words. Retries so a world does not end
 * up with two Vaskholds, and so no name comes out a stub or a mouthful. If
 * every retry is unacceptable we keep the last one — a duplicate name is a
 * blemish, but a thrown error is a broken world.
 */
export function composeName(
  lang: Language,
  rng: Rng,
  opts: NameOptions = {},
): ComposedName {
  const kind = opts.kind ?? "town";
  const hints = opts.hints ?? [];
  let last = composeOnce(lang, rng, kind, hints);
  for (let i = 0; i < 32 && !acceptable(last, opts.avoid); i++) {
    last = composeOnce(lang, rng, kind, hints);
  }
  opts.avoid?.add(last.name);
  return last;
}

/** Render a gloss as prose: `"sea-fort"` → `"the sea fort"`. */
export function glossPhrase(gloss: string): string {
  return `the ${gloss.replace(/-/g, " ")}`;
}

/**
 * The concepts a biome suggests, so a town in the dunes can be named for sand
 * and one under the pines for wood. Takes the numeric biome id (see
 * `biomes.ts`) rather than the enum, to keep this module free of world data.
 */
export function hintsForBiome(biome: number): string[] {
  switch (biome) {
    case 2: return ["ice", "white", "cold"];          // Snow
    case 3: return ["stone", "high", "cold"];         // Alpine
    case 4: return ["cold", "wild", "grass"];         // Tundra
    case 5: return ["wood", "dark", "cold"];          // Taiga
    case 6: return ["cold", "sand", "stone"];         // ColdDesert
    case 7: return ["thorn", "wild", "grass"];        // Shrubland
    case 8: return ["grass", "green", "field"];       // Grassland
    case 9: return ["sand", "salt", "red"];           // TemperateDesert
    case 10: return ["wood", "green", "tree"];        // TemperateForest
    case 11: return ["wood", "deep", "green"];        // TemperateRainforest
    case 12: return ["sand", "red", "sun"];           // Desert
    case 13: return ["grass", "gold", "wild"];        // Savanna
    case 14: return ["wood", "wild", "green"];        // TropicalSeasonalForest
    case 15: return ["wood", "deep", "wild"];         // TropicalRainforest
    default: return [];
  }
}
