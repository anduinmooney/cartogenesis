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
import { generateSimulation, settlementsAt } from "../src/simulation.ts";

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

test("snapshots record every turn plus the initial state; last equals final", () => {
  const { sim } = build("scrub", 200);
  assert.equal(sim.snapshots.length, sim.turns + 1, "expected turns+1 snapshots");
  assert.equal(sim.snapshots[0].year, sim.startYear);
  assert.equal(sim.snapshots[sim.snapshots.length - 1].year, sim.endYear);
  // Years are strictly increasing.
  for (let i = 1; i < sim.snapshots.length; i++) {
    assert.ok(sim.snapshots[i].year > sim.snapshots[i - 1].year);
  }
  // The final snapshot matches finalControl exactly.
  assert.deepEqual(sim.snapshots[sim.snapshots.length - 1].control, sim.finalControl);
  // Borders actually change across the run (the whole point).
  const first = JSON.stringify(sim.snapshots[0].control);
  const last = JSON.stringify(sim.snapshots[sim.snapshots.length - 1].control);
  assert.notEqual(first, last, "borders never changed");
});

/**
 * Regression guard: the simulation once produced a single hegemon on virtually
 * every world (mean top-power share ~94%, 75% of worlds >90% unified), which
 * made every history read the same. Outcomes must stay varied — some worlds
 * unify, many end divided among rival powers.
 *
 * Measured at 256², not 160²: since the islets merge (Session 24), tiny
 * island regions no longer survive as unconquerable microstates, and a 160²
 * world has only ~4 mainland regions — too few for a share-of-regions metric
 * to mean anything (one won war reads as "100% unified"). At 256² (~12
 * regions) the metric is representative: 30-seed mean ~55%, sd ~17.
 */
test("histories vary: not every world collapses into one power", () => {
  const seeds = ["alpha", "gamma", "juno", "orion", "pyxis", "rhea", "sirius", "vahalia"];
  const shares: number[] = [];
  for (const seed of seeds) {
    const w = generateWorld({ seed, width: 256, height: 256 });
    const total = w.regions.regions.length;
    const counts = new Map<number, number>();
    for (const rid of Object.keys(w.simulation.finalControl)) {
      const realm = w.simulation.finalControl[Number(rid)];
      counts.set(realm, (counts.get(realm) ?? 0) + 1);
    }
    shares.push(Math.max(...counts.values()) / total);
  }
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;

  assert.ok(
    shares.some((s) => s < 0.9),
    "every world unified under one power — the snowball is back",
  );
  assert.ok(
    mean < 0.85,
    `mean top-power share ${(mean * 100).toFixed(0)}% is too concentrated`,
  );
  // And the reverse failure: conquest must still be possible somewhere.
  assert.ok(
    shares.some((s) => s > 0.6),
    "no world produced a dominant power — wars are too hard to win",
  );
});

test("settlement timeline: every town has a sane founding, ruins fall after it", () => {
  const { w, sim } = build("towns", 200);
  const tl = sim.settlementTimeline;
  assert.equal(tl.length, w.settlements.settlements.length, "one entry per settlement");

  for (const t of tl) {
    assert.ok(
      t.foundedYear >= sim.startYear && t.foundedYear <= sim.endYear,
      `${t.name} founded outside the span`,
    );
    if (t.fellYear !== undefined) {
      assert.ok(t.fellYear > t.foundedYear, `${t.name} fell before it was founded`);
      assert.ok(t.fellYear <= sim.endYear, `${t.name} fell after the present`);
      assert.ok(["sacked", "abandoned"].includes(t.fate!), "ruin needs a fate");
    }
  }

  // The capital always stands — the present-day metadata names it.
  const capital = tl.find((t) => t.isCapital);
  assert.ok(capital, "expected a capital in the timeline");
  assert.equal(capital!.fellYear, undefined, "the capital must survive");

  // Cities grow in over time, and the present day is exactly the survivors.
  const atStart = settlementsAt(tl, sim.startYear).length;
  const atEnd = settlementsAt(tl, sim.endYear).length;
  const survivors = tl.filter((t) => t.fellYear === undefined).length;
  assert.ok(atStart < atEnd, "no settlements were founded over time");
  assert.equal(atEnd, survivors, "present day should equal the survivors");
});

test("no settlement is destroyed in the same year it is founded", () => {
  // Checked across several worlds: a single seed once hid a town that was
  // founded and stormed in the very same year.
  for (const seed of ["vahalia", "gamma", "alpha", "sirius", "pyxis", "orion"]) {
    const w = generateWorld({ seed, width: 200, height: 200 });
    for (const t of w.simulation.settlementTimeline) {
      if (t.fellYear !== undefined) {
        assert.ok(
          t.fellYear > t.foundedYear,
          `${seed}: ${t.name} founded ${t.foundedYear}, fell ${t.fellYear}`,
        );
      }
    }
  }
});

test("settlement timeline is deterministic", () => {
  const a = build("ruins", 180).sim.settlementTimeline;
  const b = build("ruins", 180).sim.settlementTimeline;
  assert.deepEqual(
    a.map((t) => [t.id, t.foundedYear, t.fellYear ?? -1, t.fate ?? ""]),
    b.map((t) => [t.id, t.foundedYear, t.fellYear ?? -1, t.fate ?? ""]),
  );
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

test("history happens year by year, not in 25-year blocks (D-028)", () => {
  const w = generateWorld({ seed: "annum", width: 160, height: 160 });
  const years = w.simulation.events.map((e) => e.year);
  assert.ok(years.length > 5, "world too quiet to test");
  for (let i = 1; i < years.length; i++) {
    assert.ok(years[i] >= years[i - 1], "events out of order");
  }
  const onTurn = years.filter((y) => y % 25 === 0).length;
  assert.ok(
    onTurn / years.length < 0.2,
    `${onTurn}/${years.length} events land on round 25-year marks — the ledger is back`,
  );
  const distinct = new Set(years).size;
  assert.ok(
    distinct / years.length > 0.5,
    `only ${distinct} distinct years across ${years.length} events`,
  );
  // The finer dating must stay consistent with the world it dates.
  for (const t of w.simulation.settlementTimeline) {
    if (t.fellYear !== undefined) {
      assert.ok(t.fellYear > t.foundedYear, `${t.name} fell before it was founded`);
      assert.ok(t.fellYear <= w.simulation.endYear);
    }
  }
});

test("realm names are unique for the whole span — no realm ever conquers 'itself' (S27)", () => {
  // Two realms named Mantebinte once made the chronicle read "Deosena was
  // taken from Tariademor ... by Tariademor". Checked across seeds.
  for (const seed of ["emberwild", "saltmarsh", "kettlebrook", "atlas"]) {
    const w = generateWorld({ seed, width: 200, height: 200 });
    const names = w.simulation.realms.map((r) => r.name);
    assert.equal(new Set(names).size, names.length, `${seed}: duplicate realm names`);
    const hist = w.history.realms.map((r) => r.name);
    assert.equal(new Set(hist).size, hist.length, `${seed}: duplicate written-history realms`);
    for (const e of w.simulation.events) {
      if (e.actors?.subject && e.actors?.object) {
        assert.notEqual(
          e.actors.subject,
          e.actors.object,
          `${seed}: "${e.text}" — a realm acting against itself`,
        );
      }
    }
  }
});

test("foundings are not a metronome: the gaps between them vary (S27, D-029)", () => {
  const w = generateWorld({ seed: "emberwild", width: 200, height: 200 });
  const years = w.simulation.settlementTimeline
    .map((t) => t.foundedYear)
    .sort((a, b) => a - b);
  const gaps = new Set<number>();
  for (let i = 1; i < years.length; i++) gaps.add(years[i] - years[i - 1]);
  assert.ok(
    gaps.size >= 4,
    `only ${gaps.size} distinct founding gaps — the metronome is back`,
  );
  assert.equal(years[0], w.simulation.startYear, "the capital opens the span");
});
