import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteCustomer } from '@/lib/actions/erp'

export const dynamic = 'force-dynamic'

export default async function ClientsPage({
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
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { companyName: { contains: q, mode: 'insensitive' as const } },
          { matriculeFiscal: { contains: q, mode: 'insensitive' as const } },
          { cin: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, clients] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      include: { _count: { select: { invoices: true, quotes: true, onlineOrders: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fullName = (c: (typeof clients)[number]) =>
    c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client sans nom'

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`${total} clients`}
        actions={
          <Link href="/clients/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouveau client
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Nom, société, matricule fiscal…" className="pl-9" />
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Type</TH>
              <TH>Matricule fiscal</TH>
              <TH>CIN</TH>
              <TH>Contact</TH>
              <TH className="text-right">Factures</TH>
              <TH className="text-right">Devis</TH>
              <TH className="text-right">Commandes</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {clients.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">{fullName(c)}</TD>
                <TD>
                  <Badge tone={c.type === 'PROFESSIONNEL' ? 'blue' : 'slate'}>
                    {c.type === 'PROFESSIONNEL' ? 'Professionnel' : 'Particulier'}
                  </Badge>
                </TD>
                <TD className="font-mono text-xs text-slate-500">{c.matriculeFiscal ?? '—'}</TD>
                <TD className="font-mono text-xs text-slate-500">{c.cin ?? '—'}</TD>
                <TD>{c.phone ?? c.email ?? '—'}</TD>
                <TD className="text-right">{c._count.invoices}</TD>
                <TD className="text-right">{c._count.quotes}</TD>
                <TD className="text-right">{c._count.onlineOrders}</TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/clients/${c.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Link>
                    <DeleteButton id={c.id} action={deleteCustomer} label="Supprimer" />
                  </div>
                </TD>
              </TR>
            ))}
            {clients.length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-12 text-center text-slate-400">Aucun client</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}