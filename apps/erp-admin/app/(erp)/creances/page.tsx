import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Select, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteReceivableAction } from '@/lib/actions/erp'
import { RECEIVABLE_STATUS_LABELS } from '@elec/services'
import { money, formatDate } from '@/lib/utils'
import { ReceivableStatus } from '@elec/db'

export const dynamic = 'force-dynamic'

const statusTones: Record<ReceivableStatus, 'green' | 'amber' | 'red' | 'slate'> = {
  OPEN: 'red',
  PARTIALLY_PAID: 'amber',
  PAID: 'green',
  CANCELLED: 'slate',
}

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)
  const statut = params.statut

  const where = {
    ...(statut ? { status: statut as ReceivableStatus } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: 'insensitive' as const } },
            { number: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, receivables] = await Promise.all([
    db.receivable.count({ where }),
    db.receivable.findMany({
      where,
      include: { createdBy: { select: { name: true } }, _count: { select: { payments: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Créances clients"
        description={`${total} créances saisies · les factures non soldées sont gérées dans Finance`}
        actions={
          <Link href="/creances/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvelle créance
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="flex flex-wrap gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="Client, référence…" className="pl-9" />
          </div>
          <Select name="statut" defaultValue={statut ?? ''} className="w-48">
            <option value="">Tous les statuts</option>
            {(Object.keys(RECEIVABLE_STATUS_LABELS) as ReceivableStatus[]).map((s) => (
              <option key={s} value={s}>
                {RECEIVABLE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Client</TH>
              <TH>Échéance</TH>
              <TH>Statut</TH>
              <TH className="text-right">Montant TTC</TH>
              <TH className="text-right">Réglé TTC</TH>
              <TH className="text-right">Reste dû</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {receivables.map((r) => {
              const remaining = Number(r.amountTTC) - Number(r.paidAmount)
              return (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-white/50">{r.number}</TD>
                  <TD className="font-medium text-white">{r.customerName}</TD>
                  <TD className={r.dueDate && r.dueDate < new Date() && remaining > 0 ? 'text-red-400' : ''}>
                    {r.dueDate ? formatDate(r.dueDate) : '—'}
                  </TD>
                  <TD>
                    <Badge tone={statusTones[r.status]}>{RECEIVABLE_STATUS_LABELS[r.status]}</Badge>
                  </TD>
                  <TD className="text-right">{money(r.amountTTC)}</TD>
                  <TD className="text-right text-emerald-400">{money(r.paidAmount)}</TD>
                  <TD className="text-right font-semibold text-white">{money(remaining)}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/creances/${r.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5"
                      >
                        Encaisser
                      </Link>
                      <Link
                        href={`/creances/${r.id}/edit`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </Link>
                      <DeleteButton id={r.id} action={deleteReceivableAction} label="Supprimer" />
                    </div>
                  </TD>
                </TR>
              )
            })}
            {receivables.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-white/40">
                  Aucune créance
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, statut }} />
      </Card>
    </div>
  )
}