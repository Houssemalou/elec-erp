'use client'

import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

export function PrintToolbar() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="print-toolbar sticky top-0 z-10 mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card print:hidden">
      <p className="text-sm text-slate-500">Aperçu avant impression — document A4</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <X className="h-4 w-4" /> Fermer
        </button>
      </div>
    </div>
  )
}