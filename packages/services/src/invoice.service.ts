import { db, DeliveryNoteStatus, InvoiceStatus, Prisma } from '@elec/db'
import {
  calculateDocumentTotals,
  roundMoney,
  toDecimalString,
  type DocumentLineInput,
} from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, type DbClient } from './helpers'
import { buildLineRows } from './quote.service'
import {
  decrementStockCore,
  incrementStockCore,
  reverseSalesForReferenceCore,
  StockMovementType,
} from './stock.service'
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
  customerId?: string | null
  customerName?: string | null
  customerMatricule?: string | null
  customerAddress?: string | null
  customerCity?: string | null
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
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerMatricule: input.customerMatricule ?? null,
        customerAddress: input.customerAddress ?? null,
        customerCity: input.customerCity ?? null,
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
            unitPriceTTC: toDecimalString(r.unitPriceTTC),
            discountType: r.discountType,
            discountValue: toDecimalString(r.discountValue),
            netUnitPrice: toDecimalString(r.netUnitPrice),
            netUnitPriceTTC: toDecimalString(r.netUnitPriceTTC),
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

/** N° de commande en ligne à l'origine d'une facture ("Facture issue de la commande en ligne OC-…"). */
function extractOnlineOrderNumber(notes: string | null): string | null {
  if (!notes) return null
  return notes.match(/commande en ligne (OC-\d{4}-\d{6})/)?.[1] ?? null
}

/** Le stock de cette référence a-t-il déjà été débité par une vente ? */
async function hasSalesForReference(client: DbClient, reference: string): Promise<boolean> {
  const movement = await client.stockMovement.findFirst({
    where: { reference, type: StockMovementType.SALE, quantity: { lt: 0 } },
    select: { id: true },
  })
  return movement !== null
}

/**
 * VALIDATION d'une facture (brouillon → validée) :
 *   - décrémente le stock (SALE, référence = n° facture)
 *   - verrouille le numéro (non modifiable ensuite)
 *
 * Cas particulier : une facture émise depuis une commande en ligne déjà
 * confirmée. La sortie de stock a été faite à la confirmation de la commande ;
 * on ne la refait pas ici, sinon le stock serait débité deux fois et son
 * annulation ne pourrait pas revenir à l'état précédent.
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

    const orderNumber = extractOnlineOrderNumber(invoice.notes)
    const alreadySoldByOrder =
      orderNumber !== null && (await hasSalesForReference(tx, orderNumber))

    if (!alreadySoldByOrder) {
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
    }

    return tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VALIDATED, validatedAt: new Date() },
      include: { items: { include: { taxRate: true } }, customer: true },
    })
  })
}

/**
 * ANNULATION d'une facture — retour complet à l'état antérieur :
 *   - le stock débité à la validation est réintégré (mouvements SALE de la
 *     facture, dépôt par dépôt) ;
 *   - les bons de livraison rattachés (ventes en caisse) passent à CANCELLED ;
 *   - le statut passe à CANCELLED, ce qui retire la facture du chiffre
 *     d'affaires, de l'encaissé, de la TVA et des créances.
 * Une facture DRAFT n'ayant jamais débité de stock, rien n'est réintégré.
 */
export async function cancelInvoiceCore(client: DbClient, id: string, userId: string | null) {
  const invoice = await client.invoice.findUnique({
    where: { id },
    include: { deliveryNotes: { select: { id: true } } },
  })
  if (!invoice) throw new Error('Facture introuvable')
  const allowed: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.VALIDATED,
    InvoiceStatus.PAID,
    InvoiceStatus.PARTIALLY_PAID,
  ]
  if (!allowed.includes(invoice.status)) {
    throw new Error('Cette facture ne peut pas être annulée')
  }

  const restored = await reverseSalesForReferenceCore(client, {
    reference: invoice.number,
    reason: `Annulation facture ${invoice.number}`,
    userId,
  })

  if (invoice.deliveryNotes.length > 0) {
    await client.deliveryNote.updateMany({
      where: { id: { in: invoice.deliveryNotes.map((d) => d.id) } },
      data: { status: DeliveryNoteStatus.CANCELLED },
    })
  }

  const updated = await client.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED },
  })

  await createNotification({
    type: 'SYSTEM',
    title: 'Facture annulée',
    message: `Facture ${invoice.number} annulée — ${Number(invoice.totalTTC).toFixed(3)} DT retirés du chiffre d'affaires, ${restored.quantity.toFixed(3)} unité(s) réintégrée(s) en stock.`,
    link: `/factures/${invoice.id}`,
  })

  return { invoice: updated, restored }
}

export async function cancelInvoice(id: string, userId: string) {
  return db.$transaction(async (tx) => {
    const { invoice } = await cancelInvoiceCore(tx, id, userId)
    return invoice
  })
}

/** Conversion Devis → Facture (réutilise les lignes et la remise globale). */
export async function convertQuoteToInvoice(quoteId: string, createdById: string) {
  return db.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { items: { include: { taxRate: true } }, customer: true },
    })
    if (!quote) throw new Error('Devis introuvable')
    if (quote.invoiceId) throw new Error('Ce devis a déjà été converti en facture')

    const rows = quote.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.unitPriceHT),
      unitPriceTTC: Number(i.unitPriceTTC),
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
        customerId: quote.customerId ?? null,
        customerName: quote.customerName ?? null,
        customerMatricule: quote.customer?.matriculeFiscal ?? null,
        customerAddress: quote.customer?.address ?? null,
        customerCity: quote.customer?.city ?? null,
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
            unitPriceTTC: i.unitPriceTTC,
            discountType: i.discountType,
            discountValue: i.discountValue,
            netUnitPrice: i.netUnitPrice,
            netUnitPriceTTC: i.netUnitPriceTTC,
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
export async function createInvoiceFromOnlineOrder(
  onlineOrderId: string,
  createdById: string,
  discountType?: 'PERCENT' | 'AMOUNT' | null,
  discountValue?: number | null,
) {
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
      unitPriceTTC: Number(i.unitPriceTTC),
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

    // Use provided discount or fall back to order's stored discount
    const effectiveDiscountType = discountType || (Number(order.discountGlobal) > 0 ? 'AMOUNT' : null)
    const effectiveDiscountValue = discountType ? (discountValue ?? 0) : Number(order.discountGlobal)

    const totals = calculateDocumentTotals({
      lines: rows,
      globalDiscount: effectiveDiscountType
        ? { type: effectiveDiscountType, value: effectiveDiscountValue }
        : null,
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
            unitPriceTTC: toDecimalString(r.unitPriceTTC),
            discountType: r.discountType,
            discountValue: toDecimalString(r.discountValue),
            netUnitPrice: toDecimalString(r.netUnitPrice),
            netUnitPriceTTC: toDecimalString(r.netUnitPriceTTC),
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