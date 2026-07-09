import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes } from "../src/biomes.ts";
import { generateRegions } from "../src/regions.ts";
import { generateSettlements } from "../src/settlements.ts";
import { generateRoads } from "../src/roads.ts";
import { generateHistory } from "../src/history.ts";
import { generateReligion } from "../src/religion.ts";
import { generateResources } from "../src/resources.ts";
import { generateEconomy } from "../src/economy.ts";
import { generateSimulation } from "../src/simulation.ts";

function build(seed: string, size = 200) {
  const w = generateWorld({ seed, width: size, height: size });
  const sim = generateSimulation(
    w.regions,
    w.history,
    w.religion,
    w.settlements.settlements,
    w.economy,
    { seed: 11 },
  );
  return { w, sim };
}

test("simulation is deterministic", () => {
  const a = build("empire", 180);
  const b = build("empire", 180);
  assert.deepEqual(
    a.sim.events.map((e) => [e.year, e.type, e.text]),
    b.sim.events.map((e) => [e.year, e.type, e.text]),
  );
  assert.deepEqual(a.sim.finalControl, b.sim.finalControl);
});

test("every land region always has a controlling realm; population non-negative", () => {
  const { w, sim } = build("borders", 200);
  for (const r of w.regions.regions) {
    assert.ok(r.id in sim.finalControl, `region ${r.id} uncontrolled`);
    assert.ok((sim.population[r.id] ?? 0) >= 0, "negative population");
  }
});

test("history is emergent: borders change and events fire over a run", () => {
  const { w, sim } = build("dynasty", 220);
  assert.ok(sim.events.length > 3, `only ${sim.events.length} events`);

  // Initial control (BFS from seats) vs final control should differ somewhere,
  // OR at least some realms rose/fell — i.e. the world actually evolved.
  const changed = sim.realms.some((r) => r.status !== "ascendant" || r.foundedYear > sim.startYear);
  assert.ok(changed || sim.events.some((e) => e.type === "conquest" || e.type === "secession"));
});

test("events are chronological and within the simulated span", () => {
  const { sim } = build("timeline", 200);
  for (let i = 1; i < sim.events.length; i++) {
    assert.ok(sim.events[i].year >= sim.events[i - 1].year);
  }
  for (const e of sim.events) {
    assert.ok(e.year >= sim.startYear && e.year <= sim.endYear);
  }
});

test("realm summaries are consistent (peak >= final, statuses valid)", () => {
  const { sim } = build("realms", 200);
  assert.ok(sim.realms.length >= 1);
  for (const r of sim.realms) {
    assert.ok(r.peakSize >= r.finalSize, `${r.name}: peak < final`);
    assert.ok(["ascendant", "diminished", "extinct"].includes(r.status));
    if (r.status === "extinct") assert.equal(r.finalSize, 0);
  }
  assert.ok(sim.survivingRealms >= 1, "everyone died");
});
