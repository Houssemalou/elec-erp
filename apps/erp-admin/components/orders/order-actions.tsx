'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle, FileText, Pencil } from 'lucide-react'
import { Button, Input, Select, Label } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

const ORDER_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmée' },
  { value: 'PREPARING', label: 'En préparation' },
  { value: 'SHIPPED', label: 'Expédiée' },
  { value: 'DELIVERED', label: 'Livrée' },
]

export function GenerateInvoiceButton({
  id,
  action,
}: {
  id: string
  action: (id: string, fd?: FormData) => Promise<{ success: boolean; error?: string; id?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'AMOUNT'>('NONE')
  const [discountValue, setDiscountValue] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const run = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const fd = new FormData()
        if (discountType !== 'NONE') {
          fd.set('discountType', discountType)
          fd.set('discountValue', discountValue || '0')
        }
        const res = await action(id, fd)
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" /> Générer la facture
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-white">Générer la facture</h3>
            <p className="mt-1 text-xs text-white/50">Vous pouvez appliquer une remise globale avant de générer la facture.</p>
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-4 space-y-3">
              <div>
                <Label>Remise globale</Label>
                <div className="flex items-center gap-2">
                  <Select value={discountType} onChange={(e) => { setDiscountType(e.target.value as 'NONE' | 'PERCENT' | 'AMOUNT'); setDiscountValue(''); }}>
                    <option value="NONE">Aucune</option>
                    <option value="PERCENT">Pourcentage (%)</option>
                    <option value="AMOUNT">Montant (DT)</option>
                  </Select>
                  {discountType !== 'NONE' && (
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'PERCENT' ? 'Ex: 10' : 'Ex: 50'}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Retour
              </Button>
              <Button type="button" variant="secondary" onClick={run} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? 'Génération…' : 'Générer la facture'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <h3 className="font-display text-base font-semibold text-white">Annuler la commande</h3>
            <p className="mt-1 text-xs text-white/50">
              Tout revient à l&apos;état antérieur : si le stock était encore réservé il est libéré, s&apos;il
              avait déjà été débité il est réintégré, la facture liée est annulée et un paiement encaissé
              passe en remboursé.
            </p>
            {error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}
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
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}

/**
 * Saisie manuelle du CIN sur la fiche commande : le site vitrine ne le demande
 * plus au client, le magasin le note ici (retrait en magasin, contrôle à la
 * livraison) et il est automatiquement recopié sur la fiche client.
 */
export function OrderCinField({
  id,
  cin,
  action,
}: {
  id: string
  cin: string | null
  action: (id: string, cin: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(cin ?? '')
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const save = () => {
    setError(undefined)
    startActionLoader()
    startTransition(async () => {
      try {
        const res = await action(id, value)
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        setEditing(false)
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 3000)
      } finally {
        stopActionLoader()
      }
    })
  }

  if (!editing) {
    return (
      <div>
        <p className="text-xs text-slate-400">CIN (carte d&apos;identité)</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={`font-mono ${cin ? 'text-slate-900' : 'text-slate-400 italic'}`}>
            {cin ?? 'Non renseigné'}
          </p>
          <button
            type="button"
            onClick={() => { setValue(cin ?? ''); setError(undefined); setEditing(true) }}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-accent-400"
          >
            <Pencil className="h-3 w-3" /> {cin ? 'Modifier' : 'Renseigner'}
          </button>
          {saved ? <span className="text-xs text-emerald-600">Enregistré</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Label>CIN (carte d&apos;identité)</Label>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="N° de la carte d'identité"
        inputMode="numeric"
        maxLength={8}
        autoFocus
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={pending || value.trim() === ''}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Enregistrer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setEditing(false); setError(undefined) }}
          disabled={pending}
        >
          Annuler
        </Button>
      </div>
    </div>
  )
}
