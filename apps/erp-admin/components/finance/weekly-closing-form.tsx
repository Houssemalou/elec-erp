'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Lock, RefreshCw } from 'lucide-react'
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
  costOfGoodsTTC: string
  notes: string
}

/**
 * Saisie du bilan hebdomadaire, puis verrouillage.
 *
 * Le chiffre d'affaires et le coût de revient sont pré-remplis automatiquement
 * à partir des ventes de la semaine, mais restent modifiables. La marge brute
 * (CA − coût de revient) et le résultat net (CA − achats − dépenses − autres)
 * sont recalculés ici, la base ne les recalcule pas. La clôture est une action
 * séparée pour ne pas verrouiller une semaine par mégarde.
 */
export function WeeklyClosingForm({
  closing,
  defaultWeekStart,
  auto,
  autoValuesAction,
  action,
  closeAction,
  reopenAction,
}: {
  closing: WeeklyClosingFormData | null
  /** Lundi proposé quand aucune clôture n'existe encore (ex. semaine en retard). */
  defaultWeekStart: Date
  /** Valeurs calculées automatiquement à partir des ventes de la semaine. */
  auto: { revenueTTC: number; costOfGoodsTTC: number; missingCostLines: number }
  /** Recalcule les valeurs automatiques pour le lundi choisi. */
  autoValuesAction: (weekStart: string) => Promise<{
    success: boolean
    error?: string
    revenueTTC?: number
    costOfGoodsTTC?: number
    missingCostLines?: number
  }>
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  closeAction: (id: string) => Promise<{ success: boolean; error?: string }>
  reopenAction: (id: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const [autoRevenue, setAutoRevenue] = useState(String(auto.revenueTTC))
  const [autoCost, setAutoCost] = useState(String(auto.costOfGoodsTTC))
  const [missing, setMissing] = useState(auto.missingCostLines)

  const [weekStart, setWeekStart] = useState(dateInputValue(closing?.weekStart ?? defaultWeekStart))
  const [revenue, setRevenue] = useState(closing?.revenueTTC ?? String(auto.revenueTTC))
  const [purchases, setPurchases] = useState(closing?.purchasesTTC ?? '')
  const [expenses, setExpenses] = useState(closing?.expensesTTC ?? '')
  const [other, setOther] = useState(closing?.otherExpensesTTC ?? '')
  const [costOfGoods, setCostOfGoods] = useState(closing?.costOfGoodsTTC ?? String(auto.costOfGoodsTTC))

  const num = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  const gain = useMemo(
    () => Math.round((num(revenue) - num(purchases) - num(expenses) - num(other)) * 1000) / 1000,
    [revenue, purchases, expenses, other],
  )
  const margin = useMemo(
    () => Math.round((num(revenue) - num(costOfGoods)) * 1000) / 1000,
    [revenue, costOfGoods],
  )
  const resetToAuto = () => {
    setRevenue(autoRevenue)
    setCostOfGoods(autoCost)
  }
  // Changer de semaine recalcule les valeurs automatiques (création seulement).
  const onWeekStartChange = (value: string) => {
    setWeekStart(value)
    if (closing || !value) return
    startTransition(async () => {
      const res = await autoValuesAction(value)
      if (!res.success) return
      const rev = String(res.revenueTTC ?? 0)
      const cost = String(res.costOfGoodsTTC ?? 0)
      setAutoRevenue(rev)
      setAutoCost(cost)
      setMissing(res.missingCostLines ?? 0)
      setRevenue(rev)
      setCostOfGoods(cost)
    })
  }

  // Le lundi saisi borne la semaine : on affiche le dimanche correspondant.
  const weekEndLabel = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    if (!y || !m || !d) return ''
    const end = new Date(y, m - 1, d + 6)
    return end.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  }, [weekStart])

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

        {closing ? null : (
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
            <Label htmlFor="weekStart">Semaine à clôturer (lundi) *</Label>
            <Input
              id="weekStart"
              name="weekStart"
              type="date"
              required
              value={weekStart}
              onChange={(e) => onWeekStartChange(e.target.value)}
            />
            <p className="mt-1 text-xs text-white/40">
              {weekEndLabel
                ? `Du lundi saisi au dimanche ${weekEndLabel}. Choisissez une date passée pour régulariser une semaine en retard.`
                : 'Sélectionnez le lundi de la semaine à clôturer.'}
            </p>
          </div>
        )}

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
            <p className="mt-1 text-xs text-white/40">Pré-rempli avec les ventes de la semaine (modifiable).</p>
          </div>
          <div>
            <Label htmlFor="costOfGoodsTTC">Prix de revient TTC des articles vendus *</Label>
            <Input
              id="costOfGoodsTTC"
              name="costOfGoodsTTC"
              type="number"
              step="0.001"
              min="0"
              required
              value={costOfGoods}
              onChange={(e) => setCostOfGoods(e.target.value)}
              placeholder="0,000"
            />
            <p className="mt-1 text-xs text-white/40">
              Coût d&apos;achat TTC des articles vendus (modifiable).
              {missing > 0 ? (
                <span className="text-amber-400">
                  {' '}
                  {missing} ligne(s) sans prix de revient : valeur partielle.
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={resetToAuto}>
              <RefreshCw className="h-4 w-4" />
              Recalculer CA et prix de revient
            </Button>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-3">
            <span className="text-sm text-white/60">Marge brute TTC (CA − prix de revient)</span>
            <span className={`font-display text-lg font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {margin >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(margin))}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-3">
            <span className="text-sm text-white/60">Résultat net (CA − achats − dépenses − autres)</span>
            <span className={`font-display text-lg font-bold ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gain >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(gain))}
            </span>
          </div>
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