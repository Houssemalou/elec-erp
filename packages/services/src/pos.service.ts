import { db, InvoiceStatus, InvoiceSource, Prisma } from '@elec/db'
import { calculateDocumentTotals, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import { buildLineRows } from './quote.service'
import { decrementStockCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Point de Vente (POS) — Vente en caisse :
//   - Crée une facture directement VALIDÉE (pas de brouillon)
//   - Décrémente le stock immédiatement
//   - Enregistre le paiement (espèces ou carte)
//   - Numérotation séquentielle POS-YYYY-######
// ============================================================================

export interface PosSaleLine {
  productId: string
  quantity: number
}

export interface CreatePosSaleInput {
  customerId: string
  createdById: string
  lines: PosSaleLine[]
  paymentMethod: 'CASH' | 'CARD'
  notes?: string | null
}

export async function createPosSale(input: CreatePosSaleInput) {
  const warehouseId = await getDefaultWarehouseId()

  return db.$transaction(async (tx) => {
    // 1. Résolution des produits
    const products = await tx.product.findMany({
      where: { id: { in: input.lines.map((l) => l.productId) }, isActive: true },
      include: { taxRate: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 2. Construction des lignes
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

    // 3. Calcul des totaux
    const rows = await buildLineRows(tx, docLines)
    const totals = calculateDocumentTotals({ lines: docLines, timbreFiscal: 0 })

    // 4. Numérotation POS
    const number = await nextSequenceNumber('POS', currentYear(), tx)

    // 5. Création de la facture directement VALIDÉE
    const invoice = await tx.invoice.create({
      data: {
        number,
        customerId: input.customerId,
        createdById: input.createdById,
        source: InvoiceSource.POS,
        status: InvoiceStatus.VALIDATED,
        issueDate: new Date(),
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: 0,
        discountGlobal: 0,
        paidAmount: toDecimalString(totals.totalTTC),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        validatedAt: new Date(),
        notes: input.notes ?? `Vente en caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
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

    // 6. Décrémentation du stock
    for (const item of invoice.items) {
      if (item.productId) {
        await decrementStockCore(tx, {
          productId: item.productId,
          warehouseId,
          quantity: Number(item.quantity),
          type: StockMovementType.SALE,
          reference: invoice.number,
          reason: `Vente caisse ${invoice.number}`,
          userId: input.createdById,
        })
      }
    }

    // 7. Enregistrement du paiement
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: toDecimalString(totals.totalTTC),
        method: input.paymentMethod,
        receivedAt: new Date(),
        createdById: input.createdById,
        note: `Paiement caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
      },
    })

    // 8. Notification
    await createNotification({
      type: 'PAYMENT_RECEIVED',
      title: 'Vente en caisse',
      message: `Vente ${invoice.number} — ${Number(invoice.totalTTC).toFixed(3)} DT (${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'})`,
      link: `/factures/${invoice.id}`,
    })

    return invoice
  })
}

/** Liste des ventes POS (factures avec source = POS). */
export async function listPosSales(options?: { search?: string; limit?: number }) {
  const where: Prisma.InvoiceWhereInput = { source: InvoiceSource.POS }
  if (options?.search) {
    where.OR = [
      { number: { contains: options.search } },
      { customer: { OR: [{ firstName: { contains: options.search } }, { lastName: { contains: options.search } }] } },
    ]
  }
  return db.invoice.findMany({
    where,
    include: { customer: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

/** Détail d'une vente POS. */
export async function getPosSale(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { taxRate: true, product: true } },
      payments: true,
      createdBy: { select: { name: true } },
    },
  })
}
