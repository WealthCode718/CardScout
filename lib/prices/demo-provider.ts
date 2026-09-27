import { SAMPLE_CARDS, FEATURED_CARD_IDS, SET_ORDER, type SampleCard } from "@/lib/prices/demo-data";
import { matchesText, underMarket } from "@/lib/prices/discount";
import type { CardValue, DealListing, PriceProvider, PriceQuery } from "@/lib/types";

const DEMO_SOURCE = "Sample estimate";

function toValue(card: SampleCard): CardValue {
  return {
    id: card.id,
    name: card.name,
    setName: card.setName,
    setId: card.setId,
    numberLabel: card.numberLabel,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    marketPrice: card.marketPrice,
    lowPrice: card.lowPrice,
    highPrice: card.highPrice,
    currency: "USD",
    priceSource: DEMO_SOURCE,
    updatedAt: null,
  };
}

function toDeal(card: SampleCard): DealListing | null {
  if (card.ask == null || !card.seller) return null;
  const deal = underMarket(card.marketPrice, card.ask);
  if (!deal) return null;
  return {
    id: `sample-${card.id}`,
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
    discountPercent: deal.discountPercent,
    savings: deal.savings,
    seller: card.seller,
    marketplace: "Sample market",
    listingUrl: null,
    priceSource: DEMO_SOURCE,
    updatedAt: null,
  };
}

function cardMatches(card: SampleCard, query: PriceQuery): boolean {
  const nameHaystack = `${card.name} ${card.numberLabel} ${card.rarity}`;
  const setHaystack = `${card.setName} ${card.setId}`;
  return matchesText(nameHaystack, query.name) && matchesText(setHaystack, query.set);
}

export class DemoPriceProvider implements PriceProvider {
  readonly id = "demo" as const;
  readonly label = "Sample prices";
  readonly live = false;
  readonly disclaimer =
    "Practice mode. These prices are sample estimates shipped with CardScout so you can learn the screens. They are not live shop listings.";

  async searchCards(query: PriceQuery): Promise<CardValue[]> {
    const name = query.name?.trim() ?? "";
    const setName = query.set?.trim() ?? "";
    if (!name && !setName) {
      return FEATURED_CARD_IDS.map((id) => SAMPLE_CARDS.find((card) => card.id === id))
        .filter((card): card is SampleCard => Boolean(card))
        .map(toValue);
    }
    return SAMPLE_CARDS.filter((card) => cardMatches(card, query))
      .map(toValue)
      .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0) || a.setName.localeCompare(b.setName));
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    return SAMPLE_CARDS.filter((card) => cardMatches(card, query))
      .map(toDeal)
      .filter((deal): deal is DealListing => Boolean(deal))
      .sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);
  }

  async listSets(): Promise<string[]> {
    const present = new Set(SAMPLE_CARDS.filter((card) => card.ask != null).map((card) => card.setName));
    return SET_ORDER.filter((setName) => present.has(setName));
  }
}
