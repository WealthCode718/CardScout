/** Positive when the ask is below the market baseline. */
export function underMarket(
  market: number,
  listing: number,
): { discountPercent: number; savings: number } | null {
  if (!Number.isFinite(market) || !Number.isFinite(listing)) return null;
  if (market <= 0 || listing <= 0 || listing >= market) return null;
  const savings = Math.round((market - listing) * 100) / 100;
  const discountPercent = Math.round(((market - listing) / market) * 100);
  if (discountPercent < 1 || savings <= 0) return null;
  return { discountPercent, savings };
}

export function matchesText(haystack: string, needle: string | undefined): boolean {
  const query = needle?.trim().toLowerCase() ?? "";
  if (!query) return true;
  return haystack.toLowerCase().includes(query);
}
