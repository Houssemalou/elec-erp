import { db, InvoiceStatus, InvoiceSource, DeliveryNoteSource, DeliveryNoteStatus, Prisma } from '@elec/db'
import { calculateDocumentTotals, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import { buildLineRows } from './quote.service'
import { decrementStockCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Point de Vente (POS) — Vente en caisse :
//   - Crée TOUJOURS un bon de livraison (BL) VALIDÉ
//   - Si le client demande une facture → crée aussi une facture VALIDÉE
//   - Décrémente le stock immédiatement
//   - Enregistre le paiement (espèces ou carte)
//   - Numérotation séquentielle BL-YYYY-###### (et POS-YYYY-###### si facture)
// ============================================================================

export interface PosSaleLine {
  productId: string
  quantity: number
}

export interface ManualClientInfo {
  firstName: string
  lastName?: string | null
  companyName?: string | null
  address?: string | null
  matriculeFiscal?: string | null
  cin?: string | null
}

export interface CreatePosSaleInput {
  customerId?: string | null
  createdById: string
  lines: PosSaleLine[]
  paymentMethod: 'CASH' | 'CARD'
  generateInvoice?: boolean
  manualClient?: ManualClientInfo | null
  globalDiscountType?: 'PERCENT' | 'AMOUNT' | null
  globalDiscountValue?: number | null
  notes?: string | null
}

export interface PosSaleResult {
  deliveryNoteId: string
  deliveryNoteNumber: string
  invoiceId?: string
  invoiceNumber?: string
}

export async function createPosSale(input: CreatePosSaleInput): Promise<PosSaleResult> {
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
    const totals = calculateDocumentTotals({
      lines: docLines,
      globalDiscount: input.globalDiscountType
        ? { type: input.globalDiscountType, value: input.globalDiscountValue ?? 0 }
        : null,
      timbreFiscal: 0,
    })

    // 4. Résolution du client
    let customerId = input.customerId ?? null

    if (input.generateInvoice && !customerId && input.manualClient) {
      // Créer un client à partir des informations manuelles
      const mc = input.manualClient
      const customer = await tx.customer.create({
        data: {
          firstName: mc.firstName || null,
          lastName: mc.lastName || null,
          companyName: mc.companyName || null,
          address: mc.address || null,
          matriculeFiscal: mc.matriculeFiscal || null,
          cin: mc.cin || null,
        },
      })
      customerId = customer.id
    }

    if (input.generateInvoice && !customerId) {
      throw new Error('Client requis pour générer une facture')
    }

    const blNumber = await nextSequenceNumber('BL', currentYear(), tx)

    // 5. Création du bon de livraison (TOUJOURS)
    const deliveryNote = await tx.deliveryNote.create({
      data: {
        number: blNumber,
        customerId: customerId ?? undefined,
        createdById: input.createdById,
        source: DeliveryNoteSource.POS,
        status: DeliveryNoteStatus.VALIDATED,
        issueDate: new Date(),
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        notes: input.notes ?? `Vente en caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
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
    })

    let invoiceId: string | undefined
    let invoiceNumber: string | undefined

    // 6. Création de la facture (SI demandée)
    if (input.generateInvoice && customerId) {
      const facNumber = await nextSequenceNumber('POS', currentYear(), tx)
      const invoice = await tx.invoice.create({
        data: {
          number: facNumber,
          customerId,
          createdById: input.createdById,
          source: InvoiceSource.POS,
          status: InvoiceStatus.VALIDATED,
          issueDate: new Date(),
          totalHT: toDecimalString(totals.totalHT),
          totalTVA: toDecimalString(totals.totalTVA),
          totalTTC: toDecimalString(totals.totalTTC),
          timbreFiscal: 0,
          discountGlobal: toDecimalString(totals.discountGlobal),
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
        include: { items: true },
      })

      invoiceId = invoice.id
      invoiceNumber = invoice.number

      // Lier le bon de livraison à la facture
      await tx.deliveryNote.update({
        where: { id: deliveryNote.id },
        data: { invoiceId: invoice.id },
      })

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

      // 8. Décrémentation du stock (via facture)
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

      // 9. Notification
      await createNotification({
        type: 'PAYMENT_RECEIVED',
        title: 'Vente en caisse',
        message: `Facture ${invoice.number} + Bon de livraison ${blNumber} — ${Number(invoice.totalTTC).toFixed(3)} DT (${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'})`,
        link: `/factures/${invoice.id}`,
      })
    } else {
      // Pas de facture — décrémentation du stock via BL
      for (const row of rows) {
        if (row.productId) {
          await decrementStockCore(tx, {
            productId: row.productId,
            warehouseId,
            quantity: row.quantity,
            type: StockMovementType.SALE,
            reference: blNumber,
            reason: `Vente caisse ${blNumber} (sans facture)`,
            userId: input.createdById,
          })
        }
      }

      // Notification bon de livraison uniquement
      await createNotification({
        type: 'SYSTEM',
        title: 'Vente en caisse',
        message: `Bon de livraison ${blNumber} — ${Number(deliveryNote.totalTTC).toFixed(3)} DT (${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'})`,
        link: null,
      })
    }

    return {
      deliveryNoteId: deliveryNote.id,
      deliveryNoteNumber: blNumber,
      invoiceId,
      invoiceNumber,
    }
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
