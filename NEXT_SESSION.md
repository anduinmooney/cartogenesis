# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **92**).
3. Skim `CHANGELOG.md` (top, Session 5) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** — CI fails if
   the committed `docs/app` is stale.

## Context: where the project is

The entire original vision is **done** — physical + human world, posters,
gazetteers, a live *interactive* browser generator, hydraulic erosion, and CI.
From here the work is enrichment and depth, not core scope. Pick a substantial
theme and go deep; keep the "one real milestone, fully finished" cadence.

## This session's objective: **L12 — Peoples & lore**

Right now history has realms, wars, and disasters but no *people*. Give the world
rulers, dynasties, and notable figures, and turn the flat region/settlement data
into readable lore. This makes the gazetteer and the app's info panel far richer
with zero risk to the physical golden hash (it all lives on the `history`/naming
streams).

### Build (in `src/history.ts` + a new `src/lore.ts` if it gets big)
1. **Dynasties & rulers.** Each realm gets a ruling house (a surname in the
   region's language) and a succession of rulers with names, reign years, and an
   epithet ("the Navigator", "the Cruel", "the Lawgiver"). Weave a few ruler-
   driven events into the chronicle (a conqueror-king, a boy-king, a usurpation).
2. **Notable figures.** Generate a handful of non-royal figures tied to places:
   an explorer who charted the coast, a heretic exiled from the capital, an
   architect of the great road, a scholar of Lake X. Each references real named
   entities.
3. **Region prose.** A one/two-sentence generated description per region from its
   traits (biome, coast, culture, dominant settlements) — e.g. "A wind-scoured
   coast of fishing towns under the house of …". Deterministic from the seed.
4. **Richer event types.** Add founding-of-institutions, plagues, migrations,
   discoveries, successions — templated with entity substitution as today.

### Surface it
- **Report** (`src/report.ts`): add a "Rulers & houses" section and per-region
  descriptions; expand the chronicle. Keep it valid Markdown.
- **SVG poster / app**: optional — show the capital's ruling house; the app's
  detail card could show a region's prose on click.
- Regenerate `docs/` samples + rebuild the web bundle.

### Test (`tests/lore.test.ts` or extend `history.test.ts`)
- Determinism (same seed → identical rulers/figures/descriptions).
- Every realm has a house + ≥1 ruler; reign years are chronological & sane.
- Region descriptions are non-empty and reference the region's real culture/biome.
- Names use the region's language (culture consistency).

### Guardrails
- All randomness from `Rng` streams (reuse/extend `history`/`names`; add a
  `lore` stream if needed). This must **not** change the elevation golden hash
  `fb232cd94fe0face` — lore is downstream of geography, not part of it.
- Zero deps. No TS enums/namespaces. Keep `main` green and CI passing.

### Close out (do not skip)
1. `npm test` green; `node scripts/make-samples.ts`; `node scripts/build-web.ts`.
2. Update `CHANGELOG.md` (Session 6), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file for the next theme.
3. Commit per logical unit and push; confirm CI goes green.

## Backlog (good alternatives / stretch)
- **Latitude wind belts** in moisture (trade winds vs. westerlies) — climate
  realism (changes golden hash; document).
- **Web Worker** so browser generation never freezes the UI (+ a progress bar).
- **Merge sub-threshold islet regions** so 1-cell "regions" stop cluttering.
- **"World of the day"**: the site seeds a daily world from the date.
- **Benchmark script** tracking per-layer generation time.
