# Architecture

This document explains how Cartogenesis is put together and, more importantly,
**how to extend it** without breaking determinism. Read this before adding a new
generation subsystem.

## The core idea: a layered, deterministic pipeline

A `World` is built by running a sequence of subsystems, each of which reads the
layers already produced and writes one or more new layers. Everything is a pure
function of the seed and config.

```
WorldConfig ─► generateWorld()
                 │
                 ├─ root Rng (from seed)
                 │     ├ .stream("terrain")  ─► generateElevation()   ─► elevation   ✅ L1
                 │     ├ .stream("hydrology")─► analyzeWater()         ─► water       ✅ L2
                 │     ├ .stream("climate")  ─► generateTemperature() ─► temperature ✅ L3
                 │     │                      └► generateMoisture()   ─► moisture    ✅ L4
                 │     ├ .stream("rivers")   ─► generateRivers()      ─► rivers      ✅ L5
                 │     ├ .stream("biomes")   ─► classifyBiomes()      ─► biomes      ✅ L6
                 │     ├ .stream("regions")  ─► (next) region partition            🔜 L7
                 │     └ .stream("history")  ─► (future) settlements, events        ⬜
                 │
                 └─ World { meta, elevation, water, temperature, moisture, rivers, biomes }
```

## Determinism rules (do not violate)

1. **All randomness comes from an `Rng`.** Never call `Math.random()`. Never use
   wall-clock time, iteration order over unordered collections, or environment
   state in generation code.

2. **Each subsystem gets its own named stream** via `root.stream("name")`.
   Streams are keyed by `(worldSeed, name)` only — *not* by how many numbers
   other streams have drawn. This is what makes subsystems order-independent:
   adding `stream("rivers")` cannot change what `stream("terrain")` produces.

3. **Only integer-safe math in the hot path.** The PRNG and noise hashes use
   `Math.imul` and bit ops that are identical across platforms. Avoid relying on
   the exact last-bit behavior of transcendental functions where you can; when
   you must, cover it with a golden test.

4. **Every new subsystem needs a determinism test.** At minimum: "same seed →
   identical output." Prefer also a golden content-hash so silent algorithm
   drift is caught. See `tests/world.test.ts` for the pattern.

## Modules

### `rng.ts`
- `hashString(str, salt)` — stable 32-bit string hash; the seed derivation primitive.
- `Rng` — mulberry32 stream with `next/float/int/bool/pick/shuffle/gaussian`.
- `Rng.stream(name)` — derive an independent child stream. **The extension point.**

### `noise.ts`
- `valueNoise2D(x, y, seed)` — smooth lattice noise in [0,1).
- `fbm2D(x, y, opts)` — fractal Brownian motion (summed octaves).
- `ridge2D(x, y, opts)` — ridged multifractal for sharp mountain spines.

### `grid.ts`
- `Grid` — the universal 2D scalar field (`Float64Array` + width/height).
  Every spatial layer is a `Grid`, so renderers and analyzers are layer-agnostic.

### `terrain.ts` (L1)
- `generateElevation(cfg)` — fBm + ridged noise, optional radial "continent
  mask", normalized to [0,1].
- `landFraction(grid, seaLevel)` — a quick sanity metric.

### `hydrology.ts` (L2)
- `analyzeWater(elevation, seaLevel)` — flood-fills connected ocean vs. enclosed
  lakes, extracts coastline, and computes a distance-to-ocean field via
  multi-source BFS. `countComponents` labels connected blobs.

### `climate.ts` (L3, L4)
- `generateTemperature(elevation, water, cfg)` — latitude + elevation lapse +
  maritime moderation + noise.
- `generateMoisture(elevation, temperature, water, cfg)` — prevailing-wind rain
  shadow blended with maritime proximity.

### `rivers.ts` (L5)
- `generateRivers(elevation, water, moisture, cfg)` — Priority-Flood+ε builds a
  drainage tree (every land cell drains to the sea); flow accumulation of
  rainfall carves rivers. Contains an inline binary min-heap.

### `biomes.ts` (L6)
- `classifyBiomes(...)` / `classifyCell(...)` — Whittaker temperature × moisture
  matrix + alpine/snow elevation overrides. `Biome` is a **const object, not an
  enum** (Node strip-only mode — see D-006). `BIOME_NAMES`, `BIOME_COLORS`.

### `render.ts`
- `renderGrayscale`, `renderHypsometric` (ocean/lake/hillshade),
  `renderScalarField` / `renderTemperature` / `renderMoisture`, `renderBiomes`,
  and `overlayRivers` (in-place river overlay, width by log-flow).

### `png.ts`
- `encodePNG(w, h, rgba)` — minimal PNG writer (zlib for DEFLATE, hand-rolled
  CRC-32 and chunk framing). No image dependencies.

### `world.ts`
- `generateWorld(config)` — orchestrates subsystems, assembles `World`, computes
  `meta` including the `contentHash` fingerprint.
- `hashGrid(grid)` — quantized SHA-256 fingerprint of a field.

### `cli.ts`
- Argument parsing and the `generate` command.

## How to add a subsystem (worked recipe)

Say you're adding **temperature**:

1. Create `src/climate.ts` exporting `generateTemperature(elevation, cfg): Grid`.
   - It may read `elevation` (higher = colder) and latitude (`y / height`).
   - Draw any randomness from a passed-in seed derived from a named stream.
2. In `world.ts`, add `const climateRng = root.stream("climate");` and call your
   function; attach the result to the `World` object and (optionally) `meta`.
3. Add a renderer if it should be visualizable (e.g. a blue→red ramp).
4. Add `tests/climate.test.ts`: determinism + a plausibility invariant
   (e.g. "poles are colder than the equator on average").
5. Update `ROADMAP.md`, `CHANGELOG.md`, `PROJECT_STATE.md`, and if the change
   alters existing output, bump the golden hash in `tests/world.test.ts` and
   record why in `DECISIONS.md`.

## Non-goals (for now)

- Real-time / interactive generation in the browser (the engine is Node-first;
  a browser port is a roadmap item, not a constraint on the core).
- Physically accurate simulation. We favor *plausible and pretty* over correct.
- Third-party libraries. Zero-dependency is a feature, not an accident.
