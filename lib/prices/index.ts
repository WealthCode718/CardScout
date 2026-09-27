import { DemoPriceProvider } from "@/lib/prices/demo-provider";
import { EbayPriceProvider } from "@/lib/prices/ebay-provider";
import { PokemonTcgPriceProvider } from "@/lib/prices/pokemontcg-provider";
import { sortDeals } from "@/lib/query";
import type { DealResponse, DealSort, PriceProvider, PriceProviderId, PriceQuery, ValueResponse } from "@/lib/types";

export function getPriceProvider(): PriceProvider {
  const choice = (process.env.PRICE_PROVIDER ?? "demo").trim().toLowerCase();
  if (choice === "pokemontcg" || choice === "pokemon" || choice === "tcg") return new PokemonTcgPriceProvider();
  if (choice === "ebay") return new EbayPriceProvider();
  return new DemoPriceProvider();
}

function describe(provider: PriceProvider) {
  return {
    id: provider.id,
    label: provider.label,
    live: provider.live,
    disclaimer: provider.disclaimer,
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
    if (provider.id === "demo") throw error;
    const demo = new DemoPriceProvider();
    const [deals, sets] = await Promise.all([demo.listDeals(query), demo.listSets()]);
    return {
      provider: describe(demo),
      requestedProvider: provider.id as PriceProviderId,
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
    const cards = await provider.searchCards(query);
    return { provider: describe(provider), fallback: false, mode, cards };
  } catch (error) {
    if (provider.id === "demo") throw error;
    const demo = new DemoPriceProvider();
    const cards = await demo.searchCards(query);
    return {
      provider: describe(demo),
      requestedProvider: provider.id as PriceProviderId,
      fallback: true,
      fallbackReason: error instanceof Error ? error.message : "Live prices did not load.",
      mode,
      cards,
    };
  }
}
