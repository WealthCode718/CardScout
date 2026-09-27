export function SourceNote({
  title,
  detail,
  tone = "calm",
}: {
  title: string;
  detail?: string;
  tone?: "calm" | "warn";
}) {
  const toneClass =
    tone === "warn" ? "border-coral/40 bg-coral/10 text-paper" : "border-brass/25 bg-brass/10 text-paper";
  return (
    <aside className={`rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <p className="text-[13px] leading-relaxed">{title}</p>
      {detail ? <p className="mt-1 text-[12px] leading-relaxed text-muted">{detail}</p> : null}
    </aside>
  );
}
