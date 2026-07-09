import { test } from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../src/grid.ts";
import { analyzeWater } from "../src/hydrology.ts";
import {
  generateTemperature,
  generateMoisture,
  latitudeBand,
} from "../src/climate.ts";
import { generateWorld } from "../src/world.ts";

function meanRow(grid: Grid, y: number): number {
  let s = 0;
  for (let x = 0; x < grid.width; x++) s += grid.get(x, y);
  return s / grid.width;
}

test("latitudeBand is 0 at equator (center) and 1 at the poles (edges)", () => {
  assert.equal(latitudeBand(0, 101), 1);
  assert.equal(latitudeBand(100, 101), 1);
  assert.equal(latitudeBand(50, 101), 0);
});

test("temperature is deterministic and within [0,1]", () => {
  const w = generateWorld({ seed: "clim", width: 96, height: 96 });
  const a = generateTemperature(w.elevation, w.water, {
    seed: 1,
    seaLevel: w.meta.seaLevel,
  });
  const b = generateTemperature(w.elevation, w.water, {
    seed: 1,
    seaLevel: w.meta.seaLevel,
  });
  assert.deepEqual([...a.data], [...b.data]);
  const { min, max } = a.extent();
  assert.ok(min >= 0 && max <= 1);
});

test("equator is warmer than the poles on average", () => {
  const w = generateWorld({ seed: "climate-lat", width: 128, height: 128 });
  const temp = generateTemperature(w.elevation, w.water, {
    seed: 2,
    seaLevel: w.meta.seaLevel,
  });
  const equator = meanRow(temp, 64);
  const north = meanRow(temp, 2);
  const south = meanRow(temp, 125);
  assert.ok(equator > north, `equator ${equator} vs north ${north}`);
  assert.ok(equator > south, `equator ${equator} vs south ${south}`);
});

test("at equal latitude, higher elevation is colder", () => {
  // All-land strip (no ocean → no maritime effect) with one high plateau cell.
  const g = new Grid(9, 3, 0.5);
  g.set(4, 1, 0.95); // a peak in the middle row
  const water = analyzeWater(g, 0.42);
  const temp = generateTemperature(g, water, {
    seed: 3,
    seaLevel: 0.42,
    noiseAmount: 0, // isolate the lapse effect
    maritime: 0,
  });
  assert.ok(
    temp.get(4, 1) < temp.get(1, 1),
    `peak ${temp.get(4, 1)} should be colder than lowland ${temp.get(1, 1)}`,
  );
});

test("moisture is deterministic and within [0,1]", () => {
  const w = generateWorld({ seed: "moist", width: 96, height: 96 });
  const temp = generateTemperature(w.elevation, w.water, {
    seed: 4,
    seaLevel: w.meta.seaLevel,
  });
  const a = generateMoisture(w.elevation, temp, w.water, { seed: 5 });
  const b = generateMoisture(w.elevation, temp, w.water, { seed: 5 });
  assert.deepEqual([...a.data], [...b.data]);
  const { min, max } = a.extent();
  assert.ok(min >= 0 && max <= 1);
});

test("prevailing wind dries the land as it moves inland (west wetter than east)", () => {
  // Ocean on the west (cols 0-2), flat land to the east (cols 3-11).
  const g = new Grid(12, 3, 0.5);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) g.set(x, y, 0.1);
  }
  const water = analyzeWater(g, 0.42);
  const temp = generateTemperature(g, water, { seed: 6, seaLevel: 0.42 });
  const moist = generateMoisture(g, temp, water, {
    seed: 7,
    noiseAmount: 0,
  });
  assert.ok(
    moist.get(3, 1) > moist.get(11, 1),
    `windward coast ${moist.get(3, 1)} should be wetter than interior ${moist.get(11, 1)}`,
  );
});
