// economy.ts — L14: production, wealth, and trade.
//
// Ties resources, settlements, and roads together into an economy. Each town
// gathers the deposits in its hinterland to decide what it *produces*; its
// wealth grows with that production, its road connectivity, a port, and being a
// capital. The best-connected, wealthiest towns become trade hubs, and the
// world's commonest products are its major exports. Deterministic — a pure
// function of the layers above (an `economy` stream is reserved for future use).

import type { Settlement } from "./settlements.ts";
import type { RoadLayer } from "./roads.ts";
import { type ResourceLayer, type Resource, RESOURCE_NAMES } from "./resources.ts";

export type WealthTier = "poor" | "modest" | "prosperous" | "rich";

export interface SettlementEconomy {
  settlementId: number;
  produces: Resource[]; // distinct nearby resource kinds, richest first
  wealth: number; // 0..1
  tier: WealthTier;
  degree: number; // road connections
  isTradeHub: boolean;
}

export interface EconomyLayer {
  economies: SettlementEconomy[];
  /** Most-produced resources across the world, commonest first. */
  majorExports: Resource[];
  /** Settlement id with the highest wealth. */
  richest: number;
}

export interface EconomyConfig {
  seed: number;
  /** Radius (cells) a settlement gathers resources from. */
  hinterland?: number;
}

export function generateEconomy(
  settlements: Settlement[],
  roads: RoadLayer,
  resources: ResourceLayer,
  cfg: EconomyConfig,
): EconomyLayer {
  const hinterland = cfg.hinterland ?? 22;
  const h2 = hinterland * hinterland;

  // Road degree per settlement.
  const degree = new Map<number, number>();
  for (const s of settlements) degree.set(s.id, 0);
  for (const e of roads.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  let maxDegree = 1;
  for (const d of degree.values()) maxDegree = Math.max(maxDegree, d);

  // Gather nearby deposits per settlement.
  const raw: Array<{
    s: Settlement;
    produces: Resource[];
    resourceScore: number;
    deg: number;
  }> = [];
  let maxResource = 0.001;
  for (const s of settlements) {
    const byKind = new Map<number, number>();
    for (const d of resources.deposits) {
      const dx = d.x - s.x;
      const dy = d.y - s.y;
      if (dx * dx + dy * dy <= h2) {
        byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + d.richness);
      }
    }
    const sorted = [...byKind.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const produces = sorted.slice(0, 4).map(([k]) => k as Resource);
    const resourceScore = sorted.reduce((sum, [, v]) => sum + v, 0);
    maxResource = Math.max(maxResource, resourceScore);
    raw.push({ s, produces, resourceScore, deg: degree.get(s.id) ?? 0 });
  }

  // Wealth = weighted blend, then normalized across all settlements.
  let maxWealth = 0.001;
  const wealthRaw = raw.map((r) => {
    const w =
      0.5 * (r.resourceScore / maxResource) +
      0.25 * (r.deg / maxDegree) +
      0.1 * (r.s.isPort ? 1 : 0) +
      0.15 * (r.s.isCapital ? 1 : 0);
    maxWealth = Math.max(maxWealth, w);
    return w;
  });

  const economies: SettlementEconomy[] = raw.map((r, i) => {
    const wealth = wealthRaw[i] / maxWealth;
    const tier: WealthTier =
      wealth > 0.75 ? "rich" : wealth > 0.5 ? "prosperous" : wealth > 0.25 ? "modest" : "poor";
    return {
      settlementId: r.s.id,
      produces: r.produces,
      wealth,
      tier,
      degree: r.deg,
      isTradeHub: false,
    };
  });

  // Trade hubs: top ~15% by (wealth + connectivity), needing ≥2 roads.
  const ranked = [...economies]
    .map((e) => ({ e, rank: e.wealth + e.degree / maxDegree }))
    .sort((a, b) => b.rank - a.rank);
  const hubCount = Math.max(1, Math.round(economies.length * 0.15));
  let hubs = 0;
  for (const { e } of ranked) {
    if (hubs >= hubCount) break;
    if (e.degree >= 2) {
      e.isTradeHub = true;
      hubs++;
    }
  }

  // Major exports: tally products across the world.
  const tally = new Map<number, number>();
  for (const e of economies) {
    for (const k of e.produces) tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const majorExports = [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 5)
    .map(([k]) => k as Resource);

  const richest = economies.reduce(
    (best, e) => (e.wealth > (economies[best]?.wealth ?? -1) ? economies.indexOf(e) : best),
    0,
  );

  return {
    economies,
    majorExports,
    richest: economies[richest]?.settlementId ?? (settlements[0]?.id ?? 0),
  };
}

/** Human-readable product list for a settlement economy. */
export function productList(economy: SettlementEconomy): string {
  return economy.produces.map((k) => RESOURCE_NAMES[k]).join(", ") || "—";
}
