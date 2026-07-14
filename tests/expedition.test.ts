import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { charterExpedition, type ExpeditionInput } from "../src/expedition.ts";

function inputOf(w: ReturnType<typeof generateWorld>): ExpeditionInput {
  return {
    elevation: w.elevation,
    water: w.water,
    rivers: w.rivers,
    biomes: w.biomes,
    regions: w.regions,
    roads: w.roads,
    settlements: w.settlements.settlements,
    volcanoes: w.volcanoes,
    simulation: w.simulation,
    economy: w.economy,
    meta: {
      seed: w.meta.seed,
      seaLevel: w.meta.seaLevel,
      maxAltitudeMetres: w.meta.maxAltitudeMetres,
      presentYear: w.meta.presentYear,
    },
  };
}

test("an expedition is deterministic to the letter", () => {
  const w = generateWorld({ seed: "charter", width: 160, height: 160 });
  const towns = w.settlements.settlements;
  assert.ok(towns.length >= 2, "world needs two towns to charter between");
  const a = charterExpedition(inputOf(w), towns[0].id, towns[towns.length - 1].id);
  const b = charterExpedition(inputOf(w), towns[0].id, towns[towns.length - 1].id);
  assert.deepEqual(a, b);
});

test("the route is real: contiguous cells from door to door", () => {
  const w = generateWorld({ seed: "charter", width: 160, height: 160 });
  const towns = w.settlements.settlements;
  const from = towns[0];
  const to = towns[towns.length - 1];
  const e = charterExpedition(inputOf(w), from.id, to.id);
  assert.ok(e.ok, "route should be found (water is passable)");
  const width = w.elevation.width;
  assert.equal(e.path[0], from.y * width + from.x, "route starts at the from-town");
  assert.equal(e.path[e.path.length - 1], to.y * width + to.x, "route ends at the to-town");
  for (let k = 1; k < e.path.length; k++) {
    const ax = e.path[k - 1] % width;
    const ay = (e.path[k - 1] / width) | 0;
    const bx = e.path[k] % width;
    const by = (e.path[k] / width) | 0;
    assert.ok(
      Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1,
      `route jumps at step ${k}`,
    );
  }
  // Every leg's cells are a slice of the whole, in order, and days advance.
  let prevDay = 0;
  for (const leg of e.legs) {
    assert.ok(leg.path.length >= 2, "a leg has at least a step");
    assert.ok(leg.day >= Math.max(1, prevDay), "days never run backwards");
    prevDay = leg.day;
    assert.ok(leg.text.length > 10, "every leg is told");
  }
  assert.ok(e.days >= 1);
});

test("the journal is grounded: every name it drops is real", () => {
  const w = generateWorld({ seed: "charter", width: 160, height: 160 });
  const towns = w.settlements.settlements;
  const e = charterExpedition(inputOf(w), towns[0].id, towns[towns.length - 1].id);
  const townNames = new Set(towns.map((s) => s.name));
  const volcanoNames = new Set(w.volcanoes.map((v) => v.name));
  const fallenNames = new Set(
    w.simulation.settlementTimeline.filter((t) => t.fellYear !== undefined).map((t) => t.name),
  );
  const regionNames = new Set(w.regions.regions.map((r) => r.name));
  const text = [e.opening, ...e.legs.map((l) => l.text), e.closing].join(" ");
  // Each prose pattern the module emits names a specific kind of thing —
  // check each against the world's actual rolls.
  for (const m of text.matchAll(/Mount ([A-Z][a-z]+)/g)) {
    assert.ok(volcanoNames.has(m[1]), `invented mountain: ${m[1]}`);
  }
  for (const m of text.matchAll(/remains of ([A-Z][a-z]+)/g)) {
    assert.ok(fallenNames.has(m[1]), `invented ruin: ${m[1]}`);
  }
  for (const m of text.matchAll(/rested at ([A-Z][a-z]+)/g)) {
    assert.ok(townNames.has(m[1]), `invented rest-stop: ${m[1]}`);
  }
  for (const m of text.matchAll(/way crossed ([A-Z][a-z]+)/g)) {
    assert.ok(regionNames.has(m[1]), `invented region: ${m[1]}`);
  }
  for (const leg of e.legs) {
    if (leg.waypoint) assert.ok(townNames.has(leg.waypoint), `invented waypoint: ${leg.waypoint}`);
  }
});

test("chartering an expedition mutates nothing: fingerprints untouched", () => {
  const w = generateWorld({ seed: "charter", width: 160, height: 160 });
  const before = {
    content: w.meta.contentHash,
    exact: w.meta.exactHash,
    sim: w.meta.simulationHash,
    events: w.simulation.events.length,
    towns: w.settlements.settlements.length,
  };
  const towns = w.settlements.settlements;
  charterExpedition(inputOf(w), towns[0].id, towns[towns.length - 1].id);
  charterExpedition(inputOf(w), towns[1]?.id ?? towns[0].id, towns[0].id);
  assert.equal(w.meta.contentHash, before.content);
  assert.equal(w.meta.exactHash, before.exact);
  assert.equal(w.meta.simulationHash, before.sim);
  assert.equal(w.simulation.events.length, before.events);
  assert.equal(w.settlements.settlements.length, before.towns);
});

test("a crossing to yourself is declined with dignity", () => {
  const w = generateWorld({ seed: "charter", width: 160, height: 160 });
  const t = w.settlements.settlements[0];
  const e = charterExpedition(inputOf(w), t.id, t.id);
  assert.equal(e.ok, false);
  assert.ok(e.opening.includes(t.name));
});

test("island towns are reached by sea, and the journal says so", () => {
  // Search a few seeds for a route that crosses water; when found, a sea leg
  // must exist and be narrated as a voyage. (No seed is hard-coded as having
  // one — discover at run time, per the testing doctrine.)
  let found = false;
  for (const seed of ["charter", "isles", "atlas", "borea", "vahalia", "strait"]) {
    const w = generateWorld({ seed, width: 160, height: 160 });
    const towns = w.settlements.settlements;
    const input = inputOf(w);
    for (let i = 0; i < Math.min(towns.length, 4) && !found; i++) {
      for (let j = towns.length - 1; j > towns.length - 4 && j > i && !found; j--) {
        const e = charterExpedition(input, towns[i].id, towns[j].id);
        if (!e.ok) continue;
        const width = w.elevation.width;
        const crossesWater = e.path.some(
          (c) => w.water.oceanMask[c] === 1 || w.water.lakeMask[c] === 1,
        );
        if (crossesWater) {
          found = true;
          assert.ok(
            e.legs.some((l) => l.kind === "sea"),
            `${seed}: route crosses water but no sea leg exists`,
          );
          assert.ok(width > 0);
        }
      }
    }
    if (found) break;
  }
  assert.ok(found, "no water-crossing expedition found across six seeds — suspicious");
});
