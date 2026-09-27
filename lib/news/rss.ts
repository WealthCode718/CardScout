import type { NewsItem } from "@/lib/types";

const FEEDS: { url: string; source: string }[] = [
  {
    url: "https://kaprestridge.github.io/pokebeach-news-feed/feed.xml",
    source: "PokéBeach",
  },
  {
    url: "https://www.pokebeach.com/forums/forum/-/index.rss",
    source: "PokéBeach",
  },
];

function decode(input: string): string {
  const withoutCdata = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "");
  return withoutCdata
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decode(match[1] ?? "") : "";
}

function pickLink(xml: string): string {
  const text = pick(xml, "link");
  if (text.startsWith("http")) return text;
  const href = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return href?.[1] ?? "";
}

export function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const chunks = xml.split(/<item\b[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const body = chunk.split(/<\/item>/i)[0] ?? "";
    const title = pick(body, "title");
    const url = pickLink(body);
    const publishedRaw = pick(body, "pubDate") || pick(body, "dc:date");
    const published = new Date(publishedRaw);
    if (!title || !url.startsWith("http") || Number.isNaN(published.getTime())) continue;
    items.push({
      id: url,
      title,
      url,
      source,
      publishedAt: published.toISOString(),
    });
  }
  return items;
}

export async function fetchLiveNews(): Promise<NewsItem[]> {
  const errors: string[] = [];
  for (const feed of FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": "CardScout/0.1 (family card price scout)",
        },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok) {
        errors.push(`${feed.source} ${response.status}`);
        continue;
      }
      const items = parseRss(await response.text(), feed.source);
      if (items.length === 0) {
        errors.push(`${feed.source} empty`);
        continue;
      }
      const unique = new Map<string, NewsItem>();
      for (const item of items) unique.set(item.url, item);
      return [...unique.values()]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 20);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "feed failed");
    }
  }
  throw new Error(errors.join("; ") || "No news feed responded.");
}
