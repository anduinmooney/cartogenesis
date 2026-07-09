# Cartogenesis

**A deterministic, dependency-free procedural world generation engine.**

Cartogenesis turns a single seed into a whole world — **elevation, oceans and
lakes, temperature, rainfall, rivers, biomes, named provinces with distinct
cultures, cities and ports, a road network, a written history, and lore
(ruling houses, rulers, and notable figures)**. Same seed, same world, forever,
on any machine. It has **zero runtime dependencies** and
runs directly on modern Node.js with no build step. Each world exports labeled
map posters and a Markdown gazetteer.

![A generated island world](docs/samples/cartogenesis.map.png)

> *The canonical world, seed `cartogenesis`.*

---

## Why this project exists

This is a long-running, self-directed build. Each work session adds a real,
tested layer to a world simulation that compounds: elevation is the foundation,
and every later system (water flow, temperature, rainfall, ecosystems, cultures)
builds on the layers beneath it. The constraints are deliberate:

- **Deterministic.** A world is a pure function of its seed and config. This is
  enforced by a golden-hash test, so regressions in the generator are caught.
- **Zero dependencies.** No npm install, no supply chain, no bit-rot. If you have
  Node ≥ 22.6, you can run everything here.
- **Reproducible.** Named RNG sub-streams mean new subsystems can be added
  without changing the output of existing ones.

## Quick start

Requires **Node.js ≥ 22.6** (for native TypeScript execution). No install step.

```bash
# Generate a world (writes PNG maps + JSON metadata to ./output)
node src/cli.ts generate --seed "my-world"

# Options
node src/cli.ts generate \
  --seed "atlas" \
  --width 512 --height 512 \
  --sea-level 0.42 \
  --octaves 6 \
  --out output

# Run the test suite (34+ tests, all offline, all deterministic)
npm test

# Regenerate the sample gallery under docs/
node scripts/make-samples.ts
```

Each `generate` run writes three files:

| File | Contents |
|------|----------|
| `<name>.map.png` | Terrain map: hypsometric + rivers + roads + settlements |
| `<name>.biome.png` | Biome atlas (16 biomes) with rivers |
| `<name>.political.png` | Political map: provinces + roads + settlements |
| `<name>.height.png` | Raw grayscale elevation (heightmap) |
| `<name>.poster.svg` | Labeled poster: named regions, cities, and features |
| `<name>.report.md` | Gazetteer: overview, regions, settlements, chronicle |
| `<name>.json` | World metadata, including a determinism `contentHash` |

## The gallery & the live generator

- **Sample atlas** — `docs/index.html`: a static viewer for the committed sample
  worlds (six map layers each, plus a labeled poster and gazetteer).
- **Live generator** — `docs/app/`: type any seed and the *entire engine runs in
  your browser* (no server), drawing the world to a Canvas. Built with **zero
  dependencies** — `scripts/build-web.ts` type-strips `src/` to plain ES modules
  using Node's built-in `module.stripTypeScriptTypes` (rerun after editing `src/`
  via `npm run build:web`).

Both are served by **GitHub Pages** from `/docs`. Preview locally with
`node scripts/serve-docs.ts`.

## Architecture

The engine is a pipeline of small, single-purpose modules. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the full map. In short:

```
seed ──► Rng ──► named sub-streams ──► subsystems ──► World
                                        (terrain, …)     │
                                                         ├─► render ─► PNG
                                                         └─► metadata ─► JSON
```

| Module | Responsibility |
|--------|----------------|
| `src/rng.ts` | Deterministic PRNG + independent named streams |
| `src/noise.ts` | Value noise, fBm, ridged multifractal |
| `src/grid.ts` | Shared 2D scalar-field type |
| `src/terrain.ts` | Elevation generation (L1) |
| `src/hydrology.ts` | Oceans, lakes, coasts, distance-to-ocean (L2) |
| `src/climate.ts` | Temperature + moisture fields (L3, L4) |
| `src/rivers.ts` | Priority-Flood drainage + rivers (L5) |
| `src/biomes.ts` | Whittaker biome classification (L6) |
| `src/regions.ts` | Land partitioned into named provinces (L7) |
| `src/names.ts` | Procedural place-name languages (L8) |
| `src/settlements.ts` | Habitability → cities, ports, capital (L9) |
| `src/roads.ts` | Least-cost road network, Dijkstra + MST (L10) |
| `src/history.ts` | Realms, wars, disasters — a chronicle (L11) |
| `src/lore.ts` | Houses, rulers, figures, region prose (L12) |
| `src/render.ts` | Layers → RGBA (terrain, biome, political, climate, overlays) |
| `src/png.ts` | Dependency-free PNG encoder |
| `src/svgmap.ts` | Labeled SVG poster export |
| `src/report.ts` | Markdown gazetteer generator |
| `src/world.ts` | Orchestration, metadata, content hashing |
| `src/cli.ts` | Command-line interface |

## Project continuity

This repository is built to be picked up and continued across many independent
sessions. The source of truth for status lives in four files:

- **[`PROJECT_STATE.md`](PROJECT_STATE.md)** — current status at a glance.
- **[`ROADMAP.md`](ROADMAP.md)** — where this is going (1 day → 6 months).
- **[`DECISIONS.md`](DECISIONS.md)** — major decisions and their reasoning.
- **[`CHANGELOG.md`](CHANGELOG.md)** — what each session produced.
- **[`NEXT_SESSION.md`](NEXT_SESSION.md)** — the exact next task to pick up.

## License

MIT — see [`LICENSE`](LICENSE).
