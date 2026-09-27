import { matchesText, underMarket } from "@/lib/prices/discount";
import type { CardValue, DealListing, PriceProvider, PriceQuery } from "@/lib/types";

const API = "https://api.pokemontcg.io/v2/cards";
const WATCH_QUERY =
  "(name:charizard OR name:pikachu OR name:umbreon OR name:mew OR name:gardevoir OR name:eevee OR name:mewtwo OR name:sylveon OR name:iono)";

const FINISH_PREFERENCE = [
  "holofoil",
  "reverseHolofoil",
  "normal",
  "unlimitedHolofoil",
  "1stEditionHolofoil",
  "1stEditionNormal",
];

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

let watchCache: CacheEntry | null = null;

function headers(): HeadersInit {
  const key = process.env.POKEMONTCG_API_KEY?.trim();
  return key ? { "X-Api-Key": key, Accept: "application/json" } : { Accept: "application/json" };
}

function escapeQuery(value: string): string {
  return value.replace(/["\\]/g, "").trim().slice(0, 60);
}

function buildLucene(query: PriceQuery): string {
  const parts: string[] = [];
  const name = escapeQuery(query.name ?? "");
  const setName = escapeQuery(query.set ?? "");
  if (name) parts.push(`name:"${name}*"`);
  if (setName) parts.push(`set.name:"${setName}*"`);
  return parts.join(" ") || WATCH_QUERY;
}

async function fetchCards(lucene: string, pageSize: number): Promise<TcgCard[]> {
  const url = new URL(API);
  url.searchParams.set("q", lucene);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("orderBy", "-set.releaseDate");
  const response = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Pokémon TCG API returned ${response.status}. A free key from dev.pokemontcg.io can help if you are being rate limited.`);
  }
  const body = (await response.json()) as { data?: TcgCard[] };
  return body.data ?? [];
}

async function watchCards(): Promise<TcgCard[]> {
  if (watchCache && watchCache.expires > Date.now()) return watchCache.cards;
  try {
    const cards = await fetchCards(WATCH_QUERY, 250);
    watchCache = { expires: Date.now() + 10 * 60 * 1000, cards };
    return cards;
  } catch (error) {
    watchCache = null;
    throw error;
  }
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

function toValue(card: TcgCard): CardValue | null {
  const finish = pickFinish(card.tcgplayer?.prices);
  const setName = card.set?.name ?? "Unknown set";
  return {
    id: card.id,
    name: card.name,
    setName,
    setId: card.set?.id ?? "",
    numberLabel: numberLabel(card),
    rarity: card.rarity ?? "Unknown rarity",
    imageUrl: card.images?.small ?? card.images?.large ?? "",
    marketPrice: finish?.quote.market ?? null,
    lowPrice: finish?.quote.low ?? null,
    highPrice: finish?.quote.high ?? null,
    currency: "USD",
    priceSource: finish ? `TCGPlayer ${finish.finish} via Pokémon TCG API` : "Pokémon TCG API (no TCGPlayer price)",
    updatedAt: toIso(card.tcgplayer?.updatedAt),
  };
}

function toDeal(card: TcgCard): DealListing | null {
  const finish = pickFinish(card.tcgplayer?.prices);
  if (!finish?.quote.market) return null;
  const ask = saneAsk(finish.quote.market, finish.quote);
  if (ask == null) return null;
  const deal = underMarket(finish.quote.market, ask);
  if (!deal || deal.discountPercent < 8) return null;
  const value = toValue(card);
  if (!value) return null;
  return {
    id: `tcg-${card.id}-${finish.finish}`,
    cardId: card.id,
    name: value.name,
    setName: value.setName,
    setId: value.setId,
    numberLabel: value.numberLabel,
    rarity: value.rarity,
    imageUrl: value.imageUrl,
    condition: "Near Mint",
    listingPrice: ask,
    marketPrice: finish.quote.market,
    discountPercent: deal.discountPercent,
    savings: deal.savings,
    seller: "Lowest listed",
    marketplace: "TCGPlayer",
    listingUrl: card.tcgplayer?.url ?? null,
    priceSource: value.priceSource,
    updatedAt: value.updatedAt,
  };
}

function cardTextMatch(card: TcgCard, query: PriceQuery): boolean {
  const setName = card.set?.name ?? "";
  const setId = card.set?.id ?? "";
  return (
    matchesText(`${card.name} ${card.number ?? ""} ${card.rarity ?? ""}`, query.name) &&
    matchesText(`${setName} ${setId}`, query.set)
  );
}

export class PokemonTcgPriceProvider implements PriceProvider {
  readonly id = "pokemontcg" as const;
  readonly label = "Pokémon TCG API";
  readonly live = true;
  readonly disclaimer =
    "Market prices come from TCGPlayer through the Pokémon TCG API. A deal means the lowest listed price for that finish is under the market price. Confirm the printing and seller before you buy.";

  async searchCards(query: PriceQuery): Promise<CardValue[]> {
    const name = query.name?.trim() ?? "";
    const setName = query.set?.trim() ?? "";
    const cards = !name && !setName ? (await watchCards()).slice(0, 24) : await fetchCards(buildLucene(query), 30);
    return cards
      .map(toValue)
      .filter((card): card is CardValue => Boolean(card?.name))
      .filter((card) => card.marketPrice != null)
      .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    const name = query.name?.trim() ?? "";
    const outsideWatch = name.length > 0 && !WATCH_QUERY.toLowerCase().includes(name.toLowerCase());
    const cards = outsideWatch ? await fetchCards(buildLucene(query), 40) : await watchCards();
    return cards
      .filter((card) => cardTextMatch(card, query))
      .map(toDeal)
      .filter((deal): deal is DealListing => Boolean(deal))
      .sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
  }

  async listSets(): Promise<string[]> {
    const cards = await watchCards();
    const sets = new Set<string>();
    for (const card of cards) {
      const deal = toDeal(card);
      if (deal) sets.add(deal.setName);
    }
    return [...sets].sort((a, b) => a.localeCompare(b));
  }
}
