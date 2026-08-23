'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrderAction, createQuoteRequestAction, getShippingCost } from '@/lib/actions'
import { useCart } from '@/components/cart/cart-provider'
import { money } from '@/lib/format'
import { Loader2, MapPin, ShoppingCart, Store, Truck, FileText, CheckCircle2, Zap } from 'lucide-react'

export function CheckoutForm({
  storeName = '',
  storeAddress = '',
  storePhone = '',
}: {
  storeName?: string
  storeAddress?: string
  storePhone?: string
}) {
  const router = useRouter()
  const { items, subtotalHT, clear } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successQuote, setSuccessQuote] = useState<string | null>(null)
  const [shippingCost, setShippingCost] = useState(0)
  const [mode, setMode] = useState<'order' | 'quote'>('order')
  const [form, setForm] = useState({
    email: '',
    shippingFullName: '',
    shippingAddress: '',
    shippingCity: '',
    shippingPhone: '',
    cin: '',
    shippingNote: '',
    paymentMethod: 'COD',
    deliveryMethod: 'DELIVERY',
    pickupTime: '',
    withInvoice: false,
  })

  useEffect(() => {
    getShippingCost().then(setShippingCost).catch(() => setShippingCost(0))
  }, [])

  const isPickup = form.deliveryMethod === 'PICKUP'

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 py-20 text-center">
        <ShoppingCart className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500">Votre panier est vide.</p>
        <Link href="/produits" className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          Voir le catalogue
        </Link>
      </div>
    )
  }

  const tva = form.withInvoice ? items.reduce((s, i) => s + i.priceHT * i.quantity * (i.taxRate / 100), 0) : 0
  const totalShipping = isPickup ? 0 : shippingCost

  if (successQuote) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-950">Demande de devis envoyée !</h2>
          <p className="mt-2 text-sm text-slate-600">
            Votre demande de devis <span className="font-mono font-semibold">{successQuote}</span> pour l&apos;ensemble
            de votre panier a bien été enregistrée. Notre équipe vous préparera un devis et vous contactera rapidement.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-600">
              <Zap className="h-4 w-4" /> Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      if (mode === 'quote') {
        const res = await createQuoteRequestAction({
          name: form.shippingFullName,
          phone: form.shippingPhone,
          email: form.email,
          message: form.shippingNote || undefined,
          lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        })
        if (res.ok && res.quoteNumber) {
          clear()
          setSuccessQuote(res.quoteNumber)
        } else {
          setError(res.error ?? 'Une erreur est survenue')
        }
        return
      }

      const shippingCostServer = isPickup ? 0 : await getShippingCost()
      const res = await createOrderAction({
        email: form.email,
        shippingFullName: form.shippingFullName,
        shippingAddress: form.shippingAddress,
        shippingCity: form.shippingCity,
        shippingPhone: form.shippingPhone,
        cin: form.cin,
        shippingNote: form.shippingNote || null,
        shippingCost: shippingCostServer,
        paymentMethod: 'COD',
        deliveryMethod: isPickup ? 'PICKUP' : 'DELIVERY',
        pickupTime: isPickup ? form.pickupTime : null,
        withInvoice: form.withInvoice,
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      })
      if (res.ok && res.orderId) {
        clear()
        router.push(`/commande-confirmee?id=${res.orderId}&email=${encodeURIComponent(form.email)}`)
      } else {
        setError(res.error ?? 'Une erreur est survenue')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  const inputCls =
    'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Comment souhaitez-vous procéder ?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                mode === 'order' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="order"
                checked={mode === 'order'}
                onChange={() => setMode('order')}
                className="sr-only"
              />
              <div className="flex items-start gap-3">
                <ShoppingCart className="mt-0.5 h-5 w-5 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Confirmer ma commande</p>
                  <p className="mt-0.5 text-xs text-slate-500">Je commande maintenant et je règle à la livraison.</p>
                </div>
              </div>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                mode === 'quote' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="quote"
                checked={mode === 'quote'}
                onChange={() => setMode('quote')}
                className="sr-only"
              />
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Demander un devis</p>
                  <p className="mt-0.5 text-xs text-slate-500">Un devis gratuit pour l&apos;ensemble de mon panier.</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Coordonnées</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Nom complet</label>
              <input required className={inputCls} value={form.shippingFullName} onChange={(e) => setForm({ ...form, shippingFullName: e.target.value })} placeholder="Nom et prénom" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">E-mail (pour la confirmation et le suivi)</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.tn" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">CIN (carte d&apos;identité)</label>
              <input
                required={mode === 'order'}
                className={inputCls}
                value={form.cin}
                onChange={(e) => setForm({ ...form, cin: e.target.value })}
                placeholder="N° de la carte d'identité"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]{8}"
                title="Le CIN doit contenir 8 chiffres"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Téléphone</label>
              <input required className={inputCls} value={form.shippingPhone} onChange={(e) => setForm({ ...form, shippingPhone: e.target.value })} placeholder="+216 …" />
            </div>
            {!isPickup && mode === 'order' ? (
              <>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Adresse de livraison</label>
                  <input required className={inputCls} value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} placeholder="Rue, numéro, bâtiment…" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Ville</label>
                  <input required className={inputCls} value={form.shippingCity} onChange={(e) => setForm({ ...form, shippingCity: e.target.value })} />
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Note (optionnel)</label>
              <input className={inputCls} value={form.shippingNote} onChange={(e) => setForm({ ...form, shippingNote: e.target.value })} />
            </div>
          </div>
        </div>

        {mode === 'order' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Mode de réception</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  !isPickup ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="DELIVERY"
                  checked={!isPickup}
                  onChange={() => setForm({ ...form, deliveryMethod: 'DELIVERY' })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-5 w-5 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Livraison à domicile</p>
                    <p className="mt-0.5 text-xs text-slate-500">Nous vous livrons chez vous</p>
                  </div>
                </div>
              </label>
              <label
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  isPickup ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="PICKUP"
                  checked={isPickup}
                  onChange={() => setForm({ ...form, deliveryMethod: 'PICKUP' })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <Store className="mt-0.5 h-5 w-5 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Retrait en magasin</p>
                    <p className="mt-0.5 text-xs text-slate-500">Récupération gratuite sur place</p>
                  </div>
                </div>
              </label>
            </div>

            {isPickup ? (
              <div className="mt-4 space-y-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div>
                    <p className="font-semibold text-slate-900">{storeName || 'Notre magasin'}</p>
                    <p className="text-slate-600">{storeAddress || 'Adresse du magasin'}</p>
                    {storePhone ? <p className="text-slate-600">Tél : {storePhone}</p> : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Heure de récupération souhaitée</label>
                  <input
                    required
                    type="datetime-local"
                    className={inputCls}
                    value={form.pickupTime}
                    onChange={(e) => setForm({ ...form, pickupTime: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Votre commande sera prête à l&apos;heure indiquée. Nous vous appellerons dès qu&apos;elle est disponible.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'order' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Mode de paiement</h2>
            <div className="cursor-pointer rounded-xl border border-brand-500 bg-brand-50 p-4">
              <div className="flex items-start gap-3">
                <input type="radio" name="paymentMethod" value="COD" checked readOnly className="mt-1 accent-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Paiement à la réception (espèces)</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Payez en espèces à la livraison ou lors du retrait en magasin.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Le paiement en ligne n&apos;est pas disponible : le règlement se fait en espèces à la réception.
            </p>
          </div>
        ) : null}

        {mode === 'order' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Facture</h2>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300">
              <input
                type="checkbox"
                checked={form.withInvoice}
                onChange={(e) => setForm({ ...form, withInvoice: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Je souhaite une facture</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  La TVA et le timbre fiscal seront inclus dans le total. Sans facture, le total est calculé hors taxes.
                </p>
              </div>
            </label>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Récapitulatif</h2>
          <ul className="mb-4 max-h-56 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  {i.quantity} × {i.name}
                </span>
                <span className="font-medium text-slate-900">{money(i.priceHT * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Total HT</span>
              <span>{money(subtotalHT)}</span>
            </div>
            {form.withInvoice ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>TVA</span>
                  <span>{money(tva)}</span>
                </div>
              </>
            ) : null}
            {mode === 'order' ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Livraison</span>
                  <span>{isPickup ? 'Offerte' : money(totalShipping)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-brand-950">
                  <span>{form.withInvoice ? 'Total TTC' : 'Total à payer'}</span>
                  <span>{money(subtotalHT + tva + totalShipping + (form.withInvoice ? 1 : 0))}</span>
                </div>
                {form.withInvoice ? <p className="text-[11px] text-slate-400">dont 1,000 DT de timbre fiscal</p> : null}
              </>
            ) : (
              <p className="pt-1 text-xs text-slate-400">
                Prix indicatifs — le devis final vous sera confirmé par notre équipe.
              </p>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-brand-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending
              ? 'Envoi…'
              : mode === 'quote'
                ? 'Envoyer ma demande de devis'
                : 'Confirmer la commande'}
          </button>
        </div>
      </div>
    </form>
  )
}