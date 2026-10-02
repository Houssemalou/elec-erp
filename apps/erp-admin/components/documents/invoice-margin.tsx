import { money } from '@/lib/utils'
import type { MarginTotals } from '@elec/contracts'

/**
 * Bloc « Rentabilité » d'une facture.
 *
 * Affiché à côté du récapitulatif des montants. Les totaux sont masqués si une
 * ligne n'a pas de prix de revient : un sous-total de marge donnerait une
 * impression fausse de précision.
 */
export function InvoiceMargin({ margin }: { margin: MarginTotals }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#0B0B0B] p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Rentabilité</h3>
      {!margin.complete ? (
        <p className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
          {margin.linesWithoutCost} ligne(s) sans prix de revient : la marge n'est pas calculable.
        </p>
      ) : null}
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between text-white/60">
          <dt>Coût d'achat TTC</dt>
          <dd className="font-medium text-white">{margin.costTTC === null ? '—' : money(margin.costTTC)}</dd>
        </div>
        <div className="flex justify-between text-white/60">
          <dt>Gain brut TTC</dt>
          <dd className={`font-medium ${(margin.gainGrossTTC ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {margin.gainGrossTTC === null ? '—' : money(margin.gainGrossTTC)}
          </dd>
        </div>
        <div className="flex justify-between text-white/60">
          <dt>TVA collectée</dt>
          <dd className="font-medium text-white">− {money(margin.tvaCollected)}</dd>
        </div>
        <div className="flex justify-between text-white/60">
          <dt>TVA déductible</dt>
          <dd className="font-medium text-emerald-400">
            + {margin.tvaDeductible === null ? '—' : money(margin.tvaDeductible)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[#2A2A2A] pt-2 text-base font-bold text-white">
          <dt>Gain net</dt>
          <dd className={(margin.gainNet ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {margin.gainNet === null ? '—' : money(margin.gainNet)}
          </dd>
        </div>
        {margin.complete && margin.marginRate !== null ? (
          <div className="flex justify-between text-xs text-white/40">
            <dt>Taux de marge</dt>
            <dd>{margin.marginRate.toLocaleString('fr-FR')} %</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}