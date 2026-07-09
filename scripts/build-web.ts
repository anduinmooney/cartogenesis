// build-web.ts — Build the browser bundle with ZERO dependencies.
//
// Node can strip TypeScript types natively (module.stripTypeScriptTypes), so we
// don't need esbuild/tsc/webpack. This emits the browser-safe engine modules as
// plain ES modules under docs/app/engine/ and the app entry as docs/app/app.js,
// rewriting ".ts" import specifiers to ".js". The result is committed so GitHub
// Pages serves it with no build — the runtime stays dependency-free.
//
// Only browser-safe modules are emitted: png.ts (node:zlib), svgmap.ts (Buffer),
// cli.ts, and index.ts are intentionally excluded.

import { stripTypeScriptTypes } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// The engine dependency graph reachable from world.ts + render.ts (no Node deps).
const MODULES = [
  "rng",
  "hash",
  "noise",
  "grid",
  "terrain",
  "hydrology",
  "climate",
  "rivers",
  "biomes",
  "names",
  "regions",
  "settlements",
  "roads",
  "history",
  "render",
  "world",
];

const APP_DIR = join("docs", "app");
const ENGINE_DIR = join(APP_DIR, "engine");

function toBrowserJs(src: string): string {
  let js = stripTypeScriptTypes(src, { mode: "strip" });
  // Rewrite module specifiers: "./x.ts" -> "./x.js", "./engine/x.ts" -> ".js".
  js = js.replace(/(from\s+["'])([^"']+?)\.ts(["'])/g, "$1$2.js$3");
  return js;
}

function main(): void {
  mkdirSync(ENGINE_DIR, { recursive: true });

  for (const m of MODULES) {
    const src = readFileSync(join("src", `${m}.ts`), "utf8");
    writeFileSync(join(ENGINE_DIR, `${m}.js`), toBrowserJs(src));
  }

  const appSrc = readFileSync(join("web", "main.ts"), "utf8");
  writeFileSync(join(APP_DIR, "app.js"), toBrowserJs(appSrc));

  console.log(
    `Built ${MODULES.length} engine modules + app.js → ${APP_DIR}/ (zero deps)`,
  );
}

main();
