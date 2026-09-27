import { blankEbaySold, EBAY_SOLD_COPY, EBAY_SOLD_WINDOW } from "@/lib/prices/copy";
import { EBAY_INSIGHTS_SCOPE, ebayAccessToken, ebayConfigured, ebayHost } from "@/lib/prices/ebay-auth";
import { serverGet } from "@/lib/prices/server-fetch";
import { median, roundMoney, trimOutliers } from "@/lib/prices/money";
import type { CatalogCard } from "@/lib/prices/catalog";
import { junkTitle, looksGraded, titleHasCardName, titleHasSet, titleNumberAgrees } from "@/lib/prices/titles";
import type { EbaySoldSource, GradePrice, SoldComp } from "@/lib/types";

/**
 * Sold comps use eBay Marketplace Insights (`item_sales/search`).
 *
 * Verified against the Browse API item_summary/search contract: that method
 * returns active listings only. Its buyingOptions filter selects Buy It Now,
 * auction, or best offer. It has no sold, completed, or soldItems filter, so
 * those asks are not shown as sales. Client ID and secret still come from an
 * eBay developer app (the same client-credentials pair used for Browse).
 * Marketplace Insights is limited release. If eBay has not approved this app,
 * the box says so instead of scraping ebay.com.
 *
 * CCG Individual Cards is category 183454.
 */
const CCG_SINGLES_CATEGORY = "183454";

interface EbayAmount {
  value?: string;
  currency?: string;
}

interface EbaySale {
  title?: string;
  itemWebUrl?: string;
  lastSoldPrice?: EbayAmount;
  lastSoldDate?: string;
}

interface CacheEntry {
  expires: number;
  source: EbaySoldSource;
}

const cache = new Map<string, CacheEntry>();
let blockedReason: string | null = null;

interface SoldHit {
  title: string;
  price: number;
  url: string | null;
  soldAt: string | null;
  graded: boolean;
}

function insightQuery(card: CatalogCard): string {
  const words = `${card.name} pokemon`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  return [...new Set(words)].slice(0, 8).join(",");
}

export function ebaySoldSearchUrl(card: Pick<CatalogCard, "name" | "setName" | "numberLabel">): string {
  const number = card.numberLabel.split("/")[0] ?? "";
  const url = new URL("https://www.ebay.com/sch/i.html");
  url.searchParams.set("_nkw", `pokemon ${card.name} ${card.setName} ${number}`.replace(/\s+/g, " ").trim());
  url.searchParams.set("_sacat", CCG_SINGLES_CATEGORY);
  url.searchParams.set("LH_Sold", "1");
  url.searchParams.set("LH_Complete", "1");
  url.searchParams.set("rt", "nc");
  return url.toString();
}

function toHit(sale: EbaySale, card: CatalogCard): SoldHit | null {
  const title = sale.title?.trim() ?? "";
  const price = Number(sale.lastSoldPrice?.value);
  if (!title || junkTitle(title) || sale.lastSoldPrice?.currency !== "USD" || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (!titleHasCardName(title, card.name) || !titleNumberAgrees(title, card.numberLabel)) return null;
  if (/\b(japanese|korean|chinese|jp)\b/i.test(title)) return null;
  const soldAt = sale.lastSoldDate ? new Date(sale.lastSoldDate) : null;
  return {
    title,
    price: roundMoney(price),
    url: sale.itemWebUrl ?? null,
    soldAt: soldAt && !Number.isNaN(soldAt.getTime()) ? soldAt.toISOString() : null,
    graded: looksGraded(title),
  };
}

function closest(hits: SoldHit[], target: number | null, count: number): SoldComp[] {
  const ordered =
    target == null
      ? hits
      : [...hits].sort((a, b) => Math.abs(a.price - target) - Math.abs(b.price - target));
  const seen = new Set<string>();
  const comps: SoldComp[] = [];
  for (const hit of ordered) {
    const key = `${hit.title}|${hit.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    comps.push({ title: hit.title, price: hit.price, url: hit.url, soldAt: hit.soldAt });
    if (comps.length >= count) break;
  }
  return comps;
}

const GRADE_ORDER = ["PSA 10", "BGS 10", "CGC 10", "PSA 9", "BGS 9.5", "CGC 9.5", "BGS 9", "CGC 9"];

function gradeLabel(title: string): string | null {
  const match = title.match(/\b(psa|bgs|cgc)\s*([0-9](?:\.[0-9])?)\b/i);
  if (!match?.[1] || !match[2]) return null;
  return `${match[1].toUpperCase()} ${match[2]}`;
}

function titleGrades(hits: SoldHit[]): GradePrice[] {
  const groups = new Map<string, number[]>();
  for (const hit of hits) {
    const label = gradeLabel(hit.title);
    if (!label) continue;
    const prices = groups.get(label) ?? [];
    prices.push(hit.price);
    groups.set(label, prices);
  }
  const grades: GradePrice[] = [];
  for (const [label, prices] of groups) {
    const price = median(prices);
    if (price == null) continue;
    grades.push({ label, price, detail: `${prices.length} sold ${prices.length === 1 ? "title" : "titles"}` });
  }
  return grades.sort((a, b) => {
    const aIndex = GRADE_ORDER.indexOf(a.label);
    const bIndex = GRADE_ORDER.indexOf(b.label);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function summarize(card: CatalogCard, hits: SoldHit[]): EbaySoldSource {
  const preferred = hits.filter((hit) => titleHasSet(hit.title, card.setName));
  const used = preferred.length >= 3 ? preferred : hits;
  const prices = trimOutliers(used.map((hit) => hit.price));
  const priceSet = new Set(prices);
  const kept = used.filter((hit) => priceSet.has(hit.price));
  const raw = kept.filter((hit) => !hit.graded);
  const graded = kept.filter((hit) => hit.graded);
  const rawPrices = raw.map((hit) => hit.price);
  const gradedPrices = graded.map((hit) => hit.price);
  const rawMedian = median(rawPrices);
  const gradedMedian = median(gradedPrices);
  const headline = median(prices) ?? rawMedian ?? gradedMedian;
  const setNote =
    preferred.length >= 3
      ? "Matched the card name and set."
      : "Matched the card name. Some titles did not mention the set.";
  const emptyNote = "No sold listings matched this printing in the last 90 days.";

  return {
    id: "ebay-sold",
    ...EBAY_SOLD_COPY,
    status: "live",
    statusNote: kept.length === 0 ? emptyNote : `${setNote} Median of sold prices.`,
    medianPrice: headline,
    saleCount: kept.length,
    windowLabel: EBAY_SOLD_WINDOW,
    rawMedian,
    rawCount: raw.length,
    gradedMedian,
    gradedCount: graded.length,
    searchUrl: ebaySoldSearchUrl(card),
    comps: closest(kept, headline, 3),
    updatedAt: new Date().toISOString(),
    titleGrades: titleGrades(kept),
  };
}

async function searchSold(card: CatalogCard, token: string): Promise<EbaySale[]> {
  const url = new URL(`${ebayHost()}/buy/marketplace_insights/v1_beta/item_sales/search`);
  url.searchParams.set("q", insightQuery(card));
  url.searchParams.set("category_ids", CCG_SINGLES_CATEGORY);
  url.searchParams.set("limit", "50");
  url.searchParams.set("filter", "priceCurrency:USD");
  const response = await serverGet(url, {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    Accept: "application/json",
  });
  if (response.status === 401 || response.status === 403) {
    blockedReason =
      "eBay sold search needs Marketplace Insights access on this app. Asking prices stay off this box.";
    throw new Error(blockedReason);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`eBay sold search failed (${response.status}).`);
  }
  const body = JSON.parse(response.text) as { itemSales?: EbaySale[] };
  return body.itemSales ?? [];
}

export async function loadEbaySold(card: CatalogCard): Promise<EbaySoldSource> {
  if (!ebayConfigured()) {
    return blankEbaySold(
      "unconfigured",
      "eBay sold: not connected yet. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET from developer.ebay.com after the app is approved. No sold prices are invented.",
    );
  }
  if (blockedReason) return blankEbaySold("unavailable", blockedReason);

  const cacheKey = card.id;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.source;

  try {
    const token = await ebayAccessToken(EBAY_INSIGHTS_SCOPE);
    const sales = await searchSold(card, token);
    const hits = sales.map((sale) => toHit(sale, card)).filter((hit): hit is SoldHit => Boolean(hit));
    const source = summarize(card, hits);
    cache.set(cacheKey, { expires: Date.now() + 15 * 60 * 1000, source });
    return source;
  } catch (error) {
    const message = error instanceof Error ? error.message : "eBay sold search did not answer.";
    return blankEbaySold("unavailable", message);
  }
}
