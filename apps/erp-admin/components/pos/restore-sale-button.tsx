'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

/**
 * Réactivation d'une vente en caisse annulée (« annuler l'annulation ») : le
 * BL, la facture liée et le stock reviennent à l'état validé, côté serveur.
 */
export function RestoreSaleButton({
  id,
  action,
  hasInvoice,
}: {
  id: string
  action: (id: string) => Promise<{ success: boolean; error?: string }>
  hasInvoice: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(id)
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        setOpen(false)
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" /> Réactiver la vente
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-white">Réactiver la vente en caisse</h3>
            <p className="mt-1 text-xs text-white/50">
              Le bon de livraison{hasInvoice ? ' et la facture liée' : ''} seront de nouveau validés : le chiffre
              d&apos;affaires est réintégré et le stock de chaque article est à nouveau déduit.
              {hasInvoice ? ' La vente est refusée si le stock disponible est insuffisant.' : ''}
            </p>
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Retour
              </Button>
              <Button type="button" onClick={run} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Réactivation…' : 'Confirmer la réactivation'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
