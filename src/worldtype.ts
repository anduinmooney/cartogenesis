// worldtype.ts — L0.5: what KIND of world this is.
//
// Every world used to be one radial blob in the middle of the map — a lone
// island, however the gazetteer dressed it up. A real atlas holds more than
// that: lone continents, twin continents split by a strait, archipelagos,
// a supercontinent, a drowned world of scattered isles, a ring of land around
// an inland sea. This layer chooses one such ARCHETYPE per seed and hands the
// terrain generator a mask that shapes where land may rise.
//
// It decides SHAPE, not amount: how much land a world has is set downstream by
// choosing the sea level at the quantile that yields the archetype's target
// land fraction, so no world ever comes out all ocean or all rock. Common
// types are common and rare types are rare, and a few small quirks (a land
// bridge, a great rift, a lone subcontinent, a polar reach) occur now and then
// on top.
//
// Determinism: drawn from a named stream (order-independent, D-003). Exact
// arithmetic only (D-022) — the mask is built from squared distances and
// polynomials, never trig or pow.

import { Rng } from "./rng.ts";

/** A centre of land: a bump the mask raises the terrain toward. */
export interface LandCentre {
  cx: number; // 0..1
  cy: number; // 0..1
  r: number; // radius, 0..1
  /** 1 = gentle broad falloff, 2 = sharper edge (steeper coasts). */
  k: number;
  /** Peak mask height, 0..1. */
  strength: number;
}

/** A thin low corridor cut through the mask — a strait or a rift valley. */
export interface Rift {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  halfWidth: number;
}

export interface WorldType {
  /** Slug: "continent", "twin", "archipelago", … */
  name: string;
  /** Human-facing: "a lone continent", "twin continents", … */
  label: string;
  /** True for the uncommon archetypes. */
  rare: boolean;
  centres: LandCentre[];
  /** A central sea the mask is hollowed toward (ring worlds). */
  hollow?: { cx: number; cy: number; r: number };
  rifts: Rift[];
  /** Base noise frequency — higher makes smaller, more broken land. */
  frequency: number;
  /** Fraction of the map that should end up as land (sea level derives from it). */
  targetLand: number;
  /** Small rare occurrences that happened, named for the gazetteer. */
  quirks: string[];
}

/** Weighted archetype table. Common types dominate; rare ones are the spice. */
const ARCHETYPES: Array<{ name: string; label: string; weight: number; rare: boolean }> = [
  { name: "continent", label: "a lone continent", weight: 30, rare: false },
  { name: "twin", label: "twin continents", weight: 17, rare: false },
  { name: "isles", label: "a continent and its isles", weight: 17, rare: false },
  { name: "archipelago", label: "an archipelago", weight: 16, rare: false },
  { name: "pangaea", label: "a single supercontinent", weight: 5, rare: true },
  { name: "oceanic", label: "a drowned world of scattered isles", weight: 5, rare: true },
  { name: "ring", label: "a ring of land about an inland sea", weight: 5, rare: true },
  { name: "shattered", label: "a shattered world of many lands", weight: 5, rare: true },
];

function weightedType(rng: Rng): { name: string; label: string; rare: boolean } {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let roll = rng.float(0, total);
  for (const a of ARCHETYPES) {
    roll -= a.weight;
    if (roll < 0) return a;
  }
  return ARCHETYPES[0];
}

/** A land centre jittered around a nominal spot. */
function centre(rng: Rng, cx: number, cy: number, r: number, k: number, strength = 1): LandCentre {
  return {
    cx: cx + rng.float(-0.05, 0.05),
    cy: cy + rng.float(-0.05, 0.05),
    r: r * rng.float(0.85, 1.15),
    k,
    strength,
  };
}

export function pickWorldType(rng: Rng): WorldType {
  const arch = weightedType(rng);
  const centres: LandCentre[] = [];
  const rifts: Rift[] = [];
  let hollow: WorldType["hollow"];
  let frequency = 2.6;
  let targetLand = 0.4;

  switch (arch.name) {
    case "continent": {
      centres.push(centre(rng, 0.5, 0.5, 0.5, 1, 1));
      frequency = rng.float(2.3, 2.8);
      targetLand = rng.float(0.32, 0.46);
      break;
    }
    case "twin": {
      // Two lands, side by side or stacked, with a strait between.
      const vertical = rng.bool();
      if (vertical) {
        centres.push(centre(rng, 0.5, 0.29, 0.34, 1, 1));
        centres.push(centre(rng, 0.5, 0.71, 0.34, 1, rng.float(0.8, 1)));
      } else {
        centres.push(centre(rng, 0.29, 0.5, 0.34, 1, 1));
        centres.push(centre(rng, 0.71, 0.5, 0.34, 1, rng.float(0.8, 1)));
      }
      frequency = rng.float(2.4, 2.9);
      targetLand = rng.float(0.34, 0.48);
      break;
    }
    case "isles": {
      centres.push(centre(rng, 0.46, 0.5, 0.42, 1, 1));
      const n = rng.int(3, 6);
      for (let i = 0; i < n; i++) {
        centres.push(centre(rng, rng.float(0.12, 0.9), rng.float(0.12, 0.9), rng.float(0.07, 0.13), 2, rng.float(0.7, 1)));
      }
      frequency = rng.float(2.6, 3.1);
      targetLand = rng.float(0.34, 0.46);
      break;
    }
    case "archipelago": {
      // Many discrete isles strung along a rough chain — clustered, so it reads
      // as one archipelago rather than a scatter of unrelated lands. The chain
      // runs across a random axis through the middle of the map.
      const horiz = rng.bool();
      const n = rng.int(8, 13);
      for (let i = 0; i < n; i++) {
        const along = rng.float(0.2, 0.8);
        const across = 0.5 + rng.float(-0.16, 0.16);
        const cx = horiz ? along : across;
        const cy = horiz ? across : along;
        centres.push(centre(rng, cx, cy, rng.float(0.08, 0.14), 2, rng.float(0.8, 1)));
      }
      frequency = rng.float(3.0, 3.8);
      targetLand = rng.float(0.22, 0.32);
      break;
    }
    case "pangaea": {
      centres.push(centre(rng, 0.5, 0.5, 0.68, 1, 1));
      // Slightly off-round: a second broad centre welds on a peninsula.
      centres.push(centre(rng, rng.float(0.3, 0.7), rng.float(0.3, 0.7), 0.4, 1, 0.8));
      frequency = rng.float(2.0, 2.4);
      targetLand = rng.float(0.52, 0.66);
      break;
    }
    case "oceanic": {
      const n = rng.int(4, 8);
      for (let i = 0; i < n; i++) {
        centres.push(centre(rng, rng.float(0.15, 0.85), rng.float(0.15, 0.85), rng.float(0.06, 0.12), 2, rng.float(0.7, 1)));
      }
      frequency = rng.float(3.4, 4.4);
      targetLand = rng.float(0.08, 0.16);
      break;
    }
    case "ring": {
      // A broad land mask hollowed at the centre — a great inland sea.
      centres.push(centre(rng, 0.5, 0.5, 0.66, 1, 1));
      hollow = { cx: 0.5 + rng.float(-0.06, 0.06), cy: 0.5 + rng.float(-0.06, 0.06), r: rng.float(0.28, 0.38) };
      frequency = rng.float(2.4, 3.0);
      targetLand = rng.float(0.34, 0.48);
      break;
    }
    case "shattered": {
      const n = rng.int(8, 14);
      for (let i = 0; i < n; i++) {
        centres.push(centre(rng, rng.float(0.12, 0.88), rng.float(0.12, 0.88), rng.float(0.09, 0.18), 2, rng.float(0.6, 1)));
      }
      frequency = rng.float(3.0, 3.8);
      targetLand = rng.float(0.18, 0.3);
      break;
    }
  }

  // --- Small rare occurrences, layered on top where they make sense. ---
  const quirks: string[] = [];
  const majors = centres.filter((c) => c.strength >= 0.8 && c.r >= 0.25);

  // A land bridge welds two major lands into one across a narrow neck.
  if (majors.length >= 2 && rng.bool(0.14)) {
    const [a, b] = majors;
    centres.push({
      cx: (a.cx + b.cx) / 2,
      cy: (a.cy + b.cy) / 2,
      r: 0.16,
      k: 2,
      strength: 0.85,
    });
    quirks.push("a land bridge joins its greater shores");
  }

  // A great rift nearly splits the largest land.
  if (majors.length >= 1 && rng.bool(0.1)) {
    const c = majors[0];
    const ang = rng.bool();
    rifts.push(
      ang
        ? { x0: c.cx - c.r, y0: c.cy, x1: c.cx + c.r, y1: c.cy, halfWidth: rng.float(0.02, 0.035) }
        : { x0: c.cx, y0: c.cy - c.r, x1: c.cx, y1: c.cy + c.r, halfWidth: rng.float(0.02, 0.035) },
    );
    quirks.push("a great rift all but severs its heartland");
  }

  // A lone subcontinent, far off in the ocean.
  if ((arch.name === "continent" || arch.name === "twin" || arch.name === "isles") && rng.bool(0.12)) {
    centres.push(centre(rng, rng.bool() ? 0.85 : 0.15, rng.bool() ? 0.85 : 0.15, 0.17, 2, 0.95));
    quirks.push("a lone subcontinent lies far to one side");
  }

  // A polar reach — extra cold land pulled to the top or bottom edge.
  if (rng.bool(0.1)) {
    const top = rng.bool();
    centres.push({ cx: 0.5, cy: top ? 0.05 : 0.95, r: 0.55, k: 1, strength: 0.7 });
    quirks.push(top ? "a frozen reach crowns its north" : "a frozen reach anchors its south");
  }

  return {
    name: arch.name,
    label: arch.label,
    rare: arch.rare,
    centres,
    hollow,
    rifts,
    frequency,
    targetLand,
    quirks,
  };
}

/** Clamp to [0,1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Squared distance from (px,py) to the segment of a rift. Exact arithmetic. */
function segDist2(px: number, py: number, rf: Rift): number {
  const vx = rf.x1 - rf.x0;
  const vy = rf.y1 - rf.y0;
  const wx = px - rf.x0;
  const wy = py - rf.y0;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = clamp01(t);
  const dx = px - (rf.x0 + t * vx);
  const dy = py - (rf.y0 + t * vy);
  return dx * dx + dy * dy;
}

/**
 * The continent mask at a normalized point — 0 over deep ocean, up to 1 over
 * the heart of a landmass. Land centres raise it; a hollow and rifts carve it
 * back down. This is the LAND SHAPE only; the edge falloff is separate
 * (`edgeFalloff`) so terrain can compose mask and noise additively — which
 * keeps a healthy elevation range even on a world of a few tiny isles.
 */
export function maskAt(nx: number, ny: number, wt: WorldType): number {
  let m = 0;
  for (const c of wt.centres) {
    const dx = nx - c.cx;
    const dy = ny - c.cy;
    const t = (dx * dx + dy * dy) / (c.r * c.r);
    if (t >= 1) continue;
    let b = 1 - t; // parabolic bump
    if (c.k >= 2) b = b * b; // sharper edge
    const v = c.strength * b;
    if (v > m) m = v; // distinct centres stay distinct
  }

  if (wt.hollow) {
    const dx = nx - wt.hollow.cx;
    const dy = ny - wt.hollow.cy;
    const t = (dx * dx + dy * dy) / (wt.hollow.r * wt.hollow.r);
    if (t < 1) m *= t; // pulled to 0 at the sea's centre
  }

  for (const rf of wt.rifts) {
    const t = segDist2(nx, ny, rf) / (rf.halfWidth * rf.halfWidth);
    if (t < 1) m *= t; // 0 along the rift line
  }

  return m;
}

/** 1 in the interior, ramping to 0 in the outer margin — the ocean ring. */
export function edgeFalloff(nx: number, ny: number): number {
  const ex = clamp01((0.5 - Math.abs(nx - 0.5)) / 0.09);
  const ey = clamp01((0.5 - Math.abs(ny - 0.5)) / 0.09);
  return ex < ey ? ex : ey;
}
