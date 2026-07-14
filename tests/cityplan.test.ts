import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateCityPlan, PLAN, type CityPlanInput } from "../src/cityplan.ts";

function inputOf(w: ReturnType<typeof generateWorld>): CityPlanInput {
  return {
    water: w.water,
    rivers: w.rivers,
    regions: w.regions,
    settlements: w.settlements.settlements,
    roads: w.roads,
    simulation: w.simulation,
    economy: w.economy,
    religion: w.religion,
    lore: w.lore,
    history: w.history,
    meta: { seed: w.meta.seed, width: w.elevation.width, presentYear: w.meta.presentYear },
  };
}

const world = generateWorld({ seed: "plans", width: 200, height: 200 });
const input = inputOf(world);

test("a town plan is deterministic to the cell", () => {
  const t = world.settlements.settlements[0];
  const a = generateCityPlan(input, t.id);
  const b = generateCityPlan(input, t.id);
  assert.ok(a && b);
  assert.deepEqual([...a!.cells], [...b!.cells]);
  assert.deepEqual(a!.facts, b!.facts);
  assert.deepEqual(a!.landmarks, b!.landmarks);
});

test("every settlement has a plan with streets, a market, and its dossier", () => {
  for (const s of world.settlements.settlements) {
    const p = generateCityPlan(input, s.id);
    assert.ok(p, `${s.name} has no plan`);
    const counts = new Map<number, number>();
    for (const c of p!.cells) counts.set(c, (counts.get(c) ?? 0) + 1);
    assert.ok((counts.get(PLAN.Street) ?? 0) > 10, `${s.name}: no streets`);
    assert.ok(
      (counts.get(PLAN.Market) ?? 0) + (counts.get(PLAN.Field) ?? 0) > 0,
      `${s.name}: no market or fields`,
    );
    assert.ok(p!.facts.length >= 2, `${s.name}: dossier too thin`);
    // A fallen town wears the name the map remembers (the timeline's), which
    // for a renamed-then-fallen town differs from the settlement list's.
    const timed = world.simulation.settlementTimeline.find((t) => t.id === s.id);
    const expected = timed?.fellYear !== undefined ? timed.name : s.name;
    assert.ok(p!.facts[0].includes(expected), `${s.name}: dossier names neither name`);
    assert.ok(
      p!.landmarks.some((l) => l.kind === "market"),
      `${s.name}: no market landmark`,
    );
  }
});

test("the gates are real: each names a town its actual road runs to", () => {
  const byId = new Map(world.settlements.settlements.map((s) => [s.id, s]));
  const names = new Set(world.settlements.settlements.map((s) => s.name));
  const regionNames = new Set(world.regions.regions.map((r) => r.name));
  for (const s of world.settlements.settlements) {
    const connected = new Set<string>();
    for (const e of world.roads.edges) {
      if (e.a === s.id) connected.add(byId.get(e.b)?.name ?? "");
      if (e.b === s.id) connected.add(byId.get(e.a)?.name ?? "");
    }
    const p = generateCityPlan(input, s.id)!;
    for (const l of p.landmarks) {
      if (l.kind !== "gate") continue;
      const to = l.note.replace("the road to ", "");
      assert.ok(
        connected.has(to) || regionNames.has(to),
        `${s.name}: gate roads to "${to}", which no road or region justifies`,
      );
    }
  }
});

test("the temple names the region's real god; the keep its real house", () => {
  for (const s of world.settlements.settlements) {
    const p = generateCityPlan(input, s.id)!;
    const faithId = world.religion.regionFaith[s.regionId];
    const faith = world.religion.faiths.find((f) => f.id === faithId);
    for (const l of p.landmarks) {
      if ((l.kind === "temple" || l.kind === "shrine") && faith) {
        assert.ok(l.name.includes(faith.deity.name), `${s.name}: temple of a foreign god`);
      }
      if (l.kind === "keep" && l.name.startsWith("the hall of House ")) {
        const houseName = l.name.replace("the hall of House ", "");
        assert.ok(
          world.lore.houses.some((h) => h.name === houseName),
          `${s.name}: keep of an invented house`,
        );
      }
    }
  }
});

test("a port's water lies on the plan; a landlocked town's does not", () => {
  for (const s of world.settlements.settlements) {
    const p = generateCityPlan(input, s.id)!;
    const waterCells = [...p.cells].filter((c) => c === PLAN.Water).length;
    if (s.isPort) {
      assert.ok(waterCells > 50, `${s.name} is a port with no harbour`);
      assert.ok(
        p.landmarks.some((l) => l.kind === "quay"),
        `${s.name}: port without quays`,
      );
    } else {
      assert.equal(waterCells, 0, `${s.name} is landlocked but its plan has sea`);
    }
  }
});

test("walls enclose the town when history earned them, with gates carved through", () => {
  let sawWalls = false;
  for (const s of world.settlements.settlements) {
    const p = generateCityPlan(input, s.id)!;
    if (!p.walled || p.ruined) continue;
    sawWalls = true;
    const wallCount = [...p.cells].filter((c) => c === PLAN.Wall).length;
    assert.ok(wallCount > 20, `${s.name}: walled but nearly wall-less`);
    // Walking east from the centre must meet wall or gate (or the sea) before
    // the plan's edge — the enclosure is real.
    const W = p.width;
    let met = false;
    for (let x = Math.floor(W / 2); x < W; x++) {
      const c = p.cells[Math.floor(W / 2) * W + x];
      if (c === PLAN.Wall || c === PLAN.Gate || c === PLAN.Water || c === PLAN.Quay) {
        met = true;
        break;
      }
    }
    assert.ok(met, `${s.name}: open country east of a walled town`);
  }
  assert.ok(sawWalls, "no walled standing town in the test world — suspicious");
});

test("a fallen town's plan is a ruin, and says so", () => {
  const fallen = world.simulation.settlementTimeline.filter((t) => t.fellYear !== undefined);
  assert.ok(fallen.length > 0, "test world has no ruins to plan");
  for (const f of fallen) {
    const p = generateCityPlan(input, f.id)!;
    assert.ok(p.ruined);
    assert.ok(p.title.startsWith("What remains of "));
    assert.ok(
      [...p.cells].some((c) => c === PLAN.Rubble),
      `${f.name}: a ruin without rubble`,
    );
    assert.ok(
      p.facts.some((line) => line.includes(String(f.fellYear))),
      `${f.name}: the fall is not dated`,
    );
  }
});

test("planning a city mutates nothing: fingerprints untouched", () => {
  const before = {
    content: world.meta.contentHash,
    exact: world.meta.exactHash,
    sim: world.meta.simulationHash,
    events: world.simulation.events.length,
  };
  for (const s of world.settlements.settlements.slice(0, 5)) {
    generateCityPlan(input, s.id);
  }
  assert.equal(world.meta.contentHash, before.content);
  assert.equal(world.meta.exactHash, before.exact);
  assert.equal(world.meta.simulationHash, before.sim);
  assert.equal(world.simulation.events.length, before.events);
});

test("a fallen town can be drawn as it stood: same streets, no rubble (S27)", () => {
  const fallen = world.simulation.settlementTimeline.find((t) => t.fellYear !== undefined);
  assert.ok(fallen, "test world has no ruins");
  const asRuin = generateCityPlan(input, fallen!.id)!;
  const whole = generateCityPlan(input, fallen!.id, { asItStood: true })!;
  assert.equal(asRuin.ruined, true);
  assert.equal(whole.ruined, false);
  assert.equal(whole.fell, true);
  assert.equal(whole.title, `${fallen!.name}, as it stood`);
  assert.ok(![...whole.cells].some((c) => c === PLAN.Rubble), "whole view has rubble");
  assert.ok([...asRuin.cells].some((c) => c === PLAN.Rubble), "ruin view lost its rubble");
  // The two views share every street — the ruin transform only damages.
  const W = asRuin.width;
  for (let i = 0; i < W * W; i++) {
    if (whole.cells[i] === PLAN.Street) {
      assert.equal(asRuin.cells[i], PLAN.Street, `street lost at cell ${i}`);
    }
  }
  assert.ok(
    whole.facts.some((f) => f.includes("as it stood")),
    "the whole view does not admit the town fell",
  );
});
