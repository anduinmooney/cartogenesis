// hash.ts — Pure-JS content hashes (no node:crypto), so the engine is universal
// and runs identically in Node and the browser. Each folds its input through two
// decorrelated 32-bit accumulators (cyrb-style) into 16 hex chars. These are
// fingerprints, not signatures — not cryptographic.
//
// `hashExact` is the determinism guard. `hashQuantized` deliberately rounds, so
// it is only useful for "did the terrain change *visibly*" — never for proving
// reproducibility. See DECISIONS D-022 for how that distinction bit us.

/**
 * Hash the exact bits of a float field. Unlike `hashQuantized`, this notices a
 * single-ulp change anywhere — which is precisely what we need, because world
 * generation is chaotic in the last bit, and a quantized hash rounds the failure
 * away. A guard that cannot see the bug is not a guard.
 */
export function hashExact(data              )         {
  const words = new Uint32Array(data.buffer, data.byteOffset, data.length * 2);
  let h1 = 0x1b873593 | 0;
  let h2 = 0xcc9e2d51 | 0;
  for (let i = 0; i < words.length; i++) {
    const v = words[i];
    h1 = Math.imul(h1 ^ v, 2654435761);
    h2 = Math.imul(h2 ^ v, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 11) | (h2 >>> 21);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/**
 * Hash a token list — for fingerprinting structured output such as the
 * simulation's realm years, sizes, and fates. This is what actually drifted
 * across V8 builds, so guard it directly rather than inferring it from terrain.
 */
export function hashTokens(tokens                                )         {
  let h1 = 0x2545f491 | 0;
  let h2 = 0x9e3779b9 | 0;
  const s = tokens.join("");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 11) | (h2 >>> 21);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Quantizing hash — rounds to 16 bits. NOT a determinism guard (see above). */
export function hashQuantized(data                   )         {
  let h1 = 0x9e3779b1 | 0;
  let h2 = 0x85ebca77 | 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.round(data[i] * 65535) & 0xffff;
    h1 = Math.imul(h1 ^ v, 2654435761);
    h2 = Math.imul(h2 ^ v, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 11) | (h2 >>> 21);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909) >>> 0;
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  );
}
