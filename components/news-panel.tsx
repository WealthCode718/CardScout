import { SourceNote } from "@/components/source-note";
import { formatNewsDate } from "@/lib/format";
import type { NewsResponse } from "@/lib/types";

export function NewsPanel({ news }: { news: NewsResponse }) {
  return (
    <section aria-labelledby="news-heading" className="space-y-3">
      <div>
        <h2 id="news-heading" className="font-display text-[1.65rem] leading-none text-paper">
          TCG news
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Recent Pokémon card stories. Each one opens on the publisher’s site.</p>
      </div>

      <SourceNote tone={news.live ? "calm" : "warn"} title={news.sourceNote} />

      {news.items.length === 0 ? (
        <div className="rounded-2xl bg-panel px-4 py-8 text-center">
          <p className="font-medium text-paper">No stories yet</p>
          <p className="mt-1 text-sm text-muted">Check back later. The feed may be taking a break.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {news.items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-panel p-4 ring-1 ring-white/5"
              >
                <p className="text-[11px] font-semibold tracking-wide text-brass uppercase">
                  {item.source}
                  <span className="px-1.5 text-faint">·</span>
                  <time dateTime={item.publishedAt}>{formatNewsDate(item.publishedAt)}</time>
                </p>
                <h3 className="mt-2 text-[16px] leading-snug font-semibold text-paper">{item.title}</h3>
                <p className="mt-3 text-[13px] font-semibold text-lime">Read article</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
