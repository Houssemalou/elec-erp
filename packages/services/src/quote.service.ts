import { db, QuoteStatus, Prisma, DiscountType } from '@elec/db'
import {
  calculateDocumentTotals,
  calculateLineTotal,
  roundMoney,
  toDecimalString,
  type DocumentLineInput,
} from '@elec/contracts'
import { DbClient, getTaxRateIdByRate, nextSequenceNumber, serializeVatBreakdown } from './helpers'
import { createNotification } from './notification.service'

// ============================================================================
// Devis — les calculs HT/TVA/TTC proviennent UNIQUEMENT de @elec/contracts
// (fonctions pures partagées avec le frontend). Timbre fiscal = 0 sur devis.
// ============================================================================

export interface BuildLineRow {
  productId: string | null
  sku: string
  designation: string
  quantity: number
  unitPriceHT: number
  discountType: DiscountType | null
  discountValue: number
  netUnitPrice: number
  lineHT: number
  taxRateId: string
  lineTVA: number
  lineTTC: number
}

export async function buildLineRows(client: DbClient, lines: DocumentLineInput[]): Promise<BuildLineRow[]> {
  const rows: BuildLineRow[] = []
  for (const line of lines) {
    const totals = calculateLineTotal({
      quantity: line.quantity,
      unitPriceHT: line.unitPriceHT,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxRate: line.taxRate,
    })
    rows.push({
      productId: line.productId ?? null,
      sku: line.sku,
      designation: line.designation,
      quantity: Number(line.quantity),
      unitPriceHT: roundMoney(Number(line.unitPriceHT)),
      discountType: (line.discountType as DiscountType | undefined) ?? null,
      discountValue: Number(line.discountValue ?? 0),
      netUnitPrice: totals.netUnitPrice,
      lineHT: totals.lineHT,
      taxRateId: await getTaxRateIdByRate(line.taxRate, client),
      lineTVA: totals.lineTVA,
      lineTTC: totals.lineTTC,
    })
  }
  return rows
}

function globalDiscountFromInput(input: { globalDiscountType?: 'PERCENT' | 'AMOUNT' | null; globalDiscountValue?: number }) {
  if (!input.globalDiscountType) return null
  return { type: input.globalDiscountType, value: input.globalDiscountValue ?? 0 }
}

export async function createQuote(input: {
  customerId: string
  createdById: string
  validUntil?: string | null
  globalDiscountType?: 'PERCENT' | 'AMOUNT' | null
  globalDiscountValue?: number
  notes?: string | null
  conditions?: string | null
  lines: DocumentLineInput[]
}) {
  return db.$transaction(async (tx) => {
    const rows = await buildLineRows(tx, input.lines)
    const totals = calculateDocumentTotals({
      lines: input.lines,
      globalDiscount: globalDiscountFromInput(input),
      timbreFiscal: 0,
    })
    const number = await nextSequenceNumber('DEV', new Date().getFullYear(), tx)

    return tx.quote.create({
      data: {
        number,
        customerId: input.customerId,
        createdById: input.createdById,
        status: QuoteStatus.DRAFT,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: '0.000',
        discountGlobal: toDecimalString(totals.discountGlobal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        notes: input.notes ?? null,
        conditions: input.conditions ?? null,
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            sku: r.sku,
            designation: r.designation,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            discountType: r.discountType,
            discountValue: toDecimalString(r.discountValue),
            netUnitPrice: toDecimalString(r.netUnitPrice),
            lineHT: toDecimalString(r.lineHT),
            taxRateId: r.taxRateId,
            lineTVA: toDecimalString(r.lineTVA),
            lineTTC: toDecimalString(r.lineTTC),
          })),
        },
      },
      include: { items: { include: { taxRate: true } }, customer: true, createdBy: { select: { name: true } } },
    })
  })
}

export async function updateQuote(
  id: string,
  input: {
    customerId: string
    validUntil?: string | null
    globalDiscountType?: 'PERCENT' | 'AMOUNT' | null
    globalDiscountValue?: number
    notes?: string | null
    conditions?: string | null
    lines: DocumentLineInput[]
  },
) {
  const existing = await db.quote.findUnique({ where: { id } })
  if (!existing) throw new Error('Devis introuvable')
  if (existing.status !== QuoteStatus.DRAFT) {
    throw new Error('Seul un devis brouillon peut être modifié')
  }
  return db.$transaction(async (tx) => {
    const rows = await buildLineRows(tx, input.lines)
    const totals = calculateDocumentTotals({
      lines: input.lines,
      globalDiscount: globalDiscountFromInput(input),
      timbreFiscal: 0,
    })
    await tx.quoteItem.deleteMany({ where: { quoteId: id } })
    return tx.quote.update({
      where: { id },
      data: {
        customerId: input.customerId,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        discountGlobal: toDecimalString(totals.discountGlobal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        notes: input.notes ?? null,
        conditions: input.conditions ?? null,
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            sku: r.sku,
            designation: r.designation,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            discountType: r.discountType,
            discountValue: toDecimalString(r.discountValue),
            netUnitPrice: toDecimalString(r.netUnitPrice),
            lineHT: toDecimalString(r.lineHT),
            taxRateId: r.taxRateId,
            lineTVA: toDecimalString(r.lineTVA),
            lineTTC: toDecimalString(r.lineTTC),
          })),
        },
      },
      include: { items: { include: { taxRate: true } }, customer: true },
    })
  })
}

export async function deleteQuote(id: string) {
  const existing = await db.quote.findUnique({ where: { id } })
  if (!existing) throw new Error('Devis introuvable')
  if (existing.status !== QuoteStatus.DRAFT) {
    throw new Error('Seul un devis brouillon peut être supprimé')
  }
  return db.quote.delete({ where: { id } })
}

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  const quote = await db.quote.update({ where: { id }, data: { status } })
  if (status === QuoteStatus.ACCEPTED) {
    await createNotification({
      type: 'QUOTE_ACCEPTED',
      title: 'Devis accepté',
      message: `Le devis ${quote.number} a été accepté par le client.`,
      link: `/devis/${quote.id}`,
    })
  }
  return quote
}

export async function listQuotes(options?: { status?: QuoteStatus; search?: string; limit?: number }) {
  const where: Prisma.QuoteWhereInput = {}
  if (options?.status) where.status = options.status
  if (options?.search) {
    where.OR = [
      { number: { contains: options.search } },
      { customer: { OR: [{ firstName: { contains: options.search } }, { lastName: { contains: options.search } }, { companyName: { contains: options.search } }] } },
    ]
  }
  return db.quote.findMany({
    where,
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getQuote(id: string) {
  return db.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { taxRate: true, product: true } },
      createdBy: { select: { name: true } },
      invoice: true,
    },
  })
}

export async function getQuoteByNumber(number: string) {
  return db.quote.findUnique({
    where: { number },
    include: { customer: true, items: { include: { taxRate: true } } },
  })
}

export { calculateLineTotal }