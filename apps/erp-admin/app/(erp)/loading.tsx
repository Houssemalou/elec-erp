export default function Loading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-60 animate-pulse rounded-lg bg-brand-100" />
          <div className="h-3.5 w-40 animate-pulse rounded bg-brand-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-brand-100" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-brand-100" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-brand-50 bg-brand-50/60 p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-brand-100" />
            <div className="mt-3 h-6 w-24 animate-pulse rounded bg-brand-100" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-brand-100" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
          <div className="h-4 w-40 animate-pulse rounded bg-brand-100" />
          <div className="h-4 w-24 animate-pulse rounded bg-brand-100" />
          <div className="h-4 w-28 animate-pulse rounded bg-brand-100" />
          <div className="ml-auto h-6 w-20 animate-pulse rounded-full bg-brand-100" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-50 py-3.5">
            <div className="h-3 w-40 animate-pulse rounded bg-brand-50" />
            <div className="h-3 w-24 animate-pulse rounded bg-brand-50" />
            <div className="h-3 w-28 animate-pulse rounded bg-brand-50" />
            <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-brand-50" />
          </div>
        ))}
      </div>
    </div>
  )
}