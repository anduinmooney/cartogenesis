// web/main.ts — The in-browser Cartogenesis app (interactive atlas).
//
// Runs the exact same engine as the CLI (the build step type-strips src/ into
// docs/app/engine/*.js) and draws layers to a <canvas>. The renderers already
// return RGBA byte arrays, so a layer becomes an offscreen ImageData; the
// visible canvas then blits it under a pan/zoom view transform. Hovering reads
// back the underlying World (regions, biomes, elevation, settlements) to inspect
// any point; clicking pins a detail card.

import type { World } from "./engine/world.ts";
import { BIOME_NAMES, BIOME_COLORS } from "./engine/biomes.ts";
import { RESOURCE_NAMES, RESOURCE_COLORS } from "./engine/resources.ts";
import type { Settlement } from "./engine/settlements.ts";

// Faith tint palette — mirrors FAITH_PALETTE in src/render.ts.
const FAITH_PALETTE = [
  [196, 120, 90],
  [96, 150, 180],
  [150, 170, 100],
  [170, 110, 170],
  [200, 175, 90],
];

// Generation runs in a module worker so the UI never freezes.
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
let layerBuffers: Record<string, Uint8Array> = {};
let genStart = 0;

const SIZE = 384;

const LAYERS: Array<[string, string]> = [
  ["terrain", "Terrain"],
  ["biome", "Biomes"],
  ["political", "Political"],
  ["powers", "Powers"],
  ["faiths", "Faiths"],
  ["resources", "Resources"],
  ["temperature", "Temperature"],
  ["moisture", "Rainfall"],
  ["height", "Relief"],
];

let current: World | null = null;
let activeLayer = "terrain";

// View transform: canvasPx = worldPx * scale + offset (in backing-store pixels).
const view = { scale: 1, ox: 0, oy: 0 };

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("map") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const seedInput = $("seed") as HTMLInputElement;
const tip = $("tip");

// Offscreen buffer holding the current layer at world resolution.
const offscreen = document.createElement("canvas");
offscreen.width = SIZE;
offscreen.height = SIZE;
const offCtx = offscreen.getContext("2d")!;

/** Blit the active layer's pre-rendered buffer into the offscreen canvas. */
function renderOffscreen(): void {
  if (!current) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  const rgba = layerBuffers[activeLayer];
  if (!rgba) return;
  offscreen.width = w;
  offscreen.height = h;
  offCtx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
}

/** Size the visible canvas to its box (× devicePixelRatio) for crisp output. */
function sizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.max(1, Math.round(rect.width * dpr));
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
}

function fitView(): void {
  const w = current ? current.elevation.width : SIZE;
  view.scale = canvas.width / w;
  view.ox = 0;
  view.oy = 0;
}

function clampView(): void {
  const w = current ? current.elevation.width : SIZE;
  const minScale = canvas.width / w; // never smaller than "fit"
  if (view.scale < minScale) view.scale = minScale;
  const worldPx = w * view.scale;
  // Keep the world covering the canvas (no empty gutters).
  const minOff = canvas.width - worldPx;
  view.ox = Math.min(0, Math.max(minOff, view.ox));
  view.oy = Math.min(0, Math.max(minOff, view.oy));
}

let highlight: { x: number; y: number; start: number } | null = null;

function redraw(): void {
  if (!current) return;
  clampView();
  const w = current.elevation.width;
  const h = current.elevation.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = view.scale < 2.5;
  ctx.drawImage(offscreen, 0, 0, w, h, view.ox, view.oy, w * view.scale, h * view.scale);
  drawOverlays();
}

function dpr(): number {
  return canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
}

function drawLabel(sx: number, sy: number, text: string, color: string, font: number): void {
  ctx.font = `600 ${font}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, font / 4.5);
  ctx.strokeStyle = "rgba(8,10,14,0.92)";
  ctx.lineJoin = "round";
  ctx.strokeText(text, sx, sy);
  ctx.fillStyle = color;
  ctx.fillText(text, sx, sy);
}

/** Draw feature labels, city labels (when zoomed), and any fly-to highlight. */
function drawOverlays(): void {
  if (!current) return;
  const d = dpr();
  const inBounds = (sx: number, sy: number) =>
    sx > -80 && sy > -20 && sx < canvas.width + 80 && sy < canvas.height + 20;

  // Named features — always visible so they're findable.
  const ffont = Math.round(12 * d);
  for (const f of current.history.features) {
    const sx = f.x * view.scale + view.ox;
    const sy = f.y * view.scale + view.oy;
    if (!inBounds(sx, sy)) continue;
    const glyph = f.kind === "peak" ? "▲" : f.kind === "lake" ? "◆" : "≈";
    const prefix = f.kind === "peak" ? "Mt. " : f.kind === "lake" ? "Lake " : "R. ";
    // Marker
    ctx.fillStyle = "#eafcff";
    ctx.strokeStyle = "rgba(8,10,14,0.92)";
    ctx.lineWidth = 2;
    drawLabel(sx, sy, glyph, "#eafcff", ffont);
    drawLabel(sx, sy - ffont * 1.15, prefix + f.name, "#eafcff", Math.round(ffont * 0.92));
  }

  // City / capital labels — only when zoomed in enough to avoid clutter.
  const fitScale = canvas.width / current.elevation.width;
  if (view.scale > fitScale * 1.6) {
    const cfont = Math.round(11 * d);
    for (const s of current.settlements.settlements) {
      if (s.tier === "village") continue;
      if (s.tier === "town" && view.scale < fitScale * 2.4) continue;
      const sx = s.x * view.scale + view.ox;
      const sy = s.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      drawLabel(sx, sy - cfont, s.name, s.isCapital ? "#ffd24a" : "#fff4dc", cfont);
    }
  }

  // Fly-to highlight ring (pulses once the camera arrives, then fades out).
  if (highlight) {
    const age = performance.now() - highlight.start;
    if (age < 0) {
      // Camera still flying — check back soon (start is in the future).
      setTimeout(() => redraw(), 60);
    } else if (age < 1600) {
      const sx = highlight.x * view.scale + view.ox;
      const sy = highlight.y * view.scale + view.oy;
      const p = age / 1600; // 0..1, always non-negative here
      ctx.beginPath();
      ctx.arc(sx, sy, (7 + p * 26) * d, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,210,90,${(1 - p) * 0.95})`;
      ctx.lineWidth = 3 * d;
      ctx.stroke();
      setTimeout(() => redraw(), 60);
    } else {
      highlight = null;
    }
  }
}

/**
 * Smoothly pan+zoom so the world point (wx,wy) is centered, then pulse it.
 * Driven by setTimeout (not rAF) and stepped synchronously first, so it applies
 * even when the tab isn't actively painting.
 */
function flyTo(wx: number, wy: number): void {
  if (!current) return;
  const fitScale = canvas.width / current.elevation.width;
  const targetScale = Math.max(view.scale, fitScale * 2.6);
  const from = { scale: view.scale, ox: view.ox, oy: view.oy };
  const to = {
    scale: targetScale,
    ox: canvas.width / 2 - wx * targetScale,
    oy: canvas.height / 2 - wy * targetScale,
  };
  const t0 = performance.now();
  const dur = 600;
  highlight = { x: wx, y: wy, start: t0 + dur };
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    view.scale = from.scale + (to.scale - from.scale) * e;
    view.ox = from.ox + (to.ox - from.ox) * e;
    view.oy = from.oy + (to.oy - from.oy) * e;
    redraw();
    if (t < 1) setTimeout(step, 16);
  };
  step();
}

// --- Coordinate mapping: client (mouse) → world cell. ---
function clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const bx = (clientX - rect.left) * (canvas.width / rect.width);
  const by = (clientY - rect.top) * (canvas.height / rect.height);
  return { x: (bx - view.ox) / view.scale, y: (by - view.oy) / view.scale };
}

function nearestSettlement(wx: number, wy: number, maxCells: number): Settlement | null {
  if (!current) return null;
  let best: Settlement | null = null;
  let bestD = maxCells * maxCells;
  for (const s of current.settlements.settlements) {
    const dx = s.x - wx;
    const dy = s.y - wy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function nearestDeposit(wx: number, wy: number, maxCells: number) {
  if (!current) return null;
  let best = null;
  let bestD = maxCells * maxCells;
  for (const dep of current.resources.deposits) {
    const dx = dep.x - wx;
    const dy = dep.y - wy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = dep;
    }
  }
  return best;
}

function inspect(wx: number, wy: number) {
  if (!current) return null;
  const w = current.elevation.width;
  const h = current.elevation.height;
  const x = Math.floor(wx);
  const y = Math.floor(wy);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const i = y * w + x;
  const isOcean = current.water.oceanMask[i] === 1;
  const isLake = current.water.lakeMask[i] === 1;
  const regionId = current.regions.ids[i];
  const region = current.regions.regions.find((r) => r.id === regionId) ?? null;
  const biome = BIOME_NAMES[current.biomes.ids[i] as keyof typeof BIOME_NAMES];
  const elevation = current.elevation.data[i];
  const settlement = nearestSettlement(wx, wy, 6);
  return { x, y, isOcean, isLake, region, biome, elevation, settlement };
}

function showTip(clientX: number, clientY: number): void {
  const world = clientToWorld(clientX, clientY);
  const info = inspect(world.x, world.y);
  if (!info) {
    tip.hidden = true;
    return;
  }
  const place = info.isOcean
    ? "Open ocean"
    : info.isLake
      ? "Lake"
      : info.region
        ? info.region.name
        : "Wilderness";
  const rows: string[] = [];
  if (info.region && !info.isOcean) {
    rows.push(`<div class="trow">${info.region.languageLabel}</div>`);
  }
  rows.push(`<div class="trow">${info.biome} · elev ${(info.elevation * 100).toFixed(0)}</div>`);
  if (info.settlement) {
    const s = info.settlement;
    const tags = [s.isCapital ? "capital" : s.tier, s.isPort ? "port" : ""]
      .filter(Boolean)
      .join(", ");
    rows.push(`<div class="trow cap">${s.name} — ${tags}</div>`);
  }
  // On the Resources layer, identify the deposit under the cursor.
  if (activeLayer === "resources") {
    const dep = nearestDeposit(world.x, world.y, 3);
    if (dep) {
      rows.push(
        `<div class="trow cap">${RESOURCE_NAMES[dep.kind]} deposit (richness ${(dep.richness * 100).toFixed(0)})</div>`,
      );
    }
  }
  tip.innerHTML = `<div class="tname">${place}</div>${rows.join("")}`;
  tip.hidden = false;
  const pad = 14;
  let left = clientX + pad;
  let top = clientY + pad;
  const r = tip.getBoundingClientRect();
  if (left + r.width > window.innerWidth) left = clientX - r.width - pad;
  if (top + r.height > window.innerHeight) top = clientY - r.height - pad;
  tip.style.left = `${Math.max(4, left)}px`;
  tip.style.top = `${Math.max(4, top)}px`;
}

function pinDetail(clientX: number, clientY: number): void {
  const world = clientToWorld(clientX, clientY);
  const info = inspect(world.x, world.y);
  const detail = $("detail");
  if (!info || (info.isOcean && !info.settlement)) {
    detail.hidden = true;
    return;
  }
  const parts: string[] = [`<span class="dclose" title="dismiss">✕</span>`];
  if (info.settlement) {
    const s = info.settlement;
    parts.push(`<div class="dh">${s.name}</div>`);
    const eco = current.economy.economies.find((e) => e.settlementId === s.id);
    const tags = [
      s.isCapital ? "Capital" : s.tier[0].toUpperCase() + s.tier.slice(1),
      s.isPort ? "port" : "",
      eco?.isTradeHub ? "trade hub" : "",
      eco ? eco.tier : "",
    ]
      .filter(Boolean)
      .join(" · ");
    parts.push(`<div class="drow">${tags}</div>`);
    if (info.region) parts.push(`<div class="drow">in ${info.region.name} (${info.region.languageLabel})</div>`);
    if (eco && eco.produces.length) {
      parts.push(
        `<div class="drow">produces ${eco.produces.map((k) => RESOURCE_NAMES[k]).join(", ")}</div>`,
      );
    }
  } else if (info.region) {
    const r = info.region;
    parts.push(`<div class="dh">${r.name}</div>`);
    parts.push(`<div class="drow">${r.languageLabel} · ${info.biome}</div>`);
    parts.push(
      `<div class="drow">area ${r.area} cells · ${r.coastal ? "coastal" : "inland"} · ` +
        `mean elev ${(r.meanElevation * 100).toFixed(0)}</div>`,
    );
    const faithId = current.religion.regionFaith[r.id];
    const faith = current.religion.faiths.find((f) => f.id === faithId);
    if (faith) parts.push(`<div class="drow">faith: ${faith.name}</div>`);
    const prose = current.lore.regionDescriptions[r.id];
    if (prose) parts.push(`<div class="dprose">${escapeHtml(prose)}</div>`);
  }
  detail.innerHTML = parts.join("");
  detail.hidden = false;
  (detail.querySelector(".dclose") as HTMLElement).addEventListener("click", () => {
    detail.hidden = true;
  });
}

// --- Pointer interaction ---
let dragging = false;
let moved = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("mousedown", (e) => {
  dragging = true;
  moved = false;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.classList.add("dragging");
});
window.addEventListener("mouseup", (e) => {
  if (dragging && !moved) pinDetail(e.clientX, e.clientY);
  dragging = false;
  canvas.classList.remove("dragging");
});
canvas.addEventListener("mousemove", (e) => {
  if (dragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    const k = canvas.width / canvas.getBoundingClientRect().width;
    view.ox += dx * k;
    view.oy += dy * k;
    lastX = e.clientX;
    lastY = e.clientY;
    redraw();
    tip.hidden = true;
  } else {
    showTip(e.clientX, e.clientY);
  }
});
canvas.addEventListener("mouseleave", () => {
  tip.hidden = true;
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const k = canvas.width / rect.width;
    const bx = (e.clientX - rect.left) * k;
    const by = (e.clientY - rect.top) * k;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    // Zoom toward the cursor: keep the world point under it fixed.
    view.ox = bx - (bx - view.ox) * factor;
    view.oy = by - (by - view.oy) * factor;
    view.scale *= factor;
    redraw();
  },
  { passive: false },
);
canvas.addEventListener("dblclick", () => {
  fitView();
  redraw();
});

// --- Info panel ---
function worldName(world: World): string {
  const realm = [...world.history.realms].sort((a, b) => a.foundedYear - b.foundedYear)[0];
  return realm ? realm.name : world.meta.capital;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInfo(world: World): void {
  const m = world.meta;
  $("worldname").textContent = worldName(world);
  $("worldsub").textContent = `seed "${m.seed}" · ${m.width}×${m.height} · fingerprint ${m.contentHash}`;
  $("detail").hidden = true;

  const stats: Array<[string, string]> = [
    ["Land", `${(m.landFraction * 100).toFixed(0)}%`],
    ["Regions", String(m.regionCount)],
    ["Settlements", String(m.settlementCount)],
    ["Realms", String(m.realmCount)],
    ["Biomes", String(m.biomeDiversity)],
    ["Capital", m.capital],
    ["Ruling house", m.capitalHouse],
    ["Faiths", String(m.faithCount)],
    ["Dominant power", m.dominantPower],
    ["Surviving realms", String(m.survivingRealms)],
    ["Exports", m.majorExports || "—"],
  ];
  $("stats").innerHTML = stats
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
    .join("");

  $("features").innerHTML = world.history.features
    .map((f) => {
      const label = f.kind === "peak" ? "Mount" : f.kind === "lake" ? "Lake" : "River";
      return `<li>${label} <b>${f.name}</b></li>`;
    })
    .join("");

  // The emergent chronicle from the simulation (the world's real history).
  // Each entry is clickable — it flies the map to where the event happened.
  $("chronicle").innerHTML = world.simulation.events
    .map(
      (e) =>
        `<li class="ev" data-x="${e.x}" data-y="${e.y}" title="Find on map">` +
        `<span class="yr">${e.year} AR</span> ${escapeHtml(e.text)}</li>`,
    )
    .join("");
}

/** A legend keyed to the active thematic layer (resources / biomes / faiths). */
function updateLegend(): void {
  const el = $("legend");
  if (!current) {
    el.innerHTML = "";
    return;
  }
  let items: Array<[string, number[]]> = [];
  if (activeLayer === "resources") {
    const kinds = [...new Set(current.resources.deposits.map((d) => d.kind))].sort((a, b) => a - b);
    items = kinds.map((k) => [RESOURCE_NAMES[k], RESOURCE_COLORS[k]]);
  } else if (activeLayer === "biome") {
    const bset = new Set<number>();
    for (let i = 0; i < current.biomes.ids.length; i++) bset.add(current.biomes.ids[i]);
    items = [...bset]
      .filter((b) => b > 1)
      .sort((a, b) => a - b)
      .map((b) => [BIOME_NAMES[b as keyof typeof BIOME_NAMES], BIOME_COLORS[b as keyof typeof BIOME_COLORS]]);
  } else if (activeLayer === "faiths") {
    items = current.religion.faiths.map((f, i) => [
      `${f.name} — ${f.deity.domain}`,
      FAITH_PALETTE[i % FAITH_PALETTE.length],
    ]);
  }
  el.innerHTML = items
    .map(
      ([name, c]) =>
        `<span class="lg"><i style="background:rgb(${c[0]},${c[1]},${c[2]})"></i>${name}</span>`,
    )
    .join("");
}

function generate(seed: string): void {
  $("status").textContent = "Generating…";
  canvas.classList.add("busy");
  genStart = performance.now();
  worker.postMessage({ seed, size: SIZE });
}

worker.onmessage = (e: MessageEvent) => {
  const { world, layers, seed } = e.data as {
    world: World;
    layers: Record<string, Uint8Array>;
    seed: string;
  };
  const ms = Math.round(performance.now() - genStart);
  current = world;
  layerBuffers = layers;
  renderInfo(world);
  renderOffscreen();
  sizeCanvas();
  fitView();
  redraw();
  updateLegend();
  canvas.classList.remove("busy");
  $("status").textContent = `Generated in ${ms} ms · drag to pan, scroll to zoom, hover to inspect`;
  const url = new URL(location.href);
  url.searchParams.set("seed", seed);
  history.replaceState(null, "", url);
};

worker.onerror = (e) => {
  $("status").textContent = `Generation failed: ${e.message}`;
  canvas.classList.remove("busy");
};

function randomSeed(): string {
  const syl = ["ka", "mor", "el", "th", "an", "ra", "ver", "sol", "ny", "dra", "is", "or"];
  let s = "";
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) s += syl[Math.floor(Math.random() * syl.length)];
  return s;
}

// The engine never reads the clock; the UI derives a date seed and passes it in.
function todaySeed(): string {
  const d = new Date();
  return `day-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function buildTabs(): void {
  const tabs = $("layertabs");
  for (const [key, label] of LAYERS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.setAttribute("aria-pressed", key === activeLayer ? "true" : "false");
    b.addEventListener("click", () => {
      activeLayer = key;
      tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      renderOffscreen();
      redraw();
      updateLegend();
    });
    tabs.appendChild(b);
  }
}

function init(): void {
  buildTabs();
  $("generate").addEventListener("click", () => generate(seedInput.value || "cartogenesis"));
  $("random").addEventListener("click", () => {
    seedInput.value = randomSeed();
    generate(seedInput.value);
  });
  $("today").addEventListener("click", () => {
    seedInput.value = todaySeed();
    generate(seedInput.value);
  });
  $("resetview").addEventListener("click", () => {
    fitView();
    redraw();
  });
  $("copylink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("status").textContent = "Link copied to clipboard";
    } catch {
      $("status").textContent = location.href;
    }
  });
  seedInput.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") generate(seedInput.value || "cartogenesis");
  });
  window.addEventListener("resize", () => {
    if (!current) return;
    sizeCanvas();
    clampView();
    redraw();
  });
  // Click a chronicle entry → fly the map to where it happened.
  $("chronicle").addEventListener("click", (ev) => {
    const li = (ev.target as HTMLElement).closest("li.ev") as HTMLElement | null;
    if (!li) return;
    const x = Number(li.getAttribute("data-x"));
    const y = Number(li.getAttribute("data-y"));
    if (Number.isFinite(x) && Number.isFinite(y)) flyTo(x, y);
  });

  const urlSeed = new URL(location.href).searchParams.get("seed");
  seedInput.value = urlSeed ?? "cartogenesis";
  generate(seedInput.value);
}

init();
