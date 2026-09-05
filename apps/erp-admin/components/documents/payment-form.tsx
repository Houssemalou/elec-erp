'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Banknote } from 'lucide-react'
import { Button, Input, Select, Label } from '@/components/ui'
import { money } from '@/lib/utils'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export function PaymentForm({
  invoiceId,
  remaining,
  action,
}: {
  invoiceId: string
  remaining: number
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <form
      className="space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        fd.set('invoiceId', invoiceId)
        setError(undefined)
        startActionLoader()
        startTransition(async () => {
          try {
            const res = await action(fd)
            if (!res.success) {
              setError(res.error ?? 'Erreur')
              return
            }
            e.currentTarget.reset()
            router.refresh()
          } finally {
            stopActionLoader()
          }
        })
      }}
    >
      {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Banknote className="h-4 w-4 text-emerald-400" />
        Reste à payer : <span className="font-semibold text-white">{money(remaining)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Montant (DT)</Label>
          <Input type="number" step="0.001" min="0" name="amount" required placeholder="0.000" />
        </div>
        <div>
          <Label>Mode de paiement</Label>
          <Select name="method" defaultValue="CASH">
            <option value="CASH">Espèces</option>
            <option value="CARD">Carte</option>
            <option value="BANK_TRANSFER">Virement</option>
            <option value="CHEQUE">Chèque</option>
            <option value="EDAHABIA">E-dinar / E-dahabia</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <Input type="date" name="receivedAt" />
        </div>
        <div>
          <Label>Référence</Label>
          <Input name="reference" placeholder="N° de chèque, virement…" />
        </div>
      </div>
      <div>
        <Label>Note</Label>
        <Input name="note" placeholder="Note interne…" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Encaisser le paiement
      </Button>
    </form>
  )
}
