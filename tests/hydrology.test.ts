import { test } from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../src/grid.ts";
import { analyzeWater, countComponents } from "../src/hydrology.ts";
import { generateWorld } from "../src/world.ts";

/** Build a small hand-crafted elevation grid from a row-major number array. */
function gridFrom(rows: number[][]): Grid {
  const h = rows.length;
  const w = rows[0].length;
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) g.set(x, y, rows[y][x]);
  }
  return g;
}

test("border-connected low cells become ocean; enclosed lows become lakes", () => {
  // A ring of land (0.9) around a low interior (0.1); border is ocean (0.1).
  const g = gridFrom([
    [0.1, 0.1, 0.1, 0.1, 0.1],
    [0.1, 0.9, 0.9, 0.9, 0.1],
    [0.1, 0.9, 0.1, 0.9, 0.1],
    [0.1, 0.9, 0.9, 0.9, 0.1],
    [0.1, 0.1, 0.1, 0.1, 0.1],
  ]);
  const w = analyzeWater(g, 0.5);
  // Center cell is a lake (low, but walled off from the border ocean).
  assert.equal(w.lakeMask[g.index(2, 2)], 1);
  assert.equal(w.oceanMask[g.index(2, 2)], 0);
  // Border cell is ocean.
  assert.equal(w.oceanMask[g.index(0, 0)], 1);
  assert.equal(w.lakeCount, 1);
});

test("no lake when the low interior connects to the border", () => {
  // Open channel from center to the border → all low water is ocean.
  const g = gridFrom([
    [0.1, 0.1, 0.1, 0.1, 0.1],
    [0.1, 0.9, 0.9, 0.9, 0.1],
    [0.1, 0.1, 0.1, 0.9, 0.1], // gap at (1,2) connects interior out
    [0.1, 0.9, 0.9, 0.9, 0.1],
    [0.1, 0.1, 0.1, 0.1, 0.1],
  ]);
  const w = analyzeWater(g, 0.5);
  assert.equal(w.lakeCount, 0);
  assert.equal(w.oceanMask[g.index(2, 2)], 1);
});

test("coast marks land adjacent to ocean, distance is 0 there", () => {
  const g = gridFrom([
    [0.1, 0.1, 0.1],
    [0.1, 0.9, 0.1],
    [0.1, 0.1, 0.1],
  ]);
  const w = analyzeWater(g, 0.5);
  const center = g.index(1, 1);
  assert.equal(w.coast[center], 1, "the lone land cell is coast");
  assert.equal(w.distToOcean.data[g.index(0, 0)], 0, "ocean cell dist 0");
  assert.equal(w.distToOcean.data[center], 1, "land 1 step from ocean");
});

test("countComponents counts disjoint blobs", () => {
  const mask = new Uint8Array([
    1, 0, 1,
    0, 0, 0,
    1, 0, 1,
  ]);
  assert.equal(countComponents(mask, 3, 3), 4);
});

test("ocean + land + lake fractions are consistent", () => {
  const world = generateWorld({ seed: "hydro", width: 128, height: 128 });
  const w = analyzeWater(world.elevation, world.meta.seaLevel);
  const land = 1 - w.oceanFraction - w.lakeFraction;
  assert.ok(land > 0 && land < 1);
  assert.ok(w.oceanFraction > 0, "an island world should have ocean");
});

test("analyzeWater is deterministic", () => {
  const world = generateWorld({ seed: "hydro", width: 96, height: 96 });
  const a = analyzeWater(world.elevation, world.meta.seaLevel);
  const b = analyzeWater(world.elevation, world.meta.seaLevel);
  assert.deepEqual([...a.oceanMask], [...b.oceanMask]);
  assert.deepEqual([...a.distToOcean.data], [...b.distToOcean.data]);
  assert.equal(a.lakeCount, b.lakeCount);
});

test("every border ocean-height cell is classified ocean, not lake", () => {
  const world = generateWorld({ seed: "borders", width: 100, height: 100 });
  const { width, height } = world.elevation;
  const w = analyzeWater(world.elevation, world.meta.seaLevel);
  const check = (x: number, y: number) => {
    const i = y * width + x;
    if (world.elevation.data[i] < world.meta.seaLevel) {
      assert.equal(w.lakeMask[i], 0, `border lake at ${x},${y}`);
    }
  };
  for (let x = 0; x < width; x++) {
    check(x, 0);
    check(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    check(0, y);
    check(width - 1, y);
  }
});
