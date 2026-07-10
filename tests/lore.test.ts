import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateLore } from "../src/lore.ts";

function build(seed: string, size = 180) {
  const w = generateWorld({ seed, width: size, height: size });
  const lore = generateLore(w.regions, w.settlements.settlements, w.history, {
    seed: 5,
    presentYear: w.meta.presentYear,
  });
  return { w, lore };
}

test("lore is deterministic", () => {
  const a = build("saga", 160);
  const b = build("saga", 160);
  assert.deepEqual(
    a.lore.rulers.map((r) => r.name),
    b.lore.rulers.map((r) => r.name),
  );
  assert.deepEqual(a.lore.regionDescriptions, b.lore.regionDescriptions);
  assert.deepEqual(
    a.lore.figures.map((f) => f.description),
    b.lore.figures.map((f) => f.description),
  );
});

test("every realm has a ruling house and at least one ruler", () => {
  const { w, lore } = build("houses", 200);
  for (const realm of w.history.realms) {
    assert.ok(
      lore.houses.some((h) => h.realmId === realm.id),
      `realm ${realm.id} has no house`,
    );
    assert.ok(
      lore.rulers.some((r) => r.realmId === realm.id),
      `realm ${realm.id} has no ruler`,
    );
  }
});

test("ruler reigns are chronological and within the realm's lifespan", () => {
  const { w, lore } = build("reigns", 200);
  const present = w.meta.presentYear;
  for (const realm of w.history.realms) {
    const line = lore.rulers
      .filter((r) => r.realmId === realm.id)
      .sort((a, b) => a.startYear - b.startYear);
    let prevEnd = -Infinity;
    for (const r of line) {
      assert.ok(r.startYear >= realm.foundedYear, "ruler predates realm");
      assert.ok(r.endYear <= present, "ruler outlives the present");
      assert.ok(r.endYear >= r.startYear, "reign ends before it starts");
      assert.ok(r.startYear > prevEnd, "reigns overlap");
      prevEnd = r.endYear;
    }
  }
});

/**
 * Regression guard: ruler successions used to stop after 9 rulers (~250 years),
 * so every dynasty ended centuries before the present and the world had no
 * living monarchs. They must reign right up to the present year.
 */
test("every dynasty reigns to the present, with exactly one reigning monarch", () => {
  const { w, lore } = build("succession", 200);
  const present = w.meta.presentYear;
  assert.ok(present > 1000, `present year ${present} looks wrong`);

  for (const realm of w.history.realms) {
    const line = lore.rulers
      .filter((r) => r.realmId === realm.id)
      .sort((a, b) => a.startYear - b.startYear);
    assert.ok(line.length > 0, `${realm.name} has no rulers`);

    const last = line[line.length - 1];
    assert.equal(last.endYear, present, `${realm.name}'s line ends at ${last.endYear}`);

    const reigning = line.filter((r) => r.reigning);
    assert.equal(reigning.length, 1, `${realm.name} has ${reigning.length} reigning rulers`);
    assert.equal(reigning[0].name, last.name);

    // No gaps: each reign begins the year after the last ended.
    for (let i = 1; i < line.length; i++) {
      assert.equal(
        line[i].startYear,
        line[i - 1].endYear + 1,
        `gap in ${realm.name}'s succession`,
      );
    }
  }
});

test("the world runs on one timeline: meta.presentYear === simulation.endYear", () => {
  const w = generateWorld({ seed: "timeline", width: 180, height: 180 });
  assert.equal(w.meta.presentYear, w.simulation.endYear);
  // And the chronicle's last event falls within it.
  const last = w.simulation.events.at(-1);
  if (last) assert.ok(last.year <= w.meta.presentYear);
});

test("every region gets a non-empty description naming itself", () => {
  const { w, lore } = build("prose", 200);
  for (const region of w.regions.regions) {
    const d = lore.regionDescriptions[region.id];
    assert.ok(d && d.length > 10, `region ${region.id} has no description`);
    assert.ok(d.includes(region.name), "description omits the region name");
  }
});

test("figures are named, described, and reference the world", () => {
  const { lore } = build("figures", 220);
  assert.ok(lore.figures.length >= 1, "expected some figures");
  for (const f of lore.figures) {
    assert.ok(f.name.length > 2);
    assert.ok(f.description.length > 15);
  }
});

test("capital house is populated", () => {
  const { lore } = build("crown", 200);
  assert.ok(lore.capitalHouse.length >= 2);
  assert.notEqual(lore.capitalHouse, "—");
});
