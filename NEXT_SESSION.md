# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **155**).
3. Skim `CHANGELOG.md` (top, Session 15) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces
   it; it also fails if a browser module — engine/app/worker — imports one you
   forgot to add to the MODULES list).
6. **Preview discipline:** never create `new Worker` in `preview_eval` without
   `.terminate()` — a leaked worker wedges the whole Browser pane.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share should stay ~55–60%, with a few
   worlds unified and several fragmented). The regression test only catches gross
   failures, not drift.

## Context: where the project is

The simulation is alive: balanced rival powers (S12) whose borders you can scrub
through the centuries (S11), with cities founded, sacked, and abandoned as you
watch (S13), all on one authoritative timeline (S14).

S15 gave the world **language**. Every culture has a lexicon of 59 word-roots
coined in its own phonology; every name is a compound of two of them and carries
a gloss, so `Deoliria` is *the sea haven*. The terrain steers the naming. The
gazetteer and the app both print the glossary. S15 also made roads and the
economy **present-day**: they are rebuilt on the survivors after the simulation,
so no highway runs to a dead city.

### Invariants worth knowing before you touch anything
- **Timeline:** anything dated derives its years from `meta.presentYear`. Never
  invent a second "present". (3 tests.)
- **`CONCEPTS` in `src/language.ts` is append-only.** Inserting a concept
  re-rolls every root after it and renames every world. (D-021.)
- **Lexicons are per-culture, not per-world.** `vyvask` is water in Auld
  everywhere. Don't "improve" this by seeding it from the world.
- **Names never perturb the simulation.** They draw from private `Rng`s keyed by
  a string. If you change that, the balance-of-power distribution moves.

**Priority note:** if the user gives new feedback, address that first — it beats
any queued plan.

## This session's objective: **The gazetteer in the browser**

The engine now knows far more about a world than the app shows. The Markdown
report has languages, ruling houses with thousand-year king-lists, ruins, faiths
and their myths, region prose, resources and trade — and none of it is reachable
from `docs/app/`, which is the only place most people will ever meet this
project. Close that gap, and let people take the world with them.

### 1. An in-app gazetteer panel
- `src/report.ts` already builds the whole dossier as Markdown from a `World`.
  It runs in the browser unchanged — add `report` to the MODULES list in
  `scripts/build-web.ts` (it imports `world.ts`, `biomes.ts`, `resources.ts`,
  `language.ts`, `names.ts`; all already bundled).
- Add a **"Gazetteer" view** to the app: a full-height scrollable pane (a tab
  next to the map, or a slide-over) rendering the report.
- You need a *tiny* Markdown renderer — headings, bold, italic, tables, lists,
  links. **Do not add a dependency.** ~80 lines of regex-and-split is enough for
  the exact subset `report.ts` emits, and you control both ends. Escape HTML
  first, then format.
- Make it **navigable**: a table of contents from the `##` headings, and make
  place-names in the gazetteer clickable — reuse the existing `flyTo` so
  clicking *Deoliria* flies the map to it. (Settlements, regions, volcanoes and
  the notable features all have `x`/`y` or can be looked up by name.)

### 2. Client-side exports
All of these are pure functions already; nothing needs a server.
- **Download report (`.md`)** — `worldReportMarkdown(world)` → Blob → anchor.
- **Download poster (`.svg`)** — `src/svgmap.ts` `posterSvg(world)` → Blob.
- **Download map (`.png`)** — the active layer, at world resolution, via
  `canvas.toBlob()` on the offscreen canvas (not the zoomed view canvas).
- Group them with the existing **↓ Heightmap** button into a small "Export" row
  so the toolbar doesn't sprawl.

### Test
- A Markdown-renderer unit test: headings, tables, lists, emphasis, and that it
  **escapes HTML** (feed it `<script>` in a world name and assert it doesn't
  survive as a tag).
- `worldReportMarkdown` runs in the browser bundle: assert `build-web.ts` emits
  `report.js` and that the completeness check passes.
- Determinism: same seed → identical report string.

### Guardrails
- Deterministic; randomness via streams; zero deps; no TS enums/namespaces.
- Must NOT change the elevation golden hash (`74c67102ff7abf98`).
- The report is *long* (thousand-year king-lists). Virtualize or collapse by
  section — don't drop 4,000 DOM nodes into the page on every generate.

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`.
2. Update `CHANGELOG.md` (Session 16), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file for the next theme.
3. Commit per logical unit and push; confirm CI green and verify the live app on
   a FRESH preview.

## Alternative big directions
- **Deeper terrain** (the mountain-and-volcano friend): lava fields and flow
  paths, calderas that hold crater lakes, island-arc seamount chains,
  metre-accurate per-region contour intervals on the Topo layer.
- **Language contact:** when a realm conquers a region of another culture, the
  place-names should *layer* — a Kesh town under Auld rule keeps its Kesh root
  and gains an Auld suffix. This is how real toponymy works and the lexicon
  makes it possible for the first time.
- **Islets:** tiny single-cell islands become their own 1-cell "regions",
  cluttering gazetteers. Merge sub-threshold islets into their nearest neighbour.
