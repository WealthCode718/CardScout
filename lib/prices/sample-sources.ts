import { EBAY_SOLD_COPY, EBAY_SOLD_WINDOW, PRICECHARTING_COPY, TCGPLAYER_COPY } from "@/lib/prices/copy";
import type { SampleCard } from "@/lib/prices/demo-data";
import { practiceMoney } from "@/lib/prices/money";
import type { CardSources, GradePrice, SoldComp } from "@/lib/types";

const PRACTICE = "Practice data. For learning the screen, not for buying or trading.";

function mix(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function gradesFor(market: number, sway: number): GradePrice[] {
  const rows = [
    { label: "PSA 10", price: practiceMoney(market * (5.6 + sway * 1.4)) },
    { label: "BGS 10", price: practiceMoney(market * (6.4 + sway * 1.6)) },
    { label: "Grade 9.5", price: practiceMoney(market * (2.8 + sway * 0.6)) },
    { label: "PSA 9", price: practiceMoney(market * (1.7 + sway * 0.3)) },
    { label: "Grade 8", price: practiceMoney(market * (1.15 + sway * 0.1)) },
  ];
  return rows.filter((row) => row.price >= 1);
}

function compsFor(card: SampleCard, raw: number, graded: number): SoldComp[] {
  const number = card.numberLabel.split("/")[0] ?? card.numberLabel;
  return [
    {
      title: `${card.name} ${card.setName} #${number} raw`,
      price: practiceMoney(raw * 0.96),
      url: null,
      soldAt: null,
    },
    {
      title: `${card.name} ${card.setName} #${number} near mint`,
      price: practiceMoney(raw * 1.05),
      url: null,
      soldAt: null,
    },
    {
      title: `${card.name} PSA 10 ${card.setName}`,
      price: graded,
      url: null,
      soldAt: null,
    },
  ];
}

/** Three-source practice panel. Ratios are made up so the layout matches live mode. */
export function sampleSources(card: SampleCard): CardSources {
  const sway = mix(card.id);
  const grades = gradesFor(card.marketPrice, sway);
  const graded = grades.find((grade) => grade.label === "PSA 10")?.price ?? practiceMoney(card.marketPrice * 5);
  const rawMedian = practiceMoney(card.marketPrice * (0.9 + sway * 0.1));
  const saleCount = 8 + Math.floor(sway * 9);
  const gradedCount = 3;
  const rawCount = saleCount - gradedCount;

  return {
    tcgplayer: {
      id: "tcgplayer",
      ...TCGPLAYER_COPY,
      status: "sample",
      statusNote: PRACTICE,
      marketPrice: card.marketPrice,
      lowPrice: card.lowPrice,
      finishLabel: "English raw",
      url: null,
      updatedAt: null,
    },
    pricecharting: {
      id: "pricecharting",
      ...PRICECHARTING_COPY,
      status: "sample",
      statusNote: PRACTICE,
      grades,
      url: null,
      updatedAt: null,
    },
    ebaySold: {
      id: "ebay-sold",
      ...EBAY_SOLD_COPY,
      status: "sample",
      statusNote: PRACTICE,
      medianPrice: rawMedian,
      saleCount,
      windowLabel: EBAY_SOLD_WINDOW,
      rawMedian,
      rawCount,
      gradedMedian: graded,
      gradedCount,
      searchUrl: null,
      comps: compsFor(card, rawMedian, graded),
      updatedAt: null,
    },
  };
}
