'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, CheckCheck, X, ShoppingBag, AlertTriangle, Wallet, FileCheck, PackageCheck, Info, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  createdAt: string
  isRead?: boolean
}

const TYPE_META: Record<string, { icon: React.ReactNode; tone: string }> = {
  NEW_ORDER: { icon: <ShoppingBag className="h-4 w-4" />, tone: 'bg-accent-400 text-[#0B0B0B]' },
  NEW_QUOTE_REQUEST: { icon: <FileText className="h-4 w-4" />, tone: 'bg-accent-400 text-[#0B0B0B]' },
  STOCK_ALERT: { icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-amber-500 text-white' },
  PAYMENT_RECEIVED: { icon: <Wallet className="h-4 w-4" />, tone: 'bg-emerald-500 text-white' },
  QUOTE_ACCEPTED: { icon: <FileCheck className="h-4 w-4" />, tone: 'bg-accent-400 text-[#0B0B0B]' },
  STOCK_RECEIVED: { icon: <PackageCheck className="h-4 w-4" />, tone: 'bg-white/20 text-white' },
  SYSTEM: { icon: <Info className="h-4 w-4" />, tone: 'bg-white/10 text-white/70' },
}

const TYPE_SOUND: Record<string, { freq: number[]; dur: number }> = {
  NEW_ORDER: { freq: [880, 1174.66], dur: 0.18 },
  NEW_QUOTE_REQUEST: { freq: [659.25, 783.99, 1046.5], dur: 0.16 },
  STOCK_ALERT: { freq: [440, 554.37], dur: 0.16 },
  PAYMENT_RECEIVED: { freq: [659.25, 880], dur: 0.16 },
  QUOTE_ACCEPTED: { freq: [783.99, 1046.5], dur: 0.16 },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'à l\'instant'
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function useChime(enabled: boolean) {
  return useCallback(
    (type: string) => {
      if (!enabled) return
      const meta = TYPE_SOUND[type]
      const freqs = meta?.freq ?? [660, 880]
      const dur = meta?.dur ?? 0.16
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.14)
          gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.14 + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + dur)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(ctx.currentTime + i * 0.14)
          osc.stop(ctx.currentTime + i * 0.14 + dur + 0.05)
        })
      } catch {
        /* audio indisponible */
      }
    },
    [enabled],
  )
}

export function NotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts, setToasts] = useState<NotificationItem[]>([])
  const [hintVisible, setHintVisible] = useState(true)
  const esRef = useRef<EventSource | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const playChime = useChime(soundEnabled)

  useEffect(() => {
    const enable = () => {
      setSoundEnabled(true)
      setHintVisible(false)
      window.removeEventListener('pointerdown', enable)
      window.removeEventListener('keydown', enable)
    }
    window.addEventListener('pointerdown', enable)
    window.addEventListener('keydown', enable)
    return () => {
      window.removeEventListener('pointerdown', enable)
      window.removeEventListener('keydown', enable)
    }
  }, [])

  const pushToast = useCallback((n: NotificationItem) => {
    setToasts((prev) => [...prev, n].slice(-3))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== n.id))
    }, 6500)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notifications')
        const data = (await res.json()) as { notifications: NotificationItem[]; unreadCount: number }
        setItems(data.notifications)
        setUnread(data.unreadCount)
      } catch {
        /* silencieux */
      }
    }
    void load()

    const es = new EventSource('/api/events')
    esRef.current = es
    es.addEventListener('notification', (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data) as NotificationItem
      if (payload.isRead) return
      setItems((prev) => [payload, ...prev].slice(0, 60))
      setUnread((u) => u + 1)
      playChime(payload.type)
      pushToast(payload)
    })
    return () => {
      es.close()
      esRef.current = null
    }
  }, [playChime, pushToast])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const markRead = async (n: NotificationItem) => {
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)))
    setUnread((u) => Math.max(0, u - 1))
    void fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id }),
    })
    if (n.link) router.push(n.link)
    setOpen(false)
  }

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })))
    setUnread(0)
    void fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  const meta = (type: string) => TYPE_META[type] ?? TYPE_META.SYSTEM!

  return (
    <div className="relative" ref={panelRef}>
      {/* Toasts */}
      <div className="fixed right-4 top-16 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const m = meta(t.type)
          return (
            <div key={t.id} className="animate-toast-in flex items-start gap-3 rounded-xl border border-[#2A2A2A] bg-[#151515] p-3 shadow-lifted">
              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', m.tone)}>
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{t.message}</p>
              </div>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-white/40 hover:text-white/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Bouton cloche */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-accent-400"
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-[#0B0B0B]">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 animate-pulse-dot rounded-full bg-accent-400" />}
      </button>

      {/* Panneau */}
      {open ? (
        <div className="absolute right-0 top-12 z-40 w-96 overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#151515] shadow-lifted">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
            <div>
              <p className="font-display text-sm font-semibold text-white">Notifications</p>
              {soundEnabled ? (
                <p className="text-[11px] text-emerald-400">Notifications sonores activées</p>
              ) : (
                <p className="text-[11px] text-white/40">Son activé après le premier clic</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/10"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tout lire
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-white/40 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {hintVisible && (
              <button
                onClick={() => {
                  setSoundEnabled(true)
                  setHintVisible(false)
                }}
                className="flex w-full items-center gap-2 bg-accent-400/10 px-4 py-2.5 text-left text-xs font-medium text-accent-400 hover:bg-accent-400/20"
              >
                <BellRing className="h-4 w-4" />
                Activer les notifications sonores
              </button>
            )}
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-white/40">Aucune notification</p>
            ) : (
              items.map((n) => {
                const m = meta(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-[#2A2A2A] px-4 py-3 text-left transition-colors hover:bg-white/5',
                      !n.isRead && 'bg-accent-400/5',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', m.tone)}>
                      {m.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-white/50">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-white/40">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-400" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
