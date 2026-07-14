# Next Session — Session 30

> Read `PROJECT_STATE.md` first, then this. Session 29 was the big one: eight
> world archetypes (D-030) replaced the lone central island — continents,
> twin continents, archipelagos, a supercontinent, a drowned isle-world, a
> ring about an inland sea, a shattered world, plus rare quirks. All three
> fingerprints moved. Every downstream layer was preserved. The world now
> names its own kind. D-027 still governs features: interactivity REVEALS
> pregenerated fact, never authors new story.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **244**).
2. Skim `CHANGELOG.md` (top, Session 29) and `DECISIONS.md` (D-030 before any
   terrain work; D-027/28/29 too).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES` (worldtype.ts is now in it), new web helper → `WEB_MODULES`.
   Then `make-samples` if output changed.
4. **Preview transport:** Browser pane reaches localhost via `preview_start`
   ("docs"); screenshotter usually works now but can wedge — fall back to
   canvas `getImageData` + `window.__cartogenesis` {world, view}. Visual proof:
   push, then screenshot the DEPLOYED site in the user's Chrome (cache-bust).
   **PowerShell corrupts UTF-8 and complex quoting — Node for file edits,
   `git commit -F file`, Write-a-file-then-append for tests. Escape backticks
   in .mjs template literals, and NEVER put a multi-line plain string as a
   sub() arg — use a backtick template literal (bit S29's close script).**
5. War/revolt/plague OR terrain changes → 30-seed balance check (256²: mean
   ~52%, sd ~15 after D-030; multi-continent worlds fragment power).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` via `src/exact.ts`; lint-test
  enforced (cos/sin/atan2/pow banned — worldtype.ts uses squared distances +
  polynomials). Fingerprints pinned: content `5117e368`, exact `8ca93e85`,
  sim `a3a0ce94` (all moved in S29 by D-030) — note which move and why.
- The world archetype is chosen on `root.stream("worldtype")`; sea level is
  the land-fraction quantile (`seaLevelForLandFraction`) unless the caller
  sets `island`/`frequency`/`seaLevel`. Legacy single island via `--no-island`.
- Prose layers never perturb the sim (D-021/24/25); plans and renderers are
  pure functions of the world. `CONCEPTS` append-only. Dated things derive from
  `meta.presentYear`. No test hard-codes a simulated outcome. Sidebar
  linkification runs AFTER innerHTML assignment.
- Run `node scripts/bench.ts` after heavy changes; budget in PROJECT_STATE.

**Priority note:** user feedback first, always.

---

# Option A — Live in the new worlds (reading pass Nº3)

The archetypes are new terrain the human layers have never been read against.
Generate one of EACH archetype and read its full gazetteer end to end: does
an archipelago's chronicle make sense with realms it can't reach across the
sea? Does a ring world's inland-sea coast get named/settled well? Does a
drowned world with few towns still tell a coherent history? Fix what reads
worst. (The reading pass is 3-for-3 at finding real bugs.)

# Option B — Climate & culture follow the new geography

Now that worlds have real oceans and continents, latitude and continentality
mean more: prevailing-wind belts by latitude (currently one west→east wind),
maritime vs continental climate (interiors drier/harsher), and culture spread
that respects the seas. All pure functions of the geography that now exists.

# Option C — Name the seas and continents

A twin-continent or ring world has distinct landmasses and seas that deserve
names (the inland sea, the strait, the two continents). A pure reader of the
water/region layers: label the connected ocean bodies and the major landmasses
in the local tongues, surface them on the map and in the gazetteer.

## Recommended order

**A first** (read the new worlds — the human layers have never met them), then
C (naming seas/continents is the natural next reveal), then B.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved (none
   should, unless a new deliberate D-entry says so).
2. CHANGELOG (Session 30), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green; verify deployed with a cache-busting
   reload; screenshot via the user's Chrome for visual work.
