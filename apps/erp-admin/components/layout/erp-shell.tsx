'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap, LogOut, Lock, LockOpen, KeyRound, CheckCircle2 } from 'lucide-react'
import type { Role } from '@elec/db'
import { cn, ROLE_LABELS } from '@/lib/utils'
import { NAV_GROUPS } from '@/lib/navigation'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { logoutAction } from '@/lib/actions/auth'
import { startActionLoader } from '@/lib/action-events'

const UNLOCK_CODE = 'haaloui20252026'
const UNLOCK_KEY = 'erp-sections-unlocked'
const OPEN_SECTIONS = new Set(['/pos', '/ventes-caisse', '/commandes', '/devis', '/factures', '/avoirs'])
const OPEN_GROUPS = new Set(['Ventes', 'Catalogue & stock'])

function SidebarContent({
  role,
  onNavigate,
  logoUrl,
  unlocked,
}: {
  role: Role
  onNavigate?: () => void
  logoUrl?: string | null
  unlocked: boolean
}) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt="ElectroNova HA" className="h-9 w-9 rounded-xl object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-400">
            <Zap className="h-5 w-5 text-accent-400" />
          </div>
        )}
        <div>
          <p className="font-display text-sm font-bold text-white">ElectroNova HA ERP</p>
          <p className="text-[11px] text-white/50">Gestion magasin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => i.roles.includes(role))
          if (items.length === 0) return null
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const lockedItem = !unlocked && !OPEN_GROUPS.has(group.label)
                  if (lockedItem) {
                    return (
                      <li key={item.href}>
                        <span
                          title="Section verrouillée — entrez le code de déblocage dans la barre supérieure"
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/30"
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                          <Lock className="ml-auto h-3.5 w-3.5 text-white/15" />
                        </span>
                      </li>
                    )
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-accent-400/10 text-accent-400 shadow-sm'
                            : 'text-white/60 hover:bg-white/5 hover:text-white',
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

      <div className="border-t border-[#2A2A2A] px-4 py-3">
        <p className="text-xs text-white/50">Rôle : {ROLE_LABELS[role] ?? role}</p>
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
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    try {
      if (localStorage.getItem(UNLOCK_KEY) === '1') setUnlocked(true)
    } catch {
      /* ignore */
    }
  }, [])

  const segment = '/' + (pathname.split('/')[1] ?? '')
  const showLockPanel = !unlocked && !OPEN_SECTIONS.has(segment)

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim() === UNLOCK_CODE) {
      setUnlocked(true)
      setCodeError(false)
      setCode('')
      try {
        localStorage.setItem(UNLOCK_KEY, '1')
      } catch {
        /* ignore */
      }
    } else {
      setCodeError(true)
    }
  }

  const handleRelock = () => {
    setUnlocked(false)
    setCode('')
    try {
      localStorage.removeItem(UNLOCK_KEY)
    } catch {
      /* ignore */
    }
  }

  const shell = () => (
    <div className="flex min-h-screen bg-[#0B0B0B]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-[#0B0B0B] lg:block">
        <SidebarContent role={role} logoUrl={logoUrl} unlocked={unlocked} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#0B0B0B] shadow-lifted">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 text-white/50 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent role={role} onNavigate={() => setMobileOpen(false)} logoUrl={logoUrl} unlocked={unlocked} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#2A2A2A] bg-[#0B0B0B]/95 px-4 backdrop-blur-lg lg:px-6"
          style={{
            backgroundImage: 'url(/electronova-logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay',
          }}
        >
          <div className="absolute inset-0 bg-[#0B0B0B]/80" />
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-white/50 sm:block">Espace de gestion</span>
          </div>

          <div className="relative flex items-center gap-2">
            {!unlocked ? (
              <form onSubmit={handleUnlock} className="relative mr-1 flex items-center gap-1.5">
                <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setCodeError(false)
                  }}
                  placeholder={codeError ? 'Code incorrect' : 'Code de déblocage'}
                  title="Code de déblocage des sections"
                  className={cn(
                    'h-9 w-32 rounded-lg border bg-[#151515] pl-8 pr-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-400/20 sm:w-44',
                    codeError ? 'border-red-500' : 'border-[#2A2A2A] focus:border-accent-400',
                  )}
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-400 px-3 text-xs font-semibold text-[#0B0B0B] hover:bg-accent-300"
                >
                  <LockOpen className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Débloquer</span>
                </button>
              </form>
            ) : (
              <div className="mr-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden text-xs font-medium text-emerald-400 lg:inline">Toutes les sections débloquées</span>
                <button
                  type="button"
                  onClick={handleRelock}
                  title="Re-verrouiller les sections"
                  className="ml-1 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Lock className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <NotificationCenter />
            <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent-400 text-sm font-bold text-accent-400">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <form action={logoutAction} onSubmit={startActionLoader}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {showLockPanel ? (
            <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#2A2A2A] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-400/10">
                <Lock className="h-8 w-8 text-accent-400" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-white">Section verrouillée</h2>
              <p className="mt-2 max-w-md text-sm text-white/50">
                Saisissez le code de déblocage dans la barre supérieure pour rendre toutes les sections du
                back-office accessibles.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )

  return shell()
}
