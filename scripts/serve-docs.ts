// serve-docs.ts — Minimal zero-dependency static file server for docs/.
//
// Serves the GitHub Pages folder locally so the atlas viewer can be previewed
// without publishing. Usage: node scripts/serve-docs.ts [port]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const ROOT = "docs";
const port = Number(process.argv[2] ?? 8080);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    // Serve index.html for the root and any directory path (trailing slash).
    if (url.endsWith("/")) url += "index.html";
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, "");
    const path = join(ROOT, rel);
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(port, () => {
  console.log(`Cartogenesis docs served at http://localhost:${port}/`);
});
