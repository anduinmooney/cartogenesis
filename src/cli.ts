// cli.ts — Command-line entry point for the Cartogenesis engine.
//
// Usage:
//   node src/cli.ts generate [options]
//
// Options:
//   --seed <value>       World seed (string or number). Default: "cartogenesis".
//   --width <n>          Map width in cells. Default: 512.
//   --height <n>         Map height in cells. Default: 512.
//   --sea-level <0..1>   Ocean threshold. Default: 0.4.
//   --frequency <n>      Base noise frequency. Default: engine default.
//   --octaves <n>        fBm octaves. Default: engine default.
//   --no-island          Disable the radial continent mask.
//   --out <dir>          Output directory. Default: ./output.
//   --name <str>         Basename for output files. Default: derived from seed.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateWorld, worldToJSON, type WorldConfig } from "./world.ts";
import {
  renderHypsometric,
  renderGrayscale,
  renderBiomes,
  renderRegions,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
} from "./render.ts";
import { encodePNG } from "./png.ts";
import { worldReportMarkdown } from "./report.ts";
import { worldPosterSVG } from "./svgmap.ts";

interface CliOptions extends WorldConfig {
  out: string;
  name: string;
}

function parseArgs(argv: string[]): { command: string; opts: CliOptions } {
  const command = argv[0] ?? "generate";
  const opts: CliOptions = {
    seed: "cartogenesis",
    out: "output",
    name: "",
  };

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--seed":
        opts.seed = next();
        break;
      case "--width":
        opts.width = Number(next());
        break;
      case "--height":
        opts.height = Number(next());
        break;
      case "--sea-level":
        opts.seaLevel = Number(next());
        break;
      case "--frequency":
        opts.frequency = Number(next());
        break;
      case "--octaves":
        opts.octaves = Number(next());
        break;
      case "--no-island":
        opts.island = false;
        break;
      case "--out":
        opts.out = next();
        break;
      case "--name":
        opts.name = next();
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return { command, opts };
}

function slugify(seed: number | string): string {
  return String(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "world";
}

function runGenerate(opts: CliOptions): void {
  const started = Date.now();
  const world = generateWorld(opts);
  const name = opts.name || slugify(opts.seed);

  mkdirSync(opts.out, { recursive: true });
  const W = world.elevation.width;
  const H = world.elevation.height;
  const towns = world.settlements.settlements;

  // Terrain atlas: hypsometric + rivers + roads + settlements.
  const mapPixels = renderHypsometric(world.elevation, world.meta.seaLevel, {
    water: world.water,
  });
  overlayRivers(mapPixels, world.rivers, W, H);
  overlayRoads(mapPixels, world.roads);
  overlaySettlements(mapPixels, towns, W, H);
  const mapPng = encodePNG(W, H, mapPixels);

  // Biome atlas: biomes + rivers.
  const biomePixels = renderBiomes(world.biomes, world.elevation);
  overlayRivers(biomePixels, world.rivers, W, H);
  const biomePng = encodePNG(W, H, biomePixels);

  // Political map: regions + roads + settlements.
  const polPixels = renderRegions(world.regions, world.water, world.elevation);
  overlayRoads(polPixels, world.roads);
  overlaySettlements(polPixels, towns, W, H);
  const politicalPng = encodePNG(W, H, polPixels);

  const heightPng = encodePNG(W, H, renderGrayscale(world.elevation));

  // Labeled SVG poster over the political map + Markdown gazetteer.
  const posterSvg = worldPosterSVG(world, politicalPng);
  const reportMd = worldReportMarkdown(world);

  const mapPath = join(opts.out, `${name}.map.png`);
  const biomePath = join(opts.out, `${name}.biome.png`);
  const politicalPath = join(opts.out, `${name}.political.png`);
  const heightPath = join(opts.out, `${name}.height.png`);
  const posterPath = join(opts.out, `${name}.poster.svg`);
  const reportPath = join(opts.out, `${name}.report.md`);
  const metaPath = join(opts.out, `${name}.json`);

  writeFileSync(mapPath, mapPng);
  writeFileSync(biomePath, biomePng);
  writeFileSync(politicalPath, politicalPng);
  writeFileSync(heightPath, heightPng);
  writeFileSync(posterPath, posterSvg);
  writeFileSync(reportPath, reportMd);
  writeFileSync(metaPath, worldToJSON(world));

  const ms = Date.now() - started;
  console.log(`Cartogenesis v${world.meta.engineVersion}`);
  console.log(`  seed:          ${world.meta.seed}`);
  console.log(`  size:          ${world.meta.width}x${world.meta.height}`);
  console.log(`  sea level:     ${world.meta.seaLevel}`);
  console.log(
    `  land fraction: ${(world.meta.landFraction * 100).toFixed(1)}%`,
  );
  console.log(
    `  ocean / lakes: ${(world.meta.oceanFraction * 100).toFixed(1)}% ocean, ` +
      `${world.meta.lakeCount} lake(s) (${(world.meta.lakeFraction * 100).toFixed(1)}%)`,
  );
  console.log(
    `  rivers:        ${(world.meta.riverFraction * 100).toFixed(1)}% of map, ` +
      `main flow ${world.meta.mainRiverFlow}`,
  );
  console.log(
    `  biomes:        ${world.meta.biomeDiversity} types, ` +
      `dominant: ${world.meta.dominantBiome}`,
  );
  console.log(
    `  regions:       ${world.meta.regionCount} (largest: ${world.meta.largestRegion})`,
  );
  console.log(
    `  settlements:   ${world.meta.settlementCount}, capital: ${world.meta.capital}`,
  );
  console.log(
    `  history:       ${world.meta.realmCount} realms, ${world.meta.eventCount} events, ` +
      `present year ${world.meta.presentYear}`,
  );
  console.log(`  content hash:  ${world.meta.contentHash}`);
  console.log(`  generated in:  ${ms} ms`);
  console.log(`  wrote:         ${mapPath}`);
  console.log(`                 ${biomePath}`);
  console.log(`                 ${politicalPath}`);
  console.log(`                 ${heightPath}`);
  console.log(`                 ${posterPath}`);
  console.log(`                 ${reportPath}`);
  console.log(`                 ${metaPath}`);
}

function main(): void {
  const { command, opts } = parseArgs(process.argv.slice(2));
  switch (command) {
    case "generate":
      runGenerate(opts);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(
        "Cartogenesis — deterministic procedural world generator\n\n" +
          "Usage: node src/cli.ts generate [--seed s] [--width n] [--height n]\n" +
          "       [--sea-level 0..1] [--frequency n] [--octaves n] [--no-island]\n" +
          "       [--out dir] [--name str]",
      );
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Try: node src/cli.ts help");
      process.exit(1);
  }
}

main();
