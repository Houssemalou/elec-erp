import Link from 'next/link'
import { Plus, Eye, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Select, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  SENT: 'blue',
  PARTIALLY_RECEIVED: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const status = params.status
  const page = pageNumber(params.page)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { supplier: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [total, orders] = await Promise.all([
    db.purchaseOrder.count({ where }),
    db.purchaseOrder.findMany({
      where,
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Bons de commande"
        description={`${total} bons de commande fournisseurs`}
        actions={
          <Link href="/achats/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouveau bon de commande
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="N° de bon, fournisseur…" className="pl-9" />
          </div>
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].includes(k))
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </Select>
          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Filtrer
          </button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>N°</TH>
              <TH>Date</TH>
              <TH>Fournisseur</TH>
              <TH>Livraison prévue</TH>
              <TH className="text-right">Montant</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {orders.map((o) => (
              <TR key={o.id}>
                <TD className="font-mono text-xs font-medium text-brand-800">{o.number}</TD>
                <TD>{formatDate(o.createdAt)}</TD>
                <TD className="font-medium text-slate-900">{o.supplier.name}</TD>
                <TD>{o.expectedDate ? formatDate(o.expectedDate) : '—'}</TD>
                <TD className="text-right font-semibold">{money(o.totalTTC)}</TD>
                <TD>
                  <Badge tone={statusTone[o.status] ?? 'slate'}>{STATUS_LABELS[o.status] ?? o.status}</Badge>
                </TD>
                <TD className="text-right">
                  <Link href={`/achats/${o.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    <Eye className="h-3.5 w-3.5" /> Voir
                  </Link>
                </TD>
              </TR>
            ))}
            {orders.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun bon de commande</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, status }} />
      </Card>
    </div>
  )
}