// rng.ts — Deterministic, portable pseudo-random number generation.
//
// Design goals:
//   1. Identical output across machines, OSes, and Node versions (uses only
//      integer ops that behave identically under IEEE-754 / asm-safe imul).
//   2. Named, independent sub-streams. A subsystem asks the world for its own
//      stream by name (e.g. "terrain", "rivers"). Streams are keyed only by
//      (worldSeed, name), so ADDING a new subsystem never perturbs the output
//      of existing ones. This is the backbone of reproducible, compounding
//      world generation across many development sessions.
//
// The generator itself is mulberry32: small, fast, and good enough for
// procedural content (it is NOT cryptographically secure — never use for that).

/**
 * cyrb-style string hash → unsigned 32-bit integer.
 * Deterministic and stable across platforms. `salt` lets us derive many
 * independent seeds from one base (used for named sub-streams).
 */
export function hashString(str: string, salt = 0): number {
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

/** Coerce any seed (number or string) into a canonical unsigned 32-bit seed. */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === "string") return hashString(seed);
  // Fold floats/negatives into a stable 32-bit space.
  return Math.abs(Math.floor(seed)) >>> 0 || hashString(String(seed));
}

/**
 * A deterministic random stream. Construct from a seed, then either draw
 * values or `fork`/`stream` off independent child streams.
 */
export class Rng {
  /** The 32-bit seed this stream was created from (stable, inspectable). */
  readonly seed: number;
  private state: number;

  constructor(seed: number | string) {
    this.seed = normalizeSeed(seed);
    this.state = this.seed;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max) (max exclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max));
  }

  /** True with probability p (default 0.5). */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Uniformly pick one element. Throws on empty arrays. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick: empty array");
    return arr[this.int(0, arr.length)];
  }

  /** Deterministic in-place Fisher–Yates shuffle. Returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Approximate standard-normal via sum of uniforms (Irwin–Hall, n=6).
   * Mean 0, stddev ~1. Cheap and deterministic.
   */
  gaussian(mean = 0, stddev = 1): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return mean + (s - 3) * (stddev / Math.sqrt(0.5));
  }

  /**
   * Derive an independent named sub-stream. Keyed only by (this.seed, name),
   * NOT by how many values this stream has already drawn — so subsystems are
   * order-independent and adding new ones is non-perturbing.
   */
  stream(name: string): Rng {
    return new Rng(hashString(name, this.seed));
  }
}
