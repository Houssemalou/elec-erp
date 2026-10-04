import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Select, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteExpense } from '@/lib/actions/erp'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_PAYMENT_LABELS } from '@/lib/labels'
import { money, formatDate } from '@/lib/utils'
import { ExpenseCategory } from '@elec/db'

export const dynamic = 'force-dynamic'

const categoryTones: Record<ExpenseCategory, 'blue' | 'green' | 'amber' | 'red' | 'accent' | 'slate'> = {
  LOYER: 'blue',
  SALAIRES: 'green',
  ELECTRICITE: 'amber',
  TRANSPORT: 'accent',
  FOURNITURES: 'slate',
  IMPOTS: 'red',
  AUTRE: 'slate',
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categorie?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)
  const categorie = params.categorie

  const where = {
    ...(categorie ? { category: categorie as ExpenseCategory } : {}),
    ...(q
      ? {
          OR: [
            { label: { contains: q, mode: 'insensitive' as const } },
            { number: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, expenses, monthTotal] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.expense.aggregate({ _sum: { amountTTC: true } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Dépenses"
        description={`${total} dépenses · ${money(Number(monthTotal._sum.amountTTC ?? 0))} au total`}
        actions={
          <Link href="/depenses/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvelle dépense
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="flex flex-wrap gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="Libellé, référence…" className="pl-9" />
          </div>
          <Select name="categorie" defaultValue={categorie ?? ''} className="w-48">
            <option value="">Toutes les catégories</option>
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="md">
            Filtrer
          </Button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Libellé</TH>
              <TH>Catégorie</TH>
              <TH>Date</TH>
              <TH>Règlement</TH>
              <TH className="text-right">Montant TTC</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {expenses.map((e) => (
              <TR key={e.id}>
                <TD className="font-mono text-xs text-white/50">{e.number}</TD>
                <TD className="font-medium text-white">{e.label}</TD>
                <TD>
                  <Badge tone={categoryTones[e.category]}>{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                </TD>
                <TD>{formatDate(e.expenseDate)}</TD>
                <TD>{EXPENSE_PAYMENT_LABELS[e.paymentMethod]}</TD>
                <TD className="text-right font-semibold text-white">{money(e.amountTTC)}</TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/depenses/${e.id}/edit`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Link>
                    <DeleteButton id={e.id} action={deleteExpense} label="Supprimer" />
                  </div>
                </TD>
              </TR>
            ))}
            {expenses.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-white/40">
                  Aucune dépense
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, categorie }} />
      </Card>
    </div>
  )
}
