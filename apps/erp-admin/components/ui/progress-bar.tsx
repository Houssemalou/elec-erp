'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function ProgressBar() {
  const pathname = usePathname()
  const [progress, setProgress] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setProgress(100)
    const t = setTimeout(() => setProgress(null), 350)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//') || anchor.getAttribute('target') === '_blank') return
      if (intervalRef.current) return
      setProgress((p) => (p === null ? 15 : p))
      intervalRef.current = setInterval(() => {
        setProgress((p) => (p === null ? 15 : Math.min(p + (100 - p) * 0.15, 85)))
      }, 200)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    },
    [],
  )

  if (progress === null) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-accent-400 via-accent-300 to-accent-500 transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
