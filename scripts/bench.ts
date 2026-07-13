// bench.ts — How long a world takes, and where the time goes.
//
// Times full generation at three sizes (median of three runs), then breaks a
// mid-size world down by re-running the separable stages on its own inputs.
// The stage timings are indicative, not a profile — they re-run real functions
// on real data, so they move with the code, which is the point: run this after
// heavy changes and compare against the budget in PROJECT_STATE.md.
//
// Usage: node scripts/bench.ts

import { generateWorld } from "../src/world.ts";
import { generateElevation } from "../src/terrain.ts";
import { erode } from "../src/erosion.ts";
import { generateRivers } from "../src/rivers.ts";
import { generateRoads } from "../src/roads.ts";
import { worldReportMarkdown } from "../src/report.ts";
import {
  renderContours,
  renderHypsometric,
  renderRegions,
} from "../src/render.ts";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

function time(fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function timeMedian(runs: number, fn: () => unknown): number {
  const xs: number[] = [];
  for (let i = 0; i < runs; i++) xs.push(time(fn));
  return median(xs);
}

console.log("Cartogenesis benchmark (medians of 3; times in ms)\n");

// --- Full generation at three sizes. ---
console.log("size      generateWorld");
for (const size of [256, 384, 512]) {
  const ms = timeMedian(3, () => generateWorld({ seed: "bench", width: size, height: size }));
  console.log(`${String(size + "²").padEnd(9)} ${Math.round(ms)}`);
}

// --- Stage breakdown on a 384² world. ---
const size = 384;
const w = generateWorld({ seed: "bench", width: size, height: size });
const base = generateElevation({ width: size, height: size, seed: 1 });

const stages: Array<[string, () => unknown]> = [
  ["elevation (noise)", () => generateElevation({ width: size, height: size, seed: 1 })],
  ["erosion", () => erode(base, { seed: 2 })],
  ["rivers", () => generateRivers(w.elevation, w.water, w.moisture, {})],
  ["roads (all towns)", () => generateRoads(w.elevation, w.water, w.rivers, w.settlements.settlements, {})],
  ["render: hypsometric", () => renderHypsometric(w.elevation, w.meta.seaLevel, { water: w.water })],
  ["render: contours", () => renderContours(w.elevation, w.meta.seaLevel, w.meta.maxAltitudeMetres)],
  ["render: regions", () => renderRegions(w.regions, w.water, w.elevation)],
  ["report (gazetteer)", () => worldReportMarkdown(w)],
];

console.log("\nstage (384²)          median");
for (const [name, fn] of stages) {
  console.log(`${name.padEnd(21)} ${Math.round(timeMedian(3, fn))}`);
}

console.log(
  "\nCompare against the budget in PROJECT_STATE.md; investigate anything 2× over.",
);
