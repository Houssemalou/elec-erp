'use client'

import Link from 'next/link'
import { useCart } from '@/components/cart/cart-provider'
import { money } from '@/lib/format'
import { Trash2, ShoppingCart, ArrowRight } from 'lucide-react'

export function CartPage() {
  const { items, setQuantity, remove, subtotalHT } = useCart()
  const tva = items.reduce((s, i) => s + i.priceHT * i.quantity * (i.taxRate / 100), 0)

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <ShoppingCart className="h-14 w-14 text-slate-200" />
        <h1 className="font-display text-2xl font-bold text-brand-950">Votre panier est vide</h1>
        <p className="text-sm text-slate-500">Découvrez notre catalogue de matériel électrique.</p>
        <Link href="/produits" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700">
          Voir le catalogue <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 font-display text-3xl font-bold text-brand-950">Mon panier</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="space-y-4">
            {items.map((i) => (
              <li key={i.productId} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                {i.image ? (
                  <img src={i.image} alt="" className="h-24 w-24 rounded-xl object-cover" />
                ) : (
                  <div className="h-24 w-24 rounded-xl bg-brand-50" />
                )}
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/produits/${i.slug}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {i.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">Réf. {i.sku} · TVA {i.taxRate}%</p>
                    </div>
                    <button onClick={() => remove(i.productId)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button onClick={() => setQuantity(i.productId, i.quantity - 1)} className="px-3 py-1.5 text-slate-500 hover:text-brand-800">−</button>
                      <span className="w-10 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => setQuantity(i.productId, i.quantity + 1)} className="px-3 py-1.5 text-slate-500 hover:text-brand-800">+</button>
                    </div>
                    <p className="font-semibold text-brand-950">{money(i.priceHT * i.quantity)} <span className="text-xs font-normal text-slate-400">HT</span></p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-brand-950">Récapitulatif</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Total HT</span><span>{money(subtotalHT)}</span></div>
              <div className="flex justify-between text-slate-600"><span>TVA</span><span>{money(tva)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-brand-950">
                <span>Total TTC</span>
                <span>{money(subtotalHT + tva)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-5 block rounded-xl bg-accent-500 py-3.5 text-center text-sm font-bold text-brand-950 transition-colors hover:bg-accent-400"
            >
              Passer commande
            </Link>
            <Link href="/produits" className="mt-3 block text-center text-sm text-slate-500 hover:text-brand-700">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}