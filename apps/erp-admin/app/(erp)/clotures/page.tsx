import Link from 'next/link'
import { Lock } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { WeeklyClosingForm } from '@/components/finance/weekly-closing-form'
import {
  closeWeeklyClosingAction,
  reopenWeeklyClosingAction,
  saveWeeklyClosingAction,
  getWeeklyAutoValuesAction,
} from '@/lib/actions/erp'
import { getWeeklyClosingByWeek, listWeeklyClosings, weeklyGain, weeklyMargin, weekStartOf, getSalesGainBetween } from '@elec/services'
import { money, formatDate, dateInputValue, parseDateInput } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CloturesPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>
}) {
  const params = await searchParams

  // La semaine demandée, ou la semaine dernière (celle qui est close quand on
  // travaille en début de semaine).
  const latestMonday = weekStartOf(new Date(Date.now() - 7 * 86400000))
  const reference = params.semaine ? parseDateInput(params.semaine) : latestMonday
  const [current, history] = await Promise.all([getWeeklyClosingByWeek(reference), listWeeklyClosings()])
  const weekStart = current?.weekStart ?? weekStartOf(reference)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  // Le gain TTC est calculé automatiquement sur la semaine (lundi → lundi exclu).
  const autoGain = await getSalesGainBetween(weekStart, new Date(weekStart.getTime() + 7 * 86400000))

  const gain = current
    ? weeklyGain({
        revenueTTC: Number(current.revenueTTC),
        purchasesTTC: Number(current.purchasesTTC),
        expensesTTC: Number(current.expensesTTC),
        otherExpensesTTC: Number(current.otherExpensesTTC),
      })
    : null
  const margin = current
    ? weeklyMargin({
        revenueTTC: Number(current.revenueTTC),
        costOfGoodsTTC: Number(current.costOfGoodsTTC),
      })
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clôtures hebdomadaires"
        description="Saisissez le bilan de chaque semaine (lundi → lundi), puis clôturez-la pour fixer le résultat."
      />

      <Card>
        <CardHeader
          title="D'après les ventes de la semaine"
          subtitle="Calculé automatiquement — valeurs proposées par défaut, modifiables dans le formulaire ci-dessous"
        />
        <div className="space-y-2 p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/50">Chiffre d&apos;affaires TTC de la semaine</span>
            <span className="font-semibold text-white">{money(autoGain.revenueTTC)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50">Coût d&apos;achat TTC des articles vendus</span>
            <span className="font-semibold text-red-400">− {money(autoGain.costOfGoodsTTC)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-2">
            <span className="text-white/60">Gain TTC</span>
            <span
              className={`font-display text-lg font-bold ${autoGain.gainTTC >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {autoGain.gainTTC >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(autoGain.gainTTC))}
              {autoGain.revenueTTC > 0 ? (
                <span className="ml-2 text-xs font-medium text-white/40">
                  ({autoGain.gainRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %)
                </span>
              ) : null}
            </span>
          </div>
          {autoGain.missingCostLines > 0 ? (
            <p className="text-xs text-amber-400">
              {autoGain.missingCostLines} ligne(s) vendue(s) sans prix de revient : le gain affiché est partiel.
              Renseignez le coût d&apos;achat des articles concernés pour un calcul complet.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={`Semaine du ${formatDate(weekStart)} au ${formatDate(weekEnd)}`}
              subtitle="Les montants sont saisis à la main, en TTC"
              action={
                <Link
                  href={`/clotures?semaine=${dateInputValue(latestMonday)}`}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Semaine précédente
                </Link>
              }
            />
            <div className="p-5">
              {current?.closedAt ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    <Lock className="h-4 w-4" />
                    Semaine clôturée le {formatDate(current.closedAt)} — rouvrez-la pour corriger les montants.
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ['Chiffre d’affaires TTC', Number(current.revenueTTC)],
                      ['Prix de revient TTC', Number(current.costOfGoodsTTC)],
                      ['Achats TTC', Number(current.purchasesTTC)],
                      ['Dépenses TTC', Number(current.expensesTTC)],
                      ['Autres dépenses TTC', Number(current.otherExpensesTTC)],
                      ['Espèces en caisse TTC', Number(current.cashOnHandTTC)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between border-b border-[#2A2A2A] pb-2">
                        <dt className="text-white/50">{label}</dt>
                        <dd className="font-semibold text-white">{money(value as number)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between border-b border-[#2A2A2A] pb-2 sm:col-span-2">
                      <dt className="text-white/50">Marge brute TTC</dt>
                      <dd className={`font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {margin >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(margin))}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b border-[#2A2A2A] pb-2 sm:col-span-2">
                      <dt className="text-white/50">Résultat net</dt>
                      <dd className={`font-bold ${(gain ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(gain ?? 0) >= 0 ? 'Gain' : 'Perte'} : {money(Math.abs(gain ?? 0))}
                      </dd>
                    </div>
                  </dl>
                  {current.notes ? <p className="text-sm text-white/60">{current.notes}</p> : null}
                  <ActionButton
                    action={reopenWeeklyClosingAction.bind(null, current.id)}
                    label="Rouvrir la semaine"
                    variant="outline"
                    confirm="La semaine sera déverrouillée et les montants pourront être corrigés. Continuer ?"
                    confirmTitle="Rouvrir la semaine"
                  />
                </div>
              ) : (
                <WeeklyClosingForm
                  closing={
                    current
                      ? {
                          id: current.id,
                          weekStart: current.weekStart,
                          revenueTTC: String(current.revenueTTC),
                          purchasesTTC: String(current.purchasesTTC),
                          expensesTTC: String(current.expensesTTC),
                          otherExpensesTTC: String(current.otherExpensesTTC),
                          costOfGoodsTTC: String(current.costOfGoodsTTC),
                          cashOnHandTTC: String(current.cashOnHandTTC),
                          notes: current.notes ?? '',
                        }
                      : null
                  }
                  auto={autoGain}
                  autoValuesAction={getWeeklyAutoValuesAction}
                  action={saveWeeklyClosingAction}
                  closeAction={closeWeeklyClosingAction}
                  reopenAction={reopenWeeklyClosingAction}
                  defaultWeekStart={weekStart}
                />
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Historique" subtitle="Semaines clôturées et ouvertes" />
          <div className="p-5">
            {history.length === 0 ? (
              <p className="text-sm text-white/40">Aucune clôture enregistrée</p>
            ) : (
              <ul className="space-y-2">
                {history.map((w) => {
                  const wGain = weeklyGain({
                    revenueTTC: Number(w.revenueTTC),
                    purchasesTTC: Number(w.purchasesTTC),
                    expensesTTC: Number(w.expensesTTC),
                    otherExpensesTTC: Number(w.otherExpensesTTC),
                  })
                  const wMargin = weeklyMargin({
                    revenueTTC: Number(w.revenueTTC),
                    costOfGoodsTTC: Number(w.costOfGoodsTTC),
                  })
                  return (
                    <li key={w.id}>
                      <Link
                        href={`/clotures?semaine=${dateInputValue(w.weekStart)}`}
                        className="block rounded-lg border border-[#2A2A2A] p-3 hover:bg-white/5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/50">
                            {formatDate(w.weekStart)} → {formatDate(new Date(w.weekStart.getTime() + 6 * 86400000))}
                          </span>
                          <Badge tone={w.closedAt ? 'green' : 'amber'}>
                            {w.closedAt ? 'Clôturée' : 'Ouverte'}
                          </Badge>
                        </div>
                        <p className={`mt-1 text-sm font-semibold ${wMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Marge : {wMargin >= 0 ? '' : '−'}{money(Math.abs(wMargin))}
                        </p>
                        <p className="text-xs text-white/40">
                          Résultat net : {wGain >= 0 ? '' : '−'}{money(Math.abs(wGain))}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}