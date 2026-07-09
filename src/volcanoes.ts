// volcanoes.ts — L1.6: volcanoes.
//
// Builds real volcanic landforms onto the elevation field: steep-sided
// stratovolcanoes with summit craters, broad gentle shield volcanoes, and small
// cinder cones. Runs AFTER base elevation but BEFORE hydraulic erosion, so the
// erosion pass then carves radial gullies down their flanks the way it does on
// a real eroded volcano. Each volcano is placed, sized, and named
// deterministically (a `volcanoes` stream) and carries an active/dormant/extinct
// status the history layer can pick up.

import { Grid } from "./grid.ts";
import { Rng } from "./rng.ts";
import { makeName, languageById } from "./names.ts";

export type VolcanoType = "stratovolcano" | "shield" | "cinder cone";
export type VolcanoStatus = "active" | "dormant" | "extinct";

export interface Volcano {
  x: number;
  y: number;
  radius: number;
  type: VolcanoType;
  name: string;
  status: VolcanoStatus;
  /** Summit (crater-rim) elevation as a [0,1] field value after building. */
  summit: number;
}

export interface VolcanoConfig {
  seed: number;
  seaLevel: number;
  /** Override the automatic count. */
  count?: number;
  /** Language for names (defaults vary; a coherent culture can be passed in). */
  languageId?: string;
}

interface Shape {
  radiusBase: number;
  amp: number;
  craterFrac: number;
  craterDepthFrac: number;
  flankExp: number;
}

const SHAPES: Record<VolcanoType, Shape> = {
  // Tall, steep cone, small deep crater.
  stratovolcano: { radiusBase: 24, amp: 0.5, craterFrac: 0.16, craterDepthFrac: 0.38, flankExp: 1.7 },
  // Broad, gentle dome, shallow wide crater.
  shield: { radiusBase: 42, amp: 0.34, craterFrac: 0.1, craterDepthFrac: 0.16, flankExp: 1.05 },
  // Small, steep, big relative crater.
  "cinder cone": { radiusBase: 11, amp: 0.22, craterFrac: 0.34, craterDepthFrac: 0.55, flankExp: 1.5 },
};

function pickType(rng: Rng): VolcanoType {
  const r = rng.next();
  if (r < 0.5) return "stratovolcano";
  if (r < 0.8) return "shield";
  return "cinder cone";
}

function pickStatus(rng: Rng): VolcanoStatus {
  const r = rng.next();
  return r < 0.3 ? "active" : r < 0.7 ? "dormant" : "extinct";
}

/**
 * Build volcanoes onto a copy of `elevation`. Returns the new elevation Grid
 * (values clamped to [0,1]) and the list of volcanoes. Deterministic.
 */
export function addVolcanoes(
  elevation: Grid,
  cfg: VolcanoConfig,
): { elevation: Grid; volcanoes: Volcano[] } {
  const { width, height } = elevation;
  const out = elevation.clone();
  const data = out.data;
  const rng = new Rng(cfg.seed);
  const scale = width / 384;

  const land: number[] = [];
  for (let i = 0; i < data.length; i++) if (data[i] >= cfg.seaLevel) land.push(i);
  if (land.length === 0) return { elevation: out, volcanoes: [] };

  const count =
    cfg.count ??
    Math.max(1, Math.min(9, Math.round(land.length / 9000) + rng.int(0, 3)));

  const lang = languageById(cfg.languageId ?? "auld");
  const placed: Volcano[] = [];
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
    const craterR = radius * shape.craterFrac;
    const craterDepth = amp * shape.craterDepthFrac;

    // Build the cone: rise from 0 at the outer radius to `amp` at the crater
    // rim, then descend into the crater toward the center.
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(height - 1, Math.ceil(cy + radius));
    let summit = data[cy * width + cx];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r >= radius) continue;
        let add: number;
        if (r >= craterR) {
          const t = (radius - r) / (radius - craterR); // 0 at rim-outer → 1 at crater rim
          add = amp * Math.pow(t, shape.flankExp);
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

    placed.push({
      x: cx,
      y: cy,
      radius,
      type,
      name: makeName(lang, new Rng(`${cfg.seed}:volcano:${placed.length}`)),
      status: pickStatus(rng),
      summit,
    });
  }

  return { elevation: out, volcanoes: placed };
}
