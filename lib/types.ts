export const TABS = ["deals", "values", "news", "drops"] as const;

export type TabId = (typeof TABS)[number];

export type DealSort = "discount" | "savings";

/** `pokemontcg` and `ebay` in older env files are treated as `live`. */
export type PriceProviderId = "demo" | "live";

export type SourceStatus = "live" | "sample" | "unconfigured" | "unavailable";

export interface ProviderInfo {
  id: PriceProviderId;
  label: string;
  live: boolean;
  disclaimer: string;
}

export interface GradePrice {
  label: string;
  price: number;
  /** Low, mid, and high when the source sends them. */
  detail?: string;
}

export interface SoldComp {
  title: string;
  price: number;
  url: string | null;
  soldAt: string | null;
}

export interface TcgplayerSource {
  id: "tcgplayer";
  name: string;
  role: string;
  caveat: string;
  status: SourceStatus;
  statusNote: string;
  marketPrice: number | null;
  lowPrice: number | null;
  finishLabel: string | null;
  url: string | null;
  updatedAt: string | null;
}

export interface PriceChartingSource {
  id: "pricecharting";
  name: string;
  role: string;
  caveat: string;
  status: SourceStatus;
  statusNote: string;
  grades: GradePrice[];
  url: string | null;
  updatedAt: string | null;
}

export interface EbaySoldSource {
  id: "ebay-sold";
  name: string;
  role: string;
  caveat: string;
  status: SourceStatus;
  statusNote: string;
  medianPrice: number | null;
  saleCount: number;
  windowLabel: string;
  rawMedian: number | null;
  rawCount: number;
  gradedMedian: number | null;
  gradedCount: number;
  searchUrl: string | null;
  comps: SoldComp[];
  updatedAt: string | null;
  /** Medians of sold titles that name PSA, BGS, or CGC. Not a slab price guide. */
  titleGrades?: GradePrice[];
}

export interface CardSources {
  tcgplayer: TcgplayerSource;
  pricecharting: PriceChartingSource;
  ebaySold: EbaySoldSource;
}

export interface CardValue {
  id: string;
  name: string;
  setName: string;
  setId: string;
  numberLabel: string;
  rarity: string;
  imageUrl: string;
  /** TCGPlayer market for the raw English copy, when we have one. */
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  currency: "USD";
  priceSource: string;
  updatedAt: string | null;
  sources: CardSources;
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
  /** What the crossed-out baseline is. Always a market figure, never an asking price. */
  marketLabel: string;
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
  /** How many printings matched before the live-source cap. */
  matchCount: number;
  /** Why the list is shorter than matchCount, when it is. */
  limitNote?: string;
}

export interface CardSearchResult {
  cards: CardValue[];
  matchCount: number;
}

export interface NewsResponse {
  live: boolean;
  sourceNote: string;
  items: NewsItem[];
}

export type RetailerId = "target" | "walmart" | "gamestop";

export type DropsStatus = "results" | "invalid-zip" | "not-found" | "unavailable";

export interface DropStore {
  id: string;
  retailer: RetailerId;
  name: string;
  /** Empty when OpenStreetMap has no street address. */
  address: string;
  distanceMiles: number;
  directionsUrl: string;
  storePageUrl: string;
  /** True when storePageUrl is that chain’s own store page. */
  hasStorePage: boolean;
  stockUrl: string;
}

export interface DropRetailerGroup {
  id: RetailerId;
  label: string;
  stores: DropStore[];
  totalInRadius: number;
  /** False when that chain’s map search did not finish. Links are still usable. */
  loaded: boolean;
  finderUrl: string;
  stockUrl: string;
}

export interface DropsResponse {
  zip: string;
  radiusMiles: number;
  placeLabel: string | null;
  status: DropsStatus;
  sourceNote: string;
  stockNote: string;
  groups: DropRetailerGroup[];
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
  searchCards(query: PriceQuery): Promise<CardSearchResult>;
  listDeals(query: PriceQuery): Promise<DealListing[]>;
  listSets(): Promise<string[]>;
}
