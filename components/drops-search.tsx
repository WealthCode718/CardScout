"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { RADIUS_CHOICES, buildHref, type ScoutQuery } from "@/lib/query";

export function DropsSearch({ query }: { query: ScoutQuery }) {
  return <DropsForm key={`${query.zip}|${query.radius}|${query.name}|${query.set}|${query.sort}`} query={query} />;
}

function DropsForm({ query }: { query: ScoutQuery }) {
  const router = useRouter();
  const [zip, setZip] = useState(query.zip);
  const [radius, setRadius] = useState(query.radius);
  const [pending, startTransition] = useTransition();
  const choices = RADIUS_CHOICES.includes(radius as (typeof RADIUS_CHOICES)[number])
    ? RADIUS_CHOICES
    : [...RADIUS_CHOICES, radius].sort((a, b) => a - b);

  function go(event: FormEvent) {
    event.preventDefault();
    const href = buildHref({
      tab: "drops",
      name: query.name,
      set: query.set,
      sort: query.sort,
      zip,
      radius,
    });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <form className="mt-4" onSubmit={go}>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">ZIP code</span>
          <input
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="ZIP code"
            maxLength={10}
            enterKeyHint="search"
            aria-invalid={Boolean(zip.trim()) && !/^\d{5}(?:-\d{4})?$/.test(zip.trim())}
            className="h-12 w-full rounded-2xl bg-panel px-4 text-base text-paper ring-1 ring-white/10 outline-none placeholder:text-faint focus:ring-brass"
          />
        </label>
        <label className="shrink-0">
          <span className="sr-only">Radius</span>
          <select
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="h-12 rounded-2xl bg-panel px-3 text-sm font-medium text-paper ring-1 ring-white/10 outline-none focus:ring-brass"
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice} mi
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-2xl bg-lime px-4 text-sm font-semibold text-ink disabled:opacity-70"
        >
          {pending ? "Looking…" : "Search"}
        </button>
      </div>
    </form>
  );
}
