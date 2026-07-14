// terrain.ts — Elevation generation.
//
// Produces a normalized [0,1] elevation Grid by combining fractal noise with a
// continent mask. The mask now comes from a per-world ARCHETYPE (worldtype.ts)
// — a lone continent, twin continents, an archipelago, a supercontinent, a
// ring about an inland sea — so worlds are real geographies, not one central
// blob. A legacy single radial island mask remains for callers that ask for it.

import { Grid } from "./grid.js";
import { powExact } from "./exact.js";
import { fbm2D, ridge2D } from "./noise.js";
import { maskAt, edgeFalloff,                } from "./worldtype.js";

                                
                
                 
                                                    
               
                                                                                 
                     
                                                      
                   
                                                                          
                    
                                                           
                   
                                                                             
                       
                                                                                 
                        
 

export function generateElevation(cfg               )       {
  const {
    width,
    height,
    seed,
    octaves = 6,
    ridgeMix = 0.3,
    island = true,
    islandPower = 1.25,
    worldType,
  } = cfg;
  const frequency = cfg.frequency ?? worldType?.frequency ?? 2.6;

  const grid = new Grid(width, height);
  const invW = 1 / width;
  const invH = 1 / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x * invW;
      const ny = y * invH;

      const base = fbm2D(nx * frequency, ny * frequency, { octaves, seed });
      let h = base;
      if (ridgeMix > 0) {
        const r = ridge2D(nx * frequency, ny * frequency, {
          octaves,
          seed: (seed ^ 0x9e3779b9) | 0,
        });
        h = base * (1 - ridgeMix) + r * ridgeMix;
      }

      if (worldType) {
        // Additive blend: the mask leads placement, the noise carves coasts.
        // (Multiplying the two would crush the elevation range on sparse
        // island worlds — a few dim isles the sea level cannot cleanly cut.)
        // The edge falloff then rings the whole world in ocean.
        const m = maskAt(nx, ny, worldType);
        h = (0.45 * h + 0.55 * m) * edgeFalloff(nx, ny);
      } else if (island) {
        // Legacy single radial island (CLI overrides, tests that ask for it).
        const dx = (nx - 0.5) * 2;
        const dy = (ny - 0.5) * 2;
        const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
        const mask = 1 - powExact(d, islandPower);
        h *= Math.max(0, mask);
      }

      grid.data[y * width + x] = h;
    }
  }

  return grid.normalize();
}

/**
 * The sea level at which exactly `targetLand` of the map stands above water.
 * A histogram quantile, so every archetype hits a realistic land fraction no
 * matter how the noise fell — no world drowns entirely or turns all to rock.
 * Exact arithmetic (bin counting), computed once on the base field.
 */
export function seaLevelForLandFraction(elevation      , targetLand        )         {
  const data = elevation.data;
  const n = data.length;
  const want = Math.max(0.02, Math.min(0.95, targetLand));
  const BINS = 2048;
  const hist = new Int32Array(BINS);
  // Field is normalized to [0,1]; bin each cell.
  for (let i = 0; i < n; i++) {
    let b = Math.floor(data[i] * BINS);
    if (b < 0) b = 0;
    else if (b >= BINS) b = BINS - 1;
    hist[b]++;
  }
  // Walk down from the top until we have collected `want` of the cells: that
  // bin's lower edge is the sea level. Floored just above the very bottom bin
  // so the deep-ocean floor (mask = 0, elevation ≈ 0) always stays wet — a
  // drowned world whose islands cannot supply the whole target simply keeps
  // the ocean it has, rather than reporting itself 100% land.
  const targetCount = want * n;
  let collected = 0;
  for (let b = BINS - 1; b >= 1; b--) {
    collected += hist[b];
    if (collected >= targetCount) return b / BINS;
  }
  return 1 / BINS;
}

/**
 * Classify elevation into coarse land/water at a sea level threshold.
 * Returns fraction of the map that is land — a quick sanity metric.
 */
export function landFraction(elevation      , seaLevel        )         {
  let land = 0;
  for (let i = 0; i < elevation.data.length; i++) {
    if (elevation.data[i] >= seaLevel) land++;
  }
  return land / elevation.data.length;
}
