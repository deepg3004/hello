/** Infinite auto-looping partner/brand-logo marquee. Pure CSS animation
 *  (pauses on hover). The list is duplicated so the loop is seamless. */
export function BrandLogoSlider({ logos, title = "Trusted by" }: { logos: string[]; title?: string }) {
  if (!logos.length) return null;
  const row = [...logos, ...logos];
  return (
    <section className="mt-14">
      {title && <h2 className="sf-display mb-5 text-center text-xl font-bold tracking-tight">{title}</h2>}
      <div className="overflow-hidden">
        <div className="sf-marquee flex items-center gap-12">
          {row.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt="Brand"
              className="h-10 w-auto max-w-[140px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
