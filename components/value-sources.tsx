import type { ReactNode } from "react";
import { formatPriceDate, formatUsd } from "@/lib/format";
import type { CardSources, EbaySoldSource, GradePrice, PriceChartingSource, SourceStatus, TcgplayerSource } from "@/lib/types";

const STATUS_LABEL: Record<SourceStatus, string> = {
  live: "Live",
  sample: "Practice",
  unconfigured: "Not configured",
  unavailable: "Didn't load",
};

function statusClass(status: SourceStatus): string {
  if (status === "live") return "bg-lime/15 text-lime";
  if (status === "sample") return "bg-brass/15 text-brass";
  if (status === "unavailable") return "bg-coral/15 text-coral";
  return "bg-white/5 text-faint";
}

function SourceShell({
  name,
  role,
  caveat,
  status,
  statusNote,
  children,
}: {
  name: string;
  role: string;
  caveat: string;
  status: SourceStatus;
  statusNote: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-[#12151c] px-3 py-2.5 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-paper">{name}</h4>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusClass(status)}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-brass">{role}</p>
      {children}
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{caveat}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-faint">{statusNote}</p>
    </section>
  );
}

function saleLabel(count: number, noun: string): string {
  return `${count} ${noun} ${count === 1 ? "sale" : "sales"}`;
}

function GradeList({ grades }: { grades: GradePrice[] }) {
  if (grades.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
      {grades.map((grade) => (
        <div key={grade.label} className="flex items-baseline justify-between gap-2">
          <dt className="text-[12px] text-muted">{grade.label}</dt>
          <dd className="text-[13px] font-semibold text-paper tabular-nums">{formatUsd(grade.price)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TcgplayerBlock({ source }: { source: TcgplayerSource }) {
  const dated = formatPriceDate(source.updatedAt);
  return (
    <SourceShell {...source}>
      {source.marketPrice != null ? (
        <p className="mt-2 text-xl font-semibold text-paper tabular-nums">{formatUsd(source.marketPrice)}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No market price in this box.</p>
      )}
      <p className="text-[12px] text-muted">
        {source.finishLabel ?? "English raw"}
        {source.lowPrice != null ? ` · low list ${formatUsd(source.lowPrice)}` : ""}
        {dated ? ` · ${dated}` : ""}
      </p>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-[12px] font-semibold text-brass">
          See it on TCGPlayer
        </a>
      ) : null}
    </SourceShell>
  );
}

function PriceChartingBlock({ source }: { source: PriceChartingSource }) {
  return (
    <SourceShell {...source}>
      <GradeList grades={source.grades} />
      {source.grades.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {source.status === "unconfigured"
            ? "Not configured. Graded prices stay blank until a PriceCharting token is added."
            : "No grade prices in this box."}
        </p>
      ) : null}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-[12px] font-semibold text-brass">
          Price history on PriceCharting
        </a>
      ) : null}
    </SourceShell>
  );
}

function EbayBlock({ source }: { source: EbaySoldSource }) {
  const split = source.rawCount > 0 || source.gradedCount > 0;
  return (
    <SourceShell {...source}>
      {source.medianPrice != null ? (
        <p className="mt-2 text-xl font-semibold text-paper tabular-nums">{formatUsd(source.medianPrice)}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No sold median in this box.</p>
      )}
      <p className="text-[12px] text-muted">
        {source.saleCount > 0 ? `${saleLabel(source.saleCount, "matched")} · ` : ""}
        {source.windowLabel}
      </p>
      {split ? (
        <p className="text-[12px] text-muted tabular-nums">
          {source.rawMedian != null ? `Raw ${formatUsd(source.rawMedian)} (${source.rawCount})` : `Raw sales: ${source.rawCount}`}
          {" · "}
          {source.gradedMedian != null
            ? `Graded ${formatUsd(source.gradedMedian)} (${source.gradedCount})`
            : `Graded sales: ${source.gradedCount}`}
        </p>
      ) : null}
      {source.comps.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {source.comps.map((comp) => {
            const dated = formatPriceDate(comp.soldAt);
            const line = `${formatUsd(comp.price)} · ${comp.title}${dated ? ` · ${dated}` : ""}`;
            return (
              <li key={`${comp.title}-${comp.price}`} className="text-[12px] leading-snug text-paper">
                {comp.url ? (
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-brass">
                    {line}
                  </a>
                ) : (
                  line
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {source.searchUrl ? (
        <a
          href={source.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex text-[12px] font-semibold text-brass"
        >
          Sold listings on eBay
        </a>
      ) : null}
    </SourceShell>
  );
}

export function ValueSources({ sources }: { sources: CardSources }) {
  return (
    <div className="space-y-2">
      <TcgplayerBlock source={sources.tcgplayer} />
      <PriceChartingBlock source={sources.pricecharting} />
      <EbayBlock source={sources.ebaySold} />
    </div>
  );
}
