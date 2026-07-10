import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes, Biome } from "../src/biomes.ts";
import { generateResources, Resource, RESOURCE_NAMES, RESOURCE_COLORS } from "../src/resources.ts";

function build(seed: string, size = 200) {
  const w = generateWorld({ seed, width: size, height: size });
  const biomes = classifyBiomes(w.elevation, w.temperature, w.moisture, w.water, w.meta.seaLevel);
  const res = generateResources(
    w.elevation,
    biomes,
    w.water,
    w.temperature,
    w.moisture,
    w.meta.seaLevel,
    { seed: 9 },
  );
  return { w, biomes, res };
}

test("resource generation is deterministic", () => {
  const a = build("ore", 160);
  const b = build("ore", 160);
  assert.deepEqual(
    a.res.deposits.map((d) => [d.kind, d.x, d.y]),
    b.res.deposits.map((d) => [d.kind, d.x, d.y]),
  );
});

test("a reasonably sized world has a variety of deposits", () => {
  const { res } = build("rich", 220);
  assert.ok(res.deposits.length > 20, `only ${res.deposits.length} deposits`);
  const kinds = new Set(res.deposits.map((d) => d.kind));
  assert.ok(kinds.size >= 5, `only ${kinds.size} kinds`);
});

test("all deposits sit on land, richness in (0,1]", () => {
  const { w, res } = build("onland", 200);
  const width = w.elevation.width;
  for (const d of res.deposits) {
    const i = d.y * width + d.x;
    assert.equal(w.water.oceanMask[i], 0, "deposit in ocean");
    assert.equal(w.water.lakeMask[i], 0, "deposit in lake");
    assert.ok(d.richness > 0 && d.richness <= 1);
  }
});

test("ore/gems sit high; fish sit near water", () => {
  const { w, res } = build("placement", 220);
  const width = w.elevation.width;
  const seaLevel = w.meta.seaLevel;
  for (const d of res.deposits) {
    const i = d.y * width + d.x;
    const eAbove = (w.elevation.data[i] - seaLevel) / (1 - seaLevel);
    if (d.kind === Resource.Gems || d.kind === Resource.Gold) {
      assert.ok(eAbove > 0.3, `${RESOURCE_NAMES[d.kind]} too low at ${eAbove.toFixed(2)}`);
    }
    if (d.kind === Resource.Fish) {
      // Near the ocean, OR beside any lake — a crater lake high in the mountains
      // is far from the sea but is still water fish can live in.
      let nearLake = false;
      for (let dy = -2; dy <= 2 && !nearLake; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = d.x + dx;
          const ny = d.y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= w.elevation.height) continue;
          if (w.water.lakeMask[ny * width + nx]) {
            nearLake = true;
            break;
          }
        }
      }
      assert.ok(
        w.water.distToOcean.data[i] <= 3 || nearLake,
        "fish far from any water",
      );
    }
  }
});

test("every resource kind has a name and RGB color", () => {
  for (const key of Object.values(Resource)) {
    assert.ok(RESOURCE_NAMES[key], `no name for ${key}`);
    assert.equal(RESOURCE_COLORS[key].length, 3);
  }
});
