import { db, InvoiceStatus, Prisma } from '@elec/db'
import {
  calculateDocumentTotals,
  roundMoney,
  toDecimalString,
  type DocumentLineInput,
} from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown } from './helpers'
import { buildLineRows } from './quote.service'
import { decrementStockCore, incrementStockCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Factures — logique fiscale tunisienne :
//   - Remise (ligne + globale) appliquée AVANT la TVA (calculs @elec/contracts)
//   - Timbre fiscal fixe (1 DT) ajouté sur chaque facture
//   - Numérotation séquentielle annuelle FAC-YYYY-######, atomique,
//     verrouillée après validation
//   - Le stock n'est décrémenté qu'à la VALIDATION de la facture
// ============================================================================

export const TIMBRE_FISCAL = 1

export async function buildInvoiceItems(client: Prisma.TransactionClient, lines: DocumentLineInput[]) {
  return buildLineRows(client as never, lines)
}

export async function createInvoice(input: {
  customerId: string
  createdById: string
  quoteId?: string | null
  issueDate?: string | null
  dueDate?: string | null
  globalDiscountType?: 'PERCENT' | 'AMOUNT' | null
  globalDiscountValue?: number
  notes?: string | null
  lines: DocumentLineInput[]
  timbreFiscal?: number
}) {
  return db.$transaction(async (tx) => {
    const rows = await buildLineRows(tx, input.lines)
    const totals = calculateDocumentTotals({
      lines: input.lines,
      globalDiscount: input.globalDiscountType ? { type: input.globalDiscountType, value: input.globalDiscountValue ?? 0 } : null,
      timbreFiscal: input.timbreFiscal ?? TIMBRE_FISCAL,
    })
    const number = await nextSequenceNumber('FAC', currentYear(), tx)

    return tx.invoice.create({
      data: {
        number,
        customerId: input.customerId,
        quoteId: input.quoteId ?? null,
        createdById: input.createdById,
        status: InvoiceStatus.DRAFT,
        issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: toDecimalString(totals.timbreFiscal),
        discountGlobal: toDecimalString(totals.discountGlobal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        notes: input.notes ?? null,
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

/**
 * VALIDATION d'une facture (brouillon → validée) :
 *   - décrémente le stock (SALE, référence = n° facture)
 *   - verrouille le numéro (non modifiable ensuite)
 */
export async function validateInvoice(id: string, userId: string, warehouseId?: string) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!invoice) throw new Error('Facture introuvable')
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Seule une facture brouillon peut être validée')
    }
    const wId =
      warehouseId ??
      (await tx.warehouse.findFirst({ where: { isDefault: true } }))?.id ??
      (await tx.warehouse.findFirst())?.id
    if (!wId) throw new Error('Aucun dépôt configuré')

    for (const item of invoice.items) {
      if (item.productId) {
        await decrementStockCore(tx, {
          productId: item.productId,
          warehouseId: wId,
          quantity: Number(item.quantity),
          type: StockMovementType.SALE,
          reference: invoice.number,
          reason: `Facture ${invoice.number}`,
          userId,
        })
      }
    }

    return tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VALIDATED, validatedAt: new Date() },
      include: { items: { include: { taxRate: true } }, customer: true },
    })
  })
}

export async function cancelInvoice(id: string, userId: string) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } })
    if (!invoice) throw new Error('Facture introuvable')
    const allowed: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.VALIDATED]
    if (!allowed.includes(invoice.status)) {
      throw new Error('Cette facture ne peut pas être annulée')
    }
    return tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED } })
  })
}

/** Conversion Devis → Facture (réutilise les lignes et la remise globale). */
export async function convertQuoteToInvoice(quoteId: string, createdById: string) {
  return db.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { items: { include: { taxRate: true } } },
    })
    if (!quote) throw new Error('Devis introuvable')
    if (quote.invoiceId) throw new Error('Ce devis a déjà été converti en facture')

    const rows = quote.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.unitPriceHT),
      discountType: i.discountType as 'PERCENT' | 'AMOUNT' | null,
      discountValue: Number(i.discountValue),
      taxRate: Number(i.taxRate.rate),
    }))

    const totals = calculateDocumentTotals({
      lines: rows,
      globalDiscount: Number(quote.discountGlobal) > 0 ? { type: 'AMOUNT', value: Number(quote.discountGlobal) } : null,
      timbreFiscal: TIMBRE_FISCAL,
    })

    const number = await nextSequenceNumber('FAC', currentYear(), tx)
    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId: quote.customerId,
        quoteId: quote.id,
        createdById,
        status: InvoiceStatus.DRAFT,
        issueDate: new Date(),
        dueDate: quote.validUntil ?? null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: toDecimalString(totals.timbreFiscal),
        discountGlobal: toDecimalString(totals.discountGlobal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        items: {
          create: quote.items.map((i) => ({
            productId: i.productId,
            sku: i.sku,
            designation: i.designation,
            quantity: i.quantity,
            unitPriceHT: i.unitPriceHT,
            discountType: i.discountType,
            discountValue: i.discountValue,
            netUnitPrice: i.netUnitPrice,
            lineHT: i.lineHT,
            taxRateId: i.taxRateId,
            lineTVA: i.lineTVA,
            lineTTC: i.lineTTC,
          })),
        },
      },
      include: { items: { include: { taxRate: true } }, customer: true },
    })

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: 'CONVERTED', invoiceId: invoice.id },
    })

    return invoice
  })
}

export async function registerPayment(input: {
  invoiceId: string
  amount: number
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'EDAHABIA' | 'ONLINE'
  receivedAt?: string | null
  reference?: string | null
  note?: string | null
  createdById: string
}) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } })
    if (!invoice) throw new Error('Facture introuvable')
    const payable: InvoiceStatus[] = [InvoiceStatus.VALIDATED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID]
    if (!payable.includes(invoice.status)) {
      throw new Error('La facture n\'est pas payable dans son état actuel')
    }
    const remaining = Number(invoice.totalTTC) - Number(invoice.paidAmount)
    if (input.amount <= 0) throw new Error('Montant invalide')
    if (input.amount > remaining + 0.001) {
      throw new Error(`Le montant dépasse le reste à payer (${remaining.toFixed(3)} DT)`)
    }

    await tx.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount: toDecimalString(input.amount),
        method: input.method,
        reference: input.reference ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        createdById: input.createdById,
        note: input.note ?? null,
      },
    })

    const newPaid = roundMoney(Number(invoice.paidAmount) + input.amount)
    const status =
      newPaid >= Number(invoice.totalTTC) - 0.001 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID

    const updated = await tx.invoice.update({
      where: { id: input.invoiceId },
      data: { paidAmount: toDecimalString(newPaid), status },
    })

    await createNotification({
      type: 'PAYMENT_RECEIVED',
      title: 'Paiement reçu',
      message: `Paiement de ${input.amount.toFixed(3)} DT encaissé pour la facture ${invoice.number}.`,
      link: `/factures/${invoice.id}`,
    })

    return updated
  })
}

/** Facture générée à partir d'une commande en ligne confirmée. */
export async function createInvoiceFromOnlineOrder(onlineOrderId: string, createdById: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: onlineOrderId },
      include: { items: { include: { taxRate: true } }, customer: true },
    })
    if (!order) throw new Error('Commande introuvable')

    const rows: DocumentLineInput[] = order.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.unitPriceHT),
      discountType: i.discountType as 'PERCENT' | 'AMOUNT' | null,
      discountValue: Number(i.discountValue),
      taxRate: Number(i.taxRate.rate),
    }))

    // Les frais de livraison sont une prestation soumise à la TVA 19%.
    if (Number(order.shippingCost) > 0) {
      rows.push({
        productId: null,
        sku: 'LIVRAISON',
        designation: 'Frais de livraison',
        quantity: 1,
        unitPriceHT: Number(order.shippingCost),
        discountValue: 0,
        discountType: null,
        taxRate: 19,
      })
    }

    const totals = calculateDocumentTotals({
      lines: rows,
      timbreFiscal: Number(order.timbreFiscal),
    })
    const number = await nextSequenceNumber('FAC', currentYear(), tx)
    const built = await buildLineRows(tx, rows)

    return tx.invoice.create({
      data: {
        number,
        customerId: order.customerId,
        createdById,
        status: InvoiceStatus.DRAFT,
        issueDate: new Date(),
        dueDate: null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: toDecimalString(totals.timbreFiscal),
        discountGlobal: toDecimalString(totals.discountGlobal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        notes: `Facture issue de la commande en ligne ${order.number}`,
        items: {
          create: built.map((r) => ({
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

export async function listInvoices(options?: { status?: InvoiceStatus; search?: string; limit?: number }) {
  const where: Prisma.InvoiceWhereInput = {}
  if (options?.status) where.status = options.status
  if (options?.search) {
    where.OR = [
      { number: { contains: options.search } },
      { customer: { OR: [{ firstName: { contains: options.search } }, { lastName: { contains: options.search } }, { companyName: { contains: options.search } }] } },
    ]
  }
  return db.invoice.findMany({
    where,
    include: {
      customer: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { taxRate: true, product: true } },
      payments: true,
      quote: true,
      createdBy: { select: { name: true } },
      creditNotes: true,
    },
  })
}

export async function getInvoiceByNumber(number: string) {
  return db.invoice.findUnique({
    where: { number },
    include: { customer: true, items: { include: { taxRate: true } }, payments: true },
  })
}