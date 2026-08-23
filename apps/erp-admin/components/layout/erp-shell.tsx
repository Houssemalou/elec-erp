'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap, LogOut } from 'lucide-react'
import type { Role } from '@elec/db'
import { cn, ROLE_LABELS } from '@/lib/utils'
import { NAV_GROUPS } from '@/lib/navigation'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { logoutAction } from '@/lib/actions/auth'
import { startActionLoader } from '@/lib/action-events'

function SidebarContent({ role, onNavigate, logoUrl }: { role: Role; onNavigate?: () => void; logoUrl?: string | null }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt="ElectroNova HA" className="h-9 w-9 rounded-xl object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-500 shadow-sm">
            <Zap className="h-5 w-5 text-brand-950" />
          </div>
        )}
        <div>
          <p className="font-display text-sm font-bold text-white">ElectroNova HA ERP</p>
          <p className="text-[11px] text-brand-300">Gestion magasin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => i.roles.includes(role))
          if (items.length === 0) return null
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-brand-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-brand-200 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <item.icon className={cn('h-4 w-4', active && 'text-accent-400')} />
                        {item.label}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-xs text-brand-300">Rôle : {ROLE_LABELS[role] ?? role}</p>
      </div>
    </div>
  )
}

export function ErpShell({
  children,
  userName,
  role,
  logoUrl,
}: {
  children: React.ReactNode
  userName: string
  role: Role
  logoUrl?: string | null
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-900 lg:block">
        <SidebarContent role={role} logoUrl={logoUrl} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-900 shadow-lifted">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 text-brand-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent role={role} onNavigate={() => setMobileOpen(false)} logoUrl={logoUrl} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-slate-400 sm:block">Espace de gestion</span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationCenter />
            <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <form action={logoutAction} onSubmit={startActionLoader}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}