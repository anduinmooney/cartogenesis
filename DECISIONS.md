# Decisions

A running log of consequential decisions and the reasoning behind them. Newest
first. When a decision is later reversed, add a new entry rather than editing the
old one — the history is the point.

---

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
