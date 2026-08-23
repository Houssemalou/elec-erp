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
  ACCEPTED: 'green',
  REFUSED: 'red',
  CONVERTED: 'accent',
  EXPIRED: 'amber',
}

export default async function QuotesPage({
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
      { customer: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }] } },
    ]
  }

  const [total, quotes] = await Promise.all([
    db.quote.count({ where }),
    db.quote.findMany({
      where,
      include: { customer: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const customerName = (q: (typeof quotes)[number]) =>
    q.customer.companyName || [q.customer.firstName, q.customer.lastName].filter(Boolean).join(' ') || 'Client'

  return (
    <div>
      <PageHeader
        title="Devis"
        description={`${total} devis`}
        actions={
          <Link href="/devis/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouveau devis
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="N° de devis, client…" className="pl-9" />
          </div>
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => ['DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'CONVERTED', 'EXPIRED'].includes(k))
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
              <TH>Client</TH>
              <TH>Valide jusqu&apos;au</TH>
              <TH className="text-right">Montant</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {quotes.map((qt) => (
              <TR key={qt.id}>
                <TD className="font-mono text-xs font-medium text-brand-800">{qt.number}</TD>
                <TD>{formatDate(qt.createdAt)}</TD>
                <TD className="font-medium text-slate-900">{customerName(qt)}</TD>
                <TD>{qt.validUntil ? formatDate(qt.validUntil) : '—'}</TD>
                <TD className="text-right font-semibold">{money(qt.totalTTC)}</TD>
                <TD>
                  <Badge tone={statusTone[qt.status] ?? 'slate'}>{STATUS_LABELS[qt.status] ?? qt.status}</Badge>
                </TD>
                <TD className="text-right">
                  <Link href={`/devis/${qt.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    <Eye className="h-3.5 w-3.5" /> Voir
                  </Link>
                </TD>
              </TR>
            ))}
            {quotes.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun devis</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, status }} />
      </Card>
    </div>
  )
}