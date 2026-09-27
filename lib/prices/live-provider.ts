import { formatUsd } from "@/lib/format";
import { blankPriceCharting, TCGPLAYER_COPY } from "@/lib/prices/copy";
import { loadEbaySold } from "@/lib/prices/ebay-sold";
import { loadPriceCharting, priceChartingConfigured } from "@/lib/prices/pricecharting";
import {
  listCatalogDeals,
  listCatalogSets,
  loadScrydexSold,
  searchCatalog,
  type CatalogCard,
  type ScrydexGradeQuote,
} from "@/lib/prices/scrydex-provider";
import type { CardSearchResult, CardValue, DealListing, EbaySoldSource, GradePrice, PriceChartingSource, PriceProvider, PriceQuery } from "@/lib/types";

/**
 * PriceCharting allows about one call per second. A short list keeps the page
 * inside a normal server timeout. Results are cached per printing after that.
 */
const PRICECHARTING_CARD_CAP = 4;
const DEFAULT_CARD_CAP = 8;

function cardCap(): number {
  return priceChartingConfigured() ? PRICECHARTING_CARD_CAP : DEFAULT_CARD_CAP;
}

function gradeDetail(quote: ScrydexGradeQuote): string | undefined {
  const parts = [
    quote.low != null ? `low ${formatUsd(quote.low)}` : "",
    quote.mid != null ? `mid ${formatUsd(quote.mid)}` : "",
    quote.high != null ? `high ${formatUsd(quote.high)}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function scrydexGraded(card: CatalogCard): PriceChartingSource | null {
  if (card.grades.length === 0) return null;
  const grades: GradePrice[] = card.grades.map((quote) => ({
    label: `${quote.company} ${quote.grade}`,
    price: quote.market,
    detail: gradeDetail(quote),
  }));
  const psa10 = card.grades.find((quote) => quote.company === "PSA" && quote.grade === "10");
  const trend =
    psa10?.trend30 != null
      ? ` PSA 10 market is ${psa10.trend30 > 0 ? "up" : "down"} ${Math.abs(psa10.trend30)}% over 30 days.`
      : "";
  return {
    id: "pricecharting",
    name: "Scrydex graded",
    role: "Best for graded slabs (PSA, BGS, CGC).",
    caveat: "A single sale can pull a grade. These are Scrydex market figures for this finish.",
    status: "live",
    statusNote: `Market, low, mid, and high from Scrydex graded prices.${trend} PriceCharting is not required for these numbers.`,
    grades,
    url: null,
    updatedAt: null,
  };
}

async function gradedSource(card: CatalogCard): Promise<PriceChartingSource> {
  const fromScrydex = scrydexGraded(card);
  if (fromScrydex) return fromScrydex;
  if (priceChartingConfigured()) return loadPriceCharting(card);
  return blankPriceCharting(
    "unconfigured",
    "No PSA, BGS, or CGC prices were in this Scrydex response. Scrydex's FAQ says graded prices start on higher plans. PRICECHARTING_TOKEN can fill this box later. No grades are invented.",
  );
}

function mergeSold(scrydex: EbaySoldSource, ebay: EbaySoldSource): EbaySoldSource {
  if (scrydex.saleCount > 0) {
    const direct =
      ebay.status === "live" && ebay.medianPrice != null
        ? ` eBay direct sold median ${formatUsd(ebay.medianPrice)} (${ebay.saleCount} sales). That search is Marketplace Insights, not Browse asking prices.`
        : ebay.status === "unconfigured"
          ? " eBay client keys are not set, so this box is Scrydex sold listings only."
          : "";
    return {
      ...scrydex,
      name: "Sold listings (via Scrydex)",
      role: "What buyers paid, from Scrydex's sold-listing history.",
      caveat: "Scrydex documents these as sold prices, mostly graded eBay sales. A single auction can still spike.",
      statusNote: `${scrydex.statusNote}${direct}`,
      searchUrl: ebay.searchUrl,
    };
  }
  if (ebay.status === "live" && ebay.saleCount > 0) {
    return {
      ...ebay,
      statusNote: `Scrydex had no sold listings for this card. ${ebay.statusNote}`,
    };
  }
  return {
    ...scrydex,
    name: "Sold listings (via Scrydex)",
    role: "What buyers paid, from Scrydex's sold-listing history.",
    status: scrydex.status === "live" ? "live" : "unavailable",
    statusNote:
      ebay.status === "unconfigured"
        ? "Scrydex returned no sold listings. Direct eBay comps need EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. The Browse API has no sold filter, so asking prices are not shown."
        : `${scrydex.statusNote} ${ebay.statusNote}`,
    searchUrl: ebay.searchUrl,
  };
}

function toCardValue(card: CatalogCard): Promise<CardValue> {
  return Promise.all([gradedSource(card), loadScrydexSold(card), loadEbaySold(card)]).then(([pricecharting, scrydexSold, ebaySold]) => ({
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
    priceSource: "Scrydex Near Mint market and graded prices, plus sold listings",
    updatedAt: card.updatedAt,
    sources: {
        tcgplayer: {
        id: "tcgplayer",
        ...TCGPLAYER_COPY,
        name: "Scrydex market",
        caveat: "This is the Near Mint USD market average. A sudden spike can take a while to show up.",
        status: card.marketPrice != null ? "live" : "unavailable",
        statusNote:
          card.marketPrice != null
            ? `English raw Near Mint price from Scrydex (?include=prices). The market field averages US sources. The link is the TCGPlayer purchase URL on that variant.${
                card.otherConditions.length > 0
                  ? ` Other conditions: ${card.otherConditions.map((row) => `${row.condition} ${formatUsd(row.market)}`).join(", ")}.`
                  : ""
              }`
            : "No Scrydex Near Mint market price for this printing.",
        marketPrice: card.marketPrice,
        lowPrice: card.lowPrice,
        finishLabel: card.finishLabel ? `English · ${card.finishLabel}` : "English raw",
        url: card.tcgplayerUrl,
        updatedAt: card.updatedAt,
      },
      pricecharting,
      ebaySold: mergeSold(scrydexSold, ebaySold),
    },
  }));
}

export class LivePriceProvider implements PriceProvider {
  readonly id = "live" as const;
  readonly label = "Scrydex market, grades, and sold listings";
  readonly live = true;
  readonly disclaimer =
    "Live prices are on. Raw and graded numbers come from Scrydex. Sold listings come from Scrydex first. Direct eBay sold comps are added when the eBay client id and secret are set. PriceCharting stays optional. Empty boxes are not filled with practice numbers.";

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

