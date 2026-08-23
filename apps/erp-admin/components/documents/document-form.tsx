'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button, Input, Select, Label, Textarea } from '@/components/ui'
import { money } from '@/lib/utils'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export interface DocLine {
  key: string
  productId: string
  sku: string
  designation: string
  quantity: string
  unitPriceHT: string
  discountType: '' | 'PERCENT' | 'AMOUNT'
  discountValue: string
  taxRate: number
}

export interface ProductOption {
  id: string
  sku: string
  name: string
  priceHT: number
  taxRate: number
}

interface DocumentFormProps {
  partyLabel: string
  partyOptions: Array<{ id: string; label: string; companyName?: string | null }>
  products: ProductOption[]
  submitAction: (fd: FormData) => Promise<{ success: boolean; error?: string; id?: string }>
  successPath: string
  submitLabel: string
  defaultPartyId?: string
  defaultLines?: DocLine[]
  defaultGlobalDiscountType?: '' | 'PERCENT' | 'AMOUNT'
  defaultGlobalDiscountValue?: string
  defaultNotes?: string
  defaultConditions?: string
  dateLabel?: string
  defaultDate?: string
  dateName?: string
  partyFieldName?: string
  partyCompanyName?: boolean
  extraDate?: { label: string; name: string; default: string }
  reason?: boolean
}

let lineSeq = 0
const nextKey = () => `l${++lineSeq}`

export function DocumentForm({
  partyLabel,
  partyOptions,
  products,
  submitAction,
  successPath,
  submitLabel,
  defaultPartyId,
  defaultLines = [],
  defaultGlobalDiscountType = '',
  defaultGlobalDiscountValue = '',
  defaultNotes,
  defaultConditions,
  dateLabel,
  defaultDate,
  dateName = 'date',
  partyFieldName = 'customerId',
  partyCompanyName = false,
  extraDate,
  reason = false,
}: DocumentFormProps) {
  const router = useRouter()
  const [lines, setLines] = useState<DocLine[]>(defaultLines)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [companyName, setCompanyName] = useState(
    partyOptions.find((o) => o.id === defaultPartyId)?.companyName ?? '',
  )

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { key: nextKey(), productId: '', sku: '', designation: '', quantity: '1', unitPriceHT: '', discountType: '', discountValue: '', taxRate: 0 },
    ])

  const updateLine = (key: string, patch: Partial<DocLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const pickProduct = (key: string, productId: string) => {
    const p = products.find((x) => x.id === productId)
    updateLine(key, {
      productId,
      sku: p?.sku ?? '',
      designation: p?.name ?? '',
      unitPriceHT: p ? String(p.priceHT) : '',
      taxRate: p?.taxRate ?? 0,
    })
  }

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form)
    const clean = lines.map((l) => ({
      productId: l.productId || null,
      sku: l.sku,
      designation: l.designation,
      quantity: Number(l.quantity || 0),
      unitPriceHT: Number(l.unitPriceHT || 0),
      discountType: l.discountType || null,
      discountValue: Number(l.discountValue || 0),
      taxRate: Number(l.taxRate || 0),
    }))
    fd.set('lines', JSON.stringify(clean))
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await submitAction(fd)
        if (!res.success) {
          setError(res.error ?? 'Erreur inconnue')
          return
        }
        router.push(res.id ? `${successPath}/${res.id}` : successPath)
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })
  }

  const lineTotal = (l: DocLine) => {
    const q = Number(l.quantity || 0)
    const pu = Number(l.unitPriceHT || 0)
    const dv = Number(l.discountValue || 0)
    let net = pu
    if (l.discountType === 'PERCENT' && dv > 0) net = pu - (pu * dv) / 100
    else if (l.discountType === 'AMOUNT' && dv > 0) net = Math.max(0, pu - dv)
    return q * net
  }

  const subtotalHT = lines.reduce((s, l) => s + lineTotal(l), 0)
  const discountAmount =
    defaultGlobalDiscountType === 'PERCENT'
      ? (subtotalHT * Number(defaultGlobalDiscountValue || 0)) / 100
      : defaultGlobalDiscountType === 'AMOUNT'
        ? Number(defaultGlobalDiscountValue || 0)
        : 0
  const totalHT = Math.max(0, subtotalHT - discountAmount)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(e.currentTarget)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{partyLabel}</Label>
          <Select
            name={partyFieldName}
            defaultValue={defaultPartyId}
            required
            onChange={(e) => {
              const p = partyOptions.find((o) => o.id === e.target.value)
              setCompanyName(p?.companyName ?? '')
            }}
          >
            <option value="">Sélectionner un {partyLabel.toLowerCase()}…</option>
            {partyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        {partyCompanyName ? (
          <div>
            <Label>Nom de la société (client commercial)</Label>
            <Input
              name="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Laisser vide pour un particulier"
            />
          </div>
        ) : null}
        {dateLabel ? (
          <div>
            <Label>{dateLabel}</Label>
            <Input type="date" name={dateName} defaultValue={defaultDate} />
          </div>
        ) : null}
      </div>

      {extraDate ? (
        <div className="mt-4">
          <Label>{extraDate.label}</Label>
          <Input type="date" name={extraDate.name} defaultValue={extraDate.default} />
        </div>
      ) : null}

      {reason ? (
        <div className="mt-4">
          <Label>Motif de l&apos;avoir (obligatoire)</Label>
          <Textarea name="reason" rows={2} required placeholder="Retour, erreur de facturation, marchandise endommagée…" />
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-slate-900">Lignes</h3>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </Button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[62px]" />
            <col className="w-[88px]" />
            <col className="w-[112px]" />
            <col className="w-[68px]" />
            <col className="w-[88px]" />
            <col className="w-[36px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Produit</th>
              <th className="px-2 py-2">Désignation</th>
              <th className="px-2 py-2 text-right">Qté</th>
              <th className="px-2 py-2 text-right">PU HT</th>
              <th className="px-2 py-2 text-right">Remise</th>
              <th className="px-2 py-2 text-right">TVA %</th>
              <th className="px-2 py-2 text-right">Total HT</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-slate-100">
                <td className="px-2 py-1.5">
                  <Select
                    value={l.productId}
                    onChange={(e) => pickProduct(l.key, e.target.value)}
                    className="w-full"
                  >
                    <option value="">— Libre —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={l.designation}
                    onChange={(e) => updateLine(l.key, { designation: e.target.value })}
                    placeholder="Désignation"
                    className="w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={l.quantity}
                    onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    className="w-full text-right"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={l.unitPriceHT}
                    onChange={(e) => updateLine(l.key, { unitPriceHT: e.target.value })}
                    className="w-full text-right"
                    placeholder="0.000"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <select
                      value={l.discountType}
                      onChange={(e) => updateLine(l.key, { discountType: e.target.value as DocLine['discountType'] })}
                      className="h-10 w-14 shrink-0 rounded-lg border border-slate-300 bg-white px-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      <option value="PERCENT">%</option>
                      <option value="AMOUNT">DT</option>
                    </select>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={l.discountValue}
                      onChange={(e) => updateLine(l.key, { discountValue: e.target.value })}
                      className="w-full min-w-0 text-right"
                      placeholder="0"
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={String(l.taxRate)}
                    onChange={(e) => updateLine(l.key, { taxRate: Number(e.target.value) })}
                    className="w-full text-right"
                  >
                    {[0, 7, 13, 19].map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-slate-900">{money(lineTotal(l))}</td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-sm text-slate-400">
                  Aucune ligne — cliquez sur « Ajouter une ligne »
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Remise globale</Label>
          <div className="flex items-center gap-2">
            <Select name="globalDiscountType" defaultValue={defaultGlobalDiscountType} className="w-28">
              <option value="">Aucune</option>
              <option value="PERCENT">Pourcentage</option>
              <option value="AMOUNT">Montant (DT)</option>
            </Select>
            <Input
              type="number"
              min="0"
              step="any"
              name="globalDiscountValue"
              defaultValue={defaultGlobalDiscountValue}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea name="notes" defaultValue={defaultNotes} rows={1} placeholder="Notes internes…" />
        </div>
        {defaultConditions !== undefined ? (
          <div>
            <Label>Conditions</Label>
            <Textarea name="conditions" defaultValue={defaultConditions} rows={1} placeholder="Conditions de règlement…" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <div className="text-sm">
          <span className="text-slate-500">Sous-total HT : </span>
          <span className="font-semibold text-slate-900">{money(subtotalHT)}</span>
          {discountAmount > 0 ? (
            <>
              <span className="ml-3 text-slate-500">Remise : </span>
              <span className="font-semibold text-red-600">− {money(discountAmount)}</span>
            </>
          ) : null}
          <span className="ml-3 text-slate-500">Total HT : </span>
          <span className="font-semibold text-brand-900">{money(totalHT)}</span>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? 'Enregistrement…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}