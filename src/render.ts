// render.ts — Turn scalar Grids into RGBA pixel buffers.
//
// Two renderers for now:
//   renderGrayscale  — raw elevation as luminance (debug / heightmap view).
//   renderHypsometric — a classic map "hypsometric tint": ocean depths in
//                       blues, land shaded green→brown→white by altitude.

import type { Grid } from "./grid.ts";

export type RGB = [number, number, number];

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Sample a color ramp defined by sorted [position, color] stops. */
function ramp(stops: Array<[number, RGB]>, t: number): RGB {
  if (t <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      return lerpColor(c0, c1, (t - p0) / (p1 - p0));
    }
  }
  return last[1];
}

export function renderGrayscale(grid: Grid): Uint8Array {
  const { width, height, data } = grid;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

const OCEAN_RAMP: Array<[number, RGB]> = [
  [0.0, [8, 24, 58]], // abyss
  [0.6, [16, 54, 110]], // deep
  [0.9, [40, 100, 160]], // shelf
  [1.0, [90, 155, 200]], // shallow / shore
];

const LAND_RAMP: Array<[number, RGB]> = [
  [0.0, [200, 190, 140]], // beach / lowland
  [0.15, [96, 150, 74]], // plains
  [0.4, [58, 118, 58]], // forest
  [0.62, [120, 110, 70]], // foothills
  [0.8, [110, 92, 78]], // mountain
  [0.92, [190, 185, 185]], // bare peak
  [1.0, [255, 255, 255]], // snow
];

/**
 * Hypsometric map. `seaLevel` (0..1) splits the elevation field into ocean
 * and land; each half is colored by its own ramp so the coastline reads
 * clearly. Optional hillshade adds a sense of relief.
 */
export function renderHypsometric(
  elevation: Grid,
  seaLevel: number,
  opts: { hillshade?: boolean } = {},
): Uint8Array {
  const { width, height, data } = elevation;
  const out = new Uint8Array(width * height * 4);
  const hillshade = opts.hillshade ?? true;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = data[i];
      let color: RGB;

      if (h < seaLevel) {
        color = ramp(OCEAN_RAMP, h / seaLevel);
      } else {
        const t = (h - seaLevel) / (1 - seaLevel);
        color = ramp(LAND_RAMP, t);

        if (hillshade) {
          // Cheap directional shading from the local gradient.
          const hl = elevation.getClamped(x - 1, y);
          const hr = elevation.getClamped(x + 1, y);
          const hu = elevation.getClamped(x, y - 1);
          const hd = elevation.getClamped(x, y + 1);
          const slope = (hr - hl) * 0.5 + (hd - hu) * 0.5; // NW light
          const shade = Math.max(-0.35, Math.min(0.35, -slope * 6));
          const f = 1 + shade;
          color = [
            Math.max(0, Math.min(255, Math.round(color[0] * f))),
            Math.max(0, Math.min(255, Math.round(color[1] * f))),
            Math.max(0, Math.min(255, Math.round(color[2] * f))),
          ];
        }
      }

      out[i * 4] = color[0];
      out[i * 4 + 1] = color[1];
      out[i * 4 + 2] = color[2];
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}
