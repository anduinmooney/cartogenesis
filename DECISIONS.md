# Decisions

A running log of consequential decisions and the reasoning behind them. Newest
first. When a decision is later reversed, add a new entry rather than editing the
old one — the history is the point.

---

## D-027 — Expeditions removed: the world is what was generated (2026-07-13, Session 26)
**Decision:** L18 chartered expeditions (Session 25) are removed — module,
tests, and app UI. The DECISIONS log records reversals rather than hiding
them; this is one.

**Why:** Direct user feedback, and it is right on the merits: "You built a
world generator... it's all about what was pregenerated." An expedition was a
story invented AFTER generation — a caravan that was never part of the
world's history, walked by a traveller no chronicle knows. It broke the
project's identity rule of one authoritative past. The right interactive
depth is *revealing more of what the generator already decided* (finer dates,
city plans, deeper layers), not appending new fiction at click time.

**What survives:** the folio redesign (Session 25's other half) and the
`window.__cartogenesis` verification handle. The A*-over-terrain machinery is
in git history if a *generated* use ever wants it (e.g. pregenerated trade
routes as world-state).

## D-026 — Islets merge: a lone skerry is not a province (2026-07-13, Session 24)
**Decision:** After the region BFS partition, any region smaller than
`ISLET_MIN = 12` cells — an unseeded coverage island, or a seed that landed on
one — is folded into the nearest substantial region by centroid distance, the
way a coastal province claims its offshore skerries. Ids are **not**
renumbered: an emptied id yields no region, so every surviving region keeps
its id-keyed name. Skipped entirely if no region reaches the threshold (a
world of nothing but skerries keeps them all).

**Why:** Tiny 1-cell "regions" cluttered every gazetteer table, and — worse —
acted as *unconquerable microstates*: conquest spreads by land adjacency, so
armies can't reach islands, and every island realm survived to the present on
every world, padding "surviving realms" with phantoms.

**Fingerprint impact (declared):** `simulationHash` moved
`15371f1173c805ad → 146934d0ec2014cd` (region sets feed settlements and the
sim). Terrain hashes `86c5fef6` / `418ddfd2` did NOT move — the split proves
the change touched only the partition, not the land.

**Balance re-measured (30 seeds):** at the app's 384²: mean top-power share
29.6% → 35.7%, zero worlds >90% unified, 5.5 surviving powers (was 8.1 — the
difference is exactly the phantom island realms). At 256²: mean 54.5%, sd 17 —
inside the historic healthy band. The "histories vary" guard moved from 160²
to 256²: a post-merge 160² world has only ~4 mainland regions, too few for a
share-of-regions metric to mean anything.

## D-025 — The narrator is a generator with three laws, not a model (2026-07-10, Session 20)
**Decision:** L17 (`src/narrative.ts`) turns the simulation into prose using
grammar-driven phrase banks expanded by a private RNG stream — no model call at
generation time, ever. Three laws bind it, each enforced by a test:
1. **Strictly downstream.** It reads the finished simulation and never feeds
   back — no draw from the sim's stream, no event mutation. All three golden
   fingerprints are byte-identical with or without the feature.
2. **Total.** Every event is narrated; the teller may colour, never omit.
3. **Grounded.** Every name in the prose is a real name from the world; the
   narrator invents phrasing, never facts.

**Why not model-authored prose?** The engine's identity is "same seed, same
world, every time, offline, zero dependencies". A model call would break all
four properties at once. The craft belongs in the generator: rivalry memory,
momentum, cause-attachment ("With that, the realm was extinguished") are state
machines over the event list, and they are reproducible to the letter.

**Feeding it:** `SimEvent.actors` {subject, object, place} and
`RealmSummary.languageId` were added at the source rather than re-parsing the
prebaked event text — the fingerprint hashes year+type and realm arcs, so both
are invisible to it. The narrator probes `e.text` only to split plague/drought
and sacked/abandoned, which share a type; facts still come from actors.

**Style consequence worth keeping:** variety is load-bearing. The varied picker
avoids repeating a bank's previous choice *per category key* (chapter-title
banks are keyed by tenor, not index, so back-to-back war chapters rotate), and
momentum phrases fire probabilistically — a chronicler who says "swollen with
victories" every time is a bore. If you add event types, add them to the banks
AND to the total-narration test.

---

## D-024 — Language contact is a cosmetic overlay, not part of the simulation (2026-07-10, Session 18)
**Decision:** Conquest renames towns, but the renaming reads the simulation's
deterministic `control` state and composes each new name with a **private `Rng`
keyed by (settlementId, turn)** — never the simulation's own stream. The
renamings are returned as a separate `SimulationLayer.renamings` list and applied
to `Settlement` objects by `world.ts` *after* the sim; they are **not** pushed
into the `events` array.

**Why:** the simulation fingerprint (`simulationHash`) is computed from realm
arcs, dated events, and settlement fates — the *structure* of history. Names are
not structure. Keeping the renaming out of the sim's RNG stream and out of
`events` means the fingerprint is byte-identical whether or not the feature
exists, which is both a correctness guarantee (naming can never accidentally
change who conquers whom) and a cheap, strong test: pin the three fingerprints
and they must not move. This mirrors D-021/S15 — names live downstream of the
world, never upstream.

**Rejected:** pushing "contact" events into the chronicle. It would enrich the
timeline but move `simulationHash`, forfeiting the clean proof. The gazetteer's
"Names remade by conquest" section gives the same visibility without touching the
fingerprint.

**Consequence:** if a future change *does* want conquest to alter history (e.g. a
renamed town's morale), that is a real simulation change and must own its
fingerprint update — do not sneak it through the naming path.

---

## D-023 — Water and lava are injected into their layers post-hoc, not classified (2026-07-10, Session 17)
**Decision:** Crater lakes and lava fields are added by dedicated passes
(`fillCraterLakes`, `traceLavaFields`) that mutate `water.lakeMask` /
`biomes.ids` *after* the base classification, rather than being detected by
`analyzeWater` / `classifyBiomes`.

**Why:** Both features are defined by the volcanoes, not by the fields the
classifiers read. A crater lake sits *above* sea level, so the ocean/inland-basin
flood fill — which only knows "below sea level, not reachable from the border" —
can never find it. Lava is a surface material laid down by an eruption, not a
climate outcome, so no temperature/moisture rule would produce it. Teaching the
classifiers about volcanoes would invert the dependency (hydrology and biomes
would import the volcano layer) for two special cases; a post-pass keeps the
classifiers pure and the special-casing localized.

**Consequence:** the passes must run at the right point and update derived
counts. `fillCraterLakes` runs after erosion + `analyzeWater` (the floor is only
final after erosion) and updates `lakeCount` / `lakeFraction`. `traceLavaFields`
runs after `classifyBiomes` but *before* regions/settlements (so nobody settles
on basalt) and updates `counts` / `diversity` / `dominant`. Ordering is load-
bearing; it is commented at each call site in `world.ts`.

**Determinism split, worth remembering:** calderas change *elevation* → all three
golden fingerprints move. Lava changes only *biomes* → the elevation hashes are
untouched and only `simulationHash` moves (through settlement placement). When a
change moves only some fingerprints, that is evidence about how far it actually
reaches — a useful check.

---

## D-022 — Determinism is only as strong as the arithmetic underneath it (2026-07-10, Session 15; **RESOLVED** Session 16)
**Status:** RESOLVED. Session 15 found it; Session 16 fixed it. The resolution is
recorded at the end of this entry.

**What happened.** CI (Node v24.18.0) and the dev machine (Node v24.16.0)
disagreed about whether seed `s10` produces any ruins. Two tests that hard-coded
"this seed has ruins" failed on CI and passed locally. The elevation golden hash
was green on both.

**Why the golden hash missed it.** `hashGrid` is `hashQuantized` — it rounds
before hashing, explicitly "to survive trivial float noise". It therefore cannot
detect the very thing that was happening.

**The real defect.** The pipeline uses `Math.hypot` (erosion, simulation),
`Math.pow` (terrain, volcanoes, simulation), and `Math.cos` (climate). ECMAScript
specifies these as **implementation-approximated**: an implementation may return
any value within an implementation-defined tolerance. Only `+ - * /` and
`Math.sqrt` are pinned to IEEE-754 exact results.

And the simulation is **chaotic with respect to the last bit**. Measured: replace
`Math.hypot(x, y)` with the mathematically identical `Math.sqrt(x*x + y*y)` —
they disagree in the final ulp on 926k of 2.1M calls — and the ruin counts across
five seeds go `2,2,3,2,2` → `1,0,1,0,0`. A one-ulp difference reroutes history.
Borderline comparisons (`ratio > ATTACK_RATIO / …`) amplify it.

So "same seed, same world, every time" is currently true *for a given V8 build*,
and was never true across them. The samples in `docs/` were generated on one
machine; a reader regenerating them on another Node may get a different history
from the same seed.

**Decision.** Do not paper over this by loosening tests. Two changes, in order:

1. **Tests must never hard-code a simulated outcome for a seed.**
   `tests/coherence.test.ts` now *discovers* a ruin-producing seed at run time and
   fails loudly if none of eight produce one. Done this session — it is the right
   test design independent of the bug.

2. **Purge implementation-approximated math from the generation pipeline.**
   Replace with exactly-specified operations:
   - `Math.hypot(a, b)` → `Math.sqrt(a*a + b*b)` (sqrt *is* exact).
   - `Math.pow(x, k)` → exact forms for the exponents we actually use, or a
     `powExact` restricted to integers and halves.
   - `Math.cos` in `climate.ts` → a polynomial in `+ - * /`.
   - Rendering may keep `Math.log1p` — it is display, not world state.

   Then make the determinism guard **exact**: hash the raw bits of the elevation
   field (and a simulation fingerprint: realm years, sizes, fates), not a
   quantized version. A guard that rounds away the failure mode is not a guard.

**Consequence.** Step 2 changes every world (elevation shifts in the last bits,
and the simulation is chaotic), so the golden hash and all samples must be
regenerated in the same commit, with this entry cited.

**Honest framing to keep:** until step 2 lands, do not claim cross-platform or
cross-version reproducibility. Claim reproducibility *on a given Node build*,
which is what we actually have.

### Resolution (Session 16)
New `src/exact.ts` provides `dist`/`dist2` (from `sqrt`), `powExact` (integer and
quarter-integer exponents via `sqrt` + binary exponentiation), and
`cosQuarterTurn` (a 9-term Taylor cosine). Every approximated call in the
generation pipeline now routes through it:
- `erosion.ts`, `simulation.ts` `Math.hypot` → `dist`.
- `simulation.ts` `(…) ** 2` → `dist2`; `Math.pow(aggression, 1.6)` → `a*sqrt(a)`
  (exponent snapped 1.6 → 1.5; it is a tuning knob, and the 30-seed balance
  distribution is unchanged: mean 62%, on the same seeds the old code also gave 62%).
- `terrain.ts` `Math.pow(d, 1.2)` → `powExact`, exponent snapped **1.2 → 1.25**.
- `volcanoes.ts` `Math.pow(t, flankExp)` → `powExact`, exponents snapped
  **1.7 → 1.75** and **1.05 → 1.0**.
- `climate.ts` `Math.cos` → `cosQuarterTurn`.
- `render.ts` keeps `Math.log1p` — pixels are not world state.

Guards:
- `hashExact` (raw Float64 bits) and a `simulationFingerprint` (realm arcs, dated
  events, settlement fates) are now on `meta.exactHash` / `meta.simulationHash`
  and pinned in `tests/world.test.ts`. A test proves the exact hash catches a
  one-ulp perturbation the quantized hash rounds away.
- `tests/exact.test.ts` greps the whole `src/` tree and **fails if any
  implementation-approximated call (`Math.hypot|pow|cos|sin|exp|log|…` or the
  `**` operator) appears outside `render.ts` and `exact.ts`** — so this cannot
  silently regress.

New golden fingerprints (seed "cartogenesis", 256²): quantized `623e773a881f55b0`,
exact `d3db452f2c2e4472`, simulation `329a34e3d0463789`. The claim is now true:
same seed, same world, on any conforming engine.

---

## D-021 — A lexicon belongs to the culture, not the world (2026-07-09, Session 15)
**Decision:** Each language's word-roots are derived from its **id alone**
(`new Rng("lexicon:auld")`), memoized, and identical in every world. `vyvask`
means *water* in Auld in seed `atlas` and in seed `borea` alike.

**Why:** The obvious alternative — derive the lexicon from the world seed — makes
every world's vocabulary novel, which sounds richer and is in fact worse. A
reader who learns a dozen roots can then read *every* map we generate; a
per-world lexicon resets that knowledge each time and reduces the glossary to
decoration. Cultures are also older than any one map: Auld is a people, not a
property of a coastline. Practically, it also keeps `makeName(lang, rng)` free of
world-seed plumbing — the subsystems each hold a *stream* seed, not the world
seed, so a per-world lexicon would have to thread the seed through six modules.

**Consequence:** Adding a concept to `CONCEPTS` re-rolls every root after it in
the list (the coining loop is sequential), which renames every world. Concepts
must therefore be **appended, never inserted**. That constraint is written into
the `CONCEPTS` doc comment.

---

## D-020 — Names are compounds with meaning, and the terrain steers them (2026-07-09, Session 15)
**Decision:** Names are no longer syllable soup. Every name is a compound of two
roots chosen by a per-kind template (`peak` = a quality + stone/mountain; `town`
= a modifier + a work of hands), joined by real morphophonology (elision,
degemination, epenthesis). Callers pass **hints** — `["sea"]` for a port,
`["sand"]` for a desert region — and the composer prefers the most salient hint
its template can use, 60% of the time.

**Why:** A name that means something is the cheapest way to make a generated
world feel authored. `Deoliria` is noise; *Deoliria, the sea haven*, sitting on a
harbour, is a place. The 60% (rather than 100%) hint weight is deliberate: real
maps have inland-sounding names on the coast, and a rule with no exceptions reads
as a rule.

**Rejected:** Hand-written English-ish roots per culture. Shorter to write, but
they would make Auld sound like bad Norse and Kesh like bad Arabic — borrowing
the *sound* of real peoples while inventing their history. Coining every root
from the language's own phonology keeps the cultures invented.

**Consequence:** Two invariants, both tested. A hint the template cannot use must
be *ignored*, never emitted — there is no "sea peak". And nothing is ever named
"stone-stone": the head is re-drawn if it equals the modifier.

**Also:** roots must begin with a consonant. A vowel-initial root turns every
compound that heads it into mush (`cau` + `au` → `caau`), because the seam is
always a hiatus. Affixes may start with vowels; roots may not.

---

## D-019 — Balance of power: projected strength, not raw sum (2026-07-09, Session 12)
**Decision:** War resolution uses a realm's *projected* strength at the target
(raw strength ÷ overextension ÷ distance-from-capital) against the defender's
*home-ground* defence — never the raw sum of its regions. Layered on top: war
exhaustion (cooldowns), unrest/revolt in freshly conquered land, cluster
secessions, a per-realm `aggression` trait, a per-world `cohesion` trait, and
invasions that can be repulsed.
**Why:** With strength = Σ(regions), every conquest strictly increased the odds
of the next one. That is a positive feedback loop with no damping, so *every*
world converged on a single hegemon (measured: 94% mean top-power share, 75% of
worlds >90% unified) and every chronicle read identically. The fix is not to make
conquest hard — that produced the opposite failure (0 empires, a third of worlds
with no wars at all) — but to make it **self-limiting**: success carries costs
that scale with what you already hold. `cohesion` then varies the damping *per
world* so outcomes spread across a distribution instead of clustering at either
extreme (now: 59% mean share, 10% unified, 27% fragmented).
**Guarded by** a regression test asserting both failure modes stay fixed: some
world must stay divided, and some world must still produce a dominant power.

## D-018 — Volcanoes before erosion; real 16-bit heightmap exports (2026-07-09, Session 10)
**Decision:** Volcanoes are built onto the elevation field *before* the hydraulic
erosion pass, and the project exports genuine 16-bit heightmaps (a grayscale PNG
via `encodePNGGray16` and a raw `.r16`), plus a topographic contour render.
**Why:** A user asked for accurate heightmaps for a mountain/volcano enthusiast.
The honest position (recorded here): the terrain is *procedurally plausible*, not
geologically simulated — there is no tectonics or real volcanism, so "perfectly
accurate" is not on offer. What genuinely serves that interest is (a) real
volcanic landforms — and placing them before erosion means the droplet sim carves
authentic radial gullies down their flanks, exactly like an eroded stratovolcano;
and (b) real, importable heightmaps in the 16-bit format 3D tools expect, with a
stated metre scale (value 65535 = `maxAltitudeMetres`). This is more useful than
faking geological accuracy. Volcanoes change the terrain, so the golden hash was
updated to `74c67102ff7abf98`.

## D-017 — Resource deposits placed by spatial shuffle, not score order (2026-07-09, Session 9)
**Decision:** For each resource kind, shuffle the suitable candidate cells
deterministically before greedy min-distance placement, rather than sorting by
score (with an index tiebreak).
**Why:** The old order concentrated deposits in the map's north/low-index corner:
with a per-kind count cap, greedy placement in score-then-index order exhausted
the cap before ever considering the far side, so a measured 63–85% of deposits
landed in the north (vs. ~50% of land). Shuffling first makes placement a
uniform spatial sample (blue-noise via the spacing constraint) that tracks the
land distribution. Richness still comes from the cell's suitability score, so
rich terrain still yields rich deposits — only the *positions* are de-biased.

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
