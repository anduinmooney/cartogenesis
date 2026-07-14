import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";

// L17c — a traveller's account, walked on the real present-day road tree.

test("the journey is deterministic to the letter", () => {
  const a = generateWorld({ seed: "ct0", width: 200, height: 200 });
  const b = generateWorld({ seed: "ct0", width: 200, height: 200 });
  assert.deepEqual(a.journey, b.journey);
});

test("the traveller starts at the capital and walks only real roads", () => {
  for (const seed of ["ct0", "atlas", "borea"]) {
    const w = generateWorld({ seed, width: 220, height: 220 });
    const j = w.journey;
    if (j.legs.length === 0) continue; // a roadless world tells no legs
    const capital = w.settlements.settlements.find((s) => s.isCapital)!;
    assert.equal(j.legs[0].fromId, capital.id, `${seed}: journey must start at the capital`);
    // Every leg is a real road edge between standing settlements, and every
    // leg's origin has already been visited (the walk is connected).
    const edgeSet = new Set(w.roads.edges.flatMap((e) => [`${e.a}|${e.b}`, `${e.b}|${e.a}`]));
    const visited = new Set([capital.id]);
    for (const leg of j.legs) {
      assert.ok(edgeSet.has(`${leg.fromId}|${leg.toId}`), `${seed}: leg is not a road`);
      assert.ok(visited.has(leg.fromId), `${seed}: leg starts from unvisited town`);
      visited.add(leg.toId);
    }
    // No town is arrived at twice.
    const arrivals = j.legs.map((l) => l.toId);
    assert.equal(new Set(arrivals).size, arrivals.length, `${seed}: revisited a town`);
  }
});

test("the prose is grounded and leak-free", () => {
  const w = generateWorld({ seed: "ct0", width: 220, height: 220 });
  const byId = new Map(w.settlements.settlements.map((s) => [s.id, s]));
  const all = [...w.journey.opening, ...w.journey.legs.map((l) => l.prose), ...w.journey.closing].join("\n");
  for (const leak of ["undefined", "${", "[object", "NaN"]) {
    assert.ok(!all.includes(leak), `leaked ${leak}`);
  }
  for (const leg of w.journey.legs) {
    assert.ok(leg.prose.includes(byId.get(leg.toId)!.name), "leg does not name its destination");
  }
  // The opening names the capital and the present year.
  assert.ok(w.journey.opening[0].includes(w.meta.capital));
  assert.ok(w.journey.opening[0].includes(String(w.meta.presentYear)));
});

test("present-day settlement names are unique — conquest renaming cannot collide", () => {
  // The journey exposed two towns both renamed "Khirlamor"; the contact pass
  // now retries with a salted stream and skips rather than duplicate.
  for (let i = 0; i < 12; i++) {
    const w = generateWorld({ seed: `ct${i}`, width: 240, height: 240 });
    const names = w.settlements.settlements.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `ct${i}: duplicate present-day names`);
  }
});

test("the journey never perturbs the world: fingerprints byte-identical", () => {
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "86c5fef61d7a567b");
  assert.equal(w.meta.exactHash, "418ddfd224e6f31c");
  assert.equal(w.meta.simulationHash, "09995e242eccf8b9");
});
