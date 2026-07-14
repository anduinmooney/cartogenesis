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
  "exact",
  "noise",
  "grid",
  "terrain",
  "volcanoes",
  "erosion",
  "hydrology",
  "climate",
  "rivers",
  "biomes",
  "language",
  "names",
  "regions",
  "settlements",
  "roads",
  "history",
  "lore",
  "resources",
  "economy",
  "religion",
  "simulation",
  "render",
  "narrative",
  "saga",
  "journey",
  "cityplan",
  "report",
  "svgmap",
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

  // Web-side helper modules (not engine): they live in web/ and are emitted to
  // docs/app/ next to app.js, which imports them as "./name.js".
  const WEB_MODULES = ["markdown"];
  for (const m of WEB_MODULES) {
    const src = readFileSync(join("web", `${m}.ts`), "utf8");
    writeFileSync(join(APP_DIR, `${m}.js`), toBrowserJs(src));
  }

  const appSrc = readFileSync(join("web", "main.ts"), "utf8");
  const appJs = toBrowserJs(appSrc);
  writeFileSync(join(APP_DIR, "app.js"), appJs);

  const workerSrc = readFileSync(join("web", "worker.ts"), "utf8");
  const workerJs = toBrowserJs(workerSrc);
  writeFileSync(join(APP_DIR, "worker.js"), workerJs);

  // Completeness check: every ./engine/*.js an emitted file imports must exist,
  // so a missing module fails the build instead of 404-ing in the browser.
  const emitted = new Set([...MODULES, ...WEB_MODULES]);
  const engineFiles = MODULES.map((m) => ({
    name: m,
    code: readFileSync(join(ENGINE_DIR, `${m}.js`), "utf8"),
  }));
  engineFiles.push({ name: "app", code: appJs });
  engineFiles.push({ name: "worker", code: workerJs });
  for (const { name, code } of engineFiles) {
    for (const match of code.matchAll(/from\s+["'](?:\.\/engine\/|\.\/)([\w-]+)\.js["']/g)) {
      const dep = match[1];
      if (!emitted.has(dep)) {
        throw new Error(
          `build-web: "${name}" imports "${dep}" which is not in the browser ` +
            `module list. Add it to MODULES (and confirm it has no node: imports).`,
        );
      }
    }
  }

  console.log(
    `Built ${MODULES.length} engine modules + app.js + worker.js → ${APP_DIR}/ (zero deps)`,
  );
}

main();
