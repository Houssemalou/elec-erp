'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Lock } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import { money, dateInputValue } from '@/lib/utils'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export interface WeeklyClosingFormData {
  id: string
  weekStart: Date
  revenueTTC: string
  purchasesTTC: string
  expensesTTC: string
  otherExpensesTTC: string
  notes: string
}

/**
 * Saisie manuelle du bilan hebdomadaire, puis verrouillage.
 *
 * Les quatre montants sont saisis en TTC : le résultat est calculé ici, la base
 * ne le recalcule pas. La clôture est une action séparée pour ne pas verrouiller
 * une semaine par mégarde.
 */
export function WeeklyClosingForm({
  closing,
  action,
  closeAction,
  reopenAction,
}: {
  closing: WeeklyClosingFormData | null
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  closeAction: (id: string) => Promise<{ success: boolean; error?: string }>
  reopenAction: (id: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const [revenue, setRevenue] = useState(closing?.revenueTTC ?? '')
  const [purchases, setPurchases] = useState(closing?.purchasesTTC ?? '')
  const [expenses, setExpenses] = useState(closing?.expensesTTC ?? '')
  const [other, setOther] = useState(closing?.otherExpensesTTC ?? '')

  const num = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  const gain = useMemo(
    () => Math.round((num(revenue) - num(purchases) - num(expenses) - num(other)) * 1000) / 1000,
    [revenue, purchases, expenses, other],
  )

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await fn()
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
    <div className="space-y-5">
      {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          if (closing) fd.set('weekStart', dateInputValue(closing.weekStart))
          run(() => action(fd))
        }}
      >
        {closing ? <input type="hidden" name="weekStart" value={dateInputValue(closing.weekStart)} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="revenueTTC">Chiffre d&apos;affaires TTC *</Label>
            <Input
              id="revenueTTC"
              name="revenueTTC"
              type="number"
              step="0.001"
              min="0"
              required
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              placeholder="0,000"
            />
          </div>
          <div>
            <Label htmlFor="purchasesTTC">Achats TTC *</Label>
            <Input
              id="purchasesTTC"
              name="purchasesTTC"
              type="number"
              step="0.001"
              min="0"
              required
              value={purchases}
              onChange={(e) => setPurchases(e.target.value)}
              placeholder="0,000"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="expensesTTC">Dépenses TTC *</Label>
            <Input
              id="expensesTTC"
              name="expensesTTC"
              type="number"
              step="0.001"
              min="0"
              required
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              placeholder="0,000"
            />
          </div>
          <div>
            <Label htmlFor="otherExpensesTTC">Autres dépenses TTC</Label>
            <Input
              id="otherExpensesTTC"
              name="otherExpensesTTC"
              type="number"
              step="0.001"
              min="0"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="0,000"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={closing?.notes ?? ''}
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm text-white focus:border-accent-400 focus:outline-none"
            placeholder="Commentaire sur la semaine…"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-3">
          <span className="text-sm text-white/60">Résultat de la semaine</span>
          <span className={`font-display text-lg font-bold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {gain >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(gain))}
          </span>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {closing ? 'Enregistrer les montants' : 'Créer la clôture'}
        </Button>
      </form>

      {closing ? (
        <div className="border-t border-[#2A2A2A] pt-4">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => closeAction(closing.id))}
          >
            {pending ? null : <Lock className="h-4 w-4" />}
            Clôturer la semaine
          </Button>
          <p className="mt-2 text-xs text-white/40">
            Une semaine clôturée est verrouillée : elle ne peut plus être modifiée sans la rouvrir.
          </p>
        </div>
      ) : null}
    </div>
  )
}