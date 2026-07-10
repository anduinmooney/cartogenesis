# Next Session — Session 21

> Read `PROJECT_STATE.md` first, then this. Session 20 (Fable) closed the review
> mandate: three fixes landed, and the world gained its voice — **L17, the
> chronicle told** (`src/narrative.ts`, D-025). The overhaul tail below remains,
> plus two natural follow-ons the narrative layer just made possible.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **201**).
3. Skim `CHANGELOG.md` (top, Session 20) and `DECISIONS.md` (D-025 — the
   narrator's three laws — is required reading before touching narrative).
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`.** New engine
   module → `MODULES`; new `web/` helper → `WEB_MODULES`.
6. **Preview gotcha (NEW, Session 20):** if the Browser pane is the ext-shaped
   Chrome (navigate/javascript_tool instead of preview_eval), it may NOT reach
   sandbox-bound localhost servers at all — `ERR_CONNECTION_REFUSED` while curl
   works. Don't burn time on transport: verify content pipelines in Node (the
   report → renderMarkdown → placePattern path is fully testable there) and
   verify pixels on the DEPLOYED Pages site after push.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share ~55–62%).

## Invariants — know these before you touch anything

- **Exact arithmetic (D-022):** engine uses only `+ - * / sqrt` via `src/exact.ts`;
  a lint test greps for violations outside `render.ts`/`exact.ts`.
- **Three fingerprints** pinned in `tests/world.test.ts` (content `61e751b3`,
  exact `c59c1726`, sim `c38f5de3`). Intentional moves need a DECISIONS note.
- **Names and narrative never perturb the simulation (D-021/D-024/D-025):**
  private `Rng`s, out of the sim's `events`, proven by the pinned fingerprints.
- **The narrator's three laws (D-025):** strictly downstream, total (never omit
  an event), grounded (never invent a fact). New event types must be added to
  the narrative banks AND the total-narration test.
- **`CONCEPTS` in `src/language.ts` is append-only.** Dated things derive from
  `meta.presentYear`. No test may hard-code a simulated outcome for a seed.

**Priority note:** if the user gives new feedback, address that first.

---

# Option A — Narrative follow-ons (build on L17)

The chronicler exists; two voices are within easy reach, same three laws:
- **Founding sagas**: one per culture, opening the gazetteer's Legends section —
  built from that culture's lexicon roots (gloss the compound names into the
  verse: "Vask-heim, the sea-home, first of the harbours"). Small, high charm.
- **A traveller's account**: first-person prose stitched along the actual road
  network from the capital — regions, layered conquest-names, crater lakes,
  lava fields, faiths, in walking order. Bigger; needs a road-walk helper.

**Tests:** same shape as `tests/narrative.test.ts` — determinism, no leakage,
grounding, fingerprints untouched.

---

# Option B — Metre-accurate contour intervals (rendering only; no fingerprints)

`renderContours` uses a uniform interval. Make it metre-aware: choose a round
interval (100/250/500 m) from the world's actual relief, label a few isolines.
Pure `render.ts` change — safe and quick.

---

# Option C — Cleanup: islets, a benchmark, an honest README

- **Islets** (moves fingerprints — deliberate change): merge sub-threshold
  islands (< ~12 cells) into a neighbour or a "Scattered Isles" bucket.
- **Benchmark** (`scripts/bench.ts`): per-layer timings 256²/384²/512², budget
  recorded in PROJECT_STATE.
- **README**: still undersells the project (now missing the chronicle too). One
  honest rewrite — it has earned it.

---

## Recommended order

**A-sagas → B → C.** The sagas are small and complete the L17 arc; B is safe;
C's islets merge is the one heavy item — do it deliberately or leave it. Do not
start a piece without budget to finish AND verify it.

## Close out (do not skip)

1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`. Update golden
   fingerprints only if terrain/sim changed — note *which* moved.
2. Update `CHANGELOG.md` (Session 21), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file.
3. Commit per piece and push; confirm CI green **on CI's Node**; verify the
   deployed app (see checklist item 6 for why localhost may not work).
