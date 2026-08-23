import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteSupplier } from '@/lib/actions/erp'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage({
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
          { name: { contains: q, mode: 'insensitive' as const } },
          { company: { contains: q, mode: 'insensitive' as const } },
          { matriculeFiscal: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, suppliers] = await Promise.all([
    db.supplier.count({ where }),
    db.supplier.findMany({
      where,
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description={`${total} fournisseurs`}
        actions={
          <Link href="/fournisseurs/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouveau fournisseur
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
              <TH>Fournisseur</TH>
              <TH>Société</TH>
              <TH>Matricule fiscal</TH>
              <TH>Contact</TH>
              <TH className="text-right">Bons de commande</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {suppliers.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-slate-900">{s.name}</TD>
                <TD>{s.company ?? '—'}</TD>
                <TD className="font-mono text-xs text-slate-500">{s.matriculeFiscal ?? '—'}</TD>
                <TD>{s.phone ?? s.email ?? '—'}</TD>
                <TD className="text-right">{s._count.purchaseOrders}</TD>
                <TD>
                  <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'Actif' : 'Inactif'}</Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/fournisseurs/${s.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Link>
                    <DeleteButton id={s.id} action={deleteSupplier} label="Supprimer" />
                  </div>
                </TD>
              </TR>
            ))}
            {suppliers.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun fournisseur</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}