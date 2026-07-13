# Cartogenesis

**A deterministic, dependency-free world generation engine — geography, language,
history, and the telling of it.**

Cartogenesis turns a single seed into a whole world, and then tells you about it
in that world's own voice. From one string you get:

- **Geography** — eroded terrain with volcanoes (calderas that cradle crater
  lakes, lava fields, island arcs), oceans, rivers, sixteen biomes, and real
  16-bit heightmaps you can drop into Blender or a game engine.
- **Language** — each culture has a lexicon of word-roots coined in its own
  phonology, so every name on the map is a compound you can translate:
  *Deoliria* is "the sea haven", and it sits on a harbour. The gazetteer prints
  each culture's glossary; learn a dozen roots and you can read every world this
  engine will ever generate.
- **History** — a dynamic simulation runs the world forward for a thousand
  years: wars, famines, revolts, golden ages; realms rise and fall; cities are
  founded, sacked, and abandoned into ruins; conquerors hold foreign lands long
  enough that the *names themselves* change, the old land-word kept under a new
  ruler's tongue — the way *Istanbul* wore down from a Greek name.
- **The telling** — an in-world chronicler narrates those centuries as chaptered
  prose ("III. The Age of Blood and Banners, 500–700"); each culture keeps a
  founding saga in verse that pointedly refuses conquest's renamings; and a
  named traveller walks the real road network and reports every league of it —
  fords counted, ruins passed, bread bought in both names of a renamed town.

Same seed, same world, **to the bit, on any machine**: the engine computes with
exactly-specified arithmetic only (`+ − × ÷ √`), so no JavaScript engine's
rounding can reroute a war. Zero runtime dependencies. No build step. Everything
below runs on stock Node ≥ 22.6.

![A generated island world](docs/samples/cartogenesis.map.png)

> *The canonical world, seed `cartogenesis`.*

---

## Try it in your browser

**[The live generator](https://anduinmooney.github.io/cartogenesis/app/)** runs
the entire engine client-side — nothing is sent anywhere. Type any seed, then:

- Pan, zoom, and **hover anything** — towns, provinces, deposits — for details;
  every name in the gazetteer and chronicle has a tooltip (rulers, realms,
  faiths, gods, even the former names of renamed towns), and clicking flies the
  map there.
- **Scrub through history** on the Powers layer and watch borders shift and
  cities rise and fall across a millennium. Click a chronicle entry to drop a
  pin where it happened.
- Open the **📖 Gazetteer** — the full written dossier, chronicle and sagas and
  traveller's account included — or download the map (PNG), a labeled poster
  (SVG), the report (Markdown), or a 16-bit heightmap, all built in-browser.

The **[sample atlas](https://anduinmooney.github.io/cartogenesis/)** shows six
committed worlds with all their layers, posters, and gazetteers.

## Quick start

Requires **Node.js ≥ 22.6** (native TypeScript execution). No install step.

```bash
# Generate a world (writes 10 artifacts to ./output)
node src/cli.ts generate --seed "my-world"

# Options
node src/cli.ts generate \
  --seed "atlas" \
  --width 512 --height 512 \
  --sea-level 0.42 \
  --out output

# Run the test suite (211 tests, all offline, all deterministic)
npm test

# Rebuild the sample gallery / the browser bundle / serve docs locally
node scripts/make-samples.ts
node scripts/build-web.ts
node scripts/serve-docs.ts
```

Each `generate` run writes:

| File | Contents |
|------|----------|
| `<name>.map.png` | Terrain map: hypsometric + rivers + roads + settlements |
| `<name>.biome.png` | Biome atlas (16 biomes + lava fields) with rivers |
| `<name>.political.png` | Political map: provinces + roads + settlements |
| `<name>.topo.png` | Topographic contour map (volcanoes read as rings) |
| `<name>.height.png` | 8-bit grayscale relief preview |
| `<name>.heightmap16.png` | **Real 16-bit heightmap** for Blender/Unity/Godot |
| `<name>.heightmap.r16` | Raw little-endian 16-bit heightmap |
| `<name>.poster.svg` | Labeled poster: named regions, cities, and features |
| `<name>.report.md` | The gazetteer — see below |
| `<name>.json` | World metadata, including determinism fingerprints |

## The gazetteer

The Markdown report is the world's book, and most of the engine exists to fill
it: an overview; volcanoes (which caldera holds a crater lake, which chain is an
island arc); every region with the literal meaning of its name; ruling houses
with thousand-year king-lists and the one reigning monarch; settlements with
their markets, founding years, and former names; the ruins history swallowed;
the names remade by conquest; each culture's full glossary; **the Chronicle**,
told in chapters by an in-world hand, with the raw dated Annals behind it; **a
founding saga per culture**, in verse; and **a traveller's account** of walking
the roads in the present year.

Three laws govern all generated prose, each enforced by a test: it is *strictly
downstream* (telling the story can never change it — the simulation fingerprint
is byte-identical with the narrator on or off), *total* (every event is
narrated; a chronicle that skips the famine is propaganda), and *grounded*
(every name is a real name from the world; the teller invents phrasing, never
facts).

> **On accuracy:** the terrain is *procedurally plausible* — fractal noise,
> hydraulic erosion, procedural volcanism — not a geological simulation. The
> 16-bit heightmaps are real, importable files (scale height to
> `maxAltitudeMetres`), but the landforms are invented, not Earth data.

## Determinism, taken seriously

"Same seed, same world" is usually true only per JavaScript engine build:
`Math.pow`, `Math.hypot`, and the trig functions are *implementation-
approximated* by the spec, and world generation is chaotic in the last bit — a
one-ulp difference in one erosion droplet reroutes a war centuries later (we
measured it: swapping `Math.hypot(x,y)` for the mathematically identical
`Math.sqrt(x*x+y*y)` changed which cities lay in ruins). So the engine uses only
exactly-specified operations, via `src/exact.ts`, and a lint-style test fails
the build if approximated math ever reappears. Three pinned fingerprints guard
it: a bit-exact hash of the terrain, a quantized one, and a fingerprint of the
simulation's actual history. CI runs on a different Node build than development
— passing there is the proof, not a hope.

## Architecture

A pipeline of small, single-purpose modules; each draws randomness from its own
named sub-stream keyed by `(seed, name)`, so adding a subsystem never perturbs
the ones before it. See [`ARCHITECTURE.md`](ARCHITECTURE.md).

```
seed ─► Rng ─► named sub-streams ─► L1…L17 ─► World ─► render / report / app
```

| Module | Responsibility |
|--------|----------------|
| `src/rng.ts` · `src/exact.ts` | Deterministic PRNG · exactly-specified arithmetic |
| `src/noise.ts` · `src/grid.ts` | Value noise, fBm · shared 2D field type |
| `src/terrain.ts` · `src/erosion.ts` | Elevation (L1) · hydraulic erosion (L1.5) |
| `src/volcanoes.ts` | Cones, calderas, crater lakes, lava, arcs (L1.6) |
| `src/hydrology.ts` · `src/climate.ts` | Oceans/lakes/coasts (L2) · temp + rain (L3–4) |
| `src/rivers.ts` · `src/biomes.ts` | Drainage + rivers (L5) · biomes (L6) |
| `src/regions.ts` · `src/settlements.ts` | Named provinces (L7) · towns + capital (L9) |
| `src/language.ts` · `src/names.ts` | Lexicons, glosses, layered renaming (L8/8.5) |
| `src/roads.ts` · `src/history.ts` | Road MST (L10) · founding legends (L11) |
| `src/lore.ts` · `src/resources.ts` | Houses, rulers, figures (L12) · deposits (L13) |
| `src/economy.ts` · `src/religion.ts` | Wealth + trade (L14) · faiths + myths (L15) |
| `src/simulation.ts` | Dynamic history — the world run forward (L16) |
| `src/narrative.ts` · `src/saga.ts` · `src/journey.ts` | The chronicle, the sagas, the traveller (L17) |
| `src/render.ts` · `src/png.ts` · `src/svgmap.ts` | Layers → RGBA · PNG encoder · SVG poster |
| `src/report.ts` · `src/world.ts` · `src/cli.ts` | Gazetteer · orchestration + fingerprints · CLI |

## Project continuity

This repository is built to be picked up and continued across many independent
sessions — 21 so far. The source of truth lives in five files:

- **[`PROJECT_STATE.md`](PROJECT_STATE.md)** — current status at a glance.
- **[`ROADMAP.md`](ROADMAP.md)** — where this is going.
- **[`DECISIONS.md`](DECISIONS.md)** — major decisions and their reasoning.
- **[`CHANGELOG.md`](CHANGELOG.md)** — what each session produced.
- **[`NEXT_SESSION.md`](NEXT_SESSION.md)** — the exact next task to pick up.

## License

MIT — see [`LICENSE`](LICENSE).
