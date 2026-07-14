import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { lexiconOf } from "../src/language.ts";
import { languageById } from "../src/names.ts";

// L17b — founding sagas. Same laws as the chronicle: deterministic, grounded,
// downstream-only.

test("every culture present in the world gets exactly one saga", () => {
  for (const seed of ["atlas", "ct0", "borea"]) {
    const w = generateWorld({ seed, width: 200, height: 200 });
    const cultures = new Set(w.regions.regions.map((r) => r.languageId));
    assert.equal(w.sagas.length, cultures.size, seed);
    assert.deepEqual(new Set(w.sagas.map((s) => s.cultureId)), cultures, seed);
  }
});

test("sagas are deterministic to the letter", () => {
  const a = generateWorld({ seed: "atlas", width: 180, height: 180 });
  const b = generateWorld({ seed: "atlas", width: 180, height: 180 });
  assert.deepEqual(a.sagas, b.sagas);
});

test("a saga is grounded: heartland, taught roots, and realm fate are real", () => {
  const w = generateWorld({ seed: "atlas", width: 200, height: 200 });
  for (const saga of w.sagas) {
    const text = saga.lines.join("\n");
    // The heartland (largest region of the culture) is named in the verse.
    const heartland = w.regions.regions
      .filter((r) => r.languageId === saga.cultureId)
      .sort((a, b) => b.area - a.area)[0];
    assert.ok(text.includes(heartland.name), `${saga.cultureId}: heartland missing`);
    // The word-lore stanza teaches REAL roots of that language.
    const lex = lexiconOf(languageById(saga.cultureId));
    const m = text.match(/In their tongue, (\S+) is (\S+) and (\S+) is (\S+);/);
    assert.ok(m, `${saga.cultureId}: no word-lore stanza`);
    assert.equal(lex.roots[m![2]], m![1], "first taught root is wrong");
    assert.equal(lex.roots[m![4]], m![3], "second taught root is wrong");
    // No template leakage.
    for (const leak of ["undefined", "${", "[object", "NaN"]) {
      assert.ok(!text.includes(leak), `${saga.cultureId}: leaked ${leak}`);
    }
  }
});

test("a saga keeps the pre-conquest name of its elder city", () => {
  // Find a world where a culture's elder city was renamed by language contact;
  // its saga must use the ORIGINAL name and note the new one parenthetically.
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    const w = generateWorld({ seed: `ct${i}`, width: 240, height: 240 });
    for (const saga of w.sagas) {
      const regionIds = new Set(
        w.regions.regions.filter((r) => r.languageId === saga.cultureId).map((r) => r.id),
      );
      const elder = w.settlements.settlements
        .filter((s) => regionIds.has(s.regionId))
        .sort((a, b) => a.id - b.id)[0];
      if (!elder?.formerNames?.length) continue;
      found = true;
      const text = saga.lines.join("\n");
      assert.ok(
        text.includes(elder.formerNames[0].name),
        `saga does not keep the old name ${elder.formerNames[0].name}`,
      );
      assert.ok(
        text.includes(`The maps write it ${elder.name} now. The saga does not.`),
        "saga does not resent the new name",
      );
    }
  }
  assert.ok(found, "no seed produced a renamed elder city — widen the search");
});

test("sagas never perturb the world: fingerprints are byte-identical", () => {
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "86c5fef61d7a567b");
  assert.equal(w.meta.exactHash, "418ddfd224e6f31c");
  assert.equal(w.meta.simulationHash, "146934d0ec2014cd");
});
