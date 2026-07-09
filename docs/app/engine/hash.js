// hash.ts — A pure-JS content hash (no node:crypto), so the engine is universal
// and runs identically in Node and the browser.
//
// It hashes a scalar field by quantizing each value to 16 bits (robust against
// ULP-level float drift) and folding it through two decorrelated 32-bit
// accumulators (cyrb-style). The 16-hex-char output is the world's determinism
// fingerprint. Not cryptographic — a fingerprint, not a signature.

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
