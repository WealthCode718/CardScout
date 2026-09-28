import { DEFAULT_ZIP, parseZip } from "@/lib/query";
import type { DropRetailerGroup, DropStore, DropsResponse, DropsStatus, RetailerId } from "@/lib/types";

export const STOCK_NOTE = "Stock changes fast — confirm in the retailer app or at the store.";

const PRODUCT_QUERY = "pokemon trading card game";

const RETAILERS: { id: RetailerId; label: string; hosts: string[] }[] = [
  { id: "target", label: "Target", hosts: ["target.com"] },
  { id: "walmart", label: "Walmart", hosts: ["walmart.com"] },
  { id: "gamestop", label: "GameStop", hosts: ["gamestop.com"] },
];

const WIKIDATA: Record<string, RetailerId> = {
  Q1046951: "target",
  Q483551: "walmart",
  Q202210: "gamestop",
};

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

export function retailerLabel(id: RetailerId): string {
  return RETAILERS.find((retailer) => retailer.id === id)?.label ?? id;
}

export function abbreviateState(value: string | undefined): string {
  const state = value?.trim() ?? "";
  if (!state) return "";
  if (/^[A-Za-z]{2}$/.test(state)) return state.toUpperCase();
  return STATE_ABBREVIATIONS[state.toLowerCase()] ?? state;
}

export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function classifyRetailer(tags: Record<string, string>): RetailerId | null {
  for (const id of (tags["brand:wikidata"] ?? "").split(";")) {
    const retailer = WIKIDATA[id.trim()];
    if (retailer) return retailer;
  }
  const brand = (tags.brand ?? "").trim().toLowerCase();
  const name = (tags.name ?? "").trim().toLowerCase();
  if (brand === "target" || name === "target") return "target";
  if (brand.startsWith("walmart") || name.startsWith("walmart")) return "walmart";
  if (brand === "gamestop" || name === "gamestop" || name === "game stop") return "gamestop";
  return null;
}

export function isExcludedShop(tags: Record<string, string>): boolean {
  const blob = `${tags.name ?? ""} ${tags.brand ?? ""} ${tags.shop ?? ""} ${tags.operator ?? ""}`.toLowerCase();
  if (/optical|pharmacy|vision center|clinic|warehouse|distribution|fulfillment|fuel|gas station/.test(blob)) {
    return true;
  }
  if (tags["disused:shop"] || tags.shop === "vacant" || tags.opening_hours === "closed") return true;
  return false;
}

export function formatStoreAddress(tags: Record<string, string>): string {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const city = tags["addr:city"]?.trim() ?? "";
  const state = abbreviateState(tags["addr:state"]);
  const postcode = tags["addr:postcode"]?.trim() ?? "";
  const region = [state, postcode].filter(Boolean).join(" ");
  const cityLine = [city, region].filter(Boolean).join(", ");
  const parts = [street, cityLine].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return tags["addr:full"]?.trim() ?? "";
}

export function formatPlaceLabel(address: {
  suburb?: string;
  borough?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
}): string | null {
  const locality =
    address.city === "New York" && (address.suburb || address.borough)
      ? address.suburb || address.borough
      : address.city || address.town || address.village || address.suburb || address.borough;
  const state = abbreviateState(address.state);
  if (locality && state) return `${locality}, ${state}`;
  return locality || state || null;
}

function productSearch(retailer: RetailerId, walmartStoreId?: string): string {
  if (retailer === "target") {
    const url = new URL("https://www.target.com/s");
    url.searchParams.set("searchTerm", PRODUCT_QUERY);
    return url.toString();
  }
  if (retailer === "walmart") {
    const url = new URL("https://www.walmart.com/search");
    url.searchParams.set("q", PRODUCT_QUERY);
    if (walmartStoreId) url.searchParams.set("stores", walmartStoreId);
    return url.toString();
  }
  const url = new URL("https://www.gamestop.com/search/");
  url.searchParams.set("q", PRODUCT_QUERY);
  url.searchParams.set("lang", "default");
  return url.toString();
}

export function finderUrl(retailer: RetailerId, query: string | null): string {
  const q = query?.trim() ?? "";
  if (retailer === "target") {
    const url = new URL("https://www.target.com/store-locator/find-stores");
    if (q) url.searchParams.set("address", q);
    return url.toString();
  }
  if (retailer === "walmart") {
    const url = new URL("https://www.walmart.com/store/finder");
    if (q) url.searchParams.set("location", q);
    return url.toString();
  }
  if (q) {
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", `GameStop near ${q}`);
    return url.toString();
  }
  return "https://www.gamestop.com/stores/";
}

function officialWebsite(retailer: RetailerId, tags: Record<string, string>): string | null {
  const raw = tags.website || tags["contact:website"] || "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const allowed = RETAILERS.find((item) => item.id === retailer)?.hosts ?? [];
    const matches = allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!matches) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function walmartStoreId(website: string | null, ref: string | undefined): string | null {
  if (website) {
    const match = website.match(/walmart\.com\/store\/(\d{3,5})(?:[/?#-]|$)/i);
    if (match?.[1]) return match[1];
  }
  if (ref && /^\d{3,5}$/.test(ref.trim())) return ref.trim();
  return null;
}

export function directionsUrl(lat: number, lon: number): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${lat},${lon}`);
  return url.toString();
}

export function buildStore(input: {
  id: string;
  retailer: RetailerId;
  tags: Record<string, string>;
  lat: number;
  lon: number;
  originLat: number;
  originLon: number;
  zip: string;
}): DropStore {
  const address = formatStoreAddress(input.tags);
  const website = officialWebsite(input.retailer, input.tags);
  const pageQuery = address || input.zip;
  const storeId = input.retailer === "walmart" ? walmartStoreId(website, input.tags.ref) : null;
  const name = input.tags.name?.trim() || retailerLabel(input.retailer);
  return {
    id: input.id,
    retailer: input.retailer,
    name,
    address,
    distanceMiles: milesBetween(input.originLat, input.originLon, input.lat, input.lon),
    directionsUrl: directionsUrl(input.lat, input.lon),
    storePageUrl: website ?? finderUrl(input.retailer, pageQuery),
    hasStorePage: Boolean(website),
    stockUrl: productSearch(input.retailer, storeId ?? undefined),
  };
}

export function buildDropsResponse(input: {
  zip: string;
  radiusMiles: number;
  placeLabel: string | null;
  status: DropsStatus;
  sourceNote: string;
  groups?: DropRetailerGroup[];
}): DropsResponse {
  const linkZip = input.status === "invalid-zip" ? null : input.zip;
  return {
    zip: input.zip,
    radiusMiles: input.radiusMiles,
    placeLabel: input.placeLabel,
    status: input.status,
    sourceNote: input.sourceNote,
    stockNote: STOCK_NOTE,
    groups: input.groups ?? buildGroups([], linkZip, 8).map((group) => ({ ...group, loaded: false })),
  };
}

/** Used when the browser cannot reach the lookup. Same links as a failed search. */
export function offlineDrops(rawZip: string, radiusMiles: number): DropsResponse {
  const trimmed = rawZip.trim();
  const zip = parseZip(trimmed);
  if (trimmed && !zip) {
    return buildDropsResponse({
      zip: trimmed.slice(0, 10),
      radiusMiles,
      placeLabel: null,
      status: "invalid-zip",
      sourceNote: `Enter a 5-digit US ZIP code, like ${DEFAULT_ZIP}.`,
    });
  }
  return buildDropsResponse({
    zip: zip || DEFAULT_ZIP,
    radiusMiles,
    placeLabel: null,
    status: "unavailable",
    sourceNote: "Nearby stores did not load. The links below open each retailer’s store finder and Pokémon search.",
  });
}

export function buildGroups(stores: DropStore[], zip: string | null, limit: number): DropRetailerGroup[] {
  return RETAILERS.map((retailer) => {
    const matched = stores
      .filter((store) => store.retailer === retailer.id)
      .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name));
    return {
      id: retailer.id,
      label: retailer.label,
      stores: matched.slice(0, limit),
      totalInRadius: matched.length,
      loaded: true,
      finderUrl: finderUrl(retailer.id, zip),
      stockUrl: productSearch(retailer.id),
    };
  });
}
