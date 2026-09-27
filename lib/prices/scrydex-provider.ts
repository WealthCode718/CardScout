import { blankEbaySold, EBAY_SOLD_WINDOW } from "@/lib/prices/copy";
import { matchesText, underMarket } from "@/lib/prices/discount";
import { median, roundMoney, trimOutliers } from "@/lib/prices/money";
import { serverGet } from "@/lib/prices/server-fetch";
import type { DealListing, EbaySoldSource, PriceQuery, SoldComp } from "@/lib/types";

const API = "https://api.scrydex.com/pokemon/v1/en/cards";

const WATCH_NAMES = ["charizard", "pikachu", "umbreon", "mew", "gardevoir", "eevee", "mewtwo", "sylveon", "iono"];

/** Smaller OR groups stay inside a normal search. page_size max on this API is 100. */
const WATCH_GROUPS = [
  "(name:charizard OR name:pikachu OR name:umbreon)",
  "(name:mew OR name:gardevoir OR name:eevee)",
  "(name:mewtwo OR name:sylveon OR name:iono)",
];

const FINISH_PREFERENCE = ["holofoil", "reverseHolofoil", "normal", "unlimitedHolofoil", "unlimited"];

const FINISH_LABELS: Record<string, string> = {
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse holofoil",
  normal: "Normal",
  unlimitedHolofoil: "Unlimited holofoil",
  unlimited: "Unlimited",
};

const MARKET_LABEL = "Scrydex market";

export class ScrydexConfigError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Scrydex is not configured. Add SCRYDEX_API_KEY and SCRYDEX_TEAM_ID from a paid plan at scrydex.com. Raw prices stay blank.",
    );
    this.name = "ScrydexConfigError";
  }
}

export function scrydexConfigured(): boolean {
  return Boolean(process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim());
}

interface ScrydexTrend {
  price_change?: number;
  percent_change?: number;
}

interface ScrydexPrice {
  condition?: string;
  type?: string;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  currency?: string;
  grade?: string;
  company?: string;
  is_perfect?: boolean;
  is_signed?: boolean;
  is_error?: boolean;
  trends?: { days_30?: ScrydexTrend };
}

interface ScrydexMarketplace {
  name?: string;
  purchase_url?: string;
}

interface ScrydexImage {
  type?: string;
  small?: string;
  medium?: string;
  large?: string;
}

interface ScrydexVariant {
  name?: string;
  prices?: ScrydexPrice[];
  marketplaces?: ScrydexMarketplace[];
  images?: ScrydexImage[];
}

interface ScrydexCard {
  id: string;
  name: string;
  number?: string;
  printed_number?: string;
  rarity?: string;
  images?: ScrydexImage[];
  expansion?: { id?: string; name?: string; printed_total?: number };
  variants?: ScrydexVariant[];
}

interface CacheEntry {
  expires: number;
  cards: ScrydexCard[];
}

export interface ScrydexGradeQuote {
  company: string;
  grade: string;
  market: number;
  low: number | null;
  mid: number | null;
  high: number | null;
  trend30: number | null;
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
  otherConditions: { condition: string; market: number }[];
  grades: ScrydexGradeQuote[];
}

let watchCache: CacheEntry | null = null;
const queryCache = new Map<string, CacheEntry>();

function headers(): HeadersInit {
  const key = process.env.SCRYDEX_API_KEY?.trim();
  const team = process.env.SCRYDEX_TEAM_ID?.trim();
  if (!key || !team) throw new ScrydexConfigError();
  return { Accept: "application/json", "X-Api-Key": key, "X-Team-ID": team };
}

function escapeQuery(value: string): string {
  return value.replace(/["\\]/g, "").trim().slice(0, 60);
}

function fieldQuery(field: string, value: string): string {
  const cleaned = escapeQuery(value);
  if (!cleaned) return "";
  if (cleaned.includes(" ")) return `${field}:"${cleaned}"`;
  return `${field}:${cleaned.toLowerCase()}`;
}

/**
 * Scrydex search is Lucene-like. A quoted trailing * made the old API return
 * 500, so names stay unquoted tokens and multi-word sets stay phrases.
 */
function luceneAttempts(query: PriceQuery): string[] {
  const name = escapeQuery(query.name ?? "");
  const setName = escapeQuery(query.set ?? "");
  const attempts: string[] = [];
  if (name && setName) {
    attempts.push(`${fieldQuery("name", name)} ${fieldQuery("expansion.name", setName)}`);
    attempts.push(fieldQuery("name", name));
  } else if (name) {
    attempts.push(fieldQuery("name", name));
  } else if (setName) {
    attempts.push(fieldQuery("expansion.name", setName));
  }
  return attempts;
}

function asCards(body: { data?: ScrydexCard[] | ScrydexCard }): ScrydexCard[] {
  if (Array.isArray(body.data)) return body.data;
  if (body.data && typeof body.data === "object") return [body.data];
  return [];
}

async function fetchCards(lucene: string, pageSize: number): Promise<ScrydexCard[]> {
  const cacheKey = `${lucene}|${pageSize}`;
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.cards;
  const url = new URL(API);
  url.searchParams.set("q", lucene);
  url.searchParams.set("page_size", String(Math.min(pageSize, 100)));
  url.searchParams.set("include", "prices");
  const response = await serverGet(url, headers());
  if (response.status === 401 || response.status === 403) {
    throw new ScrydexConfigError(
      "Scrydex refused this key. Check SCRYDEX_API_KEY, SCRYDEX_TEAM_ID, and that the plan is active.",
    );
  }
  if (response.status < 200 || response.status >= 300) {
    if (cached) return cached.cards;
    throw new Error(`Scrydex returned ${response.status}. Raw market prices did not load.`);
  }
  const cards = asCards(JSON.parse(response.text) as { data?: ScrydexCard[] });
  queryCache.set(cacheKey, { expires: Date.now() + (cards.length === 0 ? 60_000 : 5 * 60 * 1000), cards });
  return cards;
}

async function fetchFirstWorking(query: PriceQuery, pageSize: number): Promise<ScrydexCard[]> {
  const attempts = luceneAttempts(query);
  if (attempts.length === 0) return watchCards();
  let last: unknown;
  for (const lucene of attempts) {
    try {
      return await fetchCards(lucene, pageSize);
    } catch (error) {
      if (error instanceof ScrydexConfigError) throw error;
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Scrydex did not return cards.");
}

async function watchCards(): Promise<ScrydexCard[]> {
  if (watchCache && watchCache.expires > Date.now()) return watchCache.cards;
  const merged = new Map<string, ScrydexCard>();
  let failures = 0;
  for (const lucene of WATCH_GROUPS) {
    try {
      for (const card of await fetchCards(lucene, 40)) merged.set(card.id, card);
    } catch (error) {
      if (error instanceof ScrydexConfigError) throw error;
      failures += 1;
    }
  }
  if (merged.size === 0) {
    if (watchCache) return watchCache.cards;
    throw new Error("Scrydex did not return the watch list. Raw market prices did not load.");
  }
  const cards = [...merged.values()];
  watchCache = { expires: Date.now() + (failures > 0 ? 60_000 : 10 * 60 * 1000), cards };
  return cards;
}

function firstEdition(name: string): boolean {
  return /first|1st/i.test(name);
}

function nmMarket(variant: ScrydexVariant): { market: number; low: number | null } | null {
  for (const price of variant.prices ?? []) {
    if (price.type && price.type !== "raw") continue;
    if (price.currency && price.currency !== "USD") continue;
    if (price.condition && price.condition !== "NM") continue;
    if (typeof price.market === "number" && price.market > 0) {
      return { market: price.market, low: typeof price.low === "number" && price.low > 0 ? price.low : null };
    }
  }
  return null;
}

const GRADE_SLOTS: { company: string; grade: string }[] = [
  { company: "PSA", grade: "10" },
  { company: "BGS", grade: "10" },
  { company: "CGC", grade: "10" },
  { company: "PSA", grade: "9" },
];

function plainSlab(price: ScrydexPrice): boolean {
  return !price.is_perfect && !price.is_signed && !price.is_error;
}

function gradedQuotes(variant: ScrydexVariant): ScrydexGradeQuote[] {
  const prices = (variant.prices ?? []).filter(
    (price) => price.type === "graded" && (!price.currency || price.currency === "USD") && plainSlab(price),
  );
  const quotes: ScrydexGradeQuote[] = [];
  for (const slot of GRADE_SLOTS) {
    const price = prices.find(
      (entry) => entry.company?.toUpperCase() === slot.company && String(entry.grade) === slot.grade && (entry.market ?? 0) > 0,
    );
    if (!price || price.market == null) continue;
    quotes.push({
      company: slot.company,
      grade: slot.grade,
      market: price.market,
      low: typeof price.low === "number" ? price.low : null,
      mid: typeof price.mid === "number" ? price.mid : null,
      high: typeof price.high === "number" ? price.high : null,
      trend30: typeof price.trends?.days_30?.percent_change === "number" ? price.trends.days_30.percent_change : null,
    });
  }
  return quotes;
}

function otherRawConditions(variant: ScrydexVariant): { condition: string; market: number }[] {
  const rows: { condition: string; market: number }[] = [];
  for (const price of variant.prices ?? []) {
    if (price.type && price.type !== "raw") continue;
    if (price.currency && price.currency !== "USD") continue;
    if (!price.condition || price.condition === "NM") continue;
    if (typeof price.market !== "number" || price.market <= 0) continue;
    rows.push({ condition: price.condition, market: price.market });
  }
  return rows;
}

function pickVariant(card: ScrydexCard): {
  finish: string;
  market: number;
  low: number | null;
  url: string | null;
  variant: ScrydexVariant;
} | null {
  const variants = card.variants ?? [];
  const ranked = [...variants].sort((a, b) => {
    const aName = a.name ?? "";
    const bName = b.name ?? "";
    const aFirst = firstEdition(aName) ? 1 : 0;
    const bFirst = firstEdition(bName) ? 1 : 0;
    if (aFirst !== bFirst) return aFirst - bFirst;
    const aIndex = FINISH_PREFERENCE.indexOf(aName);
    const bIndex = FINISH_PREFERENCE.indexOf(bName);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
  for (const variant of ranked) {
    const quote = nmMarket(variant);
    if (!quote) continue;
    const marketplace = (variant.marketplaces ?? []).find((entry) => entry.name?.toLowerCase() === "tcgplayer");
    return {
      finish: variant.name ?? "raw",
      market: quote.market,
      low: quote.low,
      url: marketplace?.purchase_url ?? null,
      variant,
    };
  }
  return null;
}

function gradesForCard(card: ScrydexCard, preferred: ScrydexVariant | null): ScrydexGradeQuote[] {
  if (preferred) {
    const direct = gradedQuotes(preferred);
    if (direct.length > 0) return direct;
  }
  const variants = [...(card.variants ?? [])].sort((a, b) => Number(firstEdition(a.name ?? "")) - Number(firstEdition(b.name ?? "")));
  for (const variant of variants) {
    const quotes = gradedQuotes(variant);
    if (quotes.length > 0) return quotes;
  }
  return [];
}

function saneAsk(market: number, low: number | null): number | null {
  if (low == null || low <= 0 || low >= market || low < market * 0.4) return null;
  return low;
}

function cardImage(card: ScrydexCard): string {
  const front = (card.images ?? []).find((image) => image.type === "front") ?? card.images?.[0];
  return front?.small ?? front?.medium ?? front?.large ?? "";
}

function numberLabel(card: ScrydexCard): string {
  if (card.printed_number) return card.printed_number;
  const number = card.number ?? "";
  const printed = card.expansion?.printed_total;
  if (number && printed) return `${number}/${printed}`;
  return number || "—";
}

function toCatalog(card: ScrydexCard): CatalogCard {
  const picked = pickVariant(card);
  const market = picked?.market ?? null;
  return {
    id: card.id,
    name: card.name,
    setName: card.expansion?.name ?? "Unknown set",
    setId: card.expansion?.id ?? "",
    numberLabel: numberLabel(card),
    rarity: card.rarity ?? "Unknown rarity",
    imageUrl: cardImage(card),
    marketPrice: market,
    lowPrice: picked?.low ?? null,
    highPrice: null,
    finish: picked?.finish ?? null,
    finishLabel: picked ? (FINISH_LABELS[picked.finish] ?? picked.finish) : null,
    tcgplayerUrl: picked?.url ?? null,
    updatedAt: null,
    ask: market != null && picked ? saneAsk(market, picked.low) : null,
    otherConditions: picked ? otherRawConditions(picked.variant) : [],
    grades: gradesForCard(card, picked?.variant ?? null),
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
    id: `scrydex-${card.id}-${card.finish ?? "market"}`,
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
    seller: "Lowest known",
    marketplace: "Scrydex",
    listingUrl: card.tcgplayerUrl,
    priceSource: `Scrydex ${finish}market vs lowest known`,
    updatedAt: card.updatedAt,
  };
}

export async function listCatalogDeals(query: PriceQuery): Promise<DealListing[]> {
  const name = query.name?.trim() ?? "";
  const outsideWatch = name.length > 0 && !WATCH_NAMES.includes(name.toLowerCase());
  const raw = outsideWatch ? await fetchFirstWorking(query, 40) : await watchCards();
  return raw
    .map(toCatalog)
    .filter((card) => cardTextMatch(card, query))
    .map(dealFromCatalog)
    .filter((deal): deal is DealListing => Boolean(deal))
    .sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
}

interface ScrydexListing {
  id?: string;
  source?: string;
  title?: string;
  company?: string;
  grade?: string;
  url?: string;
  price?: number;
  currency?: string;
  sold_at?: string;
}

const listingCache = new Map<string, { expires: number; source: EbaySoldSource }>();

function soldAtIso(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value.replace(/\//g, "-"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Documented sold listings: GET /pokemon/v1/cards/{id}/listings.
 * `price` is the sold price and `sold_at` is the sale date. Scrydex says
 * graded eBay history is available and raw sold rows may still be absent.
 */
export async function loadScrydexSold(card: CatalogCard): Promise<EbaySoldSource> {
  const cached = listingCache.get(card.id);
  if (cached && cached.expires > Date.now()) return cached.source;
  const url = new URL(`https://api.scrydex.com/pokemon/v1/cards/${encodeURIComponent(card.id)}/listings`);
  url.searchParams.set("source", "ebay");
  url.searchParams.set("days", "90");
  url.searchParams.set("page_size", "20");
  try {
    const response = await serverGet(url, headers());
    if (response.status === 401 || response.status === 403) {
      throw new ScrydexConfigError("Scrydex refused this key while loading sold listings.");
    }
    if (response.status < 200 || response.status >= 300) {
      return blankEbaySold("unavailable", `Scrydex sold listings returned ${response.status}.`);
    }
    const body = JSON.parse(response.text) as { data?: ScrydexListing[] };
    const hits = (body.data ?? []).flatMap((listing) => {
      if (listing.currency && listing.currency !== "USD") return [];
      if (typeof listing.price !== "number" || listing.price <= 0) return [];
      const title = listing.title?.trim() || [listing.company, listing.grade].filter(Boolean).join(" ") || "Sold listing";
      return [
        {
          title,
          price: roundMoney(listing.price),
          url: listing.url ?? null,
          soldAt: soldAtIso(listing.sold_at),
          graded: Boolean(listing.company || listing.grade),
        },
      ];
    });
    const prices = trimOutliers(hits.map((hit) => hit.price));
    const kept = hits.filter((hit) => prices.includes(hit.price));
    const raw = kept.filter((hit) => !hit.graded);
    const graded = kept.filter((hit) => hit.graded);
    const headline = median(prices);
    const comps: SoldComp[] = kept.slice(0, 3).map((hit) => ({
      title: hit.title,
      price: hit.price,
      url: hit.url,
      soldAt: hit.soldAt,
    }));
    const source: EbaySoldSource = {
      ...blankEbaySold(kept.length > 0 ? "live" : "unavailable", ""),
      status: kept.length > 0 ? "live" : "unavailable",
      statusNote:
        kept.length > 0
          ? "Sold prices from Scrydex listings (source eBay), last 90 days. Graded sales are the ones Scrydex documents today."
          : "Scrydex returned no sold listings for this card in the last 90 days.",
      medianPrice: headline,
      saleCount: kept.length,
      windowLabel: EBAY_SOLD_WINDOW,
      rawMedian: median(raw.map((hit) => hit.price)),
      rawCount: raw.length,
      gradedMedian: median(graded.map((hit) => hit.price)),
      gradedCount: graded.length,
      comps,
      updatedAt: kept.length > 0 ? new Date().toISOString() : null,
    };
    listingCache.set(card.id, { expires: Date.now() + 10 * 60 * 1000, source });
    return source;
  } catch (error) {
    if (error instanceof ScrydexConfigError) throw error;
    const message = error instanceof Error ? error.message : "Scrydex sold listings did not load.";
    return blankEbaySold("unavailable", message);
  }
}

export async function listCatalogSets(): Promise<string[]> {
  const cards = await watchCards();
  const sets = new Set<string>();
  for (const card of cards.map(toCatalog)) {
    if (dealFromCatalog(card)) sets.add(card.setName);
  }
  return [...sets].sort((a, b) => a.localeCompare(b));
}
