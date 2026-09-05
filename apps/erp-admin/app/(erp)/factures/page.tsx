import Link from 'next/link'
import { Plus, Eye, Search, FileDown } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Select, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  VALIDATED: 'blue',
  PAID: 'green',
  PARTIALLY_PAID: 'accent',
  CANCELLED: 'red',
  CREDITED: 'amber',
}

export default async function InvoicesPage({
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

  const [total, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      include: { customer: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Factures"
        description={`${total} factures`}
        actions={
          <Link href="/factures/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvelle facture
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="N° de facture, client…" className="pl-9" />
          </div>
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => ['DRAFT', 'VALIDATED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'CREDITED'].includes(k))
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
              <TH className="text-right">HT</TH>
              <TH className="text-right">TVA</TH>
              <TH className="text-right">TTC</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {invoices.map((inv) => {
              const name = inv.customer.companyName || [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(' ') || 'Client'
              return (
                <TR key={inv.id}>
                  <TD className="font-mono text-xs font-medium text-white/70">{inv.number}</TD>
                  <TD>{formatDate(inv.issueDate)}</TD>
                  <TD className="font-medium text-white">{name}</TD>
                  <TD className="text-right">{money(inv.totalHT)}</TD>
                  <TD className="text-right">{money(inv.totalTVA)}</TD>
                  <TD className="text-right font-semibold">{money(inv.totalTTC)}</TD>
                  <TD>
                    <Badge tone={statusTone[inv.status] ?? 'slate'}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/api/pdf/invoice?id=${inv.id}`}
                        target="_blank"
                        className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-accent-400 hover:bg-accent-400/10"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Link>
                      <Link href={`/factures/${inv.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5">
                        <Eye className="h-3.5 w-3.5" /> Voir
                      </Link>
                    </div>
                  </TD>
                </TR>
              )
            })}
            {invoices.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-white/40">Aucune facture</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, status }} />
      </Card>
    </div>
  )
}