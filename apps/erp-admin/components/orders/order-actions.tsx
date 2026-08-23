'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { Button, Input, Select, Label } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

const ORDER_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmée' },
  { value: 'PREPARING', label: 'En préparation' },
  { value: 'SHIPPED', label: 'Expédiée' },
  { value: 'DELIVERED', label: 'Livrée' },
  { value: 'CANCELLED', label: 'Annulée' },
  { value: 'REFUNDED', label: 'Remboursée' },
]

export function CancelOrderButton({
  id,
  action,
}: {
  id: string
  action: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(id, reason || undefined)
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        setOpen(false)
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" /> Annuler la commande
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-slate-900">Annuler la commande</h3>
            <p className="mt-1 text-xs text-slate-500">La réservation de stock sera libérée.</p>
            {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-4">
              <Label>Motif (optionnel)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif de l'annulation…" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Retour
              </Button>
              <Button type="button" variant="danger" onClick={run} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Annulation…' : 'Confirmer l&apos;annulation'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function StatusUpdater({
  id,
  current,
  action,
}: {
  id: string
  current: string
  action: (id: string, status: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [status, setStatus] = useState(current)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(id, status)
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })
  }

  return (
    <div className="space-y-3 p-5">
      <div>
        <Label>Changer le statut</Label>
        <div className="flex gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {ORDER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Button type="button" onClick={run} disabled={pending || status === current}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Appliquer
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}