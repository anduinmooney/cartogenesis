// narrative.ts — L17: the chronicle, told.
//
// Everything below L16 *records* history; this layer tells it. The simulation's
// event list is real — wars that really happened, in an order that really
// happened — but it reads like a ledger: one sentence per row. This module gives
// the world a chronicler: an in-world voice that opens the book, divides the
// centuries into named ages, introduces each realm once and remembers it
// afterwards, notices when two powers meet for the third time, lets a victory
// embolden and a defeat sting, and closes with the world as it stands.
//
// The craft is in the generator, not in any model: prose is assembled from
// phrase banks and connective tissue by a private RNG stream, so the same seed
// tells the same story to the letter, on any machine. Three rules keep it
// honest:
//
//   1. STRICTLY DOWNSTREAM. The narrator reads the finished simulation and
//      never feeds back — no draw from the sim's stream, no event mutation, so
//      the simulation fingerprint is byte-identical with or without it.
//   2. TOTAL. Every event is narrated; the teller may colour, never omit.
//      A chronicle that skips the famine is propaganda.
//   3. GROUNDED. Every name in the prose is a real name from the world. The
//      narrator invents phrasing, never facts.

import { Rng } from "./rng.ts";
import type { HistoryLayer } from "./history.ts";
import type { LoreLayer } from "./lore.ts";
import type { SimEvent, SimulationLayer } from "./simulation.ts";

export interface NarrativeChapter {
  /** e.g. `"II. The Age of Blood and Banners, 350–600"` */
  title: string;
  startYear: number;
  endYear: number;
  paragraphs: string[];
}

export interface NarrativeLayer {
  /** e.g. `"The Chronicle of Tenameonte"` */
  title: string;
  /** The chronicler's frame: who writes, when, and of what world. */
  opening: string[];
  chapters: NarrativeChapter[];
  /** The world as it stands in the present year, and the sign-off. */
  closing: string[];
}

export interface NarrativeConfig {
  seed: number;
  presentYear: number;
  capital: string;
  capitalHouse: string;
}

// --- Small prose utilities ---------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pick from a bank, avoiding the immediately previous pick for that bank. */
function makeVariedPicker(rng: Rng) {
  const last = new Map<string, number>();
  return function pick(key: string, bank: readonly string[]): string {
    if (bank.length === 1) return bank[0];
    let i = rng.int(0, bank.length);
    if (i === last.get(key)) i = (i + 1) % bank.length;
    last.set(key, i);
    return bank[i];
  };
}

const CULTURE_EPITHET: Record<string, string> = {
  auld: "northern",
  meridian: "southern",
  kesh: "desert",
  sylvan: "woodland",
};

// --- The chronicler ----------------------------------------------------------

export function generateNarrative(
  history: HistoryLayer,
  lore: LoreLayer,
  simulation: SimulationLayer,
  cfg: NarrativeConfig,
): NarrativeLayer {
  const rng = new Rng(cfg.seed);
  const pick = makeVariedPicker(rng);
  const sim = simulation;
  const yearsPerTurn = Math.max(
    1,
    Math.round((sim.endYear - sim.startYear) / Math.max(1, sim.turns)),
  );

  const realmByName = new Map(sim.realms.map((r) => [r.name, r]));
  const worldName =
    sim.realms.length > 0
      ? [...sim.realms].sort((a, b) => b.peakSize - a.peakSize || a.id - b.id)[0].name
      : cfg.capital;

  // ---- The narrator's memory ----
  const introduced = new Set<string>();
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const clashes = new Map<string, number>(); // "A|B" sorted → meetings
  const repulsedPairs = new Set<string>(); // pairs with an earlier failed invasion

  const clashKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  /** A realm's name, with an introduction the first time the chronicle says it. */
  const named = (name: string | undefined): string => {
    if (!name) return "an unnamed power";
    if (introduced.has(name)) return name;
    introduced.add(name);
    const r = realmByName.get(name);
    if (!r) return name;
    const epi = CULTURE_EPITHET[r.languageId] ?? "far";
    const young = r.foundedYear > sim.startYear + (sim.endYear - sim.startYear) * 0.3;
    return young
      ? `the young ${epi} realm of ${name}`
      : `the ${epi} realm of ${name}`;
  };

  /** How this sentence sits in time relative to the one before it. */
  const timePhrase = (year: number, prevYear: number | null): string => {
    if (prevYear === null) {
      return pick("t.anchor", [
        `in ${year},`,
        `in the year ${year},`,
        `about the year ${year},`,
      ]);
    }
    const d = year - prevYear;
    if (d === 0) return pick("t.same", ["that same year,", "in the same season,", "and in that year too,"]);
    if (d <= yearsPerTurn)
      return pick("t.soon", ["soon after,", "before long,", "hard on its heels,"]);
    if (d <= yearsPerTurn * 2)
      return pick("t.gen", ["a generation on,", "in the years that followed,", `by ${year},`]);
    return pick("t.far", [`some ${d} years later,`, `by ${year},`, `the chronicle is silent until ${year}, when`]);
  };

  // ---- One sentence per event ----
  const sentenceFor = (
    e: SimEvent,
    prevYear: number | null,
    prev: SimEvent | null,
  ): string => {
    const a = e.actors ?? {};
    const S = a.subject;
    const O = a.object;
    const P = a.place;
    const t = timePhrase(e.year, prevYear);

    switch (e.type) {
      case "conquest": {
        const key = clashKey(S ?? "", O ?? "");
        const met = clashes.get(key) ?? 0;
        clashes.set(key, met + 1);
        wins.set(S ?? "", (wins.get(S ?? "") ?? 0) + 1);
        losses.set(O ?? "", (losses.get(O ?? "") ?? 0) + 1);
        if (repulsedPairs.has(key)) {
          repulsedPairs.delete(key);
          return cap(
            `${t} what had once broken against ${P}'s defences now carried them: ${named(S)} took the province, and ${named(O)}'s pride with it.`,
          );
        }
        if (met >= 2) {
          return cap(
            `${t} ${named(S)} and ${named(O)} met over ${P} yet again, and yet again it was ${S} that kept the field.`,
          );
        }
        // Momentum colours the telling sometimes — a chronicler who says
        // "swollen with victories" every time is a bore.
        if ((wins.get(S ?? "") ?? 0) >= 3 && rng.next() < 0.45) {
          return cap(
            `${t} ` +
              pick("momentum", [
                `swollen with victories, ${named(S)} pressed on into ${P}, and ${named(O)} could not hold it.`,
                `${named(S)}, whose appetite grew with the eating, took ${P} next.`,
                `there was no halting ${named(S)} that season: ${P} fell to it while ${named(O)} looked on.`,
              ]),
          );
        }
        return cap(
          `${t} ` +
            pick("conquest", [
              `${named(S)} marched on ${P}, and by winter the province had fallen to it; ${named(O)} was the poorer.`,
              `${named(S)} seized ${P} from ${named(O)}, and the border stones were moved in the night.`,
              `the banners of ${named(S)} entered ${P}, and what ${named(O)} had held it held no longer.`,
              `${P} passed by force from ${named(O)} to ${named(S)}; the tax rolls were rewritten before the dead were counted.`,
            ]),
        );
      }
      case "repulsed": {
        const key = clashKey(S ?? "", O ?? "");
        clashes.set(key, (clashes.get(key) ?? 0) + 1);
        repulsedPairs.add(key);
        losses.set(S ?? "", (losses.get(S ?? "") ?? 0) + 1);
        return cap(
          `${t} ` +
            pick("repulsed", [
              `${named(S)} moved against ${P}, but ${named(O)} threw the invaders back over the border.`,
              `the assault ${named(S)} loosed upon ${P} broke against ${named(O)}'s spears and came to nothing.`,
              `${named(O)} held ${P} against ${named(S)}, whose army went home leaner and wiser.`,
            ]),
        );
      }
      case "fall": {
        const r = S ? realmByName.get(S) : undefined;
        const age = r ? e.year - r.foundedYear : 0;
        // A fall usually trails the conquest that caused it. When it does,
        // attach it — "With that, …" — instead of stacking a second time
        // phrase onto the same year.
        const trailsItsConquest =
          prev !== null &&
          prev.year === e.year &&
          (prev.type === "conquest" || prev.type === "repulsed") &&
          (prev.actors?.object === S || prev.actors?.subject === S);
        if (trailsItsConquest) {
          return cap(
            pick("fall.attached", [
              `with that, the realm of ${S} was extinguished; its name passes from the roll of the powers.`,
              age > 0
                ? `it was the end of ${S}: ${age} years of banners, done in a single season.`
                : `it was the end of ${S}; its lands were divided among its enemies.`,
            ]),
          );
        }
        return cap(
          `${t} ` +
            pick("fall", [
              `the realm of ${S} was extinguished; its name passes from the roll of the powers.`,
              age > 0
                ? `so ended ${S}, whose banners had flown for ${age} years.`
                : `so ended ${S}; its lands were divided among its enemies.`,
              `of ${S} nothing more is written.`,
            ]),
        );
      }
      case "revolt":
        return cap(
          `${t} ` +
            pick("revolt", [
              `${P} rose against ${named(O)}, and out of the rising was proclaimed the free realm of ${S}.`,
              `the people of ${P} drove out ${named(O)}'s governors and took for themselves the name ${S}.`,
              `word came from ${P} that it would be governed from within: thus ${S}, born in a single furious season.`,
            ]),
        );
      case "secession":
        return cap(
          `${t} ` +
            pick("secession", [
              `${named(O)} had grown past its own strength: ${P} and its neighbours broke away to found ${S}.`,
              `the realm of ${S} was carved whole out of ${named(O)}'s flank, with ${P} at its heart.`,
            ]),
        );
      case "famine":
        return cap(
          `${t} ` +
            pick("famine", [
              `famine struck ${P}; the fields gave nothing, and the roads filled with the hungry.`,
              `the granaries of ${P} stood empty that year, and many did not see the spring.`,
              `${P} hungered; the price of bread wrote its own grim chronicle.`,
            ]),
        );
      case "plague": {
        // The sim marks droughts and plagues with the same type; the prebaked
        // text tells them apart. A probe, not a parse — the facts come from actors.
        const drought = e.text.includes("drought");
        return cap(
          `${t} ` +
            (drought
              ? pick("drought", [
                  `a great drought lay upon ${P}; the rivers shrank and the wells soured.`,
                  `no rain came to ${P} for two years together; many perished.`,
                ])
              : pick("plague", [
                  `a pestilence swept ${P} and carried off more than any war had.`,
                  `in ${P} the bells rang without ceasing; a third of its people were laid in the ground.`,
                ])),
        );
      }
      case "conversion":
        return cap(
          `${t} ` +
            pick("conversion", [
              `quieter conquests were made as well: ${P} turned from ${O} to ${S}.`,
              `the shrines of ${O} in ${P} emptied, and those of ${S} filled.`,
            ]),
        );
      case "goldenage":
        return cap(
          `${t} ` +
            pick("golden", [
              `not all was iron: a golden age dawned over ${named(S)}, and its cities flourished as never before.`,
              `these were the high years of ${named(S)} — its markets loud, its walls, for a while, unneeded.`,
            ]),
        );
      case "ruin": {
        const abandoned = e.text.includes("abandoned");
        return cap(
          `${t} ` +
            (abandoned
              ? pick("ruin.a", [
                  `${P} was abandoned; its people drifted away, and the grass came back to its streets.`,
                  `the last households left ${P}, and it kept only its name.`,
                ])
              : pick("ruin.s", [
                  `${P} was stormed and left a ruin; travellers still point out its broken walls.`,
                  `${P} did not survive its conquerors; what stands of it stands empty.`,
                ])),
        );
      }
      default:
        // Total narration: an event type this teller does not know still enters
        // the record, in the ledger's own words.
        return cap(`${t} ${e.text}`);
    }
  };

  // ---- Chapters: slice the span, characterize each window ----
  const events = sim.events;
  const span = sim.endYear - sim.startYear;
  const chapterCount = Math.max(2, Math.min(5, 2 + Math.floor(events.length / 18)));
  const winLen = span / chapterCount;

  const chapterTitle = (
    index: number,
    startYear: number,
    endYear: number,
    windowEvents: SimEvent[],
  ): string => {
    const n = (type: SimEvent["type"][]) =>
      windowEvents.filter((e) => type.includes(e.type)).length;
    const war = n(["conquest", "repulsed", "fall"]);
    const upheaval = n(["revolt", "secession"]);
    const misery = n(["famine", "plague", "ruin"]);
    const grace = n(["goldenage", "conversion"]);
    // Banks are keyed by CATEGORY, not chapter index, so back-to-back chapters
    // of the same tenor rotate their titles instead of repeating one.
    let cat: string;
    let bank: readonly string[];
    if (index === 0) {
      cat = "founding";
      bank = ["The Age of Foundations", "The First Banners", "The Shaping Years"];
    } else if (war >= upheaval && war >= misery && war >= grace && war > 0) {
      cat = "war";
      bank = ["The Age of Blood and Banners", "The Contested Years", "The Marching Years"];
    } else if (upheaval >= misery && upheaval >= grace && upheaval > 0) {
      cat = "upheaval";
      bank = ["The Breaking of Realms", "The Age of Risings", "The Unquiet Provinces"];
    } else if (misery >= grace && misery > 0) {
      cat = "misery";
      bank = ["The Hungry Years", "The Years the Bells Rang", "The Lean Age"];
    } else {
      cat = "quiet";
      bank = ["The Quiet Years", "The Long Peace", "The Age of Temples"];
    }
    const roman = ["I", "II", "III", "IV", "V"][index] ?? String(index + 1);
    return `${roman}. ${pick(`title.${cat}`, bank)}, ${startYear}–${endYear}`;
  };

  const chapters: NarrativeChapter[] = [];
  for (let c = 0; c < chapterCount; c++) {
    const cStart = Math.round(sim.startYear + c * winLen);
    const cEnd = Math.round(sim.startYear + (c + 1) * winLen);
    const inWindow = events.filter(
      (e) => e.year >= cStart && (c === chapterCount - 1 ? e.year <= cEnd : e.year < cEnd),
    );

    const paragraphs: string[] = [];
    let current: string[] = [];
    let prevYear: number | null = null;
    let prevEvent: SimEvent | null = null;
    for (const e of inWindow) {
      // A fall that trails its own conquest stays glued to it — a paragraph
      // break between cause and consequence would orphan "With that, …".
      const trailing =
        prevEvent !== null &&
        e.type === "fall" &&
        e.year === prevEvent.year &&
        (prevEvent.actors?.object === e.actors?.subject ||
          prevEvent.actors?.subject === e.actors?.subject);
      // A long silence, or a full paragraph, starts a fresh one — and a fresh
      // paragraph re-anchors to an absolute year.
      if (
        !trailing &&
        (current.length >= 3 + rng.int(0, 2) ||
          (prevYear !== null && e.year - prevYear > yearsPerTurn * 3))
      ) {
        paragraphs.push(current.join(" "));
        current = [];
        prevYear = null;
        prevEvent = null;
      }
      current.push(sentenceFor(e, prevYear, prevEvent));
      prevYear = e.year;
      prevEvent = e;
    }
    if (current.length) paragraphs.push(current.join(" "));

    // The land filling up: foundings in this window, told once, not itemized.
    const founded = sim.settlementTimeline.filter(
      (s) => s.foundedYear >= cStart && s.foundedYear < cEnd && s.foundedYear > sim.startYear,
    );
    if (founded.length >= 2) {
      const byTier = [...founded].sort((a, b) =>
        a.tier === b.tier ? a.foundedYear - b.foundedYear : a.tier === "city" ? -1 : 1,
      );
      const namedTowns = byTier.slice(0, 2).map((s) => s.name);
      paragraphs.push(
        cap(
          pick("founded", [
            `all the while the land was filling: ${founded.length} settlements were raised in these years, ${namedTowns.join(" and ")} among them.`,
            `these years also built more than they burned — ${founded.length} new settlements, of which ${namedTowns[0]} would become the best known.`,
          ]),
        ),
      );
    }

    // Names remade by conquest, where they fall in this window.
    const remade = sim.renamings.filter((r) => r.year >= cStart && r.year < cEnd);
    if (remade.length > 0) {
      const first = remade[0];
      const more =
        remade.length > 1 ? ` — and ${remade.length - 1} other name${remade.length > 2 ? "s" : ""} with it` : "";
      paragraphs.push(
        cap(
          pick("remade", [
            `conquest re-said the very map: ${first.formerName} became ${first.name} on its new masters' tongues${more}.`,
            `the occupiers kept the land-words and changed the rest, and so ${first.formerName} is written ${first.name} in every ledger since${more}.`,
          ]),
        ),
      );
    }

    if (paragraphs.length === 0) {
      paragraphs.push(
        pick("quiet", [
          "Little is set down for these years. The realms kept their borders and their counsel, and the chronicle is the shorter for it.",
          "Of these years the record holds almost nothing — which, in a chronicle of wars, is its own kind of good news.",
        ]),
      );
    }

    chapters.push({ title: chapterTitle(c, cStart, cEnd, inWindow), startYear: cStart, endYear: cEnd, paragraphs });
  }

  // ---- Opening: the chronicler's frame ----
  const peak = history.features.find((f) => f.kind === "peak");
  const river = history.features.find((f) => f.kind === "river");
  const opening: string[] = [
    cap(
      pick("open.1", [
        `set down in ${cfg.capital}, in the year ${cfg.presentYear} ${history.epoch}, by a servant of House ${cfg.capitalHouse}. What follows is not legend — of the founding age the legends tell enough — but the plain record of ${span} years, as well as one hand could gather it.`,
        `i write in ${cfg.capital}, under the patronage of House ${cfg.capitalHouse}, in the year ${cfg.presentYear}. The legends of the founding age are kept elsewhere in this book; here is only what happened, year upon year, for ${span} years.`,
      ]),
    ),
  ];
  if (peak || river) {
    const bits: string[] = [];
    if (peak) bits.push(`Mount ${peak.name} in the high places`);
    if (river) bits.push(`the ${river.name} running to the sea`);
    opening.push(
      cap(
        `the world it happened in is quickly drawn: ${bits.join(", and ")}, and between them every road this chronicle walks.`,
      ),
    );
  }

  // ---- Closing: the world as it stands ----
  const survivors = sim.realms.filter((r) => r.status !== "extinct");
  const dominant = [...survivors].sort((a, b) => b.finalSize - a.finalSize || a.id - b.id)[0];
  const ruinCount = sim.settlementTimeline.filter((s) => s.fellYear !== undefined).length;
  const capitalRealm = history.realms.find((r) => r.seat === cfg.capital);
  const reigning = capitalRealm
    ? lore.rulers.find((x) => x.realmId === capitalRealm.id && x.reigning)
    : undefined;

  const closing: string[] = [
    cap(
      `so the matter stands in ${cfg.presentYear}: ${survivors.length} realm${survivors.length === 1 ? "" : "s"} endure${survivors.length === 1 ? "s" : ""}${
        dominant
          ? `, and ${dominant.name} is mightiest among them, holding ${dominant.finalSize} province${dominant.finalSize === 1 ? "" : "s"}`
          : ""
      }. ${
        ruinCount > 0
          ? `${ruinCount} town${ruinCount === 1 ? " lies" : "s lie"} in ruins; their names are kept in this book, which is more than their walls kept.`
          : `No town raised in these centuries has yet fallen — may the next chronicler write the same.`
      }`,
    ),
  ];
  closing.push(
    cap(
      pick("signoff", [
        `${reigning ? `${reigning.name} reigns in ${cfg.capital}. ` : ""}Let whoever comes after me write the next page better than I have written this one.`,
        `${reigning ? `In ${cfg.capital}, ${reigning.name} holds the throne. ` : ""}Here the record rests — not because history has, but because ink runs out before it does.`,
      ]),
    ),
  );

  return {
    title: `The Chronicle of ${worldName}`,
    opening,
    chapters,
    closing,
  };
}
