// rivers.ts — L5: drainage networks and rivers.
//
// Uses Priority-Flood+ε (Barnes, Lehman & Mulla 2014) to fill depressions and
// simultaneously build a drainage tree: cells are visited from the ocean upward
// in order of increasing elevation, and each newly reached cell drains to the
// cell it was reached from. Adding a tiny epsilon to filled elevations
// guarantees a strictly downhill path to the sea with no flat spots — so the
// drainage tree is well-defined without a separate flat-resolution pass.
//
// Then flow accumulation sums each cell's rainfall (moisture) downstream; cells
// whose accumulated upstream drainage exceeds a threshold become rivers.

import { Grid } from "./grid.js";
                                                 

                             
                                                                 
                  
                                           
                        
                                                                            
                     
                                                 
                        
                                                                        
                  
 

                              
                                                                 
                          
                                                                
                   
 

const N8                                  = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function generateRivers(
  elevation      ,
  water            ,
  moisture      ,
  cfg              = {},
)             {
  const { width, height, data } = elevation;
  const n = width * height;
  const epsilon = cfg.epsilon ?? 1e-5;
  const riverThreshold = cfg.riverThreshold ?? 40;

  const filled = new Float64Array(n);
  const closed = new Uint8Array(n);
  const flowTo = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  let orderCount = 0;

  const isWater = (i        ) =>
    water.oceanMask[i] === 1 || water.lakeMask[i] === 1;

  // --- Binary min-heap keyed by filled elevation ---
  const heapP           = [];
  const heapI           = [];
  const swap = (a        , b        ) => {
    const p = heapP[a];
    heapP[a] = heapP[b];
    heapP[b] = p;
    const i = heapI[a];
    heapI[a] = heapI[b];
    heapI[b] = i;
  };
  const push = (p        , i        ) => {
    heapP.push(p);
    heapI.push(i);
    let c = heapP.length - 1;
    while (c > 0) {
      const parent = (c - 1) >> 1;
      if (heapP[parent] <= heapP[c]) break;
      swap(parent, c);
      c = parent;
    }
  };
  const pop = ()         => {
    const topI = heapI[0];
    const lastP = heapP.pop() ;
    const lastI = heapI.pop() ;
    if (heapP.length > 0) {
      heapP[0] = lastP;
      heapI[0] = lastI;
      let c = 0;
      const len = heapP.length;
      for (;;) {
        const l = 2 * c + 1;
        const r = 2 * c + 2;
        let s = c;
        if (l < len && heapP[l] < heapP[s]) s = l;
        if (r < len && heapP[r] < heapP[s]) s = r;
        if (s === c) break;
        swap(s, c);
        c = s;
      }
    }
    return topI;
  };

  // Seed outlets: all water cells and all border cells drain out of the world.
  const seed = (i        ) => {
    if (closed[i]) return;
    closed[i] = 1;
    filled[i] = data[i];
    push(filled[i], i);
  };
  for (let i = 0; i < n; i++) {
    if (isWater(i)) seed(i);
  }
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  // Priority flood: pop lowest, relax neighbors, record drainage parent.
  while (heapI.length > 0) {
    const i = pop();
    order[orderCount++] = i;
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      closed[ni] = 1;
      filled[ni] = Math.max(data[ni], filled[i] + epsilon);
      flowTo[ni] = i;
      push(filled[ni], ni);
    }
  }

  // Flow accumulation: each land cell starts with its rainfall, then we push
  // water downstream by walking cells from highest to lowest (reverse of the
  // order they drained), so every cell is summed before its downstream target.
  const accum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    accum[i] = isWater(i) ? 0 : 0.1 + moisture.data[i];
  }
  for (let k = orderCount - 1; k >= 0; k--) {
    const i = order[k];
    if (isWater(i)) continue;
    const t = flowTo[i];
    if (t >= 0) accum[t] += accum[i];
  }

  // River mask + stats.
  const riverMask = new Uint8Array(n);
  let riverCells = 0;
  let maxFlow = 0;
  for (let i = 0; i < n; i++) {
    if (accum[i] > maxFlow) maxFlow = accum[i];
    if (!isWater(i) && accum[i] >= riverThreshold) {
      riverMask[i] = 1;
      riverCells++;
    }
  }

  const flowAccum = new Grid(width, height);
  flowAccum.data.set(accum);

  return {
    flowAccum,
    riverMask,
    flowTo,
    riverFraction: riverCells / n,
    maxFlow,
  };
}
