// make-samples.ts — Regenerate the committed sample atlas.
//
// For each curated world it renders map layers (terrain, biomes, political,
// temperature, moisture, relief), writes a labeled SVG poster and a Markdown
// gazetteer, and records everything in manifest.json for the viewer. All
// reproducible from seeds.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateWorld, ENGINE_VERSION } from "../src/world.ts";
import { ruinedSettlementIds } from "../src/simulation.ts";
import {
  renderHypsometric,
  renderRelief,
  renderContours,
  renderBiomes,
  renderRegions,
  renderFaiths,
  renderPowers,
  renderTemperature,
  renderMoisture,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
  overlayResources,
} from "../src/render.ts";
import { encodePNG } from "../src/png.ts";
import { worldReportMarkdown } from "../src/report.ts";
import { worldPosterSVG } from "../src/svgmap.ts";

const OUT = join("docs", "samples");
const SIZE = 360;

interface SampleSpec {
  seed: string;
  title: string;
  /** If omitted, the note is derived from the world's own archetype. */
  note?: string;
}

// A curated spread across the world archetypes (Session 29): a lone continent,
// twin continents, a continent and its isles, an archipelago, and two of the
// rarer shapes — a ring of land about an inland sea, and a supercontinent.
const SAMPLES: SampleSpec[] = [
  { seed: "show-2", title: "Peonacia" },
  { seed: "show-5", title: "Deothu" },
  { seed: "show-9", title: "Bellatelen" },
  { seed: "show-4", title: "Deotelen" },
  { seed: "show-1", title: "Deocia" },
  { seed: "show-32", title: "Deolamma" },
];

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const worlds: unknown[] = [];

  for (const spec of SAMPLES) {
    const world = generateWorld({ seed: spec.seed, width: SIZE, height: SIZE });
    const base = spec.seed.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const w = SIZE;
    const h = SIZE;
    const ruined = ruinedSettlementIds(world.simulation.settlementTimeline);
    const towns = world.settlements.settlements.filter((s) => !ruined.has(s.id));

    // Terrain atlas: hypsometric + rivers + roads + settlements.
    const map = renderHypsometric(world.elevation, world.meta.seaLevel, {
      water: world.water,
    });
    overlayRivers(map, world.rivers, w, h);
    overlayRoads(map, world.roads);
    overlaySettlements(map, towns, w, h);

    // Biome atlas with rivers.
    const biome = renderBiomes(world.biomes, world.elevation);
    overlayRivers(biome, world.rivers, w, h);

    // Political map: regions + roads + settlements.
    const political = renderRegions(world.regions, world.water, world.elevation);
    overlayRoads(political, world.roads);
    const politicalBare = political.slice(); // poster background w/o town dots
    overlaySettlements(political, towns, w, h);

    // Faiths map + resources overlay on terrain.
    const faiths = renderFaiths(world.regions, world.religion, world.water, world.elevation);
    const resources = renderHypsometric(world.elevation, world.meta.seaLevel, {
      water: world.water,
    });
    overlayResources(resources, world.resources.deposits, w, h);

    const powers = renderPowers(world.regions, world.simulation, world.water, world.elevation);

    const layers: Record<string, Uint8Array> = {
      map,
      topographic: renderContours(world.elevation, world.meta.seaLevel, world.meta.maxAltitudeMetres),
      biome,
      political,
      powers,
      faiths,
      resources,
      temperature: renderTemperature(world.temperature, world.water, world.elevation),
      moisture: renderMoisture(world.moisture, world.water, world.elevation),
      height: renderRelief(world.elevation, world.water),
    };

    const files: Record<string, string> = {};
    for (const [layer, pixels] of Object.entries(layers)) {
      const file = `${base}.${layer}.png`;
      writeFileSync(join(OUT, file), encodePNG(w, h, pixels));
      files[layer] = file;
    }

    // Labeled SVG poster (over the political map) + Markdown gazetteer.
    const posterFile = `${base}.poster.svg`;
    writeFileSync(
      join(OUT, posterFile),
      worldPosterSVG(
        world,
        `data:image/png;base64,${encodePNG(w, h, politicalBare).toString("base64")}`,
      ),
    );
    files.poster = posterFile;

    const reportFile = `${base}.report.md`;
    writeFileSync(join(OUT, reportFile), worldReportMarkdown(world));
    files.report = reportFile;

    // The note is the world's own archetype, spoken plainly — plus any rare
    // quirk it drew. No hand-curation: the gallery says what the world is.
    const label = world.meta.worldTypeLabel;
    const derivedNote =
      label.charAt(0).toUpperCase() +
      label.slice(1) +
      (world.meta.worldQuirks.length ? ` — ${world.meta.worldQuirks[0]}.` : ".");
    worlds.push({
      seed: spec.seed,
      title: spec.title,
      note: spec.note ?? derivedNote,
      files,
      stats: {
        worldType: world.meta.worldType,
        worldTypeRare: world.meta.worldTypeRare,
        landFraction: Number((world.meta.landFraction * 100).toFixed(1)),
        oceanFraction: Number((world.meta.oceanFraction * 100).toFixed(1)),
        lakeCount: world.meta.lakeCount,
        biomeDiversity: world.meta.biomeDiversity,
        dominantBiome: world.meta.dominantBiome,
        regionCount: world.meta.regionCount,
        settlementCount: world.meta.settlementCount,
        capital: world.meta.capital,
        realmCount: world.meta.realmCount,
        presentYear: world.meta.presentYear,
        capitalHouse: world.meta.capitalHouse,
        faithCount: world.meta.faithCount,
        majorExports: world.meta.majorExports,
        resourceCount: world.meta.resourceCount,
        dominantPower: world.meta.dominantPower,
        survivingRealms: world.meta.survivingRealms,
        volcanoCount: world.meta.volcanoCount,
        highestPeakMetres: world.meta.highestPeakMetres,
      },
      contentHash: world.meta.contentHash,
    });

    console.log(
      `  ${spec.title.padEnd(14)} ${world.meta.regionCount} regions · ` +
        `${world.meta.settlementCount} towns · cap ${world.meta.capital} · ` +
        `${world.meta.eventCount} events`,
    );
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify(
      {
        size: SIZE,
        engineVersion: ENGINE_VERSION,
        layers: ["map", "topographic", "biome", "political", "powers", "faiths", "resources", "temperature", "moisture", "height"],
        worlds,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${SAMPLES.length} worlds (6 layers + poster + report) to ${OUT}`);
}

main();
