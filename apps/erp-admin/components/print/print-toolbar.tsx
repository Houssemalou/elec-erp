'use client'

import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

export function PrintToolbar() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="print-toolbar sticky top-0 z-10 mb-6 flex items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#151515] px-4 py-3 shadow-card print:hidden">
      <p className="text-sm text-white/50">Aperçu avant impression — document A4</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-400 px-4 text-sm font-semibold text-[#0B0B0B] hover:bg-accent-300"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#2A2A2A] bg-transparent px-4 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" /> Fermer
        </button>
      </div>
    </div>
  )
}
