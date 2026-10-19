'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'
import { money } from '@/lib/utils'

/**
 * Édition de la remise globale (en DT) d'une vente en caisse depuis l'historique.
 * Le bon de livraison est recalculé côté serveur : le chiffre d'affaires, la
 * marge et le gain des ventes en caisse en tiennent compte. La facture liée
 * reste inchangée.
 *
 * `variant="row"` affiche la ligne « Remise TTC … » (détail de vente),
 * `variant="inline"` affiche la valeur + crayon (cellule du tableau).
 */
export function EditSaleDiscount({
  saleId,
  discountTTC,
  grossTTC,
  disabled,
  variant = 'row',
  action,
}: {
  saleId: string
  discountTTC: number
  grossTTC: number
  disabled?: boolean
  variant?: 'row' | 'inline'
  action: (id: string, discountTTC: number) => Promise<{ success: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(discountTTC))
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const parsed = Number(value.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed >= 0
  const nextTotal = valid ? Math.max(0, grossTTC - parsed) : grossTTC
  const tooBig = valid && parsed > grossTTC

  const openEditor = () => {
    setValue(String(discountTTC))
    setError(undefined)
    setOpen(true)
  }

  const save = () => {
    if (!valid) {
      setError('Montant invalide')
      return
    }
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(saleId, parsed)
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

  const editButton = !disabled ? (
    <button
      type="button"
      onClick={openEditor}
      className="text-white/40 hover:text-accent-400"
      aria-label="Modifier la remise"
      title="Modifier la remise"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  ) : null

  return (
    <>
      {variant === 'inline' ? (
        <span className="inline-flex items-center gap-1.5">
          {discountTTC > 0 ? (
            <span className="text-red-400">-{money(discountTTC)}</span>
          ) : (
            <span className="text-white/30">—</span>
          )}
          {editButton}
        </span>
      ) : (
        <div className={discountTTC > 0 ? 'flex justify-between text-red-400' : 'flex justify-between text-white/60'}>
          <span className="flex items-center gap-1.5">
            Remise TTC
            {editButton}
          </span>
          <span>{discountTTC > 0 ? `-${money(discountTTC)}` : money(0)}</span>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-white">Modifier la remise</h3>
            <p className="mt-1 text-xs text-white/50">
              Remise globale en dinars appliquée au total TTC de la vente. Le chiffre d&apos;affaires, la marge et le
              gain des ventes en caisse sont recalculés. La facture liée n&apos;est pas modifiée.
            </p>
            <label className="mt-4 block text-xs font-medium text-white/60" htmlFor="sale-discount">
              Remise (DT)
            </label>
            <input
              id="sale-discount"
              type="number"
              min="0"
              step="any"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!tooBig) save()
                }
              }}
              className="mt-1 h-10 w-full rounded-lg border border-[#2A2A2A] bg-[#0B0B0B] px-3 text-sm text-white focus:border-accent-400 focus:outline-none"
            />
            <div className="mt-3 space-y-1 text-xs text-white/50">
              <div className="flex justify-between">
                <span>Total TTC avant remise</span>
                <span>{money(grossTTC)}</span>
              </div>
              <div className="flex justify-between">
                <span>Nouveau total TTC</span>
                <span className={tooBig ? 'text-red-400' : 'font-semibold text-white'}>{money(nextTotal)}</span>
              </div>
            </div>
            {tooBig ? (
              <p className="mt-2 text-xs text-amber-400">
                La remise dépasse le total : le nouveau total est ramené à zéro.
              </p>
            ) : null}
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="button" onClick={save} disabled={pending || !valid}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
