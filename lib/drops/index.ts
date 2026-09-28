import { DEFAULT_ZIP, parseRadius, parseZip } from "@/lib/query";
import type { DropStore, DropsResponse, RetailerId } from "@/lib/types";
import {
  buildDropsResponse,
  buildGroups,
  buildStore,
  classifyRetailer,
  formatPlaceLabel,
  isExcludedShop,
} from "@/lib/drops/links";

const USER_AGENT = "CardScout/0.1 (Pokemon TCG retail finder; +https://github.com/WealthCode718/CardScout)";
const RETAILER_WIKIDATA: Record<RetailerId, string> = {
  target: "Q1046951",
  walmart: "Q483551",
  gamestop: "Q202210",
};
const RETAILER_ORDER: RetailerId[] = ["target", "walmart", "gamestop"];
const STORE_LIMIT = 8;
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;

interface GeoPoint {
  lat: number;
  lon: number;
  placeLabel: string | null;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

const cache = new Map<string, { expires: number; body: DropsResponse }>();

function remember(key: string, body: DropsResponse, ttlMs: number): DropsResponse {
  if (cache.size >= 40) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + ttlMs, body });
  return body;
}

function response(input: {
  zip: string;
  radiusMiles: number;
  placeLabel: string | null;
  status: DropsResponse["status"];
  sourceNote: string;
  groups?: DropsResponse["groups"];
}): DropsResponse {
  return buildDropsResponse({
    ...input,
    groups: input.groups ?? buildGroups([], input.status === "invalid-zip" ? null : input.zip, STORE_LIMIT),
  });
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const result = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!result.ok) throw new Error(`HTTP ${result.status}`);
  return result.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function geocodeNominatim(zip: string): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("postalcode", zip);
  url.searchParams.set("country", "United States");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  const payload = await fetchJson(
    url.toString(),
    { headers: { Accept: "application/json", "Accept-Language": "en", "User-Agent": USER_AGENT } },
    5000,
  );
  if (!Array.isArray(payload) || !isRecord(payload[0])) return null;
  const hit = payload[0];
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = isRecord(hit.address) ? hit.address : {};
  return {
    lat,
    lon,
    placeLabel: formatPlaceLabel({
      suburb: typeof address.suburb === "string" ? address.suburb : undefined,
      borough: typeof address.borough === "string" ? address.borough : undefined,
      city: typeof address.city === "string" ? address.city : undefined,
      town: typeof address.town === "string" ? address.town : undefined,
      village: typeof address.village === "string" ? address.village : undefined,
      state: typeof address.state === "string" ? address.state : undefined,
    }),
  };
}

async function geocodeZippopotam(zip: string): Promise<GeoPoint | null> {
  const payload = await fetchJson(`https://api.zippopotam.us/us/${zip}`, { headers: { Accept: "application/json" } }, 5000);
  if (!isRecord(payload) || !Array.isArray(payload.places) || !isRecord(payload.places[0])) return null;
  const place = payload.places[0];
  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const city = typeof place["place name"] === "string" ? place["place name"] : "";
  const state = typeof place["state abbreviation"] === "string" ? place["state abbreviation"] : "";
  return { lat, lon, placeLabel: city && state ? `${city}, ${state}` : city || state || null };
}

async function geocodeZip(zip: string): Promise<GeoPoint | null> {
  try {
    const point = await geocodeZippopotam(zip);
    if (point) return point;
  } catch {
    // Zippopotam is a small US ZIP centroid service. Nominatim is the backup.
  }
  try {
    return await geocodeNominatim(zip);
  } catch {
    return null;
  }
}

function elementPoint(element: OverpassElement): { lat: number; lon: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function canRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError") return true;
  return /^HTTP (429|5\d\d)$/.test(error.message);
}

async function queryRetailer(
  lat: number,
  lon: number,
  radiusMiles: number,
  wikidata: string,
): Promise<OverpassElement[] | null> {
  const meters = Math.round(radiusMiles * 1609.344);
  const around = `around:${meters},${lat.toFixed(6)},${lon.toFixed(6)}`;
  // One chain per request. A combined query is more likely to time out on the public Overpass server.
  const query = `[out:json][timeout:12];(nwr["brand:wikidata"="${wikidata}"](${around}););out center tags;`;
  const endpoint = "https://overpass-api.de/api/interpreter";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const payload = await fetchJson(
        endpoint,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": USER_AGENT,
          },
          body: new URLSearchParams({ data: query }),
        },
        12000,
      );
      if (!isRecord(payload) || !Array.isArray(payload.elements)) return null;
      return payload.elements.filter(isRecord) as OverpassElement[];
    } catch (error) {
      if (!canRetry(error) || attempt === 1) return null;
    }
  }
  return null;
}

function stringTags(tags: Record<string, string> | undefined): Record<string, string> | null {
  if (!tags) return null;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === "string") clean[key] = value;
  }
  return clean;
}

function storesFromElements(elements: OverpassElement[], origin: GeoPoint, zip: string, radiusMiles: number): DropStore[] {
  const seen = new Set<string>();
  const stores: DropStore[] = [];
  for (const element of elements) {
    const tags = stringTags(element.tags);
    if (!tags) continue;
    const retailer: RetailerId | null = classifyRetailer(tags);
    if (!retailer || isExcludedShop(tags)) continue;
    const point = elementPoint(element);
    if (!point || element.type == null || element.id == null) continue;
    const store = buildStore({
      id: `${element.type}/${element.id}`,
      retailer,
      tags,
      lat: point.lat,
      lon: point.lon,
      originLat: origin.lat,
      originLon: origin.lon,
      zip,
    });
    if (store.distanceMiles > radiusMiles + 0.05) continue;
    const dedupe = store.hasStorePage
      ? `${retailer}:${store.storePageUrl}`
      : `${retailer}:${point.lat.toFixed(3)}:${point.lon.toFixed(3)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    stores.push(store);
  }
  return stores;
}

async function loadDrops(zip: string, radiusMiles: number): Promise<DropsResponse> {
  const key = `${zip}:${radiusMiles}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.body;

  const origin = await geocodeZip(zip);
  if (!origin) {
    return remember(
      key,
      response({
        zip,
        radiusMiles,
        placeLabel: null,
        status: "not-found",
        sourceNote: "That ZIP could not be located. The links below open each retailer’s own search.",
      }),
      FAILURE_TTL_MS,
    );
  }

  const stores: DropStore[] = [];
  const failed = new Set<RetailerId>();
  for (const retailer of RETAILER_ORDER) {
    const elements = await queryRetailer(origin.lat, origin.lon, radiusMiles, RETAILER_WIKIDATA[retailer]);
    if (!elements) {
      failed.add(retailer);
      continue;
    }
    stores.push(...storesFromElements(elements, origin, zip, radiusMiles));
  }

  if (failed.size === RETAILER_ORDER.length) {
    return remember(
      key,
      response({
        zip,
        radiusMiles,
        placeLabel: origin.placeLabel,
        status: "unavailable",
        sourceNote: "Nearby stores did not load. The links below open each retailer’s store finder and Pokémon search.",
      }),
      FAILURE_TTL_MS,
    );
  }

  const groups = buildGroups(stores, zip, STORE_LIMIT).map((group) =>
    failed.has(group.id) ? { ...group, stores: [], totalInRadius: 0, loaded: false } : group,
  );
  return remember(
    key,
    response({
      zip,
      radiusMiles,
      placeLabel: origin.placeLabel,
      status: "results",
      sourceNote: "Store locations come from OpenStreetMap contributors. This is not live aisle inventory.",
      groups,
    }),
    failed.size === 0 ? SUCCESS_TTL_MS : 2 * 60 * 1000,
  );
}

export async function getDropsResponse(input?: { zip?: string; radius?: string }): Promise<DropsResponse> {
  const rawZip = (input?.zip ?? "").trim().slice(0, 10);
  const radiusMiles = parseRadius(input?.radius ?? "");
  if (!rawZip) return loadDrops(DEFAULT_ZIP, radiusMiles);
  const zip = parseZip(rawZip);
  if (!zip) {
    return response({
      zip: rawZip,
      radiusMiles,
      placeLabel: null,
      status: "invalid-zip",
      sourceNote: `Enter a 5-digit US ZIP code, like ${DEFAULT_ZIP}.`,
    });
  }
  return loadDrops(zip, radiusMiles);
}
