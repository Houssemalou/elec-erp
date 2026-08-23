'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createQuoteRequestAction } from '@/lib/actions'
import { money } from '@/lib/format'
import { Loader2, Plus, Trash2, CheckCircle2, FileText, Zap } from 'lucide-react'

export type ProductOption = {
  id: string
  name: string
  sku: string
  priceHT: number
  taxRate: number
}

export function QuoteRequestForm({
  products,
  preselectedProductId,
}: {
  products: ProductOption[]
  preselectedProductId?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>(() =>
    preselectedProductId ? [{ productId: preselectedProductId, quantity: 1 }] : [],
  )

  const inputCls =
    'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

  const addLine = () => {
    const first = products.find((p) => !lines.some((l) => l.productId === p.id)) ?? products[0]
    if (!first) return
    setLines([...lines, { productId: first.id, quantity: 1 }])
  }

  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index))

  const updateLine = (index: number, patch: Partial<{ productId: string; quantity: number }>) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await createQuoteRequestAction({
        name: form.name,
        phone: form.phone,
        email: form.email,
        message: form.message || undefined,
        lines: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      })
      if (res.ok && res.quoteNumber) {
        setSuccess(res.quoteNumber)
      } else {
        setError(res.error ?? 'Une erreur est survenue')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-brand-950">Demande envoyée !</h2>
        <p className="mt-2 text-sm text-slate-600">
          Votre demande de devis <span className="font-mono font-semibold">{success}</span> a bien été enregistrée.
          Notre équipe vous préparera un devis et vous contactera rapidement.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-600">
            <Zap className="h-4 w-4" /> Continuer mes achats
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-brand-950">
          <FileText className="h-5 w-5 text-brand-600" /> Produits souhaités
        </h2>
        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
            Aucun produit sélectionné.
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line, index) => {
              const product = products.find((p) => p.id === line.productId)
              return (
                <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-52 flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Produit</label>
                    <select
                      className={inputCls}
                      value={line.productId}
                      onChange={(e) => updateLine(index, { productId: e.target.value })}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sku}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Quantité</label>
                    <input
                      type="number"
                      min={1}
                      required
                      className={inputCls}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-32 pb-1 text-right text-sm text-slate-500">
                    {product ? (
                      <>
                        <p className="font-medium text-slate-900">{money(product.priceHT)}</p>
                        <p className="text-xs text-slate-400">TVA {product.taxRate}% incluse : {money(product.priceHT * (1 + product.taxRate / 100))}</p>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Retirer la ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <button
          type="button"
          onClick={addLine}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
        >
          <Plus className="h-4 w-4" /> Ajouter un produit
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Vos coordonnées</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nom complet</label>
            <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom et prénom" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Téléphone</label>
            <input required className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+216 …" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">E-mail</label>
            <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.tn" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Votre besoin (optionnel)</label>
            <textarea
              rows={3}
              className={`${inputCls} h-auto py-2.5`}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Précisez vos besoins : quantités, autre matériel non listé, délais…"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || lines.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-brand-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Envoi…' : 'Envoyer ma demande de devis'}
      </button>
    </form>
  )
}