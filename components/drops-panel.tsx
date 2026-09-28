import { SourceNote } from "@/components/source-note";
import { formatMiles } from "@/lib/format";
import type { DropRetailerGroup, DropStore, DropsResponse } from "@/lib/types";

export function DropsPanel({ drops }: { drops: DropsResponse }) {
  const place = drops.placeLabel ? `${drops.placeLabel} · ZIP ${drops.zip}` : `ZIP ${drops.zip}`;
  return (
    <section aria-labelledby="drops-heading" className="space-y-3">
      <div>
        <h2 id="drops-heading" className="font-display text-[1.65rem] leading-none text-paper">
          Nearby drops
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Target, Walmart, and GameStop that may carry sealed Pokémon cards.
        </p>
        {drops.status !== "invalid-zip" ? (
          <p className="mt-2 text-[12px] font-semibold tracking-wide text-brass uppercase">{place}</p>
        ) : null}
      </div>

      <SourceNote
        tone={drops.status === "results" ? "calm" : "warn"}
        title={drops.sourceNote}
        detail={drops.stockNote}
      />

      <div className="space-y-5">
        {drops.groups.map((group) => (
          <RetailerGroup key={group.id} group={group} drops={drops} />
        ))}
      </div>

      {drops.status === "results" ? (
        <p className="text-[11px] leading-relaxed text-faint">
          Map data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/20 underline-offset-2"
          >
            OpenStreetMap
          </a>{" "}
          contributors.
        </p>
      ) : null}
    </section>
  );
}

function RetailerGroup({ group, drops }: { group: DropRetailerGroup; drops: DropsResponse }) {
  return (
    <section aria-labelledby={`drops-${group.id}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 id={`drops-${group.id}`} className="font-display text-[1.35rem] leading-none text-paper">
          {group.label}
        </h3>
        <p className="text-right text-[12px] text-faint">{summary(group, drops)}</p>
      </div>
      {group.stores.length === 0 ? (
        <EmptyRetailer group={group} drops={drops} />
      ) : (
        <ul className="space-y-2.5">
          {group.stores.map((store) => (
            <li key={store.id}>
              <StoreRow store={store} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function summary(group: DropRetailerGroup, drops: DropsResponse): string {
  if (!group.loaded || drops.status === "invalid-zip" || drops.status !== "results") {
    return drops.status === "invalid-zip" ? "Check the ZIP" : "Links only";
  }
  if (group.totalInRadius === 0) return `None within ${drops.radiusMiles} mi`;
  if (group.totalInRadius > group.stores.length) return `${group.stores.length} closest of ${group.totalInRadius}`;
  return `${group.totalInRadius} ${group.totalInRadius === 1 ? "store" : "stores"}`;
}

function EmptyRetailer({ group, drops }: { group: DropRetailerGroup; drops: DropsResponse }) {
  const message = !group.loaded
    ? `${group.label} locations did not load for this ZIP.`
    : drops.status === "invalid-zip"
      ? `Search ${group.label} after you enter a ZIP.`
      : drops.status !== "results"
        ? `${group.label} locations did not load for this ZIP.`
        : `No ${group.label} stores within ${drops.radiusMiles} miles of ${drops.zip}.`;
  return (
    <div className="rounded-2xl bg-panel px-4 py-5 ring-1 ring-white/5">
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StoreLink href={group.finderUrl} tone="quiet">
          Find stores
        </StoreLink>
        <StoreLink href={group.stockUrl} tone="lime">
          Check stock
        </StoreLink>
      </div>
    </div>
  );
}

function StoreRow({ store }: { store: DropStore }) {
  return (
    <article className="rounded-2xl bg-panel p-4 ring-1 ring-white/5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[15px] leading-tight font-semibold text-paper">{store.name}</h4>
        <p className="shrink-0 text-[12px] font-semibold text-brass tabular-nums">{formatMiles(store.distanceMiles)}</p>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-muted">{store.address || "Address not listed"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StoreLink href={store.directionsUrl} tone="quiet" label={`Directions to ${store.name}`}>
          Directions
        </StoreLink>
        <StoreLink
          href={store.storePageUrl}
          tone="quiet"
          label={store.hasStorePage ? `${store.name} store page` : `Find ${store.name}`}
        >
          {store.hasStorePage ? "Store page" : "Find store"}
        </StoreLink>
      </div>
      <StoreLink href={store.stockUrl} tone="lime" label={`Check Pokémon TCG at ${store.name}`} className="mt-2 w-full">
        Check Pokémon stock
      </StoreLink>
    </article>
  );
}

function StoreLink({
  href,
  children,
  tone,
  label,
  className = "",
}: {
  href: string;
  children: string;
  tone: "quiet" | "lime";
  label?: string;
  className?: string;
}) {
  const toneClass =
    tone === "lime"
      ? "bg-lime text-ink"
      : "bg-panel-2 text-paper ring-1 ring-white/10";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ?? children}
      className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-3 text-center text-[13px] font-semibold ${toneClass} ${className}`}
    >
      {children}
    </a>
  );
}
