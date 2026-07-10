// volcanoes.ts — L1.6: volcanoes.
//
// Builds real volcanic landforms onto the elevation field: steep-sided
// stratovolcanoes with summit craters, broad gentle shield volcanoes, and small
// cinder cones. Runs AFTER base elevation but BEFORE hydraulic erosion, so the
// erosion pass then carves radial gullies down their flanks the way it does on
// a real eroded volcano. Each volcano is placed, sized, and named
// deterministically (a `volcanoes` stream) and carries an active/dormant/extinct
// status the history layer can pick up.

import { Grid } from "./grid.js";
import { dist, powExact } from "./exact.js";
import { Rng } from "./rng.js";
import { languageById } from "./names.js";
import { composeName } from "./language.js";
import { countComponents,                 } from "./hydrology.js";
import { Biome,                 } from "./biomes.js";

                                                                     
                                                             

                          
            
            
                 
                    
               
                                                             
                
                        
                                                                             
                 
     
                                                                             
                                                                                
                                                                               
                           
     
                                                      
 

                                
               
                   
                                      
                 
                                                                                 
                      
 

                 
                     
              
                     
                          
                                                                             
                   
 

const SHAPES                             = {
  // Tall, steep cone, small deep crater.
  stratovolcano: { radiusBase: 24, amp: 0.5, craterFrac: 0.16, craterDepthFrac: 0.38, flankExp: 1.75 },
  // Broad, gentle dome, shallow wide crater.
  shield: { radiusBase: 42, amp: 0.34, craterFrac: 0.1, craterDepthFrac: 0.16, flankExp: 1.0 },
  // Small, steep, big relative crater.
  "cinder cone": { radiusBase: 11, amp: 0.22, craterFrac: 0.34, craterDepthFrac: 0.55, flankExp: 1.5 },
};

function pickType(rng     )              {
  const r = rng.next();
  if (r < 0.5) return "stratovolcano";
  if (r < 0.8) return "shield";
  return "cinder cone";
}

function pickStatus(rng     )                {
  const r = rng.next();
  return r < 0.3 ? "active" : r < 0.7 ? "dormant" : "extinct";
}

/**
 * Build volcanoes onto a copy of `elevation`. Returns the new elevation Grid
 * (values clamped to [0,1]) and the list of volcanoes. Deterministic.
 */
export function addVolcanoes(
  elevation      ,
  cfg               ,
)                                            {
  const { width, height } = elevation;
  const out = elevation.clone();
  const data = out.data;
  const rng = new Rng(cfg.seed);
  const scale = width / 384;

  const land           = [];
  for (let i = 0; i < data.length; i++) if (data[i] >= cfg.seaLevel) land.push(i);
  if (land.length === 0) return { elevation: out, volcanoes: [] };

  const count =
    cfg.count ??
    Math.max(1, Math.min(9, Math.round(land.length / 9000) + rng.int(0, 3)));

  const lang = languageById(cfg.languageId ?? "auld");
  const placed            = [];
  // Volcano names come from a narrow template (fire/ash/dread × mountain/stone),
  // so without an avoid-set a world happily ends up with three Mt. Brogravras.
  const usedNames = new Set        ();
  let attempts = 0;
  const maxAttempts = count * 300;

  while (placed.length < count && attempts < maxAttempts) {
    attempts++;
    const c = land[rng.int(0, land.length)];
    const cx = c % width;
    const cy = (c / width) | 0;
    const type = pickType(rng);
    const shape = SHAPES[type];
    const radius = shape.radiusBase * scale * (0.8 + rng.next() * 0.5);

    // Keep volcanoes clear of the map edge and of each other.
    if (cx < radius || cy < radius || cx > width - radius || cy > height - radius) continue;
    let clear = true;
    for (const v of placed) {
      const dx = v.x - cx;
      const dy = v.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < (v.radius + radius) * 0.85) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;

    const amp = shape.amp * (0.85 + rng.next() * 0.3);

    // A big stratovolcano or shield may have blown its top: instead of a peaked
    // summit it gets a wide, flat-floored caldera ringed by a steep rim. Cinder
    // cones are too small; a caldera needs room.
    const calderaEligible = type !== "cinder cone" && radius >= 20 * scale;
    const isCaldera = calderaEligible && rng.next() < 0.5;

    const baseCenter = data[cy * width + cx];
    let caldera                                                       ;

    // Geometry shared by both profiles.
    const craterR = radius * shape.craterFrac;
    const craterDepth = amp * shape.craterDepthFrac;
    // Caldera: rim about halfway out, a flat floor sitting low, a steep wall.
    const rimRadius = radius * (0.5 + rng.next() * 0.12);
    const floorRadius = rimRadius * 0.72;
    const floorAdd = amp * (0.26 + rng.next() * 0.12); // floor height above base
    const smoothstep = (u        ) => u * u * (3 - 2 * u);

    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(height - 1, Math.ceil(cy + radius));
    let summit = baseCenter;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r >= radius) continue;
        let add        ;
        if (isCaldera) {
          if (r >= rimRadius) {
            const t = (radius - r) / (radius - rimRadius); // 0 outer → 1 at rim
            add = amp * powExact(t, shape.flankExp);
          } else if (r >= floorRadius) {
            const u = (r - floorRadius) / (rimRadius - floorRadius); // floor→rim
            add = floorAdd + (amp - floorAdd) * smoothstep(u);
          } else {
            add = floorAdd; // flat caldera floor
          }
        } else if (r >= craterR) {
          const t = (radius - r) / (radius - craterR); // 0 at rim-outer → 1 at crater rim
          add = amp * powExact(t, shape.flankExp);
        } else {
          const t = r / craterR; // 0 center → 1 crater rim
          add = amp - craterDepth * (1 - t * t);
        }
        const i = y * width + x;
        const v = Math.max(0, Math.min(1, data[i] + add));
        data[i] = v;
        if (v > summit) summit = v;
      }
    }

    if (isCaldera) {
      const floorAbs = Math.min(1, baseCenter + floorAdd);
      const rimAbs = Math.min(1, baseCenter + amp);
      // Most calderas above the sea hold a lake — the payoff. A few stay dry
      // (arid, or drained through a breached rim).
      const holdsLake = floorAbs >= cfg.seaLevel && rng.next() < 0.68;
      const lakeLevel = holdsLake
        ? floorAbs + (rimAbs - floorAbs) * (0.4 + rng.next() * 0.25)
        : undefined;
      caldera = { rimRadius, lakeLevel };
    }

    placed.push({
      x: cx,
      y: cy,
      radius,
      type,
      ...(() => {
        const c = composeName(lang, new Rng(`${cfg.seed}:volcano:${placed.length}`), {
          kind: "volcano",
          avoid: usedNames,
        });
        return { name: c.name, gloss: c.gloss };
      })(),
      status: pickStatus(rng),
      summit,
      caldera,
    });
  }

  return { elevation: out, volcanoes: placed };
}

/**
 * Fill crater lakes into a WaterLayer, in place. A caldera that holds water
 * (its `lakeLevel` is set) turns every land cell inside its rim that lies below
 * that level into a lake, so hydrology, biomes, and rendering all agree the
 * floor is water.
 *
 * Runs AFTER erosion and `analyzeWater` — the caldera floor is only final once
 * erosion has touched it, and a crater lake sits above sea level, so the
 * ocean/inland-basin flood fill would never have found it. Updates `lakeCount`
 * and `lakeFraction`; leaves `distToOcean` (crater lakes are tiny and high, and
 * that field measures ocean, not fresh water).
 */
export function fillCraterLakes(
  elevation      ,
  water            ,
  volcanoes           ,
  seaLevel        ,
)       {
  const { width, height, data } = elevation;
  const { lakeMask, oceanMask } = water;
  let added = 0;
  for (const v of volcanoes) {
    const level = v.caldera?.lakeLevel;
    if (level === undefined) continue;
    const rim = v.caldera .rimRadius;
    const rim2 = rim * rim;
    const R = Math.ceil(rim);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > rim2) continue;
        const x = v.x + dx;
        const y = v.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = y * width + x;
        if (
          data[i] >= seaLevel &&
          data[i] < level &&
          oceanMask[i] === 0 &&
          lakeMask[i] === 0
        ) {
          lakeMask[i] = 1;
          added++;
        }
      }
    }
  }
  if (added > 0) {
    water.lakeCount = countComponents(lakeMask, width, height);
    let lakeCells = 0;
    for (let i = 0; i < lakeMask.length; i++) if (lakeMask[i]) lakeCells++;
    water.lakeFraction = lakeCells / lakeMask.length;
  }
}

const NEIGHBORS8                                  = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Paint lava fields into a BiomeLayer, in place. Each **active** volcano sends a
 * few flows down its flanks: starting on the rim, each flow walks steepest-
 * descent, marking cells `Biome.LavaField` until it reaches water, runs out of
 * downhill, or exhausts its length. Deterministic (a private `lava` stream keyed
 * by volcano index). Runs after biome classification; updates the layer's
 * counts, diversity, and dominant.
 */
export function traceLavaFields(
  elevation      ,
  water            ,
  biomes            ,
  volcanoes           ,
  seed        ,
)       {
  const { width, height, data } = elevation;
  const ids = biomes.ids;
  const isWater = (i        ) => water.oceanMask[i] === 1 || water.lakeMask[i] === 1;

  const paint = (i        ) => {
    if (ids[i] === Biome.LavaField || isWater(i)) return;
    biomes.counts[ids[i]] = (biomes.counts[ids[i]] ?? 1) - 1;
    ids[i] = Biome.LavaField;
    biomes.counts[Biome.LavaField] = (biomes.counts[Biome.LavaField] ?? 0) + 1;
  };

  // A point on the rim, chosen by rejection sampling a ring — no trig, so the
  // arithmetic stays exact-by-construction (D-022).
  const rimPoint = (rng     , startR        )                   => {
    for (let tries = 0; tries < 24; tries++) {
      const dx = rng.float(-startR, startR);
      const dy = rng.float(-startR, startR);
      const r = dist(dx, dy);
      if (r >= startR * 0.72 && r <= startR) return [Math.round(dx), Math.round(dy)];
    }
    return [Math.round(startR), 0];
  };

  for (let vi = 0; vi < volcanoes.length; vi++) {
    const v = volcanoes[vi];
    if (v.status !== "active") continue;
    const rng = new Rng(`${seed}:lava:${vi}`);
    const startR = v.caldera ? v.caldera.rimRadius : v.radius * 0.42;
    const flows = 2 + rng.int(0, 4); // 2..5
    const maxSteps = Math.round(v.radius * 2.2);

    for (let f = 0; f < flows; f++) {
      const [odx, ody] = rimPoint(rng, startR);
      let x = v.x + odx;
      let y = v.y + ody;
      for (let step = 0; step < maxSteps; step++) {
        if (x < 0 || y < 0 || x >= width || y >= height) break;
        const i = y * width + x;
        if (isWater(i)) break;
        paint(i);
        // Steepest descent to the lowest 8-neighbour.
        let bx = x;
        let by = y;
        let lowest = data[i];
        for (const [dx, dy] of NEIGHBORS8) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const e = data[ny * width + nx];
          if (e < lowest) {
            lowest = e;
            bx = nx;
            by = ny;
          }
        }
        if (bx === x && by === y) break; // a local pit: the flow pools and stops
        x = bx;
        y = by;
      }
    }
  }

  biomes.diversity = Object.keys(biomes.counts).filter(
    (k) => (biomes.counts[Number(k)] ?? 0) > 0,
  ).length;
  let dominant = biomes.dominant;
  let best = -1;
  for (const key of Object.keys(biomes.counts)) {
    const id = Number(key);
    if (id === Biome.Ocean || id === Biome.Lake) continue;
    if ((biomes.counts[id] ?? 0) > best) {
      best = biomes.counts[id];
      dominant = id         ;
    }
  }
  biomes.dominant = dominant;
}
