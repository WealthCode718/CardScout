import type { CatalogCard } from "@/lib/prices/catalog";
import { TCGPLAYER_COPY } from "@/lib/prices/copy";
import { ebayConfigured } from "@/lib/prices/ebay-auth";
import { loadEbaySold } from "@/lib/prices/ebay-sold";
import { TcgapiConfigError, listCatalogDeals, listCatalogSets, searchCatalog, tcgapiConfigured } from "@/lib/prices/tcgapi-provider";
import type { CardSearchResult, CardValue, DealListing, EbaySoldSource, PriceChartingSource, PriceProvider, PriceQuery } from "@/lib/types";

const CARD_CAP = 8;

const MARKET_NAME = "TCGPlayer market (via tcgapi.dev)";
const GRADED_NAME = "Graded comps (from eBay sold titles)";
const SOLD_NAME = "eBay sold comps";

function queryCard(query: PriceQuery): CatalogCard {
  const name = query.name?.trim() || "Pokemon card";
  return {
    id: `ebay-query-${name.toLowerCase()}`,
    name,
    setName: query.set?.trim() || "",
    setId: "",
    numberLabel: "",
    rarity: "",
    imageUrl: "",
    marketPrice: null,
    lowPrice: null,
    highPrice: null,
    finish: null,
    finishLabel: null,
    tcgplayerUrl: null,
    updatedAt: null,
    ask: null,
  };
}

function marketSource(card: CatalogCard): CardValue["sources"]["tcgplayer"] {
  const live = tcgapiConfigured() && card.marketPrice != null;
  return {
    id: "tcgplayer",
    ...TCGPLAYER_COPY,
    name: MARKET_NAME,
    caveat: "TCGPlayer's market price is the median of recent sales, so a sudden spike can take a while to show up.",
    status: live ? "live" : tcgapiConfigured() ? "unavailable" : "unconfigured",
    statusNote: live
      ? "English raw market and low list price from tcgapi.dev, which reads TCGPlayer. Free tier is 100 requests a day, so this result is cached."
      : tcgapiConfigured()
        ? "tcgapi.dev had no market price for this printing."
        : "Not configured. Add TCGAPI_API_KEY from https://tcgapi.dev/ (free key, 100 requests a day). No market price is invented.",
    marketPrice: live ? card.marketPrice : null,
    lowPrice: live ? card.lowPrice : null,
    finishLabel: card.finishLabel ? `English · ${card.finishLabel}` : "English raw",
    url: card.tcgplayerUrl,
    updatedAt: card.updatedAt,
  };
}

function gradedSource(sold: EbaySoldSource): PriceChartingSource {
  const grades = sold.titleGrades ?? [];
  if (!ebayConfigured()) {
    return {
      id: "pricecharting",
      name: GRADED_NAME,
      role: "PSA, BGS, and CGC medians taken from sold listing titles.",
      caveat: "A title can name a grade the card does not have. This is not a PriceCharting price.",
      status: "unconfigured",
      statusNote:
        "Not configured. Graded numbers are medians of eBay sold titles that say PSA, BGS, or CGC. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. No graded prices are invented.",
      grades: [],
      url: null,
      updatedAt: null,
    };
  }
  if (grades.length === 0) {
    return {
      id: "pricecharting",
      name: GRADED_NAME,
      role: "PSA, BGS, and CGC medians taken from sold listing titles.",
      caveat: "A title can name a grade the card does not have. This is not a PriceCharting price.",
      status: "unavailable",
      statusNote: "No PSA, BGS, or CGC sales were in this eBay sold search. No graded prices are invented.",
      grades: [],
      url: sold.searchUrl,
      updatedAt: sold.updatedAt,
    };
  }
  return {
    id: "pricecharting",
    name: GRADED_NAME,
    role: "PSA, BGS, and CGC medians taken from sold listing titles.",
    caveat: "A title can name a grade the card does not have. This is not a PriceCharting price.",
    status: "live",
    statusNote: "Each number is the median sold price of titles that name that company and grade.",
    grades,
    url: sold.searchUrl,
    updatedAt: sold.updatedAt,
  };
}

function soldSource(sold: EbaySoldSource): EbaySoldSource {
  return {
    ...sold,
    name: SOLD_NAME,
    role: "What buyers paid in completed sales, raw or graded.",
    caveat: "A single auction can jump when people bid against each other. Buy It Now asking prices are not used.",
    statusNote: ebayConfigured()
      ? `${sold.statusNote} Browse item search has no sold filter, so these rows are eBay Marketplace Insights completed sales.`
      : sold.statusNote,
  };
}

async function toCardValue(card: CatalogCard): Promise<CardValue> {
  const sold = await loadEbaySold(card);
  return {
    id: card.id,
    name: card.name,
    setName: card.setName,
    setId: card.setId,
    numberLabel: card.numberLabel,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    marketPrice: tcgapiConfigured() ? card.marketPrice : null,
    lowPrice: tcgapiConfigured() ? card.lowPrice : null,
    highPrice: null,
    currency: "USD",
    priceSource: "TCGPlayer market via tcgapi.dev, plus eBay sold comps when those keys are set",
    updatedAt: card.updatedAt,
    sources: {
      tcgplayer: marketSource(card),
      pricecharting: gradedSource(sold),
      ebaySold: soldSource(sold),
    },
  };
}

function liveDisclaimer(): string {
  if (tcgapiConfigured() && ebayConfigured()) {
    return "Live prices are on. The raw number is the TCGPlayer market via tcgapi.dev. Sold comps, and graded medians from those titles, come from eBay. Empty boxes are not filled with practice numbers.";
  }
  if (tcgapiConfigured()) {
    return "Live prices are on for the TCGPlayer market via tcgapi.dev. eBay sold comps and graded title medians need EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. Those boxes stay blank.";
  }
  return "Live prices are on for eBay sold comps. The TCGPlayer market needs TCGAPI_API_KEY from tcgapi.dev. No market price is invented.";
}

export class LivePriceProvider implements PriceProvider {
  readonly id = "live" as const;
  readonly label = "TCGPlayer market via tcgapi.dev, and eBay sold comps";
  get live(): boolean {
    return tcgapiConfigured() || ebayConfigured();
  }
  get disclaimer(): string {
    return liveDisclaimer();
  }

  async searchCards(query: PriceQuery): Promise<CardSearchResult> {
    if (!this.live) throw new TcgapiConfigError();
    if (!tcgapiConfigured()) {
      const name = query.name?.trim();
      if (!name) return { cards: [], matchCount: 0 };
      const card = await toCardValue(queryCard(query));
      return { cards: [card], matchCount: 1 };
    }
    const cards = await searchCatalog(query);
    const shown = cards.slice(0, CARD_CAP);
    return {
      cards: await Promise.all(shown.map((card) => toCardValue(card))),
      matchCount: cards.length,
    };
  }

  async listDeals(query: PriceQuery): Promise<DealListing[]> {
    if (!tcgapiConfigured()) {
      if (!ebayConfigured()) throw new TcgapiConfigError();
      return [];
    }
    return listCatalogDeals(query);
  }

  async listSets(): Promise<string[]> {
    if (!tcgapiConfigured()) return [];
    return listCatalogSets();
  }
}
