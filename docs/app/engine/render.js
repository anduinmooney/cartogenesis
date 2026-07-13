// render.ts — Turn scalar Grids into RGBA pixel buffers.
//
// Two renderers for now:
//   renderGrayscale  — raw elevation as luminance (debug / heightmap view).
//   renderHypsometric — a classic map "hypsometric tint": ocean depths in
//                       blues, land shaded green→brown→white by altitude.

                                      
                                                 
                                              
import { BIOME_COLORS,                 } from "./biomes.js";
                                                
                                            
                                                   
import { RESOURCE_COLORS,              } from "./resources.js";
                                                   
                                                       

                                           

function lerpColor(a     , b     , t        )      {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Sample a color ramp defined by sorted [position, color] stops. */
function ramp(stops                      , t        )      {
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

export function renderGrayscale(grid      )             {
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

const OCEAN_RAMP                       = [
  [0.0, [8, 24, 58]], // abyss
  [0.6, [16, 54, 110]], // deep
  [0.9, [40, 100, 160]], // shelf
  [1.0, [90, 155, 200]], // shallow / shore
];

const LAND_RAMP                       = [
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
const LAKE_COLOR      = [70, 130, 165];

export function renderHypsometric(
  elevation      ,
  seaLevel        ,
  opts                                              = {},
)             {
  const { width, height, data } = elevation;
  const out = new Uint8Array(width * height * 4);
  const hillshade = opts.hillshade ?? true;
  const water = opts.water;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = data[i];
      let color     ;

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

const TEMP_RAMP                       = [
  [0.0, [48, 70, 150]], // frigid
  [0.3, [80, 150, 205]],
  [0.5, [235, 228, 150]], // temperate
  [0.72, [225, 135, 60]],
  [1.0, [165, 30, 30]], // torrid
];

const MOIST_RAMP                       = [
  [0.0, [196, 166, 104]], // arid
  [0.35, [214, 206, 128]],
  [0.6, [120, 182, 100]],
  [1.0, [28, 112, 150]], // saturated
];

const WATER_NEUTRAL      = [34, 40, 50];

/**
 * Render any [0,1] scalar field through a color ramp. If a water layer is
 * given, ocean/lake cells render as a neutral dark tone so land data reads
 * clearly on thematic maps.
 */
export function renderScalarField(
  field      ,
  stops                      ,
  water             ,
)             {
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

const RIVER_COLOR      = [58, 110, 165];

/**
 * Overlay rivers onto an existing RGBA buffer, in place. River color is blended
 * by strength so major rivers read darker/bluer than trickles. Returns the same
 * buffer for chaining.
 */
export function overlayRivers(
  rgba            ,
  rivers            ,
  width        ,
  height        ,
)             {
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

const ROAD_COLOR      = [92, 64, 38];

/** Overlay roads onto an RGBA buffer in place. */
export function overlayRoads(
  rgba            ,
  roads           ,
)             {
  const mask = roads.roadMask;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) continue;
    const j = i * 4;
    rgba[j] = Math.round(rgba[j] * 0.25 + ROAD_COLOR[0] * 0.75);
    rgba[j + 1] = Math.round(rgba[j + 1] * 0.25 + ROAD_COLOR[1] * 0.75);
    rgba[j + 2] = Math.round(rgba[j + 2] * 0.25 + ROAD_COLOR[2] * 0.75);
  }
  return rgba;
}

function drawMarker(
  rgba            ,
  width        ,
  height        ,
  cx        ,
  cy        ,
  r        ,
  fill     ,
  border     ,
)       {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const d2 = dx * dx + dy * dy;
      const j = (y * width + x) * 4;
      if (d2 <= r * r) {
        rgba[j] = fill[0];
        rgba[j + 1] = fill[1];
        rgba[j + 2] = fill[2];
      } else if (d2 <= (r + 1) * (r + 1)) {
        rgba[j] = border[0];
        rgba[j + 1] = border[1];
        rgba[j + 2] = border[2];
      }
    }
  }
}

const TIER_STYLE                                           = {
  village: { r: 1, fill: [235, 235, 240] },
  town: { r: 2, fill: [245, 238, 210] },
  city: { r: 3, fill: [255, 246, 224] },
};
const CAPITAL_FILL      = [255, 208, 84];
const MARKER_BORDER      = [30, 26, 22];

/** Overlay settlement markers (sized by tier; capital gold) in place. */
export function overlaySettlements(
  rgba            ,
  settlements              ,
  width        ,
  height        ,
)             {
  for (const s of settlements) {
    const style = TIER_STYLE[s.tier] ?? TIER_STYLE.village;
    const fill = s.isCapital ? CAPITAL_FILL : style.fill;
    const r = s.isCapital ? style.r + 1 : style.r;
    drawMarker(rgba, width, height, s.x, s.y, r, fill, MARKER_BORDER);
  }
  return rgba;
}

/** Hillshade factor at a cell from the local elevation gradient (NW light). */
function hillshadeFactor(elevation      , x        , y        )         {
  const hl = elevation.getClamped(x - 1, y);
  const hr = elevation.getClamped(x + 1, y);
  const hu = elevation.getClamped(x, y - 1);
  const hd = elevation.getClamped(x, y + 1);
  const slope = (hr - hl) * 0.5 + (hd - hu) * 0.5;
  return 1 + Math.max(-0.3, Math.min(0.3, -slope * 6));
}

/**
 * Render a [0,1] scalar over land through a ramp, contrast-stretched to the
 * land range and shaded by terrain so it reads as a map, not a flat blob.
 */
function renderThematic(
  field      ,
  stops                      ,
  water                        ,
  elevation       ,
)             {
  const { width, height, data } = field;
  const out = new Uint8Array(width * height * 4);
  const isWater = (i        ) =>
    !!water && (water.oceanMask[i] === 1 || water.lakeMask[i] === 1);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (isWater(i)) continue;
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const span = max - min || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isWater(i)) {
        out[i * 4] = WATER_NEUTRAL[0];
        out[i * 4 + 1] = WATER_NEUTRAL[1];
        out[i * 4 + 2] = WATER_NEUTRAL[2];
        out[i * 4 + 3] = 255;
        continue;
      }
      const c = ramp(stops, (data[i] - min) / span);
      const f = elevation ? hillshadeFactor(elevation, x, y) : 1;
      out[i * 4] = Math.max(0, Math.min(255, Math.round(c[0] * f)));
      out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(c[1] * f)));
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(c[2] * f)));
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

export function renderTemperature(
  temperature      ,
  water             ,
  elevation       ,
)             {
  return renderThematic(temperature, TEMP_RAMP, water, elevation);
}

/**
 * Rainfall map: contrast-stretched to the land range (the interior's real
 * variation instead of a flat wash) and terrain-shaded so it reads as a map.
 */
export function renderMoisture(
  moisture      ,
  water             ,
  elevation       ,
)             {
  return renderThematic(moisture, MOIST_RAMP, water, elevation);
}

/**
 * Hillshaded grayscale relief. Unlike the raw grayscale heightmap, this lights
 * the terrain from the northwest so ridges, valleys, and the eroded drainage
 * texture read clearly. Water renders as a flat dark tone.
 */
export function renderRelief(elevation      , water             )             {
  const { width, height, data } = elevation;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (water && (water.oceanMask[i] === 1 || water.lakeMask[i] === 1)) {
        out[i * 4] = 18;
        out[i * 4 + 1] = 26;
        out[i * 4 + 2] = 40;
        out[i * 4 + 3] = 255;
        continue;
      }
      let lum = 45 + data[i] * 195;
      const hl = elevation.getClamped(x - 1, y);
      const hr = elevation.getClamped(x + 1, y);
      const hu = elevation.getClamped(x, y - 1);
      const hd = elevation.getClamped(x, y + 1);
      const slope = (hr - hl) * 0.5 + (hd - hu) * 0.5;
      lum *= 1 + Math.max(-0.5, Math.min(0.5, -slope * 9));
      const v = Math.max(0, Math.min(255, Math.round(lum)));
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

function hslToRgb(h        , s        , l        )      {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Stable, well-spread color for a region id (golden-angle hue rotation). */
export function regionColor(id        )      {
  const hue = (id * 137.508) % 360;
  const sat = 0.42 + ((id * 47) % 100) / 400; // 0.42–0.67
  const lig = 0.58 + ((id * 29) % 100) / 500; // 0.58–0.78
  return hslToRgb(hue, sat, lig);
}

const REGION_OCEAN      = [38, 58, 82];
const REGION_LAKE      = [70, 110, 140];
const REGION_BORDER      = [28, 32, 40];

/**
 * Political map: each region a distinct tint, ocean/lake neutral, thin borders
 * between adjacent regions. Optional hillshade grounds it to the terrain.
 */
export function renderRegions(
  regions             ,
  water            ,
  elevation       ,
)             {
  const ids = regions.ids;
  const n = ids.length;
  const width = elevation?.width ?? Math.round(Math.sqrt(n));
  const height = elevation?.height ?? Math.round(n / width);
  const out = new Uint8Array(n * 4);

  for (let i = 0; i < n; i++) {
    let color     ;
    if (water.oceanMask[i] === 1) color = REGION_OCEAN;
    else if (water.lakeMask[i] === 1) color = REGION_LAKE;
    else {
      color = regionColor(ids[i]);
      if (elevation) {
        const x = i % width;
        const y = (i / width) | 0;
        const slope =
          (elevation.getClamped(x + 1, y) - elevation.getClamped(x - 1, y)) *
            0.5 +
          (elevation.getClamped(x, y + 1) - elevation.getClamped(x, y - 1)) *
            0.5;
        const f = 1 + Math.max(-0.22, Math.min(0.22, -slope * 5));
        color = [
          Math.max(0, Math.min(255, Math.round(color[0] * f))),
          Math.max(0, Math.min(255, Math.round(color[1] * f))),
          Math.max(0, Math.min(255, Math.round(color[2] * f))),
        ];
      }
      // Draw a border where a right/down neighbor is a different region.
      const x = i % width;
      const y = (i / width) | 0;
      const rightDiff = x + 1 < width && ids[i + 1] >= 0 && ids[i + 1] !== ids[i];
      const downDiff =
        y + 1 < height && ids[i + width] >= 0 && ids[i + width] !== ids[i];
      if (rightDiff || downDiff) color = REGION_BORDER;
    }
    out[i * 4] = color[0];
    out[i * 4 + 1] = color[1];
    out[i * 4 + 2] = color[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Overlay resource deposits as small colored squares (by kind) in place. */
export function overlayResources(
  rgba            ,
  deposits           ,
  width        ,
  height        ,
)             {
  for (const d of deposits) {
    const c = RESOURCE_COLORS[d.kind] ?? [255, 255, 255];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = d.x + dx;
        const y = d.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const j = (y * width + x) * 4;
        const edge = Math.abs(dx) === 1 || Math.abs(dy) === 1;
        if (edge) {
          // dark outline
          rgba[j] = 20;
          rgba[j + 1] = 18;
          rgba[j + 2] = 16;
        } else {
          rgba[j] = c[0];
          rgba[j + 1] = c[1];
          rgba[j + 2] = c[2];
        }
      }
    }
    // center pixel = bright color
    const j = (d.y * width + d.x) * 4;
    rgba[j] = c[0];
    rgba[j + 1] = c[1];
    rgba[j + 2] = c[2];
  }
  return rgba;
}

const FAITH_PALETTE        = [
  [196, 120, 90],
  [96, 150, 180],
  [150, 170, 100],
  [170, 110, 170],
  [200, 175, 90],
];

/** Render a faiths map: each region tinted by its dominant faith. */
export function renderFaiths(
  regions             ,
  religion               ,
  water            ,
  elevation      ,
)             {
  const ids = regions.ids;
  const n = ids.length;
  const width = elevation.width;
  const height = elevation.height;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let color     ;
    if (water.oceanMask[i] === 1) color = [38, 58, 82];
    else if (water.lakeMask[i] === 1) color = [70, 110, 140];
    else {
      const faithId = religion.regionFaith[ids[i]] ?? 0;
      color = FAITH_PALETTE[faithId % FAITH_PALETTE.length];
      // Border between different faiths.
      const x = i % width;
      const y = (i / width) | 0;
      const rf = (j        ) => religion.regionFaith[ids[j]] ?? -1;
      const here = religion.regionFaith[ids[i]] ?? -1;
      const rightDiff = x + 1 < width && ids[i + 1] >= 0 && rf(i + 1) !== here;
      const downDiff = y + 1 < height && ids[i + width] >= 0 && rf(i + width) !== here;
      if (rightDiff || downDiff) color = [28, 32, 40];
    }
    out[i * 4] = color[0];
    out[i * 4 + 1] = color[1];
    out[i * 4 + 2] = color[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Render the final political map after simulation: each region tinted by its
 * controlling realm, with borders between realms.
 */
export function renderPowers(
  regions             ,
  simulation                 ,
  water            ,
  elevation      ,
)             {
  return renderPowersAt(regions, simulation.finalControl, water, elevation);
}

/**
 * Political map from an arbitrary region→realm control map — used by the time
 * scrubber to render any turn's borders, and by `renderPowers` for the final one.
 */
export function renderPowersAt(
  regions             ,
  control                        ,
  water            ,
  elevation      ,
)             {
  const ids = regions.ids;
  const n = ids.length;
  const width = elevation.width;
  const height = elevation.height;
  const out = new Uint8Array(n * 4);
  const realmOf = (cellIdx        )         =>
    ids[cellIdx] >= 0 ? (control[ids[cellIdx]] ?? -1) : -2;

  for (let i = 0; i < n; i++) {
    let color     ;
    if (water.oceanMask[i] === 1) color = [38, 58, 82];
    else if (water.lakeMask[i] === 1) color = [70, 110, 140];
    else {
      const realm = realmOf(i);
      color = realm < 0 ? [90, 90, 96] : regionColor(realm * 3 + 1);
      const x = i % width;
      const y = (i / width) | 0;
      const rightDiff = x + 1 < width && ids[i + 1] >= 0 && realmOf(i + 1) !== realm;
      const downDiff = y + 1 < height && ids[i + width] >= 0 && realmOf(i + width) !== realm;
      if (rightDiff || downDiff) color = [24, 26, 32];
    }
    out[i * 4] = color[0];
    out[i * 4 + 1] = color[1];
    out[i * 4 + 2] = color[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

const TOPO_RAMP                       = [
  [0.0, [126, 172, 96]], // lowland green
  [0.18, [190, 200, 112]], // yellow-green
  [0.36, [214, 192, 138]], // tan
  [0.55, [176, 134, 92]], // brown
  [0.72, [138, 100, 74]], // dark brown
  [0.86, [180, 172, 166]], // grey rock
  [1.0, [248, 248, 250]], // snow
];

/**
 * Topographic map: hypsometric colour bands with darker contour isolines every
 * (1/bands) of the land elevation range. Volcano craters read as concentric
 * rings. `bands` maps to the metre interval = maxAltitude / bands.
 */
/**
 * A round contour interval, in metres, sized to the world's real relief: the
 * smallest of the standard cartographic intervals that keeps the map under
 * ~20 bands. A 4,500 m world contours every 250 m; a low island every 50 m.
 */
export function pickContourInterval(peakMetres        )         {
  for (const interval of [25, 50, 100, 200, 250, 500, 1000]) {
    if (peakMetres / interval <= 20) return interval;
  }
  return 2000;
}

export function renderContours(
  elevation      ,
  seaLevel        ,
  maxAltitudeMetres = 4500,
)             {
  const { width, height, data } = elevation;
  const out = new Uint8Array(width * height * 4);
  const inv = 1 / (1 - seaLevel);

  // Metre-accurate isolines: every line sits on a round elevation, and every
  // fifth (the INDEX contour, as on a real topo sheet) is drawn heavier.
  let peak = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
  const peakMetres = Math.max(1, (peak - seaLevel) * inv * maxAltitudeMetres);
  const interval = pickContourInterval(peakMetres);
  const bandOf = (i        ) => {
    const metres = (data[i] - seaLevel) * inv * maxAltitudeMetres;
    return Math.floor(metres / interval);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let color     ;
      if (data[i] < seaLevel) {
        color = ramp(OCEAN_RAMP, data[i] / seaLevel);
      } else {
        const t = (data[i] - seaLevel) * inv;
        color = ramp(TOPO_RAMP, t);
        const b = bandOf(i);
        const rb = x + 1 < width && data[i + 1] >= seaLevel ? bandOf(i + 1) : b;
        const db = y + 1 < height && data[i + width] >= seaLevel ? bandOf(i + width) : b;
        if (rb !== b || db !== b) {
          // The boundary this pixel draws is the higher band's lower edge.
          const boundary = Math.max(b, rb, db);
          const isIndex = boundary % 5 === 0;
          const k = isIndex ? 0.22 : 0.55; // index contours heavier/darker
          color = [
            Math.round(color[0] * k),
            Math.round(color[1] * (k - 0.03)),
            Math.round(color[2] * (k - 0.05)),
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

/** Render a biome map. Optional hillshade adds subtle relief from elevation. */
export function renderBiomes(
  biomes            ,
  elevation       ,
)             {
  const { ids } = biomes;
  const out = new Uint8Array(ids.length * 4);
  for (let i = 0; i < ids.length; i++) {
    const c = BIOME_COLORS[ids[i]                             ] ?? [0, 0, 0];
    let r = c[0];
    let g = c[1];
    let b = c[2];
    if (elevation) {
      const x = i % elevation.width;
      const y = (i / elevation.width) | 0;
      const hl = elevation.getClamped(x - 1, y);
      const hr = elevation.getClamped(x + 1, y);
      const hu = elevation.getClamped(x, y - 1);
      const hd = elevation.getClamped(x, y + 1);
      const slope = (hr - hl) * 0.5 + (hd - hu) * 0.5;
      const f = 1 + Math.max(-0.25, Math.min(0.25, -slope * 5));
      r = Math.max(0, Math.min(255, Math.round(r * f)));
      g = Math.max(0, Math.min(255, Math.round(g * f)));
      b = Math.max(0, Math.min(255, Math.round(b * f)));
    }
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}
