import Link from "next/link";
import { DealsPanel } from "@/components/deals-panel";
import { NewsPanel } from "@/components/news-panel";
import { SearchControls } from "@/components/search-controls";
import { ValuesPanel } from "@/components/values-panel";
import { buildHref, type ScoutQuery } from "@/lib/query";
import type { DealResponse, NewsResponse, TabId, ValueResponse } from "@/lib/types";

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: "deals", label: "Deals" },
  { id: "values", label: "Values" },
  { id: "news", label: "News" },
];

export function ScoutApp({
  query,
  deals,
  values,
  news,
}: {
  query: ScoutQuery;
  deals: DealResponse | null;
  values: ValueResponse | null;
  news: NewsResponse | null;
}) {
  return (
    <>
      <a href="#scout-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-lime focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <header className="px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[2rem] leading-none tracking-tight text-paper">CardScout</p>
            <p className="mt-2 max-w-[18rem] text-sm leading-snug text-muted">Spot the deal before it goes in the binder.</p>
          </div>
          <p className="mt-1 shrink-0 rounded-full bg-brass/15 px-2.5 py-1 text-[11px] font-semibold text-brass ring-1 ring-brass/30">
            {query.tab === "news" ? "News" : deals?.provider.live || values?.provider.live ? "Live prices" : "Sample prices"}
          </p>
        </div>
      </header>
      <nav className="sticky top-0 z-20 bg-ink/95 px-4 py-3 backdrop-blur" aria-label="Sections">
        <div role="tablist" className="grid h-12 grid-cols-3 gap-1 rounded-2xl bg-panel p-1">
          {TAB_LABELS.map((tab) => {
            const selected = query.tab === tab.id;
            return (
              <Link
                key={tab.id}
                href={buildHref({ ...query, tab: tab.id })}
                scroll={false}
                prefetch={false}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                className={`flex items-center justify-center rounded-xl text-sm font-semibold ${
                  selected ? "bg-paper text-ink" : "text-muted"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main id="scout-main" className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {query.tab !== "news" ? (
          <SearchControls tab={query.tab} name={query.name} setName={query.set} sort={query.sort} sets={deals?.sets ?? []} />
        ) : (
          <div className="h-2" />
        )}
        <div id={`panel-${query.tab}`} role="tabpanel" aria-labelledby={`tab-${query.tab}`} className="mt-4">
          {query.tab === "deals" && deals ? <DealsPanel deals={deals} /> : null}
          {query.tab === "values" && values ? <ValuesPanel values={values} /> : null}
          {query.tab === "news" && news ? <NewsPanel news={news} /> : null}
        </div>
        <footer className="mt-8 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-faint">
          CardScout is a fan-made price scout for families. It is not affiliated with Nintendo, The Pokémon Company, TPCi,
          eBay, TCGPlayer, or PriceCharting. Card names and pictures are shown so you can tell printings apart. Sample
          mode is for practice, not for buying or selling.
        </footer>
      </main>
    </>
  );
}
