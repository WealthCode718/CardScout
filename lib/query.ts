import type { DealSort, TabId } from "@/lib/types";
import { TABS } from "@/lib/types";

export interface ScoutQuery {
  tab: TabId;
  name: string;
  set: string;
  sort: DealSort;
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

export function buildHref(query: Partial<ScoutQuery> & { tab: TabId }): string {
  const params = new URLSearchParams();
  if (query.tab !== "deals") params.set("tab", query.tab);
  const name = query.name?.trim();
  const setName = query.set?.trim();
  if (name) params.set("name", name.slice(0, 80));
  if (setName && setName !== "All") params.set("set", setName.slice(0, 80));
  if (query.sort === "savings") params.set("sort", "savings");
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
