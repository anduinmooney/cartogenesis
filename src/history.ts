// history.ts — L11: a procedural chronicle.
//
// Turns the finished geography into a story. Cities become the seats of realms;
// realms rise, feud with their neighbors, endure disasters tied to the land
// itself (a coastal flood, an eruption on the tallest peak, a plague out of the
// largest city), and enter golden ages. The output is a chronological timeline
// of dated events referencing the world's own named places — deterministic from
// the seed, like everything else.

import { Rng } from "./rng.ts";
import type { Grid } from "./grid.ts";
import type { WaterLayer } from "./hydrology.ts";
import type { RiverLayer } from "./rivers.ts";
import type { RegionLayer } from "./regions.ts";
import type { Settlement } from "./settlements.ts";
import { languageById } from "./names.ts";
import { composeName, type NameKind } from "./language.ts";

export interface Realm {
  id: number;
  name: string;
  /** Literal reading of the name, e.g. `"gold-king"`. */
  gloss: string;
  seat: string; // settlement name
  regionId: number;
  foundedYear: number;
}

export interface NamedFeature {
  kind: "peak" | "river" | "lake";
  name: string;
  /** Literal reading of the name, e.g. `"white-mountain"`. */
  gloss: string;
  x: number;
  y: number;
}

export interface HistoryEvent {
  year: number;
  type: "founding" | "realm" | "war" | "disaster" | "culture" | "union";
  title: string;
  text: string;
}

/**
 * How this world counts its years. Every world's count begins at a year-zero
 * event — the reason there IS a year zero — chosen from the world's own facts:
 * a volcanic world may count from the Great Burning of a real, named mountain;
 * a seafaring one from the Landing. The origin joins the founding legends, and
 * every date in the book wears this calendar's suffix.
 */
export interface Calendar {
  /** The year-zero event: why the count began. */
  origin: { title: string; text: string };
  /** The era, for prose: "after the Landing". */
  era: string;
  /** What dates wear in tables and margins: "A.L.". */
  suffix: string;
}

export interface HistoryLayer {
  /** The era phrase — kept as `epoch` for the many call sites that date prose. */
  epoch: string;
  calendar: Calendar;
  presentYear: number;
  realms: Realm[];
  features: NamedFeature[];
  events: HistoryEvent[];
}

export interface HistoryConfig {
  seed: number;
  /** The world's present year. Legends may not be dated after it. */
  presentYear?: number;
  /** Volcanoes, if the world has them — a fiery origin needs a real mountain. */
  volcanoes?: Array<{ name: string; status: string }>;
}

/**
 * Choose the world's calendar. Drawn on a PRIVATE stream (`seed:calendar`), so
 * the sequential history rng is untouched and realms/legends are byte-identical
 * with or without this feature — the fingerprints prove it.
 */
function makeCalendar(
  cfg: HistoryConfig,
  capital: Settlement | undefined,
  oceanFraction: number,
): Calendar {
  const rng = new Rng(`${cfg.seed}:calendar`);
  const at = capital ? ` below what is now ${capital.name}` : "";

  type Origin = { title: string; era: string; suffix: string; texts: string[] };
  const eligible: Origin[] = [];

  const volcano =
    cfg.volcanoes && cfg.volcanoes.length
      ? cfg.volcanoes.find((v) => v.status === "active") ?? cfg.volcanoes[0]
      : undefined;
  if (volcano) {
    eligible.push({
      title: `the Great Burning of Mount ${volcano.name}`,
      era: "after the Burning",
      suffix: "A.B.",
      texts: [
        `Mount ${volcano.name} split the sky with fire, and ash fell on every roof for a season. When the sun came back, the peoples agreed among themselves that the world had begun again.`,
        `the mountain called ${volcano.name} spoke fire for the first time in living memory; the elders called it an ending, and the young, more sensibly, a beginning.`,
      ],
    });
  }
  if (capital?.isPort || oceanFraction > 0.45) {
    eligible.push({
      title: "the Landing",
      era: "after the Landing",
      suffix: "A.L.",
      texts: [
        `the first ships came ashore${at}, keels loud on the shingle, and the people who stepped out of them chose to stay.`,
        `the boats that had wandered too long found this coast${at} and were pulled up past the tide line for good.`,
      ],
    });
  }
  eligible.push(
    {
      title: "the Long Winter",
      era: "after the Thaw",
      suffix: "A.T.",
      texts: [
        `three years passed without a summer; when the ice finally let go of the rivers, what was left of the peoples began to count again from the first green spring.`,
        `snow lay a man deep from sea to sea, and those who lived through it dated everything afterwards from the year the thaw came.`,
      ],
    },
    {
      title: "the First Crowning",
      era: "after the Crowning",
      suffix: "A.C.",
      texts: [
        `the scattered halls${capital ? ` around ${capital.name}` : ""} set a circlet on one head for the first time, and — having at last someone to blame — began to keep records.`,
      ],
    },
    {
      title: "the Falling Star",
      era: "after the Star",
      suffix: "A.S.",
      texts: [
        `a star fell burning across the whole sky and struck the sea beyond the horizon; the wave it raised is remembered, and the light more so.`,
        `a light crossed the heavens by day and was gone. Nothing was ever found of it, which has never stopped anyone from counting from it.`,
      ],
    },
  );

  const o = rng.pick(eligible);
  return {
    origin: {
      title: o.title.charAt(0).toUpperCase() + o.title.slice(1),
      text:
        `In the year now called zero, ${rng.pick(o.texts)} ` +
        `From that year the peoples of this world count their days.`,
    },
    era: o.era,
    suffix: o.suffix,
  };
}

/** Name a feature in the language of whoever lives around it. */
function nameAtCell(
  regions: RegionLayer,
  cell: number,
  key: string,
  kind: NameKind,
): { name: string; gloss: string } {
  const rid = regions.ids[cell];
  const region = regions.regions.find((r) => r.id === rid);
  const lang = languageById(region?.languageId ?? "meridian");
  const c = composeName(lang, new Rng(key), { kind });
  return { name: c.name, gloss: c.gloss };
}

/** Locate and name the world's most notable physical features. */
function findFeatures(
  elevation: Grid,
  water: WaterLayer,
  rivers: RiverLayer,
  regions: RegionLayer,
  seed: number,
): NamedFeature[] {
  const { width, height } = elevation;
  const n = width * height;
  const features: NamedFeature[] = [];

  // Highest peak.
  let peakI = -1;
  let peakH = -Infinity;
  for (let i = 0; i < n; i++) {
    if (water.oceanMask[i] === 0 && water.lakeMask[i] === 0 && elevation.data[i] > peakH) {
      peakH = elevation.data[i];
      peakI = i;
    }
  }
  if (peakI >= 0) {
    features.push({
      kind: "peak",
      ...nameAtCell(regions, peakI, `${seed}:peak`, "peak"),
      x: peakI % width,
      y: (peakI / width) | 0,
    });
  }

  // Main river = land cell with greatest flow that borders the ocean (a mouth).
  let mouthI = -1;
  let mouthFlow = -Infinity;
  for (let i = 0; i < n; i++) {
    if (rivers.riverMask[i] === 1 && rivers.flowAccum.data[i] > mouthFlow) {
      mouthFlow = rivers.flowAccum.data[i];
      mouthI = i;
    }
  }
  if (mouthI >= 0) {
    features.push({
      kind: "river",
      ...nameAtCell(regions, mouthI, `${seed}:river`, "river"),
      x: mouthI % width,
      y: (mouthI / width) | 0,
    });
  }

  // Largest lake (by cell in the biggest lake component — approx: any lake cell).
  let lakeI = -1;
  for (let i = 0; i < n; i++) {
    if (water.lakeMask[i] === 1) {
      lakeI = i;
      break;
    }
  }
  if (lakeI >= 0) {
    features.push({
      kind: "lake",
      ...nameAtCell(regions, lakeI, `${seed}:lake`, "lake"),
      x: lakeI % width,
      y: (lakeI / width) | 0,
    });
  }

  return features;
}

export function generateHistory(
  elevation: Grid,
  water: WaterLayer,
  rivers: RiverLayer,
  regions: RegionLayer,
  settlements: Settlement[],
  cfg: HistoryConfig,
): HistoryLayer {
  const rng = new Rng(cfg.seed);
  const features = findFeatures(elevation, water, rivers, regions, cfg.seed);
  const peak = features.find((f) => f.kind === "peak");
  const river = features.find((f) => f.kind === "river");
  const lake = features.find((f) => f.kind === "lake");

  const events: HistoryEvent[] = [];
  const byScore = [...settlements].sort((a, b) => b.score - a.score);
  const cities = byScore.filter((s) => s.tier === "city");

  // Founding years: best sites first, marching forward in time.
  const foundYear = new Map<number, number>();
  let year = rng.int(30, 80);
  for (const s of byScore) {
    foundYear.set(s.id, year);
    if (s.tier === "city") {
      const where = s.isPort
        ? "on a sheltered harbour"
        : river && rng.bool(0.5)
          ? `along the ${river.name}`
          : "amid good country";
      events.push({
        year,
        type: "founding",
        title: `${s.name} founded`,
        text: `The city of ${s.name} was founded ${where}${
          s.isCapital ? ", destined to become the seat of power" : ""
        }.`,
      });
    }
    year += rng.int(6, 34);
  }

  // Realms: one per city, seated there.
  const realms: Realm[] = cities.map((c, i) => {
    const region = regions.regions.find((r) => r.id === c.regionId);
    const lang = languageById(region?.languageId ?? "meridian");
    const founded = (foundYear.get(c.id) ?? 100) + rng.int(10, 40);
    const { name, gloss } = composeName(lang, new Rng(`${cfg.seed}:realm:${i}`), {
      kind: "realm",
    });
    events.push({
      year: founded,
      type: "realm",
      title: `The ${name} proclaimed`,
      text: `${c.name} rose to rule its hinterland, and the realm of ${name} was proclaimed.`,
    });
    return { id: i, name, gloss, seat: c.name, regionId: c.regionId, foundedYear: founded };
  });

  // Realm adjacency (their seat-regions border each other).
  const regionNeighbors = new Map<number, Set<number>>();
  for (const r of regions.regions) {
    regionNeighbors.set(r.id, new Set(r.neighbors));
  }
  const adjacentRealms: Array<[number, number]> = [];
  for (let a = 0; a < realms.length; a++) {
    for (let b = a + 1; b < realms.length; b++) {
      const ra = realms[a].regionId;
      const rb = realms[b].regionId;
      if (ra === rb || regionNeighbors.get(ra)?.has(rb)) {
        adjacentRealms.push([a, b]);
      }
    }
  }

  // Wars between neighbouring realms.
  const WAR_OUTCOMES = [
    (x: Realm, y: Realm) => `after years of siege, ${x.name} annexed the borderlands of ${y.name}`,
    (x: Realm, y: Realm) => `the war ended in exhausted stalemate, and the border with ${y.name} was fixed`,
    (x: Realm, y: Realm) => `a marriage-pact bound ${x.name} and ${y.name} in uneasy peace`,
    (x: Realm) => `plague broke the armies and ${x.name} withdrew`,
  ];
  let warYear = 300 + rng.int(0, 120);
  const warCount = Math.min(adjacentRealms.length, 3 + rng.int(0, 6));
  const shuffledPairs = rng.shuffle([...adjacentRealms]);
  for (let k = 0; k < warCount; k++) {
    const [ai, bi] = shuffledPairs[k % shuffledPairs.length];
    const A = realms[ai];
    const B = realms[bi];
    const cause = rng.pick([
      `a disputed succession`,
      `the tolls of the ${river?.name ?? "great river"}`,
      `an insult at a royal wedding`,
      `raids across the frontier`,
      `control of the ${peak?.name ?? "mountain"} passes`,
    ]);
    const outcome = rng.pick(WAR_OUTCOMES)(A, B);
    events.push({
      year: warYear,
      type: "war",
      title: `War of ${A.name} and ${B.name}`,
      text: `Over ${cause}, ${A.name} and ${B.name} went to war; ${outcome}.`,
    });
    warYear += rng.int(25, 130);
  }

  // Disasters tied to geography.
  if (peak) {
    events.push({
      year: 200 + rng.int(0, 900),
      type: "disaster",
      title: `The Fires of ${peak.name}`,
      text: `${peak.name} woke in fire and ash; a hard winter followed, and harvests failed across the land.`,
    });
  }
  const portCity = byScore.find((s) => s.isPort);
  if (portCity) {
    events.push({
      year: 250 + rng.int(0, 900),
      type: "disaster",
      title: `The Drowning of ${portCity.name}`,
      text: `A great storm-tide flooded ${portCity.name}; the lower quarters were lost to the sea.`,
    });
  }
  if (lake) {
    events.push({
      year: 300 + rng.int(0, 800),
      type: "culture",
      title: `The Scholars of ${lake.name}`,
      text: `An academy founded on the shores of ${lake.name} gathered the age's finest cartographers.`,
    });
  }

  // A golden age at the capital.
  const capital = byScore.find((s) => s.isCapital);
  if (capital) {
    events.push({
      year: 700 + rng.int(0, 500),
      type: "culture",
      title: `The Golden Age of ${capital.name}`,
      text: `Under a long peace, ${capital.name} flourished; its libraries and roads became the wonder of the world.`,
    });
  }

  // The world runs on one timeline: nothing in the founding age may be dated
  // after the present, and the present is the simulation's end year.
  const presentYear = cfg.presentYear ?? (events.at(-1)?.year ?? 1000) + rng.int(20, 80);
  for (const e of events) e.year = Math.min(e.year, presentYear);
  events.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));

  // The world's own calendar, and the year-zero event that explains it.
  const oceanFraction = (() => {
    let n = 0;
    for (let i = 0; i < water.oceanMask.length; i++) n += water.oceanMask[i];
    return n / water.oceanMask.length;
  })();
  const capitalTown = settlements.find((s) => s.isCapital);
  const calendar = makeCalendar(cfg, capitalTown, oceanFraction);
  events.unshift({
    year: 0,
    type: "founding",
    title: calendar.origin.title,
    text: calendar.origin.text,
  });

  return {
    epoch: calendar.era,
    calendar,
    presentYear,
    realms,
    features,
    events,
  };
}
