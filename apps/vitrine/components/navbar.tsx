'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, ShoppingCart, LayoutGrid, Menu, X, Sun, Moon } from 'lucide-react'
import { useCart } from './cart/cart-provider'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'

export function CartIcon() {
  const { count, setOpen } = useCart()
  return (
    <button
      onClick={() => setOpen(true)}
      className="relative rounded-xl p-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--border)] hover:text-accent-400"
      aria-label="Panier"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-[#0B0B0B]">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="rounded-xl p-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--border)] hover:text-accent-400"
      aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

export function CartDrawer() {
  const { items, isOpen, setOpen, setQuantity, remove, subtotal, clear } = useCart()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[var(--bg-card)] shadow-lifted">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Votre panier</h2>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="h-12 w-12 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">Votre panier est vide.</p>
              <Link
                href="/produits"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-bold text-[#0B0B0B] hover:bg-accent-300"
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
                    <div className="h-16 w-16 rounded-xl bg-[var(--bg-primary)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/produits/${i.slug}`} onClick={() => setOpen(false)} className="block truncate text-sm font-medium text-[var(--text-primary)] hover:text-accent-400">
                      {i.name}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">{money(i.priceHT * (1 + i.taxRate / 100))} / {i.unit}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-[var(--border)]">
                        <button onClick={() => setQuantity(i.productId, i.quantity - 1)} className="px-2 py-1 text-[var(--text-secondary)] hover:text-accent-400">−</button>
                        <span className="w-8 text-center text-sm text-[var(--text-primary)]">{i.quantity}</span>
                        <button onClick={() => setQuantity(i.productId, i.quantity + 1)} className="px-2 py-1 text-[var(--text-secondary)] hover:text-accent-400">+</button>
                      </div>
                      <button onClick={() => remove(i.productId)} className="text-xs text-[var(--text-muted)] hover:text-red-500">
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
          <div className="border-t border-[var(--border)] px-5 py-4">
            <div className="mb-4 flex justify-between text-base font-bold text-[var(--text-primary)]">
              <span>Total</span>
              <span>{money(subtotal)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-accent-400 py-3 text-center text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300"
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
  const { count } = useCart()
  const links = [
    { href: '/', label: 'Accueil' },
    { href: '/produits', label: 'Produits' },
    { href: '/produits?categorie=cables-et-fils', label: 'Câbles' },
    { href: '/produits?categorie=eclairage', label: 'Éclairage' },
    { href: '/demande-devis', label: 'Demander un devis' },
  ]

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-md"
        style={{
          backgroundImage: 'url(/electronova-logo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay',
        }}
      >
        <div className="absolute inset-0 bg-[var(--header-bg)]" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 w-9 rounded-xl object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-400">
                <Zap className="h-5 w-5 text-[#0B0B0B]" />
              </div>
            )}
            <span className="font-display text-lg font-bold text-[var(--text-primary)]">
              ElectroNova <span className="text-accent-400">HA</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => {
              const [path] = l.href.split('?')
              const active = pathname === path && l.href !== '/produits?categorie=cables-et-fils'
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-lg px-2.5 py-2 text-sm font-medium transition-colors xl:px-3',
                    active ? 'text-accent-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <Link
              href="/produits"
              className="hidden items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-accent-400/40 hover:text-accent-400 lg:inline-flex"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="xl:hidden">Catalogue</span>
              <span className="hidden xl:inline">Voir le catalogue</span>
            </Link>
            <Link
              href="/panier"
              className="relative hidden items-center gap-1.5 rounded-xl bg-accent-400 px-3 py-2 text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300 lg:inline-flex"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="xl:hidden">Panier</span>
              <span className="hidden xl:inline">Voir mon panier</span>
              {count > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0B0B0B] px-1 text-[11px] font-bold text-accent-400">
                  {count}
                </span>
              ) : null}
            </Link>
            <ThemeToggle />
            <div className="lg:hidden">
              <CartIcon />
            </div>
            <button onClick={() => setMobileOpen((o) => !o)} className="rounded-lg p-2 text-[var(--text-secondary)] lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="relative border-t border-[var(--header-border)] bg-[var(--bg-primary)] px-4 py-4 lg:hidden">
            <div className="mb-3 grid grid-cols-1 gap-2">
              <Link
                href="/produits"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300"
              >
                <LayoutGrid className="h-4 w-4" />
                Voir le catalogue
              </Link>
              <Link
                href="/panier"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-accent-400/40 hover:text-accent-400"
              >
                <ShoppingCart className="h-4 w-4" />
                Voir mon panier
                {count > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-[#0B0B0B]">
                    {count}
                  </span>
                ) : null}
              </Link>
            </div>
            <nav className="border-t border-[var(--header-border)] pt-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-accent-400"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>
      <CartDrawer />
    </>
  )
}
