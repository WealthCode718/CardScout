import type { DealSort, TabId } from "@/lib/types";
import { TABS } from "@/lib/types";

export const DEFAULT_ZIP = "11230";
export const DEFAULT_RADIUS_MILES = 15;
export const RADIUS_CHOICES = [5, 10, 15, 25, 40] as const;
export const MAX_RADIUS_MILES = 40;

export interface ScoutQuery {
  tab: TabId;
  name: string;
  set: string;
  sort: DealSort;
  zip: string;
  radius: number;
}

export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseTab(value: string): TabId {
  return TABS.includes(value as TabId) ? (value as TabId) : "deals";
}

export function parseSort(value: string): DealSort {
  return value === "savings" ? "savings" : "discount";
}

/** US ZIP or ZIP+4. Returns the 5-digit form, or "" when the text is not a ZIP. */
export function parseZip(value: string): string {
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] ?? "";
}

export function parseRadius(value: string): number {
  if (!value.trim()) return DEFAULT_RADIUS_MILES;
  const radius = Number(value);
  if (!Number.isInteger(radius) || radius < 1 || radius > MAX_RADIUS_MILES) return DEFAULT_RADIUS_MILES;
  return radius;
}

export function buildHref(query: Partial<ScoutQuery> & { tab: TabId }): string {
  const params = new URLSearchParams();
  if (query.tab !== "deals") params.set("tab", query.tab);
  const name = query.name?.trim();
  const setName = query.set?.trim();
  if (name) params.set("name", name.slice(0, 80));
  if (setName && setName !== "All") params.set("set", setName.slice(0, 80));
  if (query.sort === "savings") params.set("sort", "savings");
  const zip = query.zip?.trim();
  if (zip && zip !== DEFAULT_ZIP) params.set("zip", zip.slice(0, 10));
  if (query.radius && query.radius !== DEFAULT_RADIUS_MILES) params.set("radius", String(query.radius));
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

export function sortDeals<T extends { discountPercent: number; savings: number; name: string }>(
  deals: T[],
  sort: DealSort,
): T[] {
  return [...deals].sort((a, b) => {
    if (sort === "savings") {
      return b.savings - a.savings || b.discountPercent - a.discountPercent || a.name.localeCompare(b.name);
    }
    return b.discountPercent - a.discountPercent || b.savings - a.savings || a.name.localeCompare(b.name);
  });
}
