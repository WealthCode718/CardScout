import { TCGPLAYER_COPY } from "@/lib/prices/copy";
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
    priceSource: "TCGPlayer market via the Pokémon TCG API, plus eBay sold when those keys are set",
    updatedAt: card.updatedAt,
    sources: {
        tcgplayer: {
        id: "tcgplayer",
        ...TCGPLAYER_COPY,
        name: "TCGPlayer market (via Pokémon TCG API)",
        status: card.marketPrice != null ? "live" : "unavailable",
        statusNote:
          card.marketPrice != null
            ? "English raw market price. TCGPlayer is not issuing new developer keys, so this number is the market field on the Pokémon TCG API."
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
  readonly label = "TCGPlayer market and eBay sold";
  readonly live = true;
  readonly disclaimer =
    "Live prices are on. The raw market number is TCGPlayer via the Pokémon TCG API. Sold comps load from eBay when the client id and secret are set. Graded PriceCharting prices are coming soon and stay blank until that token is set. Empty boxes are not filled with practice numbers.";

  async searchCards(query: PriceQuery): Promise<CardSearchResult> {
    const cards = await searchCatalog(query);
    const shown = cards.slice(0, cardCap());
    return {
      cards: await Promise.all(shown.map((card) => toCardValue(card))),
      matchCount: cards.length,
    };
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    return listCatalogDeals(query);
  }

  async listSets(): Promise<string[]> {
    return listCatalogSets();
  }
}

