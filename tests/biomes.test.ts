import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Biome,
  classifyCell,
  classifyBiomes,
  BIOME_NAMES,
  BIOME_COLORS,
} from "../src/biomes.ts";
import { generateWorld } from "../src/world.ts";

test("classifyCell: high elevation is snow, mid-high is alpine", () => {
  assert.equal(classifyCell(0.9, 0.8, 0.5), Biome.Snow);
  assert.equal(classifyCell(0.7, 0.8, 0.5), Biome.Alpine);
  assert.equal(classifyCell(0.7, 0.1, 0.5), Biome.Snow); // cold high → snow
});

test("classifyCell: hot & wet lowland is tropical rainforest", () => {
  assert.equal(classifyCell(0.1, 0.95, 0.95), Biome.TropicalRainforest);
});

test("classifyCell: hot & dry lowland is desert", () => {
  assert.equal(classifyCell(0.1, 0.95, 0.05), Biome.Desert);
});

test("classifyCell: cold & wet is taiga; cold & dry is cold desert", () => {
  assert.equal(classifyCell(0.1, 0.05, 0.95), Biome.Taiga);
  assert.equal(classifyCell(0.1, 0.05, 0.05), Biome.ColdDesert);
});

test("every biome has a name and a color", () => {
  for (const key of Object.keys(BIOME_NAMES)) {
    const id = Number(key) as Biome;
    assert.ok(BIOME_NAMES[id], `missing name for ${id}`);
    assert.ok(BIOME_COLORS[id], `missing color for ${id}`);
    assert.equal(BIOME_COLORS[id].length, 3);
  }
});

test("classifyBiomes maps water cells to Ocean/Lake and is deterministic", () => {
  const w = generateWorld({ seed: "biome", width: 128, height: 128 });
  const a = classifyBiomes(w.elevation, w.temperature, w.moisture, w.water, w.meta.seaLevel);
  const b = classifyBiomes(w.elevation, w.temperature, w.moisture, w.water, w.meta.seaLevel);
  assert.deepEqual([...a.ids], [...b.ids]);

  const n = w.elevation.width * w.elevation.height;
  for (let i = 0; i < n; i++) {
    if (w.water.oceanMask[i] === 1) assert.equal(a.ids[i], Biome.Ocean);
    if (w.water.lakeMask[i] === 1) assert.equal(a.ids[i], Biome.Lake);
  }
});

test("a generated world has biome diversity and a land-based dominant biome", () => {
  const w = generateWorld({ seed: "diverse", width: 160, height: 160 });
  const bl = classifyBiomes(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.meta.seaLevel,
  );
  assert.ok(bl.diversity >= 3, `expected several biomes, got ${bl.diversity}`);
  assert.notEqual(bl.dominant, Biome.Ocean);
  assert.notEqual(bl.dominant, Biome.Lake);
});
