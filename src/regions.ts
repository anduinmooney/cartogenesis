// regions.ts — L7: partition the land into named regions (provinces).
//
// Scatter well-spaced seed points across the land, then grow regions outward by
// multi-source BFS that never crosses water — so a region's mainland is one
// contiguous landmass. Islands too small to be provinces of their own
// (< ISLET_MIN cells) are folded into the nearest substantial region, the way
// a real coastal province claims its offshore skerries. Each region takes a
// naming culture chosen from its own climate (cold coasts sound Auld, deserts
// sound Kesh, deep forests sound Sylvan, everything else Meridian), so the
// map's cultures follow its geography.

import { Rng } from "./rng.ts";
import type { Grid } from "./grid.ts";
import type { WaterLayer } from "./hydrology.ts";
import type { BiomeLayer } from "./biomes.ts";
import { Biome } from "./biomes.ts";
import { languageById, type Language } from "./names.ts";
import { composeName, hintsForBiome } from "./language.ts";

export interface RegionInfo {
  id: number;
  name: string;
  /** Literal reading of the name, e.g. `"cold-vale"`. */
  gloss: string;
  languageId: string;
  languageLabel: string;
  area: number; // land cells
  cx: number; // centroid x
  cy: number; // centroid y
  coastal: boolean;
  meanElevation: number;
  meanTemperature: number;
  meanMoisture: number;
  dominantBiome: Biome;
  neighbors: number[];
}

export interface RegionLayer {
  /** Region id per cell; -1 for ocean/lake. */
  ids: Int32Array;
  regions: RegionInfo[];
}

const N4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DESERTISH = new Set<number>([
  Biome.Desert,
  Biome.TemperateDesert,
  Biome.ColdDesert,
  Biome.Savanna,
]);
const FORESTISH = new Set<number>([
  Biome.Taiga,
  Biome.TemperateForest,
  Biome.TemperateRainforest,
  Biome.TropicalSeasonalForest,
  Biome.TropicalRainforest,
]);

/** Pick a naming culture from a region's climate + dominant biome. */
function cultureFor(meanTemp: number, dominant: Biome): Language {
  if (meanTemp < 0.34) return languageById("auld");
  if (DESERTISH.has(dominant)) return languageById("kesh");
  if (FORESTISH.has(dominant)) return languageById("sylvan");
  return languageById("meridian");
}

export interface RegionConfig {
  seed: number;
  /** Override the automatic region count. */
  regionCount?: number;
}

export function generateRegions(
  elevation: Grid,
  temperature: Grid,
  moisture: Grid,
  water: WaterLayer,
  biomes: BiomeLayer,
  cfg: RegionConfig,
): RegionLayer {
  const { width, height } = elevation;
  const n = width * height;
  const rng = new Rng(cfg.seed);

  const isLand = (i: number) =>
    water.oceanMask[i] === 0 && water.lakeMask[i] === 0;

  const landCells: number[] = [];
  for (let i = 0; i < n; i++) if (isLand(i)) landCells.push(i);
  const landArea = landCells.length;

  const ids = new Int32Array(n).fill(-1);
  if (landArea === 0) return { ids, regions: [] };

  const regionCount =
    cfg.regionCount ??
    Math.max(4, Math.min(28, Math.round(landArea / 2200)));

  // --- Place well-spaced seed points on land (rejection sampling). ---
  const minDist = Math.sqrt(landArea / regionCount) * 0.7;
  const minDist2 = minDist * minDist;
  const seeds: number[] = [];
  const seedXY: Array<[number, number]> = [];
  let attempts = 0;
  const maxAttempts = regionCount * 400;
  while (seeds.length < regionCount && attempts < maxAttempts) {
    attempts++;
    const c = landCells[rng.int(0, landArea)];
    const x = c % width;
    const y = (c / width) | 0;
    let ok = true;
    for (const [sx, sy] of seedXY) {
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (ok) {
      seeds.push(c);
      seedXY.push([x, y]);
    }
  }

  // --- Multi-source BFS over land only → nearest-seed partition. ---
  const queue = new Int32Array(landArea);
  let qHead = 0;
  let qTail = 0;
  for (let s = 0; s < seeds.length; s++) {
    ids[seeds[s]] = s;
    queue[qTail++] = seeds[s];
  }
  while (qHead < qTail) {
    const i = queue[qHead++];
    const rid = ids[i];
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (ids[ni] === -1 && isLand(ni)) {
        ids[ni] = rid;
        queue[qTail++] = ni;
      }
    }
  }

  // --- Coverage pass: any land component that received no seed (an isolated
  // island) becomes its own region. Guarantees every land cell is assigned. ---
  let nextId = seeds.length;
  for (let start = 0; start < n; start++) {
    if (!isLand(start) || ids[start] !== -1) continue;
    const rid = nextId++;
    ids[start] = rid;
    const stack: number[] = [start];
    while (stack.length > 0) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i / width) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (ids[ni] === -1 && isLand(ni)) {
          ids[ni] = rid;
          stack.push(ni);
        }
      }
    }
  }

  // --- Islets merge: a lone skerry is not a province. Any region smaller
  // than ISLET_MIN cells (an unseeded coverage island, or a seed that landed
  // on one) is folded into the nearest substantial region by centroid — the
  // coastal province claims its offshore isles, as real atlases do. Region
  // ids are NOT renumbered: an emptied id simply yields no region below, so
  // every surviving region keeps its name (each is drawn from a private
  // stream keyed by id). Uses only exact arithmetic (D-022).
  const ISLET_MIN = 12;
  {
    const tally = new Float64Array(nextId);
    const tx = new Float64Array(nextId);
    const ty = new Float64Array(nextId);
    for (let i = 0; i < n; i++) {
      const rid = ids[i];
      if (rid < 0) continue;
      tally[rid]++;
      tx[rid] += i % width;
      ty[rid] += (i / width) | 0;
    }
    const big: number[] = [];
    for (let r = 0; r < nextId; r++) if (tally[r] >= ISLET_MIN) big.push(r);
    // A world of nothing but skerries keeps them all — merging needs a mainland.
    if (big.length > 0 && big.length < nextId) {
      const remap = new Int32Array(nextId);
      for (let r = 0; r < nextId; r++) {
        remap[r] = r;
        if (tally[r] === 0 || tally[r] >= ISLET_MIN) continue;
        const cx = tx[r] / tally[r];
        const cy = ty[r] / tally[r];
        let bestR = big[0];
        let bestD = Infinity;
        for (const b of big) {
          const dx = tx[b] / tally[b] - cx;
          const dy = ty[b] / tally[b] - cy;
          const dd = dx * dx + dy * dy;
          if (dd < bestD) {
            bestD = dd;
            bestR = b;
          }
        }
        remap[r] = bestR;
      }
      for (let i = 0; i < n; i++) if (ids[i] >= 0) ids[i] = remap[ids[i]];
    }
  }

  // --- Accumulate per-region statistics. ---
  const count = nextId;
  const area = new Float64Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const sumE = new Float64Array(count);
  const sumT = new Float64Array(count);
  const sumM = new Float64Array(count);
  const coastal = new Uint8Array(count);
  const biomeTally: Record<number, number>[] = Array.from(
    { length: count },
    () => ({}),
  );
  const neighborSets: Set<number>[] = Array.from(
    { length: count },
    () => new Set<number>(),
  );

  for (let i = 0; i < n; i++) {
    const rid = ids[i];
    if (rid < 0) continue;
    const x = i % width;
    const y = (i / width) | 0;
    area[rid]++;
    sumX[rid] += x;
    sumY[rid] += y;
    sumE[rid] += elevation.data[i];
    sumT[rid] += temperature.data[i];
    sumM[rid] += moisture.data[i];
    const b = biomes.ids[i];
    biomeTally[rid][b] = (biomeTally[rid][b] ?? 0) + 1;

    // Coast + neighbor detection via right/down neighbors (each pair once).
    if (x + 1 < width) {
      const r = i + 1;
      if (water.oceanMask[r] === 1) coastal[rid] = 1;
      else if (ids[r] >= 0 && ids[r] !== rid) {
        neighborSets[rid].add(ids[r]);
        neighborSets[ids[r]].add(rid);
      }
    }
    if (y + 1 < height) {
      const d = i + width;
      if (water.oceanMask[d] === 1) coastal[rid] = 1;
      else if (ids[d] >= 0 && ids[d] !== rid) {
        neighborSets[rid].add(ids[d]);
        neighborSets[ids[d]].add(rid);
      }
    }
  }

  const regions: RegionInfo[] = [];
  const usedNames = new Set<string>();
  for (let r = 0; r < count; r++) {
    if (area[r] === 0) continue;
    let dominant = Biome.Grassland;
    let best = -1;
    for (const key of Object.keys(biomeTally[r])) {
      const id = Number(key);
      if (biomeTally[r][id] > best) {
        best = biomeTally[r][id];
        dominant = id as Biome;
      }
    }
    const meanTemperature = sumT[r] / area[r];
    const lang = cultureFor(meanTemperature, dominant);
    const nameRng = new Rng(`${cfg.seed}:region:${r}`);

    // Name the province after the land it actually is: its biome, its coast,
    // its highlands. `composeName` takes the first hint its template can use.
    const meanElevation = sumE[r] / area[r];
    const hints = [...hintsForBiome(dominant)];
    if (coastal[r] === 1) hints.unshift("sea");
    if (meanElevation > 0.62) hints.unshift("mountain", "high");
    const named = composeName(lang, nameRng, {
      kind: "region",
      hints,
      avoid: usedNames,
    });

    regions.push({
      id: r,
      name: named.name,
      gloss: named.gloss,
      languageId: lang.id,
      languageLabel: lang.label,
      area: area[r],
      cx: Math.round(sumX[r] / area[r]),
      cy: Math.round(sumY[r] / area[r]),
      coastal: coastal[r] === 1,
      meanElevation,
      meanTemperature,
      meanMoisture: sumM[r] / area[r],
      dominantBiome: dominant,
      neighbors: [...neighborSets[r]].sort((a, b) => a - b),
    });
  }

  return { ids, regions };
}
