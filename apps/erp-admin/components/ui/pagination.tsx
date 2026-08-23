import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PAGE_SIZE = 20

function buildUrl(params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== 'page') sp.set(k, v)
  }
  sp.set('page', String(page))
  return `?${sp.toString()}`
}

export function pageNumber(value: string | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function Pagination({
  page,
  totalPages,
  total,
  params = {},
}: {
  page: number
  totalPages: number
  total?: number
  params?: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  const pages: (number | '…')[] = []
  const window = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= window) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
      <p className="text-xs text-slate-500">
        {total !== undefined ? `${total} élément${total > 1 ? 's' : ''} — ` : ''}Page {page} sur {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={buildUrl(params, page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50',
            page <= 1 && 'pointer-events-none opacity-40',
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Précédent
        </Link>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-1 text-xs text-slate-400">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildUrl(params, p)}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium',
                p === page
                  ? 'bg-brand-800 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={buildUrl(params, page + 1)}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : undefined}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50',
            page >= totalPages && 'pointer-events-none opacity-40',
          )}
        >
          Suivant <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}