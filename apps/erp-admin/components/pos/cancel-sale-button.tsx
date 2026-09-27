'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

/**
 * Annulation d'une vente en caisse : le BL, la facture liée, le chiffre
 * d'affaires et le stock sont intégralement restitués côté serveur.
 */
export function CancelSaleButton({
  id,
  action,
  hasInvoice,
}: {
  id: string
  action: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>
  hasInvoice: boolean
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(id, reason || undefined)
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
      <Button variant="danger" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" /> Annuler la vente
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-white">Annuler la vente en caisse</h3>
            <p className="mt-1 text-xs text-white/50">
              Le bon de livraison{hasInvoice ? ' et la facture liée' : ''} seront annulés : le chiffre
              d&apos;affaires est retiré et le stock de chaque article est réintégré.
            </p>
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-4">
              <Label>Motif (optionnel)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: retour client, erreur de saisie…" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Retour
              </Button>
              <Button type="button" variant="danger" onClick={run} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Annulation…' : 'Confirmer l&apos;annulation'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
