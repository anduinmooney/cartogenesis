import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateReligion } from "../src/religion.ts";

function build(seed: string, size = 200) {
  const w = generateWorld({ seed, width: size, height: size });
  const rel = generateReligion(w.regions, w.history, { seed: 4 });
  return { w, rel };
}

test("religion is deterministic", () => {
  const a = build("faith", 180);
  const b = build("faith", 180);
  assert.deepEqual(
    a.rel.faiths.map((f) => [f.name, f.deity.domain, f.myth]),
    b.rel.faiths.map((f) => [f.name, f.deity.domain, f.myth]),
  );
  assert.deepEqual(a.rel.regionFaith, b.rel.regionFaith);
});

test("each faith is named, has a deity + domain, and a non-trivial myth", () => {
  const { rel } = build("myths", 220);
  assert.ok(rel.faiths.length >= 1);
  for (const f of rel.faiths) {
    assert.ok(f.name.length > 3);
    assert.ok(f.deity.name.length > 1);
    assert.ok(f.deity.domain.length > 1);
    assert.ok(f.myth.length > 20);
  }
});

test("every region is assigned a valid faith", () => {
  const { w, rel } = build("spread", 200);
  const faithIds = new Set(rel.faiths.map((f) => f.id));
  for (const r of w.regions.regions) {
    assert.ok(r.id in rel.regionFaith, `region ${r.id} has no faith`);
    assert.ok(faithIds.has(rel.regionFaith[r.id]), "faith id invalid");
  }
});

test("origin backfill terminates (regression: infinite-loop guard)", () => {
  // This seed+size once spun forever in the faith-origin backfill when the
  // index was derived from origins.length. Must complete quickly.
  const w = generateWorld({ seed: "cartogenesis", width: 360, height: 360 });
  const rel = generateReligion(w.regions, w.history, { seed: 4 });
  assert.ok(rel.faiths.length >= 1);
  for (const r of w.regions.regions) assert.ok(r.id in rel.regionFaith);
});

test("follower regions partition the map among faiths", () => {
  const { w, rel } = build("followers", 200);
  const total = rel.faiths.reduce((s, f) => s + f.followerRegions.length, 0);
  assert.equal(total, w.regions.regions.length);
});
