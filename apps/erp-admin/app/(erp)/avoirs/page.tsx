import Link from 'next/link'
import { Plus, Eye, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)

  const where = q
    ? {
        OR: [
          { number: { contains: q, mode: 'insensitive' as const } },
          { invoice: { number: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : undefined

  const [total, notes] = await Promise.all([
    db.creditNote.count({ where }),
    db.creditNote.findMany({
      where,
      include: { invoice: true, customer: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Avoirs"
        description={`${total} avoirs`}
        actions={
          <Link href="/avoirs/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvel avoir
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="border-b border-[#2A2A2A] p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="N° d&apos;avoir, n° de facture…" className="pl-9" />
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>N°</TH>
              <TH>Date</TH>
              <TH>Facture liée</TH>
              <TH>Motif</TH>
              <TH className="text-right">Montant</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {notes.map((n) => (
              <TR key={n.id}>
                <TD className="font-mono text-xs font-medium text-white/70">{n.number}</TD>
                <TD>{formatDate(n.createdAt)}</TD>
                <TD>
                  <Link href={`/factures/${n.invoiceId}`} className="font-mono text-xs text-accent-400 hover:underline">
                    {n.invoice.number}
                  </Link>
                </TD>
                <TD className="max-w-xs truncate text-white/50">{n.reason}</TD>
                <TD className="text-right font-semibold text-red-700">− {money(n.totalTTC)}</TD>
                <TD>
                  <Badge tone={n.status === 'VALIDATED' ? 'green' : n.status === 'CANCELLED' ? 'red' : 'slate'}>
                    {STATUS_LABELS[n.status] ?? n.status}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <Link href={`/avoirs/${n.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5">
                    <Eye className="h-3.5 w-3.5" /> Voir
                  </Link>
                </TD>
              </TR>
            ))}
            {notes.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-white/40">Aucun avoir</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}