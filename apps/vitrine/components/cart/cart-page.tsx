'use client'

import Link from 'next/link'
import { useCart } from '@/components/cart/cart-provider'
import { money } from '@/lib/format'
import { Trash2, ShoppingCart, ArrowRight } from 'lucide-react'

export function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <ShoppingCart className="h-14 w-14 text-[var(--text-muted)]" />
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Votre panier est vide</h1>
        <p className="text-sm text-[var(--text-muted)]">Découvrez notre catalogue de matériel électrique.</p>
        <Link href="/produits" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-400 px-6 py-3 text-sm font-bold text-[#0B0B0B] hover:bg-accent-300">
          Voir le catalogue <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--text-primary)]">Mon panier</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="space-y-4">
            {items.map((i) => (
              <li key={i.productId} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-card">
                {i.image ? (
                  <img src={i.image} alt="" className="h-24 w-24 rounded-xl object-cover" />
                ) : (
                  <div className="h-24 w-24 rounded-xl bg-[var(--bg-primary)]" />
                )}
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/produits/${i.slug}`} className="font-medium text-[var(--text-primary)] hover:text-accent-400">
                        {i.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Réf. {i.sku}</p>
                    </div>
                    <button onClick={() => remove(i.productId)} className="text-[var(--text-muted)] hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-lg border border-[var(--border)]">
                      <button onClick={() => setQuantity(i.productId, i.quantity - 1)} className="px-3 py-1.5 text-[var(--text-secondary)] hover:text-accent-400">−</button>
                      <span className="w-10 text-center text-sm text-[var(--text-primary)]">{i.quantity}</span>
                      <button onClick={() => setQuantity(i.productId, i.quantity + 1)} className="px-3 py-1.5 text-[var(--text-secondary)] hover:text-accent-400">+</button>
                    </div>
                    <p className="font-semibold text-accent-400">{money(i.priceHT * i.quantity * (1 + i.taxRate / 100))}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-semibold text-[var(--text-primary)]">Récapitulatif</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-base font-bold text-[var(--text-primary)]">
                <span>Total</span>
                <span>{money(subtotal)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-5 block rounded-xl bg-accent-400 py-3.5 text-center text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300 hover:shadow-glow"
            >
              Passer commande
            </Link>
            <Link href="/produits" className="mt-3 block text-center text-sm text-[var(--text-muted)] hover:text-accent-400">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
