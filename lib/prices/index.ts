import { DemoPriceProvider } from "@/lib/prices/demo-provider";
import { LivePriceProvider } from "@/lib/prices/live-provider";
import { TcgapiConfigError } from "@/lib/prices/tcgapi-provider";
import { sortDeals } from "@/lib/query";
import type { DealResponse, DealSort, PriceProvider, PriceProviderId, PriceQuery, ValueResponse } from "@/lib/types";

/**
 * Live prices are the product. Practice cards are used only inside the catch
 * blocks below, after a live call fails. PRICE_PROVIDER is not a demo switch.
 */
export function getPriceProvider(): PriceProvider {
  return new LivePriceProvider();
}

function describe(provider: PriceProvider) {
  return {
    id: provider.id,
    label: provider.label,
    live: provider.live,
    disclaimer: provider.disclaimer,
  };
}

function unconfiguredProvider(reason: string) {
  return {
    id: "live" as const,
    label: "TCGPlayer market via tcgapi.dev, and eBay sold comps",
    live: false,
    disclaimer: reason,
  };
}

export async function getDealResponse(query: PriceQuery, sort: DealSort = "discount"): Promise<DealResponse> {
  const provider = getPriceProvider();
  try {
    const [deals, sets] = await Promise.all([provider.listDeals(query), provider.listSets()]);
    return {
      provider: describe(provider),
      fallback: false,
      deals: sortDeals(deals, sort),
      sets,
    };
  } catch (error) {
    if (error instanceof TcgapiConfigError) {
      return {
        provider: unconfiguredProvider(error.message),
        fallback: false,
        deals: [],
        sets: [],
      };
    }
    if (provider.id === "demo") throw error;
    const demo = new DemoPriceProvider();
    const [deals, sets] = await Promise.all([demo.listDeals(query), demo.listSets()]);
    return {
      provider: describe(demo),
      requestedProvider: provider.id,
      fallback: true,
      fallbackReason: error instanceof Error ? error.message : "Live prices did not load.",
      deals: sortDeals(deals, sort),
      sets,
    };
  }
}

export async function getValueResponse(query: PriceQuery): Promise<ValueResponse> {
  const provider = getPriceProvider();
  const mode = query.name?.trim() || query.set?.trim() ? "results" : "featured";
  try {
    const { cards, matchCount } = await provider.searchCards(query);
    return {
      provider: describe(provider),
      fallback: false,
      mode,
      cards,
      matchCount,
      limitNote:
        provider.live && matchCount > cards.length
          ? "Live prices load a few printings at a time so we stay inside each source's limits."
          : undefined,
    };
  } catch (error) {
    if (error instanceof TcgapiConfigError) {
      return {
        provider: unconfiguredProvider(error.message),
        fallback: false,
        mode,
        cards: [],
        matchCount: 0,
      };
    }
    if (provider.id === "demo") throw error;
    const demo = new DemoPriceProvider();
    const { cards, matchCount } = await demo.searchCards(query);
    return {
      provider: describe(demo),
      requestedProvider: provider.id as PriceProviderId,
      fallback: true,
      fallbackReason: error instanceof Error ? error.message : "Live prices did not load.",
      mode,
      cards,
      matchCount,
    };
  }
}
