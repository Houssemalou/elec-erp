'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from './index'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export function ActionButton({
  action,
  label,
  variant = 'secondary',
  confirm,
  disabled = false,
}: {
  action: () => Promise<{ success: boolean; error?: string }>
  label: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  confirm?: string
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const run = () => {
    if (confirm && !window.confirm(confirm)) return
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

  return (
    <div className="flex items-center gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button variant={variant} onClick={run} disabled={pending || disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'En cours…' : label}
      </Button>
    </div>
  )
}