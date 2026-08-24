'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPosSaleAction } from '@/lib/actions/erp'
import { money } from '@/lib/utils'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  Loader2,
  CheckCircle2,
  User,
} from 'lucide-react'

type Product = {
  id: string
  sku: string
  name: string
  priceHT: number
  unit: string
  taxRate: number
  categoryName: string | null
  stock: number
}

type CartItem = {
  productId: string
  sku: string
  name: string
  priceHT: number
  taxRate: number
  quantity: number
}

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
}

export default function PosTerminal({
  products,
  customers,
}: {
  products: Product[]
  customers: Customer[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [success, setSuccess] = useState<{ id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.categoryName ?? '').toLowerCase().includes(q),
    )
  }, [products, search])

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          priceHT: product.priceHT,
          taxRate: product.taxRate,
          quantity: 1,
        },
      ]
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const subtotalHT = cart.reduce((s, i) => s + i.priceHT * i.quantity, 0)
  const totalTVA = cart.reduce((s, i) => s + i.priceHT * i.quantity * (i.taxRate / 100), 0)
  const totalTTC = subtotalHT + totalTVA

  const handleSubmit = async () => {
    if (cart.length === 0) return
    if (!customerId) {
      setError('Sélectionnez un client')
      return
    }
    setError(null)

    const fd = new FormData()
    fd.set('customerId', customerId)
    fd.set('paymentMethod', paymentMethod)
    fd.set('lines', JSON.stringify(cart.map((i) => ({ productId: i.productId, quantity: i.quantity }))))

    startTransition(async () => {
      const res = await createPosSaleAction(fd)
      if (res.success && res.id) {
        setSuccess({ id: res.id })
        setCart([])
        setCustomerId('')
        setPaymentMethod('CASH')
        setSearch('')
      } else {
        setError(res.error ?? 'Erreur lors de la vente')
      }
    })
  }

  if (success) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-950">Vente enregistrée !</h2>
          <p className="mt-2 text-sm text-slate-500">
            Facture créée, stock mis à jour, paiement enregistré.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => {
                setSuccess(null)
                router.refresh()
              }}
              className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Nouvelle vente
            </button>
            <button
              onClick={() => router.push(`/factures/${success.id}`)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voir la facture
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
      {/* Left: Products */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit (nom, réf., catégorie)..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
              >
                <span className="text-[10px] font-medium text-slate-400">{p.sku}</span>
                <span className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{p.name}</span>
                {p.categoryName ? (
                  <span className="mt-0.5 text-[10px] text-slate-400">{p.categoryName}</span>
                ) : null}
                <span className="mt-auto pt-2 font-display text-base font-bold text-brand-800">
                  {money(p.priceHT)} <span className="text-[10px] font-normal text-slate-400">HT</span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-slate-400">Aucun produit trouvé</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="flex w-[380px] flex-col bg-slate-50">
        {/* Customer */}
        <div className="border-b border-slate-200 bg-white p-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <User className="h-3.5 w-3.5" /> Client
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">— Client comptoir —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.companyName ? ` (${c.companyName})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-slate-200" />
              <p className="mt-2 text-sm text-slate-400">Panier vide</p>
              <p className="text-xs text-slate-300">Cliquez sur un produit pour l&apos;ajouter</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((item) => {
                const lineTTC = item.priceHT * item.quantity * (1 + item.taxRate / 100)
                return (
                  <li key={item.productId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {money(item.priceHT)} HT &times; {item.quantity}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.productId)} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button
                          onClick={() => updateQty(item.productId, item.quantity - 1)}
                          className="px-2 py-1 text-slate-500 hover:text-brand-800"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, item.quantity + 1)}
                          className="px-2 py-1 text-slate-500 hover:text-brand-800"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-brand-900">{money(lineTTC)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Total HT</span>
              <span>{money(subtotalHT)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>TVA</span>
              <span>{money(totalTVA)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-brand-950">
              <span>Total TTC</span>
              <span>{money(totalTTC)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'CASH'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Banknote className="h-4 w-4" /> Espèces
            </button>
            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'CARD'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <CreditCard className="h-4 w-4" /> Carte
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? 'Enregistrement...' : `Encaisser ${money(totalTTC)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
