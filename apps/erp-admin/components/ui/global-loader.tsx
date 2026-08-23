'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ACTION_START, ACTION_COMPLETE } from '@/lib/action-events'

export function GlobalLoader() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const start = () => setPending(true)
    const stop = () => setPending(false)
    window.addEventListener(ACTION_START, start)
    window.addEventListener(ACTION_COMPLETE, stop)
    return () => {
      window.removeEventListener(ACTION_START, start)
      window.removeEventListener(ACTION_COMPLETE, stop)
    }
  }, [])

  useEffect(() => {
    if (!pending) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 150)
    return () => clearTimeout(t)
  }, [pending])

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => {
      setPending(false)
      setShow(false)
    }, 20000)
    return () => clearTimeout(t)
  }, [show])

  useEffect(() => {
    setPending(false)
  }, [pathname])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-12 py-10 shadow-lifted ring-1 ring-slate-200">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
        <p className="text-sm font-semibold text-slate-700">Traitement en cours…</p>
      </div>
    </div>
  )
}