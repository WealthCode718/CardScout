import { matchesText, underMarket } from "@/lib/prices/discount";
import { serverGet } from "@/lib/prices/server-fetch";
import type { DealListing, PriceQuery } from "@/lib/types";

const API = "https://api.pokemontcg.io/v2/cards";
const WATCH_QUERY =
  "(name:charizard OR name:pikachu OR name:umbreon OR name:mew OR name:gardevoir OR name:eevee OR name:mewtwo OR name:sylveon OR name:iono)";

/** A single OR of every watch name makes this API return 500. Smaller groups do not. */
const WATCH_GROUPS = [
  "(name:charizard OR name:pikachu OR name:umbreon)",
  "(name:mew OR name:gardevoir OR name:eevee)",
  "(name:mewtwo OR name:sylveon OR name:iono)",
];

const FINISH_PREFERENCE = [
  "holofoil",
  "reverseHolofoil",
  "normal",
  "unlimitedHolofoil",
  "1stEditionHolofoil",
  "1stEditionNormal",
];

const FINISH_LABELS: Record<string, string> = {
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse holofoil",
  normal: "Normal",
  unlimitedHolofoil: "Unlimited holofoil",
  "1stEditionHolofoil": "1st edition holofoil",
  "1stEditionNormal": "1st edition",
};

interface TcgPrices {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}

interface TcgCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set?: { id?: string; name?: string; printedTotal?: number };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TcgPrices>;
  };
}

interface CacheEntry {
  expires: number;
  cards: TcgCard[];
}

export interface CatalogCard {
  id: string;
  name: string;
  setName: string;
  setId: string;
  numberLabel: string;
  rarity: string;
  imageUrl: string;
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  finish: string | null;
  finishLabel: string | null;
  tcgplayerUrl: string | null;
  updatedAt: string | null;
  ask: number | null;
}

let watchCache: CacheEntry | null = null;
const queryCache = new Map<string, CacheEntry>();

function headers(): HeadersInit {
  const key = process.env.POKEMONTCG_API_KEY?.trim();
  return key ? { "X-Api-Key": key, Accept: "application/json" } : { Accept: "application/json" };
}

function escapeQuery(value: string): string {
  return value.replace(/["\\]/g, "").trim().slice(0, 60);
}

/**
 * Trailing * inside quotes makes api.pokemontcg.io return 500. An unquoted
 * token already matches a prefix, so "Base" still finds "Base Set".
 * When a name and a set are both set, the combined query is tried first and
 * the name-only query is the fallback. Results are filtered again in memory.
 */
function luceneAttempts(query: PriceQuery): string[] {
  const name = escapeQuery(query.name ?? "");
  const setName = escapeQuery(query.set ?? "");
  const attempts: string[] = [];
  if (name && setName) {
    attempts.push(`name:"${name}" set.name:${setName.toLowerCase()}`);
    attempts.push(`name:"${name}"`);
  } else if (name) {
    attempts.push(`name:"${name}"`);
  } else if (setName) {
    attempts.push(`set.name:${setName}`);
  } else {
    attempts.push(WATCH_QUERY);
  }
  return attempts;
}

async function fetchCards(lucene: string, pageSize: number, orderBy?: string): Promise<TcgCard[]> {
  const cacheKey = `${lucene}|${pageSize}|${orderBy ?? ""}`;
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.cards;
  const url = new URL(API);
  url.searchParams.set("q", lucene);
  url.searchParams.set("pageSize", String(pageSize));
  // orderBy=-set.releaseDate 500s on name+set queries. Use it only for a name.
  if (orderBy) url.searchParams.set("orderBy", orderBy);
  let response = await serverGet(url, headers());
  // A 500 here is often a blip on a query that works a moment later.
  if (response.status === 500) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    response = await serverGet(url, headers());
  }
  if (response.status < 200 || response.status >= 300) {
    if (cached) return cached.cards;
    throw new Error(
      `Pokémon TCG API returned ${response.status}. A free key from dev.pokemontcg.io can help if you are being rate limited.`,
    );
  }
  const body = JSON.parse(response.text) as { data?: TcgCard[] };
  const cards = body.data ?? [];
  queryCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, cards });
  return cards;
}

async function fetchFirstWorking(query: PriceQuery, pageSize: number): Promise<TcgCard[]> {
  const nameOnly = Boolean(query.name?.trim()) && !query.set?.trim();
  let last: unknown;
  for (const lucene of luceneAttempts(query)) {
    const orders = nameOnly ? ["-set.releaseDate", undefined] : [undefined];
    for (const orderBy of orders) {
      try {
        return await fetchCards(lucene, pageSize, orderBy);
      } catch (error) {
        last = error;
      }
    }
  }
  throw last instanceof Error ? last : new Error("Pokémon TCG API did not return cards.");
}

async function watchCards(): Promise<TcgCard[]> {
  if (watchCache && watchCache.expires > Date.now()) return watchCache.cards;
  const merged = new Map<string, TcgCard>();
  let failures = 0;
  for (const lucene of WATCH_GROUPS) {
    try {
      for (const card of await fetchCards(lucene, 40)) merged.set(card.id, card);
    } catch {
      failures += 1;
    }
  }
  if (merged.size === 0) {
    if (watchCache) return watchCache.cards;
    throw new Error(
      "Pokémon TCG API returned 500. A free key from dev.pokemontcg.io can help if you are being rate limited.",
    );
  }
  const cards = [...merged.values()];
  watchCache = { expires: Date.now() + (failures > 0 ? 60_000 : 10 * 60 * 1000), cards };
  return cards;
}

function pickFinish(prices: Record<string, TcgPrices> | undefined): { finish: string; quote: TcgPrices } | null {
  if (!prices) return null;
  const keys = Object.keys(prices);
  const ordered = [...FINISH_PREFERENCE.filter((key) => keys.includes(key)), ...keys];
  for (const finish of ordered) {
    const quote = prices[finish];
    if (quote?.market && quote.market > 0) return { finish, quote };
  }
  return null;
}

function saneAsk(market: number, quote: TcgPrices): number | null {
  const candidates = [quote.directLow, quote.low].filter((value): value is number => typeof value === "number" && value > 0);
  const believable = candidates.filter((value) => value < market && value >= market * 0.4);
  if (believable.length > 0) return Math.min(...believable);
  return null;
}

function numberLabel(card: TcgCard): string {
  const number = card.number ?? "";
  const printed = card.set?.printedTotal;
  if (number && printed) return `${number}/${printed}`;
  return number || "—";
}

function toIso(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toCatalog(card: TcgCard): CatalogCard {
  const finish = pickFinish(card.tcgplayer?.prices);
  const market = finish?.quote.market ?? null;
  return {
    id: card.id,
    name: card.name,
    setName: card.set?.name ?? "Unknown set",
    setId: card.set?.id ?? "",
    numberLabel: numberLabel(card),
    rarity: card.rarity ?? "Unknown rarity",
    imageUrl: card.images?.small ?? card.images?.large ?? "",
    marketPrice: market,
    lowPrice: finish?.quote.low ?? null,
    highPrice: finish?.quote.high ?? null,
    finish: finish?.finish ?? null,
    finishLabel: finish ? (FINISH_LABELS[finish.finish] ?? finish.finish) : null,
    tcgplayerUrl: card.tcgplayer?.url ?? null,
    updatedAt: toIso(card.tcgplayer?.updatedAt),
    ask: market != null && finish ? saneAsk(market, finish.quote) : null,
  };
}

function cardTextMatch(card: CatalogCard, query: PriceQuery): boolean {
  return (
    matchesText(`${card.name} ${card.numberLabel} ${card.rarity}`, query.name) &&
    matchesText(`${card.setName} ${card.setId}`, query.set)
  );
}

export async function searchCatalog(query: PriceQuery): Promise<CatalogCard[]> {
  const name = query.name?.trim() ?? "";
  const setName = query.set?.trim() ?? "";
  const cards = !name && !setName ? (await watchCards()).slice(0, 24) : await fetchFirstWorking(query, 30);
  return cards
    .map(toCatalog)
    .filter((card) => card.name && card.marketPrice != null && cardTextMatch(card, query))
    .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));
}

export function dealFromCatalog(card: CatalogCard): DealListing | null {
  if (card.marketPrice == null || card.ask == null) return null;
  const deal = underMarket(card.marketPrice, card.ask);
  if (!deal || deal.discountPercent < 8) return null;
  const finish = card.finishLabel ? `${card.finishLabel} ` : "";
  return {
    id: `tcg-${card.id}-${card.finish ?? "market"}`,
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
    marketLabel: "TCGPlayer market (via Pokémon TCG API)",
    discountPercent: deal.discountPercent,
    savings: deal.savings,
    seller: "Lowest listed",
    marketplace: "TCGPlayer",
    listingUrl: card.tcgplayerUrl,
    priceSource: `TCGPlayer ${finish}market vs lowest listed`,
    updatedAt: card.updatedAt,
  };
}

export async function listCatalogDeals(query: PriceQuery): Promise<DealListing[]> {
  const name = query.name?.trim() ?? "";
  const outsideWatch = name.length > 0 && !WATCH_QUERY.toLowerCase().includes(name.toLowerCase());
  const raw = outsideWatch ? await fetchFirstWorking(query, 40) : await watchCards();
  return raw
    .map(toCatalog)
    .filter((card) => cardTextMatch(card, query))
    .map(dealFromCatalog)
    .filter((deal): deal is DealListing => Boolean(deal))
    .sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
}

export async function listCatalogSets(): Promise<string[]> {
  const cards = await watchCards();
  const sets = new Set<string>();
  for (const card of cards.map(toCatalog)) {
    if (dealFromCatalog(card)) sets.add(card.setName);
  }
  return [...sets].sort((a, b) => a.localeCompare(b));
}
