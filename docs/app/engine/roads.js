// roads.ts — L10: roads and trade routes between settlements.
//
// A single multi-source Dijkstra grows each settlement's "territory" outward at
// a cost that rises with slope and forbids the open ocean. Where two
// territories meet we record a candidate route whose cost is the summed travel
// distance; Kruskal's algorithm over those candidates builds a minimum spanning
// network connecting every settlement reachable overland. Each accepted route's
// path is reconstructed and drawn as a road.

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

                             
                     
                      
 

export function generateRoads(
  elevation      ,
  water            ,
  rivers            ,
  settlements              ,
  cfg             = {},
)            {
  const { width, height, data } = elevation;
  const n = width * height;
  const slopeCost = cfg.slopeCost ?? 40;
  const bridgeCost = cfg.bridgeCost ?? 8;

  const roadMask = new Uint8Array(n);
  if (settlements.length < 2) return { roadMask, edges: [], length: 0 };

  const dist = new Float64Array(n).fill(Infinity);
  const source = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);

  // --- Binary min-heap over cells keyed by dist ---
  const hp           = [];
  const hi           = [];
  const swap = (a        , b        ) => {
    const p = hp[a];
    hp[a] = hp[b];
    hp[b] = p;
    const i = hi[a];
    hi[a] = hi[b];
    hi[b] = i;
  };
  const push = (p        , i        ) => {
    hp.push(p);
    hi.push(i);
    let c = hp.length - 1;
    while (c > 0) {
      const par = (c - 1) >> 1;
      if (hp[par] <= hp[c]) break;
      swap(par, c);
      c = par;
    }
  };
  const pop = ()         => {
    const top = hi[0];
    const lp = hp.pop() ;
    const li = hi.pop() ;
    if (hp.length > 0) {
      hp[0] = lp;
      hi[0] = li;
      let c = 0;
      const len = hp.length;
      for (;;) {
        const l = 2 * c + 1;
        const r = 2 * c + 2;
        let s = c;
        if (l < len && hp[l] < hp[s]) s = l;
        if (r < len && hp[r] < hp[s]) s = r;
        if (s === c) break;
        swap(s, c);
        c = s;
      }
    }
    return top;
  };

  for (const st of settlements) {
    const i = st.y * width + st.x;
    dist[i] = 0;
    source[i] = st.id;
    push(0, i);
  }

  const passable = (i        ) => water.oceanMask[i] === 0;
  // Candidate edges between territories, keyed by "min-max" settlement pair.
  const cand = new Map                  ();

  while (hi.length > 0) {
    const i = pop();
    const di = dist[i];
    if (di > dist[i]) continue;
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!passable(ni)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      const step = diagonal ? 1.4142 : 1;
      const slope = Math.abs(data[ni] - data[i]) * slopeCost;
      const bridge =
        rivers.riverMask[ni] === 1 || water.lakeMask[ni] === 1 ? bridgeCost : 0;
      const w = step + slope + bridge;
      const nd = di + w;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        source[ni] = source[i];
        prev[ni] = i;
        push(nd, ni);
      } else if (source[ni] !== -1 && source[ni] !== source[i]) {
        // Two territories meet — candidate route through i–ni.
        const a = source[i];
        const b = source[ni];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        const cost = di + w + dist[ni];
        const existing = cand.get(key);
        if (!existing || cost < existing.cost) {
          cand.set(key, { a, b, cost, path: reconstruct(i, ni, prev) });
        }
      }
    }
  }

  // Kruskal's MST over candidate edges via union-find.
  const parent = new Int32Array(settlements.length);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (x        )         => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const edges             = [];
  const sorted = [...cand.values()].sort((p, q) => p.cost - q.cost);
  for (const e of sorted) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra === rb) continue;
    parent[ra] = rb;
    edges.push(e);
    for (const cell of e.path) roadMask[cell] = 1;
  }

  let length = 0;
  for (let i = 0; i < n; i++) if (roadMask[i]) length++;

  return { roadMask, edges, length };
}

/** Join the prev-chains of two meeting cells into one a→b path. */
function reconstruct(i        , ni        , prev            )           {
  const left           = [];
  let c = i;
  while (c !== -1) {
    left.push(c);
    c = prev[c];
  }
  const right           = [];
  c = ni;
  while (c !== -1) {
    right.push(c);
    c = prev[c];
  }
  // left is [i ... sourceA]; reverse to [sourceA ... i]; then append [ni ... sourceB].
  left.reverse();
  return left.concat(right);
}
