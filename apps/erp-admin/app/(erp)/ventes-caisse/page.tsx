import Link from 'next/link'
import { Eye, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { money, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function extractPayment(notes: string | null): { label: string; tone: 'green' | 'blue' | 'slate' } {
  if (!notes) return { label: '—', tone: 'slate' }
  if (notes.includes('Carte')) return { label: 'Carte', tone: 'blue' }
  if (notes.includes('Espèces')) return { label: 'Espèces', tone: 'green' }
  return { label: notes.slice(0, 30), tone: 'slate' }
}

export default async function VentesCaissePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)

  const where = { source: 'POS' as const }
  if (q) {
    Object.assign(where, {
      OR: [
        { number: { contains: q, mode: 'insensitive' as const } },
        { customer: { OR: [{ firstName: { contains: q, mode: 'insensitive' as const } }, { lastName: { contains: q, mode: 'insensitive' as const } }] } },
      ],
    })
  }

  const [total, sales] = await Promise.all([
    db.deliveryNote.count({ where }),
    db.deliveryNote.findMany({
      where,
      include: { customer: true, invoice: { select: { id: true, number: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader title="Ventes en caisse" description={`${total} vente${total > 1 ? 's' : ''}`} />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="N° de bon, client…" className="pl-9" />
          </div>
          <button type="submit" className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-white/70 hover:bg-[#1A1A1A]">
            Filtrer
          </button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>N° BL</TH>
              <TH>Date</TH>
              <TH>Client</TH>
              <TH>Paiement</TH>
              <TH className="text-right">HT</TH>
              <TH className="text-right">TVA</TH>
              <TH className="text-right">TTC</TH>
              <TH>Facture</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {sales.map((sale) => {
              const pay = extractPayment(sale.notes)
              const customerName = sale.customer
                ? (sale.customer.companyName || [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(' ') || null)
                : null
              return (
                <TR key={sale.id}>
                  <TD className="font-mono text-xs font-medium text-white/70">{sale.number}</TD>
                  <TD>{formatDate(sale.issueDate)}</TD>
                  <TD className="font-medium text-white">{customerName ?? <span className="text-white/40">—</span>}</TD>
                  <TD>
                    <Badge tone={pay.tone}>{pay.label}</Badge>
                  </TD>
                  <TD className="text-right">{money(sale.totalHT)}</TD>
                  <TD className="text-right">{money(sale.totalTVA)}</TD>
                  <TD className="text-right font-semibold">{money(sale.totalTTC)}</TD>
                  <TD>
                    {sale.invoice ? (
                      <Link
                        href={`/factures/${sale.invoice.id}`}
                        className="font-mono text-xs font-medium text-accent-400 hover:text-accent-300"
                      >
                        {sale.invoice.number}
                      </Link>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/ventes-caisse/${sale.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5"
                    >
                      <Eye className="h-3.5 w-3.5" /> Voir
                    </Link>
                  </TD>
                </TR>
              )
            })}
            {sales.length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-12 text-center text-white/40">Aucune vente en caisse</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}
