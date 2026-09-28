"use client";

import { useEffect, useState } from "react";
import { DropsPanel } from "@/components/drops-panel";
import { offlineDrops } from "@/lib/drops/links";
import { DEFAULT_ZIP } from "@/lib/query";
import type { DropsResponse } from "@/lib/types";

export function DropsResults({ zip, radius }: { zip: string; radius: number }) {
  const [drops, setDrops] = useState<DropsResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (zip) params.set("zip", zip);
    params.set("radius", String(radius));

    fetch(`/api/drops?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body: unknown = await response.json();
        if (!isDropsResponse(body)) throw new Error("Unexpected drops payload");
        return body;
      })
      .then((body) => {
        setDrops(body);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setPhase("error");
      });

    return () => controller.abort();
  }, [zip, radius]);

  if (phase === "error") return <DropsPanel drops={offlineDrops(zip, radius)} />;
  if (phase === "loading" || !drops) return <DropsLoading zip={zip || DEFAULT_ZIP} radius={radius} />;
  return <DropsPanel drops={drops} />;
}

function DropsLoading({ zip, radius }: { zip: string; radius: number }) {
  return (
    <section aria-labelledby="drops-heading" aria-busy="true" className="space-y-3">
      <div>
        <h2 id="drops-heading" className="font-display text-[1.65rem] leading-none text-paper">
          Nearby drops
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Looking up Target, Walmart, and GameStop near {zip}.
        </p>
      </div>
      <div className="rounded-2xl bg-panel px-4 py-6 ring-1 ring-white/5">
        <p className="text-sm leading-relaxed text-muted">Within {radius} miles. The map search can take a little while.</p>
      </div>
    </section>
  );
}

function isDropsResponse(value: unknown): value is DropsResponse {
  if (typeof value !== "object" || value === null) return false;
  const body = value as DropsResponse;
  return typeof body.zip === "string" && typeof body.sourceNote === "string" && Array.isArray(body.groups);
}