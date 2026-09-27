import { PokemonTcgPriceProvider } from "@/lib/prices/pokemontcg-provider";
import { underMarket } from "@/lib/prices/discount";
import type { CardValue, DealListing, PriceProvider, PriceQuery } from "@/lib/types";

interface EbayToken {
  token: string;
  expires: number;
}

interface EbayItem {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  seller?: { username?: string; feedbackPercentage?: string };
  image?: { imageUrl?: string };
}

let tokenCache: EbayToken | null = null;

function ebayHost(): string {
  return process.env.EBAY_ENV?.toUpperCase() === "SANDBOX" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function requireKeys(): { id: string; secret: string } {
  const id = process.env.EBAY_CLIENT_ID?.trim() ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) {
    throw new Error("eBay keys are missing. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET from developer.ebay.com.");
  }
  return { id, secret };
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now() + 30_000) return tokenCache.token;
  const { id, secret } = requireKeys();
  const response = await fetch(`${ebayHost()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`eBay login failed (${response.status}). Check EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_ENV.`);
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("eBay did not return an access token.");
  tokenCache = {
    token: body.access_token,
    expires: Date.now() + (body.expires_in ?? 7200) * 1000,
  };
  return body.access_token;
}

function junkTitle(title: string): boolean {
  return /\b(lot|bundle|lots|booster|elite trainer|etb|binder|proxy|digital code|code card|sealed box|display)\b/i.test(title);
}

function matchCard(title: string, cards: CardValue[]): CardValue | null {
  const text = title.toLowerCase();
  const hits = cards.filter((card) => text.includes(card.name.toLowerCase()));
  const withSet = hits.filter((card) => {
    const setName = card.setName.toLowerCase();
    if (text.includes(setName)) return true;
    if (setName === "base" && /\bbase set\b/.test(text)) return true;
    return false;
  });
  if (withSet.length === 1) return withSet[0] ?? null;
  if (withSet.length > 1) {
    return withSet.find((card) => text.includes(card.numberLabel.split("/")[0]?.toLowerCase() ?? "___")) ?? null;
  }
  return null;
}

async function searchEbay(keywords: string, token: string): Promise<EbayItem[]> {
  const url = new URL(`${ebayHost()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", keywords);
  url.searchParams.set("limit", "20");
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},priceCurrency:USD");
  url.searchParams.set("sort", "price");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`eBay search failed (${response.status}).`);
  }
  const body = (await response.json()) as { itemSummaries?: EbayItem[] };
  return body.itemSummaries ?? [];
}

export class EbayPriceProvider implements PriceProvider {
  readonly id = "ebay" as const;
  readonly label = "eBay Browse";
  readonly live = true;
  readonly disclaimer =
    "Listings are Buy It Now results from eBay. The market price is the TCGPlayer figure from the Pokémon TCG API for a card whose name and set both appear in the title. Check photos, condition, and seller feedback before you buy.";

  private readonly baseline = new PokemonTcgPriceProvider();

  async searchCards(query: PriceQuery): Promise<CardValue[]> {
    return this.baseline.searchCards(query);
  }

  async listSets(): Promise<string[]> {
    return this.baseline.listSets();
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    const token = await accessToken();
    const name = query.name?.trim() || "charizard";
    const setName = query.set?.trim() ?? "";
    const cards = await this.baseline.searchCards({ name, set: setName });
    if (cards.length === 0) return [];
    const items = await searchEbay(`pokemon tcg ${name} ${setName} card`.replace(/\s+/g, " "), token);
    const deals: DealListing[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const title = item.title?.trim() ?? "";
      const price = Number(item.price?.value);
      if (!title || junkTitle(title) || item.price?.currency !== "USD" || !Number.isFinite(price)) continue;
      const card = matchCard(title, cards);
      if (!card?.marketPrice) continue;
      const ratio = price / card.marketPrice;
      if (ratio < 0.45 || ratio >= 0.95) continue;
      const deal = underMarket(card.marketPrice, price);
      if (!deal) continue;
      const id = item.itemId ?? item.itemWebUrl ?? title;
      if (seen.has(id)) continue;
      seen.add(id);
      const feedback = item.seller?.feedbackPercentage ? ` · ${item.seller.feedbackPercentage}%` : "";
      deals.push({
        id: `ebay-${id}`,
        cardId: card.id,
        name: card.name,
        setName: card.setName,
        setId: card.setId,
        numberLabel: card.numberLabel,
        rarity: card.rarity,
        imageUrl: card.imageUrl || item.image?.imageUrl || "",
        condition: item.condition || "See listing",
        listingPrice: price,
        marketPrice: card.marketPrice,
        discountPercent: deal.discountPercent,
        savings: deal.savings,
        seller: `${item.seller?.username ?? "eBay seller"}${feedback}`,
        marketplace: "eBay",
        listingUrl: item.itemWebUrl ?? null,
        priceSource: "eBay ask vs TCGPlayer market",
        updatedAt: new Date().toISOString(),
      });
    }

    return deals.sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
  }
}
