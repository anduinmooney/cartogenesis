import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes } from "../src/biomes.ts";
import { generateResources } from "../src/resources.ts";
import { generateEconomy } from "../src/economy.ts";

function build(seed: string, size = 200) {
  const w = generateWorld({ seed, width: size, height: size });
  const biomes = classifyBiomes(w.elevation, w.temperature, w.moisture, w.water, w.meta.seaLevel);
  const res = generateResources(w.elevation, biomes, w.water, w.temperature, w.moisture, w.meta.seaLevel, { seed: 9 });
  const eco = generateEconomy(w.settlements.settlements, w.roads, res, { seed: 3 });
  return { w, res, eco };
}

test("economy is deterministic", () => {
  const a = build("trade", 180);
  const b = build("trade", 180);
  assert.deepEqual(
    a.eco.economies.map((e) => [e.settlementId, e.tier, e.produces.join(",")]),
    b.eco.economies.map((e) => [e.settlementId, e.tier, e.produces.join(",")]),
  );
  assert.deepEqual(a.eco.majorExports, b.eco.majorExports);
});

test("every settlement has an economy entry; wealth in [0,1]", () => {
  const { w, eco } = build("wealth", 200);
  assert.equal(eco.economies.length, w.settlements.settlements.length);
  for (const e of eco.economies) {
    assert.ok(e.wealth >= 0 && e.wealth <= 1, `wealth ${e.wealth}`);
    assert.ok(["poor", "modest", "prosperous", "rich"].includes(e.tier));
  }
});

test("the richest settlement is a real settlement", () => {
  const { w, eco } = build("richest", 200);
  const ids = new Set(w.settlements.settlements.map((s) => s.id));
  assert.ok(ids.has(eco.richest));
});

test("trade hubs have at least two roads", () => {
  const { eco } = build("hubs", 220);
  for (const e of eco.economies) {
    if (e.isTradeHub) assert.ok(e.degree >= 2, "hub with <2 roads");
  }
});

test("major exports are populated when there are deposits", () => {
  const { res, eco } = build("exports", 220);
  if (res.deposits.length > 0) {
    assert.ok(eco.majorExports.length >= 1);
  }
});
