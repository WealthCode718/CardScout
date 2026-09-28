import { blankPriceCharting, PRICECHARTING_COPY } from "@/lib/prices/copy";
import { roundMoney } from "@/lib/prices/money";
import { serverGet } from "@/lib/prices/server-fetch";
import type { CatalogCard } from "@/lib/prices/catalog";
import type { GradePrice, PriceChartingSource } from "@/lib/types";

const PRODUCT_URL = "https://www.pricecharting.com/api/product";
const PRODUCTS_URL = "https://www.pricecharting.com/api/products";

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

function setWords(setName: string): string[] {
  const set = setName.toLowerCase();
  if (set === "base") return ["base"];
  return set.split(/\s+/).filter((word) => word.length > 2 || /\d/.test(word));
}

/** Higher is a closer English printing. Negative means reject. */
function rankProduct(product: PriceChartingProduct, card: CatalogCard): number {
  const productName = String(product["product-name"] ?? "").toLowerCase();
  const consoleName = String(product["console-name"] ?? "").toLowerCase();
  const genre = String(product.genre ?? "").toLowerCase();
  const pokemon =
    consoleName.includes("pokemon") ||
    consoleName.includes("pokémon") ||
    genre.includes("pokemon") ||
    genre.includes("pokémon");
  if (!pokemon || !productName) return -1;
  if (/\b(japanese|chinese|korean)\b/.test(consoleName)) return -1;
  const tokens = card.name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.every((part) => productName.includes(part))) return -1;
  const words = setWords(card.setName);
  if (words.length > 0 && !words.every((word) => consoleName.includes(word) || productName.includes(word))) return -1;
  const number = card.numberLabel.split("/")[0]?.toLowerCase() ?? "";
  const tagged = productName.match(/#\s*([a-z0-9]+)/i);
  if (tagged?.[1] && number && tagged[1].toLowerCase() !== number) return -1;

  let score = 1;
  if (words.every((word) => consoleName.includes(word))) score += 5;
  if (tagged?.[1] && number && tagged[1].toLowerCase() === number) score += 4;
  const firstEdition = /1st edition|\[1st/.test(productName);
  const shadowless = productName.includes("shadowless");
  const wantsFirst = (card.finish ?? "").toLowerCase().includes("1st");
  if (wantsFirst) score += firstEdition ? 6 : -4;
  else score += firstEdition || shadowless ? -5 : 3;
  return score;
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

async function fetchJson(url: URL): Promise<PriceChartingProduct> {
  const response = await serverGet(url);
  let body: PriceChartingProduct = {};
  try {
    body = JSON.parse(response.text) as PriceChartingProduct;
  } catch {
    body = {};
  }
  if (response.status === 401 || response.status === 403) {
    authError = "PriceCharting did not accept PRICECHARTING_TOKEN. Check the token on your subscription page.";
    throw new Error(authError);
  }
  if (response.status < 200 || response.status >= 300 || body.status === "error") {
    const message = body["error-message"] || `PriceCharting returned ${response.status}.`;
    throw new Error(String(message));
  }
  return body;
}

async function fetchProductById(id: string): Promise<PriceChartingProduct> {
  const url = new URL(PRODUCT_URL);
  url.searchParams.set("t", token());
  url.searchParams.set("id", id);
  return pace(() => fetchJson(url));
}

async function fetchProductList(query: string): Promise<PriceChartingProduct[]> {
  const url = new URL(PRODUCTS_URL);
  url.searchParams.set("t", token());
  url.searchParams.set("q", query);
  const body = await pace(() => fetchJson(url));
  const products = body.products;
  return Array.isArray(products) ? (products as PriceChartingProduct[]) : [];
}

function pickProduct(products: PriceChartingProduct[], card: CatalogCard): PriceChartingProduct | null {
  let best: PriceChartingProduct | null = null;
  let bestScore = 0;
  for (const product of products) {
    const score = rankProduct(product, card);
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return best;
}

const HISTORY_NOTE = "PriceCharting's API sends current grades, not the history chart. Open the link for that chart.";

export async function loadPriceCharting(card: CatalogCard): Promise<PriceChartingSource> {
  const query = searchQuery(card);
  const historyUrl = productUrl(query);
  if (!priceChartingConfigured()) {
    const source = blankPriceCharting(
      "unconfigured",
      "Coming soon. Not configured until PRICECHARTING_TOKEN is set. No graded prices are invented.",
    );
    source.url = historyUrl;
    return source;
  }
  if (authError) {
    const source = blankPriceCharting("unavailable", authError);
    source.url = historyUrl;
    return source;
  }

  const cached = cache.get(query);
  if (cached && cached.expires > Date.now()) return cached.source;

  try {
    const list = await fetchProductList(query);
    const match = pickProduct(list, card);
    if (!match?.id) {
      const source = blankPriceCharting(
        "live",
        "PriceCharting answered, but no English row matched this printing. No grade prices shown.",
      );
      source.url = historyUrl;
      cache.set(query, { expires: Date.now() + 30 * 60 * 1000, source });
      return source;
    }
    const product = await fetchProductById(String(match.id));
    const grades = gradesFrom(product);
    if (grades.length === 0) {
      const source = blankPriceCharting(
        "unavailable",
        "PriceCharting found this printing, but this token did not include prices. Slab prices need a paid API token.",
      );
      source.url = historyUrl;
      cache.set(query, { expires: Date.now() + 30 * 60 * 1000, source });
      return source;
    }
    const slabs = grades.filter((grade) => grade.label !== "Ungraded");
    const source: PriceChartingSource = {
      id: "pricecharting",
      ...PRICECHARTING_COPY,
      status: "live",
      statusNote:
        slabs.length > 0
          ? `Current graded prices from PriceCharting. ${HISTORY_NOTE}`
          : `No slab grades on this row. Ungraded is the raw PriceCharting figure. ${HISTORY_NOTE}`,
      grades,
      url: historyUrl,
      updatedAt: new Date().toISOString(),
    };
    cache.set(query, { expires: Date.now() + 6 * 60 * 60 * 1000, source });
    return source;
  } catch (error) {
    const message = error instanceof Error ? error.message : "PriceCharting did not answer.";
    const source = blankPriceCharting("unavailable", message);
    source.url = historyUrl;
    return source;
  }
}
