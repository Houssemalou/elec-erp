import { db, Prisma, ExpenseCategory, PaymentMethod } from '@elec/db'
import { toDecimalString } from '@elec/contracts'
import { currentYear, nextSequenceNumber } from './helpers'

// ============================================================================
// Dépenses — charges hors achats (loyer, salaires, énergie, transport…)
// Saisies en TTC : l'entreprise n'est pas assujettie à la TVA, le montant
// compté dans le gain est le montant réellement payé.
// ============================================================================

export interface ExpenseInput {
  label: string
  category: ExpenseCategory
  amountTTC: number
  expenseDate?: string | null
  paymentMethod?: PaymentMethod
  notes?: string | null
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  LOYER: 'Loyer',
  SALAIRES: 'Salaires',
  ELECTRICITE: 'Électricité',
  TRANSPORT: 'Transport',
  FOURNITURES: 'Fournitures',
  IMPOTS: 'Impôts',
  AUTRE: 'Autre',
}

export const EXPENSE_PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  CHEQUE: 'Chèque',
  EDAHABIA: 'Edahabia',
  ONLINE: 'En ligne',
}

export async function createExpense(input: ExpenseInput, createdById: string) {
  return db.$transaction(async (tx) => {
    const number = await nextSequenceNumber('DEP', currentYear(), tx)
    return tx.expense.create({
      data: {
        number,
        label: input.label,
        category: input.category,
        amountTTC: toDecimalString(input.amountTTC),
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
        paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
        notes: input.notes ?? null,
        createdById,
      },
      include: { createdBy: { select: { name: true } } },
    })
  })
}

export async function updateExpense(id: string, input: ExpenseInput) {
  return db.expense.update({
    where: { id },
    data: {
      label: input.label,
      category: input.category,
      amountTTC: toDecimalString(input.amountTTC),
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
      paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
      notes: input.notes ?? null,
    },
    include: { createdBy: { select: { name: true } } },
  })
}

export async function deleteExpense(id: string) {
  await db.expense.delete({ where: { id } })
}

export async function listExpenses(options?: {
  search?: string
  category?: ExpenseCategory
  page?: number
  take?: number
}) {
  const where: Prisma.ExpenseWhereInput = {}
  if (options?.category) where.category = options.category
  if (options?.search) {
    where.OR = [
      { label: { contains: options.search, mode: 'insensitive' } },
      { number: { contains: options.search, mode: 'insensitive' } },
    ]
  }
  const take = options?.take ?? 14
  const page = options?.page ?? 1
  const [total, expenses] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * take,
      take,
    }),
  ])
  return { expenses, total, page, take }
}

export async function getExpense(id: string) {
  return db.expense.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  })
}

/** Total des dépenses, et répartition par catégorie, pour l'onglet Finance. */
export async function getExpenseSummary(options?: { from?: Date; to?: Date }) {
  const where: Prisma.ExpenseWhereInput = {}
  if (options?.from || options?.to) {
    where.expenseDate = { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) }
  }
  const [total, byCategory] = await Promise.all([
    db.expense.aggregate({ where, _sum: { amountTTC: true } }),
    db.expense.groupBy({ by: ['category'], where, _sum: { amountTTC: true }, _count: { _all: true } }),
  ])
  const categories = byCategory
    .map((row) => ({
      category: row.category,
      label: EXPENSE_CATEGORY_LABELS[row.category],
      amountTTC: Number(row._sum.amountTTC ?? 0),
      count: row._count._all,
    }))
    .sort((a, b) => b.amountTTC - a.amountTTC)
  return { totalTTC: Number(total._sum.amountTTC ?? 0), categories }
}
