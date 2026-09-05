import { db, DeliveryNoteStatus, DeliveryNoteSource, Prisma } from '@elec/db'
import { calculateDocumentTotals, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown } from './helpers'
import { buildLineRows } from './quote.service'
import { createNotification } from './notification.service'

// ============================================================================
// Bons de livraison (Delivery Notes) :
//   - Générés automatiquement pour les ventes en caisse (POS)
//   - Numérotation séquentielle BL-YYYY-######
//   - Pas de timbre fiscal
// ============================================================================

export interface DeliveryNoteLine {
  productId: string
  quantity: number
}

export interface CreateDeliveryNoteInput {
  customerId?: string | null
  createdById: string
  lines: DeliveryNoteLine[]
  source: DeliveryNoteSource
  invoiceId?: string | null
  notes?: string | null
}

export async function createDeliveryNote(input: CreateDeliveryNoteInput) {
  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: input.lines.map((l) => l.productId) }, isActive: true },
      include: { taxRate: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    const docLines: DocumentLineInput[] = input.lines.map((l) => {
      const product = productMap.get(l.productId)
      if (!product) throw new Error(`Produit introuvable : ${l.productId}`)
      return {
        productId: product.id,
        sku: product.sku,
        designation: product.name,
        quantity: l.quantity,
        unitPriceHT: Number(product.priceHT),
        discountValue: 0,
        discountType: null,
        taxRate: Number(product.taxRate.rate),
      }
    })

    const rows = await buildLineRows(tx, docLines)
    const totals = calculateDocumentTotals({ lines: docLines, timbreFiscal: 0 })
    const number = await nextSequenceNumber('BL', currentYear(), tx)

    const deliveryNote = await tx.deliveryNote.create({
      data: {
        number,
        customerId: input.customerId ?? null,
        createdById: input.createdById,
        source: input.source,
        status: DeliveryNoteStatus.VALIDATED,
        issueDate: new Date(),
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        notes: input.notes ?? null,
        invoiceId: input.invoiceId ?? null,
        validatedAt: new Date(),
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            sku: r.sku,
            designation: r.designation,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            taxRateId: r.taxRateId,
            lineTVA: toDecimalString(r.lineTVA),
            lineTTC: toDecimalString(r.lineTTC),
          })),
        },
      },
      include: { items: { include: { taxRate: true } }, customer: true },
    })

    await createNotification({
      type: 'SYSTEM',
      title: 'Bon de livraison',
      message: `Bon de livraison ${deliveryNote.number} généré (${Number(deliveryNote.totalTTC).toFixed(3)} DT)`,
      link: null,
    })

    return deliveryNote
  })
}

export async function getDeliveryNote(id: string) {
  return db.deliveryNote.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { taxRate: true, product: true } },
      invoice: true,
      createdBy: { select: { name: true } },
    },
  })
}

export async function listDeliveryNotes(options?: { search?: string; limit?: number }) {
  const where: Prisma.DeliveryNoteWhereInput = {}
  if (options?.search) {
    where.OR = [
      { number: { contains: options.search } },
      { customer: { OR: [{ firstName: { contains: options.search } }, { lastName: { contains: options.search } }] } },
    ]
  }
  return db.deliveryNote.findMany({
    where,
    include: { customer: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}
