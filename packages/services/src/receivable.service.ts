import { db, PaymentMethod, ReceivableStatus } from '@elec/db'
import { roundMoney, toDecimalString } from '@elec/contracts'
import { currentYear, nextSequenceNumber } from './helpers'

// ============================================================================
// Créances clients
//
// Deux origines, cumulées dans la même vue :
//   - les factures validées non soldées (encaissables depuis le détail facture)
//   - les créances libres, saisies à la main pour une vente au comptant non
//     facturée ou une dette de client
// ============================================================================

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  OPEN: 'Impayée',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
}

// ---------------------------------------------------------------------------
// Créances libres
// ---------------------------------------------------------------------------

export interface ReceivableInput {
  customerName: string
  customerId?: string | null
  amountTTC: number
  /** Date locale d'échéance, telle que saisie dans le formulaire. */
  dueDate?: Date | null
  notes?: string | null
}

export async function createReceivable(input: ReceivableInput, createdById: string) {
  return db.$transaction(async (tx) => {
    const number = await nextSequenceNumber('CR', currentYear(), tx)
    return tx.receivable.create({
      data: {
        number,
        customerName: input.customerName,
        customerId: input.customerId ?? null,
        amountTTC: toDecimalString(input.amountTTC),
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        createdById,
      },
      include: { customer: true, createdBy: { select: { name: true } } },
    })
  })
}

export async function updateReceivable(id: string, input: ReceivableInput) {
  return db.receivable.update({
    where: { id },
    data: {
      customerName: input.customerName,
      customerId: input.customerId ?? null,
      amountTTC: toDecimalString(input.amountTTC),
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    },
    include: { customer: true, createdBy: { select: { name: true } } },
  })
}

export async function deleteReceivable(id: string) {
  await db.receivable.delete({ where: { id } })
}

export async function getReceivable(id: string) {
  return db.receivable.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      payments: { orderBy: { receivedAt: 'desc' }, include: { createdBy: { select: { name: true } } } },
    },
  })
}

export async function listReceivables(options?: {
  status?: ReceivableStatus | 'OUTSTANDING'
  search?: string
  page?: number
  take?: number
}) {
  const where: Record<string, unknown> = {}
  if (options?.status === 'OUTSTANDING') {
    where.status = { in: [ReceivableStatus.OPEN, ReceivableStatus.PARTIALLY_PAID] }
  } else if (options?.status) {
    where.status = options.status
  }
  if (options?.search) {
    where.OR = [
      { customerName: { contains: options.search, mode: 'insensitive' } },
      { number: { contains: options.search, mode: 'insensitive' } },
    ]
  }
  const take = options?.take ?? 14
  const page = options?.page ?? 1
  const [total, receivables] = await Promise.all([
    db.receivable.count({ where }),
    db.receivable.findMany({
      where,
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        _count: { select: { payments: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * take,
      take,
    }),
  ])
  return { receivables, total, page, take }
}

/** Encaissement d'une créance libre : même logique de solde que les factures. */
export async function registerReceivablePayment(input: {
  receivableId: string
  amount: number
  method: PaymentMethod
  /** Date locale d'encaissement, telle que saisie dans le formulaire. */
  receivedAt?: Date | null
  reference?: string | null
  note?: string | null
  createdById: string
}) {
  return db.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: input.receivableId } })
    if (!receivable) throw new Error('Créance introuvable')
    const payable: ReceivableStatus[] = [ReceivableStatus.OPEN, ReceivableStatus.PARTIALLY_PAID]
    if (!payable.includes(receivable.status)) {
      throw new Error(`Cette créance n’est pas encaissable dans son état actuel`)
    }
    const remaining = roundMoney(Number(receivable.amountTTC) - Number(receivable.paidAmount))
    if (input.amount <= 0) throw new Error('Montant invalide')
    if (input.amount > remaining + 0.001) {
      throw new Error(`Le montant dépasse le reste à payer (${remaining.toFixed(3)} DT)`)
    }

    await tx.payment.create({
      data: {
        receivableId: input.receivableId,
        amount: toDecimalString(input.amount),
        method: input.method,
        reference: input.reference ?? null,
        receivedAt: input.receivedAt ?? new Date(),
        createdById: input.createdById,
        note: input.note ?? null,
      },
    })

    const newPaid = roundMoney(Number(receivable.paidAmount) + input.amount)
    const status = newPaid >= Number(receivable.amountTTC) - 0.001 ? ReceivableStatus.PAID : ReceivableStatus.PARTIALLY_PAID
    return tx.receivable.update({
      where: { id: input.receivableId },
      data: { paidAmount: toDecimalString(newPaid), status },
    })
  })
}

// ---------------------------------------------------------------------------
// Vue consolidée : factures non soldées + créances libres
// ---------------------------------------------------------------------------

export interface ReceivablesOverview {
  /** Factures validées dont il reste à encaisser. */
  invoices: Array<{
    id: string
    number: string
    customerName: string
    customerId: string | null
    issueDate: Date
    dueDate: Date | null
    totalTTC: number
    paidAmount: number
    remaining: number
    overdue: boolean
  }>
  /** Créances libres non soldées. */
  receivables: Array<{
    id: string
    number: string
    customerName: string
    issueDate: Date
    dueDate: Date | null
    amountTTC: number
    paidAmount: number
    remaining: number
    overdue: boolean
  }>
  /** Agrégat par client, tous types confondus. */
  byCustomer: Array<{ name: string; remaining: number; overdueTTC: number; invoices: number; receivables: number }>
  totals: {
    invoicesTTC: number
    receivablesTTC: number
    remainingTTC: number
    overdueTTC: number
    invoiceCount: number
    receivableCount: number
  }
}

export async function getReceivablesOverview(): Promise<ReceivablesOverview> {
  const now = new Date()
  const [invoices, receivables] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ['VALIDATED', 'PARTIALLY_PAID'] } },
      include: { customer: true },
      orderBy: { issueDate: 'asc' },
    }),
    db.receivable.findMany({
      where: { status: { in: [ReceivableStatus.OPEN, ReceivableStatus.PARTIALLY_PAID] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
  ])

  const invoiceRows = invoices
    .map((inv) => {
      const remaining = roundMoney(Number(inv.totalTTC) - Number(inv.paidAmount))
      const name =
        inv.customerName ||
        (inv.customer
          ? inv.customer.companyName || [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(' ')
          : null) ||
        'Client'
      return {
        id: inv.id,
        number: inv.number,
        customerName: name,
        customerId: inv.customerId,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        totalTTC: Number(inv.totalTTC),
        paidAmount: Number(inv.paidAmount),
        remaining,
        overdue: inv.dueDate !== null && inv.dueDate < now,
      }
    })
    .filter((r) => r.remaining > 0.001)

  const receivableRows = receivables
    .map((r) => {
      const remaining = roundMoney(Number(r.amountTTC) - Number(r.paidAmount))
      return {
        id: r.id,
        number: r.number,
        customerName: r.customerName,
        issueDate: r.createdAt,
        dueDate: r.dueDate,
        amountTTC: Number(r.amountTTC),
        paidAmount: Number(r.paidAmount),
        remaining,
        overdue: r.dueDate !== null && r.dueDate < now,
      }
    })
    .filter((r) => r.remaining > 0.001)

  // Agrégation par nom de client : c'est le nom saisi qui fait foi, les deux
  // origines de créance se cumulent sous la même entrée.
  const agg = new Map<string, { remaining: number; overdueTTC: number; invoices: number; receivables: number }>()
  const bump = (name: string, remaining: number, overdue: boolean) => {
    const entry = agg.get(name) ?? { remaining: 0, overdueTTC: 0, invoices: 0, receivables: 0 }
    entry.remaining += remaining
    if (overdue) entry.overdueTTC += remaining
    agg.set(name, entry)
  }
  for (const r of invoiceRows) {
    bump(r.customerName, r.remaining, r.overdue)
    const entry = agg.get(r.customerName)!
    entry.invoices += 1
  }
  for (const r of receivableRows) {
    bump(r.customerName, r.remaining, r.overdue)
    const entry = agg.get(r.customerName)!
    entry.receivables += 1
  }

  const byCustomer = [...agg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.remaining - a.remaining)

  const invoicesTTC = invoiceRows.reduce((s, r) => s + r.remaining, 0)
  const receivablesTTC = receivableRows.reduce((s, r) => s + r.remaining, 0)

  return {
    invoices: invoiceRows,
    receivables: receivableRows,
    byCustomer,
    totals: {
      invoicesTTC: roundMoney(invoicesTTC),
      receivablesTTC: roundMoney(receivablesTTC),
      remainingTTC: roundMoney(invoicesTTC + receivablesTTC),
      overdueTTC: roundMoney(
        [...invoiceRows, ...receivableRows].filter((r) => r.overdue).reduce((s, r) => s + r.remaining, 0),
      ),
      invoiceCount: invoiceRows.length,
      receivableCount: receivableRows.length,
    },
  }
}

// ============================================================================
// Clôtures hebdomadaires — saisie manuelle, lundi → lundi, puis verrouillage
// ============================================================================

/** Lundi 00:00 de la semaine contenant `date`. La semaine ISO démarre le lundi. */
export function mondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // getDay() : 0 = dimanche … 6 = samedi. On ramène au lundi.
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

/** Numéro de semaine ISO (1..53). */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7 // lundi = 1 … dimanche = 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export interface WeeklyClosingInput {
  weekStart: Date
  revenueTTC: number
  purchasesTTC: number
  expensesTTC: number
  otherExpensesTTC: number
  notes?: string | null
}

/** Gain TTC de la semaine. Négatif = perte. Jamais recalculé par la base. */
export function weeklyGain(input: Omit<WeeklyClosingInput, 'weekStart'>): number {
  return roundMoney(input.revenueTTC - input.purchasesTTC - input.expensesTTC - input.otherExpensesTTC)
}

export async function saveWeeklyClosing(input: WeeklyClosingInput, createdById: string) {
  const weekStart = mondayOf(input.weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return db.$transaction(async (tx) => {
    const existing = await tx.weeklyClosing.findUnique({ where: { weekStart } })
    // Une semaine clôturée est verrouillée : la réouverture passe par une
    // action dédiée, pas par une simple sauvegarde.
    if (existing?.closedAt) {
      throw new Error('Cette semaine est clôturée : rouvrez-la avant de la modifier')
    }
    const number = existing?.number ?? (await nextSequenceNumber('SEM', currentYear(), tx))
    return tx.weeklyClosing.upsert({
      where: { weekStart },
      create: {
        number,
        weekStart,
        weekEnd,
        revenueTTC: toDecimalString(input.revenueTTC),
        purchasesTTC: toDecimalString(input.purchasesTTC),
        expensesTTC: toDecimalString(input.expensesTTC),
        otherExpensesTTC: toDecimalString(input.otherExpensesTTC),
        notes: input.notes ?? null,
        createdById,
      },
      update: {
        revenueTTC: toDecimalString(input.revenueTTC),
        purchasesTTC: toDecimalString(input.purchasesTTC),
        expensesTTC: toDecimalString(input.expensesTTC),
        otherExpensesTTC: toDecimalString(input.otherExpensesTTC),
        notes: input.notes ?? null,
      },
    })
  })
}

/** Verrouille la semaine : elle ne sera plus modifiable sans réouverture. */
export async function closeWeeklyClosing(id: string) {
  const closing = await db.weeklyClosing.findUnique({ where: { id } })
  if (!closing) throw new Error('Clôture introuvable')
  return db.weeklyClosing.update({ where: { id }, data: { closedAt: new Date() } })
}

/** Réouvre une semaine clôturée pour correction. */
export async function reopenWeeklyClosing(id: string) {
  const closing = await db.weeklyClosing.findUnique({ where: { id } })
  if (!closing) throw new Error('Clôture introuvable')
  return db.weeklyClosing.update({ where: { id }, data: { closedAt: null } })
}

export async function deleteWeeklyClosing(id: string) {
  await db.weeklyClosing.delete({ where: { id } })
}

export async function getWeeklyClosing(id: string) {
  return db.weeklyClosing.findUnique({ where: { id }, include: { createdBy: { select: { name: true } } } })
}

export async function getWeeklyClosingByWeek(date: Date) {
  return db.weeklyClosing.findUnique({
    where: { weekStart: mondayOf(date) },
    include: { createdBy: { select: { name: true } } },
  })
}

export async function listWeeklyClosings(take = 26) {
  return db.weeklyClosing.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { weekStart: 'desc' },
    take,
  })
}