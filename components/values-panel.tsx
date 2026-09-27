import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { SourceNote } from "@/components/source-note";
import { ValueSources } from "@/components/value-sources";
import { formatUsd } from "@/lib/format";
import { buildHref } from "@/lib/query";
import type { ValueResponse } from "@/lib/types";

export function ValuesPanel({ values }: { values: ValueResponse }) {
  const heading = values.mode === "featured" ? "Popular lookups" : "Card values";
  const intro =
    values.mode === "featured"
      ? "Tap a name above, or search. Each card has three price boxes: raw, graded, and what buyers paid."
      : values.cards.length === 0
        ? "Nothing matched that name and set."
        : "Highest raw market first. Read the set and the number before you trade.";

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
        title={
          values.fallback
            ? "Live prices did not load. These are practice numbers until the live call works."
            : values.provider.disclaimer
        }
        detail={values.fallback ? values.fallbackReason : undefined}
      />

      {values.matchCount > values.cards.length ? (
        <p className="text-sm leading-relaxed text-muted">
          Showing {values.cards.length} of {values.matchCount} printings.
          {values.limitNote ? ` ${values.limitNote}` : ""} Add a set name to narrow the list.
        </p>
      ) : null}

      {values.cards.length === 0 ? (
        <div className="rounded-2xl bg-panel px-4 py-8 text-center">
          <p className="font-medium text-paper">No card found</p>
          <p className="mt-1 text-sm text-muted">Try a shorter name, like Pikachu, or leave the set blank.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {values.cards.map((card) => (
            <li key={card.id}>
              <article className="rounded-2xl bg-panel p-3 ring-1 ring-white/5">
                <div className="flex gap-3">
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
                    <p className="mt-2 text-[11px] tracking-wide text-faint uppercase">Raw market</p>
                    <p className="text-2xl font-semibold text-paper tabular-nums">
                      {card.marketPrice == null ? "No price yet" : formatUsd(card.marketPrice)}
                    </p>
                    <Link
                      href={buildHref({ tab: "deals", name: card.name, set: card.setName })}
                      className="mt-1 inline-flex h-8 items-center text-[13px] font-semibold text-brass"
                    >
                      Deals for this printing
                    </Link>
                  </div>
                </div>
                <div className="mt-3">
                  <ValueSources sources={card.sources} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
