import { EBAY_BROWSE_SCOPE, ebayAccessToken, ebayConfigured, ebayHost } from "@/lib/prices/ebay-auth";
import { underMarket } from "@/lib/prices/discount";
import type { CatalogCard } from "@/lib/prices/pokemontcg-provider";
import { searchCatalog } from "@/lib/prices/pokemontcg-provider";
import { junkTitle, titleHasCardName, titleHasSet, titleNumberAgrees } from "@/lib/prices/titles";
import type { DealListing, PriceQuery } from "@/lib/types";

interface EbayItem {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  seller?: { username?: string; feedbackPercentage?: string };
  image?: { imageUrl?: string };
}

/**
 * Active Buy It Now rows for the Deals tab. The asking price is the listing.
 * The market baseline stays the TCGPlayer market on the catalog card.
 */
async function searchAsks(keywords: string, token: string): Promise<EbayItem[]> {
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
  if (!response.ok) throw new Error(`eBay search failed (${response.status}).`);
  const body = (await response.json()) as { itemSummaries?: EbayItem[] };
  return body.itemSummaries ?? [];
}

function matchCard(title: string, cards: CatalogCard[]): CatalogCard | null {
  const hits = cards.filter(
    (card) =>
      card.marketPrice != null &&
      titleHasCardName(title, card.name) &&
      titleHasSet(title, card.setName) &&
      titleNumberAgrees(title, card.numberLabel),
  );
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

export function ebayAsksConfigured(): boolean {
  return ebayConfigured();
}

export async function listEbayAskDeals(query: PriceQuery): Promise<DealListing[]> {
  const token = await ebayAccessToken(EBAY_BROWSE_SCOPE);
  const name = query.name?.trim() || "charizard";
  const setName = query.set?.trim() ?? "";
  const cards = await searchCatalog({ name, set: setName });
  if (cards.length === 0) return [];
  const items = await searchAsks(`pokemon tcg ${name} ${setName} card`.replace(/\s+/g, " "), token);
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
      marketLabel: "TCGPlayer market",
      discountPercent: deal.discountPercent,
      savings: deal.savings,
      seller: `${item.seller?.username ?? "eBay seller"}${feedback}`,
      marketplace: "eBay asking price",
      listingUrl: item.itemWebUrl ?? null,
      priceSource: "Asking price compared with TCGPlayer market",
      updatedAt: new Date().toISOString(),
    });
  }

  return deals;
}
