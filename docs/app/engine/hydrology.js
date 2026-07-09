// hydrology.ts — L2: sea, coasts, and lakes.
//
// Interprets the raw elevation field as water and land. The key distinction is
// between CONNECTED OCEAN (sub-sea-level cells reachable from the map border)
// and INLAND BASINS (sub-sea-level cells that are NOT reachable) which become
// lakes. From that we derive coastlines and a distance-to-ocean field that
// later climate layers use for maritime vs. continental effects.

import { Grid } from "./grid.js";

                             
                                                     
                        
                                                                                 
                       
                                                                            
                    
                                                                            
                    
                                                                     
                    
                                                     
                        
                                                 
                       
 

const NEIGHBORS4                                  = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Classify the elevation field into ocean, lake, land, coastline, and a
 * distance-to-ocean field. Fully deterministic — no randomness involved.
 */
export function analyzeWater(elevation      , seaLevel        )             {
  const { width, height, data } = elevation;
  const n = width * height;

  const oceanMask = new Uint8Array(n);
  const visited = new Uint8Array(n);

  // Flood fill ocean from every below-sea-level border cell.
  const stack           = [];
  const pushIfSea = (x        , y        ) => {
    const i = y * width + x;
    if (!visited[i] && data[i] < seaLevel) {
      visited[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    pushIfSea(x, 0);
    pushIfSea(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfSea(0, y);
    pushIfSea(width - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() ;
    oceanMask[i] = 1;
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && data[ni] < seaLevel) {
        visited[ni] = 1;
        stack.push(ni);
      }
    }
  }

  // Any remaining below-sea-level cell that isn't ocean is a lake.
  const lakeMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (data[i] < seaLevel && oceanMask[i] === 0) lakeMask[i] = 1;
  }

  // Coastline: land cells touching ocean.
  const coast = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i] < seaLevel) continue; // only land can be coast
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (oceanMask[ny * width + nx] === 1) {
          coast[i] = 1;
          break;
        }
      }
    }
  }

  // Distance to ocean via multi-source BFS seeded from all ocean cells.
  const distToOcean = new Grid(width, height);
  const dist = distToOcean.data;
  dist.fill(Infinity);
  // Ring-buffer BFS queue over cell indices.
  const queue = new Int32Array(n);
  let qHead = 0;
  let qTail = 0;
  for (let i = 0; i < n; i++) {
    if (oceanMask[i] === 1) {
      dist[i] = 0;
      queue[qTail++] = i;
    }
  }
  while (qHead < qTail) {
    const i = queue[qHead++];
    const x = i % width;
    const y = (i / width) | 0;
    const nd = dist[i] + 1;
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        queue[qTail++] = ni;
      }
    }
  }
  // Fully enclosed seas (none) or isolated cells left at Infinity → clamp to a
  // large finite value so downstream math stays well-defined.
  for (let i = 0; i < n; i++) {
    if (!isFinite(dist[i])) dist[i] = width + height;
  }

  const lakeCount = countComponents(lakeMask, width, height);

  let oceanCells = 0;
  let lakeCells = 0;
  for (let i = 0; i < n; i++) {
    if (oceanMask[i]) oceanCells++;
    if (lakeMask[i]) lakeCells++;
  }

  return {
    oceanMask,
    lakeMask,
    coast,
    distToOcean,
    lakeCount,
    oceanFraction: oceanCells / n,
    lakeFraction: lakeCells / n,
  };
}

/** Count 4-connected components of a binary mask. */
export function countComponents(
  mask            ,
  width        ,
  height        ,
)         {
  const seen = new Uint8Array(mask.length);
  const stack           = [];
  let count = 0;
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || seen[start]) continue;
    count++;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop() ;
      const x = i % width;
      const y = (i / width) | 0;
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (mask[ni] === 1 && !seen[ni]) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }
  return count;
}
