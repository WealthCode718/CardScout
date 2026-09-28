"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="px-4 py-16">
      <p className="text-xs font-semibold tracking-[0.16em] text-brass uppercase">CardScout</p>
      <h1 className="mt-3 font-display text-3xl text-paper">This screen did not load</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Something broke while fetching cards, news, or stores. Your collection is fine — try the screen again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-full bg-lime px-5 text-sm font-semibold text-ink"
      >
        Try again
      </button>
    </main>
  );
}
