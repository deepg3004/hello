/** Closing call-to-action band — charcoal with the brand purple glow. */
export function LandingCTA({ name }: { name: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 px-6 py-16 text-center shadow-card-lg ring-1 ring-white/10 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[hsl(262_83%_58%)]/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-[hsl(262_83%_58%)]/20 blur-3xl"
        />
        <h2 className="relative mx-auto max-w-2xl text-balance font-sora text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Start selling on {name} today
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-balance text-white/70">
          Create your first payment or landing page in minutes.
        </p>
      </div>
    </section>
  );
}
