"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildHref } from "@/lib/query";
import type { DealSort, TabId } from "@/lib/types";

const SUGGESTIONS = ["Charizard", "Pikachu", "Umbreon", "Mew", "Gardevoir", "Eevee", "Iono"];

export function SearchControls(props: {
  tab: TabId;
  name: string;
  setName: string;
  sort: DealSort;
  sets: string[];
}) {
  return <SearchForm key={`${props.tab}|${props.name}|${props.setName}|${props.sort}`} {...props} />;
}

function SearchForm({
  tab,
  name,
  setName,
  sort,
  sets,
}: {
  tab: TabId;
  name: string;
  setName: string;
  sort: DealSort;
  sets: string[];
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [draftSet, setDraftSet] = useState(setName);
  const [pending, startTransition] = useTransition();

  function go(next: { name?: string; set?: string; sort?: DealSort }) {
    const href = buildHref({
      tab,
      name: next.name ?? draftName,
      set: next.set === undefined ? (tab === "values" ? draftSet : setName) : next.set,
      sort: next.sort ?? sort,
    });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  const filtersActive = Boolean(name || setName);

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        go({});
      }}
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Card name</span>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder={tab === "deals" ? "Filter by name" : "Card name, like Charizard"}
            maxLength={80}
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl bg-panel px-4 text-base text-paper ring-1 ring-white/10 outline-none placeholder:text-faint focus:ring-brass"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-2xl bg-lime px-4 text-sm font-semibold text-ink disabled:opacity-70"
        >
          {pending ? "Looking…" : "Search"}
        </button>
      </div>

      {tab === "values" ? (
        <label className="block">
          <span className="sr-only">Set</span>
          <input
            value={draftSet}
            onChange={(event) => setDraftSet(event.target.value)}
            placeholder="Set, optional — 151, Prismatic Evolutions"
            maxLength={80}
            className="h-12 w-full rounded-2xl bg-panel px-4 text-base text-paper ring-1 ring-white/10 outline-none placeholder:text-faint focus:ring-brass"
          />
        </label>
      ) : null}

      {tab === "deals" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="grid h-10 grid-cols-2 rounded-full bg-panel p-1 text-xs font-semibold">
            <button
              type="button"
              aria-pressed={sort === "discount"}
              onClick={() => go({ sort: "discount" })}
              className={`rounded-full px-3 ${sort === "discount" ? "bg-paper text-ink" : "text-muted"}`}
            >
              Best %
            </button>
            <button
              type="button"
              aria-pressed={sort === "savings"}
              onClick={() => go({ sort: "savings" })}
              className={`rounded-full px-3 ${sort === "savings" ? "bg-paper text-ink" : "text-muted"}`}
            >
              Most saved
            </button>
          </div>
          {filtersActive ? (
            <button type="button" onClick={() => go({ name: "", set: "" })} className="text-xs font-semibold text-brass">
              Clear
            </button>
          ) : (
            <p className="text-xs text-faint">{sort === "savings" ? "Biggest dollar gap" : "Biggest percent off"}</p>
          )}
        </div>
      ) : null}

      {tab === "deals" && sets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <SetChip label="All sets" active={!setName} onClick={() => go({ set: "" })} />
          {sets.map((set) => (
            <SetChip
              key={set}
              label={set}
              active={setName === set}
              onClick={() => go({ set: setName === set ? "" : set })}
            />
          ))}
        </div>
      ) : null}

      {tab === "values" ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <SetChip
              key={suggestion}
              label={suggestion}
              active={name.toLowerCase() === suggestion.toLowerCase() && !setName}
              onClick={() => go({ name: suggestion, set: "" })}
            />
          ))}
          {filtersActive ? <SetChip label="Clear" active={false} onClick={() => go({ name: "", set: "" })} /> : null}
        </div>
      ) : null}
    </form>
  );
}

function SetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full px-3 text-[13px] font-medium ${
        active ? "bg-brass text-ink" : "bg-panel text-muted ring-1 ring-white/10"
      }`}
    >
      {label}
    </button>
  );
}
