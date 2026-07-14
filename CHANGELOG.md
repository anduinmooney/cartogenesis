# Changelog

One entry per work session. Each entry records what was actually produced,
verified, and left for next time. Newest first.

The format is loosely [Keep a Changelog](https://keepachangelog.com); this
project's "releases" are work sessions.

---

## Session 24 — 2026-07-13 — The map tells its story, and the skerries come home

**Theme:** user notes first (three), then the heavy item queued since Session
16. All three notes were real bugs or real gaps.

### The user's notes
- **"The reckoning is still referenced in the gazetteer"** — the overview's
  calendar line led with "The reckoning:", reading like the NAME of a year
  system left over from the old single After-Reckoning era. Now: "year 0 is
  **<origin>**; every date in this book is counted <era> and wears `<suffix>`".
  A test bans the word from the whole report. Found nearby: meta's "Realms 3"
  sat beside "Surviving realms 13" — realmCount now counts the realms that
  actually rose in the simulation (38), and the report reads "38 rose; 13
  stand, X the greatest among them".
- **"Years always say the same year twice, 150 – 150 A.C."** — the chronicle
  pin's date-stripper still expected the old `AR` suffix, so per-world
  suffixes never matched and the pin repeated the year. It now strips the
  entry's own `.yr` span, whatever the world's calendar wears.
- **"More markers for what's happening — perhaps in separate tabs; Faiths
  doesn't show the faith's name"** — each layer tab now curates its own
  markers. **Faiths:** every faith's name on its largest holding in its own
  tint, a star where it arose. **Powers:** realm names sit on their territory
  and FOLLOW the time scrubber; the era's events flare where they happened
  (⚔ war · ⚑ revolt/fall · ☠ plague · ⊘ famine · ✕ ruin · ✦ founding), with a
  glyph legend. **Political:** every region wears its name; fallen towns get a
  dagger. Physical tabs keep features/volcanoes; thematic tabs drop them.

### The islets merge (D-026 — declared fingerprint move)
Any region under 12 cells folds into the nearest substantial region by
centroid — the coastal province claims its skerries. Ids are not renumbered,
so surviving regions keep their names. This also ended the quiet reign of the
*unconquerable island microstate* (conquest is land-adjacent; island realms
survived every war on every world): mean surviving powers at 384² fell
8.1 → 5.5, all phantoms. `simulationHash` 15371f11 → **146934d0**; terrain
hashes unchanged — proof the land itself never moved. Balance re-measured
over 30 seeds (384²: mean top share 35.7%, zero unified; 256²: 54.5%, the
historic band); the "histories vary" guard moved 160² → 256², where a share
metric still means something.

**223 tests** (2 new). Verified live by canvas pixel-sampling (faith inks,
region ink, realm inks, era glyphs per scrubbed era) — the Browser pane's
screenshotter was wedged, so the pixels were read straight off the canvas.
Bench under budget (384²: 361 ms median).

---

## Session 23 — 2026-07-10 — Every world its own calendar, every chronicler their own voice

**Theme:** direct user feedback, twofold: "all generations look the same — the
sentence structure is all the same, X happens, then Y" and "unique worlds would
have their own time system, with a year-zero event that explains why people
start counting". Both delivered.

### Per-world calendars (year zero explained)
Every world now counts its years from its own origin: a volcanic world may
reckon from **the Great Burning of Mount Thathobry** (a real, named volcano —
tested), a seafaring one from **the Landing**, others from the Long Winter's
thaw, the First Crowning at the actual capital, or the Falling Star. The origin
joins the founding legends AT year zero and says why the count began ("From
that year the peoples of this world count their days"). Dates everywhere wear
the world's own suffix (A.B., A.L., A.T., A.C., A.S.) — gazetteer, annals,
legends, app scrubber and sidebar (three hardcoded "AR"s gone). Drawn on a
private stream: all three fingerprints byte-identical.

### The chronicle stops reading like a ledger
Two structural levers plus roughly doubled banks:
- **Voice** — each world's chronicler has a temperament drawn once per world:
  plain, wry ("Where I have failed to keep my opinions out, the reader may
  enjoy them"), or grave ("Nothing in these pages was free"). Voice chooses
  the opening, the sign-off, and rare editorial asides, at most two a chapter:
  "The reader will notice a pattern; the realms did not."
- **Frame** — sentences vary in SHAPE: same-season events drop the time
  connective (40%), conquests can tuck the time mid-clause, new anchors include
  the chronicle-terse "1050:". Measured: time-led sentences fall from ~100% to
  62%, with a test pinning the band (<80%, >30% so chronology survives).
- **Banks** — conquest 4→8 (+3 mid-time), repulsed 3→6, ruin 4→8, all disaster
  and upheaval banks widened, every time-phrase bank +2, all five chapter-title
  banks 3→5. Sagas and the traveller got the same pass (arrival couplets,
  personas 3→6, sign-offs 2→4).

A colon-stutter ("…opened with trouble: X held: …") was found by reading and
caged by test. **221 tests** (7 new). Fingerprints untouched throughout — the
calendar and every prose change are pure overlay, and the pinned hashes prove
it.

---

## Session 22 — 2026-07-10 — The truth-telling pass: README, contours, a budget

Three pieces of overdue honesty, none of which touch generation (fingerprints
verified unchanged throughout).

### README rewritten
The project's face stopped at roughly Session 10: it knew nothing of languages,
exact determinism, the in-app gazetteer, calderas, conquest-layered names, the
chronicle, the sagas, or the traveller — and claimed "34+ tests" against 211.
Rewritten around what the project actually is: geography, language, history,
and the telling of it, with the browser app leading and the narrator's three
laws and the D-022 story each given a paragraph.

### Metre-accurate topographic contours
The Topo layer's 18 uniform bands meant the interval was never a round number.
`pickContourInterval` now chooses the smallest standard cartographic interval
(25/50/100/200/250/500/1000 m) keeping the map under ~20 bands, and every fifth
line is a heavier INDEX contour, as on a paper topo sheet. The app's Topo
legend states the interval. Rendering only; samples regenerated.

### A benchmark and a budget
`scripts/bench.ts` times generation at three sizes and breaks a 384² world
into separable stages. Baseline recorded in PROJECT_STATE: ~620 ms for the
app-size world; erosion/roads/rivers are the heavy stages.

**214 tests** (3 new). Remaining queue: the islets merge (deliberate,
fingerprint-moving) and small narrative polish.

---

## Session 21 — 2026-07-10 — Sagas, a traveller, and a legible map

**Theme:** the largest session yet, in two movements — the narrative layer grew
two voices, then mid-session user feedback (which beats any queued plan) turned
the second half into a map-legibility pass.

### L17b — Founding sagas
One saga per culture, in verse: the crossing, the naming of the heartland (the
lexicon glossed into the lines), the first city, the god, two word-roots taught
to the reader, and the fate of their greatest realm — elegiac if the simulation
extinguished it. The detail that earns its keep: a saga refuses conquest's
renamings — *"(The maps write it Khirciamor now. The saga does not.)"* — tested.

### L17c — A traveller's account
A named traveller (composed in the capital's tongue) walks the REAL post-
simulation road tree depth-first from the capital; every leg is told from the
actual path cells — provinces crossed, fords, climbs in metres, volcanoes and
ruins off the road, markets from the real economy, renamed towns heard as a
traveller hears them ("I bought bread in both names"). Walking the world caught
a real bug: **two towns renamed to the same name** — S18's language contact had
no collision guard. The contact pass now tracks the live name set and retries
on a salted stream; zero duplicates across 20 worlds.

### User feedback: tooltips for everything, chronicle pins, calmer volcanoes
1. **A full entity index** now backs the app: rulers, figures, houses, realms,
   faiths, gods, volcanoes, features, regions, settlements — and the former
   names of renamed towns. Every linkified name in the gazetteer (933 spans on
   one test world), the annals sidebar (266), and the features list shows a
   hover tooltip; located entities still fly the map on click.
2. **Chronicle clicks land on something.** Events anchor to the region's oldest
   standing town (coordinates aren't hashed — presentation, not history), and
   every click drops a labelled gold pin at the spot.
3. **Fewer, cleaner volcanoes:** count capped at 6 with thinner density (mean
   5.1 at 384², was ~9); cinder-cone craters shallower. Fingerprints
   regenerated (`86c5fef6` / `418ddfd2` / `15371f11`); 30-seed balance in band
   (mean 56%).

### Also
The port-naming test's control group was wrong (riverside towns are rightly
water-named); it is now dry inland towns, direction asserted only when that
group exists. A sidebar-linkification ordering bug (innerHTML assigned after
linkify) was caught on the deployed site and fixed. **211 tests** (10 new).
Remaining tail (contours, islets, benchmark, README) carries to next session.

---

## Session 20 — 2026-07-10 — Fable: the review, and the chronicle told

**Theme:** the user handed the project to Fable with a mandate — review
everything, fix what's wrong, confirm it works, and build one significant
addition Fable would excel at. Delivered in three commits.

### The review, and what it fixed
The scouted candidate list was validated finding by finding:
1. **Real bug, fixed:** `linkifyPlaces` probed text nodes with a stateful `/g`
   regex — `.test()` resumed from the previous node's `lastIndex`, silently
   skipping nodes and leaving some gazetteer place names unclickable. The
   matching is now pure string logic in `web/markdown.ts` (`placePattern` /
   `containsPlace` / `segmentPlaces`) with four Node tests caging the exact
   failure mode.
2. **Fragility, fixed:** `economy.ts` computed `richest` with `indexOf` inside a
   `reduce` — O(n²) and identity-fragile. Now an indexed scan with identical
   semantics; the untouched `simulationHash` is the proof of equivalence.
3. **UX mismatch, fixed:** hovering the map while the Powers timeline was
   scrubbed to a past year answered with *present-day* towns. Hover now uses the
   same `settlementsAt(shownYear)` filter the markers use.
4. **Intentional, documented:** `Date.now()` in `cli.ts` times the status line
   and never feeds generation.

### L17 — the chronicle, told (the significant addition)
The world's history was real but read like a ledger. New `src/narrative.ts`
gives it a chronicler: an in-world voice with an opening frame, chapters named
for their tenor ("III. The Age of Blood and Banners, 500–700"), realm
introductions with culture epithets, a rivalry memory ("yet again it was
Kaarghen that kept the field"), repulsed invasions that pay off later, falls
that attach to the conquest that caused them, momentum that colours the telling
only sometimes, and a grounded sign-off naming the reigning monarch.

Three laws, each enforced by test: **strictly downstream** (private stream, all
three fingerprints byte-identical with the feature in place), **total** (every
event's actors are found in their covering chapter — a chronicle that skips the
famine is propaganda), **grounded** (every name is a real name from the world).
`SimEvent` gained structured `actors` and `RealmSummary` a `languageId` to feed
it — both invisible to the fingerprint by construction.

Surfaced as the gazetteer's centrepiece ("## The Chronicle of …", chapters in
the ToC, prose place-names clickable via the fixed linkifier), with the old
bulleted list demoted to "## Annals".

### Verification
**201 tests** (11 new: 4 linkifier, 7 narrative). Fingerprints unchanged
(`61e751b3` / `c59c1726` / `c38f5de3`). Live-app verification note: the local
preview's browser could not reach sandbox-bound servers this session
(ERR_CONNECTION_REFUSED from the real Chrome; curl fine) — content pipeline was
proven end-to-end in Node instead, and the deployed Pages site verified after
push.

---

## Session 19 — 2026-07-10 — A close bug, and seamount arcs

### Fix: the gazetteer popup wouldn't close (user-reported)
`#gazovl { display: flex }` is an ID selector, so it overrode the UA stylesheet's
`[hidden] { display: none }`. `closeGazetteer()` set `.hidden = true`, but the
element stayed `display: flex` and visible — no close path (✕, backdrop, Escape)
could hide it. Fixed with a higher-specificity `#gazovl[hidden] { display: none }`.
The **time scrubber had the identical latent bug** (`#scrubber { display: flex }`
toggled via `.hidden`), so it stayed on the screen on non-Powers layers; fixed the
same way. Both verified live.

### Seamount arcs
`addVolcanoes` placed every cone independently, so volcanoes scattered. Now a
placed cone has a 35% chance of seeding an **island arc**: a chain that steps
along a gently curved line, dropping 2–4 more cones of the same system, crossing
shallow water and re-emerging like a real seamount chain.
- Refactored the inline build into a `buildCone()` closure shared by single
  placement and arcs. Direction and per-step bend use rejection sampling +
  renormalisation — **no trig**, so the arithmetic stays exact (D-022).
- Arc members carry a shared `arcId`; the gazetteer notes "one of an island arc"
  and counts the systems.
- Verified in Node: arcs form in 19/20 worlds and are near-perfect lines (max
  perpendicular residual < 0.05 of the chain span; test asserts < 0.2). Terrain
  changed → all three fingerprints regenerated (`61e751b3` / `c59c1726` /
  `c38f5de3`); 30-seed balance unchanged (mean 60%). **190 tests** (2 new).

Remaining overhaul tail: metre-accurate contour intervals, and cleanup (islets,
benchmark, README).

---

## Session 18 — 2026-07-10 — Language contact: conquered towns wear both names

**Theme:** Phase 4 of the overhaul, and the single biggest authored-feel win the
lexicon (S15) unlocked. Real toponymy layers — *Istanbul* is a Greek name worn
down under Turkish rule — and now the map does too.

### The feature
When a realm holds a region of a **different culture** for three turns, that
region's towns are renamed: the **land-word survives in the conquered people's
tongue**, the **settlement-word is re-said in the ruler's**. Kesh `Khaimghekh`
(*stone-gate*) under Auld rule becomes `Khaimdund` — the Kesh root for stone, the
Auld word for a haven.
- New `composeLayered(fromLang, toLang, concepts, rng)` in `language.ts` keeps the
  native modifier root and draws the head from the ruler's lexicon (usually a word
  of their administration — fort, hall, gate).
- The simulation tracks per-region foreign-hold duration from its deterministic
  `control` state and composes with a **private `Rng` keyed by (settlementId,
  turn)** — it never draws from the sim's own stream. `Settlement` gains
  `formerNames[]`; `world.ts` applies the renamings after the sim, so the map,
  gazetteer, and hover all show the new name while remembering the old.
- Surfaced three ways: the detail card ("formerly Stagrdund … renamed under
  foreign rule c. 550 AR"), the settlement list, and a dedicated gazetteer
  section **"Names remade by conquest"**.

### Determinism — a clean proof
Because the renaming is pure overlay (deterministic control state + a private
RNG), **all three golden fingerprints are byte-identical** to Session 17
(`36d22822` / `3ea66d76` / `ca005385`), and a test pins them to prove it. This is
the same guarantee S15 established for base naming: names never perturb the
simulation. (D-024.)

### Verification
Language contact fires in all 20 sampled worlds. Live: the detail card and the
gazetteer both show the remade names; no console errors. **188 tests** (5 new).
Phase 3 leftovers (seamount arcs, contour intervals) and Phase 5 (islets,
benchmark, README) remain queued.

---

## Session 17 — 2026-07-10 — Deeper terrain: calderas, crater lakes, and lava

**Theme:** the overhaul continues (Session 16 landed 3 of 5 phases). This is
Phase 3 — deeper volcanic terrain, for the friend who loves mountains and
volcanoes. Two features, each committed and verified.

### Calderas and crater lakes
A large stratovolcano or shield now has an even chance of having blown its top:
instead of a peak it gets a wide, flat-floored caldera ringed by a steep rim
(built with the same exact-arithmetic profile — smoothstep wall, `powExact`
flanks). Most calderas above the sea then **cradle a crater lake**.
- Crater lakes sit *above* sea level, so `analyzeWater`'s ocean/basin flood fill
  never finds them. A new `fillCraterLakes` pass runs after erosion + hydrology
  and injects the lake cells into `water.lakeMask`, so biomes, rendering,
  settlements, and the gazetteer all agree the floor is water. Verified: every
  crater-lake cell classifies as `Biome.Lake`, and no settlement is founded on
  one. The gazetteer marks the volcano "a caldera cradling a crater lake";
  hovering it in the app reads "Lake".

### Lava fields
Each **active** volcano sends 2–5 lava flows down its flanks — steepest-descent
walks from the rim across the final eroded terrain, painting a new
`Biome.LavaField` (near-black basalt) until they hit water or pool in a pit.
- Lava repaints biomes and never touches elevation, so the terrain hashes are
  unchanged — only the simulation fingerprint moves (via settlement placement).
  Nobody settles on fresh basalt (`generateSettlements` skips lava candidates;
  zero across 20 worlds). Rendering, the legend, and hover pick it up for free
  through `BIOME_COLORS`/`BIOME_NAMES`. Verified live: 309 basalt pixels on the
  biomes canvas.

### Determinism & tests
Terrain changed (calderas) → all three golden fingerprints regenerated
(`36d22822` / `3ea66d76` / `ca005385`); lava changed only the simulation
fingerprint. Two existing tests encoded assumptions the new water/biome broke and
are **corrected, not masked**: fish may sit by a mountain crater lake (not only
the sea), and the "ruins change the road network" check is split from the always-
true "roads follow the survivors" invariant so a ruined leaf town can't make it
flaky. **183 tests** (7 new), incl. a lint proof that the new terrain code uses no
approximated math. Two more Phase-3 ideas (seamount arcs, per-region contour
intervals) and Phases 4–5 (language contact, cleanup) remain queued.

---

## Session 16 — 2026-07-10 — The overhaul: exact arithmetic, the gazetteer in-app, and exports

**Theme:** the user asked for the biggest session yet with the most features.
Three phases, each committed and verified: a correctness foundation fix, then two
substantial feature sets. (Two more — deeper terrain, language contact — are
planned and queued; see `NEXT_SESSION.md`.)

### Phase 0 — Exact arithmetic: same seed, same world, on every engine (D-022)
Session 15's CI failure was a real bug. ECMAScript leaves `Math.hypot`/`pow`/
`cos`/`exp`/`log` and the `**` operator **implementation-approximated** — only
`+ - * /` and `Math.sqrt` are exact — and world generation is chaotic in the last
bit, so two V8 builds diverge. "Same seed, same world" was only ever true per
engine.
- New `src/exact.ts`: `dist`/`dist2` (from `sqrt`), `powExact` (integer and
  quarter-integer exponents via `sqrt` + binary exponentiation; throws rather
  than fall back to `Math.pow`), `cosQuarterTurn` (a 9-term Taylor cosine).
- Every pipeline call routes through it. Non-quarter exponents snapped and noted:
  island `1.2→1.25`, volcano flanks `1.7→1.75` / `1.05→1.0`, aggression
  `1.6→1.5` (`a·√a`). The 30-seed balance distribution is unchanged (mean 62%,
  which the old code also gave on those seeds).
- The guard is now exact: `hashExact` (raw Float64 bits) and a
  `simulationFingerprint` (realm arcs, dated events, settlement fates) on
  `meta.exactHash` / `meta.simulationHash`, pinned in `tests/world.test.ts`, with
  a test proving the exact hash catches a one-ulp change the quantized hash
  rounds away. `tests/exact.test.ts` greps `src/` and fails if approximated math
  reappears outside `render.ts`, so it cannot silently regress.
- **CI confirms it:** the pinned fingerprints pass on CI's Node 24.18.0 and the
  dev box's 24.16.0 alike. D-022 resolved; the per-build-only caveat is gone.

### Phase 1 — The gazetteer, in the browser
The engine always knew more about a world than the app showed. Now a **📖
Gazetteer** button opens the full dossier — `report.ts` runs unchanged in the
bundle behind a new dependency-free Markdown renderer (`web/markdown.ts`, escapes
HTML before formatting). A table of contents from the headings; every place-name
linkified against the world's settlements/regions/volcanoes/features so a click
flies the map there. Verified live: 28 ToC entries, 14 sections, 187 clickable
places for seed atlas.

### Phase 2 — Client-side exports
Everything the CLI writes, the app now downloads, computed in-browser:
- **↓ Map** — the current layer as a full-resolution PNG.
- **↓ Poster** — the labeled SVG poster over the political map.
- **↓ .md** — the full gazetteer as Markdown.

`worldPosterSVG` took a Node `Buffer`; changed it to a data URI so both Node
(`encodePNG`) and the browser (`canvas.toDataURL`) can feed it. Verified live:
all three download with the right MIME type and non-empty content.

### Verification
- **176 tests** (up from 155): 21 new across `exact`, `markdown`, and `exports`.
- Golden fingerprints regenerated (quantized `623e773a881f55b0`, exact
  `d3db452f2c2e4472`, sim `329a34e3d0463789`); samples rebuilt.
- Live app checked on a fresh preview after each phase; no console errors.

---

## Session 15 — 2026-07-10 — Languages, and a world you can read

**Theme:** give every culture real *vocabulary*, so a name can be translated —
then pay off the promise everywhere a name appears. Engine **0.13.0**.

### The languages (new `src/language.ts`)
- Each culture gets a **lexicon**: 59 concepts (`sea`, `stone`, `high`, `fort`,
  `holy` …), each coined as a root in that language's own phonology. Auld
  `stagr` = sea; Kesh `khir` = sea; Sylvan `syaeen` = sea.
- Every name is a **compound of two roots**, chosen by a per-kind template
  (`peak` = a quality + stone/mountain; `town` = a modifier + a work of hands;
  `deity` = a divine particle + sacred roots). Names carry a **gloss**:
  `Deoliria` is *the sea haven*.
- Roots are joined by real **morphophonology** — elision (`vaska`+`erd` →
  *vaskerd*), degemination (`hold`+`dun` → *holdun*), epenthesis (`vaskr`+`stan`
  → *vaskrastan*). Roots must begin with a consonant, or every seam becomes a
  hiatus and compounds turn to mush (`cau`+`au` → *caau*).
- **The terrain names the place.** Callers pass hints: a port passes `sea`, a
  desert region `sand`, a town under a summit `mountain`. The composer prefers
  the most salient hint its template can take — 60% of the time, not always,
  because a rule with no exceptions reads as a rule. An unusable hint is
  *ignored*, never emitted: there is no "sea peak".
- Lexicons are keyed by **language id, not world seed** (D-021). `vyvask` means
  water in Auld in every world; learn a dozen roots and you can read any map we
  generate.

### Surfaced
- **Gazetteer:** a new **Languages** section printing each spoken culture's full
  glossary and where it's spoken; meanings on regions, settlements, volcanoes,
  notable features, ruling houses, realms, and gods.
- **App:** a **Languages phrasebook** panel (collapsible per culture); etymology
  on hover and in the pinned detail card; glossed notable features.
- Names also got **short**: median 9 characters, max 13. No more
  "Leolenvabauvento".

### Coherence: present-day roads and economy
Longstanding debt in `PROJECT_STATE`. The simulation runs on the world as it
*was*; the maps describe the world as it *is*. Roads ran to ruined cities and
the economy listed them among the exporters.
- The pipeline is now honestly two-pass: roads + economy are computed over all
  settlements (what the simulation consumes), then **rebuilt over the survivors**
  once the simulation says who fell. `World.roads` / `World.economy` are the
  present-day layers.
- When nothing falls, the rebuild is **skipped**, so it cannot cause drift.
- Removing a town does not always *shorten* the network — a ruined hub forces
  detours — so the test asserts the network **differs**, not that it shrinks.

### Bug found and fixed
A nine-volcano island raised **three peaks all named Mt. Brogravra**: the volcano
template was 5 modifiers × 2 heads and had no avoid-set. Widened to 12 × 4 and
given one. Caught by looking at a screenshot, then locked down by a test.

### A determinism defect, found by CI (D-022)
Two new tests hard-coded "seed `s10` produces ruins". They passed locally and
**failed on CI** — while the elevation golden hash stayed green on both. The
cause is not the tests:

- CI runs Node **v24.18.0**; the dev box runs **v24.16.0**.
- The pipeline uses `Math.hypot`, `Math.pow`, and `Math.cos`, which ECMAScript
  leaves **implementation-approximated** — only `+ - * /` and `Math.sqrt` are
  pinned to exact IEEE-754 results.
- The simulation is **chaotic in the last bit**. Measured: swapping
  `Math.hypot(x, y)` for the mathematically identical `Math.sqrt(x*x + y*y)`
  (they disagree in the final ulp on 926k of 2.1M calls) moves ruin counts across
  five seeds from `2,2,3,2,2` to `1,0,1,0,0`.
- The golden hash never caught it because `hashGrid` **quantizes** before hashing.

So "same seed, same world, every time" has only ever been true *for a given V8
build*. Fixed this session: the coherence tests now discover a ruin-producing
seed at run time and fail loudly if none of eight does — no test may hard-code a
simulated outcome. Recorded as **D-022**, and purging the approximated math (plus
an *exact* determinism guard) is Session 16's headline objective.

### Verification
- **155 tests** pass (21 new, in `tests/language.test.ts` and
  `tests/coherence.test.ts`), incl. non-vacuity guards: the ruin tests fail
  loudly if no seed produces ruins.
- Elevation golden hash **`74c67102ff7abf98` unchanged** — naming is downstream
  of geography.
- Simulation structure proved **byte-identical** across five seeds before/after
  the rename (a `git stash` A/B on realm years, sizes, fates, and event types) —
  names draw from private RNG streams and cannot perturb the sim.
- Live app verified on a fresh preview: phrasebook renders, hover and detail
  cards gloss, no console errors.

---

## Session 14 — 2026-07-09 — One timeline (user feedback: "age maxes out")

**Theme:** *"Age doesn't seem to work, maxes out at 150."* Investigating it
uncovered two real bugs, the second worse than the first.

### The bugs
1. **Dynasties ended centuries early.** Ruler successions were capped at
   `n < 9` rulers (~250 years), so every house's line stopped around year 350
   while the present year was 826–1174. The world had **no living monarchs** and
   600–800 kingless years.
2. **The world ran on two contradictory timelines.** `history.presentYear`
   (derived from the old pre-simulation chronicle: 826–1174) versus the
   simulation's 100→1,100. The rulers were counting against the wrong one, and a
   founding legend could be dated *after* the present (Vahalia had one at 1112).

### Fixes
- **One authoritative timeline** in `world.ts` (start 100, 40 turns × 25 years →
  present **1,100**), passed to history, lore, *and* the simulation.
  `meta.presentYear = simulation.endYear`.
- **`lore.ts`**: dynasties reign from their founding right up to the present
  (safety cap 80, not 9). `Ruler.reigning` marks the one monarch on the throne
  today — exactly one per house.
- **`history.ts`**: takes the present year and clamps legends to it.
- **`report.ts`**: the overview uses the single present year, the reigning
  monarch is marked, and thousand-year king-lists collapse to the first and last
  four with *"… 30 rulers over the intervening years …"*.

### Verified
- Across all six samples: `present=1100`, `legends ≤ 1100`, reigns end **exactly**
  at 1100, `chronicle ≤ 1075`. In-app: chronicle 100→1075, scrubber ends 1,100 AR.
- **Three regression tests**: a dynasty must reach the present with exactly one
  reigning monarch and no gaps in the succession; no legend dated after the
  present; `meta.presentYear === simulation.endYear`.
- Balance re-checked (15 seeds): mean top-power share **58%**, unchanged.
- `npm test` → **134 passing**. Golden hash unchanged.

---

## Session 13 — 2026-07-09 — Dynamic settlements (cities rise and fall)

**Theme:** The scrubber showed borders shifting, but the cities were timeless —
the same dots at 100 AR as at 1,100 AR. Now settlements have lifespans.

### Added
- **`settlementTimeline`** (`src/simulation.ts`): every town gets a **founding
  year** (best sites are oldest; all founded in the first half of the span).
  During the run a town may be **sacked** when its region is conquered, or
  **abandoned** when its country empties out. New `ruin` events.
  - The **capital never falls** (the present-day metadata names it), and at most
    35% of towns can be lost.
  - Plagues made properly devastating (×0.45, was ×0.6) so a country *can*
    actually empty — otherwise `abandoned` was dead code that never fired.
  - Helpers: `settlementsAt(year)`, `ruinedSettlementIds()`.
- **Coherence:** "present day" is now *exactly* the survivors. The worker,
  sample generator, and CLI overlay only surviving towns; hovering a ruin no
  longer names a town that no longer exists.
- **Gazetteer:** settlements show their founding year; a new **Ruins** section
  records what history swallowed (*"Baubryu (town) — founded 200, stormed and
  left a ruin in 525"*).
- **App:** on the Powers layer, markers are drawn from the timeline for the
  scrubbed year, so cities visibly appear and vanish as the history plays.
  New **Ruins** stat. `meta.ruinCount`.

### Fixed (found while verifying)
- A town could be sacked in the very year it was founded (*"founded 375, ruined
  375"*) — it violated an invariant my own test asserted, but the single test
  seed happened not to hit it. Ruin now requires the town to have stood at least
  a turn; the test was widened to six seeds.

### Verified
- `npm test` → **131 passing** (timeline invariants, determinism, the same-year
  regression, capital survives, present-day == survivors).
- In-browser marker-pixel counts on the Powers map: **100 AR = capital only,
  350 AR = towns appearing, 1,100 AR = all survivors.**
- Balance re-checked over 30 seeds after the plague change: mean top-power share
  **58%**, 2/30 unified, 7/30 fragmented — unchanged. Golden hash unchanged.

---

## Session 12 — 2026-07-09 — Balance of power (user feedback)

**Theme:** "Powers and regions always nail down to one power by the end." True,
and measured: mean top-power share **94%**, with **75% of worlds >90% unified**.
Every history read the same. Fixed.

### The cause
A realm's strength was the raw **sum** of its regions, so every conquest made the
next one easier — a pure snowball with nothing pushing back.

### Counter-forces added (`src/simulation.ts`)
- **Overextension** — a sprawling realm projects less force per front.
- **Distance** — armies weaken far from their capital (a *free radius* keeps
  border wars unpenalised).
- **Home ground** — defenders fight harder on their own soil.
- **War exhaustion** — a cooldown after every conquest, longer after a defeat.
- **Unrest & revolt** — freshly conquered land seethes and can rise; the more
  overextended the empire, the likelier the province revolts.
- **Cluster secession** — breakaways take a contiguous group of provinces, so
  they're viable rivals instead of one-region snacks that get re-eaten.

### Variety & character
- **Per-realm `aggression`** (0.6 timid … 1.8 warlike): bold realms march on poor
  odds. Every world is guaranteed at least one would-be conqueror.
- **Per-world `cohesion`** (unruly … cohesive) scales overextension/revolt/
  secession — so some worlds fragment and some genuinely unify.
- **Invasions can be repulsed** (new `repulsed` event). Realms relocate their
  seat when their capital falls.

### Measured over 30 seeds
| Metric | Before | After |
|---|---|---|
| Mean top-power share | 94% | **59%** (sd 19) |
| Worlds >90% unified | 75% | **10%** |
| Worlds fragmented (<45%) | 0% | **27%** |
| Avg powers at end | ~1.5 | **2.6** |
| Wars per world | — | 11 conquests vs **16 repulsed** |

### Verified
- `npm test` → **128 passing**, incl. a new **regression guard** asserting
  histories stay varied (not all unified, *and* conquest still possible).
- Golden hash unchanged (`74c67102ff7abf98`). Samples + bundle regenerated: the
  Powers map now shows rival realms; reports carry rise/fall arcs (a realm peaks
  at 10 provinces then goes extinct) and repeated failed campaigns.
- In-browser: 6 surviving realms, 120 events (36 conquests / 18 repulsed / 15
  revolts); scrubber shows borders shifting between real powers.

### Decided
- D-019 (balance-of-power model: projected strength, not raw sum).

---

## Session 11 — 2026-07-09 — Temporal atlas (watch history unfold)

**Theme:** First verified Session 10's work live (the preview browser was fine on
a fresh start — it was just wedged last session by leaked test workers), then
built the queued time scrubber.

### Verified (Session 10, live)
- Volcanoes render and are labeled on the map, the Topo layer shows contours,
  hover shows elevation in metres ("Snow · 4,500 m"), and the **"↓ Heightmap"**
  button downloads a real 16-bit PNG in-browser. All confirmed with a screenshot.

### Added — the time scrubber
- **`src/simulation.ts`**: records a per-turn `ControlSnapshot` (region→realm
  borders) after every turn plus the initial state (turns + 1 total); the last
  equals `finalControl`.
- **`src/render.ts`**: `renderPowersAt(regions, control, …)` renders any control
  map; `renderPowers` now wraps it with the final one.
- **App**: on the **Powers** layer, a timeline **slider + play/pause** appears
  under the map. Dragging or playing renders that year's borders on the main
  thread (~5–10 ms/frame) and shows the year (100 → 1,100 AR); hidden on other
  layers. You can watch realms rise, conquer, and fall across the centuries.

### Verified
- `npm test` → **127 passing** (new: snapshot count/order, last == final, borders
  change). Golden hash unchanged (`74c67102ff7abf98`; simulation is downstream).
- In-browser: scrubber shows only on Powers, 41 frames, scrubbing to 100 AR
  changes the borders vs. 1,100 AR, play advances the timeline; screenshot at
  450 AR shows two rival realms mid-consolidation. No leaked workers this time.

### Metrics
- Source modules: 28. Tests: 127. Deps: 0. Engine v0.12.0. 10 map layers.

### Left for next session
- Dynamic settlements (found/abandon over time, animated with the scrubber);
  per-culture languages/lexicons; or in-app gazetteer + client-side exports.

---

## Session 10 — 2026-07-09 — Volcanoes & real heightmaps (user request)

**Theme:** For a friend whose special interest is mountains and volcanoes. Honest
answer up front: the terrain is *plausible*, not geologically simulated — so
instead of faking accuracy, this adds the things that genuinely serve that
interest: real volcanoes, real heightmap exports, and elevation in metres.

### Added
- **L1.6 — Volcanoes** (`src/volcanoes.ts`): stratovolcanoes, shield volcanoes,
  and cinder cones with summit craters, built onto the terrain **before**
  erosion so it carves realistic radial gullies down their flanks. Each is
  placed, sized, named, and flagged active / dormant / extinct.
- **Real 16-bit heightmap exports** (`encodePNGGray16`): the CLI writes a true
  16-bit grayscale heightmap PNG (importable into Blender / Unity / Godot /
  World Machine) plus a raw `.r16`. The app has a **"↓ Heightmap"** button that
  encodes a 16-bit PNG in-browser (via `CompressionStream`).
- **Topographic contour layer** (`renderContours`): hypsometric bands + isolines;
  volcanoes read as concentric rings. New "Topo" layer in the gallery and app.
- **Elevation in metres**: `elevationToMetres`; the meta carries
  `highestPeakMetres` and volcano counts; hover/info/report show heights in m and
  a note on scaling the heightmap.
- **Readability (carried from S9 method):** rainfall/temperature are now
  contrast-stretched *and* terrain-shaded (`renderThematic`).

### Fixed (critical)
- A **latent infinite loop** in `generateReligion`'s origin backfill (it used
  `origins.length` as the loop index, so it could spin forever when that element
  was already an origin). It hung 360px worlds. Now index-based; regression test
  added. This bug predated this session and could have bitten other seeds.

### Verified
- `npm test` → **126 passing** (volcano determinism/placement/crater, 16-bit PNG
  round-trip, religion-loop regression). Golden hash → `74c67102ff7abf98`
  (intentional — terrain changed; samples + bundle regenerated).
- The worker's full 10-layer render pipeline verified in Node (402 ms at 384px).
  *Caveat:* the preview browser's module worker was wedged this session (leaked
  diagnostic workers + tooling flakiness), so end-to-end app confirmation is via
  Node + the unchanged S7–S9 worker architecture, not a live screenshot.

### Decided
- D-018 (volcanoes before erosion; real 16-bit heightmap exports).

### Metrics
- Source modules: 28 (+volcanoes). Tests: 126. Deps: 0. Engine v0.12.0. 10 layers.

### Left for next session
- Confirm the live app in a fresh browser; the queued time scrubber; or more
  volcano/terrain depth (lava fields, calderas, seamount island-arcs).

---

## Session 9 — 2026-07-09 — Closing UX gaps (user feedback)

**Theme:** Not a new layer — a focused pass on four real usability gaps the user
called out. The world had all this depth but you couldn't *find* or *read* much
of it.

### Fixed
1. **Findable features.** The app now draws feature markers + labels
   (Mt. / Lake / R.) directly on the map canvas (view-transformed, always
   visible), plus city/capital labels when zoomed in. Named features were in the
   info panel but nowhere on the map.
2. **Legible resources + a real bug.** Added a per-layer **legend**
   (resources / biomes / faiths) under the map, and hovering the Resources layer
   now **identifies the deposit** (kind + richness). Fixed a placement bug:
   deposits were 63–85% in the north (score/index-ordered greedy placement hit
   the count cap before reaching the south) — now candidates are shuffled before
   greedy spacing, so deposits track the land distribution.
3. **Readable Rainfall & Relief.** Relief is now **hillshaded** grayscale so
   ridges, valleys, and the eroded drainage read clearly (was a flat gradient).
   Rainfall is **contrast-stretched** to the land range **and terrain-shaded**
   (new `renderThematic`) so it's a map, not a flat tan wash. Temperature shares
   the same shading.
4. **Clickable chronicle.** Every simulation event now carries a location; each
   chronicle entry is clickable and **flies the map** to where it happened with a
   highlight pulse. (Fixed a negative-radius `arc` crash in the pulse; the
   animation is `setTimeout`-driven so it runs even when the tab isn't painting.)

### Verified
- `npm test` → **117 passing**; golden hash unchanged (`fb232cd94fe0face`).
- In-browser: deposits spread evenly N/S; legends populate (15 resources / 13
  biomes / 4 faiths); Relief 103 / Rainfall 291 distinct colors (were near-flat);
  clicking a chronicle entry zooms the map to the event; no console errors.

### Decided
- D-017 (spatially-shuffled resource placement to avoid directional bias).

### Metrics
- Tests: 117. Deps: 0. Engine v0.11.0. (No engine version bump — presentation +
  a placement fix.)

### Left for next session
- The queued **time scrubber** (watch borders shift through the centuries), or
  more feedback-driven polish. See `NEXT_SESSION.md`.

---

## Session 8 — 2026-07-09 — Dynamic history: the world simulated forward (L16)

**Theme:** The biggest architectural step since the human world. History stops
being a template and becomes **emergent** — the world is simulated forward over
centuries, and the chronicle, the borders, and each realm's fate all fall out of
the run.

### Added
- **L16 — Simulation** (`src/simulation.ts`): a deterministic tick loop
  (40 turns × 25 years by default). Every region holding a city/town begins as
  a petty realm; across the run:
  - populations grow toward carrying capacity (biome + resources + economy) and
    crash in **famines**;
  - stronger realms **conquer** weaker neighbours — borders shift, realms **fall**;
  - overgrown empires shed **breakaway** states;
  - **plagues/droughts** strike; **faiths spread**; **golden ages** dawn.
  Outputs: the emergent event log, final region→realm control, populations, and
  each realm's rise/peak/fall summary.
- **Powers map** (`renderPowers`): the final political landscape after the
  simulation — a new 9th layer in the gallery, app, and worker.
- **Gazetteer**: static founding events reframed as "Legends of the founding
  age"; a "Rise and fall of realms" table; the emergent chronicle; dominant
  power in the overview.
- **App**: a Powers tab, a "Dominant power" + "Surviving realms" stat, and the
  chronicle now shows the emergent history.

### Verified
- `npm test` → **117 passing** (5 new: determinism, full control coverage,
  emergence, chronology, consistent realm summaries).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser: Powers layer renders, chronicle shows 70+ emergent events
  (conquests, falls, secessions), dominant power + surviving realms shown, no
  console errors. Example: one seed's Masemi consolidated a 26-region empire
  while rivals rose and fell.

### Decided
- D-016 (petty-realm seeding: initial polities from cities *and* towns so the
  simulation consolidates from many states, producing emergent wars).

### Metrics
- Source modules: 27 (+simulation). Tests: 117. Deps: 0. Engine v0.11.0.
  9 map layers.

### Left for next session
- Keep going bigger — see `NEXT_SESSION.md` (a time scrubber to watch history
  unfold; or per-culture languages/lexicons; or in-app gazetteer + exports).

---

## Session 7 — 2026-07-09 — Civilization: resources, economy, faith + a Web Worker

**Theme:** The biggest session yet — three new engine layers that turn the map
into a *civilization*, all surfaced everywhere, plus a platform upgrade so the
live app generates without freezing.

### Added — engine (all downstream of geography; golden hash unchanged)
- **L13 — Resources** (`src/resources.ts`): ~15 resource kinds placed by
  terrain and biome (ore & gems in mountains, timber in forests, grain on
  lowlands, fish on coasts, furs in taiga, spices in jungle, salt in deserts…)
  via per-kind suitability scoring and spaced placement.
- **L14 — Economy** (`src/economy.ts`): each settlement gathers its hinterland's
  deposits to decide what it produces; wealth from production + road
  connectivity + port + capital; trade hubs and the world's major exports.
- **L15 — Religion** (`src/religion.ts`): faiths born in large regions, each with
  a deity, a domain, and a creation myth naming real features; spread across the
  region-adjacency graph so every region has a dominant faith.

### Added — presentation & platform
- **Maps:** two new layers — a **Faiths** map (regions tinted by faith) and a
  **Resources** map (deposit markers) — in the gallery (8 layers/world) and app.
- **Gazetteer:** "Faiths" (deity, domain, myth) and "Resources & trade" (exports,
  wealthiest town, trade hubs, deposit tallies) sections; settlements list wealth
  tier + products.
- **App:** Faiths + Resources tabs; info panel adds Faiths + Exports; click
  detail shows a settlement's wealth/products and a region's faith.
- **Web Worker** (`web/worker.ts`): generation + all-layer rendering run off the
  main thread; the UI never freezes. Layer switching is now an instant buffer
  blit (~2 ms). Added a **"Today's world"** button (date-seeded) and a busy state.

### Verified
- `npm test` → **112 passing** (14 new: resources, economy, religion — placement
  realism, wealth bounds, faith coverage, determinism).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser: worker generates off-thread (status updates immediately), hover/
  click/chronicle work on the structured-cloned world, layer switch instant,
  "Today's world" seeds from the date, no console errors.

### Decided
- D-015 (Web Worker: pre-render layers + structured-clone the world for
  interaction; the engine stays clock-free, the UI supplies dates).

### Metrics
- Source modules: 26 (+resources, economy, religion). Tests: 112. Deps: 0.
  Engine v0.10.0. Live app now 8 map layers.

### Left for next session
- Keep going bigger — see `NEXT_SESSION.md` (a dynamic *simulated* history over
  turns, or an in-app atlas/gazetteer + client-side poster download).

---

## Session 6 — 2026-07-09 — Peoples & lore (L12)

**Theme:** Give the world a human voice — dynasties, rulers, notable figures, and
prose for every region — all downstream of geography, so the physical golden
hash is untouched.

### Added
- **L12 — Lore** (`src/lore.ts`): per-realm **ruling houses** and **ruler
  successions** (reign years + epithets like "the Navigator", "the Cursed"),
  a handful of **notable figures** tied to real places (an explorer of the main
  river, a heretic exiled from the capital, the architect of the great road…),
  and a one-line **prose description for every region** from its climate, coast,
  culture, and towns. Deterministic on a dedicated `lore` stream.
- **Gazetteer** (`report.ts`): new "Ruling houses" and "Notable figures"
  sections, region prose, and the capital's house in the overview.
- **Live app**: a "Ruling house" stat, and region prose in the click detail card.
- Added `lore` to the browser build (18 modules); rebuilt bundle + samples.

### Verified
- `npm test` → **98 passing** (6 new lore tests: determinism, houses+rulers per
  realm, reign chronology, region prose, figures, capital house).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser (live preview): app loads with lore, "Ruling house" stat shows,
  clicking a region reveals its prose, no console errors.

### Metrics
- Source modules: 23 (+lore). Tests: 98. Runtime + build deps: 0. Engine v0.9.0.

### Left for next session
- Improve the flagship app's UX with a **Web Worker** (responsive generation +
  progress), or deepen climate with **latitude wind belts**. See `NEXT_SESSION.md`.

---

## Session 5 — 2026-07-09 — Interactive atlas, CI, and erosion

**Theme:** Make the live map explorable, protect the project with CI, and deepen
the simulation with hydraulic erosion. Three milestones in one session.

### Added
- **P4 — Interactive atlas** (`web/main.ts`): the live generator now supports
  scroll-to-zoom (toward the cursor), drag-to-pan (clamped to the world),
  double-click / "Reset view", a hover tooltip (region + culture, biome,
  elevation, nearest settlement), click-to-pin a detail card, a "Copy link"
  button, and DPR-aware crisp rendering — built on an offscreen buffer + view
  transform.
- **CI** (`.github/workflows/ci.yml`): runs `node --test` on Node 24 and rebuilds
  the browser bundle, failing if the committed `docs/app` is stale. No install
  (zero deps). First run green in 17 s.
- **L1.5 — Hydraulic erosion** (`src/erosion.ts`): deterministic droplet
  simulation carving dendritic valleys, run before hydrology so rivers follow
  them. On by default (`erosion: false` to skip).

### Verified
- `npm test` → **92 passing** (added 5 erosion tests; golden hash → `fb232cd94fe0face`).
- In-browser (live preview eval): zoom/pan redraw correctly, drag suppresses the
  click-pin, hover + click show correct region/settlement data, no console errors.
- CI first run: success (17 s). Regenerated samples + web bundle with eroded terrain.

### Decided
- D-014 (hydraulic erosion on by default; intentional golden-hash change).

### Metrics
- Source modules: 22 (+erosion). Tests: 92. Runtime + build deps: 0. Engine v0.8.0.

### Left for next session
- Deeper simulation or polish — see `NEXT_SESSION.md` (options: latitude wind
  belts, merge islet regions, world-history depth, or a shareable "world of the
  day"). CI + interactivity + erosion are done.

---

## Session 4 — 2026-07-08 — Live in the browser (P2)

**Theme:** Make the engine run in the browser so anyone can type a seed and
watch a world generate live — with **zero dependencies**, even at build time.

### Added
- **`src/hash.ts`** — pure-JS content hash; `world.ts` drops `node:crypto`, so
  the whole generation path is browser-safe. Golden hash → `1b8c816c890e866c`.
- **`scripts/build-web.ts`** — zero-dependency browser build using Node's
  built-in `module.stripTypeScriptTypes` (no esbuild/tsc). Emits browser-safe
  engine modules + app to `docs/app/` (committed; Pages needs no build).
- **`web/main.ts` + `docs/app/index.html`** — the live generator: seed input,
  Random button, 6 layer tabs, Canvas rendering via `putImageData` (renderers
  already return RGBA), an info panel with stats / notable features / chronicle,
  and `?seed=` URL sync. Fully client-side; nothing leaves the browser.
- `docs/index.html`: a "Generate your own" call-to-action to the live app.
- npm scripts `build:web` and `serve`; `serve-docs.ts` now serves directory
  index pages.

### Verified
- `npm test` → **87 passing** (golden hash updated, all else unchanged).
- In-browser (via the live preview): seeds generate in ~270–300 ms, all six
  layers switch correctly, `?seed=` URL updates, zero console errors. Confirmed
  the emitted bundle has **no `node:` imports**.

### Decided
- D-012 (zero-dep browser build via Node type-stripping, not esbuild).
- D-013 (pure-JS content hash; intentional golden-hash change).

### Metrics
- Source modules: 21 (+hash). Tests: 87. Runtime deps: 0 (build deps: 0 too).
  Engine: v0.8.0 (browser + Node).

### Left for next session
- **P4 — Interactive atlas**: pan/zoom the canvas, hover a region for its
  name/stats, click for details. Or deeper simulation (hydraulic erosion).
  See `NEXT_SESSION.md`.

---

## Session 3 — 2026-07-08 — The human world (L7–L11 + presentation)

**Theme:** Populate and narrate the world. In one session: provinces, cultures,
cities, roads, and a written history — plus two presentation firsts (labeled
map posters and world-report gazetteers). The entire "structure & meaning" arc.

### Added
- **L7 — Regions** (`src/regions.ts`): partition land into contiguous provinces
  via spaced seeds + water-respecting multi-source BFS + a coverage pass so
  isolated islands become their own regions. Per-region stats + symmetric
  adjacency. Each region's naming culture is chosen from its climate.
- **L8 — Naming** (`src/names.ts`): syllable-based phonology engine with four
  distinct cultures (Auld / Meridian / Kesh / Sylvan); deterministic per-key namer.
- **L9 — Settlements** (`src/settlements.ts`): a habitability field (climate +
  fresh-water access + low, flat land) drives placement via non-max suppression;
  village/town/city tiers, a capital, port detection, culture-appropriate names.
- **L10 — Roads** (`src/roads.ts`): single multi-source Dijkstra over terrain
  (slope cost, ocean impassable, river bridges) → territory boundaries →
  Kruskal MST → a connected road network with reconstructed paths.
- **L11 — History** (`src/history.ts`): names notable features (peak, main
  river, largest lake), forms realms around cities, and generates a
  chronological chronicle — foundings, realm proclamations, wars between
  neighbours, geography-tied disasters, academies, golden ages.
- **Presentation:** `src/report.ts` (Markdown gazetteer per world) and
  `src/svgmap.ts` (self-contained labeled **SVG poster** — first named-on-map
  output). CLI now emits 7 artifacts; the atlas gallery gained a Political
  layer plus per-world poster + gazetteer links.

### Verified
- `npm test` → **87 passing, 0 failing** (was 59). New invariants: region full-
  partition & area-sum, symmetric adjacency, settlement spacing & capital
  uniqueness, road forest/no-cycle & ocean-avoidance, chronological history,
  SVG well-formedness/escaping, report determinism.
- Elevation untouched → golden hash `54146be48037737d` still green.
- Live gallery verified serving political maps, posters (30 vector labels), and
  gazetteers (HTTP 200 end-to-end).

### Decided
- D-009 (region partition = spaced-seed BFS provinces, not river basins).
- D-010 (roads via territory-boundary Dijkstra + Kruskal MST).
- D-011 (SVG for labels; PNG can't carry text).

### Metrics
- Source modules: 19. Tests: 87. Runtime deps: 0. Engine: v0.8.0.

### Left for next session
- **P2 — Browser build**: run the engine live on the Pages site (type a seed,
  watch a world generate). See `NEXT_SESSION.md` for the bundler decision.

---

## Session 2 — 2026-07-08 — The physical world (L2–L6)

**Theme:** Turn a bare elevation field into a living physical world — water,
climate, rivers, and biomes — in one deep session. Five new layers, each
tested, rendered, and committed.

### Added
- **L2 — Hydrology I** (`src/hydrology.ts`): flood-fill separating connected
  ocean from enclosed lakes, coastline extraction, multi-source BFS
  distance-to-ocean, connected-component counting. Lakes render distinctly.
- **L3 — Temperature** (`src/climate.ts`): latitude cosine curve + elevation
  lapse rate + maritime moderation + regional noise.
- **L4 — Moisture** (`src/climate.ts`): prevailing-wind rain-shadow model
  blended with maritime proximity; orographic rain on windward slopes.
- **L5 — Rivers** (`src/rivers.ts`): Priority-Flood+ε depression filling with an
  inline binary min-heap, building a drainage tree in one pass (every land cell
  drains to the sea, no flats, no cycles); flow accumulation carves rivers.
- **L6 — Biomes** (`src/biomes.ts`): 16-biome Whittaker classifier
  (temperature × moisture) with alpine/snow elevation overrides.
- **Rendering:** temperature/moisture/biome thematic maps, river overlays
  (width by log-flow), lake tinting.
- **Atlas viewer:** `docs/index.html` rebuilt as a cartographic multi-layer
  gallery (5 layers per world, stats, biome legend, light/dark). Samples now
  render all layers; new `scripts/serve-docs.ts` for local preview.

### Verified
- `npm test` → **59 passing, 0 failing** (was 34). New invariants: ocean/lake
  classification, no border lakes, equator > poles, altitude lapse, windward >
  leeward drying, river **mass conservation** (rain in = flow out), drainage
  termination without cycles, biome classification matrix.
- Elevation generation untouched → golden hash `54146be48037737d` still green.
- Visual review of terrain, temperature, moisture, river, and biome maps: all
  coherent (dendritic rivers from highlands to sea, plausible climate bands).

### Decided
- D-006 (no TS `enum` under Node strip-only mode → const objects).
- D-007 (Priority-Flood+ε for drainage; drainage tree from the flood itself).
- D-008 (fixed physical pipeline order elevation→water→temp→moisture→rivers→biomes).

### Metrics
- Source modules: 12. Tests: 59. Runtime deps: 0. Engine: v0.5.0.

### Left for next session
- Begin **L7 — Regions & naming** (segment landmasses, generate place names).
  See `NEXT_SESSION.md`.

---

## Session 1 — 2026-07-08 — Foundation & first light

**Theme:** Stand up a deterministic engine that turns a seed into a rendered map.

### Added
- **Core engine (zero dependencies, TypeScript on Node):**
  - `src/rng.ts` — deterministic mulberry32 PRNG with named, order-independent
    sub-streams (`hashString`, `Rng`, `normalizeSeed`).
  - `src/noise.ts` — value noise, fBm, ridged multifractal.
  - `src/grid.ts` — shared 2D scalar-field type (`Grid`).
  - `src/terrain.ts` — elevation generation (fBm + ridged + continent mask).
  - `src/render.ts` — grayscale + hypsometric (hill-shaded) renderers.
  - `src/png.ts` — dependency-free PNG encoder (zlib + hand-rolled CRC-32).
  - `src/world.ts` — orchestration, metadata, content-hash fingerprint.
  - `src/cli.ts` — `generate` command; `src/index.ts` — public API barrel.
- **Tests:** 34 tests across `tests/` (rng, noise, grid, png, world) — all pass.
  Includes a **golden content-hash** determinism test.
- **Sample gallery:** `scripts/make-samples.ts` generates 6 curated worlds;
  `docs/index.html` is a self-contained GitHub Pages viewer with a map/relief
  toggle.
- **Docs:** README, ARCHITECTURE, ROADMAP, DECISIONS, PROJECT_STATE,
  NEXT_SESSION, CHANGELOG, MIT LICENSE.

### Verified
- `npm test` → 34 passing, 0 failing.
- `node src/cli.ts generate` produces valid PNGs + JSON; canonical world
  (256×256) content hash `54146be48037737d` is locked by test.
- Generation of a 256² world runs in well under 100 ms.
- Visual check: the canonical map renders as a coherent island continent with
  hypsometric tint and hillshaded relief.

### Decided
- D-000…D-005 (see `DECISIONS.md`): project identity, Node/zero-dep stack,
  named RNG streams, golden-hash test, docs-based gallery.

### Metrics
- Files: ~20. Tests: 34. Runtime deps: 0. Golden hash: `54146be48037737d`.

### Shipped / live
- Repo published: https://github.com/anduinmooney/cartogenesis (public, `main`).
- GitHub Pages enabled from `/docs`; gallery live and verified (HTTP 200 on
  page, manifest, and images): https://anduinmooney.github.io/cartogenesis/

### Left for next session
- Begin **L2 — Hydrology I (sea & coasts)**. See `NEXT_SESSION.md`.
