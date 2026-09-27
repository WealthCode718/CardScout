import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { SourceNote } from "@/components/source-note";
import { formatPriceDate, formatUsd } from "@/lib/format";
import { buildHref } from "@/lib/query";
import type { ValueResponse } from "@/lib/types";

export function ValuesPanel({ values }: { values: ValueResponse }) {
  const heading = values.mode === "featured" ? "Popular lookups" : "Estimated values";
  const intro =
    values.mode === "featured"
      ? "Tap a name above, or search. The same Pokémon can be worth very different amounts in different sets."
      : values.cards.length === 0
        ? "Nothing matched that name and set."
        : "Highest estimated value first. Compare the set and the number before you trade.";

  return (
    <section aria-labelledby="values-heading" className="space-y-3">
      <div>
        <h2 id="values-heading" className="font-display text-[1.65rem] leading-none text-paper">
          {heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>
      </div>

      <SourceNote
        tone={values.fallback ? "warn" : "calm"}
        title={values.fallback ? "Live prices did not load, so these are sample estimates." : values.provider.disclaimer}
        detail={values.fallback ? values.fallbackReason : undefined}
      />

      {values.cards.length === 0 ? (
        <div className="rounded-2xl bg-panel px-4 py-8 text-center">
          <p className="font-medium text-paper">No card found</p>
          <p className="mt-1 text-sm text-muted">Try a shorter name, like Pikachu, or leave the set blank.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {values.cards.map((card) => {
            const priced = formatPriceDate(card.updatedAt);
            return (
              <li key={card.id}>
                <article className="flex gap-3 rounded-2xl bg-panel p-3 ring-1 ring-white/5">
                  <CardThumb
                    src={card.imageUrl}
                    alt={`${card.name} from ${card.setName}, number ${card.numberLabel}`}
                    className="h-[120px] w-[86px] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] leading-tight font-semibold text-paper">{card.name}</h3>
                    <p className="mt-1 text-[12px] leading-snug text-muted">
                      {card.setName} · #{card.numberLabel}
                    </p>
                    <p className="text-[12px] text-faint">{card.rarity}</p>
                    <p className="mt-2 text-[11px] tracking-wide text-faint uppercase">Market estimate</p>
                    <p className="text-2xl font-semibold text-paper tabular-nums">
                      {card.marketPrice == null ? "No price yet" : formatUsd(card.marketPrice)}
                    </p>
                    {card.lowPrice != null && card.highPrice != null ? (
                      <p className="text-[12px] text-muted tabular-nums">
                        Seen from {formatUsd(card.lowPrice)} to {formatUsd(card.highPrice)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-faint">
                      {card.priceSource}
                      {priced ? ` · ${priced}` : ""}
                    </p>
                    <Link
                      href={buildHref({ tab: "deals", name: card.name, set: card.setName })}
                      className="mt-2 inline-flex h-9 items-center text-[13px] font-semibold text-brass"
                    >
                      Deals for this printing
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
