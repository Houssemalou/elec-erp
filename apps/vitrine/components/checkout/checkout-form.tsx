'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrderAction, createQuoteRequestAction, getShippingCost } from '@/lib/actions'
import { useCart } from '@/components/cart/cart-provider'
import { money } from '@/lib/format'
import { Loader2, MapPin, ShoppingCart, Store, Truck, FileText, CheckCircle2, Zap, AlertTriangle } from 'lucide-react'

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
  const [showConfirm, setShowConfirm] = useState(false)
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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--border)] py-20 text-center">
        <ShoppingCart className="h-10 w-10 text-[var(--text-muted)]" />
        <p className="text-[var(--text-muted)]">Votre panier est vide.</p>
        <Link href="/produits" className="rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-bold text-[#0B0B0B] hover:bg-accent-300">
          Voir le catalogue
        </Link>
      </div>
    )
  }

  const tva = items.reduce((s, i) => s + i.priceHT * i.quantity * (i.taxRate / 100), 0)
  const totalShipping = isPickup ? 0 : shippingCost
  const shippingTVA = isPickup ? 0 : (Math.round(totalShipping * 0.19 * 1000) / 1000)

  if (successQuote) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-[var(--text-primary)]">Demande de devis envoyée !</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Votre demande de devis <span className="font-mono font-semibold text-accent-400">{successQuote}</span> pour l&apos;ensemble
            de votre panier a bien été enregistrée. Notre équipe vous préparera un devis et vous contactera rapidement.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-400 hover:text-accent-300">
              <Zap className="h-4 w-4" /> Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const submit = async () => {
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
        router.push(`/commande-confirmee?id=${res.orderId}`)
      } else {
        setError(res.error ?? 'Une erreur est survenue')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirm(true)
  }

  const inputCls =
    'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20'

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Comment souhaitez-vous procéder ?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                mode === 'order' ? 'border-accent-400 bg-accent-400/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
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
                <ShoppingCart className="mt-0.5 h-5 w-5 text-accent-400" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Confirmer ma commande</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Je commande maintenant et je règle à la livraison.</p>
                </div>
              </div>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                mode === 'quote' ? 'border-accent-400 bg-accent-400/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
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
                <FileText className="mt-0.5 h-5 w-5 text-accent-400" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Demander un devis</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Un devis gratuit pour l&apos;ensemble de mon panier.</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Coordonnées</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Nom complet</label>
              <input required className={inputCls} value={form.shippingFullName} onChange={(e) => setForm({ ...form, shippingFullName: e.target.value })} placeholder="Nom et prénom" />
            </div>
            {mode === 'quote' ? (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">E-mail (pour la réponse à votre devis)</label>
                <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.tn" />
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">CIN (carte d&apos;identité)</label>
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
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Téléphone</label>
              <input required className={inputCls} value={form.shippingPhone} onChange={(e) => setForm({ ...form, shippingPhone: e.target.value })} placeholder="+216 …" />
            </div>
            {!isPickup && mode === 'order' ? (
              <>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Adresse de livraison</label>
                  <input required className={inputCls} value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} placeholder="Rue, numéro, bâtiment…" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Ville</label>
                  <input required className={inputCls} value={form.shippingCity} onChange={(e) => setForm({ ...form, shippingCity: e.target.value })} />
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Note (optionnel)</label>
              <input className={inputCls} value={form.shippingNote} onChange={(e) => setForm({ ...form, shippingNote: e.target.value })} />
            </div>
          </div>
        </div>

        {mode === 'order' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Mode de réception</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  !isPickup ? 'border-accent-400 bg-accent-400/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
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
                  <Truck className="mt-0.5 h-5 w-5 text-accent-400" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Livraison à domicile</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Nous vous livrons chez vous</p>
                  </div>
                </div>
              </label>
              <label
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                  isPickup ? 'border-accent-400 bg-accent-400/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
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
                  <Store className="mt-0.5 h-5 w-5 text-accent-400" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Retrait en magasin</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Récupération gratuite sur place</p>
                  </div>
                </div>
              </label>
            </div>

            {isPickup ? (
              <div className="mt-4 space-y-4 rounded-xl border border-accent-400/20 bg-accent-400/5 p-4">
                <div className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{storeName || 'Notre magasin'}</p>
                    <p className="text-[var(--text-secondary)]">{storeAddress || 'Adresse du magasin'}</p>
                    {storePhone ? <p className="text-[var(--text-secondary)]">Tél : {storePhone}</p> : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Heure de récupération souhaitée</label>
                  <input
                    required
                    type="datetime-local"
                    className={inputCls}
                    value={form.pickupTime}
                    onChange={(e) => setForm({ ...form, pickupTime: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Votre commande sera prête à l&apos;heure indiquée. Nous vous appellerons dès qu&apos;elle est disponible.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'order' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Mode de paiement</h2>
            <div className="cursor-pointer rounded-xl border border-accent-400 bg-accent-400/10 p-4">
              <div className="flex items-start gap-3">
                <input type="radio" name="paymentMethod" value="COD" checked readOnly className="mt-1 accent-[#FFC400]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Paiement à la réception (espèces)</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Payez en espèces à la livraison ou lors du retrait en magasin.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Le paiement en ligne n&apos;est pas disponible : le règlement se fait en espèces à la réception.
            </p>
          </div>
        ) : null}

        {mode === 'order' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Facture</h2>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 transition-colors hover:border-accent-400/30">
              <input
                type="checkbox"
                checked={form.withInvoice}
                onChange={(e) => setForm({ ...form, withInvoice: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-input)] accent-[#FFC400]"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Je souhaite une facture</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Avec facture, un timbre fiscal de 1 DT s&apos;ajoute au total.
                </p>
              </div>
            </label>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-24 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Récapitulatif</h2>
          <ul className="mb-4 max-h-56 space-y-2 overflow-y-auto">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {i.quantity} × {i.name}
                </span>
                <span className="font-medium text-[var(--text-primary)]">{money(i.priceHT * i.quantity * (1 + i.taxRate / 100))}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-[var(--border)] pt-4 text-sm">
            {mode === 'order' ? (
              <>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Livraison</span>
                  <span>{isPickup ? 'Offerte' : money(totalShipping)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--text-primary)]">
                  <span>Total</span>
                  <span>{money(subtotalHT + tva + totalShipping + shippingTVA + (form.withInvoice ? 1 : 0))}</span>
                </div>
                {form.withInvoice ? <p className="text-[11px] text-[var(--text-muted)]">dont 1,000 DT de timbre fiscal</p> : null}
              </>
            ) : (
              <p className="pt-1 text-xs text-[var(--text-muted)]">
                Prix indicatifs — le devis final vous sera confirmé par notre équipe.
              </p>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-400 py-3.5 text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300 hover:shadow-glow disabled:opacity-60"
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

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-lifted">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  {mode === 'order' ? 'Confirmer la commande' : 'Envoyer la demande de devis'}
                </h3>
                {mode === 'order' ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Vous confirmez votre commande de <span className="font-semibold text-[var(--text-primary)]">{items.reduce((s, i) => s + i.quantity, 0)} article(s)</span> pour un
                    total de <span className="font-semibold text-accent-400">{money(subtotalHT + tva + totalShipping + shippingTVA + (form.withInvoice ? 1 : 0))}</span>.
                    {form.withInvoice ? ' Un timbre fiscal de 1 DT est inclus.' : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Votre demande de devis portera sur {items.reduce((s, i) => s + i.quantity, 0)} article(s). Notre équipe vous répondra rapidement.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false)
                  submit()
                }}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300 hover:shadow-glow disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Envoi…' : mode === 'order' ? 'Oui, confirmer' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  )
}
