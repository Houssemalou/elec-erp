import { money } from '@/lib/utils'

export function DocumentTotals({
  totalHT,
  totalTVA,
  totalTTC,
  timbreFiscal,
  discountGlobal,
  vatBreakdown,
  paidAmount,
}: {
  totalHT: number
  totalTVA: number
  totalTTC: number
  timbreFiscal?: number
  discountGlobal?: number
  vatBreakdown?: unknown
  paidAmount?: number
}) {
  const rawBreakdown = vatBreakdown && typeof vatBreakdown === 'object' && !Array.isArray(vatBreakdown)
  const breakdown = rawBreakdown
    ? Object.entries(vatBreakdown as Record<string, unknown>)
        .map(([rate, tva]) => ({ rate: Number(rate), tva: Number(tva) }))
        .sort((a, b) => b.rate - a.rate)
    : []
  const paid = paidAmount ?? 0
  const remaining = Math.max(0, totalTTC - paid)

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#0B0B0B] p-5">
      <dl className="space-y-2 text-sm">
        {Number(discountGlobal ?? 0) > 0 ? (
          <div className="flex justify-between text-white/60">
            <dt>Remise globale</dt>
            <dd className="font-medium text-red-400">− {money(discountGlobal ?? 0)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-white/60">
          <dt>Total HT</dt>
          <dd className="font-medium text-white">{money(totalHT)}</dd>
        </div>
        <div className="flex justify-between text-white/60">
          <dt>Total TVA</dt>
          <dd className="font-medium text-white">{money(totalTVA)}</dd>
        </div>
        {breakdown.length > 0 ? (
          <div className="space-y-1 border-t border-[#2A2A2A] pt-2 text-xs text-white/40">
            {breakdown.map((b) => (
              <div key={b.rate} className="flex justify-between">
                <span>dont TVA {b.rate}%</span>
                <span>{money(b.tva)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {Number(timbreFiscal ?? 0) > 0 ? (
          <div className="flex justify-between text-white/60">
            <dt>Timbre fiscal</dt>
            <dd className="font-medium text-white">{money(timbreFiscal ?? 0)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-[#2A2A2A] pt-2 text-base font-bold text-white">
          <dt>Total TTC</dt>
          <dd>{money(totalTTC)}</dd>
        </div>
        {paidAmount !== undefined ? (
          <>
            <div className="flex justify-between text-emerald-400">
              <dt>Déjà payé</dt>
              <dd className="font-semibold">{money(paid)}</dd>
            </div>
            {remaining > 0.001 ? (
              <div className="flex justify-between text-red-400">
                <dt>Reste à payer</dt>
                <dd className="font-semibold">{money(remaining)}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
    </div>
  )
}
