'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, ArrowLeftRight, ClipboardCheck, Loader2 } from 'lucide-react'
import { Button, Input, Select, Label } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export interface StockProduct {
  id: string
  sku: string
  name: string
}

export interface StockWarehouse {
  id: string
  name: string
}

export interface InventoryProduct {
  productId: string
  sku: string
  name: string
  theoretical: number
}

interface Props {
  products: StockProduct[]
  warehouses: StockWarehouse[]
  inventoryByWarehouse: Record<string, InventoryProduct[]>
  adjustAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  transferAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  inventoryAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}

export function StockForms({ products, warehouses, inventoryByWarehouse, adjustAction, transferAction, inventoryAction }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'adjust' | 'transfer' | 'inventory'>('adjust')

  const run = (
    action: (fd: FormData) => Promise<{ success: boolean; error?: string }>,
    form: HTMLFormElement,
    setError: (s: string | undefined) => void,
    setPending: (b: boolean) => void,
  ) => {
    const fd = new FormData(form)
    setError(undefined)
    setPending(true)
    startActionLoader()
    ;(async () => {
      try {
        const res = await action(fd)
        setPending(false)
        if (!res.success) {
          setError(res.error ?? 'Erreur')
          return
        }
        form.reset()
        router.refresh()
      } finally {
        stopActionLoader()
      }
    })()
  }

  return (
    <CardForm
      tab={tab}
      setTab={setTab}
      products={products}
      warehouses={warehouses}
      inventoryByWarehouse={inventoryByWarehouse}
      run={run}
      adjustAction={adjustAction}
      transferAction={transferAction}
      inventoryAction={inventoryAction}
    />
  )
}

function CardForm({
  tab,
  setTab,
  products,
  warehouses,
  inventoryByWarehouse,
  run,
  adjustAction,
  transferAction,
  inventoryAction,
}: {
  tab: 'adjust' | 'transfer' | 'inventory'
  setTab: (t: 'adjust' | 'transfer' | 'inventory') => void
  products: StockProduct[]
  warehouses: StockWarehouse[]
  inventoryByWarehouse: Record<string, InventoryProduct[]>
  run: (a: (fd: FormData) => Promise<{ success: boolean; error?: string }>, f: HTMLFormElement, se: (s: string | undefined) => void, sp: (b: boolean) => void) => void
  adjustAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  transferAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  inventoryAction: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const tabs = [
    { id: 'adjust' as const, label: 'Ajustement', icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: 'transfer' as const, label: 'Transfert', icon: <ArrowLeftRight className="h-4 w-4" /> },
    { id: 'inventory' as const, label: 'Inventaire', icon: <ClipboardCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-1 border-b border-slate-100 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand-700 text-brand-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'adjust' ? (
        <AdjustForm products={products} warehouses={warehouses} action={adjustAction} run={run} />
      ) : null}
      {tab === 'transfer' ? <TransferForm products={products} warehouses={warehouses} action={transferAction} run={run} /> : null}
      {tab === 'inventory' ? (
        <InventoryForm warehouses={warehouses} inventoryByWarehouse={inventoryByWarehouse} action={inventoryAction} run={run} />
      ) : null}
    </div>
  )
}

function useForm() {
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  return { error, setError, pending, setPending }
}

function AdjustForm({
  products,
  warehouses,
  action,
  run,
}: {
  products: StockProduct[]
  warehouses: StockWarehouse[]
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  run: (a: (fd: FormData) => Promise<{ success: boolean; error?: string }>, f: HTMLFormElement, se: (s: string | undefined) => void, sp: (b: boolean) => void) => void
}) {
  const { error, setError, pending, setPending } = useForm()
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(action, e.currentTarget, setError, setPending)
      }}
    >
      <div>
        <Label>Produit</Label>
        <Select name="productId" required>
          <option value="">— Choisir —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Dépôt</Label>
        <Select name="warehouseId" required>
          <option value="">— Choisir —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Quantité (signée)</Label>
        <Input type="number" step="0.001" name="quantity" required placeholder="+5 ou -2" />
      </div>
      <div className="sm:col-span-2 lg:col-span-1">
        <Label>Motif (obligatoire)</Label>
        <Input name="reason" required placeholder="Perte, casse, inventaire…" />
      </div>
      <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Appliquer l&apos;ajustement
          </Button>
        </div>
      </div>
    </form>
  )
}

function TransferForm({
  products,
  warehouses,
  action,
  run,
}: {
  products: StockProduct[]
  warehouses: StockWarehouse[]
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  run: (a: (fd: FormData) => Promise<{ success: boolean; error?: string }>, f: HTMLFormElement, se: (s: string | undefined) => void, sp: (b: boolean) => void) => void
}) {
  const { error, setError, pending, setPending } = useForm()
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(action, e.currentTarget, setError, setPending)
      }}
    >
      <div>
        <Label>Produit</Label>
        <Select name="productId" required>
          <option value="">— Choisir —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Dépôt source</Label>
        <Select name="fromWarehouseId" required>
          <option value="">— Choisir —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Dépôt destination</Label>
        <Select name="toWarehouseId" required>
          <option value="">— Choisir —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Quantité</Label>
        <Input type="number" step="0.001" name="quantity" required placeholder="10" />
      </div>
      <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Transférer le stock
          </Button>
        </div>
      </div>
    </form>
  )
}

function InventoryForm({
  warehouses,
  inventoryByWarehouse,
  action,
  run,
}: {
  warehouses: StockWarehouse[]
  inventoryByWarehouse: Record<string, InventoryProduct[]>
  action: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  run: (a: (fd: FormData) => Promise<{ success: boolean; error?: string }>, f: HTMLFormElement, se: (s: string | undefined) => void, sp: (b: boolean) => void) => void
}) {
  const { error, setError, pending, setPending } = useForm()
  const [warehouseId, setWarehouseId] = useState('')
  const rows = warehouseId ? (inventoryByWarehouse[warehouseId] ?? []) : []

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const entries = rows.map((r) => ({
          productId: r.productId,
          actualQuantity: Number((e.currentTarget.elements.namedItem(`q_${r.productId}`) as HTMLInputElement).value),
        }))
        fd.set('lines', JSON.stringify(entries))
        run(action, e.currentTarget, setError, setPending)
      }}
    >
      <div className="mb-4 max-w-xs">
        <Label>Dépôt à inventorier</Label>
        <Select name="warehouseId" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="">— Choisir —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Référence</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-right">Stock théorique</th>
                <th className="px-3 py-2 text-right">Quantité réelle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} className="border-b border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{r.sku}</td>
                  <td className="px-3 py-1.5 text-slate-900">{r.name}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{r.theoretical.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Input type="number" step="0.001" name={`q_${r.productId}`} defaultValue={String(r.theoretical)} className="w-28 text-right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Choisissez un dépôt pour saisir l&apos;inventaire.</p>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Valider l&apos;inventaire
        </Button>
      </div>
    </form>
  )
}