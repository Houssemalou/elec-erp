'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from './index'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export function ActionButton({
  action,
  label,
  variant = 'secondary',
  confirm,
  confirmTitle = "Confirmer l'action",
  disabled = false,
}: {
  action: () => Promise<{ success: boolean; error?: string }>
  label: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  confirm?: string
  confirmTitle?: string
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })
  }

  const handleClick = () => {
    if (confirm) {
      setShowConfirm(true)
      return
    }
    run()
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button variant={variant} onClick={handleClick} disabled={pending || disabled}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? 'En cours…' : label}
        </Button>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-white">{confirmTitle}</h3>
                {confirm ? <p className="mt-0.5 text-sm text-white/60">{confirm}</p> : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowConfirm(false)} disabled={pending}>
                Annuler
              </Button>
              <Button
                type="button"
                variant={variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  setShowConfirm(false)
                  run()
                }}
                disabled={pending}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'En cours…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}