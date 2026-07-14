import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/rng.ts";
import { pickWorldType, maskAt, edgeFalloff } from "../src/worldtype.ts";
import { generateWorld } from "../src/world.ts";

const KNOWN = new Set([
  "continent",
  "twin",
  "isles",
  "archipelago",
  "pangaea",
  "oceanic",
  "ring",
  "shattered",
]);
const RARE = new Set(["pangaea", "oceanic", "ring", "shattered"]);

test("world type is deterministic and one of the known archetypes", () => {
  for (const seed of ["a", "b", "c", "d"]) {
    const a = pickWorldType(new Rng(`${seed}:worldtype`));
    const b = pickWorldType(new Rng(`${seed}:worldtype`));
    assert.deepEqual(a, b, "same seed drew a different world type");
    assert.ok(KNOWN.has(a.name), `unknown archetype ${a.name}`);
    assert.equal(RARE.has(a.name), a.rare, `${a.name}: rare flag disagrees`);
  }
});

test("the mask is bounded, and the edge rings the world in ocean", () => {
  const wt = pickWorldType(new Rng("mask:worldtype"));
  for (let i = 0; i < 500; i++) {
    const nx = (i * 7919) % 1000 / 1000;
    const ny = (i * 104729) % 1000 / 1000;
    const m = maskAt(nx, ny, wt);
    assert.ok(m >= 0 && m <= 1.0001, `mask out of range: ${m}`);
  }
  // The outer margin falls to zero; the centre is full.
  assert.equal(edgeFalloff(0.5, 0.5), 1);
  assert.equal(edgeFalloff(0.5, 0.0), 0);
  assert.equal(edgeFalloff(0.0, 0.5), 0);
});

test("across many seeds: both common and rare worlds appear, rare being rarer", () => {
  const counts = new Map<string, number>();
  const N = 200;
  for (let i = 0; i < N; i++) {
    const wt = pickWorldType(new Rng(`dist-${i}:worldtype`));
    counts.set(wt.name, (counts.get(wt.name) ?? 0) + 1);
  }
  let common = 0;
  let rare = 0;
  for (const [name, n] of counts) {
    if (RARE.has(name)) rare += n;
    else common += n;
  }
  assert.ok(common > rare, `common ${common} should outnumber rare ${rare}`);
  assert.ok(rare > 0, "no rare world in 200 seeds — the spice is missing");
  assert.ok(common / N > 0.6, "common worlds should be the clear majority");
  // At least a few distinct archetypes actually show up.
  assert.ok(counts.size >= 4, `only ${counts.size} archetypes in 200 seeds`);
});

test("every world is a real one: land present, never all-ocean or all-rock", () => {
  // Sweep enough seeds to hit every archetype, and assert each produces a
  // fully populated, non-degenerate world — regions, settlements, a sane land
  // fraction, and no thrown pipeline.
  const seen = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const w = generateWorld({ seed: `real-${i}`, width: 180, height: 180 });
    seen.add(w.meta.worldType);
    const land = w.meta.landFraction;
    assert.ok(
      land > 0.03 && land < 0.8,
      `${w.meta.worldType} (real-${i}): land fraction ${(land * 100).toFixed(0)}% is degenerate`,
    );
    assert.ok(w.regions.regions.length >= 1, `real-${i}: no regions`);
    assert.ok(w.settlements.settlements.length >= 1, `real-${i}: no settlements`);
    assert.ok(w.meta.worldTypeLabel.length > 0, `real-${i}: no world-type label`);
    // Every land cell still belongs to exactly one region (the partition holds
    // across oceans between continents).
    let landCells = 0;
    let labelled = 0;
    for (let c = 0; c < w.regions.ids.length; c++) {
      const isLand = w.water.oceanMask[c] === 0 && w.water.lakeMask[c] === 0;
      if (isLand) {
        landCells++;
        if (w.regions.ids[c] >= 0) labelled++;
      }
    }
    assert.equal(labelled, landCells, `real-${i}: some land is region-less`);
  }
  assert.ok(seen.size >= 5, `only ${seen.size} archetypes across 120 seeds`);
});

test("world-type metadata is exposed and self-consistent", () => {
  const w = generateWorld({ seed: "meta-world", width: 160, height: 160 });
  assert.ok(KNOWN.has(w.meta.worldType));
  assert.equal(typeof w.meta.worldTypeLabel, "string");
  assert.equal(typeof w.meta.worldTypeRare, "boolean");
  assert.ok(Array.isArray(w.meta.worldQuirks));
  assert.equal(w.meta.worldTypeRare, RARE.has(w.meta.worldType));
});

test("explicit shape overrides still bypass the archetype system", () => {
  // island:true and island:false take the legacy path — a single radial island
  // has less land than a full noise square from the same seed.
  const island = generateWorld({ seed: "same", width: 128, height: 128, island: true });
  const full = generateWorld({ seed: "same", width: 128, height: 128, island: false });
  assert.ok(island.meta.landFraction < full.meta.landFraction);
  // The legacy path reports the default archetype label (no archetype ran).
  assert.equal(island.meta.worldType, "continent");
});
