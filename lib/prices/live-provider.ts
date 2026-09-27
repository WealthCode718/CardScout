import { TCGPLAYER_COPY } from "@/lib/prices/copy";
import { ebayAsksConfigured, listEbayAskDeals } from "@/lib/prices/ebay-asks";
import { loadEbaySold } from "@/lib/prices/ebay-sold";
import { loadPriceCharting, priceChartingConfigured } from "@/lib/prices/pricecharting";
import { listCatalogDeals, listCatalogSets, searchCatalog, type CatalogCard } from "@/lib/prices/pokemontcg-provider";
import type { CardSearchResult, CardValue, DealListing, PriceProvider, PriceQuery } from "@/lib/types";

/**
 * PriceCharting allows about one call per second. A short list keeps the page
 * inside a normal server timeout. Results are cached per printing after that.
 */
const PRICECHARTING_CARD_CAP = 4;
const DEFAULT_CARD_CAP = 8;

function cardCap(): number {
  return priceChartingConfigured() ? PRICECHARTING_CARD_CAP : DEFAULT_CARD_CAP;
}

function toCardValue(card: CatalogCard): Promise<CardValue> {
  return Promise.all([loadPriceCharting(card), loadEbaySold(card)]).then(([pricecharting, ebaySold]) => ({
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
    priceSource: "TCGPlayer market, with PriceCharting and eBay sold when those keys are set",
    updatedAt: card.updatedAt,
    sources: {
      tcgplayer: {
        id: "tcgplayer",
        ...TCGPLAYER_COPY,
        status: card.marketPrice != null ? "live" : "unavailable",
        statusNote:
          card.marketPrice != null
            ? "English raw market price from TCGPlayer, via the Pokémon TCG API."
            : "No TCGPlayer market price for this printing.",
        marketPrice: card.marketPrice,
        lowPrice: card.lowPrice,
        finishLabel: card.finishLabel ? `English · ${card.finishLabel}` : "English raw",
        url: card.tcgplayerUrl,
        updatedAt: card.updatedAt,
      },
      pricecharting,
      ebaySold,
    },
  }));
}

export class LivePriceProvider implements PriceProvider {
  readonly id = "live" as const;
  readonly label = "TCGPlayer, PriceCharting, and eBay sold";
  readonly live = true;
  readonly disclaimer =
    "Live mode. The market baseline is the TCGPlayer price for a raw English card. On Values, each box says if that source is live, still needs a key, or did not load.";

  async searchCards(query: PriceQuery): Promise<CardSearchResult> {
    const cards = await searchCatalog(query);
    const shown = cards.slice(0, cardCap());
    return {
      cards: await Promise.all(shown.map((card) => toCardValue(card))),
      matchCount: cards.length,
    };
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    const deals = await listCatalogDeals(query);
    if (!ebayAsksConfigured()) return deals;
    try {
      const asks = await listEbayAskDeals(query);
      return [...deals, ...asks];
    } catch {
      return deals;
    }
  }

  async listSets(): Promise<string[]> {
    return listCatalogSets();
  }
}

