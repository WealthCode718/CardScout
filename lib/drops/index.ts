import { DEFAULT_ZIP, parseRadius, parseZip } from "@/lib/query";
import type { DropStore, DropsResponse, RetailerId } from "@/lib/types";
import {
  STOCK_NOTE,
  buildGroups,
  buildStore,
  classifyRetailer,
  formatPlaceLabel,
  isExcludedShop,
} from "@/lib/drops/links";

const USER_AGENT = "CardScout/0.1 (Pokemon TCG retail finder; +https://github.com/WealthCode718/CardScout)";
const STORE_LIMIT = 8;
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;

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

function emptyGroups(zip: string | null) {
  return buildGroups([], zip, STORE_LIMIT);
}

function response(input: {
  zip: string;
  radiusMiles: number;
  placeLabel: string | null;
  status: DropsResponse["status"];
  sourceNote: string;
  groups?: DropsResponse["groups"];
}): DropsResponse {
  return {
    zip: input.zip,
    radiusMiles: input.radiusMiles,
    placeLabel: input.placeLabel,
    status: input.status,
    sourceNote: input.sourceNote,
    stockNote: STOCK_NOTE,
    groups: input.groups ?? emptyGroups(input.status === "invalid-zip" ? null : input.zip),
  };
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
    const point = await geocodeNominatim(zip);
    if (point) return point;
  } catch {
    // Nominatim can rate-limit. Zippopotam is the backup for US ZIP centroids.
  }
  try {
    return await geocodeZippopotam(zip);
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

async function queryOverpass(lat: number, lon: number, radiusMiles: number): Promise<OverpassElement[]> {
  const meters = Math.round(radiusMiles * 1609.344);
  const around = `around:${meters},${lat.toFixed(6)},${lon.toFixed(6)}`;
  const query = `[out:json][timeout:18];
(
  nwr["brand:wikidata"~"Q1046951|Q483551|Q202210"](${around});
  nwr["brand"="Target"]["shop"](${around});
  nwr["brand"="Walmart"]["shop"](${around});
  nwr["brand"="GameStop"]["shop"](${around});
);
out center tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastError: unknown;
  for (const [index, endpoint] of endpoints.entries()) {
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
        index === 0 ? 12000 : 8000,
      );
      if (!isRecord(payload) || !Array.isArray(payload.elements)) throw new Error("Unexpected Overpass payload");
      return payload.elements.filter(isRecord) as OverpassElement[];
    } catch (error) {
      lastError = error;
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (timedOut) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass failed");
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

  try {
    const elements = await queryOverpass(origin.lat, origin.lon, radiusMiles);
    const groups = buildGroups(storesFromElements(elements, origin, zip, radiusMiles), zip, STORE_LIMIT);
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
      SUCCESS_TTL_MS,
    );
  } catch {
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
