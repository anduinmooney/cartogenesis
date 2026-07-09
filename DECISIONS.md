# Decisions

A running log of consequential decisions and the reasoning behind them. Newest
first. When a decision is later reversed, add a new entry rather than editing the
old one — the history is the point.

---

## D-016 — Simulation seeds petty realms from cities AND towns (2026-07-09, Session 8)
**Decision:** The dynamic-history simulation starts one realm per region holding
a city *or* town (not just the cities that seat `history.realms`), then lets them
consolidate through war.
**Why:** `history.realms` has one realm per city, and small/medium worlds often
have a single city — a lone empire with no neighbours means no wars, no emergence
(the first draft produced only plagues and golden ages). Seeding many petty
realms guarantees rival polities on essentially every world, so conquest, falls,
and breakaways actually happen and the chronicle becomes a real story of
consolidation. City-seated realms keep their `history` names for continuity;
town-seated ones get generated names. The simulation is downstream of geography,
so this never affects the elevation golden hash.

## D-015 — Web Worker: pre-render + structured-clone the world (2026-07-09, Session 7)
**Decision:** The live app generates in a module worker (`web/worker.ts`) that
renders all layers to RGBA and posts back the layer buffers (transferred) plus
the entire `World` (structured-cloned). The main thread blits the pre-rendered
buffers and reads the cloned world for hover/click.
**Why:** Generation grew to ~2 s (erosion + a dozen layers), freezing the UI.
Moving it off-thread fixes that, and pre-rendering every layer makes layer
switching an instant blit instead of a re-render. Structured clone works because
the interaction code only reads *data* (typed arrays, plain objects) — it never
calls `Grid` methods — so the cloned world (methods lost) is sufficient. The
engine stays deterministic and **clock-free**: "Today's world" is seeded by the
UI computing the date and passing it in, never by the engine reading time.

## D-014 — Hydraulic erosion on by default (2026-07-09, Session 5)
**Decision:** A droplet-based hydraulic erosion pass (`src/erosion.ts`) runs
between elevation and hydrology by default (opt out with `erosion: false`). The
golden hash changed to **`fb232cd94fe0face`** (intentional — terrain output
changed; all samples + the web bundle were regenerated).
**Why:** Smooth fractal terrain lacks the dendritic valleys real landscapes have.
Eroding *before* hydrology means rivers then follow the carved valleys, so the
whole map reads as more coherent. It's deterministic (seeded droplets) and cheap
(~95 ms at 400²). Default-on because the improvement is worth the one-time golden
change; `erosion: false` remains for anyone who wants the raw fractal terrain.

## D-013 — Pure-JS content hash (drop node:crypto) (2026-07-08, Session 4)
**Decision:** `hashGrid` now uses a pure-JS quantized hash (`src/hash.ts`,
`hashQuantized`) instead of `node:crypto` SHA-256. The canonical golden hash
changed from `54146be48037737d` to **`1b8c816c890e866c`** (values differ; the
elevation field is byte-for-byte unchanged — only the hashing algorithm changed).
**Why:** `node:crypto` doesn't exist in browsers. A pure hash makes the entire
generation + metadata path universal (identical output in Node and the browser),
which P2 requires. The hash is a determinism fingerprint, not a signature, so a
non-cryptographic 2×32-bit fold is fine. This is an intentional golden-hash
change (the only kind allowed) — the test was updated in the same commit.

## D-012 — Zero-dependency browser build via Node type-stripping (2026-07-08, Session 4)
**Decision:** Build the browser bundle with Node's built-in
`module.stripTypeScriptTypes` (`scripts/build-web.ts`), NOT esbuild/tsc/webpack.
It emits browser-safe engine modules as plain ES modules under `docs/app/engine/`
plus `docs/app/app.js`, rewriting `.ts` import specifiers to `.js`. The output is
committed so GitHub Pages serves it with no build.
**Why:** NEXT_SESSION had planned esbuild as a dev-only dependency, but Node 24
can strip types natively — so we keep the project **truly zero-dependency**, even
build-time. Browsers can't run `.ts` (type-stripping is Node-only at runtime), so
a build step is unavoidable for the web target; using a Node builtin makes that
step dependency-free. `png.ts` (node:zlib), `svgmap.ts` (Buffer), `cli.ts`, and
`index.ts` are excluded from the browser graph; the browser draws to a Canvas via
`putImageData` instead of encoding PNGs. **Caveat:** committed `docs/app/*.js` are
build artifacts — rerun `npm run build:web` after changing any `src/` module.

## D-011 — SVG (not PNG) for labeled map posters (2026-07-08, Session 3)
**Decision:** Text-labeled maps are exported as SVG (`src/svgmap.ts`), embedding
a rendered PNG as a base64 data-URI background with vector `<text>` labels on top.
**Why:** Our PNG encoder has no font support, and hand-rasterizing a bitmap font
is a rat-hole. SVG gives crisp, scalable labels, stays a single self-contained
file (data-URI background = no external asset), renders in any browser, and is
trivially styleable (outlined text for legibility). PNG maps remain the base
render; SVG is the "poster" presentation layer over them.

## D-010 — Roads via territory-boundary Dijkstra + Kruskal MST (2026-07-08, Session 3)
**Decision:** Build the road network with ONE multi-source Dijkstra (all
settlements seeded at once) whose territory boundaries yield candidate edges,
then Kruskal's MST over those edges.
**Why:** The naïve approach (Dijkstra from every settlement to every other) is
N full-grid runs and O(N²) memory for predecessors. The single-pass territory
method finds all inter-settlement candidate routes in one Dijkstra; Kruskal then
yields a connected, cycle-free network. Settlements on separate landmasses simply
never meet → they form separate components (a forest), which is correct. Verified
by forest/no-cycle and ocean-avoidance tests.

## D-009 — Regions = spaced-seed BFS provinces (not river basins) (2026-07-08, Session 3)
**Decision:** Partition land into provinces by scattering well-spaced seed points
and growing them with a water-respecting multi-source BFS, plus a coverage pass
so unseeded islands become their own regions.
**Why:** River basins (an elegant alternative using `flowTo`) vary wildly in size
— a few huge basins and many slivers — which reads poorly as "provinces." Spaced
seeds give controllable, evenly-sized, contiguous regions that look like a
political map. Basins remain a good option for a future "watershed" view.
Trade-off: single-cell islets become 1-cell regions (noted as debt).

## D-008 — Fixed physical pipeline order (2026-07-08, Session 2)
**Decision:** Generation runs in strict physical-dependency order:
elevation → water → temperature → moisture → rivers → biomes. Each subsystem
reads finished layers and draws from its own named RNG stream.
**Why:** Later layers genuinely depend on earlier ones (rivers need moisture and
filled terrain; biomes need temperature × moisture). A fixed order keeps the
pipeline a clear DAG and makes adding L7+ a matter of appending a stage. Streams
stay named/independent so order changes among *independent* systems wouldn't
perturb output — but the physical order is the natural one.

## D-007 — Priority-Flood+ε for river drainage (2026-07-08, Session 2)
**Decision:** Rivers use Priority-Flood+ε (a min-heap flood from the ocean
upward) to fill depressions AND build the drainage tree in the same pass: each
cell drains to the cell it was reached from. A tiny ε on filled elevations
guarantees a strictly downhill path with no flats.
**Why:** Naïve D8 flow direction stalls in pits and flat filled regions, needing
a separate depression-fill and flat-resolution pass. Priority-Flood+ε solves
all three at once, is O(n log n), fully deterministic, and yields guaranteed
connected drainage to the sea — verified by a mass-conservation test (rain in =
flow out) and a no-cycles test. Alternative (iterative pit filling) is simpler
but slower and can leave flats.

## D-006 — No TypeScript `enum` (Node strip-only mode) (2026-07-08, Session 2)
**Decision:** Use `const` objects (`export const Biome = {...} as const`) plus a
derived value type instead of TS `enum`.
**Why:** Node's native TypeScript execution ("type stripping") is *strip-only* —
it removes type syntax but does not transform code. `enum` compiles to a runtime
object, so it's rejected with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Const objects
give the same ergonomics (`Biome.Ocean`, a union type) with zero codegen. This
constraint applies project-wide: **no enums, no namespaces, no parameter
properties, no decorators** — anything requiring emit is off-limits while we run
build-free on Node.

## D-005 — Sample gallery lives under `docs/` (2026-07-08, Session 1)
**Decision:** Committed sample PNGs and the viewer live in `docs/`; ad-hoc CLI
output goes to `output/` and is gitignored.
**Why:** GitHub Pages serves cleanly from `/docs`, making the gallery a
self-contained, publishable site with no build. Keeping regenerable scratch
output out of git avoids bloat while still committing a curated visible artifact.

## D-004 — Golden-hash determinism test (2026-07-08, Session 1)
**Decision:** A test asserts the content hash of a fixed canonical world
(`seed "cartogenesis"`, 256×256). Current value: `54146be48037737d`.
**Why:** Determinism is the core promise. A golden hash turns "the algorithm
silently changed" into a failing test. When a change *intentionally* alters
generation, we update the hash here and record why. **Any PR that changes the
golden hash must have a matching DECISIONS entry.**

## D-003 — Named RNG sub-streams keyed by (seed, name) (2026-07-08, Session 1)
**Decision:** Subsystems draw randomness from `root.stream(name)`, seeded from
`hashString(name, worldSeed)` — independent of draw order.
**Why:** This is the property that lets the project compound safely. Adding a new
subsystem in a future session must not change the output of existing ones. Order-
independent streams guarantee that; a single shared RNG would not.

## D-002 — Zero runtime dependencies; TypeScript run natively on Node (2026-07-08, Session 1)
**Decision:** No npm dependencies. Source is TypeScript executed directly by
Node ≥ 22.6 (type-stripping), tested with the built-in `node --test` runner.
**Why:** The host machine had **no Python** but **Node v24**. Node's native TS
support removes the build step, and a zero-dependency stance eliminates install
friction, supply-chain risk, and long-term bit-rot — critical for a project meant
to be picked up cold across many sessions. `node:zlib` and `node:crypto` (stdlib)
cover compression and hashing.

## D-001 — The project is a procedural world generator ("Cartogenesis") (2026-07-08, Session 1)
**Decision:** Build a deterministic procedural world-generation engine that turns
a seed into terrain, and over time into climate, rivers, biomes, and
civilizations, with a rendered map output and an explorable web gallery.
**Why:** It scores well on every constraint of this experiment:
- **Compounds cleanly** across sessions — a natural layered backlog (elevation →
  climate → hydrology → biomes → society) that never runs out of next steps.
- **Produces visible artifacts** every session (maps, worlds, a website).
- **Testable & deterministic**, so progress is verifiable, not vibes.
- **Self-contained & free** — no external services, credentials, or paid tools.
- **Creative + technical**, matching the "useful, strange, or artistic" latitude.
**Alternatives considered:** a grab-bag "standard library of algorithms" (weak
internal logic, felt like busywork); an evolving knowledge base (risk of "rewrite
docs forever"). The world generator has the strongest sense of accumulated
progress.

## D-000 — Stack selection driven by host environment (2026-07-08, Session 1)
**Decision:** Node.js + TypeScript, GitHub for hosting (repo + Pages).
**Why:** Environment probe found Node v24 + npm + authenticated `gh` CLI, no
Python/Go/Rust/Java/.NET. Node was the clear, zero-install path, and the
authenticated `gh` lets the project live on GitHub with no user effort.
