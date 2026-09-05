'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from './index'

export interface DeleteActionResult {
  success: boolean
  error?: string
}

export function DeleteButton({
  id,
  action,
  label = 'Supprimer',
  message = 'Cette action est définitive et ne peut pas être annulée.',
  redirectTo,
}: {
  id: string
  action: (id: string) => Promise<DeleteActionResult>
  label?: string
  message?: string
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startTransition(async () => {
      const res = await action(id)
      if (!res.success) {
        setError(res.error ?? 'Erreur inconnue')
        return
      }
      setOpen(false)
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
      >
        <Trash2 className="h-3.5 w-3.5" /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-white">Confirmer la suppression</h3>
                <p className="text-xs text-white/50">{message}</p>
              </div>
            </div>
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="button" variant="danger" onClick={run} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {pending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
