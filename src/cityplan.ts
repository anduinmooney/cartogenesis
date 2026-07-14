// cityplan.ts — L19: the town plans (the world, at the second scale).
//
// Every map the engine draws is the world seen from above the clouds; this
// layer descends to the rooftops. Each settlement has a PLAN — streets,
// walls, quays, temple, keep, market — and the plan is not decoration: every
// stone of it is derived from facts the generator already decided.
//
//   - The gates stand where the town's REAL roads leave it, and each is
//     named for the real neighbouring town its road runs to.
//   - The harbour lies on the side where the REAL ocean is; a river town's
//     river crosses the plan the way the real river flows.
//   - The temple belongs to the region's real faith and names its real god;
//     the keep names the real ruling house of the realm that holds the
//     region in the present year.
//   - Walls exist only where history earned them: a town whose region saw
//     wars is walled; a town the wars passed by is open.
//   - The market smells of the town's real economy, and a town renamed by
//     conquest keeps an Old Town where people still say the former name.
//   - A town that FELL in the simulation has a plan too — the plan of what
//     remains, roofless and breached, dated to the year it fell.
//
// Deterministic from (world seed, settlement id) on a private stream; pure
// (reads the finished world, mutates nothing); computed on demand like the
// report and the poster — a renderer of world-state, not an author of it.
// Exact arithmetic only (D-022): octants by comparison, circles by dist().

import { Rng } from "./rng.ts";
import { dist } from "./exact.ts";
import { glossPhrase } from "./language.ts";
import { RESOURCE_NAMES } from "./resources.ts";
import type { WaterLayer } from "./hydrology.ts";
import type { RiverLayer } from "./rivers.ts";
import type { RegionLayer } from "./regions.ts";
import type { Settlement } from "./settlements.ts";
import type { RoadLayer } from "./roads.ts";
import type { SimulationLayer } from "./simulation.ts";
import type { EconomyLayer } from "./economy.ts";
import type { ReligionLayer } from "./religion.ts";
import type { LoreLayer } from "./lore.ts";
import type { HistoryLayer } from "./history.ts";

/** Plan cell codes (const object — Node strip mode rejects TS enums). */
export const PLAN = {
  Field: 0,
  Street: 1,
  Building: 2,
  Wall: 3,
  Gate: 4,
  Water: 5,
  Quay: 6,
  Market: 7,
  Temple: 8,
  Keep: 9,
  Green: 10,
  Rubble: 11,
  Bridge: 12,
  River: 13,
} as const;

export interface PlanLandmark {
  kind: "temple" | "keep" | "market" | "gate" | "quay" | "shrine";
  name: string;
  note: string;
  x: number;
  y: number;
}

export interface PlanDistrict {
  name: string;
  note: string;
  x: number;
  y: number;
}

export interface CityPlan {
  settlementId: number;
  title: string;
  /** The dossier above the drawing — every line a fact of the world. */
  facts: string[];
  width: number;
  height: number;
  cells: Uint8Array;
  landmarks: PlanLandmark[];
  districts: PlanDistrict[];
  walled: boolean;
  ruined: boolean;
}

export interface CityPlanInput {
  water: WaterLayer;
  rivers: RiverLayer;
  regions: RegionLayer;
  settlements: Settlement[];
  roads: RoadLayer;
  simulation: SimulationLayer;
  economy: EconomyLayer;
  religion: ReligionLayer;
  lore: LoreLayer;
  history: HistoryLayer;
  meta: { seed: number | string; width: number; presentYear: number };
}

// --- Octants by comparison (atan2 is banned and unneeded). -------------------
// Screen convention: +x east, +y SOUTH (grids grow downward).
const OCT_DIRS: ReadonlyArray<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const OCT_NAMES = [
  "east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast",
];
const TAN_67_5 = 2.414213562373095; // tan(67.5°), a constant, not a Math call

function octantOf(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay * TAN_67_5) return dx >= 0 ? 0 : 4; // E / W
  if (ay >= ax * TAN_67_5) return dy >= 0 ? 2 : 6; // S / N
  if (dx >= 0) return dy >= 0 ? 1 : 7; // SE / NE
  return dy >= 0 ? 3 : 5; // SW / NW
}

/** District flavour by what the town actually trades in. */
const WARE_DISTRICTS: Record<string, [string, string]> = {
  Iron: ["the Smiths' Quarter", "forges kept against the wall, by old law"],
  Copper: ["the Smiths' Quarter", "the coppersmiths' hammers start before the birds"],
  Gold: ["the Assay Court", "weighed twice, argued once"],
  Gems: ["the Lapidaries' Row", "small windows, heavy doors"],
  Salt: ["the Salt Stores", "white gold under guard"],
  Grain: ["the Granary Rows", "the countryside eats from these floors in a bad year"],
  Fish: ["the Shambles", "fish and argument, mornings only"],
  Timber: ["the Sawyers' Yards", "planks stacked higher than the fence that hides them"],
  Stone: ["the Masons' Bank", "half the town was cut here"],
  Wine: ["the Vintners' Court", "casks below, accounting above"],
  Wool: ["the Weavers' Row", "looms heard through every open window"],
  Livestock: ["the Beast Fair", "held where the ring-road widens; mind your boots"],
  Horses: ["the Horse Fair", "buyers of horses and rumours, both overpriced"],
  Furs: ["the Skinners' Yard", "downwind of everything, by common demand"],
  Clay: ["the Potters' Bank", "kilns glowing into the evening"],
};

const GENERIC_DISTRICTS: Array<[string, string]> = [
  ["the Dyers' Steps", "the gutters run a different colour every week"],
  ["the Lantern Rows", "lit at dusk at the ward's own cost"],
  ["the Low Commons", "geese, laundry, and the town's best gossip"],
  ["the Bell Ward", "everything here is measured from the bell"],
];

export function generateCityPlan(input: CityPlanInput, settlementId: number): CityPlan | null {
  const { water, rivers, regions, settlements, roads, simulation, economy, religion, lore } =
    input;
  const worldW = input.meta.width;
  const s = settlements.find((t) => t.id === settlementId);
  if (!s) return null;
  const timed = simulation.settlementTimeline.find((t) => t.id === settlementId);
  const ruined = timed?.fellYear !== undefined;
  const rng = new Rng(`${input.meta.seed}:cityplan:${settlementId}`);

  // ---- The facts the plan is built from. ----
  const region = regions.regions.find((r) => r.id === s.regionId);
  const faithId = religion.regionFaith[s.regionId];
  const faith = religion.faiths.find((f) => f.id === faithId);
  const controllingRealm = simulation.realms.find(
    (r) => r.id === simulation.finalControl[s.regionId],
  );
  const house = lore.houses.find((h) => h.realmName === controllingRealm?.name);
  const eco = economy.economies.find((e) => e.settlementId === s.id);
  const suffix = input.history.calendar.suffix;

  // Wars that actually crossed this region → walls.
  const warsHere = simulation.events.filter(
    (e) =>
      (e.type === "conquest" || e.type === "repulsed" || e.type === "fall") &&
      e.actors?.place === region?.name,
  ).length;
  const walled = s.isCapital || s.tier === "city" || warsHere >= 2;

  // Real roads out of town → gates, each named for where its road goes.
  const byId = new Map(settlements.map((t) => [t.id, t]));
  const gateDirs: Array<{ oct: number; to: string }> = [];
  for (const e of roads.edges) {
    if (e.a !== s.id && e.b !== s.id) continue;
    const other = byId.get(e.a === s.id ? e.b : e.a);
    if (!other) continue;
    const path = e.a === s.id ? e.path : [...e.path].reverse();
    const probe = path[Math.min(6, path.length - 1)];
    const dx = (probe % worldW) - s.x;
    const dy = ((probe / worldW) | 0) - s.y;
    const oct = octantOf(dx, dy);
    if (!gateDirs.some((g) => g.oct === oct)) gateDirs.push({ oct, to: other.name });
  }
  if (gateDirs.length === 0 && region) {
    gateDirs.push({ oct: octantOf(region.cx - s.x, region.cy - s.y), to: region.name });
  }

  // The real ocean's bearing, for the harbour side.
  let seaOct = -1;
  if (s.isPort) {
    let best = Infinity;
    for (let dy = -22; dy <= 22; dy++) {
      for (let dx = -22; dx <= 22; dx++) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (x < 0 || y < 0 || x >= worldW || y * worldW + x >= water.oceanMask.length) continue;
        if (water.oceanMask[y * worldW + x] !== 1) continue;
        const dd = dx * dx + dy * dy;
        if (dd < best) {
          best = dd;
          seaOct = octantOf(dx, dy);
        }
      }
    }
  }

  // A real river beside the town → it crosses the plan in its real direction.
  let riverOct = -1;
  outer: for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = s.x + dx;
      const y = s.y + dy;
      const i = y * worldW + x;
      if (x < 0 || y < 0 || x >= worldW || i >= rivers.riverMask.length) continue;
      if (rivers.riverMask[i] !== 1) continue;
      const to = rivers.flowTo[i];
      if (to >= 0) {
        riverOct = octantOf((to % worldW) - x, ((to / worldW) | 0) - y);
        break outer;
      }
    }
  }

  // ---- The canvas of the plan. ----
  const W = 96;
  const cx = 48;
  const cy = 48;
  const cells = new Uint8Array(W * W).fill(PLAN.Field);
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < W;
  const radius =
    (s.isCapital ? 30 : s.tier === "city" ? 26 : s.tier === "town" ? 20 : 14) + rng.int(0, 3);
  const age = input.meta.presentYear - (timed?.foundedYear ?? simulation.startYear);
  const crooked = age > 500 ? 2 : 1; // old streets wander

  // Water: the harbour half-plane, on the sea's true side.
  const shore = radius * 0.62;
  if (s.isPort && seaOct >= 0) {
    const [ox, oy] = OCT_DIRS[seaOct];
    const olen = dist(ox, oy);
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const proj = ((x - cx) * ox + (y - cy) * oy) / olen;
        if (proj > shore) cells[at(x, y)] = PLAN.Water;
        else if (proj > shore - 1.5 && Math.abs((x - cx) * -oy + (y - cy) * ox) / olen < radius * 0.75)
          cells[at(x, y)] = PLAN.Quay;
      }
    }
  }

  // River: a band crossing the plan through an offset point, in real flow.
  if (riverOct >= 0 && !(s.isPort && (riverOct === seaOct))) {
    const [rx, ry] = OCT_DIRS[riverOct];
    const rlen = dist(rx, ry);
    const off = 7 + rng.int(0, 5); // the town grew beside the water, not in it
    const px = cx - (-ry / rlen) * off;
    const py = cy - (rx / rlen) * off;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        if (cells[at(x, y)] === PLAN.Water) continue;
        const perp = Math.abs((x - px) * -ry + (y - py) * rx) / rlen;
        if (perp < 1.6) cells[at(x, y)] = PLAN.River;
      }
    }
  }

  const buildable = (x: number, y: number) =>
    inb(x, y) && cells[at(x, y)] !== PLAN.Water && cells[at(x, y)] !== PLAN.Quay && cells[at(x, y)] !== PLAN.River;

  // Streets: one from each gate to the centre, wandering with age.
  const gatePoints: Array<{ x: number; y: number; oct: number; to: string }> = [];
  const drawStreet = (fromX: number, fromY: number) => {
    let x = fromX;
    let y = fromY;
    let guard = 0;
    while ((x !== cx || y !== cy) && guard++ < 400) {
      if (buildable(x, y) && cells[at(x, y)] !== PLAN.Wall) cells[at(x, y)] = PLAN.Street;
      if (cells[at(x, y)] === PLAN.River) cells[at(x, y)] = PLAN.Bridge;
      const dx = cx - x;
      const dy = cy - y;
      // Step toward the centre, with an occasional sidestep (old towns wander).
      if (rng.int(0, 10) < crooked && Math.abs(dx) + Math.abs(dy) > 6) {
        if (Math.abs(dx) > Math.abs(dy)) y += dy === 0 ? (rng.bool() ? 1 : -1) : Math.sign(dy);
        else x += dx === 0 ? (rng.bool() ? 1 : -1) : Math.sign(dx);
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
        else y += Math.sign(dy);
      }
    }
  };
  for (const g of gateDirs) {
    const [gx, gy] = OCT_DIRS[g.oct];
    const glen = dist(gx, gy);
    let px = Math.round(cx + (gx / glen) * radius);
    let py = Math.round(cy + (gy / glen) * radius);
    // A gate cannot open into the sea; slide it along the wall until on land.
    let tries = 0;
    while (!buildable(px, py) && tries++ < 16) {
      const oct2 = (g.oct + (tries % 2 === 0 ? 1 : 7) * Math.ceil(tries / 2)) % 8;
      const [nx, ny] = OCT_DIRS[oct2];
      const nlen = dist(nx, ny);
      px = Math.round(cx + (nx / nlen) * radius);
      py = Math.round(cy + (ny / nlen) * radius);
    }
    if (!inb(px, py)) continue;
    gatePoints.push({ x: px, y: py, oct: g.oct, to: g.to });
    drawStreet(px, py);
  }
  // The ring street, inside the wall line.
  const ringR = radius - 3.5;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (!buildable(x, y)) continue;
      const d = dist(x - cx, y - cy);
      if (Math.abs(d - ringR) < 0.55) cells[at(x, y)] = PLAN.Street;
    }
  }

  // The market square at the centre — the reason the roads meet at all.
  const mw = s.tier === "village" ? 3 : 5;
  for (let dy = -mw; dy <= mw; dy++) {
    for (let dx = -mw - 1; dx <= mw + 1; dx++) {
      if (buildable(cx + dx, cy + dy)) cells[at(cx + dx, cy + dy)] = PLAN.Market;
    }
  }

  // Landmarks: the temple of the real god; the keep of the real house.
  const landmarks: PlanLandmark[] = [];
  const placeBlock = (
    oct: number,
    distOut: number,
    half: number,
    code: number,
  ): { x: number; y: number } | null => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const o = (oct + attempt) % 8;
      const [dx, dy] = OCT_DIRS[o];
      const dlen = dist(dx, dy);
      const bx = Math.round(cx + (dx / dlen) * distOut);
      const by = Math.round(cy + (dy / dlen) * distOut);
      let ok = true;
      for (let yy = -half; yy <= half && ok; yy++) {
        for (let xx = -half; xx <= half && ok; xx++) {
          if (!buildable(bx + xx, by + yy)) ok = false;
        }
      }
      if (!ok) continue;
      for (let yy = -half; yy <= half; yy++) {
        for (let xx = -half; xx <= half; xx++) cells[at(bx + xx, by + yy)] = code;
      }
      return { x: bx, y: by };
    }
    return null;
  };

  if (faith) {
    const spot = placeBlock(rng.int(0, 8), mw + 4, s.tier === "village" ? 1 : 2, PLAN.Temple);
    if (spot) {
      landmarks.push({
        kind: s.tier === "village" ? "shrine" : "temple",
        name: s.tier === "village" ? `the shrine of ${faith.deity.name}` : `the temple of ${faith.deity.name}`,
        note: `${faith.name}; the god's dominion is ${faith.deity.domain.toLowerCase()}`,
        x: spot.x,
        y: spot.y,
      });
    }
  }
  if (s.isCapital || s.tier === "city") {
    const spot = placeBlock(rng.int(0, 8), mw + 6, 2, PLAN.Keep);
    if (spot) {
      landmarks.push({
        kind: "keep",
        name: house ? `the hall of House ${house.name}` : "the high keep",
        note: house
          ? `seat of the power that holds ${region?.name ?? "the country"} in the present year`
          : `no one house has held it long`,
        x: spot.x,
        y: spot.y,
      });
    }
  }
  landmarks.push({
    kind: "market",
    name: "the market square",
    note: eco?.produces.length
      ? `all ${eco.produces.slice(0, 3).map((k) => RESOURCE_NAMES[k]).join(", ").toLowerCase()}`
      : "small wares and large opinions",
    x: cx,
    y: cy,
  });
  for (const g of gatePoints) {
    landmarks.push({
      kind: "gate",
      name: `the ${OCT_NAMES[g.oct]} gate`,
      note: `the road to ${g.to}`,
      x: g.x,
      y: g.y,
    });
  }
  if (s.isPort && seaOct >= 0) {
    const [ox, oy] = OCT_DIRS[seaOct];
    const olen = dist(ox, oy);
    landmarks.push({
      kind: "quay",
      name: "the quays",
      note: `open water lies ${OCT_NAMES[seaOct]}ward`,
      x: Math.round(cx + (ox / olen) * (shore - 1)),
      y: Math.round(cy + (oy / olen) * (shore - 1)),
    });
  }

  // Buildings crowd the streets; greens breathe at the edge.
  // Two-pass: mark distance-to-street ≤ 2, then fill by density.
  const nearStreet = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const c = cells[at(x, y)];
      if (c !== PLAN.Street && c !== PLAN.Market && c !== PLAN.Bridge) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (inb(x + dx, y + dy)) nearStreet[at(x + dx, y + dy)] = 1;
        }
      }
    }
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (cells[at(x, y)] !== PLAN.Field) continue;
      const d = dist(x - cx, y - cy);
      if (d > radius - 1) continue;
      if (nearStreet[at(x, y)] === 1) {
        const density = 0.92 - (d / radius) * 0.4;
        if (rng.next() < density) cells[at(x, y)] = PLAN.Building;
        else if (rng.next() < 0.25) cells[at(x, y)] = PLAN.Green;
      } else if (rng.next() < 0.3) {
        cells[at(x, y)] = PLAN.Green;
      }
    }
  }

  // The wall, where history earned one — with its gates carved through.
  if (walled) {
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        if (!buildable(x, y)) continue;
        const d = dist(x - cx, y - cy);
        if (Math.abs(d - radius) < 0.75) {
          cells[at(x, y)] = cells[at(x, y)] === PLAN.Street ? PLAN.Gate : PLAN.Wall;
        }
      }
    }
    for (const g of gatePoints) {
      if (inb(g.x, g.y)) cells[at(g.x, g.y)] = PLAN.Gate;
    }
  }

  // Districts: flavoured by the town's real wares, plus the Old Town if the
  // maps renamed it — the people did not.
  const districts: PlanDistrict[] = [];
  const flavours: Array<[string, string]> = [];
  for (const k of eco?.produces ?? []) {
    const f = WARE_DISTRICTS[RESOURCE_NAMES[k]];
    if (f && !flavours.some((x) => x[0] === f[0])) flavours.push(f);
  }
  for (const g of rng.shuffle([...GENERIC_DISTRICTS])) {
    if (flavours.length >= 4) break;
    flavours.push(g);
  }
  const former = s.formerNames?.[s.formerNames.length - 1];
  if (former) {
    flavours.unshift([
      "the Old Town",
      `where they still say ${former.name}, whatever the charters write`,
    ]);
  }
  const maxDistricts = s.tier === "village" ? 1 : s.tier === "town" ? 2 : 4;
  const octOrder = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  let oi = 0;
  for (const [name, note] of flavours.slice(0, maxDistricts)) {
    let placed = false;
    while (oi < octOrder.length && !placed) {
      const [dx, dy] = OCT_DIRS[octOrder[oi++]];
      const dlen = dist(dx, dy);
      const px = Math.round(cx + (dx / dlen) * radius * 0.62);
      const py = Math.round(cy + (dy / dlen) * radius * 0.62);
      if (inb(px, py) && cells[at(px, py)] !== PLAN.Water) {
        districts.push({ name, note, x: px, y: py });
        placed = true;
      }
    }
  }

  // ---- Ruin: the same town, after the year it fell. ----
  if (ruined) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c === PLAN.Building || c === PLAN.Temple || c === PLAN.Keep) {
        cells[i] = rng.next() < 0.72 ? PLAN.Rubble : c === PLAN.Building ? PLAN.Field : c;
      } else if (c === PLAN.Wall && rng.next() < 0.3) {
        cells[i] = PLAN.Rubble; // breaches
      } else if (c === PLAN.Market && rng.next() < 0.5) {
        cells[i] = PLAN.Field; // grass in the square
      }
    }
    for (const l of landmarks) {
      if (l.kind === "temple" || l.kind === "shrine") l.name += " (roofless)";
      if (l.kind === "keep") l.name += " (fallen)";
    }
  }

  // ---- The dossier. ----
  const facts: string[] = [];
  facts.push(
    `${s.name} — ${glossPhrase(s.gloss)}; ${s.isCapital ? "capital" : s.tier}${s.isPort ? " and port" : ""} of ${region?.name ?? "the wilds"}${region ? ` (${region.languageLabel})` : ""}.`,
  );
  if (timed) {
    facts.push(
      `Founded ${timed.foundedYear} ${suffix} — ` +
        (walled
          ? `walled, ${warsHere > 0 ? `for the wars crossed ${region?.name ?? "this country"} ${warsHere} time${warsHere === 1 ? "" : "s"}` : `as its rank demanded`}.`
          : `unwalled; the wars passed it by.`),
    );
  }
  if (gatePoints.length > 0) {
    facts.push(
      `${gatePoints.length} gate${gatePoints.length === 1 ? "" : "s"}: ` +
        gatePoints.map((g) => `${OCT_NAMES[g.oct]} to ${g.to}`).join(" · ") +
        ".",
    );
  }
  if (former) {
    facts.push(`The charters once wrote it ${former.name} (${glossPhrase(former.gloss)}).`);
  }
  if (ruined && timed?.fellYear !== undefined) {
    facts.push(
      `${timed.fate === "sacked" ? "Stormed" : "Abandoned"} in ${timed.fellYear} ${suffix} — what is drawn here is what remains.`,
    );
  }

  return {
    settlementId,
    title: ruined ? `What remains of ${s.name}` : `A plan of ${s.name}`,
    facts,
    width: W,
    height: W,
    cells,
    landmarks,
    districts,
    walled,
    ruined,
  };
}
