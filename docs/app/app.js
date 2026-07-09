// web/main.ts — The in-browser Cartogenesis app (interactive atlas).
//
// Runs the exact same engine as the CLI (the build step type-strips src/ into
// docs/app/engine/*.js) and draws layers to a <canvas>. The renderers already
// return RGBA byte arrays, so a layer becomes an offscreen ImageData; the
// visible canvas then blits it under a pan/zoom view transform. Hovering reads
// back the underlying World (regions, biomes, elevation, settlements) to inspect
// any point; clicking pins a detail card.

import { generateWorld,            } from "./engine/world.js";
import { BIOME_NAMES } from "./engine/biomes.js";
import { RESOURCE_NAMES } from "./engine/resources.js";
                                                          
import {
  renderHypsometric,
  renderGrayscale,
  renderBiomes,
  renderRegions,
  renderFaiths,
  renderTemperature,
  renderMoisture,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
  overlayResources,
} from "./engine/render.js";

const SIZE = 384;

const LAYERS                          = [
  ["terrain", "Terrain"],
  ["biome", "Biomes"],
  ["political", "Political"],
  ["faiths", "Faiths"],
  ["resources", "Resources"],
  ["temperature", "Temperature"],
  ["moisture", "Rainfall"],
  ["height", "Relief"],
];

let current               = null;
let activeLayer = "terrain";

// View transform: canvasPx = worldPx * scale + offset (in backing-store pixels).
const view = { scale: 1, ox: 0, oy: 0 };

const $ = (id        ) => document.getElementById(id) ;
const canvas = $("map")                     ;
const ctx = canvas.getContext("2d") ;
const seedInput = $("seed")                    ;
const tip = $("tip");

// Offscreen buffer holding the current layer at world resolution.
const offscreen = document.createElement("canvas");
offscreen.width = SIZE;
offscreen.height = SIZE;
const offCtx = offscreen.getContext("2d") ;

function layerPixels(world       , layer        )             {
  const w = world.elevation.width;
  const h = world.elevation.height;
  const towns = world.settlements.settlements;
  switch (layer) {
    case "biome": {
      const px = renderBiomes(world.biomes, world.elevation);
      overlayRivers(px, world.rivers, w, h);
      return px;
    }
    case "political": {
      const px = renderRegions(world.regions, world.water, world.elevation);
      overlayRoads(px, world.roads);
      overlaySettlements(px, towns, w, h);
      return px;
    }
    case "faiths":
      return renderFaiths(world.regions, world.religion, world.water, world.elevation);
    case "resources": {
      const px = renderHypsometric(world.elevation, world.meta.seaLevel, {
        water: world.water,
      });
      overlayResources(px, world.resources.deposits, w, h);
      return px;
    }
    case "temperature":
      return renderTemperature(world.temperature, world.water);
    case "moisture":
      return renderMoisture(world.moisture, world.water);
    case "height":
      return renderGrayscale(world.elevation);
    case "terrain":
    default: {
      const px = renderHypsometric(world.elevation, world.meta.seaLevel, {
        water: world.water,
      });
      overlayRivers(px, world.rivers, w, h);
      overlayRoads(px, world.roads);
      overlaySettlements(px, towns, w, h);
      return px;
    }
  }
}

/** Rasterize the active layer into the offscreen buffer. */
function renderOffscreen()       {
  if (!current) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  offscreen.width = w;
  offscreen.height = h;
  const rgba = layerPixels(current, activeLayer);
  offCtx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
}

/** Size the visible canvas to its box (× devicePixelRatio) for crisp output. */
function sizeCanvas()       {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.max(1, Math.round(rect.width * dpr));
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }
}

function fitView()       {
  const w = current ? current.elevation.width : SIZE;
  view.scale = canvas.width / w;
  view.ox = 0;
  view.oy = 0;
}

function clampView()       {
  const w = current ? current.elevation.width : SIZE;
  const minScale = canvas.width / w; // never smaller than "fit"
  if (view.scale < minScale) view.scale = minScale;
  const worldPx = w * view.scale;
  // Keep the world covering the canvas (no empty gutters).
  const minOff = canvas.width - worldPx;
  view.ox = Math.min(0, Math.max(minOff, view.ox));
  view.oy = Math.min(0, Math.max(minOff, view.oy));
}

function redraw()       {
  if (!current) return;
  clampView();
  const w = current.elevation.width;
  const h = current.elevation.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = view.scale < 2.5;
  ctx.drawImage(offscreen, 0, 0, w, h, view.ox, view.oy, w * view.scale, h * view.scale);
}

// --- Coordinate mapping: client (mouse) → world cell. ---
function clientToWorld(clientX        , clientY        )                           {
  const rect = canvas.getBoundingClientRect();
  const bx = (clientX - rect.left) * (canvas.width / rect.width);
  const by = (clientY - rect.top) * (canvas.height / rect.height);
  return { x: (bx - view.ox) / view.scale, y: (by - view.oy) / view.scale };
}

function nearestSettlement(wx        , wy        , maxCells        )                    {
  if (!current) return null;
  let best                    = null;
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

function inspect(wx        , wy        ) {
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
  const biome = BIOME_NAMES[current.biomes.ids[i]                            ];
  const elevation = current.elevation.data[i];
  const settlement = nearestSettlement(wx, wy, 6);
  return { x, y, isOcean, isLake, region, biome, elevation, settlement };
}

function showTip(clientX        , clientY        )       {
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
  const rows           = [];
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

function pinDetail(clientX        , clientY        )       {
  const world = clientToWorld(clientX, clientY);
  const info = inspect(world.x, world.y);
  const detail = $("detail");
  if (!info || (info.isOcean && !info.settlement)) {
    detail.hidden = true;
    return;
  }
  const parts           = [`<span class="dclose" title="dismiss">✕</span>`];
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
  (detail.querySelector(".dclose")               ).addEventListener("click", () => {
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
function worldName(world       )         {
  const realm = [...world.history.realms].sort((a, b) => a.foundedYear - b.foundedYear)[0];
  return realm ? realm.name : world.meta.capital;
}

function escapeHtml(s        )         {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInfo(world       )       {
  const m = world.meta;
  $("worldname").textContent = worldName(world);
  $("worldsub").textContent = `seed "${m.seed}" · ${m.width}×${m.height} · fingerprint ${m.contentHash}`;
  $("detail").hidden = true;

  const stats                          = [
    ["Land", `${(m.landFraction * 100).toFixed(0)}%`],
    ["Regions", String(m.regionCount)],
    ["Settlements", String(m.settlementCount)],
    ["Realms", String(m.realmCount)],
    ["Biomes", String(m.biomeDiversity)],
    ["Capital", m.capital],
    ["Ruling house", m.capitalHouse],
    ["Faiths", String(m.faithCount)],
    ["Exports", m.majorExports || "—"],
    ["Year", `${m.presentYear} AR`],
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

  $("chronicle").innerHTML = world.history.events
    .map((e) => `<li><span class="yr">${e.year} AR</span> ${escapeHtml(e.text)}</li>`)
    .join("");
}

function generate(seed        )       {
  $("status").textContent = "Generating…";
  setTimeout(() => {
    const t0 = performance.now();
    current = generateWorld({ seed, width: SIZE, height: SIZE });
    const ms = Math.round(performance.now() - t0);
    renderInfo(current);
    renderOffscreen();
    sizeCanvas();
    fitView();
    redraw();
    $("status").textContent = `Generated in ${ms} ms · drag to pan, scroll to zoom`;
    const url = new URL(location.href);
    url.searchParams.set("seed", seed);
    history.replaceState(null, "", url);
  }, 15);
}

function randomSeed()         {
  const syl = ["ka", "mor", "el", "th", "an", "ra", "ver", "sol", "ny", "dra", "is", "or"];
  let s = "";
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) s += syl[Math.floor(Math.random() * syl.length)];
  return s;
}

function buildTabs()       {
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
    });
    tabs.appendChild(b);
  }
}

function init()       {
  buildTabs();
  $("generate").addEventListener("click", () => generate(seedInput.value || "cartogenesis"));
  $("random").addEventListener("click", () => {
    seedInput.value = randomSeed();
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
    if ((e                 ).key === "Enter") generate(seedInput.value || "cartogenesis");
  });
  window.addEventListener("resize", () => {
    if (!current) return;
    sizeCanvas();
    clampView();
    redraw();
  });

  const urlSeed = new URL(location.href).searchParams.get("seed");
  seedInput.value = urlSeed ?? "cartogenesis";
  generate(seedInput.value);
}

init();
