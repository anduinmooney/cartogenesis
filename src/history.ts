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
import { makeName, languageById } from "./names.ts";

export interface Realm {
  id: number;
  name: string;
  seat: string; // settlement name
  regionId: number;
  foundedYear: number;
}

export interface NamedFeature {
  kind: "peak" | "river" | "lake";
  name: string;
  x: number;
  y: number;
}

export interface HistoryEvent {
  year: number;
  type: "founding" | "realm" | "war" | "disaster" | "culture" | "union";
  title: string;
  text: string;
}

export interface HistoryLayer {
  epoch: string;
  presentYear: number;
  realms: Realm[];
  features: NamedFeature[];
  events: HistoryEvent[];
}

export interface HistoryConfig {
  seed: number;
}

function nameAtCell(
  regions: RegionLayer,
  cell: number,
  key: string,
): string {
  const rid = regions.ids[cell];
  const region = regions.regions.find((r) => r.id === rid);
  const lang = languageById(region?.languageId ?? "meridian");
  return makeName(lang, new Rng(key));
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
      name: nameAtCell(regions, peakI, `${seed}:peak`),
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
      name: nameAtCell(regions, mouthI, `${seed}:river`),
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
      name: nameAtCell(regions, lakeI, `${seed}:lake`),
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
    const name = makeName(lang, new Rng(`${cfg.seed}:realm:${i}`));
    events.push({
      year: founded,
      type: "realm",
      title: `The ${name} proclaimed`,
      text: `${c.name} rose to rule its hinterland, and the realm of ${name} was proclaimed.`,
    });
    return { id: i, name, seat: c.name, regionId: c.regionId, foundedYear: founded };
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

  events.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  const presentYear = (events.at(-1)?.year ?? 1000) + rng.int(20, 80);

  return {
    epoch: "After Reckoning",
    presentYear,
    realms,
    features,
    events,
  };
}
