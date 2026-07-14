# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 27 · 2026-07-13 (Fable)
- **Engine version:** 0.13.0 (runs in Node **and** the browser)
- **Health:** 🟢 Green. 238 tests pass (CI enforced). **Reproducible across
  Node builds and platforms** — the engine uses only exactly-specified
  arithmetic, guarded by an exact bit-level hash (D-022 resolved, Session 16).
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).
- **Live generator:** https://anduinmooney.github.io/cartogenesis/app/ (type a seed, generate in-browser).

## What works today

- Seed → a full **physical AND human world**: elevation (hydraulically eroded),
  oceans/lakes/coasts, temperature, moisture, rivers, 16 biomes, named provinces
  with cultures, cities/ports with a capital, a road network, a written history,
  lore (houses, rulers, figures, prose), natural resources, an economy with
  wealth & trade, faiths with myths, and a **dynamic simulated history** (the
  world run forward over centuries — emergent wars, conquests, and rising and
  falling realms) — all deterministic from the seed.
- **Names you can read.** Each culture has a real lexicon (59 word-roots coined
  in its own phonology); every name is a compound of two of them, glossed. The
  terrain steers the naming, so a port is *the sea haven* and an alpine province
  is *the mountain land*. The gazetteer and the app both print the glossary.
- **Sagas and a traveller.** One founding saga per culture in verse (keeping
  the pre-conquest names the maps gave up), and a named traveller who walks the
  real road network and tells every leg from the actual path cells.
- **Every world its own height, every volcano its own summit.** Worlds
  draw a vertical scale of 2,800–5,900 m; cones rise to their own ceilings
  (D-029). Realm names are unique forever; region prose respects geography;
  rulers wear regnal numbers; foundings are not a metronome.
- **City plans (L19).** Every town — and every ruin — has a street plan
  derived from facts the generator decided: real gates named for real road
  neighbours, harbours facing the real ocean, the real god's temple, the
  real house's keep, walls only where the wars actually crossed. Click a
  town on the map to open it. Pure, deterministic, fingerprint-invisible.
- **History is dated to the year.** Events land on their own years (115,
  116, 120…), never in 25-year blocks — same dynamics, real dates (D-028).
- **The Cartographer's Folio.** The app no longer looks like a dashboard: an
  atlas folio on a leather desk, engraved plate, index-tab layers, wax-seal
  button, a compass rose that leans into every pan. All CSS + one inline SVG.
- **The map tells its story, tab by tab.** Each layer curates its own
  markers: Faiths names every faith on its ground (and stars where it arose),
  Powers shows realm names that follow the time scrubber plus each era's
  events as glyphs (war, revolt, plague, famine, ruin, founding), Political
  names every region and marks fallen towns with a dagger.
- **No province is a lone skerry.** Islands under 12 cells merge into the
  nearest coastal province (D-026) — gazetteer tables are clean, and island
  microstates no longer survive every war by being unreachable.
- **Everything referenced is explained.** A full entity index backs the app:
  hover any name — ruler, realm, house, faith, god, town, old town name — for a
  tooltip, anywhere it appears; click flies to it. Chronicle clicks drop a
  labelled pin at the event.
- **Every world counts its own years.** A year-zero origin event (the Great
  Burning of a real volcano, the Landing, the Long Winter…) explains the
  reckoning; every date wears the world's own suffix (A.B., A.L., …).
- **Every chronicler has a voice.** Plain, wry, or grave — one per world —
  choosing the opening, sign-off, and rare asides; sentence FRAMES vary so the
  telling never falls back into "[date] X did Y" (measured and test-pinned).
- **The chronicle, told.** An in-world chronicler (L17) narrates the simulated
  centuries as real prose — named ages, realm introductions, rivalry memory,
  falls attached to their conquests — deterministic to the letter and proven
  never to perturb the simulation (D-025). It is the gazetteer's centrepiece;
  the raw dated record remains as the Annals.
- **Conquest layers the map.** Hold a foreign-culture region long enough and its
  towns are renamed — the land-word kept in the old tongue, the settlement-word
  re-said in the ruler's (Kesh *Khaimghekh* → *Khaimdund* under Auld rule). The
  old name is remembered; the gazetteer has a "Names remade by conquest" section.
- **The whole gazetteer, in the app.** A 📖 Gazetteer view renders the full
  written dossier (languages, houses, ruins, faiths, trade) with a table of
  contents, and every place-name in it is clickable and flies the map there. Plus
  **client-side exports**: download the current map (PNG), a labeled poster
  (SVG), the report (Markdown), or the 16-bit heightmap — all built in-browser.
- Ten rendered map layers (terrain, **topographic**, biomes, political, powers,
  faiths, resources, temperature, rainfall, relief) + a labeled SVG poster + a
  Markdown gazetteer with an emergent chronicle.
- **Real volcanoes** (named, active/dormant/extinct) that carry geology: a big
  one may collapse into a **caldera** cradling a **crater lake**, and an active
  one bleeds **lava fields** (a basalt biome nobody settles on) down its flanks,
  and some chain into **island arcs**. Plus **real 16-bit heightmap exports**
  (PNG + raw `.r16`) for 3D tools;
  elevation in metres.
- An **interactive** in-browser generator (`docs/app/`) that generates in a **Web
  Worker** (no UI freeze): pan, zoom, hover to inspect (incl. resource deposits +
  elevation in metres), click for details, feature/volcano/city labels on the
  map, a per-layer legend, a clickable chronicle that flies to each event, a
  **time scrubber on the Powers layer** (play/scrub 100→1,100 AR to watch borders
  shift **and cities rise and fall**), a 16-bit **heightmap download**, `?seed=`
  links, and "Today's world".
- **Dynamic settlements:** every town has a founding year; some are sacked or
  abandoned into **ruins**. Present-day maps show exactly the survivors, and the
  gazetteer records what history swallowed.
- Per world the CLI emits **10 artifacts**: terrain / biome / political /
  topographic map PNGs, a relief preview, a **real 16-bit heightmap** (PNG + raw
  `.r16`), a **labeled SVG poster**, a **Markdown gazetteer**, and JSON metadata
  with a `contentHash` fingerprint.
- CLI: `node src/cli.ts generate --seed <s> [--width --height --sea-level …]`.
- **Balanced history:** outcomes vary by world — some fragment among rival
  powers, some unify under an empire (mean top-power share ~59%, not ~94%).
- 238 passing tests, incl. exact + simulation determinism guards, an
  approximated-math lint, river mass-conservation, road
  no-cycle, region full-partition, and a balance-of-power regression guard.
- A 6-world **multi-layer atlas** (6 layers + posters + gazetteers) + viewer
  under `docs/`; local preview via `node scripts/serve-docs.ts`.

## Current layers (see ROADMAP.md for the full plan)

| Layer | Status |
|-------|--------|
| L0 RNG & noise · L1 Elevation · L1.5 Erosion · L1.6 Volcanoes | ✅ done |
| L2 Hydrology · L3 Temp · L4 Moisture | ✅ done |
| L5 Rivers · L6 Biomes | ✅ done |
| L7 Regions · L8 Naming | ✅ done |
| L9 Settlements · L10 Roads · L11 History | ✅ done |
| L12 Lore (houses, rulers, figures, prose) | ✅ done |
| L13 Resources · L14 Economy · L15 Religion | ✅ done |
| L16 Dynamic history (world simulation) | ✅ done |
| P1 SVG poster · P3 World report | ✅ done |
| P2 Browser build · P4 interactive atlas | ✅ done |
| Web Worker (responsive app) · CI | ✅ done |
| Time scrubber (temporal atlas) · balance of power | ✅ done |
| Dynamic settlements (foundings, ruins) · one timeline | ✅ done |
| L8.5 Languages (lexicons, glosses, phrasebook) | ✅ done |
| Present-day roads & economy (survivors only) | ✅ done |
| In-app gazetteer · client-side exports (PNG/SVG/MD) | ✅ done |
| Exact cross-engine determinism (D-022) | ✅ done |
| Deeper terrain: calderas · crater lakes · lava fields | ✅ done |
| Language contact (conquest layers place-names) | ✅ done |
| Seamount arcs (volcano chains) | ✅ done |
| L17 Narrative (the chronicle, told) | ✅ done |
| L17b/c Sagas · traveller's account | ✅ done |
| Entity tooltips everywhere · chronicle event pins | ✅ done |
| Metre-accurate contours (index lines) · benchmark · honest README | ✅ done |
| Per-world calendars (year-zero origins) | ✅ done |
| Layer-scoped map markers (faiths · realms · ruins · era events) | ✅ done |
| Islets merge (D-026, declared sim-hash move) | ✅ done |
| The Cartographer's Folio (full app redesign, twice refined) | ✅ done |
| L18 expeditions — built, then removed (D-027) | ↩ reversed |
| Year-by-year history (D-028) | ✅ done |
| L19 city plans (every town, every ruin) | ✅ done |
| Reading pass Nº2: five defects fixed (D-029) | ✅ done |
| Capital plan in the gazetteer · ruins "as it stood" | ✅ done |
| Chronicler voices · sentence frames · widened banks | ✅ done |
| narrative polish · reading pass · more | 🔜 the world keeps deepening |

## How to run (cold start)

```bash
node --version            # need ≥ 22.6
npm test                  # 238 tests, all offline
node src/cli.ts generate --seed hello   # writes 10 artifacts to ./output
node scripts/make-samples.ts   # rebuild docs/ atlas (maps + posters + reports)
node scripts/build-web.ts      # rebuild docs/app/ browser bundle (after src/ edits!)
node scripts/serve-docs.ts     # preview docs/ + docs/app/ at http://localhost:8123
```

No `npm install` is required — there are zero dependencies.

## Performance budget (Session 22 baseline — `node scripts/bench.ts`)

| Measure | Budget (median) |
|---------|-----------------|
| generateWorld 256² | ~370 ms |
| generateWorld 384² (the app's size) | ~620 ms |
| generateWorld 512² | ~1,050 ms |
| Heaviest stages at 384² | erosion ~85 ms · roads ~65 ms · rivers ~57 ms |

Re-run the bench after heavy changes; investigate anything 2× over budget.

## Key invariants (don't break these)

1. Generation is a pure function of seed + config. No `Math.random`, no clock.
2. Subsystems use `root.stream("name")` for randomness (order-independent).
3. The three fingerprints in `tests/world.test.ts` (`contentHash` quantized,
   `exactHash` bit-level, `simulationHash`) must stay green, or be updated with a
   `DECISIONS.md` entry explaining the intentional change.
4. The engine uses only exactly-specified arithmetic (`+ - * / sqrt`, via
   `src/exact.ts`). No `Math.hypot/pow/cos/…` or `**` outside `render.ts` — a
   test enforces this (D-022). `render.ts` is exempt; pixels are not world state.
5. Anything dated derives its years from `meta.presentYear`. Never invent a
   second "present".
6. `CONCEPTS` in `src/language.ts` is **append-only**. Inserting a concept
   re-rolls every root after it and renames every world.

## Known limitations / debt

- `docs/app/*.js` are **build artifacts** (type-stripped from `src/`). After any
  `src/` change, rerun `node scripts/build-web.ts` or the live app goes stale.
- **Terrain is plausible, not geologically accurate** — fractal noise + hydraulic
  erosion + procedural volcanoes; no tectonics/real volcanism. The heightmap
  exports are real 16-bit files, but the *shapes* are invented, not Earth data.
- Don't create `new Worker` in `preview_eval` without `.terminate()` — leaked
  workers wedge the whole preview browser (this bit Session 10; a fresh start
  fixed it in Session 11).
- Moisture runs a single west→east prevailing wind; latitude wind belts would be
  more realistic (future tuning).
- Tests must never hard-code a *simulated* outcome for a seed (which seed has
  ruins depends on chaotic last-bit dynamics — even now that the arithmetic is
  exact, it is fragile to any algorithm tweak). Discover one at run time; fail
  loudly if none does. `tests/coherence.test.ts` shows the pattern.
- No TS `enum`/namespaces/decorators — Node strip-only mode rejects them.
- Remember: after any `src/` change, rerun `build:web` (CI now enforces this).

## Pointers

- Roadmap & success criteria → `ROADMAP.md`
- Why things are the way they are → `DECISIONS.md`
- Session history → `CHANGELOG.md`
- **The exact next task → `NEXT_SESSION.md`** — Session 16 is a deliberate
  multi-phase **overhaul** (user's explicit ask): exact arithmetic (D-022), the
  in-browser gazetteer, client-side exports, calderas & lava fields, language
  contact, islets + a benchmark. Each phase is a committable unit; Phase 0 first.
- How to extend safely → `ARCHITECTURE.md`
