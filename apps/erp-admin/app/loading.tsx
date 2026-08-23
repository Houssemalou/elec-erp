import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-950">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-accent-500/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-500 shadow-lifted">
          <Loader2 className="h-7 w-7 animate-spin text-brand-950" />
        </div>
      </div>
      <p className="font-display text-sm font-semibold text-brand-200">Chargement…</p>
    </div>
  )
}