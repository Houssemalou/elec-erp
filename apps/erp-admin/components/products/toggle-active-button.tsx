'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Power, Loader2 } from 'lucide-react'

export function ToggleActiveButton({
  id,
  isActive,
  action,
}: {
  id: string
  isActive: boolean
  action: (id: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      title={isActive ? 'Désactiver' : 'Activer'}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action(id)
          router.refresh()
        })
      }
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
        isActive ? 'text-white/50 hover:bg-amber-500/10 hover:text-amber-400' : 'text-emerald-400 hover:bg-emerald-500/10'
      }`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
      {isActive ? 'Désactiver' : 'Activer'}
    </button>
  )
}
