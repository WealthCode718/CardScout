import { matchesText, underMarket } from "@/lib/prices/discount";
import { serverGet } from "@/lib/prices/server-fetch";
import type { CatalogCard } from "@/lib/prices/catalog";
import type { DealListing, PriceQuery } from "@/lib/types";

const SEARCH = "https://api.tcgapi.dev/v1/search";
/** Free tier is 100 requests a day. A hit stays cached for 12 hours. */
const CACHE_MS = 12 * 60 * 60 * 1000;

const MARKET_LABEL = "TCGPlayer market (via tcgapi.dev)";

export class TcgapiConfigError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Live prices need a key. Add TCGAPI_API_KEY from https://tcgapi.dev/ (free, 100 requests a day) and EBAY_CLIENT_ID plus EBAY_CLIENT_SECRET from https://developer.ebay.com/. No prices are invented.",
    );
    this.name = "TcgapiConfigError";
  }
}

export function tcgapiConfigured(): boolean {
  return Boolean(process.env.TCGAPI_API_KEY?.trim());
}

interface TcgapiCard {
  id?: number | string;
  name?: string;
  number?: string;
  rarity?: string;
  image_url?: string;
  tcgplayer_id?: number | string;
  tcgplayer_url?: string;
  set_name?: string;
  set_id?: number | string;
  product_type?: string;
  printing?: string;
  market_price?: number | null;
  low_price?: number | null;
  price_updated_at?: string;
}

interface CacheEntry {
  expires: number;
  cards: TcgapiCard[];
}

const cache = new Map<string, CacheEntry>();

function headers(): HeadersInit {
  const key = process.env.TCGAPI_API_KEY?.trim();
  if (!key) throw new TcgapiConfigError();
  return { Accept: "application/json", "X-API-Key": key };
}

function printingRank(printing: string): number {
  const name = printing.toLowerCase();
  if (/1st|first edition/.test(name)) return 40;
  const order = ["holofoil", "reverse holofoil", "unlimited holofoil", "foil", "unlimited", "normal"];
  const index = order.findIndex((label) => name.includes(label));
  return index === -1 ? 15 : index;
}

function saneAsk(market: number, low: number | null): number | null {
  if (low == null || low <= 0 || low >= market || low < market * 0.4) return null;
  return low;
}

function productUrl(card: TcgapiCard): string | null {
  if (card.tcgplayer_url) return card.tcgplayer_url;
  if (card.tcgplayer_id) return `https://www.tcgplayer.com/product/${card.tcgplayer_id}`;
  return null;
}

function toCatalog(card: TcgapiCard): CatalogCard | null {
  const name = card.name?.trim() ?? "";
  const market = typeof card.market_price === "number" && card.market_price > 0 ? card.market_price : null;
  if (!name || market == null) return null;
  if (card.product_type && card.product_type !== "Cards") return null;
  const low = typeof card.low_price === "number" && card.low_price > 0 ? card.low_price : null;
  const printing = card.printing?.trim() || null;
  const updated = card.price_updated_at ? new Date(card.price_updated_at) : null;
  return {
    id: String(card.id ?? card.tcgplayer_id ?? name),
    name,
    setName: card.set_name?.trim() || "Unknown set",
    setId: card.set_id != null ? String(card.set_id) : "",
    numberLabel: card.number?.trim() || "—",
    rarity: card.rarity?.trim() || "Unknown rarity",
    imageUrl: card.image_url ?? "",
    marketPrice: market,
    lowPrice: low,
    highPrice: null,
    finish: printing,
    finishLabel: printing,
    tcgplayerUrl: productUrl(card),
    updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null,
    ask: saneAsk(market, low),
  };
}

function pickPrinting(rows: TcgapiCard[]): TcgapiCard | null {
  const priced = rows.filter((row) => typeof row.market_price === "number" && row.market_price > 0);
  if (priced.length === 0) return null;
  return [...priced].sort((a, b) => printingRank(a.printing ?? "") - printingRank(b.printing ?? ""))[0] ?? null;
}

async function searchRows(query: string, perPage: number): Promise<TcgapiCard[]> {
  const cacheKey = `${query}|${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.cards;
  const url = new URL(SEARCH);
  url.searchParams.set("q", query);
  url.searchParams.set("game", "pokemon");
  url.searchParams.set("type", "Cards");
  url.searchParams.set("sort", "price_desc");
  url.searchParams.set("per_page", String(perPage));
  const response = await serverGet(url, headers());
  if (response.status === 401 || response.status === 403) {
    throw new TcgapiConfigError(
      "tcgapi.dev refused TCGAPI_API_KEY. Create a free key at https://tcgapi.dev/ and send it as X-API-Key.",
    );
  }
  if (response.status < 200 || response.status >= 300) {
    if (cached) return cached.cards;
    throw new Error(`tcgapi.dev returned ${response.status}. The TCGPlayer market did not load.`);
  }
  const body = JSON.parse(response.text) as { data?: TcgapiCard[] };
  const cards = body.data ?? [];
  cache.set(cacheKey, { expires: Date.now() + CACHE_MS, cards });
  return cards;
}

function collapse(rows: TcgapiCard[]): CatalogCard[] {
  const groups = new Map<string, TcgapiCard[]>();
  for (const row of rows) {
    const key = String(row.id ?? row.tcgplayer_id ?? row.name);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const cards: CatalogCard[] = [];
  for (const group of groups.values()) {
    const picked = pickPrinting(group);
    if (!picked) continue;
    const card = toCatalog(picked);
    if (card) cards.push(card);
  }
  return cards;
}

function searchText(query: PriceQuery, fallback: string): string {
  const name = query.name?.trim() ?? "";
  const setName = query.set?.trim() ?? "";
  const text = [name, setName].filter(Boolean).join(" ").trim();
  return text.length >= 2 ? text.slice(0, 80) : fallback;
}

function matches(card: CatalogCard, query: PriceQuery): boolean {
  return matchesText(`${card.name} ${card.numberLabel} ${card.rarity}`, query.name) && matchesText(card.setName, query.set);
}

export async function searchCatalog(query: PriceQuery): Promise<CatalogCard[]> {
  const rows = await searchRows(searchText(query, "charizard"), 20);
  return collapse(rows)
    .filter((card) => matches(card, query))
    .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));
}

export function dealFromCatalog(card: CatalogCard): DealListing | null {
  if (card.marketPrice == null || card.ask == null) return null;
  const deal = underMarket(card.marketPrice, card.ask);
  if (!deal || deal.discountPercent < 8) return null;
  const finish = card.finishLabel ? `${card.finishLabel} ` : "";
  return {
    id: `tcgapi-${card.id}-${card.finish ?? "market"}`,
    cardId: card.id,
    name: card.name,
    setName: card.setName,
    setId: card.setId,
    numberLabel: card.numberLabel,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    condition: "Near Mint",
    listingPrice: card.ask,
    marketPrice: card.marketPrice,
    marketLabel: MARKET_LABEL,
    discountPercent: deal.discountPercent,
    savings: deal.savings,
    seller: "Lowest listed",
    marketplace: "TCGPlayer",
    listingUrl: card.tcgplayerUrl,
    priceSource: `TCGPlayer ${finish}market vs lowest listed, via tcgapi.dev`,
    updatedAt: card.updatedAt,
  };
}

export async function listCatalogDeals(query: PriceQuery): Promise<DealListing[]> {
  const named = Boolean(query.name?.trim() || query.set?.trim());
  const rows = await searchRows(searchText(query, "charizard"), named ? 40 : 50);
  return collapse(rows)
    .filter((card) => matches(card, query))
    .map(dealFromCatalog)
    .filter((deal): deal is DealListing => Boolean(deal))
    .sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
}

export async function listCatalogSets(): Promise<string[]> {
  const rows = await searchRows("charizard", 50);
  const sets = new Set<string>();
  for (const card of collapse(rows)) {
    if (dealFromCatalog(card)) sets.add(card.setName);
  }
  return [...sets].sort((a, b) => a.localeCompare(b));
}
