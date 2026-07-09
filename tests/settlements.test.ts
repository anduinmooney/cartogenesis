import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes } from "../src/biomes.ts";
import { generateRegions } from "../src/regions.ts";
import {
  generateSettlements,
  habitabilityField,
} from "../src/settlements.ts";

function build(seed: string, size = 160) {
  const w = generateWorld({ seed, width: size, height: size });
  const biomes = classifyBiomes(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.meta.seaLevel,
  );
  const regions = generateRegions(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    biomes,
    { seed: 1 },
  );
  const s = generateSettlements(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.rivers,
    regions,
    w.meta.seaLevel,
    { seed: 2 },
  );
  return { w, regions, s };
}

test("settlement placement is deterministic", () => {
  const a = build("cityseed", 128);
  const b = build("cityseed", 128);
  assert.deepEqual(
    a.s.settlements.map((t) => [t.x, t.y, t.name, t.tier]),
    b.s.settlements.map((t) => [t.x, t.y, t.name, t.tier]),
  );
});

test("habitability is 0 on water and in [0,1] on land", () => {
  const { w } = build("hab", 120);
  const hab = habitabilityField(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.rivers,
    w.meta.seaLevel,
  );
  const n = w.elevation.width * w.elevation.height;
  for (let i = 0; i < n; i++) {
    assert.ok(hab.data[i] >= 0 && hab.data[i] <= 1);
    if (w.water.oceanMask[i] === 1 || w.water.lakeMask[i] === 1) {
      assert.equal(hab.data[i], 0, "water should be uninhabitable");
    }
  }
});

test("settlements sit on land and keep their distance", () => {
  const { w, s } = build("spacing", 160);
  assert.ok(s.settlements.length >= 4, "expected several settlements");
  for (const t of s.settlements) {
    const i = t.y * w.elevation.width + t.x;
    assert.equal(w.water.oceanMask[i], 0, "settlement in ocean");
    assert.equal(w.water.lakeMask[i], 0, "settlement in lake");
  }
  // No two settlements share a cell.
  const keys = new Set(s.settlements.map((t) => `${t.x},${t.y}`));
  assert.equal(keys.size, s.settlements.length);
});

test("exactly one capital, and tiers are ordered by score", () => {
  const { s } = build("capital", 160);
  const capitals = s.settlements.filter((t) => t.isCapital);
  assert.equal(capitals.length, 1);
  assert.equal(capitals[0].tier, "city");
  // Scores are non-increasing by id (placement order = rank).
  for (let i = 1; i < s.settlements.length; i++) {
    assert.ok(s.settlements[i - 1].score >= s.settlements[i].score);
  }
});

test("settlements are named and tagged with a region", () => {
  const { s, regions } = build("named", 160);
  const ids = new Set(regions.regions.map((r) => r.id));
  for (const t of s.settlements) {
    assert.ok(t.name.length >= 2);
    assert.ok(ids.has(t.regionId), `bad region ${t.regionId}`);
  }
});
