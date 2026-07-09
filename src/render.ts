// render.ts — Turn scalar Grids into RGBA pixel buffers.
//
// Two renderers for now:
//   renderGrayscale  — raw elevation as luminance (debug / heightmap view).
//   renderHypsometric — a classic map "hypsometric tint": ocean depths in
//                       blues, land shaded green→brown→white by altitude.

import type { Grid } from "./grid.ts";
import type { WaterLayer } from "./hydrology.ts";
import type { RiverLayer } from "./rivers.ts";

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
const LAKE_COLOR: RGB = [70, 130, 165];

export function renderHypsometric(
  elevation: Grid,
  seaLevel: number,
  opts: { hillshade?: boolean; water?: WaterLayer } = {},
): Uint8Array {
  const { width, height, data } = elevation;
  const out = new Uint8Array(width * height * 4);
  const hillshade = opts.hillshade ?? true;
  const water = opts.water;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = data[i];
      let color: RGB;

      if (water && water.lakeMask[i] === 1) {
        // Inland lake — a distinct, lighter blue than the ocean ramp.
        color = LAKE_COLOR;
      } else if (h < seaLevel) {
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

const TEMP_RAMP: Array<[number, RGB]> = [
  [0.0, [48, 70, 150]], // frigid
  [0.3, [80, 150, 205]],
  [0.5, [235, 228, 150]], // temperate
  [0.72, [225, 135, 60]],
  [1.0, [165, 30, 30]], // torrid
];

const MOIST_RAMP: Array<[number, RGB]> = [
  [0.0, [196, 166, 104]], // arid
  [0.35, [214, 206, 128]],
  [0.6, [120, 182, 100]],
  [1.0, [28, 112, 150]], // saturated
];

const WATER_NEUTRAL: RGB = [34, 40, 50];

/**
 * Render any [0,1] scalar field through a color ramp. If a water layer is
 * given, ocean/lake cells render as a neutral dark tone so land data reads
 * clearly on thematic maps.
 */
export function renderScalarField(
  field: Grid,
  stops: Array<[number, RGB]>,
  water?: WaterLayer,
): Uint8Array {
  const { width, height, data } = field;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    const isWater =
      water && (water.oceanMask[i] === 1 || water.lakeMask[i] === 1);
    const c = isWater ? WATER_NEUTRAL : ramp(stops, data[i]);
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

const RIVER_COLOR: RGB = [58, 110, 165];

/**
 * Overlay rivers onto an existing RGBA buffer, in place. River color is blended
 * by strength so major rivers read darker/bluer than trickles. Returns the same
 * buffer for chaining.
 */
export function overlayRivers(
  rgba: Uint8Array,
  rivers: RiverLayer,
  width: number,
  height: number,
): Uint8Array {
  const { riverMask, flowAccum, maxFlow } = rivers;
  const accum = flowAccum.data;
  const logMax = Math.log1p(maxFlow) || 1;
  for (let i = 0; i < riverMask.length; i++) {
    if (riverMask[i] === 0) continue;
    // Strength 0..1 by log-scaled flow, floored so small rivers stay visible.
    const strength = 0.45 + 0.55 * (Math.log1p(accum[i]) / logMax);
    const s = Math.max(0.45, Math.min(1, strength));
    const j = i * 4;
    rgba[j] = Math.round(rgba[j] * (1 - s) + RIVER_COLOR[0] * s);
    rgba[j + 1] = Math.round(rgba[j + 1] * (1 - s) + RIVER_COLOR[1] * s);
    rgba[j + 2] = Math.round(rgba[j + 2] * (1 - s) + RIVER_COLOR[2] * s);
  }
  return rgba;
}

export function renderTemperature(temperature: Grid, water?: WaterLayer): Uint8Array {
  return renderScalarField(temperature, TEMP_RAMP, water);
}

export function renderMoisture(moisture: Grid, water?: WaterLayer): Uint8Array {
  return renderScalarField(moisture, MOIST_RAMP, water);
}
