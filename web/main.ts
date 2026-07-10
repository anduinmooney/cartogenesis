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
import { renderPowersAt } from "./engine/render.ts";
import { settlementsAt, ruinedSettlementIds } from "./engine/simulation.ts";
import type { Settlement } from "./engine/settlements.ts";
import { glossPhrase, glossary } from "./engine/language.ts";
import { languageById } from "./engine/names.ts";
import { worldReportMarkdown } from "./engine/report.ts";
import { worldPosterSVG } from "./engine/svgmap.ts";
import { renderRegions } from "./engine/render.ts";
import { renderMarkdown } from "./markdown.ts";

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
/** Settlements lost to history — never shown on present-day views. */
let ruinedIds = new Set<number>();
/** While scrubbing the Powers layer, the year the map is showing. */
let scrubYear: number | null = null;

const SIZE = 384;

const LAYERS: Array<[string, string]> = [
  ["terrain", "Terrain"],
  ["topographic", "Topo"],
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

// --- Time scrubber (Powers layer): watch borders shift through the centuries ---
let playTimer = 0;

/** Draw the Powers map for snapshot index i (a year's borders). */
function renderPowersFrame(i: number): void {
  if (!current) return;
  const snaps = current.simulation.snapshots;
  const snap = snaps && snaps[i];
  if (!snap) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  const rgba = renderPowersAt(current.regions, snap.control, current.water, current.elevation);
  offscreen.width = w;
  offscreen.height = h;
  offCtx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  scrubYear = snap.year; // so the overlay shows only the towns alive then
  redraw();
  $("yearlabel").textContent = `${snap.year.toLocaleString()} AR`;
}

function stopPlay(): void {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = 0;
  }
  $("playbtn").textContent = "▶";
}

/** Show the scrubber only on the Powers layer; reset it to the final year. */
function updateScrubber(): void {
  const snaps = current?.simulation?.snapshots;
  const on = activeLayer === "powers" && !!snaps && snaps.length > 1;
  $("scrubber").hidden = !on;
  if (!on) {
    stopPlay();
    scrubYear = null; // other layers always show the present day
    return;
  }
  const slider = $("timeslider") as HTMLInputElement;
  slider.max = String(snaps!.length - 1);
  slider.value = String(snaps!.length - 1);
  renderPowersFrame(snaps!.length - 1);
}

function togglePlay(): void {
  const snaps = current?.simulation?.snapshots;
  if (!snaps) return;
  const slider = $("timeslider") as HTMLInputElement;
  if (playTimer) {
    stopPlay();
    return;
  }
  if (Number(slider.value) >= snaps.length - 1) slider.value = "0";
  $("playbtn").textContent = "⏸";
  playTimer = window.setInterval(() => {
    const i = Number(slider.value) + 1;
    if (i >= snaps.length) {
      stopPlay();
      return;
    }
    slider.value = String(i);
    renderPowersFrame(i);
  }, 90);
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

  // Volcanoes — a triangle coloured by status, always visible.
  const vfont = Math.round(12 * d);
  for (const v of current.volcanoes) {
    const sx = v.x * view.scale + view.ox;
    const sy = v.y * view.scale + view.oy;
    if (!inBounds(sx, sy)) continue;
    const color =
      v.status === "active" ? "#ff6a3d" : v.status === "dormant" ? "#ffb347" : "#c8ccd2";
    drawLabel(sx, sy, "▲", color, vfont);
    drawLabel(sx, sy - vfont * 1.15, `Mt. ${v.name}`, color, Math.round(vfont * 0.9));
  }

  // Settlements standing in the year being shown. On other layers that's the
  // present day; while scrubbing the Powers map, cities appear and vanish.
  const shownYear = scrubYear ?? current.simulation.endYear;
  const living = settlementsAt(current.simulation.settlementTimeline, shownYear);

  // The Powers map carries no baked-in town markers, so draw them here — this
  // is what makes cities visibly rise and fall as the timeline plays.
  if (activeLayer === "powers") {
    for (const s of living) {
      const sx = s.x * view.scale + view.ox;
      const sy = s.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      const r = (s.isCapital ? 3.4 : s.tier === "city" ? 2.6 : 1.8) * d;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = s.isCapital ? "#ffd24a" : "#fff4dc";
      ctx.strokeStyle = "rgba(10,12,16,0.9)";
      ctx.lineWidth = 1.2 * d;
      ctx.fill();
      ctx.stroke();
    }
  }

  // City / capital labels — only when zoomed in enough to avoid clutter.
  const fitScale = canvas.width / current.elevation.width;
  if (view.scale > fitScale * 1.6) {
    const cfont = Math.round(11 * d);
    for (const s of living) {
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
    if (ruinedIds.has(s.id)) continue; // a ruin is not a town
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

function metresOf(value: number): number {
  if (!current) return 0;
  const m = current.meta;
  if (value <= m.seaLevel) return 0;
  return Math.round(((value - m.seaLevel) / (1 - m.seaLevel)) * m.maxAltitudeMetres);
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
  const metres = metresOf(info.elevation);
  const elevText = info.isOcean || info.isLake ? "sea level" : `${metres.toLocaleString()} m`;
  rows.push(`<div class="trow">${info.biome} · ${elevText}</div>`);
  if (info.settlement) {
    const s = info.settlement;
    const tags = [s.isCapital ? "capital" : s.tier, s.isPort ? "port" : ""]
      .filter(Boolean)
      .join(", ");
    rows.push(
      `<div class="trow cap">${s.name} — ${tags}</div>` +
        `<div class="tgloss">${glossPhrase(s.gloss)}</div>`,
    );
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
  const placeGloss =
    !info.isOcean && !info.isLake && info.region ? info.region.gloss : "";
  const glossLine = placeGloss
    ? `<div class="tgloss">${glossPhrase(placeGloss)}</div>`
    : "";
  tip.innerHTML = `<div class="tname">${place}</div>${glossLine}${rows.join("")}`;
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
    parts.push(`<div class="dgloss">${glossPhrase(s.gloss)}</div>`);
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
    parts.push(`<div class="dgloss">${glossPhrase(r.gloss)}</div>`);
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
    ["Highest peak", `${m.highestPeakMetres.toLocaleString()} m`],
    ["Volcanoes", `${m.volcanoCount} (${m.activeVolcanoes} active)`],
    ["Regions", String(m.regionCount)],
    ["Settlements", String(m.settlementCount)],
    ["Realms", String(m.realmCount)],
    ["Biomes", String(m.biomeDiversity)],
    ["Capital", m.capital],
    ["Ruling house", m.capitalHouse],
    ["Faiths", String(m.faithCount)],
    ["Dominant power", m.dominantPower],
    ["Surviving realms", String(m.survivingRealms)],
    ["Ruins", String(m.ruinCount)],
    ["Exports", m.majorExports || "—"],
  ];
  $("stats").innerHTML = stats
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
    .join("");

  $("features").innerHTML = world.history.features
    .map((f) => {
      const label = f.kind === "peak" ? "Mount" : f.kind === "lake" ? "Lake" : "River";
      return (
        `<li>${label} <b>${f.name}</b> <span class="gl">— ${glossPhrase(f.gloss)}</span></li>`
      );
    })
    .join("");

  renderLanguages(world);

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
  ruinedIds = ruinedSettlementIds(world.simulation.settlementTimeline);
  scrubYear = null;
  renderInfo(world);
  buildGazetteer(world);
  renderOffscreen();
  sizeCanvas();
  fitView();
  redraw();
  updateLegend();
  updateScrubber();
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

// --- In-browser 16-bit heightmap PNG export (for Blender/Unity/Godot/…) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(body, 4);
  dv.setUint32(4 + body.length, crc32(body));
  return out;
}
async function deflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate"); // zlib-wrapped, as PNG needs
  const stream = new Blob([data]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function heightmapPngBlob(
  width: number,
  height: number,
  samples: Uint16Array,
): Promise<Blob> {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // grayscale
  const stride = width * 2;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rs = y * (stride + 1);
    raw[rs] = 0;
    for (let x = 0; x < width; x++) {
      const v = samples[y * width + x];
      const o = rs + 1 + x * 2;
      raw[o] = (v >> 8) & 0xff;
      raw[o + 1] = v & 0xff;
    }
  }
  const idat = await deflateZlib(raw);
  return new Blob(
    [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array(0))],
    { type: "image/png" },
  );
}
async function downloadHeightmap(): Promise<void> {
  if (!current) return;
  $("status").textContent = "Encoding 16-bit heightmap…";
  const w = current.elevation.width;
  const h = current.elevation.height;
  const samples = new Uint16Array(w * h);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(0, Math.min(1, current.elevation.data[i]));
    samples[i] = Math.round(v * 65535);
  }
  const blob = await heightmapPngBlob(w, h, samples);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cartogenesis-${String(current.meta.seed)}-heightmap16.png`.replace(
    /[^a-z0-9.\-]/gi,
    "_",
  );
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  $("status").textContent =
    `Heightmap downloaded — ${w}×${h}, 16-bit · scale height to ${current.meta.maxAltitudeMetres.toLocaleString()} m`;
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
      updateScrubber();
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
  $("heightmap").addEventListener("click", () => {
    downloadHeightmap().catch((e) => {
      $("status").textContent = `Heightmap export failed: ${e.message}`;
    });
  });
  $("playbtn").addEventListener("click", togglePlay);
  $("timeslider").addEventListener("input", () => {
    stopPlay();
    renderPowersFrame(Number(($("timeslider") as HTMLInputElement).value));
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

  wireGazetteer();
  wireExports();

  const urlSeed = new URL(location.href).searchParams.get("seed");
  seedInput.value = urlSeed ?? "cartogenesis";
  generate(seedInput.value);
}

init();

/**
 * The phrasebook. Every name on the map is a compound of these roots, so the
 * panel is what turns "Vaskhold" from noise into "sea-fort". Only the cultures
 * that actually live in this world are listed.
 */
function renderLanguages(world: World): void {
  const spoken = [...new Set(world.regions.regions.map((r) => r.languageId))];
  $("languages").innerHTML = spoken
    .map((id) => {
      const lang = languageById(id);
      const where = world.regions.regions
        .filter((r) => r.languageId === id)
        .sort((a, b) => b.area - a.area)
        .slice(0, 2)
        .map((r) => r.name)
        .join(", ");
      const roots = glossary(lang)
        .map((g) => `<span><b>${g.root}</b> ${g.gloss}</span>`)
        .join("");
      return (
        `<details><summary>${escapeHtml(lang.label)} ` +
        `<span class="spoken">— ${escapeHtml(where)}</span></summary>` +
        `<div class="lex">${roots}</div></details>`
      );
    })
    .join("");
}

// --- Gazetteer overlay: the full written dossier, in the app ---------------

/** The current world's report Markdown, kept for the download button. */
let gazetteerMd = "";

/** name → world coordinates, so a name in the prose can fly the map. */
function placeIndex(world: World): Map<string, { x: number; y: number }> {
  const idx = new Map<string, { x: number; y: number }>();
  const add = (name: string, x: number, y: number) => {
    if (name && name.length >= 3 && !idx.has(name)) idx.set(name, { x, y });
  };
  for (const s of world.settlements.settlements) add(s.name, s.x, s.y);
  for (const r of world.regions.regions) add(r.name, r.cx, r.cy);
  for (const v of world.volcanoes) add(v.name, v.x, v.y);
  for (const f of world.history.features) add(f.name, f.x, f.y);
  return idx;
}

/** Regex-escape a place name for the linkifier. */
function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wrap every occurrence of a known place name (in a text node) with a clickable
 * span carrying its coordinates. Works on the DOM, not the HTML string, so it
 * can never break tags or match inside attributes.
 */
function linkifyPlaces(root: HTMLElement, idx: Map<string, { x: number; y: number }>): void {
  if (idx.size === 0) return;
  const names = [...idx.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.map(reEsc).join("|")})\\b`, "g");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if ((t.parentElement?.className ?? "").includes("place")) continue;
    if (re.test(t.data)) targets.push(t);
  }
  for (const t of targets) {
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t.data))) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.data.slice(last, m.index)));
      const coords = idx.get(m[1])!;
      const span = document.createElement("span");
      span.className = "place";
      span.textContent = m[1];
      span.dataset.x = String(coords.x);
      span.dataset.y = String(coords.y);
      span.title = "Find on the map";
      frag.appendChild(span);
      last = m.index + m[1].length;
    }
    if (last < t.data.length) frag.appendChild(document.createTextNode(t.data.slice(last)));
    t.parentNode?.replaceChild(frag, t);
  }
}

/** Build the gazetteer panel for a world (does not open it). */
function buildGazetteer(world: World): void {
  gazetteerMd = worldReportMarkdown(world);
  const { html, headings } = renderMarkdown(gazetteerMd);
  const content = $("gaz-content");
  content.innerHTML = html;
  linkifyPlaces(content, placeIndex(world));

  $("gaz-toc").innerHTML = headings
    .map(
      (h) =>
        `<a data-goto="${h.id}" class="${h.level === 3 ? "sub" : ""}">${escapeHtml(h.text)}</a>`,
    )
    .join("");

  const title = world.history.realms[0]?.name ?? world.meta.capital ?? "Gazetteer";
  $("gaz-title").textContent = `${title} — a gazetteer`;
}

function openGazetteer(): void {
  $("gazovl").hidden = false;
}
function closeGazetteer(): void {
  $("gazovl").hidden = true;
}

function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireGazetteer(): void {
  $("gazetteer").addEventListener("click", openGazetteer);
  $("gaz-close").addEventListener("click", closeGazetteer);
  $("gazovl").addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "gazovl") closeGazetteer(); // click backdrop
  });
  document.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !$("gazovl").hidden) closeGazetteer();
  });
  $("gaz-toc").addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).dataset?.goto;
    if (!id) return;
    const target = document.getElementById(id);
    const content = $("gaz-content");
    if (target) content.scrollTop = target.offsetTop - content.offsetTop;
  });
  $("gaz-content").addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    if (!el.classList.contains("place")) return;
    const x = Number(el.dataset.x);
    const y = Number(el.dataset.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      closeGazetteer();
      flyTo(x, y);
    }
  });
  $("gaz-dl-md").addEventListener("click", () => {
    const seed = current ? String(current.meta.seed) : "world";
    downloadText(`cartogenesis-${seed}.md`, gazetteerMd, "text/markdown");
  });
}

// --- Exports: take the world with you --------------------------------------

/** Render a world-resolution RGBA buffer to a PNG data URI via a temp canvas. */
function rgbaToPngDataUri(rgba: Uint8Array, w: number, h: number): string {
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const c = cvs.getContext("2d")!;
  c.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  return cvs.toDataURL("image/png");
}

function safeSeed(): string {
  return (current ? String(current.meta.seed) : "world").replace(/[^a-z0-9.\-]/gi, "_");
}

/** Download the current map layer as a PNG, at full world resolution. */
function downloadMapPng(): void {
  if (!current) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  const rgba = layerBuffers[activeLayer];
  if (!rgba) return;
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  cvs.getContext("2d")!.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), w, h),
    0,
    0,
  );
  cvs.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cartogenesis-${safeSeed()}-${activeLayer}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
  $("status").textContent = `Downloaded the ${activeLayer} map (${w}×${h})`;
}

/** Download a labeled SVG poster of this world, over the political map. */
function downloadPosterSvg(): void {
  if (!current) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  // The poster wants the political map as its base, regardless of the layer on
  // screen — that is what carries region borders and names.
  const politicalRgba =
    layerBuffers["political"] ??
    renderRegions(current.regions, current.water, current.elevation);
  const dataUri = rgbaToPngDataUri(politicalRgba, w, h);
  const svg = worldPosterSVG(current, dataUri);
  downloadText(`cartogenesis-${safeSeed()}-poster.svg`, svg, "image/svg+xml");
  $("status").textContent = "Downloaded the labeled SVG poster";
}

function wireExports(): void {
  $("dlmap").addEventListener("click", downloadMapPng);
  $("dlposter").addEventListener("click", downloadPosterSvg);
}
