import { CURATED_NEWS } from "@/lib/news/curated";
import { fetchLiveNews } from "@/lib/news/rss";
import type { NewsResponse } from "@/lib/types";

let cache: { expires: number; body: NewsResponse } | null = null;

export async function getNewsResponse(): Promise<NewsResponse> {
  if (cache && cache.expires > Date.now()) return cache.body;
  try {
    const items = await fetchLiveNews();
    const body: NewsResponse = {
      live: true,
      sourceNote: "Headlines from PokéBeach, a long-running Pokémon TCG news site. CardScout does not write these stories.",
      items,
    };
    cache = { expires: Date.now() + 30 * 60 * 1000, body };
    return body;
  } catch {
    return {
      live: false,
      sourceNote:
        "The live feed did not load. These are saved PokéBeach headlines from September 27, 2026, so the list is not empty. Open a story to read it on PokéBeach.",
      items: CURATED_NEWS,
    };
  }
}
