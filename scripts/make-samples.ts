// make-samples.ts — Regenerate the committed sample gallery.
//
// Produces a small, curated set of worlds in output/samples/ plus a
// manifest.json the static viewer (docs/) reads. These committed PNGs are the
// project's visible artifacts; everything here is reproducible from seeds.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateWorld } from "../src/world.ts";
import { renderHypsometric, renderGrayscale } from "../src/render.ts";
import { encodePNG } from "../src/png.ts";

const OUT = join("docs", "samples");
const SIZE = 320;

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
  { seed: "vahalia", title: "Vahalia", note: "A rugged mountainous land." },
  { seed: "aurelia-9", title: "Aurelia IX", note: "A temperate heartland." },
];

interface ManifestEntry {
  seed: string;
  title: string;
  note: string;
  map: string;
  height: string;
  landFraction: number;
  contentHash: string;
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const manifest: ManifestEntry[] = [];

  for (const spec of SAMPLES) {
    const world = generateWorld({ seed: spec.seed, width: SIZE, height: SIZE });
    const base = spec.seed.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    const mapFile = `${base}.map.png`;
    const heightFile = `${base}.height.png`;

    writeFileSync(
      join(OUT, mapFile),
      encodePNG(SIZE, SIZE, renderHypsometric(world.elevation, world.meta.seaLevel)),
    );
    writeFileSync(
      join(OUT, heightFile),
      encodePNG(SIZE, SIZE, renderGrayscale(world.elevation)),
    );

    manifest.push({
      seed: spec.seed,
      title: spec.title,
      note: spec.note,
      map: mapFile,
      height: heightFile,
      landFraction: Number((world.meta.landFraction * 100).toFixed(1)),
      contentHash: world.meta.contentHash,
    });

    console.log(
      `  ${spec.title.padEnd(14)} land ${manifest[manifest.length - 1].landFraction}%  hash ${world.meta.contentHash}`,
    );
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ size: SIZE, generatedWith: "0.1.0", worlds: manifest }, null, 2),
  );
  console.log(`\nWrote ${SAMPLES.length} sample worlds + manifest to ${OUT}`);
}

main();
