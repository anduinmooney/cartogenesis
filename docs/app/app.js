// web/main.ts — The in-browser Cartogenesis app.
//
// Runs the exact same engine as the CLI (the build step type-strips src/ into
// docs/app/engine/*.js) and draws layers straight to a <canvas>. The renderers
// already return RGBA byte arrays, so drawing is a single putImageData — no PNG
// encoding needed in the browser.

import { generateWorld,            } from "./engine/world.js";
import {
  renderHypsometric,
  renderGrayscale,
  renderBiomes,
  renderRegions,
  renderTemperature,
  renderMoisture,
  overlayRivers,
  overlayRoads,
  overlaySettlements,
} from "./engine/render.js";

const SIZE = 384;

const LAYERS                          = [
  ["terrain", "Terrain"],
  ["biome", "Biomes"],
  ["political", "Political"],
  ["temperature", "Temperature"],
  ["moisture", "Rainfall"],
  ["height", "Relief"],
];

let current               = null;
let activeLayer = "terrain";

const $ = (id        ) => document.getElementById(id) ;
const canvas = $("map")                     ;
const ctx = canvas.getContext("2d") ;
const seedInput = $("seed")                    ;

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

function draw()       {
  if (!current) return;
  const w = current.elevation.width;
  const h = current.elevation.height;
  const rgba = layerPixels(current, activeLayer);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
}

function worldName(world       )         {
  const realm = [...world.history.realms].sort(
    (a, b) => a.foundedYear - b.foundedYear,
  )[0];
  return realm ? realm.name : world.meta.capital;
}

function renderInfo(world       )       {
  const m = world.meta;
  $("worldname").textContent = worldName(world);
  $("worldsub").textContent = `seed "${m.seed}" · ${m.width}×${m.height} · fingerprint ${m.contentHash}`;

  const stats                          = [
    ["Land", `${(m.landFraction * 100).toFixed(0)}%`],
    ["Regions", String(m.regionCount)],
    ["Settlements", String(m.settlementCount)],
    ["Realms", String(m.realmCount)],
    ["Biomes", String(m.biomeDiversity)],
    ["Capital", m.capital],
    ["Dominant", m.dominantBiome],
    ["Year", `${m.presentYear} AR`],
  ];
  $("stats").innerHTML = stats
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
    .join("");

  const features = world.history.features
    .map((f) => {
      const label = f.kind === "peak" ? "Mount" : f.kind === "lake" ? "Lake" : "River";
      return `<li>${label} <b>${f.name}</b></li>`;
    })
    .join("");
  $("features").innerHTML = features;

  $("chronicle").innerHTML = world.history.events
    .map(
      (e) =>
        `<li><span class="yr">${e.year} AR</span> ${escapeHtml(e.text)}</li>`,
    )
    .join("");
}

function escapeHtml(s        )         {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generate(seed        )       {
  $("status").textContent = "Generating…";
  // Let the status paint before the (synchronous) generation blocks the thread.
  setTimeout(() => {
    const t0 = performance.now();
    current = generateWorld({ seed, width: SIZE, height: SIZE });
    const ms = Math.round(performance.now() - t0);
    renderInfo(current);
    draw();
    $("status").textContent = `Generated in ${ms} ms`;
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
      tabs
        .querySelectorAll("button")
        .forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      draw();
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
  seedInput.addEventListener("keydown", (e) => {
    if ((e                 ).key === "Enter") generate(seedInput.value || "cartogenesis");
  });

  const urlSeed = new URL(location.href).searchParams.get("seed");
  seedInput.value = urlSeed ?? "cartogenesis";
  generate(seedInput.value);
}

init();
