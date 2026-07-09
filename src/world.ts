// world.ts — Top-level world assembly and serialization.
//
// A World bundles all generated layers plus reproducible metadata. Generation
// is orchestrated here: each subsystem draws from its own named RNG stream so
// the pipeline stays deterministic and extensible (future subsystems — rivers,
// climate, biomes — slot in without disturbing existing output).

import { createHash } from "node:crypto";
import { Rng } from "./rng.ts";
import { Grid } from "./grid.ts";
import { generateElevation, landFraction } from "./terrain.ts";

export const ENGINE_VERSION = "0.1.0";

export interface WorldConfig {
  seed: number | string;
  width?: number;
  height?: number;
  seaLevel?: number;
  /** Passed through to terrain generation. */
  frequency?: number;
  octaves?: number;
  island?: boolean;
}

export interface WorldMeta {
  engineVersion: string;
  seed: number | string;
  width: number;
  height: number;
  seaLevel: number;
  landFraction: number;
  /** Content hash of the elevation field — a determinism fingerprint. */
  contentHash: string;
}

export interface World {
  meta: WorldMeta;
  elevation: Grid;
}

export function generateWorld(config: WorldConfig): World {
  const width = config.width ?? 512;
  const height = config.height ?? 512;
  const seaLevel = config.seaLevel ?? 0.42;

  const root = new Rng(config.seed);
  const terrainRng = root.stream("terrain");

  const elevation = generateElevation({
    width,
    height,
    seed: terrainRng.seed,
    frequency: config.frequency,
    octaves: config.octaves,
    island: config.island,
  });

  const meta: WorldMeta = {
    engineVersion: ENGINE_VERSION,
    seed: config.seed,
    width,
    height,
    seaLevel,
    landFraction: landFraction(elevation, seaLevel),
    contentHash: hashGrid(elevation),
  };

  return { meta, elevation };
}

/** Stable content hash of a Grid (quantized to survive trivial float noise). */
export function hashGrid(grid: Grid): string {
  const h = createHash("sha256");
  const buf = Buffer.alloc(grid.data.length * 2);
  for (let i = 0; i < grid.data.length; i++) {
    // Quantize to 16 bits — robust fingerprint, tolerant of ULP-level drift.
    buf.writeUInt16LE(Math.round(grid.data[i] * 65535) & 0xffff, i * 2);
  }
  h.update(buf);
  return h.digest("hex").slice(0, 16);
}

/** Serialize world metadata (not the heavy grids) to a JSON string. */
export function worldToJSON(world: World): string {
  return JSON.stringify(world.meta, null, 2);
}
