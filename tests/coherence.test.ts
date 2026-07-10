import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateRoads } from "../src/roads.ts";
import { generateEconomy } from "../src/economy.ts";
import { ruinedSettlementIds } from "../src/simulation.ts";

// The world the simulation ran on had every settlement standing. The world we
// draw and describe does not. These tests guard the seam between the two.

const SIZE = 260;
const SEEDS = ["s0", "s1", "s3", "s5", "s10", "s13", "s14", "s15"];

// Which seeds produce ruins is NOT stable across V8 versions: the simulation is
// chaotic with respect to last-bit float noise, and Math.hypot/pow/cos are
// "implementation-approximated" by the spec (see D-022). So never hard-code
// "seed X has ruins" — discover one at run time, and fail loudly if none does.
function firstWorldWithRuins(seeds: string[] = SEEDS) {
  for (const seed of seeds) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size > 0) return { seed, w, ruined };
  }
  throw new Error(`no seed of [${seeds.join(", ")}] produced any ruins`);
}

function firstWorldWithoutRuins(seeds: string[] = SEEDS) {
  for (const seed of seeds) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    if (ruinedSettlementIds(w.simulation.settlementTimeline).size === 0) return { seed, w };
  }
  throw new Error(`every seed of [${seeds.join(", ")}] produced ruins`);
}

test("the present-day economy never trades with a ruin", () => {
  let sawRuins = false;
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size) sawRuins = true;
    for (const e of w.economy.economies) {
      assert.ok(
        !ruined.has(e.settlementId),
        `${seed}: economy lists settlement ${e.settlementId}, which is a ruin`,
      );
    }
    const standing = w.settlements.settlements.filter((s) => !ruined.has(s.id));
    assert.equal(
      w.economy.economies.length,
      standing.length,
      `${seed}: economy should cover exactly the standing settlements`,
    );
  }
  assert.ok(sawRuins, "test is vacuous — no seed produced any ruins");
});

test("no trade hub is a dead city", () => {
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    const standingIds = new Set(
      w.settlements.settlements.filter((s) => !ruined.has(s.id)).map((s) => s.id),
    );
    for (const e of w.economy.economies) {
      if (!e.isTradeHub) continue;
      assert.ok(standingIds.has(e.settlementId), `${seed}: hub ${e.settlementId} is ruined`);
    }
  }
});

test("roads are rebuilt on the survivors, not on the founding-age towns", () => {
  // For EVERY ruin-producing world, the present-day network must equal the one
  // you get from the survivors — never the all-towns network. That equality is
  // the real invariant and holds always. (Removing a town does not always
  // *change* the total length — a ruined leaf can leave it unchanged — so we
  // assert equality-with-survivors here, and prove ruins can change the network
  // separately below.)
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size === 0) continue;
    const standing = w.settlements.settlements.filter((s) => !ruined.has(s.id));
    const rebuilt = generateRoads(w.elevation, w.water, w.rivers, standing, {});
    assert.equal(w.roads.length, rebuilt.length, `${seed}: roads not on survivors`);
  }
});

test("ruins actually change the road network (not merely the town list)", () => {
  // Somewhere among the seeds, removing the ruined towns must change the total
  // road length — otherwise the two-pass rebuild would be unobservable.
  const differs = SEEDS.some((seed) => {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size === 0) return false;
    const naive = generateRoads(
      w.elevation,
      w.water,
      w.rivers,
      w.settlements.settlements,
      {},
    );
    return w.roads.length !== naive.length;
  });
  assert.ok(differs, "no seed had a ruin that changed the road network");
});

test("a world without ruins keeps its original roads and economy", () => {
  // The two-pass rebuild must be a no-op when nothing fell — otherwise it is a
  // silent source of drift.
  const { seed, w } = firstWorldWithoutRuins();
  const roads = generateRoads(
    w.elevation,
    w.water,
    w.rivers,
    w.settlements.settlements,
    {},
  );
  assert.equal(w.roads.length, roads.length, `${seed}: roads drifted`);
  assert.equal(
    w.economy.economies.length,
    w.settlements.settlements.length,
    `${seed}: economy drifted`,
  );
});

test("the gazetteer's exports come from towns that still stand", () => {
  const { w, ruined } = firstWorldWithRuins();
  // meta.majorExports is derived from the present-day economy.
  assert.ok(w.meta.majorExports.length > 0);
  const rebuilt = generateEconomy(
    w.settlements.settlements.filter((s) => !ruined.has(s.id)),
    w.roads,
    w.resources,
    { seed: 0 },
  );
  assert.equal(rebuilt.economies.length, w.economy.economies.length);
});
