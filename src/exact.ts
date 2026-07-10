// exact.ts — Arithmetic that every conforming engine computes identically.
//
// ECMAScript pins `+ - * /` and `Math.sqrt` to exact IEEE-754 results: given the
// same inputs, every implementation must return the same bits. It explicitly
// does NOT pin `Math.hypot`, `Math.pow`, `**`, `Math.cos`, `Math.log`, or
// `Math.exp` — those are "implementation-approximated", free to differ in the
// last bit between engines, versions, and platforms.
//
// That mattered here because world generation is *chaotic in the last bit*: a
// single-ulp difference in one erosion droplet changes an elevation, which
// changes a settlement, which changes a war, which changes which cities are
// ruins a thousand years later. Measured (D-022): replacing `Math.hypot(x, y)`
// with the mathematically identical `Math.sqrt(x*x + y*y)` — they disagree in
// the final ulp on 926k of 2.1M calls — moved ruin counts across five seeds from
// 2,2,3,2,2 to 1,0,1,0,0.
//
// So the engine computes everything from `+ - * / sqrt`. These functions are not
// more *accurate* than the built-ins — `powExact` accumulates rounding that
// `Math.pow` avoids. They are more *reproducible*, which is the promise the
// project actually makes. Rendering may still use the built-ins: pixels are not
// world state.

/**
 * Euclidean distance. `Math.hypot` is more accurate (it avoids intermediate
 * overflow and is correctly rounded) but is implementation-approximated; this
 * is exact-by-construction and identical everywhere.
 */
export function dist(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance — no sqrt, so exact and cheap. Prefer it for comparisons. */
export function dist2(dx: number, dy: number): number {
  return dx * dx + dy * dy;
}

/** The smallest exponent step `powExact` supports. */
export const POW_STEP = 0.25;

/** True if `powExact` can compute `x ** k` exactly-reproducibly. */
export function isExactExponent(k: number): boolean {
  return Number.isFinite(k) && k >= 0 && Number.isInteger(k * 4);
}

/**
 * `x ** k` for k a non-negative multiple of 1/4, using only exact operations.
 *
 * x^(n/4) = (x^(1/4))^n, and x^(1/4) = sqrt(sqrt(x)) — two exact square roots.
 * The integer power then comes from binary exponentiation, i.e. multiplication.
 * Rounding still happens at each step, but it happens *the same way everywhere*,
 * which is the whole point.
 *
 * Throws on an unsupported exponent rather than silently falling back to
 * `Math.pow` — a silent fallback would reintroduce the bug it exists to prevent.
 */
export function powExact(x: number, k: number): number {
  if (!isExactExponent(k)) {
    throw new RangeError(
      `powExact: exponent ${k} is not a non-negative multiple of ${POW_STEP}. ` +
        `Snap it, or the world stops being reproducible (see DECISIONS D-022).`,
    );
  }
  if (k === 0) return 1;
  if (x === 0) return 0;

  const quarters = k * 4; // a non-negative integer
  // Base = x^(1/4). Only take roots we actually need: a whole exponent skips them.
  let base: number;
  let n: number;
  if (quarters % 4 === 0) {
    base = x;
    n = quarters / 4;
  } else if (quarters % 2 === 0) {
    base = Math.sqrt(x);
    n = quarters / 2;
  } else {
    base = Math.sqrt(Math.sqrt(x));
    n = quarters;
  }

  // Binary exponentiation: multiplication only.
  let result = 1;
  let b = base;
  let e = n;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

// --- Trigonometry -----------------------------------------------------------

/**
 * cos(t · π/2) for t in [0, 1] — the "quarter turn" cosine the climate model
 * needs to fall from 1 at the equator to 0 at the pole.
 *
 * A Taylor series in x = t·π/2, evaluated by Horner in x². Max |x| is π/2, where
 * the x^18 term is ~5e-13, so truncating there costs about a picounit — far
 * below anything the climate cares about, and unlike `Math.cos` it is the same
 * picounit on every engine. `Math.PI` is a constant, not a computation, so it is
 * exactly reproducible.
 */
export function cosQuarterTurn(t: number): number {
  const x = t * (Math.PI / 2);
  const x2 = x * x;
  // cos x = Σ (-1)^n x^(2n) / (2n)!, to n = 9.
  const c =
    1 -
    x2 *
      (1 / 2 -
        x2 *
          (1 / 24 -
            x2 *
              (1 / 720 -
                x2 *
                  (1 / 40320 -
                    x2 *
                      (1 / 3628800 -
                        x2 *
                          (1 / 479001600 -
                            x2 *
                              (1 / 87178291200 -
                                x2 *
                                  (1 / 20922789888000 -
                                    x2 * (1 / 6402373705728000)))))))));
  // On [0, 1] the true cosine is never negative; truncation error undershoots to
  // about -3e-15 at t = 1. Clamp, so a "warmth" can never come out below zero.
  return c < 0 ? 0 : c;
}
