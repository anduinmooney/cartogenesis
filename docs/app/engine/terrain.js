// terrain.ts — Elevation generation.
//
// Produces a normalized [0,1] elevation Grid by combining fractal noise with
// an optional radial "continent mask" that pulls coastlines inward so worlds
// look like islands/continents surrounded by ocean rather than noise squares.

import { Grid } from "./grid.js";
import { fbm2D, ridge2D } from "./noise.js";

                                
                
                 
                                                    
               
                                                                                 
                     
                                                      
                   
                                                                          
                    
                                                           
                   
                                                                             
                       
 

export function generateElevation(cfg               )       {
  const {
    width,
    height,
    seed,
    frequency = 2.6,
    octaves = 6,
    ridgeMix = 0.3,
    island = true,
    islandPower = 1.2,
  } = cfg;

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

      if (island) {
        // Distance from center, normalized so a corner ≈ 1.
        const dx = (nx - 0.5) * 2;
        const dy = (ny - 0.5) * 2;
        const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
        const mask = 1 - Math.pow(d, islandPower);
        h *= Math.max(0, mask);
      }

      grid.data[y * width + x] = h;
    }
  }

  return grid.normalize();
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
