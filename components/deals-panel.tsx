import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { SourceNote } from "@/components/source-note";
import { formatPriceDate, formatUsd } from "@/lib/format";
import { buildHref } from "@/lib/query";
import type { DealResponse } from "@/lib/types";

export function DealsPanel({ deals }: { deals: DealResponse }) {
  const pricedOn = deals.deals.find((deal) => deal.updatedAt)?.updatedAt ?? null;
  return (
    <section aria-labelledby="deals-heading" className="space-y-3">
      <div>
        <h2 id="deals-heading" className="font-display text-[1.65rem] leading-none text-paper">
          Under market
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {deals.fallback
            ? "Asking price compared with a sample market price."
            : deals.provider.live
              ? "Lowest known price compared with the Scrydex Near Mint market for a raw English copy."
              : "Deals stay empty until a Scrydex plan is connected."}{" "}
          {deals.deals.length === 0 ? "Nothing matched." : `${deals.deals.length} ${deals.deals.length === 1 ? "card" : "cards"}.`}
        </p>
      </div>

      <SourceNote
        tone={deals.fallback || !deals.provider.live ? "warn" : "calm"}
        title={
          deals.fallback
            ? "Live prices did not load. These are practice numbers until the live call works."
            : deals.provider.disclaimer
        }
        detail={deals.fallback ? deals.fallbackReason : formatPriceDate(pricedOn) ? `Market figures dated ${formatPriceDate(pricedOn)}.` : undefined}
      />

      {deals.deals.length === 0 ? (
        <div className="rounded-2xl bg-panel px-4 py-8 text-center">
          <p className="font-medium text-paper">{deals.provider.live || deals.fallback ? "No deals in this search" : "Scrydex is not configured"}</p>
          <p className="mt-1 text-sm text-muted">
            {deals.provider.live || deals.fallback
              ? "Try another set, or clear the name filter."
              : "Add SCRYDEX_API_KEY and SCRYDEX_TEAM_ID. No market prices are invented."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {deals.deals.map((deal) => (
            <li key={deal.id}>
              <article className="flex gap-3 rounded-2xl bg-panel p-3 ring-1 ring-white/5">
                <CardThumb
                  src={deal.imageUrl}
                  alt={`${deal.name} from ${deal.setName}, number ${deal.numberLabel}`}
                  className="h-[104px] w-[74px] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] leading-tight font-semibold text-paper">{deal.name}</h3>
                    <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-ink">
                      −{deal.discountPercent}%
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-muted">
                    {deal.setName} · #{deal.numberLabel}
                  </p>
                  <p className="text-[12px] text-faint">
                    {deal.rarity} · {deal.condition}
                  </p>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xl font-semibold text-paper tabular-nums">{formatUsd(deal.listingPrice)}</span>
                    <span className="text-[12px] text-faint line-through tabular-nums">{formatUsd(deal.marketPrice)}</span>
                    <span className="text-[12px] text-faint">{deal.marketLabel}</span>
                    <span className="text-[12px] font-medium text-lime">Save {formatUsd(deal.savings)}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {deal.seller} · {deal.marketplace}
                  </p>
                  {deal.listingUrl ? (
                    <a
                      href={deal.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex h-9 items-center text-[13px] font-semibold text-brass"
                    >
                      Open listing
                    </a>
                  ) : (
                    <Link
                      href={buildHref({ tab: "values", name: deal.name, set: deal.setName })}
                      className="mt-2 inline-flex h-9 items-center text-[13px] font-semibold text-brass"
                    >
                      Check value
                    </Link>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
