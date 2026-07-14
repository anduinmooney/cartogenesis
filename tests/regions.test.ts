import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateRegions } from "../src/regions.ts";
import { classifyBiomes } from "../src/biomes.ts";

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
    { seed: 42 },
  );
  return { w, regions };
}

test("regions partition is deterministic", () => {
  const a = build("prov", 128);
  const b = build("prov", 128);
  assert.deepEqual([...a.regions.ids], [...b.regions.ids]);
  assert.deepEqual(
    a.regions.regions.map((r) => r.name),
    b.regions.regions.map((r) => r.name),
  );
});

test("every land cell belongs to exactly one region; no water does", () => {
  const { w, regions } = build("part", 128);
  const n = w.elevation.width * w.elevation.height;
  let landLabeled = 0;
  let landTotal = 0;
  for (let i = 0; i < n; i++) {
    const isLand = w.water.oceanMask[i] === 0 && w.water.lakeMask[i] === 0;
    if (isLand) {
      landTotal++;
      if (regions.ids[i] >= 0) landLabeled++;
    } else {
      assert.equal(regions.ids[i], -1, `water cell ${i} got a region`);
    }
  }
  assert.equal(landLabeled, landTotal, "some land cells are unassigned");
});

test("region areas sum to the land cell count", () => {
  const { w, regions } = build("sum", 128);
  const n = w.elevation.width * w.elevation.height;
  let land = 0;
  for (let i = 0; i < n; i++) {
    if (w.water.oceanMask[i] === 0 && w.water.lakeMask[i] === 0) land++;
  }
  const totalArea = regions.regions.reduce((s, r) => s + r.area, 0);
  assert.equal(totalArea, land);
});

test("regions have names and plausible metadata", () => {
  const { regions } = build("meta", 160);
  assert.ok(regions.regions.length >= 4, "expected several regions");
  for (const r of regions.regions) {
    assert.ok(r.name.length >= 2);
    assert.ok(r.area > 0);
    assert.ok(r.meanTemperature >= 0 && r.meanTemperature <= 1);
    assert.ok(["auld", "meridian", "kesh", "sylvan"].includes(r.languageId));
  }
});

test("neighbor relations are symmetric", () => {
  const { regions } = build("adj", 160);
  const byId = new Map(regions.regions.map((r) => [r.id, r]));
  for (const r of regions.regions) {
    for (const nb of r.neighbors) {
      const other = byId.get(nb);
      assert.ok(other, `neighbor ${nb} missing`);
      assert.ok(
        other!.neighbors.includes(r.id),
        `asymmetric adjacency ${r.id}<->${nb}`,
      );
    }
  }
});

test("no region smaller than the islet threshold survives (when a mainland exists)", () => {
  // Across several seeds: every surviving region has at least ISLET_MIN cells,
  // provided the world has at least one substantial region to merge into.
  for (const seed of ["prov", "isles", "atlas", "s10"]) {
    const { regions } = build(seed, 160);
    const biggest = Math.max(...regions.regions.map((r) => r.area));
    if (biggest < 12) continue; // a world of nothing but skerries keeps them
    for (const r of regions.regions) {
      assert.ok(
        r.area >= 12,
        `${seed}: region ${r.name} (id ${r.id}) survives with only ${r.area} cells`,
      );
    }
  }
});
