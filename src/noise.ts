// noise.ts — Deterministic value noise and fractal Brownian motion (fBm).
//
// Pure integer-hash lattice noise. No dependencies, no lookup-table setup,
// fully reproducible from a numeric seed. Values are returned in [0, 1).

/** Integer lattice hash → [0, 1). */
function hash2i(ix: number, iy: number, seed: number): number {
  let h = seed ^ Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Quintic smoothstep (Perlin's fade): zero 1st & 2nd derivatives at ends. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Value noise at (x, y) for a given seed. Continuous, smooth, in [0, 1). */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;

  const v00 = hash2i(x0, y0, seed);
  const v10 = hash2i(x0 + 1, y0, seed);
  const v01 = hash2i(x0, y0 + 1, seed);
  const v11 = hash2i(x0 + 1, y0 + 1, seed);

  const u = fade(xf);
  const v = fade(yf);
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}

export interface FbmOptions {
  /** Number of noise layers summed together. More = more detail. */
  octaves?: number;
  /** Base frequency multiplier. */
  frequency?: number;
  /** Frequency growth per octave (typically 2). */
  lacunarity?: number;
  /** Amplitude decay per octave (typically 0.5). */
  gain?: number;
  /** Seed for the underlying value noise. */
  seed?: number;
}

/**
 * Fractal Brownian motion: sum of octaves of value noise. Returns [0, 1).
 * Each octave uses a decorrelated seed so layers don't visibly align.
 */
export function fbm2D(x: number, y: number, opts: FbmOptions = {}): number {
  const octaves = opts.octaves ?? 5;
  const lacunarity = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  const seed = opts.seed ?? 0;
  let freq = opts.frequency ?? 1;

  let amp = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x * freq, y * freq, (seed + o * 1013904223) | 0);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ridged multifractal: sharp ridge-lines, good for mountain spines.
 * Returns [0, 1).
 */
export function ridge2D(x: number, y: number, opts: FbmOptions = {}): number {
  const octaves = opts.octaves ?? 5;
  const lacunarity = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  const seed = opts.seed ?? 0;
  let freq = opts.frequency ?? 1;

  let amp = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise2D(x * freq, y * freq, (seed + o * 1013904223) | 0);
    const r = 1 - Math.abs(2 * n - 1); // fold to a ridge
    sum += amp * r * r;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
