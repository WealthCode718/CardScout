import { blankPriceCharting, PRICECHARTING_COPY } from "@/lib/prices/copy";
import { roundMoney } from "@/lib/prices/money";
import type { CatalogCard } from "@/lib/prices/pokemontcg-provider";
import type { GradePrice, PriceChartingSource } from "@/lib/types";

const PRODUCT_URL = "https://www.pricecharting.com/api/product";

/**
 * PriceCharting prices are pennies. For cards, the guide maps the old video-game
 * columns onto grades. See https://www.pricecharting.com/api-documentation
 */
const GRADE_FIELDS: { key: string; label: string }[] = [
  { key: "manual-only-price", label: "PSA 10" },
  { key: "bgs-10-price", label: "BGS 10" },
  { key: "condition-17-price", label: "CGC 10" },
  { key: "condition-18-price", label: "SGC 10" },
  { key: "box-only-price", label: "Grade 9.5" },
  { key: "graded-price", label: "Grade 9" },
  { key: "new-price", label: "Grade 8" },
  { key: "cib-price", label: "Grade 7" },
  { key: "loose-price", label: "Ungraded" },
];

interface PriceChartingProduct {
  status?: string;
  "error-message"?: string;
  id?: string;
  "product-name"?: string;
  "console-name"?: string;
  genre?: string;
  [key: string]: unknown;
}

interface CacheEntry {
  expires: number;
  source: PriceChartingSource;
}

const cache = new Map<string, CacheEntry>();
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
let authError: string | null = null;

export function priceChartingConfigured(): boolean {
  return Boolean(process.env.PRICECHARTING_TOKEN?.trim());
}

function token(): string {
  return process.env.PRICECHARTING_TOKEN?.trim() ?? "";
}

function searchQuery(card: CatalogCard): string {
  const number = card.numberLabel.split("/")[0] ?? "";
  return `${card.name} ${card.setName} #${number} pokemon`.replace(/\s+/g, " ").trim();
}

function productUrl(query: string): string {
  const url = new URL("https://www.pricecharting.com/search-products");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "prices");
  return url.toString();
}

function pennies(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return roundMoney(amount / 100);
}

function looksLikeThisCard(product: PriceChartingProduct, card: CatalogCard): boolean {
  const productName = String(product["product-name"] ?? "").toLowerCase();
  const consoleName = String(product["console-name"] ?? "").toLowerCase();
  const genre = String(product.genre ?? "").toLowerCase();
  const pokemon =
    consoleName.includes("pokemon") ||
    consoleName.includes("pokémon") ||
    genre.includes("pokemon") ||
    genre.includes("pokémon");
  if (!pokemon || !productName) return false;
  const tokens = card.name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.every((part) => productName.includes(part))) return false;
  const setName = card.setName.toLowerCase();
  const setWords = setName === "base" ? ["base"] : setName.split(/\s+/).filter((word) => word.length > 2 || /\d/.test(word));
  if (setWords.length > 0 && !setWords.every((word) => consoleName.includes(word) || productName.includes(word))) return false;
  const number = card.numberLabel.split("/")[0]?.toLowerCase() ?? "";
  const tagged = productName.match(/#\s*([a-z0-9]+)/i);
  if (tagged?.[1] && number && tagged[1].toLowerCase() !== number) return false;
  return true;
}

function gradesFrom(product: PriceChartingProduct): GradePrice[] {
  const grades: GradePrice[] = [];
  for (const field of GRADE_FIELDS) {
    const price = pennies(product[field.key]);
    if (price == null) continue;
    grades.push({ label: field.label, price });
  }
  return grades;
}

async function pace<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchProduct(query: string): Promise<PriceChartingProduct> {
  const url = new URL(PRODUCT_URL);
  url.searchParams.set("t", token());
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  let body: PriceChartingProduct = {};
  try {
    body = (await response.json()) as PriceChartingProduct;
  } catch {
    body = {};
  }
  if (response.status === 401 || response.status === 403) {
    authError = "PriceCharting did not accept PRICECHARTING_TOKEN. Check the token on your subscription page.";
    throw new Error(authError);
  }
  if (!response.ok || body.status === "error") {
    const message = body["error-message"] || `PriceCharting returned ${response.status}.`;
    throw new Error(String(message));
  }
  return body;
}

export async function loadPriceCharting(card: CatalogCard): Promise<PriceChartingSource> {
  if (!priceChartingConfigured()) {
    return blankPriceCharting(
      "unconfigured",
      "Add PRICECHARTING_TOKEN from a PriceCharting subscription to load slab prices.",
    );
  }
  if (authError) return blankPriceCharting("unavailable", authError);

  const query = searchQuery(card);
  const cached = cache.get(query);
  if (cached && cached.expires > Date.now()) return cached.source;

  try {
    const product = await pace(() => fetchProduct(query));
    if (!looksLikeThisCard(product, card)) {
      const source = blankPriceCharting(
        "live",
        "PriceCharting answered, but the closest row was a different product. No grade prices shown.",
      );
      source.url = productUrl(query);
      cache.set(query, { expires: Date.now() + 30 * 60 * 1000, source });
      return source;
    }
    const grades = gradesFrom(product);
    const slabs = grades.filter((grade) => grade.label !== "Ungraded");
    const source: PriceChartingSource = {
      id: "pricecharting",
      ...PRICECHARTING_COPY,
      status: "live",
      statusNote:
        slabs.length > 0
          ? "Graded prices from PriceCharting."
          : "No slab grades on this row. Ungraded is the raw PriceCharting figure.",
      grades,
      url: productUrl(query),
      updatedAt: new Date().toISOString(),
    };
    cache.set(query, { expires: Date.now() + 6 * 60 * 60 * 1000, source });
    return source;
  } catch (error) {
    const message = error instanceof Error ? error.message : "PriceCharting did not answer.";
    return blankPriceCharting("unavailable", message);
  }
}
