# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **134**).
3. Skim `CHANGELOG.md` (top, Session 14) and `ROADMAP.md`.
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

The simulation is now genuinely alive: balanced rival powers (S12) whose borders
you can scrub through the centuries (S11), with cities that are founded, sacked,
and abandoned as you watch (S13). Present-day maps show exactly the survivors;
the gazetteer records the ruins. S14 unified the world onto **one timeline**
(start 100 → present 1,100): legends, dynasties, and the chronicle all answer to
`meta.presentYear === simulation.endYear`, and every house has exactly one
reigning monarch.

**Timeline invariant:** if you add anything dated, derive its years from
`meta.presentYear` — never invent a second "present". Three tests guard this.

**Priority note:** if the user gives new feedback, address that first — it beats
any queued plan.

## This session's objective: **Per-culture languages (lexicons)**

Right now each culture has a *phonology* (Auld, Meridian, Kesh, Sylvan) so names
*sound* related, but they share no **vocabulary**. Names are pure syllable soup.
Give each culture a small lexicon so places, people, and faiths of one culture
visibly share roots — the single biggest step in making the world feel authored.

### Design (`src/names.ts`, or a new `src/language.ts`)
1. Give each language a **root lexicon**: a handful of meaningful morphemes
   generated deterministically from the culture (not hand-written English), e.g.
   roots for `water`, `stone`, `high`, `dark`, `holy`, `river`, `fort`, `people`.
   Each root is a syllable cluster in that language's phonology.
2. Give each language **affixes/patterns** for place kinds: `-<fort>` for towns,
   `<high>-<stone>` for peaks, `<holy>-<x>` for temples, etc.
3. Compose names from roots + affixes instead of random syllables, so a coastal
   Auld region reliably yields names sharing the "sea" root, and a peak in Kesh
   territory shares the "high" root with other Kesh peaks.
4. Expose a **glossary** per culture (root → gloss) so the gazetteer can print
   *"Vask-heim: 'sea-home'"* — this is the payoff that makes it legible.

### Integrate & surface
- Keep `makeName(lang, rng)` as the entry point so callers don't change; add
  `makeName(lang, rng, { kind: "town" | "peak" | "river" | "realm" | "deity" })`.
- Gazetteer: a **Languages** section listing each culture's glossary, and gloss
  the notable features ("Mount X — 'the high stone'").
- Determinism: all roots derived from the seed + culture id.

### Test
- Determinism; every language has a full root set; names of a given kind contain
  that kind's root; glosses are non-empty; names stay pronounceable and bounded
  in length.
- **This will change many names** but must NOT change the elevation golden hash
  (`74c67102ff7abf98`) — naming is downstream of geography. Regenerate samples.

### Guardrails
- Deterministic; randomness via streams; zero deps; no TS enums/namespaces.
- Keep names short and readable — the current generator can produce mouthfuls
  ("Leolenvabauvento"); the lexicon is a chance to fix that.

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`.
2. Update `CHANGELOG.md` (Session 15), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file for the next theme.
3. Commit per logical unit and push; confirm CI green and verify the live app on
   a FRESH preview.

## Alternative big directions
- **In-app gazetteer & client-side exports**: render the full report in a
  readable in-app panel; "Download poster (SVG)" / "Download report (MD)"
  generated in the browser.
- **Roads/economy vs. ruins**: recompute roads and the economy on the surviving
  settlements so a highway doesn't run to a dead city (see PROJECT_STATE debt).
- **Deeper terrain**: lava fields, calderas, island-arc seamounts; per-region
  metre-accurate contour intervals on the Topo layer.
