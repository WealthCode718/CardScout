export const TABS = ["deals", "values", "news"] as const;

export type TabId = (typeof TABS)[number];

export type DealSort = "discount" | "savings";

export type PriceProviderId = "demo" | "pokemontcg" | "ebay";

export interface ProviderInfo {
  id: PriceProviderId;
  label: string;
  live: boolean;
  disclaimer: string;
}

export interface CardValue {
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
  currency: "USD";
  priceSource: string;
  updatedAt: string | null;
}

export interface DealListing {
  id: string;
  cardId: string;
  name: string;
  setName: string;
  setId: string;
  numberLabel: string;
  rarity: string;
  imageUrl: string;
  condition: string;
  listingPrice: number;
  marketPrice: number;
  discountPercent: number;
  savings: number;
  seller: string;
  marketplace: string;
  listingUrl: string | null;
  priceSource: string;
  updatedAt: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface DealResponse {
  provider: ProviderInfo;
  requestedProvider?: PriceProviderId;
  fallback: boolean;
  fallbackReason?: string;
  deals: DealListing[];
  sets: string[];
}

export interface ValueResponse {
  provider: ProviderInfo;
  requestedProvider?: PriceProviderId;
  fallback: boolean;
  fallbackReason?: string;
  /** Featured cards when the search box is empty. Search results otherwise. */
  mode: "featured" | "results";
  cards: CardValue[];
}

export interface NewsResponse {
  live: boolean;
  sourceNote: string;
  items: NewsItem[];
}

export interface PriceQuery {
  name?: string;
  set?: string;
}

export interface PriceProvider {
  readonly id: PriceProviderId;
  readonly label: string;
  readonly live: boolean;
  readonly disclaimer: string;
  searchCards(query: PriceQuery): Promise<CardValue[]>;
  listDeals(query: PriceQuery): Promise<DealListing[]>;
  listSets(): Promise<string[]>;
}
