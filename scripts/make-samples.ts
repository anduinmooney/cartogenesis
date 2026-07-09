// make-samples.ts — Regenerate the committed sample atlas.
//
// For each curated world it renders five layers (physical map, biomes,
// temperature, moisture, relief) and writes a manifest.json the viewer reads.
// Everything is reproducible from seeds.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateWorld } from "../src/world.ts";
import {
  renderHypsometric,
  renderGrayscale,
  renderBiomes,
  renderTemperature,
  renderMoisture,
  overlayRivers,
} from "../src/render.ts";
import { encodePNG } from "../src/png.ts";

const OUT = join("docs", "samples");
const SIZE = 360;

interface SampleSpec {
  seed: string;
  title: string;
  note: string;
}

const SAMPLES: SampleSpec[] = [
  { seed: "cartogenesis", title: "Cartogenesis", note: "The canonical world." },
  { seed: "atlas", title: "Atlas", note: "A fragmented archipelago." },
  { seed: "borea", title: "Borea", note: "A broad northern continent." },
  { seed: "mistral", title: "Mistral", note: "Scattered coastal isles." },
  { seed: "vahalia", title: "Vahalia", note: "A rugged, river-veined land." },
  { seed: "aurelia-9", title: "Aurelia IX", note: "A temperate heartland." },
];

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const worlds: unknown[] = [];

  for (const spec of SAMPLES) {
    const world = generateWorld({ seed: spec.seed, width: SIZE, height: SIZE });
    const base = spec.seed.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const w = SIZE;
    const h = SIZE;

    // Physical map with rivers.
    const map = renderHypsometric(world.elevation, world.meta.seaLevel, {
      water: world.water,
    });
    overlayRivers(map, world.rivers, w, h);

    // Biome atlas with rivers.
    const biome = renderBiomes(world.biomes, world.elevation);
    overlayRivers(biome, world.rivers, w, h);

    const layers: Record<string, Uint8Array> = {
      map,
      biome,
      temperature: renderTemperature(world.temperature, world.water),
      moisture: renderMoisture(world.moisture, world.water),
      height: renderGrayscale(world.elevation),
    };

    const files: Record<string, string> = {};
    for (const [layer, pixels] of Object.entries(layers)) {
      const file = `${base}.${layer}.png`;
      writeFileSync(join(OUT, file), encodePNG(w, h, pixels));
      files[layer] = file;
    }

    worlds.push({
      seed: spec.seed,
      title: spec.title,
      note: spec.note,
      files,
      stats: {
        landFraction: Number((world.meta.landFraction * 100).toFixed(1)),
        oceanFraction: Number((world.meta.oceanFraction * 100).toFixed(1)),
        lakeCount: world.meta.lakeCount,
        riverFraction: Number((world.meta.riverFraction * 100).toFixed(2)),
        mainRiverFlow: world.meta.mainRiverFlow,
        biomeDiversity: world.meta.biomeDiversity,
        dominantBiome: world.meta.dominantBiome,
      },
      contentHash: world.meta.contentHash,
    });

    console.log(
      `  ${spec.title.padEnd(14)} land ${world.meta.landFraction.toFixed(2)} · ` +
        `${world.meta.lakeCount} lakes · ${world.meta.biomeDiversity} biomes · ` +
        `dominant ${world.meta.dominantBiome}`,
    );
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify(
      {
        size: SIZE,
        engineVersion: "0.5.0",
        layers: ["map", "biome", "temperature", "moisture", "height"],
        worlds,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${SAMPLES.length} worlds x 5 layers + manifest to ${OUT}`);
}

main();
