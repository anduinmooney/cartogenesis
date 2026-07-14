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
import { pickContourInterval, renderRegions, regionColor } from "./engine/render.ts";
import type { RegionInfo } from "./engine/regions.ts";
import { generateCityPlan, PLAN, type CityPlanInput } from "./engine/cityplan.ts";
import {
  containsPlace,
  placePattern,
  renderMarkdown,
  segmentPlaces,
} from "./markdown.ts";

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
  $("yearlabel").textContent = `${snap.year.toLocaleString()} ${current.history.calendar.suffix}`;
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
/** A persistent marker dropped by clicking a chronicle entry — so "fly to the
 *  event" lands on something visible even in townless countryside. */
let eventPin: { x: number; y: number; year: number; text: string } | null = null;

// --- Layer-scoped story markers ---------------------------------------------
// Each layer tab curates its own marker set, so the world's story is on the
// map without one cluttered view: the physical tabs carry the named features
// and volcanoes; Political carries region names and the ruins history left;
// Powers carries realm names that follow the time scrubber, plus each era's
// events as they happen; Faiths writes each faith's name on its own ground.

/** Tabs whose furniture is the land itself (features + volcanoes). */
const PHYSICAL_LAYERS = new Set([
  "terrain",
  "topographic",
  "biome",
  "height",
  "temperature",
  "moisture",
]);

interface FaithMarker {
  x: number;
  y: number;
  name: string;
  color: string;
  /** The faith's main label, on its largest holding. */
  primary: boolean;
  /** True at the faith's origin region — where the faith arose. */
  cradle: boolean;
}
let faithMarkers: FaithMarker[] = [];

interface RuinMarker {
  x: number;
  y: number;
  name: string;
  fate: string;
}
let ruinMarkers: RuinMarker[] = [];

interface RealmMarker {
  x: number;
  y: number;
  name: string;
  color: string;
  /** Land share, 0..1 — big powers get bigger type. */
  share: number;
}
/** Realm label positions per shown year (control maps differ per snapshot). */
const realmMarkerCache = new Map<number, RealmMarker[]>();

/** Lighten an engine RGB so it reads as label ink on the dark-bordered map. */
function inkOf(c: number[] | readonly number[]): string {
  const l = (v: number) => Math.round(v + (255 - v) * 0.45);
  return `rgb(${l(c[0])},${l(c[1])},${l(c[2])})`;
}

/** Rebuilt on every generate: faith homes/cradles and present-day ruins. */
function buildStoryMarkers(world: World): void {
  realmMarkerCache.clear();
  const regs = world.regions.regions;
  const regById = new Map(regs.map((r) => [r.id, r]));

  faithMarkers = [];
  for (const f of world.religion.faiths) {
    const color = inkOf(FAITH_PALETTE[f.id % FAITH_PALETTE.length]);
    const held = regs
      .filter((r) => world.religion.regionFaith[r.id] === f.id)
      .sort((a, b) => b.area - a.area);
    const home = held[0];
    const origin = regById.get(f.originRegionId);
    if (home) {
      faithMarkers.push({
        x: home.cx,
        y: home.cy,
        name: f.name,
        color,
        primary: true,
        cradle: home.id === f.originRegionId,
      });
    }
    if (origin && origin.id !== home?.id) {
      faithMarkers.push({
        x: origin.cx,
        y: origin.cy,
        name: f.name,
        color,
        primary: false,
        cradle: true,
      });
    }
  }

  ruinMarkers = world.simulation.settlementTimeline
    .filter((t) => t.fellYear !== undefined)
    .map((t) => ({ x: t.x, y: t.y, name: t.name, fate: t.fate ?? "fell" }));
}

/** Realm name anchors for a control map: the label sits on the centroid of the
 *  controlled region nearest the realm's weighted centre — always on own soil,
 *  drifting with the borders as the timeline plays. */
function realmMarkersFor(world: World, control: Record<number, number>): RealmMarker[] {
  const regs = world.regions.regions;
  const acc = new Map<number, { ax: number; ay: number; area: number; held: RegionInfo[] }>();
  let totalLand = 0;
  for (const r of regs) {
    totalLand += r.area;
    const owner = control[r.id];
    if (owner === undefined || owner < 0) continue;
    let e = acc.get(owner);
    if (!e) acc.set(owner, (e = { ax: 0, ay: 0, area: 0, held: [] }));
    e.ax += r.cx * r.area;
    e.ay += r.cy * r.area;
    e.area += r.area;
    e.held.push(r);
  }
  const byId = new Map(world.simulation.realms.map((r) => [r.id, r]));
  const out: RealmMarker[] = [];
  for (const [id, e] of acc) {
    const realm = byId.get(id);
    if (!realm || e.area === 0) continue;
    const mx = e.ax / e.area;
    const my = e.ay / e.area;
    let best = e.held[0];
    let bestD = Infinity;
    for (const r of e.held) {
      const dd = (r.cx - mx) * (r.cx - mx) + (r.cy - my) * (r.cy - my);
      if (dd < bestD) {
        bestD = dd;
        best = r;
      }
    }
    out.push({
      x: best.cx,
      y: best.cy,
      name: realm.name,
      color: inkOf(regionColor(id * 3 + 1)), // same hue the powers map fills with
      share: e.area / Math.max(1, totalLand),
    });
  }
  return out;
}

/** Realm labels for the year the Powers map is showing, cached per year. */
function realmMarkersAt(world: World, year: number): RealmMarker[] {
  const hit = realmMarkerCache.get(year);
  if (hit) return hit;
  const snap = world.simulation.snapshots.find((s) => s.year === year);
  const control = snap ? snap.control : world.simulation.finalControl;
  const built = realmMarkersFor(world, control);
  realmMarkerCache.set(year, built);
  return built;
}

/** The glyph and colour an event wears on the Powers map. */
function eventGlyph(type: string): { glyph: string; color: string } {
  switch (type) {
    case "conquest":
    case "repulsed":
      return { glyph: "⚔", color: "#ff7a6a" };
    case "revolt":
    case "secession":
    case "fall":
      return { glyph: "⚑", color: "#ffab4a" };
    case "plague":
      return { glyph: "☠", color: "#b6de8a" };
    case "famine":
      return { glyph: "⊘", color: "#e8c95a" };
    case "ruin":
      return { glyph: "✕", color: "#c3c9d1" };
    default: // founding, goldenage, conversion — the good news
      return { glyph: "✦", color: "#ffd96e" };
  }
}

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

/** Draw feature labels, city labels (when zoomed), any fly-to highlight, and
 *  the chronicle's event pin. */
function drawOverlays(): void {
  if (!current) return;
  const d = dpr();

  // The chronicle's event pin (drawn first so labels layer above it).
  if (eventPin) {
    const sx = eventPin.x * view.scale + view.ox;
    const sy = eventPin.y * view.scale + view.oy;
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 2 * d;
    ctx.beginPath();
    ctx.arc(sx, sy, 9 * d, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy - 9 * d);
    ctx.lineTo(sx, sy - 20 * d);
    ctx.stroke();
    drawLabel(sx, sy - 27 * d, `${eventPin.year} — ${eventPin.text}`, "#d9a441", Math.round(11 * d));
  }
  const inBounds = (sx: number, sy: number) =>
    sx > -80 && sy > -20 && sx < canvas.width + 80 && sy < canvas.height + 20;

  const fitScaleNow = canvas.width / current.elevation.width;
  const zoom = view.scale / fitScaleNow;

  // Named features and volcanoes — the physical tabs' furniture. The thematic
  // tabs (political / powers / faiths / resources) drop them so their own
  // story markers have the map to themselves.
  if (PHYSICAL_LAYERS.has(activeLayer)) {
    const ffont = Math.round(12 * d);
    for (const f of current.history.features) {
      const sx = f.x * view.scale + view.ox;
      const sy = f.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      const glyph = f.kind === "peak" ? "▲" : f.kind === "lake" ? "◆" : "≈";
      const prefix = f.kind === "peak" ? "Mt. " : f.kind === "lake" ? "Lake " : "R. ";
      drawLabel(sx, sy, glyph, "#eafcff", ffont);
      drawLabel(sx, sy - ffont * 1.15, prefix + f.name, "#eafcff", Math.round(ffont * 0.92));
    }
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
  }

  // Political tab: every region wears its name (small ones once you zoom),
  // and the ruins history left behind are marked where they fell.
  if (activeLayer === "political") {
    const rfont = Math.round(11 * d);
    for (const r of current.regions.regions) {
      if (r.area * zoom * zoom < 350) continue; // tiny regions earn a label on zoom
      const sx = r.cx * view.scale + view.ox;
      const sy = r.cy * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      drawLabel(sx, sy, r.name, "#f2ede0", rfont);
    }
    const rufont = Math.round(11 * d);
    for (const ru of ruinMarkers) {
      const sx = ru.x * view.scale + view.ox;
      const sy = ru.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      drawLabel(sx, sy, "†", "#b9bfc7", Math.round(rufont * 1.1));
      if (zoom > 1.6) {
        drawLabel(sx, sy - rufont * 1.2, `${ru.name} (${ru.fate})`, "#b9bfc7", Math.round(rufont * 0.85));
      }
    }
  }

  // Powers tab: each realm's name sits on its own territory and follows the
  // borders as the timeline scrubs — and the era's events flare up where they
  // happened (the same events the chronicle tells).
  if (activeLayer === "powers") {
    const shown = scrubYear ?? current.simulation.endYear;
    for (const rm of realmMarkersAt(current, shown)) {
      const sx = rm.x * view.scale + view.ox;
      const sy = rm.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      const font = Math.round((11 + 7 * Math.sqrt(rm.share)) * d);
      drawLabel(sx, sy, rm.name.toUpperCase(), rm.color, font);
    }
    // Events belonging to the era being shown: those since the previous
    // snapshot. Stack same-spot glyphs sideways so none hide.
    const snaps = current.simulation.snapshots;
    const idx = snaps.findIndex((s) => s.year === shown);
    const prevYear = idx > 0 ? snaps[idx - 1].year : idx === 0 ? -Infinity : shown - 1;
    const seen = new Map<string, number>();
    const efont = Math.round(13 * d);
    for (const e of current.simulation.events) {
      if (e.year <= prevYear || e.year > shown) continue;
      const k = `${e.x},${e.y}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      const sx = e.x * view.scale + view.ox + (n % 3) * 13 * d - 13 * d;
      const sy = e.y * view.scale + view.oy + Math.floor(n / 3) * 13 * d;
      if (!inBounds(sx, sy)) continue;
      const { glyph, color } = eventGlyph(e.type);
      drawLabel(sx, sy, glyph, color, efont);
    }
  }

  // Faiths tab: the faith's name on its largest holding, and a star where it
  // arose — so the map itself says what the legend colours mean.
  if (activeLayer === "faiths") {
    const ffont = Math.round(13 * d);
    for (const fm of faithMarkers) {
      const sx = fm.x * view.scale + view.ox;
      const sy = fm.y * view.scale + view.oy;
      if (!inBounds(sx, sy)) continue;
      if (fm.primary) {
        drawLabel(sx, sy, fm.name, fm.color, ffont);
        if (fm.cradle) {
          drawLabel(sx, sy + ffont * 1.1, "✦ where it arose", fm.color, Math.round(ffont * 0.75));
        }
      } else {
        drawLabel(sx, sy, `✦ ${fm.name} arose here`, fm.color, Math.round(ffont * 0.8));
      }
    }
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
  // Hover answers for what the map is SHOWING. While the Powers timeline is
  // scrubbed to a past year, only towns alive that year are inspectable — the
  // same filter drawOverlays applies to the markers. Otherwise: present-day
  // survivors (a ruin is not a town).
  const aliveThen =
    scrubYear !== null
      ? new Set(
          settlementsAt(current.simulation.settlementTimeline, scrubYear).map((t) => t.id),
        )
      : null;
  let best: Settlement | null = null;
  let bestD = maxCells * maxCells;
  for (const s of current.settlements.settlements) {
    if (aliveThen ? !aliveThen.has(s.id) : ruinedIds.has(s.id)) continue;
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

/** Screen (client) position of a world cell, for hit-testing drawn markers. */
function worldToClient(wx: number, wy: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const k = canvas.width / rect.width;
  return {
    x: rect.left + (wx * view.scale + view.ox) / k,
    y: rect.top + (wy * view.scale + view.oy) / k,
  };
}

/**
 * The layer's own story markers are labels on the map — hovering one should
 * explain it, not the dirt beneath it. Hit-tests the markers drawn for the
 * active layer (faiths / realms / ruins) in screen space and returns a tip
 * fragment, or null. So the folio's labels answer for themselves.
 */
function markerTip(clientX: number, clientY: number): string | null {
  if (!current) return null;
  const HIT = 24; // px around a marker's anchor
  const near = (mx: number, my: number): boolean => {
    const p = worldToClient(mx, my);
    const dx = p.x - clientX;
    const dy = p.y - clientY;
    return dx * dx + dy * dy <= HIT * HIT;
  };

  if (activeLayer === "faiths") {
    for (const fm of faithMarkers) {
      if (!near(fm.x, fm.y)) continue;
      const faith = current.religion.faiths.find((f) => f.name === fm.name);
      if (!faith) continue;
      return (
        `<div class="tname">${escapeHtml(faith.name)}</div>` +
        `<div class="tgloss">${glossPhrase(faith.deity.gloss)}</div>` +
        `<div class="trow cap">${escapeHtml(faith.deity.name)}, god of ${escapeHtml(faith.deity.domain.toLowerCase())}</div>` +
        (fm.cradle ? `<div class="trow">✦ the faith arose here</div>` : "")
      );
    }
  }

  if (activeLayer === "powers") {
    const shown = scrubYear ?? current.simulation.endYear;
    for (const rm of realmMarkersAt(current, shown)) {
      if (!near(rm.x, rm.y)) continue;
      const realm = current.simulation.realms.find((r) => r.name === rm.name);
      const pct = Math.round(rm.share * 100);
      return (
        `<div class="tname">${escapeHtml(rm.name)}</div>` +
        `<div class="trow">holds ${pct}% of the land${realm ? `, ${realm.status}` : ""}</div>` +
        (realm ? `<div class="trow">peak ${realm.peakSize} province${realm.peakSize === 1 ? "" : "s"} in ${realm.peakYear}</div>` : "")
      );
    }
  }

  if (activeLayer === "political") {
    for (const ru of ruinMarkers) {
      if (!near(ru.x, ru.y)) continue;
      const t = current.simulation.settlementTimeline.find((s) => s.name === ru.name);
      const when =
        t?.fellYear !== undefined ? ` in ${t.fellYear} ${current.history.calendar.suffix}` : "";
      return (
        `<div class="tname">${escapeHtml(ru.name)} <span class="trow">— a ruin</span></div>` +
        `<div class="trow cap">${ru.fate === "sacked" ? "stormed" : "abandoned"}${when}</div>` +
        `<div class="trow">click for the plan of what remains</div>`
      );
    }
  }
  return null;
}

function showTip(clientX: number, clientY: number): void {
  // A drawn marker answers for itself before the terrain under it does.
  const marker = markerTip(clientX, clientY);
  if (marker) {
    tip.innerHTML = marker;
    tip.hidden = false;
    positionTip(clientX, clientY);
    return;
  }
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
  positionTip(clientX, clientY);
}

/** Place the tip beside the cursor, flipping to stay on screen. */
function positionTip(clientX: number, clientY: number): void {
  const pad = 14;
  let left = clientX + pad;
  let top = clientY + pad;
  const r = tip.getBoundingClientRect();
  if (left + r.width > window.innerWidth) left = clientX - r.width - pad;
  if (top + r.height > window.innerHeight) top = clientY - r.height - pad;
  tip.style.left = `${Math.max(4, left)}px`;
  tip.style.top = `${Math.max(4, top)}px`;
}

// --- L19: the town plans. Click a town (or a ruin) and descend to its
// streets — every stone derived from facts the generator already decided.

function cityPlanInput(world: World): CityPlanInput {
  return {
    water: world.water,
    rivers: world.rivers,
    regions: world.regions,
    settlements: world.settlements.settlements,
    roads: world.roads,
    simulation: world.simulation,
    economy: world.economy,
    religion: world.religion,
    lore: world.lore,
    history: world.history,
    meta: {
      seed: world.meta.seed,
      width: world.elevation.width,
      presentYear: world.meta.presentYear,
    },
  };
}

/** The engraver's inks for each plan cell, in the folio's palette. */
const PLAN_INK: Record<number, string> = {
  [PLAN.Field]: "#e3d8bd",
  [PLAN.Street]: "#f0e7d1",
  [PLAN.Building]: "#94826a",
  [PLAN.Wall]: "#2b2117",
  [PLAN.Gate]: "#7d2c23",
  [PLAN.Water]: "#93aab4",
  [PLAN.Quay]: "#b3925d",
  [PLAN.Market]: "#f5edd9",
  [PLAN.Temple]: "#7d2c23",
  [PLAN.Keep]: "#4d4032",
  [PLAN.Green]: "#aab58c",
  [PLAN.Rubble]: "#c4b493",
  [PLAN.Bridge]: "#b3925d",
  [PLAN.River]: "#93aab4",
};

/** The plan on display, for the ruined ↔ as-it-stood flip. */
let planShownId = -1;
let planShownWhole = false;
const PLAN_SCALE = 8;
/** Named points of the shown plan (plan-cell coords), for canvas hover. */
let planPoints: Array<{ name: string; note: string; x: number; y: number }> = [];

function openPlan(settlementId: number, asItStood = false): void {
  if (!current) return;
  const plan = generateCityPlan(cityPlanInput(current), settlementId, { asItStood });
  if (!plan) return;
  planShownId = settlementId;
  planShownWhole = asItStood;
  planPoints = [
    ...plan.landmarks.map((l) => ({ name: l.name, note: l.note, x: l.x, y: l.y })),
    ...plan.districts.map((d) => ({ name: d.name, note: d.note, x: d.x, y: d.y })),
  ];
  // A fallen town can be seen both ways: as it remains, and as it stood.
  const flip = $("plan-flip");
  flip.hidden = !plan.fell;
  flip.textContent = plan.ruined ? "see it as it stood" : "see what remains";
  $("plan-title").textContent = plan.title;
  $("plan-facts").innerHTML = plan.facts
    .map((f) => `<p>${escapeHtml(f)}</p>`)
    .join("");

  const cv = $("plancanvas") as HTMLCanvasElement;
  const scale = PLAN_SCALE;
  cv.width = plan.width * scale;
  cv.height = plan.height * scale;
  const g = cv.getContext("2d")!;
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const c = plan.cells[y * plan.width + x];
      g.fillStyle = PLAN_INK[c] ?? "#e3d8bd";
      g.fillRect(x * scale, y * scale, scale, scale);
      // A second tone gives buildings and rubble an engraved grain.
      if (c === PLAN.Building && (x * 7 + y * 13) % 4 === 0) {
        g.fillStyle = "#87755d";
        g.fillRect(x * scale, y * scale, scale, scale);
      } else if (c === PLAN.Rubble && (x * 5 + y * 11) % 5 === 0) {
        g.fillStyle = "#8d7c62";
        g.fillRect(x * scale + 2, y * scale + 2, scale - 4, scale - 4);
      }
    }
  }
  // Labels: landmarks in ink with a paper halo; districts in italic.
  const label = (text: string, x: number, y: number, italic: boolean, size: number) => {
    g.font = `${italic ? "italic " : ""}600 ${size}px Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 4;
    g.lineJoin = "round";
    g.strokeStyle = "rgba(240, 231, 209, 0.9)";
    g.strokeText(text, x * scale, y * scale);
    g.fillStyle = italic ? "#6b5b45" : "#2b2117";
    g.fillText(text, x * scale, y * scale);
  };
  for (const d of plan.districts) label(d.name, d.x, d.y, true, 15);
  for (const l of plan.landmarks) {
    if (l.kind === "market" || l.kind === "gate") continue; // legend carries these
    label(l.name, l.x, l.y - 2.2, false, 14);
  }

  $("plan-legend").innerHTML = [...plan.landmarks, ...plan.districts.map((d) => ({
    kind: "district" as const,
    name: d.name,
    note: d.note,
  }))]
    .map(
      (l) =>
        `<li><b>${escapeHtml(l.name)}</b> <span class="gl">— ${escapeHtml(l.note)}</span></li>`,
    )
    .join("");
  if (currentEntities) linkifyPlaces($("plan-legend"), currentEntities);

  $("planovl").hidden = false;
}

/** The nearest FALLEN town to a world point — so ruins are clickable too. */
function nearestRuin(wx: number, wy: number, maxCells: number) {
  if (!current) return null;
  let best = null as null | (typeof current.simulation.settlementTimeline)[number];
  let bestD = maxCells * maxCells;
  for (const t of current.simulation.settlementTimeline) {
    if (t.fellYear === undefined) continue;
    const dd = (t.x - wx) * (t.x - wx) + (t.y - wy) * (t.y - wy);
    if (dd < bestD) {
      bestD = dd;
      best = t;
    }
  }
  return best;
}

function pinDetail(clientX: number, clientY: number): void {
  const world = clientToWorld(clientX, clientY);
  const info = inspect(world.x, world.y);
  const detail = $("detail");
  // A fallen town has no living marker, but its ground remembers: clicking
  // near a ruin shows what stood there — and the plan of what remains.
  const ruin = info?.settlement ? null : nearestRuin(world.x, world.y, 4);
  if (!info || (info.isOcean && !info.settlement && !ruin)) {
    detail.hidden = true;
    return;
  }
  const parts: string[] = [`<span class="dclose" title="dismiss">✕</span>`];
  if (ruin) {
    parts.push(`<div class="dh">${ruin.name} <span class="drow">— a ruin</span></div>`);
    parts.push(
      `<div class="drow">${ruin.fate === "sacked" ? "stormed" : "abandoned"} in ${ruin.fellYear} ${current!.history.calendar.suffix} · founded ${ruin.foundedYear}</div>`,
    );
    parts.push(
      `<div class="drow"><span class="planlink" data-plan="${ruin.id}">⌖ the plan of what remains</span></div>`,
    );
  } else if (info.settlement) {
    const s = info.settlement;
    parts.push(`<div class="dh">${s.name}</div>`);
    parts.push(`<div class="dgloss">${glossPhrase(s.gloss)}</div>`);
    if (s.formerNames?.length) {
      const f = s.formerNames[s.formerNames.length - 1];
      parts.push(
        `<div class="drow">formerly <b>${f.name}</b> (${glossPhrase(f.gloss)}) — ` +
          `renamed under foreign rule c. ${f.untilYear} ${current.history.calendar.suffix}</div>`,
      );
    }
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
    parts.push(
      `<div class="drow"><span class="planlink" data-plan="${s.id}">⌖ the plan of the ${s.isCapital ? "capital" : s.tier}</span></div>`,
    );
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
  const link = detail.querySelector(".planlink") as HTMLElement | null;
  if (link) {
    link.addEventListener("click", () => openPlan(Number(link.getAttribute("data-plan"))));
  }
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
  const rose = document.getElementById("rose");
  if (rose) rose.style.setProperty("--tilt", "0deg");
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
    // The compass rose leans into the pan and rights itself on release.
    const rose = document.getElementById("rose");
    if (rose) {
      const tilt = Math.max(-12, Math.min(12, -dx * 0.55));
      rose.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
    }
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

  // The dossier reads as a surveyor's summary, not a spreadsheet — every
  // number is real, and the sentences are assembled from the world's facts.
  const land = Math.round(m.landFraction * 100);
  const dossier: string[] = [];
  dossier.push(
    `A world <b>${land}%</b> land, rising to <b>${m.highestPeakMetres.toLocaleString()} m</b>, ` +
      `with <b>${m.volcanoCount}</b> volcano${m.volcanoCount === 1 ? "" : "es"}` +
      `${m.activeVolcanoes > 0 ? ` — <b>${m.activeVolcanoes}</b> still restless` : ", all quiet"}.`,
  );
  dossier.push(
    `Its people hold <b>${m.regionCount}</b> provinces and <b>${m.settlementCount}</b> towns; ` +
      `<b>${m.realmCount}</b> realms rose over the centuries and <b>${m.survivingRealms}</b> stand today, ` +
      `<b>${m.dominantPower}</b> the greatest among them.`,
  );
  dossier.push(
    `The capital is <b>${m.capital}</b>, seat of House <b>${m.capitalHouse}</b>; ` +
      `<b>${m.faithCount}</b> faiths keep their gods` +
      `${m.ruinCount > 0 ? `, and <b>${m.ruinCount}</b> town${m.ruinCount === 1 ? " lies" : "s lie"} in ruins` : ""}.`,
  );
  if (m.majorExports) {
    dossier.push(`Its markets move ${m.majorExports.toLowerCase()}.`);
  }
  $("stats").innerHTML = dossier.map((p) => `<p>${p}</p>`).join("");

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
        `<span class="yr">${e.year} ${world.history.calendar.suffix}</span> ${escapeHtml(e.text)}</li>`,
    )
    .join("");

  // Entity tooltips in the sidebar as well: the same names that are live in
  // the gazetteer are live in the annals list and the features list. This must
  // run AFTER the lists' innerHTML is set — assignment wipes the spans.
  currentEntities = entityIndex(world);
  linkifyPlaces($("chronicle"), currentEntities);
  linkifyPlaces($("features"), currentEntities);
  linkifyPlaces($("stats"), currentEntities); // the dossier's names are live too
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
  } else if (activeLayer === "topographic") {
    const peak = current.meta.highestPeakMetres;
    const interval = pickContourInterval(Math.max(1, peak));
    el.innerHTML =
      `<span class="lg">contour interval <b>&nbsp;${interval} m</b>&nbsp;· heavier line every ${interval * 5} m · peak ${peak.toLocaleString()} m</span>`;
    return;
  } else if (activeLayer === "biome") {
    const bset = new Set<number>();
    for (let i = 0; i < current.biomes.ids.length; i++) bset.add(current.biomes.ids[i]);
    items = [...bset]
      .filter((b) => b > 1)
      .sort((a, b) => a - b)
      .map((b) => [BIOME_NAMES[b as keyof typeof BIOME_NAMES], BIOME_COLORS[b as keyof typeof BIOME_COLORS]]);
  } else if (activeLayer === "faiths") {
    items = current.religion.faiths.map((f) => [
      `${f.name} — ${f.deity.domain}`,
      FAITH_PALETTE[f.id % FAITH_PALETTE.length],
    ]);
  } else if (activeLayer === "powers") {
    // The Powers map marks each era's events as the timeline scrubs.
    const g = (glyph: string, color: string, label: string) =>
      `<span class="lg"><b style="color:${color}">${glyph}</b>&nbsp;${label}</span>`;
    el.innerHTML =
      g("⚔", "#ff7a6a", "war") +
      g("⚑", "#ffab4a", "revolt · fall") +
      g("☠", "#b6de8a", "plague") +
      g("⊘", "#e8c95a", "famine") +
      g("✕", "#c3c9d1", "ruin") +
      g("✦", "#ffd96e", "founding · golden age") +
      `<span class="lg">— each era's events, as the timeline plays</span>`;
    return;
  }
  el.innerHTML = items
    .map(
      ([name, c]) =>
        `<span class="lg"><i style="background:rgb(${c[0]},${c[1]},${c[2]})"></i>${name}</span>`,
    )
    .join("");
}

function generate(seed: string): void {
  $("status").textContent = "Surveying the coasts, raising the mountains, settling the folk…";
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
  buildStoryMarkers(world);
  scrubYear = null;
  eventPin = null;
  // Verification handle: lets session tooling read the world and the view
  // transform without scraping pixels. Not part of any public surface.
  (window as unknown as Record<string, unknown>).__cartogenesis = { world, view };
  renderInfo(world);
  buildGazetteer(world);
  renderOffscreen();
  sizeCanvas();
  fitView();
  redraw();
  updateLegend();
  updateScrubber();
  canvas.classList.remove("busy");
  $("status").textContent = `Surveyed in ${ms} ms · drag to pan, scroll to zoom, hover to inspect`;
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
    if (Number.isFinite(x) && Number.isFinite(y)) {
      // Drop a labelled pin at the event so the fly-to lands on something
      // visible — events anchor to towns when the region has one, but a famine
      // in empty country still deserves a mark.
      // Strip the entry's own date prefix (the .yr span — "150 A.C." or
      // whatever this world's suffix is) so the pin doesn't say the year twice.
      const yr = li.querySelector(".yr")?.textContent?.trim() ?? "";
      const year = yr.replace(/[^\d,].*$/, "");
      let text = (li.textContent ?? "").trim();
      if (yr && text.startsWith(yr)) text = text.slice(yr.length).trim();
      eventPin = { x, y, year: Number(year.replace(/,/g, "")) || 0, text: text.slice(0, 46) + (text.length > 46 ? "…" : "") };
      flyTo(x, y);
    }
  });

  $("plan-close").addEventListener("click", () => {
    $("planovl").hidden = true;
    tip.hidden = true;
  });
  $("plan-flip").addEventListener("click", () => {
    if (planShownId >= 0) openPlan(planShownId, !planShownWhole);
  });
  // Hovering the plan drawing names the building under the cursor — so the
  // legend's list and the engraving point at each other.
  const planCanvas = $("plancanvas") as HTMLCanvasElement;
  planCanvas.addEventListener("mousemove", (e) => {
    const rect = planCanvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) * (planCanvas.width / rect.width)) / PLAN_SCALE;
    const cy = ((e.clientY - rect.top) * (planCanvas.height / rect.height)) / PLAN_SCALE;
    let best: (typeof planPoints)[number] | null = null;
    let bestD = 7 * 7; // plan cells
    for (const p of planPoints) {
      const dd = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
      if (dd < bestD) {
        bestD = dd;
        best = p;
      }
    }
    if (!best) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML =
      `<div class="tname">${escapeHtml(best.name)}</div>` +
      `<div class="tgloss">${escapeHtml(best.note)}</div>`;
    tip.hidden = false;
    positionTip(e.clientX, e.clientY);
  });
  planCanvas.addEventListener("mouseleave", () => {
    tip.hidden = true;
  });
  $("planovl").addEventListener("click", (e) => {
    if (e.target === $("planovl")) $("planovl").hidden = true;
  });

  wireGazetteer();
  wireExports();
  wireEntityTooltips();

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

/** Anything the prose can reference: where it is (if anywhere), and what to say. */
interface Entity {
  kind: string;
  label: string;
  /** Tooltip body lines. */
  lines: string[];
  x?: number;
  y?: number;
}

/** The current world's referenceable names. Rebuilt on every generate. */
let currentEntities: Map<string, Entity> | null = null;

/**
 * name → entity, for every kind of thing the prose mentions: people, houses,
 * realms, faiths, gods, then places — places inserted LAST so that if a person
 * ever shares a name with a town, the clickable, locatable thing wins.
 */
function entityIndex(world: World): Map<string, Entity> {
  const idx = new Map<string, Entity>();
  const put = (name: string | undefined, e: Entity) => {
    if (name && name.length >= 3) idx.set(name, e);
  };
  const regionById = new Map(world.regions.regions.map((r) => [r.id, r]));
  const timeline = new Map(world.simulation.settlementTimeline.map((t) => [t.id, t]));
  const realmSeat = new Map(world.history.realms.map((r) => [r.name, r.regionId]));

  // People — rulers (full styled name) and notable figures (bare name).
  for (const r of world.lore.rulers) {
    const realm = world.history.realms.find((x) => x.id === r.realmId);
    const seat = realm ? regionById.get(realm.regionId) : undefined;
    put(r.name, {
      kind: "ruler",
      label: r.name,
      lines: [
        `Reigned ${r.startYear}–${r.endYear}${r.reigning ? " (reigning now)" : ""}`,
        realm ? `Ruler of ${realm.name}` : "",
      ].filter(Boolean),
      x: seat?.cx,
      y: seat?.cy,
    });
  }
  for (const fig of world.lore.figures) {
    const bare = fig.name.split(",")[0];
    put(bare, { kind: "figure", label: fig.name, lines: [fig.description] });
  }

  // Houses, realms (historic and simulated), faiths, gods.
  for (const h of world.lore.houses) {
    const seat = regionById.get(realmSeat.get(h.realmName) ?? -1);
    put(h.name, {
      kind: "house",
      label: `House ${h.name}`,
      lines: [`${glossPhrase(h.gloss)} — ruling house of ${h.realmName}`],
      x: seat?.cx,
      y: seat?.cy,
    });
  }
  const finalByRealm = new Map<number, number>();
  for (const [rid, realmId] of Object.entries(world.simulation.finalControl)) {
    if (!finalByRealm.has(realmId as number)) finalByRealm.set(realmId as number, Number(rid));
  }
  for (const r of world.simulation.realms) {
    const seatRegion =
      regionById.get(realmSeat.get(r.name) ?? -1) ?? regionById.get(finalByRealm.get(r.id) ?? -1);
    const fate =
      r.status === "extinct"
        ? "extinguished"
        : r.status === "ascendant"
          ? `ascendant — ${r.finalSize} province${r.finalSize === 1 ? "" : "s"}`
          : `diminished — ${r.finalSize} of a peak ${r.peakSize}`;
    put(r.name, {
      kind: "realm",
      label: r.name,
      lines: [
        `Realm (${r.languageId}) · founded ${r.foundedYear}`,
        `Peak ${r.peakSize} province${r.peakSize === 1 ? "" : "s"} in ${r.peakYear} · ${fate}`,
      ],
      x: seatRegion?.cx,
      y: seatRegion?.cy,
    });
  }
  for (const fa of world.religion.faiths) {
    const origin = regionById.get(fa.originRegionId);
    put(fa.name, {
      kind: "faith",
      label: fa.name,
      lines: [
        `${fa.deity.name}, ${glossPhrase(fa.deity.gloss)} — god of ${fa.deity.domain.toLowerCase()}`,
        `Followed in ${fa.followerRegions.length || 1} region${(fa.followerRegions.length || 1) === 1 ? "" : "s"}`,
      ],
      x: origin?.cx,
      y: origin?.cy,
    });
    put(fa.deity.name, {
      kind: "deity",
      label: fa.deity.name,
      lines: [
        `${glossPhrase(fa.deity.gloss)} — god of ${fa.deity.domain.toLowerCase()}`,
        `Worshipped by ${fa.name}`,
      ],
      x: origin?.cx,
      y: origin?.cy,
    });
  }

  // Places last — they win any name collision.
  for (const fe of world.history.features) {
    put(fe.name, {
      kind: fe.kind,
      label: fe.kind === "peak" ? `Mount ${fe.name}` : fe.name,
      lines: [
        `${glossPhrase(fe.gloss)} — the ${
          fe.kind === "peak" ? "highest peak" : fe.kind === "river" ? "greatest river" : "largest inland water"
        }`,
      ],
      x: fe.x,
      y: fe.y,
    });
  }
  for (const v of world.volcanoes) {
    put(v.name, {
      kind: "volcano",
      label: `Mount ${v.name}`,
      lines: [
        `${glossPhrase(v.gloss)} — ${v.type}, ${v.status}`,
        v.caldera ? (v.caldera.lakeLevel !== undefined ? "Caldera with a crater lake" : "Collapsed caldera") : "",
        v.arcId !== undefined ? "One of an island arc" : "",
      ].filter(Boolean),
      x: v.x,
      y: v.y,
    });
  }
  for (const r of world.regions.regions) {
    const faith = world.religion.faiths.find((x) => x.id === world.religion.regionFaith[r.id]);
    put(r.name, {
      kind: "region",
      label: r.name,
      lines: [
        `${glossPhrase(r.gloss)} — ${r.languageLabel}`,
        `${BIOME_NAMES[r.dominantBiome as keyof typeof BIOME_NAMES]} · ${r.coastal ? "coastal" : "inland"} · ${r.area} cells`,
        faith ? `Faith: ${faith.name}` : "",
      ].filter(Boolean),
      x: r.cx,
      y: r.cy,
    });
  }
  for (const st of world.settlements.settlements) {
    const t = timeline.get(st.id);
    const eco = world.economy.economies.find((e) => e.settlementId === st.id);
    put(st.name, {
      kind: "settlement",
      label: st.name,
      lines: [
        `${glossPhrase(st.gloss)} — ${st.isCapital ? "capital" : st.tier}${st.isPort ? ", port" : ""}`,
        t ? `Founded ${t.foundedYear}${t.fellYear !== undefined ? ` · fell ${t.fellYear}` : ""}` : "",
        st.formerNames?.length ? `Formerly ${st.formerNames[st.formerNames.length - 1].name}` : "",
        eco?.produces.length
          ? `Produces ${eco.produces.slice(0, 3).map((k) => RESOURCE_NAMES[k]).join(", ")}`
          : "",
      ].filter(Boolean),
      x: st.x,
      y: st.y,
    });
    // Old names still appear in sagas and "formerly" notes — make them live too.
    for (const old of st.formerNames ?? []) {
      put(old.name, {
        kind: "settlement",
        label: `${old.name} (now ${st.name})`,
        lines: [`${glossPhrase(old.gloss)} — renamed under foreign rule c. ${old.untilYear}`],
        x: st.x,
        y: st.y,
      });
    }
  }
  return idx;
}


/**
 * Wrap every occurrence of a known place name (in a text node) with a clickable
 * span carrying its coordinates. Works on the DOM, not the HTML string, so it
 * can never break tags or match inside attributes.
 */
function linkifyPlaces(root: HTMLElement, idx: Map<string, Entity>): void {
  if (idx.size === 0) return;
  // The matching itself is pure string logic in markdown.ts (placePattern /
  // containsPlace / segmentPlaces), under Node tests — a stateful /g regex once
  // silently dropped links here, and the extraction keeps that regression caged.
  const re = placePattern([...idx.keys()]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if ((t.parentElement?.className ?? "").includes("place")) continue;
    if (containsPlace(t.data, re)) targets.push(t);
  }
  for (const t of targets) {
    const frag = document.createDocumentFragment();
    for (const seg of segmentPlaces(t.data, re)) {
      if (!seg.place) {
        frag.appendChild(document.createTextNode(seg.text));
        continue;
      }
      const ent = idx.get(seg.text)!;
      const span = document.createElement("span");
      span.className = "place";
      span.textContent = seg.text;
      span.dataset.name = seg.text;
      if (ent.x !== undefined && ent.y !== undefined) {
        span.dataset.x = String(ent.x);
        span.dataset.y = String(ent.y);
      }
      frag.appendChild(span);
    }
    t.parentNode?.replaceChild(frag, t);
  }
}

/** Build the gazetteer panel for a world (does not open it). */
function buildGazetteer(world: World): void {
  gazetteerMd = worldReportMarkdown(world);
  const { html, headings } = renderMarkdown(gazetteerMd);
  const content = $("gaz-content");
  content.innerHTML = html;
  currentEntities ??= entityIndex(world);
  linkifyPlaces(content, currentEntities);

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

/** Tooltip body for an entity, in the map tooltip's own visual language. */
function entityTipHtml(e: Entity): string {
  const rows = e.lines.map((l) => `<div class="trow">${escapeHtml(l)}</div>`).join("");
  return `<div class="tname">${escapeHtml(e.label)}</div>${rows}`;
}

/** Hovering any linkified name — gazetteer, annals, features — explains it. */
function wireEntityTooltips(): void {
  document.addEventListener("mouseover", (ev) => {
    const el = ev.target as HTMLElement;
    if (!el.classList?.contains("place")) return;
    const ent = currentEntities?.get(el.dataset.name ?? el.textContent ?? "");
    if (!ent) return;
    tip.innerHTML = entityTipHtml(ent);
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const pad = 10;
    let left = r.left;
    let top = r.bottom + 6;
    const tr = tip.getBoundingClientRect();
    if (left + tr.width > window.innerWidth - pad) left = window.innerWidth - tr.width - pad;
    if (top + tr.height > window.innerHeight - pad) top = r.top - tr.height - 6;
    tip.style.left = `${Math.max(pad, left)}px`;
    tip.style.top = `${Math.max(pad, top)}px`;
  });
  document.addEventListener("mouseout", (ev) => {
    const el = ev.target as HTMLElement;
    if (el.classList?.contains("place")) tip.hidden = true;
  });
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
