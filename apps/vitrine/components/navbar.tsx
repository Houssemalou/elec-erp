'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, ShoppingCart, Menu, X } from 'lucide-react'
import { useCart } from './cart/cart-provider'
import { cn } from '@/lib/utils'

export function CartIcon() {
  const { count, setOpen } = useCart()
  return (
    <button
      onClick={() => setOpen(true)}
      className="relative rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
      aria-label="Panier"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function CartDrawer() {
  const { items, isOpen, setOpen, setQuantity, remove, subtotalHT, clear } = useCart()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  if (!isOpen) return null

  const tva = items.reduce((s, i) => s + i.priceHT * i.quantity * (i.taxRate / 100), 0)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-lifted">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-brand-950">Votre panier</h2>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="h-12 w-12 text-slate-200" />
              <p className="text-sm text-slate-500">Votre panier est vide.</p>
              <Link
                href="/produits"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Découvrir nos produits
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((i) => (
                <li key={i.productId} className="flex gap-3">
                  {i.image ? (
                    <img src={i.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-brand-50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/produits/${i.slug}`} onClick={() => setOpen(false)} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {i.name}
                    </Link>
                    <p className="text-xs text-slate-400">{money(i.priceHT)} HT / {i.unit}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button onClick={() => setQuantity(i.productId, i.quantity - 1)} className="px-2 py-1 text-slate-500 hover:text-brand-800">−</button>
                        <span className="w-8 text-center text-sm">{i.quantity}</span>
                        <button onClick={() => setQuantity(i.productId, i.quantity + 1)} className="px-2 py-1 text-slate-500 hover:text-brand-800">+</button>
                      </div>
                      <button onClick={() => remove(i.productId)} className="text-xs text-slate-400 hover:text-red-600">
                        Retirer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>Total HT</span>
              <span>{money(subtotalHT)}</span>
            </div>
            <div className="mb-3 flex justify-between text-sm text-slate-600">
              <span>TVA</span>
              <span>{money(tva)}</span>
            </div>
            <div className="mb-4 flex justify-between text-base font-bold text-brand-950">
              <span>Total TTC</span>
              <span>{money(subtotalHT + tva)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-accent-500 py-3 text-center text-sm font-bold text-brand-950 transition-colors hover:bg-accent-400"
            >
              Passer commande
            </Link>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export function Navbar({ storeName = 'ElectroNova HA', logoUrl }: { storeName?: string; logoUrl?: string | null }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const links = [
    { href: '/', label: 'Accueil' },
    { href: '/produits', label: 'Produits' },
    { href: '/produits?categorie=cables-et-fils', label: 'Câbles' },
    { href: '/produits?categorie=eclairage', label: 'Éclairage' },
    { href: '/demande-devis', label: 'Demander un devis' },
  ]
  const brandWords = storeName.split(' ').filter(Boolean)
  const brandLast = brandWords.length > 1 ? brandWords.pop() : ''
  const brandFirst = brandWords.join(' ')

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 w-9 rounded-xl object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-500">
                <Zap className="h-5 w-5 text-brand-950" />
              </div>
            )}
            <span className="font-display text-lg font-bold text-brand-950">
              {brandFirst ? <>{brandFirst} </> : null}
              <span className="text-accent-500">{brandLast || 'Ele'}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const [path] = l.href.split('?')
              const active = pathname === path && l.href !== '/produits?categorie=cables-et-fils'
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-brand-800' : 'text-slate-600 hover:text-brand-800',
                  )}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1">
            <CartIcon />
            <button onClick={() => setMobileOpen((o) => !o)} className="rounded-lg p-2 text-slate-600 md:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <CartDrawer />
    </>
  )
}

function money(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`
}