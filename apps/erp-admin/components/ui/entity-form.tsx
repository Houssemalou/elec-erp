'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from './index'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export interface EntityFormAction {
  (fd: FormData): Promise<{ success: boolean; error?: string; id?: string }>
}

export function EntityForm({
  action,
  children,
  submitLabel = 'Enregistrer',
  cancelHref,
}: {
  action: EntityFormAction
  children: React.ReactNode
  submitLabel?: string
  cancelHref?: string
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setError(undefined)
        startActionLoader()
        startTransition(async () => {
          try {
            const res = await action(fd)
            if (!res.success) {
              setError(res.error ?? 'Erreur inconnue')
              return
            }
            router.refresh()
          } finally {
            stopActionLoader()
          }
        })
      }}
      className="space-y-4"
    >
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {children}
      <div className="flex items-center justify-end gap-2 pt-2">
        {cancelHref ? (
          <Link href={cancelHref} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Annuler
          </Link>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? 'Enregistrement…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}