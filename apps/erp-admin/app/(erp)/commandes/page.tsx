import Link from 'next/link'
import { Eye, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Select } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  PENDING: 'accent',
  CONFIRMED: 'blue',
  PREPARING: 'amber',
  SHIPPED: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  REFUNDED: 'slate',
}

export default async function OrdersPage({
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
    where.OR = [{ number: { contains: q, mode: 'insensitive' } }, { shippingFullName: { contains: q, mode: 'insensitive' } }]
  }

  const [total, orders] = await Promise.all([
    db.onlineOrder.count({ where }),
    db.onlineOrder.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader title="Commandes en ligne" description={`${total} commandes`} />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="N° de commande, client…" className="pl-9" />
          </div>
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(k))
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </Select>
          <button type="submit" className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-white/70 hover:bg-[#1A1A1A]">
            Filtrer
          </button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>N°</TH>
              <TH>Date</TH>
              <TH>Client</TH>
              <TH>Ville</TH>
              <TH>Paiement</TH>
              <TH className="text-right">Montant</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {orders.map((o) => (
              <TR key={o.id}>
                <TD className="font-mono text-xs font-medium text-white/70">{o.number}</TD>
                <TD>{formatDate(o.createdAt)}</TD>
                <TD className="font-medium text-white">{o.shippingFullName}</TD>
                <TD>
                  {o.deliveryMethod === 'PICKUP' ? (
                    <Badge tone="accent">Retrait</Badge>
                  ) : (
                    <span className="text-white/60">{o.shippingCity}</span>
                  )}
                </TD>
                <TD className="text-xs">
                  <Badge tone={o.paymentStatus === 'PAID' ? 'green' : 'amber'}>
                    {o.paymentStatus === 'PAID' ? 'Payée' : 'En attente'}
                  </Badge>
                </TD>
                <TD className="text-right font-semibold">{money(o.totalTTC)}</TD>
                <TD>
                  <Badge tone={statusTone[o.status] ?? 'slate'}>{STATUS_LABELS[o.status] ?? o.status}</Badge>
                </TD>
                <TD className="text-right">
                  <Link href={`/commandes/${o.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5">
                    <Eye className="h-3.5 w-3.5" /> Voir
                  </Link>
                </TD>
              </TR>
            ))}
            {orders.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-white/40">Aucune commande</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, status }} />
      </Card>
    </div>
  )
}