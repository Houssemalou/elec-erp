'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PenLine } from 'lucide-react'
import { Button, Input, Select, Label } from '@/components/ui'
import { money } from '@/lib/utils'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export function InvoicePaymentStatusForm({
  invoiceId,
  totalTTC,
  paidAmount,
  action,
}: {
  invoiceId: string
  totalTTC: number
  paidAmount: number
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(paidAmount.toFixed(3))
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
            router.refresh()
          } finally {
            stopActionLoader()
          }
        })
      }}
    >
      {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
      <div className="flex items-center gap-2 text-sm text-white/60">
        <PenLine className="h-4 w-4 text-accent-400" />
        Total TTC : <span className="font-semibold text-white">{money(totalTTC)}</span> · Déjà encaissé : <span className="font-semibold text-white">{money(paidAmount)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Montant payé TTC (DT)</Label>
          <Input type="number" step="0.001" min="0" max={totalTTC.toFixed(3)} name="paidAmount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label>Reste à payer</Label>
          <Input disabled value={money(Math.max(0, totalTTC - Number(amount || 0)))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="md" onClick={() => setAmount('0.000')}>Non payé</Button>
        <Button type="button" variant="outline" size="md" onClick={() => setAmount((totalTTC / 2).toFixed(3))}>Partiel</Button>
        <Button type="button" variant="outline" size="md" onClick={() => setAmount(totalTTC.toFixed(3))}>Totalement payé</Button>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Mettre à jour le statut / montant payé
      </Button>
    </form>
  )
}
