// climate.ts — L3/L4: temperature and moisture fields.
//
// Temperature is driven by latitude (warm equator, cold poles), an elevation
// lapse rate (higher = colder), a maritime moderating effect near oceans, and a
// little regional noise. Moisture is a simple prevailing-wind rainfall model:
// air picks up humidity over ocean and sheds it as rain over land, dumping
// extra on windward mountain slopes (orographic rain) and leaving dry rain
// shadows behind them.
//
// Both fields are returned normalized to [0, 1]:
//   temperature: 0 = frigid, 1 = torrid
//   moisture:    0 = arid,   1 = saturated

import { Grid } from "./grid.ts";
import { cosQuarterTurn } from "./exact.ts";
import { fbm2D } from "./noise.ts";
import type { WaterLayer } from "./hydrology.ts";

export interface TemperatureConfig {
  seed: number;
  /** Elevation above which temperature falls fastest (lapse), 0..1. */
  seaLevel?: number;
  /** How strongly elevation cools the air (0..1+). */
  lapse?: number;
  /** Amount of regional random variation, 0..1. */
  noiseAmount?: number;
  /** Maritime moderation strength (oceans pull coastal temps toward mild). */
  maritime?: number;
}

/**
 * Latitude runs from the equator at the vertical center of the map to the poles
 * at the top and bottom edges. Returns 0 at the equator, 1 at a pole.
 */
export function latitudeBand(y: number, height: number): number {
  return Math.abs((y / (height - 1)) * 2 - 1);
}

export function generateTemperature(
  elevation: Grid,
  water: WaterLayer,
  cfg: TemperatureConfig,
): Grid {
  const { width, height } = elevation;
  const seaLevel = cfg.seaLevel ?? 0.42;
  const lapse = cfg.lapse ?? 0.9;
  const noiseAmount = cfg.noiseAmount ?? 0.12;
  const maritime = cfg.maritime ?? 0.15;

  const temp = new Grid(width, height);
  const maxDist = width + height;

  for (let y = 0; y < height; y++) {
    // Warmth from latitude: 1 at equator, ~0 at poles (smooth cosine curve).
    const lat = latitudeBand(y, height);
    const latWarmth = cosQuarterTurn(lat); // 1 → 0

    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = elevation.data[i];

      // Elevation lapse only applies above sea level.
      const above = Math.max(0, h - seaLevel) / (1 - seaLevel);
      let t = latWarmth - above * lapse;

      // Maritime moderation: near-ocean cells drift toward a mild 0.5.
      const prox = 1 - Math.min(1, water.distToOcean.data[i] / (maxDist * 0.08));
      if (prox > 0) t = t * (1 - maritime * prox) + 0.5 * (maritime * prox);

      // Regional noise for texture.
      const n =
        fbm2D((x / width) * 3, (y / height) * 3, {
          seed: cfg.seed,
          octaves: 4,
        }) - 0.5;
      t += n * noiseAmount;

      temp.data[i] = Math.max(0, Math.min(1, t));
    }
  }

  return temp;
}

export interface MoistureConfig {
  seed: number;
  seaLevel?: number;
  /** Humidity gained per ocean cell the wind crosses (scaled by warmth). */
  evaporation?: number;
  /** Fraction of carried humidity that falls as rain per land cell. */
  rainRate?: number;
  /** Extra rain per unit of upslope (orographic lift). */
  orographic?: number;
  /** Regional noise amount, 0..1. */
  noiseAmount?: number;
}

/**
 * Prevailing-wind moisture model (wind blows west → east). Air gains humidity
 * over water and rains it out over land, with extra rain on upslopes and dry
 * shadows behind ranges. Water cells are fully wet (1). Land is normalized to
 * [0, 1] and lightly smoothed.
 */
export function generateMoisture(
  elevation: Grid,
  temperature: Grid,
  water: WaterLayer,
  cfg: MoistureConfig,
): Grid {
  const { width, height } = elevation;
  const evaporation = cfg.evaporation ?? 0.08;
  const rainRate = cfg.rainRate ?? 0.05;
  const orographic = cfg.orographic ?? 6;
  const noiseAmount = cfg.noiseAmount ?? 0.1;

  const moist = new Grid(width, height);
  const isWater = (i: number) =>
    water.oceanMask[i] === 1 || water.lakeMask[i] === 1;

  // Pass 1 — prevailing-wind rain shadow. Air carries humidity east, raining it
  // out over land and dumping extra on upslopes.
  const windRain = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    let humidity = 0.35; // moisture entering from the west
    let prevH = elevation.data[y * width];
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isWater(i)) {
        const warmth = 0.5 + 0.5 * temperature.data[i];
        humidity = Math.min(1, humidity + evaporation * warmth);
        windRain[i] = 1;
      } else {
        const upslope = Math.max(0, elevation.data[i] - prevH);
        let rain = humidity * rainRate + upslope * orographic * humidity;
        rain = Math.min(humidity, rain);
        windRain[i] = rain;
        humidity -= rain;
      }
      prevH = elevation.data[i];
    }
  }
  // Normalize the land portion of the wind-rain field to [0,1].
  let wMin = Infinity;
  let wMax = -Infinity;
  for (let i = 0; i < windRain.length; i++) {
    if (isWater(i)) continue;
    if (windRain[i] < wMin) wMin = windRain[i];
    if (windRain[i] > wMax) wMax = windRain[i];
  }
  const wSpan = wMax - wMin || 1;

  // Pass 2 — combine wind rain with maritime proximity (all coasts get some
  // moisture) plus regional noise, so interiors dry out without going flat.
  const proxScale = width * 0.32;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isWater(i)) {
        moist.data[i] = 1;
        continue;
      }
      const windN = (windRain[i] - wMin) / wSpan;
      const prox = 1 - Math.min(1, water.distToOcean.data[i] / proxScale);
      const n =
        fbm2D((x / width) * 4, (y / height) * 4, {
          seed: (cfg.seed ^ 0x51ed270b) | 0,
          octaves: 3,
        }) - 0.5;
      const v = 0.55 * windN + 0.45 * prox + n * noiseAmount;
      moist.data[i] = Math.max(0, Math.min(1, v));
    }
  }

  return boxBlur(moist, 1);
}

/** Simple 3x3 (radius r) box blur; deterministic, edge-clamped. */
function boxBlur(grid: Grid, r: number): Grid {
  const { width, height } = grid;
  const out = new Grid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          sum += grid.getClamped(x + dx, y + dy);
          count++;
        }
      }
      out.data[y * width + x] = sum / count;
    }
  }
  return out;
}
