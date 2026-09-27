export function CardThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg bg-[#0e1218] ring-1 ring-white/10 ${className ?? ""}`}>
      {src ? (
        // Card art is served by the public Pokémon TCG image CDN. Native img keeps third-party hosts simple.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center px-1 text-center text-[10px] text-faint">No art</div>
      )}
    </div>
  );
}
