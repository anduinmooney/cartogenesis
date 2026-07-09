// erosion.ts — Droplet-based hydraulic erosion (L1.5).
//
// Runs BEFORE hydrology so rivers later follow the valleys it carves. Thousands
// of deterministic water droplets each roll downhill, picking up sediment on
// steep descents and dropping it in flats and pits — the classic Mei/Lague
// scheme. The result turns smooth fractal terrain into something with dendritic
// valleys, ridgelines, and sediment plains. Fully seeded, so it stays
// reproducible like every other layer.

import { Grid } from "./grid.ts";
import { Rng } from "./rng.ts";

export interface ErosionConfig {
  seed: number;
  /** Number of droplets to simulate (defaults to ~0.25 per cell). */
  droplets?: number;
  /** Direction memory 0..1 (higher = straighter paths). */
  inertia?: number;
  /** Sediment capacity factor. */
  capacity?: number;
  /** Minimum slope used for capacity (keeps flats from zeroing out). */
  minSlope?: number;
  /** Fraction of the erosion deficit removed per step. */
  erode?: number;
  /** Fraction of excess sediment deposited per step. */
  deposit?: number;
  /** Water lost per step. */
  evaporation?: number;
  gravity?: number;
  /** Max steps a droplet lives. */
  maxLifetime?: number;
  /** Erosion brush radius (spreads removal to avoid single-cell pits). */
  radius?: number;
}

interface Brush {
  dx: number[];
  dy: number[];
  w: number[];
}

function makeBrush(radius: number): Brush {
  const dx: number[] = [];
  const dy: number[] = [];
  const w: number[] = [];
  let sum = 0;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= radius) {
        const weight = 1 - d / radius;
        dx.push(x);
        dy.push(y);
        w.push(weight);
        sum += weight;
      }
    }
  }
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return { dx, dy, w };
}

/**
 * Return a new elevation Grid with hydraulic erosion applied. Values stay in
 * [0,1]. Deterministic for a given (elevation, seed).
 */
export function erode(elevation: Grid, cfg: ErosionConfig): Grid {
  const { width, height } = elevation;
  const h = Float64Array.from(elevation.data);
  const rng = new Rng(cfg.seed);

  const droplets = cfg.droplets ?? Math.round(width * height * 0.25);
  const inertia = cfg.inertia ?? 0.05;
  const capacity = cfg.capacity ?? 4;
  const minSlope = cfg.minSlope ?? 0.01;
  const erodeSpeed = cfg.erode ?? 0.3;
  const depositSpeed = cfg.deposit ?? 0.3;
  const evaporation = cfg.evaporation ?? 0.02;
  const gravity = cfg.gravity ?? 4;
  const maxLifetime = cfg.maxLifetime ?? 30;
  const radius = Math.max(1, cfg.radius ?? 2);
  const brush = makeBrush(radius);

  // Bilinear height + gradient at a float position (px,py must be in-bounds-1).
  const sample = (x: number, y: number) => {
    const px = x | 0;
    const py = y | 0;
    const fx = x - px;
    const fy = y - py;
    const i = py * width + px;
    const hNW = h[i];
    const hNE = h[i + 1];
    const hSW = h[i + width];
    const hSE = h[i + width + 1];
    const gx = (hNE - hNW) * (1 - fy) + (hSE - hSW) * fy;
    const gy = (hSW - hNW) * (1 - fx) + (hSE - hNE) * fx;
    const hh =
      hNW * (1 - fx) * (1 - fy) +
      hNE * fx * (1 - fy) +
      hSW * (1 - fx) * fy +
      hSE * fx * fy;
    return { hh, gx, gy };
  };

  for (let d = 0; d < droplets; d++) {
    let x = rng.float(1, width - 2);
    let y = rng.float(1, height - 2);
    let dirX = 0;
    let dirY = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;

    for (let life = 0; life < maxLifetime; life++) {
      const px = x | 0;
      const py = y | 0;
      const offX = x - px;
      const offY = y - py;
      const { hh: hOld, gx, gy } = sample(x, y);

      // Update direction (blend gradient descent with inertia) and move.
      dirX = dirX * inertia - gx * (1 - inertia);
      dirY = dirY * inertia - gy * (1 - inertia);
      const len = Math.hypot(dirX, dirY);
      if (len !== 0) {
        dirX /= len;
        dirY /= len;
      }
      x += dirX;
      y += dirY;

      if ((dirX === 0 && dirY === 0) || x < 1 || x > width - 2 || y < 1 || y > height - 2) {
        break;
      }

      const hNew = sample(x, y).hh;
      const dh = hNew - hOld;
      const cap = Math.max(-dh, minSlope) * speed * water * capacity;

      if (sediment > cap || dh > 0) {
        // Deposit: fill uphill steps fully, otherwise shed the excess.
        const amt = dh > 0 ? Math.min(dh, sediment) : (sediment - cap) * depositSpeed;
        sediment -= amt;
        const i = py * width + px;
        h[i] += amt * (1 - offX) * (1 - offY);
        h[i + 1] += amt * offX * (1 - offY);
        h[i + width] += amt * (1 - offX) * offY;
        h[i + width + 1] += amt * offX * offY;
      } else {
        // Erode: spread removal over the brush, never below zero.
        const amt = Math.min((cap - sediment) * erodeSpeed, -dh);
        for (let b = 0; b < brush.w.length; b++) {
          const bx = px + brush.dx[b];
          const by = py + brush.dy[b];
          if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
          const bi = by * width + bx;
          const removed = Math.min(h[bi], amt * brush.w[b]);
          h[bi] -= removed;
          sediment += removed;
        }
      }

      speed = Math.sqrt(Math.max(0, speed * speed - dh * gravity));
      water *= 1 - evaporation;
      if (water < 1e-3) break;
    }
  }

  const out = new Grid(width, height);
  for (let i = 0; i < h.length; i++) {
    out.data[i] = h[i] < 0 ? 0 : h[i] > 1 ? 1 : h[i];
  }
  return out;
}
