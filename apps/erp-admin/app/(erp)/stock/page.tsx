import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Select, CardHeader } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { listStockLevels, listStockMovements } from '@elec/services'
import { StockForms } from '@/components/stock/stock-forms'
import { adjustStockAction, transferStockAction, runInventoryAction } from '@/lib/actions/erp'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const movementLabel: Record<string, string> = {
  PURCHASE_RECEIPT: 'Réception',
  SALE: 'Vente',
  RETURN: 'Retour',
  ADJUSTMENT: 'Ajustement',
  TRANSFER_OUT: 'Transfert sortant',
  TRANSFER_IN: 'Transfert entrant',
  RESERVATION: 'Réservation',
  RELEASE: 'Libération',
  INVENTORY: 'Inventaire',
}

const movementTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  PURCHASE_RECEIPT: 'green',
  RETURN: 'green',
  TRANSFER_IN: 'green',
  SALE: 'red',
  ADJUSTMENT: 'amber',
  TRANSFER_OUT: 'red',
  INVENTORY: 'amber',
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string; alert?: string; page?: string }>
}) {
  const params = await searchParams
  const page = pageNumber(params.page)
  const warehouses = await db.warehouse.findMany({ orderBy: { name: 'asc' } })
  const warehouse = warehouses.find((w) => w.id === params.warehouse)?.id

  const levels = await listStockLevels({
    warehouseId: warehouse || undefined,
    belowThreshold: params.alert === '1',
  })
  const total = levels.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageLevels = levels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const products = await db.product.findMany({
    where: { isActive: true },
    include: { stockLevels: true },
    orderBy: { name: 'asc' },
  })

  const inventoryByWarehouse: Record<string, Array<{ productId: string; sku: string; name: string; theoretical: number }>> = {}
  for (const w of warehouses) {
    inventoryByWarehouse[w.id] = products.map((p) => {
      const level = p.stockLevels.find((l) => l.warehouseId === w.id)
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        theoretical: Number(level?.quantity ?? 0),
      }
    })
  }

  const movements = await listStockMovements({ limit: 20 })

  return (
    <div className="space-y-6">
      <PageHeader title="Stock" description="Niveaux, ajustements manuels, transferts et mouvements." />

      <StockForms
        products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        inventoryByWarehouse={inventoryByWarehouse}
        adjustAction={adjustStockAction}
        transferAction={transferStockAction}
        inventoryAction={runInventoryAction}
      />

      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <Select name="warehouse" defaultValue={warehouse} className="w-56">
            <option value="">Tous les dépôts</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="alert" value="1" defaultChecked={params.alert === '1'} className="h-4 w-4 rounded" />
            Stock sous le seuil d&apos;alerte
          </label>
          <button type="submit" className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Filtrer
          </button>
        </form>

        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Produit</TH>
              <TH>Dépôt</TH>
              <TH className="text-right">Disponible</TH>
              <TH className="text-right">Réservé</TH>
              <TH className="text-right">Seuil</TH>
              <TH>Statut</TH>
            </TR>
          </THead>
          <tbody>
            {pageLevels.map((l) => {
              const available = Number(l.quantity) - Number(l.reservedQuantity)
              const threshold = Number(l.product.minStockAlert)
              const low = threshold > 0 && available < threshold
              return (
                <TR key={l.id}>
                  <TD className="font-mono text-xs text-slate-500">{l.product.sku}</TD>
                  <TD className="font-medium text-slate-900">{l.product.name}</TD>
                  <TD>{l.warehouse.name}</TD>
                  <TD className="text-right font-medium">{available.toLocaleString('fr-FR')}</TD>
                  <TD className="text-right text-slate-500">{Number(l.reservedQuantity).toLocaleString('fr-FR')}</TD>
                  <TD className="text-right text-slate-500">{threshold > 0 ? threshold.toLocaleString('fr-FR') : '—'}</TD>
                  <TD>
                    {low ? (
                      <Badge tone="red">Sous le seuil</Badge>
                    ) : available === 0 ? (
                      <Badge tone="amber">Épuisé</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </TD>
                </TR>
              )
            })}
            {pageLevels.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun niveau de stock</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          params={{ warehouse: params.warehouse, alert: params.alert }}
        />
      </Card>

      <Card>
        <CardHeader title="Mouvements récents" subtitle="Traçabilité complète (20 derniers mouvements)" />
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Produit</TH>
              <TH>Dépôt</TH>
              <TH className="text-right">Quantité</TH>
              <TH>Référence</TH>
              <TH>Responsable</TH>
            </TR>
          </THead>
          <tbody>
            {movements.map((m) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap">{formatDate(m.createdAt)}</TD>
                <TD>
                  <Badge tone={movementTone[m.type] ?? 'slate'}>{movementLabel[m.type] ?? m.type}</Badge>
                </TD>
                <TD>
                  <span className="font-medium text-slate-900">{m.product.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{m.product.sku}</span>
                </TD>
                <TD>{m.warehouse.name}</TD>
                <TD className={`text-right font-semibold ${Number(m.quantity) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Number(m.quantity) > 0 ? '+' : ''}
                  {Number(m.quantity).toLocaleString('fr-FR')}
                </TD>
                <TD className="font-mono text-xs text-slate-500">{m.reference ?? '—'}</TD>
                <TD>{m.user?.name ?? 'Système'}</TD>
              </TR>
            ))}
            {movements.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun mouvement</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}