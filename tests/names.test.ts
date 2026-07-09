import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGES,
  languageById,
  makeName,
  makeNamer,
} from "../src/names.ts";
import { Rng } from "../src/rng.ts";

test("makeName is deterministic for a given rng seed", () => {
  const a = makeName(LANGUAGES[0], new Rng(123));
  const b = makeName(LANGUAGES[0], new Rng(123));
  assert.equal(a, b);
});

test("names are non-empty, capitalized, and pronounceable-ish", () => {
  for (const lang of LANGUAGES) {
    for (let i = 0; i < 50; i++) {
      const name = makeName(lang, new Rng(`${lang.id}:${i}`));
      assert.ok(name.length >= 2, `too short: "${name}"`);
      assert.match(name[0], /[A-Z]/, `not capitalized: "${name}"`);
      assert.ok(!/--/.test(name), `double dash: "${name}"`);
    }
  }
});

test("makeNamer returns stable names per key", () => {
  const namer = makeNamer(999, LANGUAGES[1]);
  assert.equal(namer("region:3"), namer("region:3"));
  assert.notEqual(namer("region:3"), namer("region:4"));
});

test("different languages produce different name distributions", () => {
  const auld = new Set<string>();
  const kesh = new Set<string>();
  for (let i = 0; i < 40; i++) {
    auld.add(makeName(languageById("auld"), new Rng(`x:${i}`)));
    kesh.add(makeName(languageById("kesh"), new Rng(`x:${i}`)));
  }
  // Same seeds, different phonologies → essentially disjoint name sets.
  let overlap = 0;
  for (const n of auld) if (kesh.has(n)) overlap++;
  assert.ok(overlap <= 2, `languages too similar, overlap ${overlap}`);
});

test("languageById falls back gracefully", () => {
  assert.equal(languageById("nope").id, LANGUAGES[0].id);
  assert.equal(languageById("kesh").id, "kesh");
});
