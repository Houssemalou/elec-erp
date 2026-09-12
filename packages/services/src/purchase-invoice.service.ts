import { db, PurchaseInvoiceStatus, Prisma } from '@elec/db'
import {
  calculateDocumentTotals,
  roundMoney,
  toDecimalString,
  type DocumentLineInput,
} from '@elec/contracts'
import { currentYear, getDefaultWarehouseId, nextSequenceNumber, serializeVatBreakdown } from './helpers'
import { buildLineRows } from './quote.service'
import { incrementStockCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Factures d'achat — on renseigne ici les factures reçues des fournisseurs
// (et non les bons de livraison). La validation incrémente le stock façon
// réception fournisseur (PURCHASE_RECEIPT).
// ============================================================================

export const PURCHASE_TIMBRE_FISCAL = 1

export async function createPurchaseInvoice(input: {
  supplierId: string
  createdById: string
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
      globalDiscount: input.globalDiscountType
        ? { type: input.globalDiscountType, value: input.globalDiscountValue ?? 0 }
        : null,
      timbreFiscal: input.timbreFiscal ?? PURCHASE_TIMBRE_FISCAL,
    })
    const number = await nextSequenceNumber('ACH', currentYear(), tx)

    return tx.purchaseInvoice.create({
      data: {
        number,
        supplierId: input.supplierId,
        createdById: input.createdById,
        status: PurchaseInvoiceStatus.DRAFT,
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
      include: { items: { include: { taxRate: true } }, supplier: true },
    })
  })
}

/**
 * VALIDATION d'une facture d'achat (brouillon → validée) :
 *   - incrémente le stock (PURCHASE_RECEIPT, référence = n° facture d'achat)
 *   - verrouille le numéro
 */
export async function validatePurchaseInvoice(id: string, userId: string, warehouseId?: string) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!invoice) throw new Error('Facture d’achat introuvable')
    if (invoice.status !== PurchaseInvoiceStatus.DRAFT) {
      throw new Error('Seule une facture d’achat brouillon peut être validée')
    }
    const wId = warehouseId ?? (await getDefaultWarehouseId(tx))

    for (const item of invoice.items) {
      if (item.productId) {
        await incrementStockCore(tx, {
          productId: item.productId,
          warehouseId: wId,
          quantity: Number(item.quantity),
          type: StockMovementType.PURCHASE_RECEIPT,
          reference: invoice.number,
          reason: `Facture d'achat ${invoice.number}`,
          userId,
        })
      }
    }

    const updated = await tx.purchaseInvoice.update({
      where: { id },
      data: { status: PurchaseInvoiceStatus.VALIDATED, receivedAt: new Date() },
      include: { items: { include: { taxRate: true } }, supplier: true },
    })

    await createNotification({
      type: 'STOCK_RECEIVED',
      title: 'Marchandise réceptionnée',
      message: `La facture d'achat ${invoice.number} (${updated.supplier.name}) a été validée : stock incrémenté.`,
      link: `/achats/${invoice.id}`,
    })

    return updated
  })
}

export async function cancelPurchaseInvoice(id: string, userId: string) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findUnique({ where: { id } })
    if (!invoice) throw new Error('Facture d’achat introuvable')
    const allowed: PurchaseInvoiceStatus[] = [PurchaseInvoiceStatus.DRAFT, PurchaseInvoiceStatus.VALIDATED]
    if (!allowed.includes(invoice.status)) {
      throw new Error('Cette facture d’achat ne peut pas être annulée')
    }
    return tx.purchaseInvoice.update({ where: { id }, data: { status: PurchaseInvoiceStatus.CANCELLED } })
  })
}

export async function listPurchaseInvoices(options?: { status?: PurchaseInvoiceStatus; search?: string; limit?: number }) {
  const where: Prisma.PurchaseInvoiceWhereInput = {}
  if (options?.status) where.status = options.status
  if (options?.search) {
    where.OR = [{ number: { contains: options.search } }, { supplier: { name: { contains: options.search } } }]
  }
  return db.purchaseInvoice.findMany({
    where,
    include: { supplier: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getPurchaseInvoice(id: string) {
  return db.purchaseInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true, taxRate: true } },
    },
  })
}

export { roundMoney }