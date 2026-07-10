import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  cosQuarterTurn,
  dist,
  dist2,
  isExactExponent,
  powExact,
} from "../src/exact.ts";

// ECMAScript pins `+ - * /` and Math.sqrt to exact IEEE-754 results, and leaves
// Math.hypot/pow/cos/exp/log and `**` implementation-approximated. World
// generation is chaotic in the last bit, so the engine may only use the former.
// See DECISIONS D-022.

test("dist and dist2 agree with the geometry they replace", () => {
  assert.equal(dist(3, 4), 5);
  assert.equal(dist(0, 0), 0);
  assert.equal(dist2(3, 4), 25);
  for (const [dx, dy] of [[1, 2], [-7, 3], [0.25, 0.5], [1e-5, 2e-5]]) {
    assert.ok(Math.abs(dist(dx, dy) - Math.hypot(dx, dy)) < 1e-12 * (dist(dx, dy) + 1));
  }
});

test("isExactExponent accepts quarter-multiples and nothing else", () => {
  for (const k of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3.75]) {
    assert.ok(isExactExponent(k), `${k} should be exact`);
  }
  for (const k of [1.05, 1.2, 1.6, 1.7, 0.1, -1, NaN, Infinity]) {
    assert.ok(!isExactExponent(k), `${k} should be rejected`);
  }
});

test("powExact matches Math.pow to within a few ulp on supported exponents", () => {
  let worst = 0;
  for (const k of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]) {
    for (let i = 0; i <= 400; i++) {
      const x = i / 400;
      const a = powExact(x, k);
      const b = Math.pow(x, k);
      const rel = b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b);
      if (rel > worst) worst = rel;
    }
  }
  assert.ok(worst < 1e-13, `worst relative error ${worst.toExponential(3)}`);
  assert.equal(powExact(7, 0), 1);
  assert.equal(powExact(0, 2), 0);
  assert.equal(powExact(9, 0.5), 3);
  assert.equal(powExact(3, 2), 9);
});

test("powExact refuses an exponent it cannot compute exactly", () => {
  // Silently falling back to Math.pow would reintroduce the very bug this
  // module exists to prevent.
  for (const k of [1.6, 1.7, 1.05, 1.2]) {
    assert.throws(() => powExact(2, k), /not a non-negative multiple/);
  }
});

test("cosQuarterTurn matches Math.cos over [0,1] and never goes negative", () => {
  let worst = 0;
  for (let i = 0; i <= 20000; i++) {
    const t = i / 20000;
    const c = cosQuarterTurn(t);
    assert.ok(c >= 0, `cosQuarterTurn(${t}) = ${c} is negative`);
    worst = Math.max(worst, Math.abs(c - Math.cos((t * Math.PI) / 2)));
  }
  assert.ok(worst < 1e-7, `max error ${worst.toExponential(3)}`);
  assert.equal(cosQuarterTurn(0), 1);
  assert.equal(cosQuarterTurn(1), 0);
});

test("the engine uses no implementation-approximated math", () => {
  // This is the test that keeps the fix from rotting. `render.ts` is exempt:
  // pixels are not world state. `exact.ts` is exempt: it *is* the replacement,
  // and its doc comments name the functions it replaces.
  const EXEMPT = new Set(["render.ts", "exact.ts"]);
  const BANNED = /Math\.(hypot|pow|cos|sin|tan|exp|log|log1p|log2|log10|atan|atan2|cbrt)\s*\(/;
  // The `**` operator uses the same implementation-approximated abstract
  // operation as Math.pow. Match it as an operator (a value to its left),
  // never as Markdown bold or a `/** */` comment.
  const BANNED_EXP = /[\w)\]]\s\*\*\s/;

  const offenders: string[] = [];
  for (const file of readdirSync("src").filter((f) => f.endsWith(".ts"))) {
    if (EXEMPT.has(file)) continue;
    const lines = readFileSync(join("src", file), "utf8").split("\n");
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (/^\s*\*/.test(code)) return; // inside a block comment
      if (BANNED.test(code) || BANNED_EXP.test(code)) {
        offenders.push(`src/${file}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `implementation-approximated math in the engine (see D-022):\n${offenders.join("\n")}`,
  );
});

test("the guard would actually catch a violation", () => {
  // A test that can never fail is not a test. Prove the patterns bite.
  const BANNED = /Math\.(hypot|pow|cos|sin|tan|exp|log|log1p|log2|log10|atan|atan2|cbrt)\s*\(/;
  const BANNED_EXP = /[\w)\]]\s\*\*\s/;
  assert.ok(BANNED.test("const d = Math.hypot(a, b);"));
  assert.ok(BANNED.test("Math.pow(x, 2)"));
  assert.ok(BANNED_EXP.test("const d = (a - b) ** 2;"));
  assert.ok(BANNED_EXP.test("x ** 2"));
  // …and does not bite on things that are fine.
  assert.ok(!BANNED.test("Math.sqrt(a * a + b * b)"));
  assert.ok(!BANNED_EXP.test("**bold markdown**"));
  assert.ok(!BANNED_EXP.test("/** a doc comment */"));
});
