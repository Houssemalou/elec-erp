export default function Loading() {
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-950">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="space-y-5">
            <div className="h-7 w-64 animate-pulse rounded-full bg-white/10" />
            <div className="h-12 w-full max-w-md animate-pulse rounded-xl bg-white/10" />
            <div className="h-12 w-3/4 animate-pulse rounded-xl bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/10" />
            <div className="flex gap-3 pt-3">
              <div className="h-11 w-40 animate-pulse rounded-xl bg-accent-500/40" />
              <div className="h-11 w-40 animate-pulse rounded-xl bg-white/10" />
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 md:grid">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-32 animate-pulse rounded-2xl bg-white/5 ${i % 2 === 1 ? 'mt-8' : ''}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-brand-100" />
          <div className="h-9 w-36 animate-pulse rounded-xl bg-brand-100" />
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
              <div className="aspect-square animate-pulse bg-brand-50" />
              <div className="space-y-2.5 p-4">
                <div className="h-4 w-4/5 animate-pulse rounded bg-brand-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-brand-100" />
                <div className="h-9 w-full animate-pulse rounded-lg bg-brand-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}