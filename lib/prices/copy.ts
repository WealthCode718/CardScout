import type { EbaySoldSource, PriceChartingSource, SourceStatus, TcgplayerSource } from "@/lib/types";

export const TCGPLAYER_COPY = {
  name: "TCGPlayer Market Price",
  role: "Best for a raw (ungraded) English single.",
  caveat: "It averages recent sales, so a sudden spike can take a while to show up.",
} as const;

export const PRICECHARTING_COPY = {
  name: "PriceCharting",
  role: "Best for graded slabs (PSA, BGS) and a quick overall look.",
  caveat: "One odd or phantom sale can pull a grade away from the real number.",
} as const;

export const EBAY_SOLD_COPY = {
  name: "eBay Sold & Completed",
  role: "Best for what buyers actually paid, raw or graded.",
  caveat: "A single auction can jump when people bid against each other.",
} as const;

export const EBAY_SOLD_WINDOW = "Last 90 days";

export function blankTcgplayer(status: SourceStatus, statusNote: string): TcgplayerSource {
  return {
    id: "tcgplayer",
    ...TCGPLAYER_COPY,
    status,
    statusNote,
    marketPrice: null,
    lowPrice: null,
    finishLabel: null,
    url: null,
    updatedAt: null,
  };
}

export function blankPriceCharting(status: SourceStatus, statusNote: string): PriceChartingSource {
  return {
    id: "pricecharting",
    ...PRICECHARTING_COPY,
    status,
    statusNote,
    grades: [],
    url: null,
    updatedAt: null,
  };
}

export function blankEbaySold(status: SourceStatus, statusNote: string): EbaySoldSource {
  return {
    id: "ebay-sold",
    ...EBAY_SOLD_COPY,
    status,
    statusNote,
    medianPrice: null,
    saleCount: 0,
    windowLabel: EBAY_SOLD_WINDOW,
    rawMedian: null,
    rawCount: 0,
    gradedMedian: null,
    gradedCount: 0,
    searchUrl: null,
    comps: [],
    updatedAt: null,
  };
}
