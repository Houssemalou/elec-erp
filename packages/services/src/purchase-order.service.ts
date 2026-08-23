import { db, PurchaseOrderStatus, Prisma, StockMovementType } from '@elec/db'
import { calculateDocumentTotals, roundMoney, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import { incrementStockCore } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Bons de commande fournisseurs — la réception incrémente le stock de façon
// AUTOMATIQUE à la validation de la réception.
// ============================================================================

export interface PurchaseOrderLineInput {
  productId: string
  quantity: number
  unitPriceHT: number
  taxRate: number
}

export async function createPurchaseOrder(input: {
  supplierId: string
  createdById: string
  expectedDate?: string | null
  notes?: string | null
  lines: PurchaseOrderLineInput[]
}) {
  return db.$transaction(async (tx) => {
    const number = await nextSequenceNumber('BON', currentYear(), tx)

    const rows = await Promise.all(
      input.lines.map(async (l) => {
        const product = await tx.product.findUnique({ where: { id: l.productId }, include: { taxRate: true } })
        if (!product) throw new Error(`Produit introuvable : ${l.productId}`)
        const lineTotals = calculateDocumentTotals({
          lines: [{ quantity: l.quantity, unitPriceHT: l.unitPriceHT, taxRate: Number(product.taxRate.rate) }],
          timbreFiscal: 0,
        })
        return {
          productId: l.productId,
          quantity: l.quantity,
          unitPriceHT: l.unitPriceHT,
          taxRateId: product.taxRateId,
          lineTTC: lineTotals.totalTTC,
        }
      }),
    )

    const totals = calculateDocumentTotals({
      lines: input.lines.map((l) => ({
        quantity: l.quantity,
        unitPriceHT: l.unitPriceHT,
        taxRate: l.taxRate,
      })),
      timbreFiscal: 0,
    })

    return tx.purchaseOrder.create({
      data: {
        number,
        supplierId: input.supplierId,
        createdById: input.createdById,
        status: PurchaseOrderStatus.DRAFT,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        notes: input.notes ?? null,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            taxRateId: r.taxRateId,
            receivedQuantity: '0.000',
          })),
        },
      },
      include: { items: { include: { product: true, taxRate: true } }, supplier: true },
    })
  })
}

export async function setPurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
  return db.purchaseOrder.update({ where: { id }, data: { status } })
}

/**
 * Réception d'un bon de commande fournisseur → incrémentation AUTOMATIQUE
 * du stock + journalisation (PURCHASE_RECEIPT) + notification STOCK_RECEIVED.
 */
export async function receivePurchaseOrder(id: string, warehouseId?: string) {
  const wId = warehouseId ?? (await getDefaultWarehouseId())
  return db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
    if (!po) throw new Error('Bon de commande introuvable')
    if (po.status === PurchaseOrderStatus.CANCELLED) throw new Error('Le bon de commande est annulé')

    for (const item of po.items) {
      const remaining = Number(item.quantity) - Number(item.receivedQuantity)
      if (remaining > 0) {
        await incrementStockCore(tx, {
          productId: item.productId,
          warehouseId: wId,
          quantity: remaining,
          type: StockMovementType.PURCHASE_RECEIPT,
          reference: po.number,
          reason: `Réception bon de commande ${po.number}`,
          userId: null,
        })
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: toDecimalString(Number(item.receivedQuantity) + remaining) },
        })
      }
    }

    const allReceived = po.items.every((i) => Number(i.receivedQuantity) + (Number(i.quantity) - Number(i.receivedQuantity)) >= Number(i.quantity))
    const status = allReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: { status, receivedAt: new Date() },
      include: { supplier: true },
    })

    await createNotification({
      type: 'STOCK_RECEIVED',
      title: 'Marchandise réceptionnée',
      message: `Le bon de commande ${po.number} (${updated.supplier.name}) a été réceptionné : stock incrémenté.`,
      link: `/achats/${po.id}`,
    })

    return updated
  })
}

export async function listPurchaseOrders(options?: { status?: PurchaseOrderStatus; search?: string; limit?: number }) {
  const where: Prisma.PurchaseOrderWhereInput = {}
  if (options?.status) where.status = options.status
  if (options?.search) {
    where.OR = [{ number: { contains: options.search } }, { supplier: { name: { contains: options.search } } }]
  }
  return db.purchaseOrder.findMany({
    where,
    include: { supplier: true, createdBy: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getPurchaseOrder(id: string) {
  return db.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true, taxRate: true } }, supplier: true, createdBy: { select: { name: true } } },
  })
}

export { roundMoney }